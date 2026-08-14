# Backend architecture

Nine hand-rolled **Koa 3** servers, each mounting **Apollo Server 5** at one path via
`@as-integrations/koa`. Entry always `src/index.mts`. ESM (`.mts` → `.mjs`), Node `^24.18.0`.

GraphQL is the whole API in eight of the nine. The exception is `marketplace-dev-public-resource`,
which also mounts a `@koa/router` at `src/middleware/router/index.mts` with prefix `/check`:

- `GET /check/`
- `GET /check/verify-email/:email/:hash` (ShopOwner)
- `GET /check/verify-email-user/:email/:hash` (User)

Those three are the only REST endpoints on the platform.

## Services — tier (who) × concern (what)

| Service | Port | Tier | Concern |
|---|---|---|---|
| `marketplace-dev-public-authorization` | 4028 | public | `login`, `loginAdmin`, `loginUser` |
| `marketplace-dev-public-resource` | 4027 | public | public catalogue reads, customer registration, verify-email |
| `marketplace-dev-authenticated-authorization` | 4029 | ShopOwner | token lifecycle |
| `marketplace-dev-authenticated-resource` | 4026 | ShopOwner | domain data, item CRUD, uploads |
| `marketplace-dev-authenticated-logout` | 4030 | **all three** | logout |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | Admin | token lifecycle |
| `marketplace-dev-admin-authenticated-resource` | 4024 | Admin | domain data, `itemCategory` CRUD, moderation, **session administration and key custody** |
| `marketplace-dev-user-authenticated-authorization` | 4031 | User | token lifecycle |
| `marketplace-dev-user-authenticated-resource` | 4032 | User | account, personal data, addresses |

**authorization** = refresh-token cookie → Redis session → mints tokens. No business queries.
**resource** = `Authorization: Bearer access:<token>` header → Redis lookup → serves domain GraphQL.
Only resource services carry `sharp`, `clamscan`, `file-type`, `graphql-upload`.

Put a new domain query/mutation in a **resource** service. Touch **authorization** only for the token
lifecycle.

⚠️ **The logout row is not a typo** (ADR-005). One service serves every tier, because its resolver
deletes the Redis keys by token *content* and never asks which collection minted them. All three
frontends point at 4030.

⚠️ **The Admin resource row carries two concerns that are not domain data**, and that is a recorded
decision rather than drift: `sessions` / `reuseEvents` / `revokeSession` / `revokeAllSessions` read and
write another tier's Redis sessions, and `keygripStatus` / `keygripRotate` / `keygripRetire` administer the
platform's cookie-signing keys. Both are Admin-tier operator tooling and both are answered here rather than
by a tenth deployable — see [`docs/decisions/admin-session-tooling-placement.md`](./decisions/admin-session-tooling-placement.md), which also states
what would reopen it.

### Ports and binding

Ports are reproducible: `grep -m1 '^PORT=' <repo>/env` gives the number above. Frontends are `3043`
(admin), `3044` (shopowner), `3045` (user). No `src/index.mts` supplies a default, so a service with
neither `.env` nor `PORT` in the environment fails to start — the committed `env` template is the only
place to read the intended value from, so it has to stay accurate.

⚠️ **Services bind the wildcard address, not `127.0.0.1`** (ADR-022). Each calls
`httpServer.listen({ port })` with no host, so Node binds `::` (every interface). Every integration
suite fetches `http://127.0.0.1:<port>`, so narrowing the bind breaks all nine. There is no `HOSTNAME`
knob — `hostname:` is not a `net.Server.listen` option.

⚠️ **`marketplace-user`'s `serve.mjs` is the one deliberate exception and binds loopback** — it has no
authentication of its own, and reaching it directly bypasses every nginx rate limit and cache rule in
front of it.

### nginx

**No nginx is installed on this machine** (no `/etc/nginx`, no binary in `PATH`), but the configuration
it would run is checked in, in its own repo at the **workspace root**: `marketplace-nginx/`. Read
[`marketplace-nginx/README.md`](https://github.com/Axiumine/marketplace-nginx/blob/main/README.md) before touching it.

One instance, three hostnames, one vhost each — the apex for the public site and the customer account
area, `shopowner.` and `admin.` for the two panels. TLS terminates there and only there; the eleven
upstream processes speak plain HTTP on loopback ports. It is a repo of its own rather than a directory
inside one of the service repos because it is the only artefact that is not per-service: the three vhosts
share the upstream table and the rate-limit zones, and the same `logout` service answers on all three
hosts. It carries no `package.json`, so it has no lint, coverage, mutation or Qodana gate; its
`.githooks/pre-push` runs `test/run.sh` and blocks the push on any failure, and its `.githooks/pre-commit`
is the platform's secret guard and nothing else (ADR-030).

⚠️ **`proxy_cookie_flags ~ secure httponly samesite=strict;` in `marketplace-nginx/snippets/proxy-backend.conf` is
the only thing on the platform that sets `Secure` on the session cookie.** koa-utils ships
`secure: false` with a comment saying to rewrite it at the edge. Nothing fails without nginx in front —
the cookie simply goes out replayable over plain HTTP.

`marketplace-nginx/test/run.sh` runs the whole thing in a throwaway container: `nginx -t`, then 168 assertions
against a live nginx and stand-in backends. It is the only way to test any of this, since there is no
nginx here.

`marketplace-user/docs/nginx/` used to hold a customer-only copy of this. It is gone — that folder is
now a pointer, and its README says what was wrong with the files it held.

## Auth model

Opaque tokens + Redis sessions. **Not JWT** (ADR-003), despite a stale `JWT` type in `schema.graphql`.

- Refresh token: Koa signed cookie (Keygrip SHA-512), httpOnly. The signing keys are **not** environment
  variables: they are one AES-256-GCM-wrapped record in Redis that each signing service unwraps with
  `KEYGRIP_KEK` at boot, refusing to start if it cannot (ADR-034).
  **They also reach a running process, without a restart.** An operator rotates or retires through the
  Admin API, which rewrites the record and publishes on `<REDIS_KEY>keygrip:rotated`; each of the five
  signing services re-reads and unwraps it for itself — the message is a nudge and never carries key
  material — and rebuilds its `Keygrip`, reassigning `app.keys` so in-flight requests finish against the
  array they started with. A timer re-reads every `KEYGRIP_POLL_MS` (5 minutes) in case a message was
  never delivered, and restamps this service's row in `<REDIS_KEY>keygrip:holders` either way, which is
  what makes that table a heartbeat rather than a record of last adoption. **Measured propagation on the
  Dev stack: 37 ms for a rotation, 8 ms for a retirement, to all five services** — the 5 minutes is the
  ceiling for a lost nudge, not the mechanism ([`report/keygrip-rotation-propagation.md`](./report/keygrip-rotation-propagation.md)).
  Rotation adds a key and removes none, so it can log nobody out; retirement removes one, which is its
  purpose, and R47 records the window in which a not-yet-adopted service still honours it.
- Access token: `Authorization: Bearer access:<token>` header, validated against Redis.
- `x-introspectioncode` header (`INTROSPECTION_CODE`) bypasses the token check for service-to-service
  calls. Treat as a secret; never log it, never expose it to a browser client.
- `checkUserAuthorizationDisDel` in marketplace-common gates on `deleted` / `disabled`. `shopOwner`
  also has `waitApprov` (manual approval gate, `checkShopOwnerApproval` in marketplace-common — refused
  at login on 4028 and again on every refresh on 4029, so parking a shop owner ends a session already
  open within one access-token lifetime) and `onboardingStep` / `onboardingDone`. `user` has
  **no** `waitApprov` — customers self-serve — but both collections refuse an account whose
  `emailVerify.valid` is false: `tryLoginUser` inline for `user`, `checkShopOwnerEmailVerified` (in
  marketplace-common) for `shopOwner`. Both return the same generic error as every other failure, so
  neither can be used as an enumeration oracle. ⚠️ That check is `=== false`, never `!== true`: an
  **absent** `emailVerify` means the account was Admin-provisioned and never asked to confirm anything,
  and collapsing the two would lock out every shop owner created before E03-S08.
- ⚠️ **A self-registered shop owner carries both flags, and they come down by different hands.** Since
  E03-S08 the public site has a seller registration (`shopOwnerRegister`, 4027) that writes
  `waitApprov: true` alongside the unconfirmed address: the activation link clears the verification, an
  operator clears the approval, and `tryLoginShopOwner` checks them in that order — verification first,
  because it is the one the person at the keyboard can act on. `shopOwnerAdd` on the Admin service writes
  no `waitApprov` at all, deliberately: an operator creating the account by hand *is* the approval.
- Passwords: bcrypt via `@node-rs/bcrypt`, `SALT_ROUNDS=14`.

### What one session is made of

A login mints two tokens and three facts that outlive both of them. `newSessionLineage` stamps them once
and no rotation moves any of them (`marketplace-common/src/others/newSessionLineage.mts:31`):

- **`familyId`** — a `randomUUID()`, derived from neither token. Every refresh key of that login joins
  `<REDIS_KEY>family:<familyId>`, so one login is addressable as a whole and not only as its current
  token pair.
- **`originalLogin`** — the epoch millisecond the login happened, which is what makes the cap absolute
  rather than sliding.
- **`sessionCapDays`** — `1` by default, `30` when the login carried `rememberMe: true`
  (`SESSION_CAP_DAYS_DEFAULT` / `SESSION_CAP_DAYS_REMEMBERED`, `src/others/sessionLifetime.mts:20,35`).
  An absent or non-boolean argument resolves to the **shorter** one, so an omitted flag fails towards a
  shorter session. The cookie's `Max-Age` is untouched by any of this: it stays `REFRESH_TOKEN_EXPIRY`,
  and the cap is a comparison in `resolveAuthorizationSession`, not a cookie attribute.

Three mechanisms read those facts, and each is a whole answer to one audit finding:

- **Rotation is one-shot.** The consumed refresh token is tombstoned at `<REDIS_KEY>used:<sha256(token)>`
  holding its `familyId` *before* the session is deleted, so the key never passes through a state where
  it is neither live nor known-consumed. Presenting a consumed token inside `GRACE_SECONDS` (10) answers
  a retry — that is a page's two tabs racing, not an attacker — and past it is a replay:
  `revokeSessionFamily` deletes every member of the family set and appends to `<REDIS_KEY>reuse:<tier>:<accountId>`,
  the trail the operator console reads. The access session of the rotated refresh token is deleted in the
  same pass, so the pre-rotation bearer stops working at rotation rather than at its own expiry. It is
  found by the `accessKey` field the refresh hash carries — stamped at login, re-stamped by every rotation
  — and not only by the token the client presented, so the deletion also happens on the reload path, where
  the in-memory access token is gone and the refresh arrives with no `Authorization` header.
- **The absolute cap is enforced on refresh.** `now - originalLogin > sessionCapDays * 86400000` throws the
  same `throwRefreshTokenExpiredOrDeleted()` every other refusal throws — no new error class, nothing a
  client can tell apart — and revokes the family on its way out.
- **An account can be found from its `_id`.** `<REDIS_KEY>idx:<tier>:<accountId>` is a hash with one field
  per live session, the field name being the refresh session's key body and the value `{ tier, mintedAt }`,
  each field `HEXPIRE`d to its own session's remaining cap. It exists because this platform may not run
  `SCAN` or `KEYS` (BCON-08), and it is what makes "end every session of this account" possible at all:
  a password or email change (E15-S05, E15-S06), a status transition, or an operator pressing revoke.

⚠️ **Only refresh sessions are indexed, and a revocation now ends both halves of each one it finds**
(R54, closed 2026-08-13). The index files refresh sessions alone and does not need to file more: every
refresh hash records the key of the access session minted beside it (`accessKey`), so
`revokeAllSessionsForAccount` and the operator's `revokeSession` read that field and delete the access half
**before** the session that names it — the field lives inside the hash being deleted, so the other order
reads nothing. Family revocation reached both halves already, its set holding the pair every rotation files.
Until this landed, a password change, a status transition or a revoke left the account a working bearer
token for the rest of its 30–91 minutes. What is *not* closed by it is the `disabled` flag flipped with no
revocation behind it: that is still re-read on refresh and nowhere else, which is a statement about a
different write. One further residual is measured rather than assumed: revocation is per-account, so it
cannot reach a session whose account id it does not have. Both are recorded in
[`report/live-auth-path-observation.md`](./report/live-auth-path-observation.md) §6, which also records the
orphaned access token that this arrangement replaced.

### Per-tier session assertion (ADR-004)

Every session hash carries a `tier`, and every service asserts its own. Three pieces, all in
`marketplace-common`: the `TIER` constant (`admin` | `shopOwner` | `user`, `src/others/Tier.mts`), the
tier written into the hash at login and carried through every refresh, and
`assertTier(actual, expected)` (`src/others/assertTier.mts`) called in each service's auth middleware.

Three properties are load-bearing and must not be "simplified":

- **A missing `tier` is invalid, not a wildcard.** Rejected by `actual !== expected` with no branch of
  its own. Fail closed.
- **403, not 401.** The caller authenticated correctly, it simply authenticated somewhere else. A 401
  tells the client to refresh its way out, which it cannot.
- **`REDIS_KEY` stays shared on purpose.** All nine services share `REDIS_KEY=marketplaceDev:`.
  Per-tier prefixes would break the single logout service, which finds a session by token content
  alone. The tier assertion is the layer that holds even if a prefix is ever reused by mistake.

### Session keys are digests, and the transport is not encrypted

Two facts about the Redis leg, stated together because each is only half the picture. The key shapes
themselves, and what is on disk, are in [`data-model.md`](./data-model.md) §Redis.

- **The key is a digest.** Since E13-S01 a session lives under `<REDIS_KEY><sha256('access:'+token)>`,
  built by `sessionKeys.mts` in `marketplace-common` and nowhere else. Before that the key *was* the
  token, so a `MONITOR` transcript, a dump or the append-only file was a list of live credentials in
  plain text. **Reads no longer fall back to the old shape**: E13-S10 deleted the raw-key read path, its
  `dual-read-hits` counter and `DUAL_READ_REMOVE_AFTER` on 2026-08-14, so the digest is now the only name
  a session has and a key that *is* a token resolves to nothing. The window the fallback existed for never
  opened — the cutover was never deployed, and the counter read zero on the only cluster there is.
- ⚠️ **The connection is plaintext `redis://`, and this workspace cannot change it.** Every service
  `env` sets `REDIS_IS_CLUSTER=1`, and koa-utils' `dist/dataSources/Redis.mjs` builds its
  `createCluster` rootNodes with a hardcoded `redis://` scheme — so the session hash, `_id`, `email`
  and `tier` included, crosses the wire in the clear on every request. The single-node branch reads
  `REDIS_URL` and would take `rediss://` today, but production does not use it. This is recorded as
  **R45**, and `test/redisScheme.test.mts` in `marketplace-common` fails the day a koa-utils release
  makes the cluster scheme configurable, so the position is revisited rather than left true by
  inertia. Whether the traffic is nonetheless confined to a trusted network is the topology question
  **ADR-032** records as owed.

### Shared authorization body (ADR-006)

The three `*-authenticated-authorization` services share their body and keep their ports. Since
`marketplace-common@1.0.0` the session lookup, the account re-read and the token rotation are
`resolveAuthorizationSession`, `findAccountForSession` and `refreshSessionTokens`; each service
supplies only its own `TIER.*` constant, its own model and its own projection.

- **Merging the three into one process is settled, against.** Do not re-open it as a refactor.
- ⚠️ **`1.0.0` is a renumber, not a rewrite.** The package was `@thedoctorweb_agency/marketplace-common@4.4.0`
  until it was renamed to `@axiumine/marketplace-common` and restarted at `1.0.0` for its first public
  release. Same code, new name, new number — a `4.x` in an older note means this. Consumers declare
  `^1.0.0`.
- **`marketplace-common` now has a Koa/GraphQL-shaped surface**, consumed by three of the nine services
  but deployed to all nine — an edit there is wider than it looks. `vitest.mutation.config.mts` must
  inline both `@axiumine/marketplace-common` and `@axiumine/koa-utils`, or a `vi.mock` of a
  koa-utils subpath silently stops intercepting.

## Observability

Sentry, one `src/instrument.mts` per service, loaded through `node --import` so the SDK is installed
before the modules it wraps. **An empty `DSN` means no `Sentry.init` at all** — the `.env` default, and
shape (A) of the three [`SETUP.md`](../SETUP.md) §7 supports.

- ⚠️ **Nothing in these repos configures TLS for the collector, and nothing may.** A collector behind a
  certificate this machine does not already trust is reached with `NODE_EXTRA_CA_CERTS=/path/to/ca.pem`,
  from outside the process. A `rejectUnauthorized: false` — which all nine services carried until
  E12-S01 — travels inside a copied `.env` and downgrades a real deployment with nothing failing to say
  so. `no-restricted-syntax` in each `eslint.config.js` refuses the shapes that bring it back.
- **The SDK's blanket PII flag is absent, not `false`.** Decided 2026-08-10 by the platform owner, on two
  grounds. `adminUpdatePwd` takes `passwordOld` and `passwordNew` as GraphQL arguments and the flag
  attaches request bodies — every request here is a GraphQL POST, so the body *is* the envelope carrying
  both passwords in clear. And `personalData` on `shopOwnerAdd` / `shopOwnerUpdate` is CSFLE-encrypted at
  rest under ADR-029; attaching bodies would put those values in telemetry in plaintext, defeating
  encryption at rest from the observability layer. `databaseQueryData` and `stackFrameVariables` are the
  same leak by other routes — a deterministic CSFLE lookup value is plaintext in the query, and a
  resolver frame can hold a decrypted document or a live token.
- **Nothing needed for debugging is lost.** `graphQL.document` stays on, with literal values redacted at
  collection time, so the exception, the stack, the transaction name and the query *shape* still arrive.
  `graphQL.variables` does not: on this surface the variables are the passwords and the personal data.
- ⚠️ **`dataCollection` lists every category on purpose.** `resolveDataCollectionOptions` picks its base
  as `dataCollection != null ? DEFAULTS : <legacy mapping>`, and `DEFAULTS` is fully permissive — so
  supplying the option at all flips the base, and **an omitted category is an enabled category**. A short
  `dataCollection` reads like a tightening while switching request bodies, cookies and unfiltered headers
  on. Do not shorten it.
- **No network-derived value reaches telemetry**, on either event type. `userInfo: false` stops the SDK
  inferring a client address for `event.user`, and `sentryBeforeSend` (marketplace-common,
  `src/others/sentryBeforeSend.mts`) is wired as **both** `beforeSend` and `beforeSendTransaction` in all
  nine services to remove what configuration cannot: `httpServerSpansIntegration` writes the client
  address, the user agent and both peer addresses straight onto the server span, outside the
  `dataCollection` machinery entirely. ⚠️ **Both hooks or neither** (E12-S22): the SDK routes transaction
  events to the second one alone, and those attributes are on the transaction, so wiring only `beforeSend`
  means a `tracesSampleRate` switches the redaction off. The scrubber also strips both `Authorization`
  headers and cookies in both directions, in both the header spelling and the `_`-normalised span
  spelling, deletes `event.request.data` outright, and clears `message` and `data.arguments` from every
  breadcrumb. The SDK's own sensitive-key filtering is a second layer and a minor-version implementation
  detail — never a reason to shorten the scrubber's list.
- ⚠️ **The request body is stopped at capture time, not at send time** (E12-S21). `dataCollection.httpBodies`
  reaches the `http.request.body.data` span attribute and nothing else; the event field is written by the
  requestdata integration, which hard-wires `include.data = true`. The gate that works is
  `httpIntegration({ maxIncomingRequestBodySize: 'none' })`, passed in every service — the option name on the
  wrapper, forwarded to `httpServerIntegration`'s `maxRequestBodySize`. **The inner spelling on the outer
  integration is a silent no-op**, since the options object is not validated, so the `"medium"` default
  simply stays.
- **`environment` is explicit, `process.env.NODE_ENV ?? 'unknown'`** (E12-S23). Absent, the SDK labels every
  event `production`, which is what a Dev stack was measured doing. The fallback is not `development`: an
  unset variable on a deployed box would then be labelled the one thing it is least likely to be.

### What each `dataCollection` category replaced

The blanket flag was a two-value shortcut, and the SDK still maps it internally — `@sentry/core`,
`utils/data-collection/defaultPiiToCollectionOptions.js`, read at **10.69.0**. The middle columns are what
the nine services resolved to before this epic, so the table is the migration path as well as the record:

| Category | Flag absent or `false` | Flag `true` | Configured here |
|---|---|---|---|
| `userInfo` | `false` | `true` | `false` |
| `cookies` | deny-list of PII-ish name snippets | `true` | `false` |
| `httpHeaders` | the same deny-list, per direction | `true` both directions | `false` both directions |
| `httpBodies` | `[]` | all four targets | `[]` — **spans only; the event body is stopped by `maxIncomingRequestBodySize`** |
| `urlQueryParams` | the same deny-list | `true` | `false` |
| `graphQL` | `{ document: true, variables: true }` | identical | `{ document: true, variables: false }` |
| `genAI` | `{ inputs: false, outputs: false }` | both `true` | `{ inputs: false, outputs: false }` |
| `databaseQueryData` | `false` | `true` | `false` |
| `stackFrameVariables` | `true` | `true` | `false` |
| `frameContextLines` | `7` | `7` | `7` |

Three rows are worth reading twice. **`graphQL.variables` is on in both branches**, so removing the flag
would have left the variables — the passwords and the personal data on this surface — arriving as before.
**`stackFrameVariables` is on in both branches** too, and a resolver frame holds decrypted documents and
live tokens. And `frameContextLines` is `7` here rather than the `DEFAULTS` `5`, because both legacy
branches use 7 to match the ContextLines integration: stack context is unchanged by this epic.

⚠️ **The version is pinned by a test, not by a comment.** Every claim above was read out of `node_modules`
at 10.69.0, none of it is a documented API contract, and the flag is removed outright in v11.
`test/sentryVersionGuard.test.mts` in each of the nine services and in `marketplace-common` asserts the
installed `@sentry/node`, `@sentry/core` and `@sentry/node-core` against that exact version and fails on any
bump, naming this section in its failure message (E12-S05, risk **R42**). `node-core` joins the two because
it owns `httpServerIntegration`, where the request-body default lives and where the option the services pass
is really read; it ships on its own version line. The exact version rather than the major, because the
sensitive-key filtering that arrives as a second layer is a minor-version implementation detail.

### What the logs actually contain — measured, 2026-08-11

Two investigations ran against the running Dev stack and produced findings. **Read them before trusting the
rest of this section**, because they correct two of its claims.

- [`report/log-sink-inventory.md`](./report/log-sink-inventory.md) (E12-S12) — every sink, and what a token,
  a cookie, a signing key or a client IP can do in it. The nine application logs are clean on every planted
  marker. The nginx access log carried the account email and the one-time verify/reset hash, because the
  mailed links are GETs with `:email/:hash` in the path — ✅ **fixed 2026-08-11 by E12-S16**, which redacts
  the tail of all four link shapes, and the `Referer` beside it, in `conf.d/05-logging.conf`. Four, not the
  two the probe drove: two of them have no `location` block at all. The Redis password is in the container argv. No
  Docker log driver is bounded and no repo pins nginx's retention. **The `error_log`'s hard-coded
  `client: <address>` prefix is on five of five request-scoped entries at the shipped `warn` — level is not
  the discriminator, having a request context is.**
- [`report/sentry-event-capture.md`](./report/sentry-event-capture.md) (E12-S13) — one real event, built and
  transmitted by the real transport into a local collector.

⚠️ **Three corrections this section owed to that second finding. Two are closed, the third is open:**

- ✅ **`httpBodies: []` does not keep the request body out of an event.** It gates the
  `http.request.body.data` *span* attribute only. `@sentry/core` 10.69.0 hard-wires `include.data = true`
  for events (`integrations/requestdata.js:27-28`) and the write-time gate is `httpIntegration`'s
  `maxIncomingRequestBodySize`, default `"medium"`. A captured event carried a plaintext password in
  `event.request.data`. **Fixed 2026-08-11 by E12-S21**: the option is passed at `'none'` in all nine
  services, and the scrubber deletes the field as a second layer. The paragraph above about `adminUpdatePwd`
  describes what is now prevented.
- ✅ **`beforeSend` is not called for transaction events**, and `beforeSendTransaction` was configured
  nowhere. The client address `httpServerSpansIntegration` writes onto the server span therefore shipped
  unredacted the moment a `tracesSampleRate` was set. No **backend** service sets one, which is the only
  thing that kept the measured shape latent there. `http.user_agent`, `net.peer.ip` and `net.host.ip` were
  in the same position and were not in the scrubber's key list. **Fixed 2026-08-11 by E12-S22**: both hooks
  carry the same function, the three keys joined the list along with both `user-agent` header spellings, and
  the fixture was rebuilt from the captured transaction's 28 attributes.
- ⚠️ **The three frontends are not in that latent position.** All three set `tracesSampleRate: 0.1`
  (`src/instrument.ts:46`) and none configures `beforeSend` or `beforeSendTransaction`; `sentryBeforeSend`
  is a `marketplace-common` export and no frontend depends on that package, so **no scrubber runs on any
  frontend event**. What a browser transaction carries is unmeasured — `@sentry/react` has no
  `httpServerSpansIntegration`, so the key list above does not transfer — E12-S24.

## Resolver layout (per resource service)

```
src/graphQLApi/schema/
├── queries.mts  mutations.mts     # roots
├── queries/  mutations/           # one file per operation: <entity>Add|Update|Del|Dis.mts
├── types/  GraphQLInput/  interfaces/  frag/
```

⚠️ **`marketplace-dev-public-resource` spells the root `src/graphQLPublic/`, not `src/graphQLApi/`** —
otherwise identical, but a `find`/`grep` written for the other eight silently misses it.

A new product type gets its own files directly under `mutations/`, following `itemAdd.mts` and
`itemUpdate.mts` in the ShopOwner resource service.
