# API Contracts
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.0
**Date:** 2026-08-07
**Author:** api-contracts-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.

---

## 1. Purpose and how to read this document

This doc is the complete API surface of the Marketplace platform: every GraphQL operation on every
service, plus the 3 REST endpoints that exist outside GraphQL. It binds Phase 1-3 (`phase1/PDR.md`,
`phase2/UBIQUITOUS_LANGUAGE.md`, `phase2/BOUNDED_CONTEXT.md`, `phase3/SECURITY_AUTH.md`,
`phase3/adr/ADR-INDEX.md`) and sits under `phase4/CONSTRAINTS.md` — a contract that contradicts a
higher-ranked doc is wrong, not a superseding decision (`phase4/CONSTRAINTS.md` §7).

⚠️ **RULE — the resolvers are the contract, the schema files are not.** No service on this platform has
an SDL file. All 9 build their GraphQL schema programmatically from
`src/graphQLApi/schema/{queries,mutations}.mts` (roots) and one file per operation under
`{queries,mutations}/<entity><Add|Update|Del|Dis>.mts`. The exception spells its root differently:
`marketplace-dev-public-resource` and `marketplace-dev-public-authorization` both use
`src/graphQLPublic/schema/`, not `src/graphQLApi/schema/` — a `find`/`grep` written for the other 7
silently misses both (confirmed on disk this pass — `phase4/CONSTRAINTS.md` §5 names only
`public-resource` as the exception; `public-authorization` shares the same `graphQLPublic` root, see
§4.1). The three frontends' `schema/*.graphql` slices are **hand-maintained convenience copies that
drift** — every operation below was read from the resolver source itself, never from a slice. Treat a
slice that disagrees with this document as the thing that is wrong.

Every operation entry below states: name, type (query/mutation), serving service:port, required tier,
arguments, answer type, one-line effect. Every row cites the resolver file that defines it. This is Part
1 of 2 — sections 1-5. A second agent appends §6 onward (Admin tier, User tier, versioning policy, error
taxonomy, open questions).

---

## 2. Transport, authentication and conventions

**Transport.** GraphQL is the whole API on 8 of 9 services, all mounted via Apollo Server 5 at one path
per service through `@as-integrations/koa` (`BEs/dev/marketplace-dev-authenticated-resource/src/index.mts`
pattern, identical across the other 7 GraphQL-only services). The one exception mounts a real
`@koa/router` alongside GraphQL — see §4.3.

**Auth headers, by service kind:**

| Service kind | Credential | Where it travels |
|---|---|---|
| `*-authorization` (token lifecycle) | Refresh token | Koa **signed cookie**, Keygrip SHA-512 (`KEYGRIP_KEY_1`/`_2`), httpOnly |
| `*-resource` (domain data) | Access token | `Authorization: Bearer access:<token>` header, checked against Redis on every call |
| Any service, internal caller | `x-introspectioncode` header, value = `INTROSPECTION_CODE` | Bypasses the bearer-token/tier check entirely — service-to-service only, never a browser client. Treat as a secret with the same weight as `KEYGRIP_KEY_1`/`_2` (`phase3/SECURITY_AUTH.md` §3.6; `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:27-37`) |

Tokens are **opaque** — looked up in Redis, never decoded, never trusted for content (`phase3/SECURITY_AUTH.md`
§3.1). Every session hash carries a `tier` (`'admin' | 'shopOwner' | 'user'`) and every resource/authorization
service asserts its own expected tier before trusting `ctx.state.user`:

```ts
// BEs/marketplace-common/src/others/assertTier.mts:21-23
export function assertTier(actual: string | undefined, expected: Tier): void {
	if (actual !== expected) throw throwForbiddenError()
}
```

A tier mismatch answers **403, never 401** — the caller authenticated correctly, just against the wrong
tier's session; a 401 would tell it to refresh, which cannot fix a tier mismatch
(`phase3/SECURITY_AUTH.md` §3.2). A session with no `tier` field at all (pre-2026-08-05) is rejected, not
grandfathered — `actual !== expected` has no `undefined` carve-out.

**`csrfPrevention: true` is set on every one of the 9 services** — confirmed at
`BEs/dev/marketplace-dev-authenticated-resource/src/index.mts:180`. This is why every client on this
platform sets `preferGetMethod: false` (ADR-021) — confirmed in both urql clients that ship it,
`marketplace-user/src/api/ssr.ts:50` and `marketplace-user/src/api/client.ts:61`. A GET carrying none of
Apollo's preflight-forcing headers is rejected outright; urql sends none by default, so any query issued
over GET fails with a CSRF error while the same query over POST succeeds. **Do not design a new operation
assuming GET is viable** — there is no such path on this platform outside the 3 REST endpoints in §4.3,
which are deliberately not GraphQL (ADR-021; `phase4/CONSTRAINTS.md` §5).

**Answer-type conventions:**

- Create/delete/update mutations answer a bare `Boolean` **by default**. A urql document cache
  invalidates nothing on a bare boolean unless the call site passes `additionalTypenames` — confirmed in
  use at `marketplace-shopowner/src/api/client.ts` and `marketplace-shopowner/src/features/companies/Companies.tsx`.
- **Deliberate exceptions to the bare-`Boolean` default**, on the ShopOwner tier only — do not "fix"
  toward `Boolean` elsewhere without the same cache-invalidation justification (`phase4/CONSTRAINTS.md`
  DCON-08):
  - `companyAdd` answers `OnlyIdType` (the new `_id`) — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts:27`.
  - `itemAdd` **also** answers `OnlyIdType`, not `Boolean` — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/itemAdd.mts:34`. ⚠️ This is a correction to how the exception is framed elsewhere on this platform: `docs/frontends.md` names only `companyAdd` as the `OnlyIdType` exception. Reading the resolver directly (per the §1 rule) shows `itemAdd` follows the identical pattern — "answers the new `_id`, like `companyAdd`, unlike the operator tier's `Boolean`" per the comment at the cited line. Both are the owner-tier's own creation flow needing the new id to continue (e.g. attach an image next); the exception is genuinely two mutations, not one.
  - `GraphQLInputCompanyPosition` requires `type: String!` on the ShopOwner tier and forbids it on the Admin tier, which stamps `'Point'` server-side. Declared inline inside `GraphQLInputCompany.mts:46-51` (`GraphQLInputCompanyPosition`, built from `GraphQLPositionFrag`) — there is no separate `GraphQLInputCompanyPosition.mts` file, despite the type name suggesting one.

**Error shape.** Not duplicated here — see `phase4/ERROR_HANDLING.md` for the taxonomy and payload shape
every resolver on this platform throws through `tryCatchRethrow` / `throwForbiddenError` /
`throwPreconditionFailedNoAuthHeader` and equivalents.

---

## 3. Service and port map

9 hand-rolled Koa 3 servers, each mounting Apollo Server 5 at one path. Split on tier (who) × concern
(what). Ports read from each repo's committed `env` template, `grep -m1 '^PORT=' <repo>/env` — safe
placeholder file, never the real `.env`.

| Service | Port | Tier | Concern | Confirmed |
|---|---|---|---|---|
| `marketplace-dev-public-authorization` | 4028 | public (anonymous) | `login`, `loginAdmin`, `loginUser` | `env:1` |
| `marketplace-dev-public-resource` | 4027 | public (anonymous) | public catalogue reads, customer registration, verify-email | `env:1` |
| `marketplace-dev-authenticated-authorization` | 4029 | ShopOwner | token lifecycle | `env:1` |
| `marketplace-dev-authenticated-resource` | 4026 | ShopOwner | domain data, item/company CRUD, uploads | `env:1` |
| `marketplace-dev-authenticated-logout` | 4030 | **all three** | logout | — (not re-verified this pass; per `docs/architecture.md` §Services) |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | Admin | token lifecycle | — (Part 2) |
| `marketplace-dev-admin-authenticated-resource` | 4024 | Admin | domain data, `itemCategory` CRUD, moderation | — (Part 2) |
| `marketplace-dev-user-authenticated-authorization` | 4031 | User | token lifecycle | — (Part 2) |
| `marketplace-dev-user-authenticated-resource` | 4032 | User | account, personal data, addresses | — (Part 2) |

⚠️ **The logout row is deliberate, not an omission.** `marketplace-dev-authenticated-logout` deletes the
Redis session keys by **token content**, never asking which collection minted them — the same
`REDIS_KEY` prefix is shared by all 9 services on purpose (`phase3/SECURITY_AUTH.md` §3.2), so one logout
service can serve all three tiers structurally. All three frontends point at port 4030 for logout. Tier-named
logout mutations were evaluated and rejected — see `phase3/adr/ADR-INDEX.md` §4 (decisions deliberately
not re-opened).

**authorization** services = refresh-cookie in → Redis session lookup → mint access+refresh token pair.
No business queries live here. **resource** services = bearer access-token in → Redis lookup → serves
domain GraphQL. Only resource services carry `sharp`, `clamscan`, `file-type`, `graphql-upload` as
dependencies (confirmed for the ShopOwner resource service at
`BEs/dev/marketplace-dev-authenticated-resource/package.json:42,44,49,56`).

**How to read the per-service tables in §4-§8.** One shape, one rule: `| Op | Args | Answer | Effect |
Source |` where a table holds a single root type, plus a leading `Type` column where it mixes queries and
mutations. `Args` is the resolver's declared `args` block, GraphQL-spelled (`_id: ID!`), with defaults
written `= VALUE` when the resolver declares a `defaultValue`; `Answer` is the declared return type, `—`
for a smoke-test query that answers nothing worth naming. `Source` is repo-relative to the service named
in the sub-heading — `schema/mutations/refresh.mts:11-25` means
`BEs/dev/<that-service>/src/graphQL{Api,Public}/schema/mutations/refresh.mts`, `graphQLPublic` for the two
public services and `graphQLApi` for the other seven (§1).

---

## 4. Public tier (anonymous)

No auth middleware runs in front of either public service — every field below is reachable by anyone on
the internet, unauthenticated, at whatever rate they choose, unless the operation states otherwise
(all three logins are rate-limited and Turnstile-gated, as are the customer-facing mutations under §4.2;
`resetPwd`/`updatePwd` are the two that are not — see the per-operation notes).

### 4.1 `marketplace-dev-public-authorization` — port 4028

Root files: `src/graphQLPublic/schema/{queries,mutations}.mts` — this service also uses the `graphQLPublic`
root, same as `public-resource` (§1).

| Op | Type | Args | Answer | Effect | Source |
|---|---|---|---|---|---|
| `login` | mutation | `email: String!`, `password: String!`, `rememberMe: Boolean!`, `turnstileToken: String` | `LoginAppType!` (`accessToken`, `onboardingStep`, `onboardingDone`) | Logs a `ShopOwner` in; sets refresh cookie; stamps `tier: TIER.shopOwner` into the Redis session; rate-limited + Turnstile-gated by `guardPublicLogin` (20/hr per IP, 60/hr per email) | `mutations/login.mts` |
| `loginAdmin` | mutation | `email: String!`, `password: String!`, `rememberMe: Boolean!`, `turnstileToken: String` | `LoginAppType!` | Logs an `Admin` in; `onboardingDone` is hardcoded `true` (Admin has no onboarding flow); stamps `tier: TIER.admin`; rate-limited + Turnstile-gated, **tightest ceilings of the three** (10/hr per IP, 30/hr per email — a handful of accounts exist and nothing legitimate retries more) | `mutations/loginAdmin.mts` |
| `loginUser` | mutation | `email: String!`, `password: String!`, `rememberMe: Boolean!`, `turnstileToken: String` | `LoginUserType!` (`accessToken` only — no onboarding fields, a customer has none) | Logs a `User` (customer) in; stamps `tier: TIER.user`; rate-limited + Turnstile-gated (20/hr per IP, 60/hr per email); refuses if `emailVerify.valid` is false, same generic error as every other failure (anti-enumeration) | `mutations/loginUser.mts`; `types/LoginUserType.mts:16-21` |
| `authPublicHello` | query | none observed | — | Smoke-test query confirming the endpoint is mounted; no business logic | `schema/queries.mts:3,33` |

`LoginAppType` (shared by `login`/`loginAdmin`) is defined once, in `@axiumine/koa-utils`, not per-service:

```ts
// koa-utils/src/graphQL/schema/types/LoginAppType.mts:4-10
export const LoginAppType = new GraphQLObjectType({
	name: 'LoginAppType',
	fields: () => ({
		accessToken: { type: new GraphQLNonNull(GraphQLString) },
		onboardingStep: { type: new GraphQLNonNull(GraphQLString) },
		onboardingDone: { type: new GraphQLNonNull(GraphQLBoolean) }
	})
})
```

One mutation per tier is deliberate, not an oversight to consolidate: "role here is which collection you
authenticate against, so the three differ in their model, their session `tier` and — for `loginUser` only
— an email-verification gate. A single `login(tier:)` would put that choice in the caller's hands"
(`mutations.mts:7-9`). Do not propose collapsing them (`phase4/CONSTRAINTS.md` DCON-09).

### 4.2 `marketplace-dev-public-resource` — port 4027

Root files: `src/graphQLPublic/schema/{queries,mutations}.mts` (confirmed — this is the service
`phase4/CONSTRAINTS.md` §5 names as the `graphQLPublic` exception).

**Queries — the public catalogue read surface, all unauthenticated:**

| Op | Args | Answer | Effect | Source |
|---|---|---|---|---|
| `companies` | `limit: Int`, `offset: Int`, `city: String` | `GraphQLPublicCompanyPage!` | Published companies, paginated, optionally filtered by city | `queries/companies.mts:48-53` |
| `companyBySlug` | `slug: String!` | `GraphQLPublicCompany` (nullable) | One published company by slug, or `null` | `queries/companyBySlug.mts:29-33` |
| `companiesNearby` | `bbox: GraphQLInputBoundingBox`, `near: GraphQLInputNearPoint`, `limit: Int` | `GraphQLPublicCompanyNearbyResult!` | Published companies inside a bounding box, or within a radius of a point (the 2dsphere geo query) | `queries/companiesNearby.mts:65-71` |
| `items` | `companySlug: String`, `idCategory: ID`, `limit: Int`, `offset: Int` | `GraphQLPublicItemPage!` | Published items of one company, or of one category across every company | `queries/items.mts:54-61` |
| `itemBySlug` | `companySlug: String!`, `slug: String!` | `GraphQLPublicItemHit` (nullable) | One published item by its company slug + own slug, or `null` | `queries/itemBySlug.mts:42-47` |
| `itemCategories` | none | `[GraphQLPublicItemCategory!]!` | Whole item category tree, flat | `queries/itemCategories.mts:37-38` |
| `search` | `q: String!`, `near: GraphQLInputNearPoint`, `limit: Int` | `GraphQLPublicSearchResult!` | Full-text search over published companies and items, optionally radius-bounded | `queries/search.mts:63-69` |
| `sitemapEntries` | `kind: GraphQLSitemapKind!`, `afterId: ID`, `limit: Int` | `GraphQLSitemapPage!` | Crawlable paths of one kind, keyset-paginated by `_id` | `queries/sitemapEntries.mts:63-69` |
| `publicHelloNoArgs`, `publicHelloArgs` | — | — | Smoke-test queries predating the catalogue; kept as the mounted-endpoint check | `schema/queries.mts:33-34` |

⚠️ Every bounded argument above (`limit`, `offset`, `q`, `radiusMeters`/bbox size) is bounded **in the
resolver** — nothing upstream of this service bounds it, since no auth middleware runs here
(`schema/queries.mts:20-23`).

**Mutations — customer registration + both tiers' password-reset pair:**

| Op | Args | Answer | Effect | Source |
|---|---|---|---|---|
| `userRegister` | `email: String!`, `password: String!`, `repeatPassword: String!`, `turnstileToken: String` | `Boolean!` | Registers a new `User`, sends the activation link; rate-limited + Turnstile-gated | `mutations/userRegister.mts:50-58` |
| `userVerifyEmailResend` | `email: String!`, `turnstileToken: String` | `Boolean!` | Re-sends the customer activation link; rate-limited + Turnstile-gated | `mutations/userVerifyEmailResend.mts:46-51` |
| `userResetPwd` | `email: String!`, `turnstileToken: String` | same type as `resetPwd` below (`boundResetPwd.type`) | Sends a customer password-reset link (mails on `APP_DOMAIN_USER`); rate-limited + Turnstile-gated | `mutations/userResetPwd.mts:37-42` |
| `userUpdatePwd` | `email: String!`, `hash: String!`, `password: String!`, `turnstileToken: String` | same type as `updatePwd` below (`boundUpdatePwd.type`) | Confirms a customer password reset | `mutations/userUpdatePwd.mts:37-44` |
| `resetPwd` | mirrors `userResetPwd` minus `turnstileToken` (the ShopOwner pair is still not Turnstile-gated — `mutations.mts:23-28`) | bound from `resetPwdFlow.mjs` | Sends a `ShopOwner` password-reset link (mails on `APP_DOMAIN`); **not** rate-limited or Turnstile-gated | `schema/mutations.mts:3,21` |
| `updatePwd` | mirrors `userUpdatePwd` minus `turnstileToken` | bound from `resetPwdFlow.mjs` | Confirms a `ShopOwner` password reset | `schema/mutations.mts:3,22` |
| `publicMutNoArgs`, `publicMutArgs` | — | — | Smoke-test mutations | `schema/mutations.mts:16-17` |

Two collections, two flows, never one dispatching on an argument: "an email plus a hash says nothing
about which [collection]" (`schema/mutations.mts:18-20`). `resetPwd`/`updatePwd` are now the only two
public operations on the platform **not** behind the Turnstile+rate-limit guard: they are the ShopOwner
tier's recovery pair, and no frontend calls them — neither panel ships a recovery screen, so the tokens
they would need have nowhere to come from yet (`schema/mutations.mts:23-28`). `login` and `loginAdmin`
*were* in that list and no longer are; both panels mint a Turnstile token now and both mutations run
`guardPublicLogin` before they touch the database.

### 4.3 The three REST endpoints — the only REST on the platform

Mounted with a real `@koa/router` at `src/middleware/router/index.mts`, prefix `/check`, on
`marketplace-dev-public-resource` (port 4027) — no other service on the platform mounts a router
(`phase4/CONSTRAINTS.md` §5). Why REST and not GraphQL: a verification link in an email is a `GET` a
browser follows by clicking it — there is no GraphQL client on the other end to attach a bearer header or
a POST body, so these three are the one place on the platform the CSRF/POST convention in §2 does not
apply.

```ts
// BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts:10-26
const router = new Router({ prefix: '/check' })

router.get('/', async (ctx) => {
	ctx.body = ''
})

router.get('/verify-email/:email/:hash', routerVerifyEmail())
router.get('/verify-email-user/:email/:hash', routerVerifyEmailUser())
```

| Method | Path | Params | Tier | Answer | Effect |
|---|---|---|---|---|---|
| `GET` | `/check/` | none | anonymous | `200`, empty body | Liveness / mount check for the router itself |
| `GET` | `/check/verify-email/:email/:hash` | `email`, `hash` (path) | `ShopOwner` | redirect (koa-utils `createVerifyEmailFlow` pattern) | Confirms a `ShopOwner`'s email via `VERIFY_EMAIL_PATHS` bound to the `ShopOwner` model; disposes the registration after 5 wrong hashes or if the link is >3 days old |
| `GET` | `/check/verify-email-user/:email/:hash` | `email`, `hash` (path) | `User` | redirect (same pattern) | Confirms a `User`'s (customer's) email via `VERIFY_EMAIL_PATHS_USER` bound to the `User` model; same 5-attempt / 3-day guards |

Both verify-email routes are deliberately **two separate routes on two separate handlers**, not one route
branching on a lookup: "email plus hash says nothing about which collection minted them" — a shared path
would resolve to whichever flow matched first and report every link from the other tier as a bad hash,
silently ticking that tier's wrong-hash counter toward disposing a good registration
(`src/middleware/router/index.mts:18-24`). The customer link is also built on `APP_DOMAIN_USER` rather
than `APP_DOMAIN`, so nginx needs no path rewrite — the two differ in host as well as path.

⚠️ `verify-email` (ShopOwner) was **dead on arrival** before a local fix: koa-utils' own exported handler
is bound to its package's `UserBase` model (collection `user`), which no migration on this platform ever
created for that purpose — every request found nothing and silently redirected to `/x/email-check`,
correct hash or not. The route now imports a local module bound to `ShopOwner` instead
(`src/middleware/router/index.mts:2-7`). Confirm any future edit near this router targets the local
module, not the package export of the same name.

---

## 5. ShopOwner tier

### 5.1 `marketplace-dev-authenticated-authorization` — port 4029

Token lifecycle only — **no business queries live here**, per the authorization/resource split in §3.

| Op | Type | Args | Answer | Effect | Source |
|---|---|---|---|---|---|
| `refresh` | mutation | none (`{}`) | `RefreshType!` | Rotates the token pair for the caller's own session: mints new access+refresh tokens, stores both hashes, sets the refresh cookie, deletes the refresh token the call was made with, rolls both new keys back on any failure | `schema/mutations/refresh.mts:11-25` |
| `helloRefresh` | query | none observed | — | Smoke-test query | `schema/queries.mts:3` |

`refresh` calls into `marketplace-common`'s shared `refreshSessionTokens` — identical rotation logic
across all three `*-authenticated-authorization` services since the 2026-08-07 consolidation
(`docs/architecture.md` §Auth model; each service supplies only its own `TIER.*`, model and projection):

```ts
// BEs/dev/marketplace-dev-authenticated-authorization/src/graphQLApi/schema/mutations/refresh.mts:19-24
return refreshSessionTokens({
	store: redisClient,
	ctx,
	session: ctx.state.user,
	captureException: Sentry.captureException
})
```

Auth for `refresh` is the **refresh cookie**, not a bearer access token — this service validates the
signed cookie via Keygrip, not a Redis-hash bearer lookup (§2).

### 5.2 `marketplace-dev-authenticated-resource` — port 4026

Domain data for the ShopOwner tier: the owner's own companies, their items, the (read-only on this tier)
category tree, plus uploads.

**Queries:**

| Op | Args | Answer | Effect | Source |
|---|---|---|---|---|
| `shopOwnerCompanies` | none | `[GraphQLCompany!]!` | Companies owned by the authenticated caller (scoped via `ctx.state.user`, no explicit id arg) | `queries/shopOwnerCompanies.mts:18-19` |
| `companyItems` | `idCompany: ID!` | `[GraphQLItem!]!` | Items of one company — unlike the public tier, **not** filtered by `published`; the owner sees drafts too | `queries/companyItems.mts:21,27-32` |
| `itemCategories` | none | `[GraphQLItemCategory!]!` | Reads the item category tree; **read-only on this tier by design** — write path exists only on the Admin tier (`phase4/CONSTRAINTS.md` DCON-05) | `queries/itemCategories.mts:9,23-24` |

**Mutations:**

| Op | Args | Answer | Effect | Source |
|---|---|---|---|---|
| `companyAdd` | `company: GraphQLInputCompany!` | `OnlyIdType!` | Creates a company (shop) owned by the caller; answers the new `_id` — deliberate exception to the bare-`Boolean` default, see §2 | `mutations/companyAdd.mts:22,27-32` |
| `companyUpdate` | `_id: ID!`, `company: GraphQLInputCompany!` | `Boolean!` | Updates an owned company | `mutations/companyUpdate.mts:16-22` |
| `companyDel` | `_id: ID!` | `Boolean!` | Soft-deletes an owned company (`deleted` date stamp, never a hard remove — `phase4/CONSTRAINTS.md` DCON-03); answers **403** on an already-deleted company, because the ownership guard here filters `deleted` (Admin tier's equivalent does not and answers 200 — `docs/data-model.md`) | `mutations/companyDel.mts:20-25` |
| `itemAdd` | `item: GraphQLInputItem!` | `OnlyIdType!` | Creates a catalogue item; **also** answers the new `_id`, not `Boolean` — see the §2 correction | `mutations/itemAdd.mts:29,34-39` |
| `itemUpdate` | `_id: ID!`, `item: GraphQLInputItem!` | `Boolean!` | Updates an item | `mutations/itemUpdate.mts:27-33` |
| `itemDel` | `_id: ID!` | `Boolean!` | Soft-deletes an item (`deleted` date stamp) | `mutations/itemDel.mts:21-26` |

All six run through `IContextShopOwnerAuthenticatedResource` — the tier assertion described in §2 gates
every one of them; there is no per-operation auth check beyond it.

**Uploads.** `graphql-upload` is mounted as global Koa middleware in front of Apollo, 30 MB / file, 10
files max:

```ts
// BEs/dev/marketplace-dev-authenticated-resource/src/index.mts:132-133
app.use(graphqlUploadKoa({ maxFileSize: 30000000, maxFiles: 10 })) // 30MB limit, max 10 files
```

`sharp`, `clamscan` and `file-type` are dependencies of this service for the same reason (image
processing, malware scan, MIME sniffing on whatever the middleware receives — `package.json:42,44,49,56`).
⚠️ **No operation among the six mutations above declares a `GraphQLUpload` argument.** `itemAdd.mts`'s
own doc comment gestures at a follow-up step ("the flow continues with the item that was just created —
uploading its image, most obviously" — `itemAdd.mts:30`) but does not implement it inline, and no other
file under `mutations/` was found to reference `Upload` (`grep -rli upload src --include='*.mts'` returns
only `index.mts` and `itemAdd.mts`, the latter only in that comment). The middleware is wired and ready;
the mutation that accepts a file is not yet in the resolver set read this pass — carry this to Part 2's
open-questions section rather than inventing the shape of an image-upload mutation.

## 6. Admin tier

Transport, auth headers and error shape all follow §2. Tier value asserted: `admin`.

### 6.1 `marketplace-dev-admin-authenticated-authorization` — port 4025

Token lifecycle only, same shape as every `*-authenticated-authorization` service since the
`marketplace-common@1.0.0` consolidation (ADR-006 — bodies shared, deployables kept separate, one process
per tier so a crash in one tier does not take the others down).

| Op | Type | Args | Answer | Effect | Source |
|---|---|---|---|---|---|
| `refresh` | mutation | none (refresh token read from the signed cookie) | `RefreshType!` | Rotates the token pair for the caller's own `Admin` session, through the shared `refreshSessionTokens` | `schema/mutations/refresh.mts` |
| `helloRefresh` | query | none | — | Smoke-test query | `schema/queries/helloRefresh.mts` |

Root wiring: `BEs/dev/marketplace-dev-admin-authenticated-authorization/src/graphQLApi/schema/mutations.mts:3-9`,
`.../queries.mts:3-9`.

### 6.2 `marketplace-dev-admin-authenticated-resource` — port 4024

Domain data for the platform operator: shopOwner moderation, `company` CRUD on any shop owner's behalf,
and `itemCategory` CRUD. ⚠️ **This is the only tier that writes `itemCategory`.** The ShopOwner and public
tiers read the collection and never write it (`docs/data-model.md`). The two-level depth cap — a
category whose parent already has a parent is rejected — lives in the resolver, not the `$jsonSchema`
validator, because a schema validator cannot read a second document to check the parent's own parent
(ADR-012). The check is `throwIfParentNotTopLevel`, called from
`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts:24`,
gated on `data.idParent !== undefined` — an absent `idParent` is accepted unconditionally as a top-level
category and never reaches the check.

Queries (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/queries.mts:14-24`):

| Op | Args | Answer | Effect | Source |
|---|---|---|---|---|
| `infoAdminAfterLogin` | none — identity from the session | `GraphQLAdminInfoAfterLogin!` | Post-login bootstrap for the operator SPA | `schema/queries/infoAdminAfterLogin.mts:7` |
| `shopOwnersActiveTbl` | `offset: Int! = 0`, `limit: Int! = SHOP_OWNERS_TBL_DEFAULT_LIMIT`, `search: String`, `sortBy: ShopOwnersTblSortField! = REGISTERED_AT`, `sortDir: SortDirection! = DESC` | `GraphQLShopOwnersActiveTblPage!` | Paginated, searchable, sortable shopOwner table | `schema/queries/shopOwnersActiveTbl.mts:10,15-22` |
| `shopOwnersStats` | none | `Int!` | Aggregate shopOwner count | `schema/queries/shopOwnersStats.mts:6` |
| `shopOwnersPerPeriod` | `period: ShopOwnersPeriod! = ALL` | `GraphQLShopOwnersPerPeriod!` | Time-bucketed signup stats | `schema/queries/shopOwnersPerPeriod.mts:8,18-19` |
| `shopOwnerById` | `idShopOwner: ID!` | `GraphQLShopOwnerById!` | One shopOwner, any of them — no ownership filter on this tier | `schema/queries/shopOwnerById.mts:11,13-14` |
| `shopOwnerCompanies` | `idShopOwner: ID!` | `[GraphQLCompany!]!` | Companies owned by one shopOwner | `schema/queries/shopOwnerCompanies.mts:17,19-20` |
| `companyItems` | `idCompany: ID!` | `[GraphQLItem!]!` | Catalogue entries of one company | `schema/queries/companyItems.mts:19,21-22` |
| `itemCategories` | none | `[GraphQLItemCategory!]!` | Full two-level category tree | `schema/queries/itemCategories.mts:18` |

Mutations (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations.mts:3-18`).
**All sixteen answer `Boolean!`** — verified, not assumed: every file in `schema/mutations/` declares
`type: new GraphQLNonNull(GraphQLBoolean)`, this tier included `companyAdd`.

| Op | Args | Answer | Effect | Source |
|---|---|---|---|---|
| `adminUpdatePwd` | `passwordOld: String!`, `passwordNew: String!` | `Boolean!` | Operator changes their own password — id from the session, never from the client | `schema/mutations/adminUpdatePwd.mts:12,13-16` |
| `shopOwnerAdd` | `login: GraphQLInputLogin!`, `personalData: GraphQLInputShopOwnerPersonalData!` | `Boolean!` | Operator provisions a shop owner; input validated *and normalised* before the write | `schema/mutations/shopOwnerAdd.mts:17,18-21` |
| `shopOwnerUpdate` | `_id: ID!`, `personalData: GraphQLInputShopOwnerPersonalData!` | `Boolean!` | Replaces one shopOwner's registry data | `schema/mutations/shopOwnerUpdate.mts:14,15-18` |
| `shopOwnerUpdateEmail` | `_id: ID!`, `email: String!` | `Boolean!` | Changes the login email — the unique-index key | `schema/mutations/shopOwnerUpdateEmail.mts:20,21-24` |
| `shopOwnerUpdateNote` | `_id: ID!`, `notes: String!` | `Boolean!` | Operator-private annotation on a shop owner | `schema/mutations/shopOwnerUpdateNote.mts:24,25-28` |
| `shopOwnerUpdatePreferences` | `_id: ID!`, `rememberMe: Boolean!`, `onboardingDone: Boolean!`, `onboardingStep: String` | `Boolean!` | Sets session and onboarding preferences; `onboardingStep` is the one optional arg | `schema/mutations/shopOwnerUpdatePreferences.mts:25,26-31` |
| `shopOwnerUpdateStatus` | `_id: ID!`, `disabled: Boolean!`, `waitApprov: Boolean!` | `Boolean!` | The approval lever — `waitApprov` exists on `shopOwner` only, never on `user` | `schema/mutations/shopOwnerUpdateStatus.mts:25,28-30` |
| `shopOwnerDel` | `_id: ID!` | `Boolean!` | Soft-delete — stamps `deleted`, never removes the document | `schema/mutations/shopOwnerDel.mts:11,12-14` |
| `companyAdd` | `idShopOwner: ID!`, `company: GraphQLInputCompany!` | `Boolean!` | Registers a company **on another shop owner's behalf** — the `idShopOwner` arg is what the ShopOwner tier's own `companyAdd` cannot have | `schema/mutations/companyAdd.mts:23,26-27` |
| `companyUpdate` | `_id: ID!`, `company: GraphQLInputCompany!` | `Boolean!` | Replaces a company on any shop owner's behalf | `schema/mutations/companyUpdate.mts:26,27-30` |
| `companyDel` | `_id: ID!` | `Boolean!` | Soft-delete; answers 200 even on an already-retired company — see the note below | `schema/mutations/companyDel.mts:18,21` |
| `itemCategoryAdd` | `itemCategory: GraphQLInputItemCategory!` | `Boolean!` | **Admin-only write.** Depth cap enforced here by `throwIfParentNotTopLevel`, not by the validator | `schema/mutations/itemCategoryAdd.mts:23,26` |
| `itemCategoryUpdate` | `_id: ID!`, `itemCategory: GraphQLInputItemCategory!` | `Boolean!` | Admin-only write; same depth cap | `schema/mutations/itemCategoryUpdate.mts:26,27-30` |
| `itemCategoryDel` | `_id: ID!` | `Boolean!` | Admin-only write | `schema/mutations/itemCategoryDel.mts:18,19-21` |
| `itemUpdatePublished` | `_id: ID!`, `published: Boolean!` | `Boolean!` | Moderation lever — unpublish any shop's item regardless of owner | `schema/mutations/itemUpdatePublished.mts:21,24-25` |
| `itemDel` | `_id: ID!` | `Boolean!` | Soft-delete of any shop's item | `schema/mutations/itemDel.mts:17,18-20` |

⚠️ **`companyAdd` on this tier answers `Boolean!`, not the `OnlyIdType` the ShopOwner tier's `companyAdd`
answers.** Two different return shapes for the same-named mutation on two different tiers — do not unify
them, the divergence is deliberate (`docs/frontends.md` §marketplace-admin and marketplace-shopowner, "three things there are not
copies").

⚠️ **`companyDel` on this tier answers 200 on an already-retired company; the ShopOwner tier's `companyDel`
answers 403 for the same company.** The Admin guard does not filter `deleted`, `throwIfShopOwnerDontOwnCompany`
on the ShopOwner tier does. Liveness filtering belongs on read paths and ownership guards, never on the
delete write itself — both answers are correct for their tier (`docs/data-model.md`).

`itemUpdatePublished` is the moderation lever: an operator can unpublish any shop's item regardless of who
owns it, distinct from the ShopOwner tier's own `itemUpdate`/`itemDel` which are scoped to the caller's
companies.

## 7. User tier (the customer)

Transport, auth headers and error shape all follow §2. Tier value asserted: `user`. Identity only — see
`CLAUDE.md` §Build state: no cart, no order, no delivery, no payment collection exists on this tier or
anywhere else on the platform.

### 7.1 `marketplace-dev-user-authenticated-authorization` — port 4031

Same shared body as §6.1 (ADR-006), scoped to `TIER.user`.

| Op | Type | Args | Answer | Effect | Source |
|---|---|---|---|---|---|
| `refresh` | mutation | none (refresh token read from the signed cookie) | `RefreshType!` | Rotates the token pair for the caller's own `User` session, through the shared `refreshSessionTokens` | `schema/mutations/refresh.mts` |
| `helloRefresh` | query | none | — | Smoke-test query | `schema/queries/helloRefresh.mts` |

⚠️ This service carries 1 integration file where the other eight services carry 3-5 (`docs/testing.md` §Traps that make a green run lie) — a smaller test surface than its siblings, noted here because it is a contract-confidence gap,
not a missing operation.

### 7.2 `marketplace-dev-user-authenticated-resource` — port 4032

Account, personal data, addresses. One query, six mutations
(`BEs/dev/marketplace-dev-user-authenticated-resource/src/graphQLApi/schema/queries/me.mts`,
`.../mutations/`).

| Op | Type | Args | Answer | Effect | Source |
|---|---|---|---|---|---|
| `me` | query | none — identity from the session, no `_id` arg by design | `GraphQLUserMe` | Reads the caller's own account through a positive field list | `schema/queries/me.mts:1-20` |
| `userPersonalDataUpdate` | mutation | `personalData: GraphQLInputUserPersonalData!` | `Boolean!` | Fills in the optional `personalData` block after email confirmation | `schema/mutations/userPersonalDataUpdate.mts:24` |
| `userUpdatePwd` | mutation | `passwordOld: String!`, `passwordNew: String!` | `Boolean!` | Customer changes their own password | `schema/mutations/userUpdatePwd.mts:22-23` |
| `userAddressAdd` | mutation | `address: GraphQLInputUserAddress!` | `OnlyIdType` | Appends to `addresses[]`; answers the new element `_id` so the client can point `defaultAddress` at it | `schema/mutations/userAddressAdd.mts:29` |
| `userAddressUpdate` | mutation | `_id: ID!`, `address: GraphQLInputUserAddress!` | `Boolean!` | Replaces one owned address | `schema/mutations/userAddressUpdate.mts:28-29` |
| `userAddressDel` | mutation | `_id: ID!` | `Boolean!` | Removes an address **and** `$unset`s `defaultAddress` in the same write if it pointed there | `schema/mutations/userAddressDel.mts:31` |
| `userDefaultAddressSet` | mutation | `_id: ID!` | `Boolean!` | One atomic `$set` of the pointer — never a "clear all, then set one" two-step | `schema/mutations/userDefaultAddressSet.mts:31` |

`me` has no `_id` argument on purpose: a customer may read exactly one account, their own, taken from
`ctx.state.user._id` off the session, never from client input (`queries/me.mts:10-14`). The `select` behind
it is a positive field list — `login.password`, `resetPwd`, `emailVerify` are absent from it and so is
anything added to the collection later (`queries/me.mts:16-19`).

Every address mutation but `userAddressAdd` first runs `throwIfUserDontOwnAddress(ctx.state.user._id,
args._id)` (`mutations/userAddressUpdate.mts:32`, `mutations/userAddressDel.mts:34`,
`mutations/userDefaultAddressSet.mts:34`) — an address `_id` from the client is never trusted to belong to
the caller.

⚠️ **`funUserAddressDel` is the only pipeline update on the whole platform, and it is the reason.**
`BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:36-79` runs an
aggregation-pipeline `updateOne` (`{ updatePipeline: true }`, `funUserAddressDel.mts:79`) that both
`$filter`s the deleted address out of `addresses[]` (`funUserAddressDel.mts:51-58`) and, in the same write,
`$unset`s `defaultAddress` via `$$REMOVE` if it pointed at the address being deleted
(`funUserAddressDel.mts:66`) — this is what makes the "at most one default address" pointer invariant hold
without a second round trip (`docs/data-model.md` §`user`, ADR-010). Two Mongoose 9 traps sit behind that one
line and are already fixed here, not left as open questions: Mongoose refuses an array passed to a plain
`updateOne` unless `updatePipeline: true` is set, and Mongoose casts a query filter against the schema but
**not** the inside of a pipeline — `GraphQLID` resolves to a string, so the address id is coerced with
`new Types.ObjectId(addressId)` (`funUserAddressDel.mts:48`) before it ever enters the `$ne`/`$eq`
comparisons, or the comparison would silently never match.

## 8. Logout — all three tiers

`marketplace-dev-authenticated-logout`, port 4030. One service, every tier — `Admin`, `ShopOwner` and
`User` all point at it, and all three frontends' logout call targets port 4030
(`BEs/dev/marketplace-dev-authenticated-logout/src/graphQLApi/schema/mutations/logout.mts`).

| Op | Type | Args | Answer | Effect | Source |
|---|---|---|---|---|---|
| `logout` | mutation | none (tokens read from `ctx.state.user`, refresh cookie cleared) | `Boolean!` | Deletes both Redis session keys by token content, for whichever tier minted them | `schema/mutations/logout.mts:11-27` |
| `helloLogout` | query | none | — | Smoke-test query | `schema/queries/helloLogout.mts` |

The resolver deletes the Redis keys by token **content**, never by tier:
`redisClient.del(`${process.env.REDIS_KEY}${ctx.state.user.refreshToken}`)`
(`mutations/logout.mts:17`) and the matching access-token `del` (`mutations/logout.mts:23`) — it never asks
which collection (`admin` / `shopOwner` / `user`) minted the session, only that a live one exists at that
key. That is what lets one process serve every tier: tier-named logout mutations (`logoutAdmin`,
`logoutUser`, …) were evaluated and rejected — ADR-005
(`docs/devprotocol/phase3/adr/ADR-005-single-logout-service-all-tiers.md`).

## 9. Contract gaps and drift

- **No SDL anywhere.** None of the nine services builds a schema from a `.graphql` file — all nine build
  it programmatically from the resolver tree (`§2`). The `schema/*.graphql` slices under each frontend
  (`marketplace-admin`, `marketplace-shopowner`, `marketplace-user`) are hand-maintained copies and drift
  from the resolvers; re-check the actual resolver file, never the frontend slice, before adding or
  changing an operation (`docs/frontends.md` §marketplace-admin and marketplace-shopowner, "schema/*.graphql are hand-maintained slices, not
  the contract").
- **The stale `JWT` type describes nothing that exists.** It appears in those hand-maintained slices but
  every token on this platform is an opaque string validated against a Redis session, never decoded —
  `RefreshType`/access-token strings are the real shapes (§2, ADR-003 —
  `docs/devprotocol/phase3/adr/ADR-003-opaque-tokens-redis-sessions-not-jwt.md`).
- **HTTP contract extraction across this platform yields zero cross-links.** The nine services dispatch
  Apollo inline on `ctx.path === ENDPOINT` rather than through a router, and every frontend talks GraphQL
  over `fetch` — both are invisible to route-shaped extractors (`docs/gitnexus.md`, "HTTP contract
  extraction does not work on this platform"). Cross-service impact analysis on this platform is manual: no
  `route_map` or contract cross-link tool returns anything real here.
- **No versioning scheme, no deprecation policy, no cross-service contract test.** Every service versions
  independently by whatever is on `main` at deploy time, and no test on this platform spans two services —
  agreement between a producer and a consumer (a resolver's argument shape, a shared secret, a Redis key
  format) is enforced by nothing but manual review. `docs/workflow.md` §Environment files records one
  concrete cost of this: two of the user-tier services shipped mismatched `.env` values
  (`KEYGRIP_KEY_1`/`_2` between `marketplace-dev-public-authorization` and
  `marketplace-dev-user-authenticated-authorization`) for a period where both repos' own suites stayed
  green, because each one signs and verifies against itself.
- **Operations that do not exist and are not designed:** anything ordering-related — cart, order, delivery,
  payment. No collection, no resolver, no schema slice, no ADR. `item` deliberately carries no `price`
  field for the same reason (`docs/data-model.md`, ADR-009). Name this as a gap; this document does not
  design the shape of any of the four.
