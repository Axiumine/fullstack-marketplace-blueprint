# Identity & Access
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.17
**Date:** 2026-08-28
**Author:** records-agent
**Bounded context:** BC-01 — Identity & Access

## 1. Goal

Authenticate a caller against exactly one of three collections (`admin`, `shopOwner`, `user`) and
mint/rotate/validate the opaque token pair that proves it for the rest of a session. One instance of this
responsibility per tier — never a single service branching on a role. `role` field/enum does not exist and
must not be added; tier = which collection you authenticate against.

## 2. Scope

| Item | In/Out | Why |
|---|---|---|
| `login` / `loginAdmin` / `loginUser` mutations | In | BC-01 owns first login for all three tiers (`docs/devprotocol/phase2/BOUNDED_CONTEXT.md` BC-01 Owns) |
| `refresh` (3 `*-authenticated-authorization` services) | In | token lifecycle, BC-01 owns |
| `TIER` constant + `assertTier` guard | In | shared kernel piece BC-01 owns |
| bcrypt password hashing, cost 14 | In | credential check BC-01 owns |
| Email verification (`GET /check/verify-email*`) | In | BC-01 Produces "Verification Email Sent, Email Verified" |
| `logout` mutation | Out | BC-02, separate context on purpose — deletes by token content, no tier read |
| `waitApprov`, `notes`, onboarding field **writes** | Out | BC-03 writes them, and "The two admin-only `shopOwner` fields are refused by construction"'s lint keeps it that way. The `waitApprov` **read** is In, and is what "A shop owner awaiting approval cannot hold a session" builds: `login` projects it and refuses on it, `refresh` re-checks it on every rotation. `notes` stays out in every shape — no BC-01 service has a reason to load an admin's private note about the person logging in |
| `personalData` / `addresses` on `user` | Out | BC-07 Customer Account & Addresses |
| any order/cart/delivery/payment auth | Out, permanently | not built platform-wide and never will be — [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md), 2026-08-27 (`CLAUDE.md` §Build state) |

## 3. Build state

Fully built. Three login mutations, three `refresh` services, shared `assertTier`/`TIER`, bcrypt hashing,
email-verification REST endpoints all exist on disk:

- `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/login.mts`
- `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginAdmin.mts`
- `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginUser.mts`
- `BEs/dev/marketplace-dev-authenticated-authorization/src/graphQLApi/schema/mutations/refresh.mts`
- `BEs/dev/marketplace-dev-admin-authenticated-authorization` (own `refresh.mts`, same shared body)
- `BEs/dev/marketplace-dev-user-authenticated-authorization` (own `refresh.mts`, same shared body)
- `BEs/marketplace-common/src/others/Tier.mts`, `BEs/marketplace-common/src/others/assertTier.mts`
- `BEs/marketplace-common/src/others/resolveAuthorizationSession.mts` (shared by the three tiers)
- `BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts` (the two verify-email REST routes)

Nothing here is designed-but-unbuilt. The gaps this record once listed as process gaps — cross-repo secret
agreement with no automated check — are closed by the four stories in §4 that took the Keygrip signing key
from `.env` files into a rotatable Redis record; what survives of them is provisioning, and that is
**R50**, not a story.

### 3.1 Changing a login email — what exists, and what does not

Making a login-email write revoke every session that account holds (2026-08-13) required reading the whole
flow. Four facts came out of that read, and they belong here because the login email is BC-01's identity,
whoever writes it.

- **There is exactly one writer**, `shopOwnerUpdateEmail` on the Admin tier — an admin changing a shop
  owner's login address. No self-service email change exists on any of the three tiers.
- ⚠️ **There is no confirm-a-change flow, and the field that looks like one is dead.** `shopOwner` carries
  `newEmailTmp`, which reads as the pending half of a confirm-first design; **nothing writes it and nothing
  reads it**. Do not build against it assuming the other half exists somewhere.
- ⚠️ **The new address is live immediately, and `emailVerify.valid` is not touched.** The account
  authenticates against the new address on the next login while the platform still records the address as
  verified — so an admin typo moves the account to an address nobody has proved anyone controls *and*,
  since that write started revoking sessions, ends every session the real owner was holding. The owner is locked out of an account that
  now answers to a stranger's inbox. This is the finding, not a hypothetical: it is what the code does
  today.
- **The answer is recorded for whoever builds the flow, so it is not re-derived**: revoke at the
  **confirmation**, not at the request. Revoking when the change is merely requested would let anyone who
  can reach the mutation sign the owner out without ever proving control of the new address, which is a
  denial-of-service with an email field for a trigger. The revoke stays where it is either way — it
  fires on the write that actually changes `login.email`, and in a confirm-first design that write *is* the
  confirmation.

Whether that flow is wanted at all is an open product question — §6 question 5.

## 4. Stories

### ShopOwner login mints tier-stamped session   `built`
**As a** ShopOwner, **when** I submit valid `email`/`password` to `login`, **I want** a token pair minted
and my Redis session tagged `tier: TIER.shopOwner` **so that** only ShopOwner-tier resource services ever
accept it.
**domains:** backend, database
**Acceptance criteria:**
- `login` mutation answers `LoginAppType!` (`accessToken`, `onboardingStep`, `onboardingDone`) on valid
  credentials — `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/login.mts:21-27`
- The Redis session hash minted for the returned `accessToken` carries `tier: TIER.shopOwner`, checked by
  `assertTier(actual, expected)` at every downstream resource-service call — `BEs/marketplace-common/src/others/assertTier.mts:21-23`
**Traces:** NFR-SE01, NFR-SE02, NFR-SE05; ADR-003, ADR-004
**Evidence:** `mutations/login.mts:21-27`

### Admin login, no onboarding flow to skip   `built`
**As an** Admin, **when** I log in with `loginAdmin`, **I want** `onboardingDone` returned already `true`
**so that** the admin SPA never renders an onboarding step that does not exist for this tier.
**domains:** backend, database
**Acceptance criteria:**
- `loginAdmin` hardcodes `onboardingDone: true` in its response, never reading a stored value —
  `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginAdmin.mts:20-25,87`
- Session stamped `tier: TIER.admin`, same file
**Traces:** NFR-SE01, NFR-SE05; ADR-003, ADR-004
**Evidence:** `mutations/loginAdmin.mts:20-25,87`

### Customer login refuses unverified email with a generic error   `built`
**As a** User (customer), **when** I submit correct credentials but `emailVerify.valid` is still `false`,
**I want** the exact same generic failure `loginUser` returns for a wrong password **so that** no caller
can use the response to enumerate which emails are registered.
**domains:** backend, database
**Acceptance criteria:**
- `loginUser` rejects an account with `emailVerify.valid === false` through the same generic-error branch
  as every other login failure — `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginUser.mts:67-91`
- `loginUser` is rate-limited (20/hr per IP, 60/hr per email) and Turnstile-gated — and so are the other
  two login mutations now: `login` at the same 20/60, `loginAdmin` tighter at 10/30. One helper for all
  three, `BEs/dev/marketplace-dev-public-authorization/src/lib/access/guardPublicLogin.mts`
**Traces:** NFR-SE07, NFR-AV03 (`assertTurnstile` fails closed in production)
**Evidence:** `mutations/loginUser.mts:67-91`

### Every resource/authorization call asserts its own tier, fails closed   `built`
State plainly: every `*-authenticated-resource` and `*-authenticated-authorization` call must run
`assertTier(actual, expected)` before trusting `ctx.state.user`, reject on mismatch with 403, and treat a
missing `tier` field as invalid rather than a wildcard.
**domains:** backend
**Acceptance criteria:**
- Mismatch throws `throwForbiddenError()` (HTTP 403, never 401) — `BEs/marketplace-common/src/others/assertTier.mts:21-23`;
  call site `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:51-61`
- A session hash with no `tier` key at all is rejected by the same `actual !== expected` branch — no
  separate carve-out exists for it (`docs/architecture.md` §Auth model, "A missing `tier` is invalid, not a wildcard")
- The tier assertion runs on a session the handler resolved itself, never on client-supplied state: the
  header must start with the literal `'Bearer access:'` prefix or the request is refused before any Redis
  call (`authorizationAuthenticatedResourceHandler.mts:42`), and the token is then looked up as
  `hGetAll(\`${process.env.REDIS_KEY}${accessToken}\`)` on **every** resource call, never decoded and never
  cached across requests (`authorizationAuthenticatedResourceHandler.mts:49,51`)
**Traces:** NFR-SE03, NFR-SE05, NFR-SE06; ADR-003, ADR-004
**Evidence:** `assertTier.mts:21-23`;
`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:42,49,51`

⚠️ The third criterion was added by `CONFLICT_REPORT.md` §81 rather than written with the story, and it
lives on S04 rather than in a story of its own on purpose: NFR-SE03 and NFR-SE05/SE06 describe two halves
of one middleware — resolve the session, then assert its tier — and splitting them across two stories
would let one ship without the other, which is the hole ADR-004 closed.

### Token rotation shares one body across three deployables   `built`
State plainly: `refresh` on all three `*-authenticated-authorization` services must call the shared
`refreshSessionTokens` from `marketplace-common`, keeping identical rotation logic while staying three
separate crash domains.
**domains:** backend
**Acceptance criteria:**
- `refresh` calls `refreshSessionTokens({ store, ctx, session, captureException })` —
  `BEs/dev/marketplace-dev-authenticated-authorization/src/graphQLApi/schema/mutations/refresh.mts:19-24`
- `BEs/dev/marketplace-dev-admin-authenticated-authorization` and
  `BEs/dev/marketplace-dev-user-authenticated-authorization` remain separate `src/index.mts` processes,
  each `process.exit(1)` on an uncaught exception, never merged into one dispatcher on tier
**Traces:** NFR-AV01; ADR-006
**Evidence:** `refresh.mts:19-24`

### Refresh token travels as a Keygrip-signed httpOnly cookie   `built`
State plainly: the refresh token must be a Koa signed cookie (Keygrip SHA-512), never decoded
client-side — every validity check is a server-side Redis hash lookup.
**domains:** backend
**Acceptance criteria:**
- `refresh` on every `*-authenticated-authorization` service reads the token from the signed cookie, not
  a bearer header — `refresh.mts:19-24` and the equivalents under
  `marketplace-dev-admin-authenticated-authorization`, `marketplace-dev-user-authenticated-authorization`
- `KEYGRIP_KEY_1`/`KEYGRIP_KEY_2` must be identical between `marketplace-dev-public-authorization` (signs
  at `loginUser`) and `marketplace-dev-user-authenticated-authorization` (verifies at `refresh`) — no
  automated test spans two services (BCON-03), so agreement is checked only by a `sha256(key + ' ' +
  value)` fingerprint sweep across both repos' env files, never by printing the values.
  ⚠️ **Superseded by ADR-034, built in "The Keygrip pair leaves five `.env` files for one wrapped record in
  Redis":** the pair has left env for one wrapped record in Redis,
  and a service that cannot unwrap it refuses to boot. The fingerprint sweep described above no longer has
  anything to sweep — there is no `KEYGRIP_KEY_*` in any `.env` — and agreement is now enforced at boot
  rather than checked by hand. What the criterion still asserts is the cookie itself: Keygrip SHA-512,
  `httpOnly`, verified server-side
**Traces:** NFR-SE02; ADR-003
**Evidence:** [`docs/architecture.md`](../../architecture.md) §Auth model, "Refresh token: Koa signed cookie"

### Passwords hashed with bcrypt at cost 14   `built`
State plainly: every credential check must compare against a bcrypt hash produced at `SALT_ROUNDS=14`,
never a lower or reversible scheme.
**domains:** backend, database
**Acceptance criteria:**
- All three login mutations compare against a bcrypt hash via `@node-rs/bcrypt`, `SALT_ROUNDS=14`
  (`docs/architecture.md` §Auth model)
- The stored hash is validated by `$jsonSchema` at exactly 60 chars (`$2y$14$…`) —
  `BEs/marketplace-db-setup/lib/schemas/account.js` (`LOGIN` shape)
**Traces:** NFR-SE04
**Evidence:** `lib/schemas/account.js`

### Nothing substitutes for a session, and no server-side secret reaches a browser   `built`
State plainly: an authenticated call either carries a credential that resolves to a Redis session or it is
refused. No header, code or shared value opens a second door, in any tier or environment, and no value the
services hold may be inlined into a browser bundle.
**domains:** backend, frontend
**Acceptance criteria:**
- A call with no `Authorization` header is refused before any Redis lookup —
  `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:26-32`
- `resolveAuthorizationSession` returns a session or throws; it has no branch that admits a caller without
  one (`docs/decisions/authorization-service-consolidation.md` §As implemented)
- Only public values carry the `VITE_` prefix in the three frontends, enforced by
  `marketplace-fe-no-secret-in-vite-env` in each one's `semgrep/custom.yml`
**Traces:** NFR-SE08, NFR-SE12
**Evidence:** `authorizationAuthenticatedResourceHandler.mts:26-32`

### Email verification flips the gate that `loginUser`/`login` reads   `built`
**As a** ShopOwner or User, **when** I open the link from my confirmation email, **I want**
`emailVerify.valid` set `true` on my account **so that** I can subsequently log in.
**domains:** backend, database
**Acceptance criteria:**
- `GET /check/verify-email/:email/:hash` flips `shopOwner.emailVerify.valid` —
  `BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts`
- `GET /check/verify-email-user/:email/:hash` does the same for `user.emailVerify.valid`, same file — the
  two are the only REST endpoints on the platform besides `GET /check/`
**Traces:** NFR-SE07 (the gate `loginUser` reads)
**Evidence:** `src/middleware/router/index.mts`

### The two admin-only `shopOwner` fields are refused by construction   `built`
**As a** platform admin, **when** I write an internal note about a shop owner or hold their account for
approval, **I want** no ShopOwner-tier service able to select, project, type or return either field **so
that** "BC-01 does not read BC-03's fields" is a property of the build rather than a description of how the
code happens to be written today.
**domains:** backend
**Acceptance criteria:**
- `ADMIN_ONLY_FIELDS_SHOP_OWNER` names `notes` in one place —
  `BEs/marketplace-common/src/others/adminOnlyFields.mts`, exported through the `exports` map — and
  `APPROVAL_GATE_FIELD_SHOP_OWNER` names `waitApprov` beside it, a separate constant because the two
  fields are now under two different rules (see the amendment below)
- Every name in both constants resolves to a real path on `ShopOwnerSchema`, so a rename fails in the repo
  that owns the shape instead of silently disarming the selectors —
  `BEs/marketplace-common/test/others.test.mts`
- Four `no-restricted-syntax` selectors on `notes` — `Property`, `TSPropertySignature`, `MemberExpression`
  and a whitespace-anchored `Literal`, the last one because a Mongoose projection is a single
  space-separated string — in `eslint.config.js` of `marketplace-dev-public-authorization`,
  `marketplace-dev-authenticated-authorization` and `marketplace-dev-authenticated-resource`
- The rule stays silent on prose naming either field, proven by a compliant fixture carrying both real
  projections and a sentence about who owns them — `test/fixtures/restrictedSyntax/admin-only-*`
- The two live ShopOwner projections are asserted against the constants themselves, not only against a
  literal — `tryLoginShopOwner.test.mts`, `tokenInfoShopOwner.test.mts`
**Traces:** NFR-SE12, CON-12
**Evidence:** `BEs/marketplace-common/src/others/adminOnlyFields.mts`, the three `eslint.config.js`

⚠️ **Amended 2026-08-12 by "A shop owner awaiting approval cannot hold a session," the same day it was built.** As first written this story banned all
four shapes of *both* names in all three repos, on the strength of a fact that was true and is not any
more: nothing read `waitApprov`. Making the approval gate real means the two authorization services must
project and compare the flag, so the ban on it is now the **write** shape only — `Property[key.name=
'waitApprov']`, the shape a `$set` is built from — and only inside `src/**`, where a fixture seeding a
parked shop owner cannot trip it. `marketplace-dev-authenticated-resource` is unchanged and still refuses
all four: a session that reaches a resource resolver has already passed the gate twice.

The scoping is itself tested, because a flat-config object naming `no-restricted-syntax` a second time
replaces the first object's entries outright rather than merging them — so the src-scoped block spreads
the shared entries in, and `restrictedSyntax.test.mts` in both repos compares the entry list at a real
`src/` path against the one at a `test/` path, entry for entry. Without that, dropping one spread would
silently disarm every selector above inside the half of the codebase they exist for.

⚠️ **This is deliberately not an anti-corruption layer, and the difference is the point.** An ACL
translates between two models that drift apart; BC-01 and BC-03 have one model — both sides are generated
from `BEs/marketplace-db-setup/lib/schemas/shopOwner.js` and read through the single `ShopOwner` Mongoose
model — so a mapper between them would translate a shape into itself and pay a permanent 100%-coverage,
mutation-score-100 tax to do it. `additionalProperties: false` on the validator already makes the drift an
ACL exists to absorb impossible. What was missing was never translation. It was scope: nothing stopped a
ShopOwner-tier resolver widening a projection by one word. That is what this story closes, at the cost of
two selector pairs and a list.

### A shop owner awaiting approval cannot hold a session   `built`
**As a** platform admin, **when** I hold a shop owner's account for approval, **I want** them refused at
login and their open session refused at its next refresh **so that** `waitApprov` is the gate every
document already called it, rather than a boolean the Admin area writes and nobody reads.
**domains:** backend
**Acceptance criteria:**
- One shared gate, `checkShopOwnerApproval` — `BEs/marketplace-common/src/others/checkShopOwnerApproval.mts`,
  exported through the `exports` map, tested in `test/others.test.mts`. It refuses on presence, not on
  `=== true`: `funShopOwnerUpdateStatus` `$unset`s the flag rather than writing `false`, so an approved
  document has no such key and a `false` would never appear
- `tryLoginShopOwner` (4028) projects `waitApprov` and calls the gate **after** `checkUserAuthorization`.
  ⚠️ The order is the security property, not a style choice: refusing before the password check would
  answer "is this account parked?" to anyone who can type the address, which is a state oracle on an
  account the caller has not authenticated as. `tryLoginUser` already documents the same ordering for its
  own gates
- `tokenInfoShopOwner` (4029) projects it and runs the same gate on **every** refresh, for the reason
  `findAccountForSession` already runs the disabled/deleted gate there: revocation should bite within one
  access-token lifetime, not one refresh-token lifetime
- Each projection has a test asserting it names the field, because a Mongoose `.select()` drops an unknown
  token in silence — a gate handed `undefined` refuses nobody, and no error says so
- Both integration suites seed a real `waitApprov: true` document through the collection's own validator
  and expect 401 — a mocked helper would pass even if the projection stopped asking for the field
- Two places deliberately unchanged, each with the reason written down where it is: `resetPwdFlow`
  (`marketplace-dev-public-resource`), because refusing there turns silence-vs-email into a state oracle on
  an address anyone can type, and the account is already unusable; and registration, because the
  public sign-up writes the flag rather than reading it — `confirmRegistration` stamps
  `waitApprov: true` on the shop-owner account it creates, which is what the gate is for
**Traces:** NFR-SE07, CON-12, `phase2/BOUNDED_CONTEXT.md` §7 q8
**Evidence:** `BEs/marketplace-common/src/others/checkShopOwnerApproval.mts`,
`marketplace-dev-public-authorization/src/lib/db/login/tryLoginShopOwner.mts`,
`marketplace-dev-authenticated-authorization/src/lib/auth/tokenInfoShopOwner.mts`

⚠️ **Whether a *new* shop owner starts parked depends on which mutation created the account**
("A seller registers themselves and waits for an admin," 2026-08-12). The public seller registration does — `shopOwnerRegister`, confirmed through
`confirmRegistration`, stamps `waitApprov: true` — while `shopOwnerAdd` writes nothing, because an admin
who typed the account in has approved it by doing so.
No migration was needed for the rows already on disk: every one of them predates the public form.

### The Keygrip pair leaves five `.env` files for one wrapped record in Redis   `built`
**As a** platform, **when** a service that signs or verifies the refresh cookie boots, **I want** it to take
its keys from one wrapped record and refuse to start if it cannot unwrap it **so that** two services holding
different keys becomes impossible instead of merely undetected.
**domains:** backend, database, infrastructure
**Acceptance criteria:**
- `wrapKeygripKeys` / `unwrapKeygripKeys` in `BEs/marketplace-common/src/encryption/`, node `crypto`
  AES-256-GCM, 32-byte key decoded from `KEYGRIP_KEK`, a fresh 12-byte IV per wrap and **the version as
  AAD**. Tests cover: a tampered tag, a wrong KEK, a truncated blob, and an older blob replayed under a
  bumped version — the last is what the AAD exists for. ⚠️ Not CSFLE: those helpers need a `ClientEncryption`
  and a Mongo key vault, and reusing them would tie the cookie-signing key to the PII master key (ADR-029)
- `keygripKey()`, `keygripHoldersKey()` and `keygripChannel()` join the existing helpers in
  `marketplace-common/src/others/sessionKeys.mts`, all under the shared `REDIS_KEY` prefix (CON-04)
- `loadKeygrip(redisClient)` returns the ordered material array; throws `KEYGRIP_RECORD_MISSING` with the
  seed command in the message when the hash is absent, and `KEYGRIP_KEK_MISMATCH` when the tag fails
- All five services call it in `start()` **between** `RedisConnect()` and `createServer()`, and
  `createServer()` takes the keys as an argument instead of reading `process.env` — the signature changes in
  `marketplace-dev-public-authorization`, the three `*-authenticated-authorization` services and
  `marketplace-dev-authenticated-logout`, each of which has integration tests that call it
- `REQUIRED_ENV_VARS` in those five swaps `KEYGRIP_KEY_1`/`KEYGRIP_KEY_2` for `KEYGRIP_KEK`; the four
  `*-resource` services still list none of the three
- Each service writes its own row into the holders hash once the keys are loaded
- A `startFailure` integration test per service asserts `process.exit(1)` on a missing record and on a wrong
  KEK. **This is R02's first regression test** — no test could express it while the value lived in env,
  because no test spans two services (BCON-03)
- A seed script in `marketplace-db-setup` mints a fresh array or adopts an existing `KEYGRIP_KEY_1`/`_2` pair
  so a running machine migrates without logging anyone out, refuses to overwrite an existing record unless
  forced, and is listed in `SETUP.md` **before** the services. It is never wired into a service's boot
- `KEYGRIP_KEK` is added to `.claude/SECRETS.md`, the `sentryBeforeSend` scrub set and `docs/workflow.md`
  §Environment files in this story, not a later one
- `yarn test:cov` stays 100/4 and `yarn test:mutation` stays 100 in all seven repos touched
**Traces:** NFR-SE02, NFR-SE04; ADR-034, ADR-003, ADR-004; CON-04, BCON-03; R02, R04
**Evidence:** `marketplace-common/src/encryption/wrapKeygripKeys.mts` · `unwrapKeygripKeys.mts` ·
`src/others/loadKeygrip.mts` (which also writes the holders row) · `keygripFingerprint.mts` ·
`sessionKeys.mts:92,107,116` · `marketplace-db-setup/lib/keygrip.js` + `scripts/seedKeygrip.js`
(`yarn seed:keygrip`) · `test/integration/keygripMissing.itest.mts` and `keygripFailure.itest.mts` in each
of the five signing services — the two that make R02 a regression test rather than a paragraph.
⚠️ **The gap this closed, for anyone reading the diff:** every one of the five carried
`new Keygrip([process.env.KEYGRIP_KEY_1!, process.env.KEYGRIP_KEY_2!], 'sha512')` at `src/index.mts`, and
nothing anywhere compared one service's pair with another's

### An admin rotates the signing key, and no service restarts   `built`
State plainly: rotation must be a mutation whose effect reaches five running processes, because the only
alternative — five hand-edited files and five restarts — is why the key has never been rotated.
**domains:** backend
**Acceptance criteria:**
- `keygripRotate` on `marketplace-dev-admin-authenticated-resource`, answering `Boolean!`. ⚠️ **Not on
  `marketplace-dev-authenticated-logout`**: that service is reachable by all three tiers (ADR-005), and
  minting a signing key belongs behind the Admin tier
- It unwraps, mints 64 random bytes, unshifts, retires entries older than `SESSION_CAP_DAYS_REMEMBERED`
  while never leaving fewer than two, rewraps under the bumped version, and writes it back under a
  **Lua compare-and-set on `version`**, then publishes. ⚠️ `WATCH` + `MULTI` was the first shape and was
  rejected: it guards a key on one connection, and this is a cluster, where the connection that holds the
  watch need not be the one a retry runs on. `EVAL` compares and swaps on the node that owns the slot,
  and a rotation whose compare fails is refused rather than retried
- ⚠️ Hosting the mutation makes `marketplace-dev-admin-authenticated-resource` a **sixth `KEYGRIP_KEK`
  holder** — the only one that signs no cookie. It reads the record through `readKeygrip`, not
  `loadKeygrip`, so it never files a holders row for keys it will never adopt
- **Rotation prepends; only retirement is age-gated.** A test asserts a rotate cannot retire a key younger
  than thirty days and cannot leave one behind, and that a full array of five keys all younger than thirty
  days is refused rather than served by an early retirement
- The five subscribe on a duplicated connection — node-redis v6 refuses commands on a subscriber — reassign
  `app.keys` on the message, and re-read on a five-minute `HGET` of `version` for the case where the message
  was missed. Both paths call the same `loadKeygrip`
- A test signs a cookie under a key that is no longer index 0, presents it, and asserts it still verifies and
  comes back re-signed under the current key. That is the thirty-day promise, and Koa's re-sign at index > 0
  is what keeps it
- No path logs, returns or captures key material — including the Sentry breadcrumb on the failure branch
**Traces:** NFR-SE02, NFR-AV01; ADR-034, ADR-003, ADR-005; R02
**Evidence:** `marketplace-common/src/encryption/rotateKeygripKeys.mts` (mint, prepend, age-gated
retirement, the five-key cap) · `src/others/watchKeygrip.mts` and `readKeygrip.mts` ·
`marketplace-dev-admin-authenticated-resource/src/lib/keygrip/funKeygripRotate.mts` (the Lua
compare-and-set and the publish) + `src/graphQLApi/schema/mutations/keygripRotate.mts` ·
`test/integration/keygripRotate.itest.mts` — two rotations over HTTP against the real cluster, the second
reading what the first wrote · the `watchKeygrip` wiring in `src/index.mts` of all five signing services ·
`marketplace-dev-public-authorization/test/integration/keygripAdopt.itest.mts`, the one test that proves
the whole loop: a record rewritten under a running process, announced on the channel, adopted without a
restart, with the cookie signed a moment earlier still verifying.
⚠️ **Admin action, or the service will not boot:** add `KEYGRIP_KEK` to
`marketplace-dev-admin-authenticated-resource`'s `.env` — the same value the five signing services carry.
Before this story that service had no keygrip variable at all, so an existing machine that pulls this
change and restarts gets `Missing required environment variable: KEYGRIP_KEK` and nothing else.

### The admin can see which service holds which key   `built`
**As a** platform admin, **when** I rotate, **I want** to watch all five services converge on the new
fingerprint **so that** "the mutation returned true" and "the fleet agrees" stop being the same claim.
**domains:** backend, frontend
**Acceptance criteria:**
- `keygripStatus` on `marketplace-dev-admin-authenticated-resource` returns the version, one entry per key
  (`id`, `createdAt`, age in days) and the holders rows (service, fingerprint, last seen, whether it matches
  the current record)
- **No field on that type exposes key material**, and a schema test asserts the absence by name rather than
  by reading a snapshot — a field added later must fail a test, not change a snapshot
- `marketplace-admin` gains the screen: the rotate button and the holders table, with a service whose
  fingerprint is stale marked as such
- A holders row ages out on its own, so a decommissioned service does not sit red forever
- `yarn test:cov` 100/4 and `yarn test:mutation` 100 in both repos
**Traces:** NFR-SE02, NFR-MA02; ADR-034; R02
**Evidence:** `marketplace-dev-admin-authenticated-resource/src/lib/keygrip/funKeygripStatus.mts` (the read,
the ages, the `current` comparison) · `src/graphQLApi/schema/types/GraphQLKeygripStatus.mts` — three types,
no `material` field, and `test/schema.test.mts` asserts that by name on all three · `test/keygripLib.test.mts`
(nine tests, including the one that spies on `hSet` to prove a status read files no holders row) ·
`test/integration/keygripRotate.itest.mts`, whose last block reads the record three rotations left behind over
HTTP and asserts a `material` field is rejected by the schema, not merely absent from the answer ·
`marketplace-admin/src/features/security/KeygripPanel.tsx` + `src/pages/SecurityPage.tsx` + the `/security`
route and the fourth `SideMenu` section · `test/pages/SecurityPage.test.tsx` (seventeen tests; the rotation
ones assert a blocked round-trip or a sent one, never a rendered button).
⚠️ **`ageDays` and `current` are the server's answers, not the browser's**, and that is the story rather than
an implementation note: the browser's clock and the browser's copy of the fingerprint can each be a rotation
behind the record they would be judging, so a screen that recomputed either could contradict the record it is
describing, or call a service current against a record that no longer exists. `ageDays` reports how old a key
is and never what the rotation retires on — that runs from the demotion instant (ADR-034, amended
2026-08-28).
⚠️ The read goes through `readKeygrip` and never `loadKeygrip`, so opening the screen cannot file a holders
row for a service that signs nothing — there is a test asserting no write happens.

### `KEYGRIP_KEY_1`/`_2` are gone, and the documents stop describing five files   `built`
State plainly: the old names must leave the templates and the prose in the same piece of work that makes
them unused, or the next person provisioning a machine will populate two variables nothing reads.
**domains:** backend, infrastructure, documentation
**Acceptance criteria:**
- Neither name appears in any `env` template, in any service's `REQUIRED_ENV_VARS`, or in `src/**` of any
  repo. The only surviving references are the seed script's adoption path and ADR-034
- An eslint ban, modelled on `APPROVAL_GATE_FIELD_SHOP_OWNER`, refuses `process.env.KEYGRIP_KEY_` in `src/**`
  of the five services — the same shape of rule for the same reason: the mistake is silent otherwise
- `INFRA.md` §7's per-service table names `KEYGRIP_KEK`; `docs/workflow.md` §Environment files loses the
  cross-repo agreement warning for this pair and keeps it for `REDIS_KEY`; `RISK_REGISTER.md` R02
  closes against the boot gate, and R04 loses its Keygrip half
- `.githooks/pre-commit` check 0 is untouched: it proves a file is well-formed, which is still needed for
  every other value in it
**Traces:** ADR-034; R02, R04, R05b
**Evidence:** `git grep KEYGRIP_KEY_` across the sixteen repos returns the seed script's adoption path
(`marketplace-db-setup/lib/keygrip.js`, its `env` block and its test), the pre-commit guard's own pattern
list, the eslint rules that refuse the names, and prose that says they are gone — no template, no
`REQUIRED_ENV_VARS`, no `src/**` read. `eslint.config.js` in the five signing services carries
`KEYGRIP_KEY_NO_ENV_READ`, two selectors each, verified by probe file: 2 errors for
`process.env.KEYGRIP_KEY_1` and for `process.env['KEYGRIP_KEY_2']`, 0 for `process.env.KEYGRIP_KEK` and 0
under `test/`.
⚠️ **The one deliberate survivor is `marketplace-db-setup/env`**, which still lists the pair as an
optional, empty, one-time input: it is the documented path for a machine that ran the old arrangement,
and deleting it would strand exactly the admin this story is trying not to strand. That is the
criterion's own stated exception, not a miss. The second survivor is the historical record — the
2026-08-07 mismatch and the 2026-08-09 wrapped-value incident are what several documents exist to
remember, and a closed risk is not a deleted one.
⚠️ **The `src/**`-scoped eslint block spreads the shared entries** (`['error', ...RESTRICTED_SYNTAX,
...KEYGRIP_KEY_NO_ENV_READ]`). A second flat-config object naming the same rule *replaces* the first
one's options for every file it matches, so dropping that spread would silently un-ban every Sentry and
TLS selector inside `src/**` — the rule that was added would take four away. The ban is scoped to `src/**`
on purpose for a second reason too: each service's `index.unit.test.mts` asserts those names are *absent*
from the required list, and a repo-wide ban would refuse the test that proves the story.

## 5. Dependencies

- Depends on `BEs/marketplace-common` (`Tier.mts`, `assertTier.mts`, `resolveAuthorizationSession.mts`,
  `refreshSessionTokens`) being **published** before any story here is testable in a consumer — BCON-07.
  Already published; a future edit to common must be released and each
  consumer's range moved before this record's gates mean anything (ADR-047).
- BC-03 (Shop Owner Onboarding & Approval) must create the `shopOwner` document before "ShopOwner login
  mints tier-stamped session" can succeed for that account, **and must not be holding it**: since "A shop
  owner awaiting approval cannot hold a session" a `waitApprov` document is refused at login and at every
  refresh. This line has now said all three things in turn — first that login waited on approval (false),
  then that nothing read the flag (true when "The two admin-only `shopOwner` fields are refused by
  construction" checked it), and now that the gate exists because "A shop owner awaiting approval cannot
  hold a session" built it. Both contexts are built and there is no open ordering work.
- BC-02 (Session Termination) consumes the same Redis session shape BC-01 mints, addressed by token
  content alone — a change to how BC-01 stores a session (key shape, `tier` field name) is a change BC-02
  must be re-verified against, per BCON-05 (one logical change, N repo commits).

## 6. Open questions — four closed, one open

The four below are closed, and kept because each closure is cited elsewhere and the *shape* of the answer
is the knowledge, not the fact that a question existed. **Question 5 is open**, and it arrived here on
2026-08-28 rather than being asked here: it is the one open question left from the login-email
session-revocation work, relocated to this table because §3.1 above is where that work's findings live and
no other record owns the question.

| # | Question | Closed by | Answer |
|---|---|---|---|
| 1 | Should a real anti-corruption layer land before a fourth tier copies the pattern? | "The two admin-only `shopOwner` fields are refused by construction", 2026-08-12 | **No, and not later either.** BC-01 is Conformist to BC-03's model by design, permanently: one `$jsonSchema` builder, one Mongoose model — a Shared Kernel, not two models needing a translator, so a mapper would be an identity function paid for forever under CON-08. The defect was real but misnamed: not corruption, **scope** — nothing mechanically stopped a ShopOwner-tier resolver selecting `notes` or writing `waitApprov`. Two cheap locks now do (CON-12), and a fourth tier copies *them*. Revisit only if the two contexts stop sharing the builder, at which point it is a different question |
| 2 | `shopOwner.waitApprov` gates nothing — is it meant to bite at login, or is it admin-facing and several documents call it a gate wrongly? | "A shop owner awaiting approval cannot hold a session", 2026-08-12 | **It is a gate, and it bites at login and at every refresh.** "The two admin-only `shopOwner` fields are refused by construction" carved exactly the narrow exception the question predicted — one field, the write shape only, `src/**` of two repos, with the scoping itself under test. What did *not* follow from the answer, and was checked rather than assumed: `resetPwdFlow` still ignores the flag, because refusing there leaks account state to an unauthenticated caller and buys nothing the login gate has not already taken away (`phase2/BOUNDED_CONTEXT.md` §7 q8) |
| 3 | Does a freshly created `ShopOwner` start parked? | "A seller registers themselves and waits for an admin", 2026-08-12 | **It depends on who created it, and that is the answer rather than a compromise.** `shopOwnerRegister` — the public self-service registration — writes `waitApprov: true`; `shopOwnerAdd` still writes nothing, because an admin who typed the account in has approved it by doing so, and a stranger who typed it in themselves has not been approved by anybody. No migration was needed: every row on disk predates the public form, so every one was Admin-created and correctly ungated |
| 4 | No automated gate verifies `KEYGRIP_KEY_1`/`_2` agreement across the signing services (BCON-03); a mismatch was live in production data on 2026-08-07, caught by a manual fingerprint sweep and by no suite | ADR-034 → the four stories in §4 that took the Keygrip signing key from `.env` files into a rotatable Redis record | **Two corrections to the question first:** the pair lived in **five** `.env` files, not four — `marketplace-dev-authenticated-logout` clears the same cookie and carries the same keys (`INFRA.md` §7) — and a startup fingerprint check was the smaller half. The larger half was that the key **could not be rotated at all** without editing five git-ignored files by hand and restarting five services, which is why it never had been. The answer: one record in Redis wrapped under a `KEYGRIP_KEK`, a boot that refuses on a tag mismatch rather than a comparison that reports one, and rotation as an admin mutation that running services apply in place. Raw keys in Redis were rejected — a Redis read must not become a cookie forge. `yarn seed:keygrip --force` survives as the disaster path only, for a keyspace that was flushed |
| 5 | **OPEN — Product.** Should a confirm-first email-change flow be built at all: the account holder asks for a new address, the platform mails a confirmation link there, and only the click writes `login.email`? | — | **Undecided, and it is the platform owner's call rather than an implementation detail.** It was raised while making a login-email write revoke sessions, which found that `newEmailTmp` is written by nothing and that the single writer, Admin-tier `shopOwnerUpdateEmail`, moves the account to the new address immediately while `emailVerify.valid` still reads `true` — §3.1 above. So the flow's absence has a cost today: an admin typo hands the account to an unverified address and, since that write started revoking sessions, signs the real owner out of it in the same call. What is *not* undecided is the engineering half, which that work settled and §3.1 records: if it is built, the revoke fires at the confirmation and never at the request. ⚠️ **The question is only about whether to build the flow, and no story anywhere proposes it** — not in the Keygrip custody work, the admin session console, the quality gates, or the admin active-user tables and retention, and it is not a gap in the login-email session-revocation work, which built everything it designed |

## 7. Changelog

| Version | Date | What changed |
|---|---|---|
| 1.0 | — | Initial retrofit, reverse-engineered from the 15-repo working tree |
| 1.1 | 2026-08-12 | "The two admin-only `shopOwner` fields are refused by construction" added, question 1 closed with it (no ACL, Conformist permanently, CON-12). Two claims corrected in the same pass, **both false against the code**: §2 said BC-01 read `waitApprov` to refuse a login, and §5 said BC-03 had to clear it before ShopOwner login could succeed. Nothing read the field — that became question 2 rather than a sentence three documents repeated |
| 1.2 | 2026-08-12 | Question 2 closed, the way the two wrong sentences had assumed — the gate is real now. "A shop owner awaiting approval cannot hold a session" adds `checkShopOwnerApproval` to `tryLoginShopOwner` (4028) and `tokenInfoShopOwner` (4029). §2's scope row and the lint block from the row above change with it: `notes` keeps the four-shape ban everywhere, `waitApprov` keeps only the write ban and only in `src/**` of the two authorization repos, because a rule refusing the read is a rule refusing the gate |
| 1.3 | 2026-08-12 | Question 3 closed by "A seller registers themselves and waits for an admin." `tryLoginShopOwner` gained a second gate in the same story: `checkShopOwnerEmailVerified` runs just before the approval check, since a self-registration arrives with both flags up and only one of them is the applicant's to clear |
| 1.4 | 2026-08-12 | Question 4 decided by ADR-034 and owned by the four stories in §4 that took the Keygrip signing key from `.env` files into a rotatable Redis record, all `not built` at the time. "Refresh token travels as a Keygrip-signed httpOnly cookie" keeps its criterion with a supersession note; the closing ⚠️ on "A shop owner awaiting approval cannot hold a session" — which assumed no public shop-owner registration existed — is struck and answered by "A seller registers themselves and waits for an admin" |
| 1.5 | 2026-08-12 | **"The Keygrip pair leaves five `.env` files for one wrapped record in Redis" built** — signing keys are one AES-256-GCM record in Redis, unwrapped at boot under `KEYGRIP_KEK`; a service holding the wrong KEK exits 1 with `KEYGRIP_KEK_MISMATCH` instead of signing cookies its siblings cannot verify. R02 gets a regression test for the first time, in each of the five services. "Refresh token travels as a Keygrip-signed httpOnly cookie"'s criterion loses its manual sweep: there is no `KEYGRIP_KEY_*` in any `.env` left to sweep |
| 1.6 | 2026-08-12 | **"An admin rotates the signing key, and no service restarts" built** — the key rotates without a restart. ⚠️ Two things changed outside the story's own text: `marketplace-dev-admin-authenticated-resource` now **requires `KEYGRIP_KEK`** as the sixth holder — it unwraps and reseals, and signs nothing — so an existing machine needs that variable added before it restarts; and ADR-034's Compliance section said "the four `*-resource` services list none of the three", which stopped being true the moment the mutation landed in one of them |
| 1.7 | 2026-08-12 | **"The admin can see which service holds which key" built** — the fleet is visible. `marketplace-admin` gains `/security`, a fourth section, where a service that is behind says **"Behind"** in words rather than only in red |
| 1.8 | 2026-08-12 | **"`KEYGRIP_KEY_1`/`_2` are gone, and the documents stop describing five files" built, and ADR-034 is finished.** R02 moves to `Mitigated` at 🟡 Medium in the same pass and R04 loses its Keygrip half; `.githooks/pre-commit` check 0 is untouched, because a well-formed `.env` is still needed for every other value in it |
| 1.9 | 2026-08-13 | This record's four open questions were folded into one table (§6) and its changelog into one table (§7), since every entry in each was already closed; no story, criterion, trace or evidence path changed. R02 has since been **closed** by the quality-gates work recorded in `PLATFORM_OPERATIONS_QUALITY_GATES.md`, with its provisioning residual split out as **R50** and the adoption window as **R47** |
| 1.10 | 2026-08-25 | ⚠️ **Row written 2026-08-27.** The header was bumped to 1.10 on 2026-08-25 with no entry here, so this table skipped from 1.9 to 1.11; the gap was reconstructed from the commit that made the bump, not invented, and nothing about the document itself changed in writing it |
| 1.11 | 2026-08-27 | §2's out-of-scope row for commerce auth said "unbuilt platform-wide", which reads as pending. [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) makes cart, order, delivery and payment permanently out of scope, so there is no tier whose auth is waiting to be designed. The missing **v1.10** row this entry flagged was reconstructed the same day and now sits above it |
| 1.12 | 2026-08-27, later the same day | The **v1.10** row above was written, closing the one hole in this table: the header had been at 1.10 since 2026-08-25 with no entry to say what it covered, so any citation of "IDENTITY_ACCESS v1.10" resolved to nothing. The entry was reconstructed from the commit that made the bump, not invented. §2's wording, every story and every open question are untouched |
| 1.17 | 2026-08-28, later the same day | New **§3.1** records what changing a login email was found to do once a write there started revoking sessions: one writer only (Admin-tier `shopOwnerUpdateEmail`), **no confirm-a-change flow at all**, `newEmailTmp` written and read by nothing, the new address live immediately with `emailVerify.valid` untouched — so an admin typo moves an account to an unverified address *and* ends every session its owner held — and the recorded engineering answer for whoever builds the flow: revoke at the confirmation, never at the request. §6 stops reading "all four closed" and gains **question 5, open**: whether that flow is wanted at all. Nothing about BC-01's build state changed: §3.1 describes a flow that does not exist and a mutation that belongs to BC-03 |
