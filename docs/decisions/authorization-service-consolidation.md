# Consolidating the three `*-authenticated-authorization` services

**Status: decided and implemented — option (c).** Decided 2026-08-07 by the platform owner, after the
survey below; shipped the same day as `marketplace-common@4.4.0` plus one commit per service — see
*As implemented*. Options (a) and (b) are recorded here so nobody re-opens them from scratch; (a) is
blocked on grounds that have not changed.

## The question

The platform runs one logout service for all three tiers (`marketplace-dev-authenticated-logout`, port
4030), and three separate authorization services:

|Service|Port|Tier|
|---|---|---|
|`marketplace-dev-authenticated-authorization`|4029|`ShopOwner`|
|`marketplace-dev-admin-authenticated-authorization`|4025|`Admin`|
|`marketplace-dev-user-authenticated-authorization`|4031|`User`|

Can the three collapse into one the way logout already has, and — the specific worry that prompted the
question — how would a single `authenticatedAuthorizationHandler()` know whether the caller is the admin
site, the customer site, or the shop-owner site?

## The discriminator already exists

It does not have to be invented. Since 2026-08-05 every Redis session hash carries a `tier`
(`admin` | `shopOwner` | `user`), written at login and copied into the refresh hash unchanged. It is
server-minted, it lives in a hash keyed by an opaque `uuidv4()` token the client never sees the inside
of, and it cannot be forged from the browser. `assertTier(actual, expected)` compares it and throws 403
on mismatch; a *missing* tier is treated as invalid, not as a wildcard.

So the answer to "how would the handler know" is `redData.tier`. The question is not whether the
information is available — it is whether *dispatching* on it is the right shape, and that is where the
survey said no.

## Why logout can be one service and authorization cannot, trivially

The doctrine in `CLAUDE.md` draws the line at one property: the logout resolver "deletes the Redis keys
by token *content* and never asks which collection minted them". Its `start()` connects Redis and
nothing else — there is no Mongo connection in that repo at all. Tier-blindness is not a convenience
there, it is the entire reason one service can serve three tiers.

Authorization cannot be tier-blind. Minting a fresh access token means re-reading the user document
from a **tier-specific MongoDB collection** (`shopOwner`, `admin`, `user`) to re-check `deleted` /
`disabled` and, for `ShopOwner`, to recompute `onboardingStep`. The collection has to be chosen. The
only question is *what chooses it*.

## How little actually differs

The three services differ in exactly three places:

|Place|`ShopOwner`|`Admin`|`User`|
|---|---|---|---|
|`assertTier` constant|`TIER.shopOwner`|`TIER.admin`|`TIER.user`|
|reader|`tokenInfoShopOwner`|`tokenInfoAdmin`|`tokenInfoUser`|
|extra payload|`onboardingStep`|—|—|

Everything else is duplication. `src/graphQLApi/schema/mutations/refresh.mts` is byte-identical across
the three apart from an imported interface name; `index.mts`, `queries.mts`, `mutations.mts`,
`RefreshType.mts`, `Hello2Type.mts`, `helloRefresh.mts` and `disconnectAllDatabases.mts` likewise. The
three `tokenInfo*.mts` are the same `findById` + projection + `throwUnauthorizedError()` +
`checkUserAuthorizationDisDel()` shape with different models and projections.

That duplication is real and worth removing. It is not, by itself, an argument for removing two
deployables.

## Options

### (a) One service, one path, dispatch on `redData.tier`

One endpoint. The handler reads the session, looks the tier up in a `TIER_STRATEGY` map, and calls
whichever reader that entry names.

**Pros** — maximum deduplication; one deployable, one port, one systemd unit; exactly mirrors the
logout topology; a fifth tier is one map entry.

**Cons — this option is blocked. Two independent blockers:**

1. **Doctrine.** `TIER_STRATEGY[redData.tier]` is textually the pattern `CLAUDE.md` names and rejects:
   *"A fifth role means a fifth collection and a fifth service pair, **not a role check bolted onto the
   existing ones**."* It also breaks the "each role has its own service pair" invariant — authorization
   would merge 3→1 while resource stays 1:3. And it thins the 2026-08-05 `REDIS_KEY` fix: that fix's
   safety currently exists as six independent, hardcoded, separately mutation-tested `assertTier` call
   sites, where a bug in one cannot corrupt the others. One dispatcher replaces six independent
   implementations with one — a wrong key, a swapped strategy or an exhaustiveness gap would then risk
   every tier at once, which is precisely the failure mode the hardcoded-constant design was chosen to
   prevent. The one recorded precedent points the same way: tier-named logout mutations were
   *evaluated and rejected* specifically to keep logout dispatch-free.
2. **Operability.** `index.mts` calls `process.exit(1)` on any uncaught exception, so one process is one
   crash domain for all three tiers. The Admin branch is the least-tested of the three — foreign-tier
   403 unit tests exist **only** in the user-tier repo; the ShopOwner and Admin repos never exercise an
   `assertTier` mismatch at all — so the most likely branch to carry a latent fault is the one that
   would take customer refresh down with it.

### (b) One service, three endpoint paths

One process, one repo, one port, but three mounted paths. The path supplies the *expected* tier, the
session supplies the *actual* one, and `assertTier` still compares two independently-sourced values:

```ts
const TIER_BY_ENDPOINT: Record<string, Tier> = {
	'/authenticated-authorization': TIER.shopOwner,
	'/admin-authenticated-authorization': TIER.admin,
	'/user-authenticated-authorization': TIER.user
}
```

**Pros** — removes the same duplication as (a); keeps the two-source comparison, so the security
property of `assertTier` survives intact rather than degenerating into "trust the session"; preserves
nginx's per-path `mkt_auth` rate-limit zones (`marketplace-user.conf:133-136`), which matter because
admin traffic is low-volume and trusted while customer traffic is internet-exposed; doctrine-compliant,
since nothing dispatches on a role read out of the session.

**Cons** — the crash-domain coupling from blocker 2 remains in full: one `process.exit(1)`, three tiers
down. Deploying a ShopOwner-only change redeploys Admin and User. Three ports become one, so the
per-tier blast radius of a bad release disappears. Medium migration cost: `env` and `MONGO_TEST_*`
reconciliation across three repos, three frontend config commits, nginx location blocks,
`services-status` entries and systemd units, GitNexus group membership, and two repos retired.

### (c) Three services, shared code moved into `marketplace-common` — **CHOSEN**

Topology unchanged: three repos, three ports, three deployables, three crash domains. The duplicated
handler skeleton, the refresh mutation and the `tokenInfo` shape move into `marketplace-common`,
parameterised by the tier constant and the reader. Each service keeps its own thin entry point that
names its own tier.

**Pros** — the duplication that motivated the question is removed; every security property is untouched,
because each service still hardcodes its own tier constant and the six independent `assertTier` sites
survive; zero operational risk, since no port moves, no nginx config changes, no frontend changes and no
repo is retired; fully doctrine-compliant; a fifth tier still costs a new collection + a new service
pair, exactly as documented, and now with less to copy. It is the only option on this list with no
blockers and no mitigations attached.

**Cons** — deduplication is moderate rather than maximal: three deployables, three systemd units and
three ports remain, so the ops surface does not shrink at all, and "one BE like logout" is not achieved.
`marketplace-common` grows a Koa/GraphQL-shaped surface it did not have before, which widens what a
breaking change there can hit — the library is consumed by all nine services, so an edit to the shared
handler is deployed to all nine even though only three use it. Every edit needs `./deploy-local.sh`
before the consumers see it, and a common bump is a separate commit in each consuming repo.

### (d) Do nothing

**Pros** — zero risk, zero work.

**Cons** — the duplication stays and drifts; the survey already found it drifting. The user-tier repo
sits on `marketplace-common ^4.3.0` / `koa-utils ^5.8.0` while the other two are on `^4.0.0` / `^5.7.0`;
`qodana.yaml` `dependencyOverrides` is stale at `1.16.14` in the ShopOwner and Admin repos and correct at
`4.3.0` in the user one; the Admin repo's `stryker.config.mjs` additionally excludes `instrument.mts`, so
it mutation-gates less code than its siblings; the user repo has 1 integration file against 3 in the
others and 9 unit files against 12. Three copies of one design already disagree in four ways.

## Decision

**(c).** Minimizing risk was ranked above reducing the deployable count. The duplication is a
maintenance cost; the crash-domain coupling in (a) and (b) is an availability cost paid by customers,
and only (c) removes the first without buying the second.

Recorded so it is not re-litigated: (b) remains a legitimate design and could be revisited if the ops
cost of three deployables ever becomes the binding constraint. (a) does not — it would need the doctrine
in `CLAUDE.md` changed first, which is a separate decision.

## What (c) does not change

- Three ports (4025 / 4029 / 4031), three repos, three systemd units, three `services-status` entries.
- No frontend change of any kind. Endpoint constants, the vite proxies, `authExchange`, the `Refresh`
  document and the `ssr: false` boundary all stay as they are.
- No nginx change. The per-path `mkt_auth` zones keep their current meaning.
- The `x-introspectioncode` branch keeps its current behaviour: `ctx.state.user` is never set on that
  path in any of the three services, and `refresh.mts` already throws there.
- Cookies. All three tiers already share one cookie name — `setLoginCookies` (koa-utils) sets
  `refresh_token` with identical options for every tier, minted by the one already-shared
  public-authorization service on 4028. This was true before the question was asked and is unaffected by
  the answer. Worth knowing separately: because that cookie carries no `domain` and its `path` is dead,
  two tiers served from the same hostname would overwrite each other's refresh cookie today.

## As implemented (2026-08-07)

Shipped as `marketplace-common@4.4.0` plus one commit in each of the three services. Three helpers under
`src/others/`, one interface under `src/models/MongoDBInterfaces/`:

|Helper|Replaces|Kept per service|
|---|---|---|
|`resolveAuthorizationSession`|the `hGetAll` → `assertTier` → read → build-session body of each `*AuthorizationHandler`|the Koa middleware wrapper, the `TIER.*` constant, the `readSessionData` callback|
|`findAccountForSession`|`tokenInfoShopOwner` / `tokenInfoAdmin` / `tokenInfoUser`|the model and the projection|
|`refreshSessionTokens`|the whole body of `refresh.mts`|nothing — the resolver is four arguments now|
|`IAdminEmail`|the inline `interface IAdminEmail` in `tokenInfoAdmin.mts`|—|

Line counts: `authenticatedAuthorizationHandler.mts` 93 → 57, `refresh.mts` 94 → 26, each `tokenInfo*.mts`
down to a single `return findAccountForSession(...)`. Three hand-written local session interfaces
(`IRedisData*ForNode`-shaped) were deleted in favour of `TAuthorizationSession<TAccountData>`, which is now
the declared type of `ctx.state.user` in all three — so the context type and the helper's return type
cannot drift.

Every security property named above survives verbatim: each service still hardcodes its own `TIER.*`, the
tier is still asserted before the `_id` is looked up, a missing tier is still refused, and the
introspection bypass still requires a signature-verified cookie first. `resolveAuthorizationSession`
returns `null` on that bypass rather than a stub session, which is what keeps `ctx.state.user` unset.

Two things the survey did not predict:

- **`Model<T>` is invariant in `T`**, so a single generic reader typed against it takes none of the three
  document types without a cast per call site. `findAccountForSession` therefore declares a structural
  `ISessionAccountModel<TAccount>` with `findById(...): { lean(): PromiseLike<TAccount | null> }` —
  `PromiseLike` because mongoose returns a `Query`, a thenable with no `[Symbol.toStringTag]`.
- **Moving code into a package moves it out of vitest's mock registry.** `vi.mock('@axiumine/koa-utils/lib/tokens')`
  stops intercepting once the import that needs faking happens inside `marketplace-common`'s dist rather than
  the service's `src/`, and it fails as a Stryker *dry-run* failure with no mutant in sight. Both packages had
  to be added to `inlineDeps` in each `vitest.mutation.config.mts`; `vitest.config.mts` already had them, and
  the two had drifted despite a comment saying to keep them in sync.

No service test file needed editing — all 73 / 42 / 56 existing unit tests passed unchanged against the
delegating implementations, which is the strongest available evidence that the extraction is behaviour-preserving.

Gates, all run locally:

|Repo|lint|coverage|mutation|Qodana|
|---|---|---|---|---|
|`marketplace-common`|green|100% — unit 140, contract 97, integration 12, types 27|100.00, 309 mutants, 0 survived|—|
|`marketplace-dev-authenticated-authorization`|green|100% (94/18/27/89), 11 files / 73 tests|100.00, 47 killed|0 problems, `40lBb/xDoVXD`|
|`marketplace-dev-admin-authenticated-authorization`|green|100% (90/16/27/86), 42 tests|100.00, 39 killed|0 problems, `Ggo4Y/r7Dm9X`|
|`marketplace-dev-user-authenticated-authorization`|green|100% (90/16/27/86), 8 files / 71 tests|100.00, 44 killed|0 problems, `B5NEV/eaGe4D`|

⚠️ **That last row was `unit only` when this document was written, and the reason turned out not to be a
missing decision.** The full `yarn test:cov` aborted in the integration project's `globalSetup` because five
`MONGO_TEST_*` keys were empty in that machine's environment file, and the note here said filling them in
meant provisioning two database users and was the user's call. The user authorised it, and doing so exposed
what had actually happened: **both user-tier services' environment files were copies of an unrelated older
project's**, so three further keys were not missing but *wrong* — `MONGODB_URI` pointed at a database called
`testRnApollo` with no `authSource`, `INTROSPECTION_CODE` did not match the seven other services', and
`KEYGRIP_KEY_1` / `KEYGRIP_KEY_2` did not match `marketplace-dev-public-authorization`'s.

That last one was a live defect the extraction had no part in and no test could have caught: `loginUser`
signs the customer's refresh cookie on 4028 and this service verifies the signature, so with a different
Keygrip every customer refresh returns 401 — and each service signs and verifies with *itself* in its own
suite, so both suites are green either way. Aligning all eight keys took the run to 8 files / 71 tests, all
four coverage metrics at 100% and a 100.00 mutation score, and the integration project executed its 15 tests
for the first time. One of them had never run and was wrong: it asserted 401 for a session minted by another
tier, where `assertTier` answers **403** by design — the caller authenticated correctly, it simply
authenticated somewhere else, and 401 would tell it to refresh its way out of the very call that *is* the
refresh. The unit suite had asserted 403 for the same scenario all along.

Two things follow for anyone reading this later. **A `--no-verify` commit is a debt with no ledger** — the
gate that would have caught the Keygrip mismatch existed, was configured, and was skipped for a reason that
sounded procedural. And **an environment file copied from another project fails where nothing is looking**:
every one of these values is read at runtime by a service that has no test asserting it matches its
counterpart in a *different* repo, because no suite here spans two services.

### The same fix unblocked the resource service, which was worse off and paid for it immediately

`marketplace-dev-user-authenticated-resource` — not one of the three this decision is about, but the other
half of the customer tier — was in the same state for the same reason, and further along it: its
`integration` project had a `globalSetup.mts` and **zero `*.itest.mts`**, so it collected nothing and
reported success rather than aborting. 100% coverage and a 100 mutation score, over a suite that never
touched a database.

Five files and 60 tests were written on 2026-08-07, and their first run found **two production bugs in one
function** — every address delete on the customer tier answered 500. `funUserAddressDel` has to be an
aggregation-pipeline update, because the collection validator's `$expr` half refuses a document whose
`defaultAddress` names nothing, so the element and the pointer must go in a single write. Both bugs are
specific to that shape:

- **Mongoose 9 refuses an array update** unless `{ updatePipeline: true }` is passed —
  `Cannot pass an array to query updates unless the 'updatePipeline' option is set.`, thrown in `Query`
  before the driver is reached.
- **Mongoose casts a query filter against the schema and casts nothing inside a pipeline.** `GraphQLID`
  resolves to a string, so `{ $ne: ['$$this._id', '68b1…'] }` compared an ObjectId to a string, matched the
  document and modified nothing — `matchedCount: 1, modifiedCount: 0`.

Neither was reachable from the unit suite, which mocks `User.updateOne`; a mock accepts an array and a
string without an opinion. This is the concrete answer to "what is an integration suite for" on this
platform, and it is the same lesson as the Keygrip mismatch one paragraph up: **the gaps here are all in
the places where nothing local has an opinion** — another repo's environment file, or a real database's
validator. That repo now runs 16 files / 309 tests, 100% on all four metrics, 100.00 mutation.

While the three were open, the dependency skew from option (d) was closed in the same commits:
`@thedoctorweb_agency/marketplace-common` is `^4.4.0` and `@axiumine/koa-utils` is `^5.9.0` in all three, and
each `qodana.yaml` `dependencyOverrides` entry was bumped to `4.4.0` alongside — that key is an exact match,
not a range, so a stale entry silently stops applying. The bump to `^4.4.0` is not cosmetic: the new imports
do not exist in `4.0.0` or `4.3.0`. ⚠️ **The three `yarn.lock` files remain stale for that package** — all
three pin `@thedoctorweb_agency/marketplace-common@^1.21.0` → `1.21.0` from registry.npmjs.org, a range no
`package.json` here has declared for a long time. They were already stale before this work and a `yarn install`
resolves against the registry rather than the lock, which is why `./deploy-local.sh` is what actually makes an
edit visible. Regenerating them needs the package published first.

## Follow-ups the survey surfaced, independent of this decision

- ~~Promote `tokenInfoAdmin`'s ad-hoc inline `interface IAdminEmail` to a shared type.~~ **Done** —
  `src/models/MongoDBInterfaces/IAdminEmail.mts` in `marketplace-common@4.4.0`.
- ~~Resolve the dependency skew listed under option (d).~~ **Done** for the two runtime ranges and the
  `qodana.yaml` override; the stale `yarn.lock` entries remain and need the package published first.
- Add foreign-tier 403 unit tests to the ShopOwner and Admin repos. Only the user repo has them. **Partly
  overtaken**: the mismatch branch itself now lives in `marketplace-common` and is tested there, at 100%
  coverage and a 100 mutation score, so it can no longer be wrong in one service and right in the other two.
  What the two repos still lack is the *wire* test the user repo has — a signed refresh carrying a foreign
  tier driven through the real server, asserting the 403 **and** that the tier-specific model was never
  queried. That is what pins the ordering of the two steps, which no unit test of either piece can.
- The admin-authorization upstream is **absent** from `marketplace-user/docs/nginx/`. Either it lives on
  a vhost outside this workspace or it was never written; confirm which.

## Not verified

The survey could not establish: whether MongoDB collection-level RBAC exists beneath the shared
application connection; the real `.env` values (deliberately not read); whether an admin-facing nginx
vhost exists outside this workspace; actual per-tier traffic volumes; whether Sentry alert routing could
be re-split by a `tier` tag if the services were ever merged.
