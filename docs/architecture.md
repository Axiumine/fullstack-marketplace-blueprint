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

**No nginx config is installed in this workspace or on this machine** (no `/etc/nginx`, no binary in
`PATH`). The live vhosts live on whatever host fronts the stack. Do not go looking for them here.

`marketplace-user/docs/nginx/` carries real, deployable configs — `cache.conf`,
`marketplace-user.conf`, `rate-limit.conf`, `security-headers.conf` — covering TLS, HSTS, CSP, the SSR
upstream, the `proxy_cache` zone that bypasses on the session cookie, PMTiles range requests and the
auth-path rate-limit zones. They are documentation until someone installs them.

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

### Shared authorization body (ADR-006)

The three `*-authenticated-authorization` services share their body and keep their ports. Since
`marketplace-common@4.4.0` the session lookup, the account re-read and the token rotation are
`resolveAuthorizationSession`, `findAccountForSession` and `refreshSessionTokens`; each service
supplies only its own `TIER.*` constant, its own model and its own projection.

- **Merging the three into one process is settled, against.** Do not re-open it as a refactor.
- **`marketplace-common` now has a Koa/GraphQL-shaped surface**, consumed by three of the nine services
  but deployed to all nine — an edit there is wider than it looks. `vitest.mutation.config.mts` must
  inline both `@thedoctorweb_agency/marketplace-common` and `@axiumine/koa-utils`, or a `vi.mock` of a
  koa-utils subpath silently stops intercepting.

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
