# Error Handling Strategy
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.2
**Date:** 2026-08-28
**Author:** error-handling-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.1 - 2026-08-27: ADR-038 (2026-08-27) makes cart, order, delivery and payment permanently out of scope. §1 and §11 stop saying those tiers are merely unbuilt; §12 question 3 keeps its gap but loses its deadline — it had scheduled itself for "before those tiers are designed", and they are not being designed — and its owner cell moves from "whoever owns the ordering tier next" to the platform owner, because that person will never exist.
v1.2 - 2026-08-28: §3's lead ("never `extensions.code`") is superseded, not edited away — `throwRefreshRaceRetry` (`BEs/marketplace-common/src/others/throwRefreshRaceRetry.mts`) does set `extensions.code = REFRESH_RACE_RETRY_CODE`, matched on by all three SPAs to drive the grace-window signal's silent retry, and the annotation records the sharper point: it is thrown from Koa middleware registered before Apollo (`authenticatedAuthorizationHandler.mts`), so `tdwKoaErrorHandler` serialises `{message, description}` with no `errors[]`/`extensions` and the code never reaches the client on that path — a still-open defect, cross-referenced to `../../report/multi-tab-refresh-behaviour.md` §5 and §9 item 2. Layer 9's repetition of the absolute claim (~line 336) gets a short pointer to the same annotation rather than its own copy.

**Depends on:** `phase1/PDR.md` ✅ · `phase1/NFR.md` ✅ · `phase2/EVENT_STORMING.md` ✅ · `phase3/adr/ADR-INDEX.md` ✅ · `phase4/CONSTRAINTS.md` ✅
**Mutability:** low risk — additive. New error codes/layers don't break existing behaviour. Changing an existing status code or message pattern is breaking wherever a frontend branches on it — check `marketplace-user/src/api/errors.ts` and the equivalent files in the other two frontends first.

---

## 1. Purpose

Platform has no central error-handling module. No `try/catch` framework, no error-code registry file, no
middleware that maps exceptions to responses uniformly. What exists: one shared throw-helper library
(`@axiumine/koa-utils/graphQL/throw/*`), used consistently by all 9 backend services and by
`marketplace-common`'s auth helpers, plus a per-frontend translation layer that reads the HTTP status
Apollo Server puts in `extensions.http.status`. This doc names the taxonomy that library already encodes,
states which layer owns which failure class, and prescribes the two rules the codebase has already
violated once each in production (silent pipeline failure, wrong-environment secrets) so neither repeats.
No order/cart/delivery/payment error taxonomy exists here — those tiers are not built and never will be,
see `phase4/CONSTRAINTS.md` §6 and [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md).

---

## 2. Guiding principles

| Principle | Detail |
|---|---|
| One throw library, no ad-hoc `new Error()` in a resolver | Every user-facing failure goes through `throwGraphQLError(status, title, description)` (`@axiumine/koa-utils` `src/graphQL/throw/throwGraphQLError.mts`) or one of its named wrappers. A resolver that throws a bare `Error` loses the HTTP status mapping and the frontend reads it as a transport failure. |
| 401 is "prove who you are again"; 403 is "you proved it, wrong door" | `assertTier` answers 403, never 401 — caller authenticated correctly, just against the wrong tier's session. ADR-004. Never blur this distinction when adding a new guard. |
| Generic error for anything that could leak account existence | Deleted, disabled, wrong password, unconfirmed email, unknown email all answer the identical `throwUnauthorizedError()` envelope on a login path. Copy this pattern verbatim on any new auth resolver — do not special-case one branch with a more specific message. |
| A write that reports success must prove it changed something | `matchedCount`/`modifiedCount` (or driver equivalent) must be asserted before a mutation returns `true`. Absence of a thrown error is not proof of a write — `funUserAddressDel` shipped without this check and silently no-op'd. |
| Fail closed at boot, never degrade silently | `checkRequiredEnv` throws and the process never starts if a required var is empty or absent. No default, no partial-service mode. |
| Nothing secret ever reaches a GraphQL response body or a client-visible log line | `x-introspectioncode`, Keygrip keys, `MONGODB_URI`, stack traces, and whether a given email is registered are all on the never-emit list — see §7. |
| `additionalProperties: false` turns a bad write into a database-level rejection, not a silent drop | A write carrying an undeclared field is refused by the `$jsonSchema` validator and surfaces as a Mongo validation error (`[Validator]` prefix), translated to 400 — never accepted with the extra field dropped. DCON-02. |
| Never lower a coverage/mutation threshold to make an error path easier to skip testing | ADR-016. A hard-to-test failure branch gets a test, not a lowered gate. |

---

## 3. Error taxonomy

Backend layer numbers below are structural (detection point), not severity. All GraphQL errors on this
platform carry `extensions: { http: { status }, description }` — never `extensions.code`. Frontends read
`error.response.status` first, `extensions.http.status` as fallback (`marketplace-user/src/api/errors.ts:11-14`).

> ⚠️ **Superseded 2026-08-28.** One code exists after all: `REFRESH_RACE_RETRY_CODE = 'REFRESH_RACE_RETRY'`,
> set by `throwRefreshRaceRetry()` (`BEs/marketplace-common/src/others/throwRefreshRaceRetry.mts:26-33`) on
> the 409 `GraphQLError` it builds — `extensions: { http: { status: 409 }, code: REFRESH_RACE_RETRY_CODE,
> description: 'This refresh token was just rotated by another request. Retry with the current cookie.' }`
> — raised by `resolveAuthorizationSession`
> (`BEs/marketplace-common/src/others/resolveAuthorizationSession.mts:87`) when a refresh token was just
> consumed by another tab of the same client — the grace-window signal. All three SPAs'
> `isRefreshRaceRetry` (`src/api/errors.ts:87`, identical in `marketplace-admin`, `marketplace-shopowner`,
> `marketplace-user`) match on `error.graphQLErrors[0]?.extensions.code === REFRESH_RACE_RETRY_CODE` to
> drive a silent retry instead of a logout.
>
> **The claim above still holds for every path a resolver throws from — this one isn't that.**
> `resolveAuthorizationSession` is called from `authenticatedAuthorizationHandler.mts` (e.g.
> `BEs/dev/marketplace-dev-authenticated-authorization/src/lib/auth/authenticatedAuthorizationHandler.mts`,
> and its Admin/User siblings), which every `*-authenticated-authorization` service installs as **Koa
> middleware, before `apolloServerKoa`** in `src/index.mts`. The thrown `GraphQLError` therefore never
> reaches Apollo's formatter — it is caught by `@axiumine/koa-utils`' `tdwKoaErrorHandler`
> (`koa/tdwKoaErrorHandler.mjs`), which serialises only `{message, description}`: no `errors[]` array, no
> `extensions` at all. The code is real and correctly built, but on this exact path it never reaches the
> wire — `isRefreshRaceRetry` reads an empty `graphQLErrors[0]`, and the client falls through to
> `clearAccessToken()`/`onSessionLost()`, a logout where the grace-window design specifies a silent retry
> instead.
>
> **This is a live, still-open defect, not a fixed one** — measured and recorded in
> [`../../report/multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md) §5 (the
> exact 409 body observed on the wire) and §9 item 2 (putting `extensions.code` on the wire for the race
> reply, in all three tiers, ranked #2 of what the finding asks for).

### Layer 1 — Startup / configuration errors

Detected at process boot, before any HTTP listener exists. Always fatal — process exits, never starts
degraded. Owner: each service's `src/index.mts`.

```ts
export function checkRequiredEnv(env: NodeJS.ProcessEnv = process.env): void {
	for (const envVar of REQUIRED_ENV_VARS) {
		if (!env[envVar]) {
			const mex = `Missing required environment variable: ${envVar}`
			throw new Error(mex)
		}
	}
}
```
`BEs/dev/marketplace-dev-authenticated-resource/src/index.mts:57-65`

`if (!env[envVar])` fails an **empty string** identically to an absent key — the one class this code
catches; a wrong-but-present value (a copied-in value from an unrelated project) is invisible to it. This
is exactly what happened on 2026-08-07 in both `*-user-authenticated-*` services: `MONGODB_URI` pointed at
an unrelated database with no `authSource`, `INTROSPECTION_CODE` mismatched the other seven services, and
the cookie-signing keys mismatched the service that signs the cookie this one verifies — none of it
tripped `checkRequiredEnv`, because every var was non-empty. No test on this platform spans two services
(see platform [`docs/workflow.md`](../../workflow.md) §Environment files), so cross-repo value agreement is unenforced by construction; the fix
is a fingerprint sweep, not a stronger boot check.

⚠️ **The Keygrip third of that incident is the one case since closed, and it was closed by a stronger boot
check after all** (ADR-034; *The Keygrip pair leaves five `.env` files for one wrapped record in Redis*,
[`phase5/IDENTITY_ACCESS.md`](../phase5/IDENTITY_ACCESS.md) §4): the keys left the environment for a wrapped Redis record, so a
service holding the wrong `KEYGRIP_KEK` fails to unwrap and `process.exit(1)`s instead of running. That
generalises only where a value can be *proved* wrong at boot — `INTROSPECTION_CODE` and `MONGODB_URI`
still cannot be, and for them the paragraph above stands unchanged.

| Error | When detected | Message pattern | Action |
|---|---|---|---|
| Missing/empty required env var | `checkRequiredEnv()`, called synchronously at module load, outside `start()`'s try | `Missing required environment variable: <NAME>` — plain `Error`, thrown before any GraphQL envelope exists | Admin fixes the env file and restarts. No retry, no partial boot. |
| Mongo/Redis unreachable at boot | `MongoDBConnect` / `RedisConnect` inside `start()`'s try (`src/index.mts`) | driver-native connection error, caught, logged, process exits non-zero | Admin fixes connectivity and restarts. |

### Layer 2 — Authentication errors (401)

Caller did not prove identity, or the identity they proved is refused. Detected in the auth middleware
(`authorizationAuthenticatedResourceHandler.mts` and its 3-way ShopOwner/Admin/User siblings) or inside a
login resolver (`login`, `loginAdmin`, `loginUser`). Client action: **re-authenticate** — log in again, or
(for `498`) refresh the access token.

`checkUserAuthorizationDisDel` gates `deleted`/`disabled` in that order, on purpose:

```ts
export function checkUserAuthorizationDisDel(user: IAuthorizationDisDel) {
	const { disabled, deleted } = user
	if (deleted) {
		throw throwUnauthorizedError() // fixme: email 'Account deleted.'
	}
	if (disabled) {
		throw throwUnauthorizedError() // fixme email: 'Account suspended.'
	}
}
```
`BEs/marketplace-common/src/others/checkUserAuthorizationDisDel.mts:4-17`

The comments spell out the reason inline: an account-state message handed out before a password is
supplied tells an attacker the address exists at all. Checked only *after* the password compares — see
Layer 2's generic-error rule below.

| Error | When detected | Message pattern | Action |
|---|---|---|---|
| No `Authorization` header, no valid `x-introspectioncode` | `authorizationAuthenticatedResourceHandler.mts:28-37` | `throwPreconditionFailedNoAuthHeader()` → HTTP 412, title `Precondition Failed`, description `No authorization header.` | Client attaches a bearer token and retries. |
| Header present but not `Bearer access:...` | same file, `:42-44` | `throwAccessTokenRequired()` → HTTP 499, title `Token Required` | Client is malformed; not a normal runtime path. |
| Redis session absent/expired for the given access token | same file, `:46-62` | `throwAccessTokenExpiredOrDeleted()` → HTTP 498, title `Invalid Token` | **The one status that means "refresh and retry."** Frontend runs the refresh flow, not a re-login. |
| Wrong password, unknown email, deleted, or disabled account on any login resolver | `tryLoginUser.mts`, and `login`/`loginAdmin` siblings | `throwUnauthorizedError()` → HTTP 401, generic text | Client shows a generic "invalid credentials"; never told which branch fired. See §2's generic-error rule. |
| Customer login with `emailVerify.valid === false` | `tryLoginUser.mts:39-41` | identical `throwUnauthorizedError()`, no distinguishing text | Frontend offers `userVerifyEmailResend` **unconditionally** on every failed login, rather than being told this account specifically needs it. |

Generic-error discipline is a **security control, not an accident of code reuse**, and any new auth path
must copy it exactly:

```ts
if (user === null) {
	throw throwUnauthorizedError()
}
await checkUserAuthorization(user, password, user.login.password)
if (!user.emailVerify?.valid) {
	throw throwUnauthorizedError()
}
```
`BEs/dev/marketplace-dev-public-authorization/src/lib/db/login/tryLoginUser.mts:33-41`

Unknown email, wrong password, and unconfirmed email all reach the identical envelope. The file's own
comment states the rule this taxonomy prescribes: *"That generic error is the reason
`userVerifyEmailResend` exists on 4027. A customer who never confirmed cannot be told 'confirm your email'
here without telling everyone else who is registered."* A new login path (a fourth tier, a passwordless
flow, anything) that special-cases one of these branches with a more specific message reopens an
account-enumeration oracle this code closed on purpose.

### Layer 3 — Authorization / ownership errors (403)

Caller authenticated successfully but is not entitled to the resource or the tier. Two sub-cases, same
status, different detector.

**3a — Wrong tier (`assertTier`).** ADR-004, do not re-argue it here.

```ts
export function assertTier(actual: string | undefined, expected: Tier): void {
	if (actual !== expected) throw throwForbiddenError()
}
```
`BEs/marketplace-common/src/others/assertTier.mts:21-23`

`throwForbiddenError()` → HTTP 403, title `Forbidden`. Called from every resource service's auth
middleware, e.g. `assertTier(redData.tier, TIER.shopOwner)` in
`BEs/dev/marketplace-dev-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:60`.
A missing `tier` field (a session minted before the discriminator existed) is rejected by the same
`actual !== expected` branch — **not a wildcard, not a fallback-accept**. Rationale, load-bearing, do not
simplify: *the caller authenticated correctly, it simply authenticated somewhere else — a 401 tells the
client to refresh its way out of something a refresh cannot fix, since the token is valid, just for
another tier's Redis session.* `REDIS_KEY` stays one shared prefix across all nine services on purpose
(single logout service, ADR-005), so `assertTier` is the only thing standing between an Admin token and
the ShopOwner API — see ADR-004 and platform [`docs/architecture.md`](../../architecture.md) §Auth model.

**3b — Ownership guard.** A resource exists, caller is the right tier, but does not own the specific document.

```ts
export async function throwIfShopOwnerDontOwnCompany(shopOwnerId: Types.ObjectId, companyId: Types.ObjectId) {
	const found = await Company.countDocuments({
		_id: companyId,
		idShopOwner: shopOwnerId,
		deleted: trusted({ $exists: false })
	}).lean()
	if (found === 0) {
		throw throwForbiddenError()
	}
}
```
`BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts:17-27`

Same 403, same helper, different question. Note the `deleted` filter lives on this **existence/ownership
guard**, never on the delete write itself (DCON-03) — a retired company answers 403 on a second
`companyDel`, not a silent 200. The User-tier equivalent is
`BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/throwIfUserDontOwnAddress.mts`, guarding
the three address mutations against an id belonging to another customer.

| Error | When detected | Message pattern | Action |
|---|---|---|---|
| Session tier ≠ service's expected tier (incl. missing tier) | `assertTier`, every resource service's auth middleware | 403, `Forbidden` | Client must not retry with the same token — needs a session from the correct tier's login resolver. |
| Caller doesn't own the named document (`Company`, `Item` via `idCompany`, `User` address) | per-entity `throwIfXDontOwnY` guards | 403, `Forbidden` | Same id will never work for this caller; a UI bug, not a transient failure. |
| `itemCategory` write attempted outside Admin tier | resolver never exists in ShopOwner/User/public tiers | N/A — no mutation to call | Not a runtime error at all; the write path is absent by construction (DCON-05). |

### Layer 4 — Validation errors (400)

Malformed input, or a `$jsonSchema` rejection surfaced from Mongo. Two detectors: GraphQL's own arg-type
system (rejects before a resolver runs, standard Apollo 400) and `throwIfMongoErr` translating a database
validator failure.

```ts
export function throwIfMongoErr(e: IMongoDBError) {
	if (/* duplicate key */) { throw throwConflictError() }
	else if (e.message.startsWith('[Validator]')) {
		throw throwErrorWrongUserInput(e.message.replace('[Validator]', '').trim())
	}
}
```
`@axiumine/koa-utils` `src/lib/MongoDB/throwIfMongoErr.mts:7-15` (condensed)

`throwErrorWrongUserInput(message)` → HTTP 400, title `Bad Request`, description = the validator's own
text with the `[Validator]` prefix stripped. `$jsonSchema` + `additionalProperties: false` means an
undeclared field on a write is a 400 from the database, never a silently-dropped field (DCON-02). The
`itemCategory` depth-2 cap is a **resolver-level** 400/403-class rejection, not a schema one — it lives in
`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts`, because
`$jsonSchema` cannot read a second document to check "does my parent have a parent" (DCON-05).

| Error | When detected | Message pattern | Action |
|---|---|---|---|
| GraphQL arg fails its declared type (`GraphQLNonNull`, enum, etc.) | Apollo, before resolver runs | standard GraphQL validation error, 400 | Client fixes the request shape; not retryable as-is. |
| `$jsonSchema` validator rejection (bad shape, `additionalProperties`, string length) | `throwIfMongoErr`, any resolver that calls `.save()`/`.create()` | `throwErrorWrongUserInput()`, 400, validator's own text | Client fixes the field the description names. |
| `itemCategory` parent is itself a subcategory (depth > 2) | `funItemCategoryAdd.mts` / `funItemCategoryUpdate.mts`, resolver-level check | 400-class rejection, resolver-authored message | Client picks a top-level category as parent instead. |

### Layer 5 — Not-found errors (404)

| Error | When detected | Message pattern | Action |
|---|---|---|---|
| Referenced id resolves to nothing (e.g. `idCategory` missing on `itemAdd`) | per-resolver existence check, e.g. `throwIfItemCategoryMissing.mts` | `throwNotFoundError()` → HTTP 404, title from `ERR_OOPS`, default description `ERR_MISCONFIGURED` | Client corrects the id; a dangling reference is a client bug, not a transient condition. |

`@axiumine/koa-utils` `src/graphQL/throw/throwNotFoundError.mts:3-6`

### Layer 6 — Conflict errors (409)

Unique-index violation. Global uniques stay global — DCON-04 — so a soft-deleted document still occupies its
slot and a re-registration of the same `vatNumber`/`certifiedEmail`/`slug`/`login.email` answers 409, not
"reactivate the old one."

```ts
export const throwConflictError = (desc: string = 'You have already done this.') => {
	throw throwAlreadyTakenError(desc)
}
```
`@axiumine/koa-utils` `src/graphQL/throw/throwConflictError.mts:3-5`, which itself
calls `throwAlreadyTakenError` → HTTP 409, title `Conflict`.

| Error | When detected | Message pattern | Action |
|---|---|---|---|
| Duplicate key on `company.vatNumber`/`certifiedEmail`/`slug`, `shopOwner.login.email`, `user.login.email`, `item.{idCompany,slug}`, `itemCategory.slug` | `throwIfMongoErr`, driver `DuplicateKeyError` code | `throwConflictError()`, 409 | Client picks a different value; retrying the same input never succeeds — these 7 indexes have no `partialFilterExpression` (DCON-04). |

### Layer 7 — Infrastructure errors (500)

Anything `throwIfMongoErr` doesn't recognise, plus Redis/mail-provider failures. Reported to Sentry before
the generic 500 is thrown, so the admin sees it even though the client gets nothing specific.

```ts
export const throwMongoDBErrors = (e: IMongoDBError): never => {
	throwIfMongoErr(e)
	Sentry.captureException(e)
	throw throwInternalError()
}
```
`@axiumine/koa-utils` `src/lib/MongoDB/throwMongoErrors.mts:6-11`

`throwInternalError(desc)` → HTTP 500, title `Internal Server Error`, description
`Error reported to Dev Team.${desc}` — deliberately vague; never the driver's own message, which could
carry the connection string or a stack fragment.

| Error | When detected | Message pattern | Action |
|---|---|---|---|
| Any Mongo error not a duplicate-key or `[Validator]` | `throwMongoDBErrors`, wraps `throwIfMongoErr` | `throwInternalError()`, 500, `Error reported to Dev Team.` | Client shows a generic failure; admin investigates via Sentry, not via the response body. |
| Redis unreachable mid-request (session read/write) | ad hoc per call site — no single wrapper equivalent to `throwMongoDBErrors` exists for Redis on this platform | uncaught → Koa's default error handler → 500 | Same as above; this is a gap, see §8. |
| Mail provider (SocketLabs) failure on verify-email send | resolver-local catch, not audited in this pass | not verified — flag in §8 | — |

### Layer 8 — The silent-failure class: a write that reports success and changes nothing

Not a thrown error at all — the important entry in this taxonomy, because it is the one class that looks
identical to success. Two independent bugs stacked on the same call, both found the first time
`marketplace-dev-user-authenticated-resource`'s integration suite ran a real Mongo (2026-08-07;
`marketplace-dev-user-authenticated-resource/CLAUDE.md` §Tests). Neither is hypothetical — both shipped.

**8a — Loud version (Mongoose 9 refuses an array update).**
```
Cannot pass an array to query updates unless the 'updatePipeline' option is set.
```
Thrown by Mongoose's `Query` prototype **before the driver is reached** — every customer-tier address
delete answered 500 until this was fixed. DCON-07.

```ts
const ret = await User.updateOne(
	{ _id: _id, 'addresses._id': addressObjectId },
	[ /* pipeline stages */ ],
	{ updatePipeline: true }   // per-call, not mongoose.set() globally — DCON-07
).exec()
```
`BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:50-80`

**8b — Silent version (a `GraphQLID` string never equals an ObjectId inside a pipeline).** DCON-06.
Mongoose casts a query **filter** against the schema; it casts **nothing** inside an aggregation pipeline
stage — a pipeline is an opaque expression to it. `{ $ne: ['$$this._id', '<string>'] }` compares an
ObjectId to a string, is never equal, so `$filter` kept every array element. The write answered
`matchedCount: 1, modifiedCount: 0` — **a matched document that was not touched, and no exception at
all.** The filter half of the query matched (that half *is* cast), which is what made this look like a
write that had simply "not landed" rather than a bug.

```ts
// GraphQLID resolves to a string — coerce before it enters any pipeline stage
const addressObjectId = new Types.ObjectId(addressId)
```
`BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:48`

**The rule this proves, applying platform-wide:** a write that can report success without changing
anything must assert the driver's own change-count before returning success to the caller.

```ts
if (ret.modifiedCount !== 1) {
	throwInternalError()
}
```
`BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:84-86`

Absence of a thrown error is not proof a write happened. Any future aggregation-pipeline update
(`funUserAddressDel` is the only one on the platform today) must coerce every id crossing into the
pipeline with `new Types.ObjectId(...)` **and** check `modifiedCount`/`matchedCount` before answering
`true`. Unit tests that mock `User.updateOne` cannot catch either bug — a mock accepts an array happily
and returns whatever the test hands it; only an integration suite against real Mongo/Mongoose surfaces
this class (see platform [`docs/testing.md`](../../testing.md) §Traps that make a green run lie, "a vitest project with no matching files passes").

| Error (non-throwing) | When it would have gone unnoticed | Message pattern | Action |
|---|---|---|---|
| `matchedCount: 1, modifiedCount: 0` on an id-bearing pipeline update | any write whose filter matches but whose pipeline stage silently no-ops (uncoerced id, wrong admin) | none — this IS the bug: no message, `Boolean!` mutation answers `true` | Prescribed: assert the count, throw `throwInternalError()` if it disagrees with the intended cardinality. |

### Layer 9 — Frontend error surfacing

All three frontends run **urql**, not Apollo Client. `CombinedError` is the only shape a failed operation
produces; there is no client-side error-code registry because the backend never emits `extensions.code`
(see the platform-wide comment reproduced below).

> ⚠️ **See §3's 2026-08-28 annotation** — `REFRESH_RACE_RETRY_CODE` is the one exception, and `errors.ts:87`
> is a registry of exactly that one code. On the one path that emits it, the pre-Apollo throw currently
> strips it before it ever reaches this client — still open, see the cross-referenced report.

```ts
export const HTTP = {
	badRequest: 400, unauthorized: 401, forbidden: 403, preconditionFailed: 412,
	invalidToken: 498, tokenRequired: 499, internal: 500
} as const
const SESSION_GONE: readonly (number | undefined)[] =
	[HTTP.unauthorized, HTTP.preconditionFailed, HTTP.tokenRequired]
```
`marketplace-user/src/api/errors.ts:16-34`

`statusOf(error)` reads `error.response.status` first, `extensions.http.status` as fallback — the
response-level read survives a proxy that rewrote the status but left the body intact.
`isAuthExpired(error)` (== 498) is the **only** status that means "refresh and retry"; everything in
`SESSION_GONE` (401/412/499) means log in again — this mirrors the backend's 401-vs-403 split one layer
up. `messageOf(error)` prefers `extensions.description`, then the GraphQL error's own `message` (the
`title` argument of `throwGraphQLError` — "Forbidden", "Bad Request"), then a hardcoded generic string —
never the raw transport error, which on an SSR request can carry `ECONNREFUSED 127.0.0.1:4027`
(`marketplace-user/src/api/errors.ts:134-136`). `dataOf(result)` exists because a well-formed
`{"data": null}` (no error, successful-looking envelope) is not a `CombinedError` and a caller testing
only for one reports a success the server never sent (`marketplace-user/src/api/errors.ts:95-104`).
Sentry is the reporting sink for anything that reaches an error boundary or an unhandled rejection —
initialised in `marketplace-user/src/instrument.ts` and `marketplace-admin/src/instrument.ts` (one per
SPA/SSR entry, per platform `docs/frontends.md`).

⚠️ **CSRF failure mode presents as a broken query, not as an auth error (ADR-021).** Every service sets
`csrfPrevention: true`; `preferGetMethod` stays `false` platform-wide because urql sends none of Apollo's
preflight-forcing headers on a GET. At the default (`preferGetMethod: true`), a query short enough to fit
in a URL is sent as a GET and Apollo refuses it with a CSRF-prevention message — which reads to urql as an
ordinary `CombinedError` with no distinguishing status, indistinguishable from a genuine 400. This is why
`preferGetMethod: false` is load-bearing everywhere and must never be flipped per-service (ADR-021).

| Error | When detected | Message pattern | Action |
|---|---|---|---|
| Transport failure (DNS, offline, aborted) | `statusOf` returns `undefined` (no `error.response`, no GraphQL error) | `messageOf` falls through to the hardcoded `GENERIC` string | Client shows generic connectivity failure; SSR path never leaks the loopback address. |
| 498 (access token expired/deleted) | `isAuthExpired` | backend's own description | Client silently runs the refresh flow, then retries the original operation once. |
| 401/412/499 (`SESSION_GONE`) | `isSessionGone` | backend's own description or generic | Client clears local session state and routes to `/login`. |
| Well-formed `{"data": null}` with no `CombinedError` | `dataOf` | n/a — not an error | Caller must not treat this as success; form stays open, user input preserved. |
| CSRF-prevention rejection on an oversized GET | indistinguishable from any other `CombinedError` at the urql layer | ordinary GraphQL 400-class message | Prevented structurally by `preferGetMethod: false`, ADR-021 — not handled reactively. |

---

## 4. What must never reach a client error message

Enumerated because each of these has a real leak vector on this exact codebase, not a generic hygiene
reminder:

| Must never appear in a response body, log line visible to a client, or Sentry breadcrumb tagged user-facing | Where it would otherwise leak from |
|---|---|
| `x-introspectioncode` value | service-to-service bypass header, `authorizationAuthenticatedResourceHandler.mts:31` — must never be echoed, logged, or exposed to a browser client (platform [`docs/architecture.md`](../../architecture.md) §Auth model) |
| `KEYGRIP_KEK` | unwraps the Redis record holding the refresh-cookie signing keys; a leak yields those keys, and a forged session cookie for any tier (ADR-034) |
| Any Mongo connection string / `MONGODB_URI` | `throwMongoDBErrors` deliberately never forwards the driver's own error text for this reason — only `Error reported to Dev Team.` |
| A raw stack trace | `throwInternalError()`'s description is a fixed string; the real error goes to `Sentry.captureException(e)` only |
| Whether a given email address is registered | Layer 2's generic-error rule — every login failure branch answers the identical `throwUnauthorizedError()` |

---

## 5. Error propagation flow

```
Client (urql, 3 frontends)
    │  GraphQL request over fetch, Authorization: Bearer access:<token>
    ▼
Koa + Apollo Server (one of 9 services)
    │
    ├─▶ Auth middleware (authorizationAuthenticatedResourceHandler-shaped)
    │       no header / bad prefix ──▶ throwPreconditionFailedNoAuthHeader (412) / throwAccessTokenRequired (499)
    │       Redis session absent    ──▶ throwAccessTokenExpiredOrDeleted (498)
    │       assertTier mismatch     ──▶ throwForbiddenError (403)          [detection: Layer 3a]
    │       success → ctx.state.user set, next()
    │
    ├─▶ Resolver body
    │       ownership guard (throwIfXDontOwnY)      ──▶ throwForbiddenError (403)   [Layer 3b]
    │       existence guard (throwIfXMissing)       ──▶ throwNotFoundError (404)    [Layer 5]
    │       depth/business-rule guard (itemCategory) ──▶ resolver-authored 400      [Layer 4]
    │       Mongo .save()/.create()/.updateOne()
    │           duplicate key        ──▶ throwConflictError (409)                   [Layer 6]
    │           [Validator] message  ──▶ throwErrorWrongUserInput (400)             [Layer 4]
    │           anything else        ──▶ Sentry.captureException(e) then
    │                                     throwInternalError (500)                  [Layer 7]
    │           reports success      ──▶ MUST assert modifiedCount/matchedCount     [Layer 8]
    │                                     before returning true — else silent no-op
    │
    ▼
GraphQLError { message: title, extensions: { http: { status }, description } }
    │  Apollo Server maps extensions.http.status onto the real HTTP response status
    ▼
urql client (CombinedError)
    │  statusOf() reads error.response.status, falls back to extensions.http.status
    ▼
messageOf() / isAuthExpired() / isSessionGone()  →  UI decision:
    show message · refresh token and retry once (498 only) · route to /login (401/412/499) · Sentry.captureException
```

No step in this chain retries automatically except the frontend's 498-triggered refresh-and-retry-once,
and no step queues a failed write for later replay — see §6.

---

## 6. Failure report format

No structured incident/failure-report file exists on this platform (no `FAILURES.md`, no error-code
registry, no audit-log table). What functions as the closest thing is the narrative record kept in each
repo's [`CLAUDE.md`](../../../CLAUDE.md) and in `phase4/CONSTRAINTS.md`'s DCON entries — prose plus exact error text plus
file:line, written after the fact once a bug is understood. This document adopts that same shape for any
future entry, since introducing a separate machine-readable format now would create a second source of
truth nothing reads:

```
### <short title>

**Symptom:** <exact error text or exact wrong-success behaviour, quoted verbatim>
**Detected by:** <which suite/gate first surfaced it — unit mock, integration test, manual repro>
**Root cause:** <one paragraph>
**Fix:** <file:line of the fix>
**Class:** <which taxonomy layer this belongs to, 1-9 above, or "new">
```

Every worked example in §3 Layer 8 follows this shape informally. A new entry should be added to this
document (not a separate file) the next time a production-shape bug is found, so the taxonomy stays a
living record rather than a one-time snapshot.

---

## 7. Resume behaviour

**No systematic retry or resumability exists on this platform.** State this plainly rather than describe
a policy the code does not have:

- **No job queue, no outbox, no saga.** A failed mutation is a failed HTTP response; nothing re-attempts
  it server-side.
- **No idempotency keys.** A client that retries a mutation after a timeout (as opposed to a definite
  error response) can double-execute it. This is unmitigated for every mutation on the platform today.
- **Mongo transactions exist at exactly one call site** — `loginUser`'s `session.withTransaction(...)`
  (`BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginUser.mts:98-129`)
  wraps the session-mint + login-stats update so a partial failure leaves neither half committed. No other
  resolver reviewed in this pass uses a transaction; a multi-document write elsewhere is not atomic unless
  it is a single `updateOne` (as `funUserAddressDel`'s pipeline is, by virtue of touching one document).
- **The one client-side retry that exists is narrow and deliberate:** a 498 (`invalidToken`) triggers the
  frontend's refresh-token flow and a single retry of the original operation. Every other error status is
  terminal from the client's point of view — no automatic retry, no backoff, no circuit breaker anywhere
  in this codebase.
- **Boot failure has no resume path — it has a restart path.** `checkRequiredEnv` throwing means the
  admin fixes the environment and restarts the process; there is no degraded-start mode (§Layer 1).
- **Migrations are immutable and replayable, which is the platform's actual notion of "resume."** A
  failed migration run is fixed by a *new* migration, never by editing the failed one (ADR-014); this is
  the only place on the platform where "how do we recover" has a designed answer, and it is a
  `marketplace-db-setup` concern, not a request-time error-handling one.

Nothing above should be read as an oversight to silently fix in this document — it is the accurate
description of a system with no retry/idempotency layer built. Order/cart/payment is where idempotency keys
and a queue would first have become load-bearing — and that tier is permanently out of scope as of
2026-08-27 (ADR-038), so the trigger that would have forced this work does not exist. Nothing in scope
needs them, and nothing is going to enter scope that does (`phase4/CONSTRAINTS.md` §6).

---

## 8. What the system never does on error

- **Never swallows a mandatory write's failure.** Every `throwIfMongoErr` branch ends in a `throw`;
  `throwMongoDBErrors`'s fallthrough still throws (`throwInternalError()`) after reporting to Sentry —
  there is no branch that logs and continues.
- **Never returns `true`/success from a mutation without the underlying write having actually changed
  something it claims to have changed** — the rule Layer 8 exists to state, after `funUserAddressDel`
  violated it in production.
- **Never tells an unauthenticated caller which account-state check failed** (unknown email vs wrong
  password vs deleted vs disabled vs unconfirmed) — Layer 2's generic-error rule, no exceptions.
- **Never accepts a session token from the wrong tier**, and never treats a session with no `tier` field
  as trusted-by-default — `assertTier`'s `actual !== expected` has no wildcard branch (ADR-004).
- **Never puts a raw driver error, a stack trace, or a connection string in a response body** —
  `throwInternalError()`'s description is always the fixed string; the real error goes to Sentry only.
- **Never lowers a coverage or mutation threshold to avoid writing a test for an error path** (ADR-016,
  restated here because an error branch is exactly the kind of code a lowered threshold would let through
  untested).
- **Never edits an applied migration to "fix" a data-shape error** — a new migration is written instead
  (ADR-014); the applied one is immutable history.
- **Never mounts a REST error-handling path beyond the 3 `/check/*` endpoints** — every other failure on
  this platform is a `GraphQLError`, never a REST-style JSON error body (`phase4/CONSTRAINTS.md` §5).
- **Never introduces a `role`/`permissions` field on an error payload** — tier is which collection/service
  was hit, not a field a caller or an error object carries (DCON-09).

---

## 9. Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | No unified Redis-failure wrapper exists (equivalent of `throwMongoDBErrors` for Mongo) — a mid-request Redis outage falls through to Koa's default handler as an uncaught 500 with no Sentry capture confirmed at every call site. Worth a shared `throwIfRedisErr`? | backend leads | open |
| 2 | Mail-provider (SocketLabs) send failure on verify-email flows was not traced to a specific throw site in this pass — confirm it surfaces as a typed error rather than an unhandled promise rejection. | backend leads | open |
| 3 | No idempotency-key mechanism exists anywhere; a network-timeout retry on any mutation can double-execute it. ⚠️ **No commerce tier is coming to set a deadline for this** (ADR-038, 2026-08-27). The gap is real and stays open on its own merits — a double-executed `itemAdd` or `addressAdd` is a live defect today — but it is no longer waiting on commerce. | platform owner — the ordering tier that would have owned it is never being built (ADR-038) | open, on its own merits, no longer tracked against `phase4/CONSTRAINTS.md` §6 |
| 4 | `marketplace-shopowner` and `marketplace-admin`'s own `src/api/errors.ts`-equivalent files were not read in this pass — only `marketplace-user`'s was verified. Confirm the other two frontends share the identical `statusOf`/`messageOf`/`isSessionGone` shape rather than a drifted copy. | frontend leads | open |
| 5 | Whether `login`/`loginAdmin` (the two non-rate-limited login resolvers) preserve the same generic-error discipline as `loginUser` was not independently re-verified in this pass — [`docs/architecture.md`](../../architecture.md) §Auth model implies they share `checkUserAuthorizationDisDel` and should, but the resolver files themselves were not read. | backend leads | open |
