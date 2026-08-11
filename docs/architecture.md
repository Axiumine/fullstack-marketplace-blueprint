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
| `marketplace-dev-admin-authenticated-resource` | 4024 | Admin | domain data, `itemCategory` CRUD, moderation |
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

- Refresh token: Koa signed cookie (Keygrip SHA-512, `KEYGRIP_KEY_1/2`), httpOnly.
- Access token: `Authorization: Bearer access:<token>` header, validated against Redis.
- `x-introspectioncode` header (`INTROSPECTION_CODE`) bypasses the token check for service-to-service
  calls. Treat as a secret; never log it, never expose it to a browser client.
- `checkUserAuthorizationDisDel` in marketplace-common gates on `deleted` / `disabled`. `shopOwner`
  also has `waitApprov` (manual approval gate) and `onboardingStep` / `onboardingDone`. `user` has
  **no** `waitApprov` — customers self-serve — but `loginUser` refuses an account whose
  `emailVerify.valid` is false, returning the same generic error as every other failure so it cannot be
  used as an enumeration oracle.
- Passwords: bcrypt via `@node-rs/bcrypt`, `SALT_ROUNDS=14`.

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
  plain text. Reads currently fall back to the old shape for sessions minted before the cutover; that
  fallback and its `dual-read-hits` counter are deleted by E13-S10 on the date in
  `DUAL_READ_REMOVE_AFTER`.
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
- **No network-derived value reaches telemetry** — on error events, which are the only events the shipped
  configuration produces. Transactions are a different story and it is not a good one; see the corrections
  below. `userInfo: false` stops the SDK inferring a client
  address for `event.user`, and `sentryBeforeSend` (marketplace-common,
  `src/others/sentryBeforeSend.mts`) is wired as `beforeSend` in all nine services to remove what
  configuration cannot: `httpServerSpansIntegration` writes the client address straight onto the server
  span, outside the `dataCollection` machinery entirely. The scrubber also strips both `Authorization`
  headers and cookies in both directions, in both the header spelling and the `_`-normalised span
  spelling. The SDK's own sensitive-key filtering is a second layer and a minor-version implementation
  detail — never a reason to shorten the scrubber's list.

### What each `dataCollection` category replaced

The blanket flag was a two-value shortcut, and the SDK still maps it internally — `@sentry/core`,
`utils/data-collection/defaultPiiToCollectionOptions.js`, read at **10.69.0**. The middle columns are what
the nine services resolved to before this epic, so the table is the migration path as well as the record:

| Category | Flag absent or `false` | Flag `true` | Configured here |
|---|---|---|---|
| `userInfo` | `false` | `true` | `false` |
| `cookies` | deny-list of PII-ish name snippets | `true` | `false` |
| `httpHeaders` | the same deny-list, per direction | `true` both directions | `false` both directions |
| `httpBodies` | `[]` | all four targets | `[]` — **spans only; see the corrections below** |
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
installed `@sentry/node` and `@sentry/core` against that exact version and fails on any bump, naming this
section in its failure message (E12-S05, risk **R42**). The exact version rather than the major, because
the sensitive-key filtering that arrives as a second layer is a minor-version implementation detail.

### What the logs actually contain — measured, 2026-08-11

Two investigations ran against the running Dev stack and produced findings. **Read them before trusting the
rest of this section**, because they correct two of its claims.

- [`report/log-sink-inventory.md`](./report/log-sink-inventory.md) (E12-S12) — every sink, and what a token,
  a cookie, a signing key or a client IP can do in it. The nine application logs are clean on every planted
  marker. The nginx access log carries the account email and the one-time verify/reset hash, because both
  mailed links are GETs with `:email/:hash` in the path. The Redis password is in the container argv. No
  Docker log driver is bounded and no repo pins nginx's retention. **The `error_log`'s hard-coded
  `client: <address>` prefix is on five of five request-scoped entries at the shipped `warn` — level is not
  the discriminator, having a request context is.**
- [`report/sentry-event-capture.md`](./report/sentry-event-capture.md) (E12-S13) — one real event, built and
  transmitted by the real transport into a local collector.

⚠️ **Two corrections this section owes to that second finding, both open as of 2026-08-11:**

- **`httpBodies: []` does not keep the request body out of an event.** It gates the
  `http.request.body.data` *span* attribute only. `@sentry/core` 10.69.0 hard-wires `include.data = true`
  for events (`integrations/requestdata.js:27-28`) and the write-time gate is `httpIntegration`'s
  `maxRequestBodySize`, default `"medium"`. A captured event carried a plaintext password in
  `event.request.data`. The paragraph above about `adminUpdatePwd` describes a live defect, not a prevented
  one — E12-S21.
- **`beforeSend` is not called for transaction events**, and `beforeSendTransaction` is configured nowhere.
  The client address `httpServerSpansIntegration` writes onto the server span therefore ships unredacted the
  moment a `tracesSampleRate` is set. No **backend** service sets one, which is the only thing keeping the
  measured shape latent there. `http.user_agent`, `net.peer.ip` and `net.host.ip` are in the same position
  and are not in the scrubber's key list — E12-S22.
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
