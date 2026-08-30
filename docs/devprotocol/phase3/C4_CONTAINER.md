# C4 — Container Diagram
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.8
**Date:** 2026-08-28
**Author:** c4-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.8 - 2026-08-28: the `marketplace-common` node label carries `2.0.1`, and §*Non-deployed but real*'s cell —
missed by v1.7 and still reading `1.0.1` / `^1.0.1` — carries the released version and the consumers' actual
range. The range stays `^2.0.0` and all twelve consumers pinned `2.0.1` in their lockfiles the same day, so
the diagram records what the registry serves *and* what the containers run. Structure unchanged — same
containers, same edges.
v1.7 - 2026-08-27, later the same day: the `marketplace-common` container row, the Mermaid edge label and the
published-at note carry `2.0.0` / `^2.0.0`. Structure unchanged — same containers, same edges.
v1.6 - 2026-08-27: The `price` row in §8 said the four commerce concepts were "unbuilt, undesigned", which invited a reader to supply the missing design. ADR-038 (2026-08-27) refuses it outright, so the row says permanently and cites it alongside ADR-009.
v1.1 - 2026-08-25: the 4024 row described an Admin service that never touched `user`. E19 gave it
`usersActiveTbl` and `userUpdateStatus`; the row now says so, and says what the admin still cannot do
to a customer account.
**Depends on:** [`docs/devprotocol/phase1/PDR.md`](../phase1/PDR.md) ✅ · [`docs/devprotocol/phase1/SYSTEM_CONTEXT.md`](../phase1/SYSTEM_CONTEXT.md) ✅ · [`docs/devprotocol/phase2/BOUNDED_CONTEXT.md`](../phase2/BOUNDED_CONTEXT.md) ✅ · [`docs/devprotocol/phase3/C4_CONTEXT.md`](./C4_CONTEXT.md) ✅
**Mutability:** keep in sync — update on each architectural change
v1.6 - 2026-08-30: the `COMMON` node, its edge label, the compile-time relationship row, the tree comment
and §Rules all described a **filesystem sync** into every consumer's `node_modules`.
[`ADR-047`](./adr/ADR-047-a-common-change-ships-as-a-published-release.md) deletes `deploy-local.sh`: the
only route from this container to its nine consumers is a published version, resolved by each consumer's own
`yarn.lock`. The library is `3.0.0` and the twelve consumers pin `^3.0.0`. No container, and no
*deployment* relationship, changed — what changed is that the one compile-time edge is a registry fetch
rather than an `rsync`.
v1.5 - 2026-08-27, later the same day: the `marketplace-common` container row said a plain `yarn install` restores the
released build over a deployed one, without saying that this costs nothing unless an unreleased edit exists, and without
saying that no install path invokes the script. Both added. No container or relationship changed.
v1.4 - 2026-08-27, later the same day: the `COMMON` node label, its edge label and §*Non-deployed but real* all
said `marketplace-common` is *"not deployed"* / *"Not on any npm registry"*. `ADR-037` published it at `1.0.1` on
2026-08-26; it is `2.0.0` since 2026-08-27 and every consumer pins `^2.0.0`. `deploy-local.sh` keeps a narrower
job — *edited → released* — which the
diagram now says. **(That job ended on 2026-08-30: the script is deleted, ADR-047 — see v1.6.)** v1.3's Qodana-id correction stands; no container or relationship changed.
v1.3 - 2026-08-27: the `marketplace-admin/` tree comment cited Qodana project `1rylx`. It is `VOZEg` — enumerated from every repo's scan artefact into `phase1/SYSTEM_CONTEXT.md` §5.12, which is now the one place that list lives. Two ADRs carried the same wrong id and are corrected in the same pass. Nothing about the container split changed.
v1.2 - 2026-08-26: the stale "168 behavioural assertions" count replaced by a citation of `marketplace-nginx/test/suite.sh` itself. The number was stale by 67 — the suite ran 235 assertions before 2026-08-26 and 242 after — and a count written into prose goes stale silently every time an assertion is added. Nothing measured or decided changed.

---

## 1. Purpose

Zooms inside the Marketplace box drawn in [`docs/devprotocol/phase3/C4_CONTEXT.md`](./C4_CONTEXT.md). Every runnable unit on
the platform, split on two axes — **tier** (who: public / ShopOwner / Admin / User) × **concern** (what:
authorization = token lifecycle, resource = domain data) — plus the two data stores, plus the three
packages that ship code but are never themselves deployed (`marketplace-common`,
`BEs/marketplace-db-setup`, and the documentation-only nginx layer). Prescriptive, not descriptive: this
is what the shape of the platform **requires**, backed by real on-disk paths, not a narration of
incidental code.

Ground truth for every fact below: [`CLAUDE.md`](../../../CLAUDE.md) and `docs/` at the workspace root, `docs/devprotocol/phase3/adr/`, and
per-repo `env` templates read directly this session (`grep -m1 '^PORT=' <repo>/env`).

---

## 2. Container diagram

```mermaid
graph TB
    subgraph FE["Frontends"]
        FEA["marketplace-admin :3043\nSPA — Admin tier"]
        FES["marketplace-shopowner :3044\nSPA — ShopOwner tier"]
        FEU["marketplace-user :3045\nSSR public routes / SPA /account/*"]
    end

    subgraph PublicT["public tier"]
        PA["public-authorization :4028\nlogin, loginAdmin, loginUser"]
        PR["public-resource :4027\ncatalogue reads, registration,\nverify-email, /check REST"]
    end

    subgraph ShopOwnerT["ShopOwner tier"]
        SA["authenticated-authorization :4029\ntoken lifecycle"]
        SR["authenticated-resource :4026\ncompany + item CRUD, uploads"]
    end

    subgraph AdminT["Admin tier"]
        AA["admin-authenticated-authorization :4025\ntoken lifecycle"]
        AR["admin-authenticated-resource :4024\napproval, itemCategory CRUD,\nmoderation"]
    end

    subgraph UserT["User tier"]
        UA["user-authenticated-authorization :4031\ntoken lifecycle"]
        UR["user-authenticated-resource :4032\npersonalData, addresses,\ndefaultAddress"]
    end

    LO["authenticated-logout :4030\nserves ALL 3 authenticated tiers"]

    Mongo[("MongoDB\n6 collections")]
    Redis[("Redis cluster\nshared REDIS_KEY prefix")]

    COMMON["marketplace-common\n(published @axiumine/marketplace-common 3.0.0;\nreleases only — no local sync path)"]
    DBSETUP["marketplace-db-setup\n(migration runner, not deployed)"]
    STATUS["marketplace-services-status :varies\n(monitor, parent-tracked, no own repo)"]
    NG["nginx\n(marketplace-nginx/ — 3 vhosts, container-tested,\ninstalled on no host)"]

    FEU -->|"GraphQL, SSR bypasses nginx"| PR
    FEU --> PA
    FEU --> UA
    FEU --> UR
    FEU --> LO
    FES --> PA
    FES --> SA
    FES --> SR
    FES --> LO
    FEA --> PA
    FEA --> AA
    FEA --> AR
    FEA --> LO

    NG -.fronts, docs-only.-> FEU
    NG -.fronts, docs-only.-> FEA
    NG -.fronts, docs-only.-> FES
    NG -.fronts every service too.-> PA

    PA --> Mongo
    PA --> Redis
    PR --> Mongo
    PR --> Redis
    SA --> Mongo
    SA --> Redis
    SR --> Mongo
    SR --> Redis
    AA --> Mongo
    AA --> Redis
    AR --> Mongo
    AR --> Redis
    UA --> Mongo
    UA --> Redis
    UR --> Mongo
    UR --> Redis
    LO --> Redis

    COMMON -.compiled in, ^3.0.0 from registry.npmjs.org.-> PA
    COMMON -.-> PR
    COMMON -.-> SA
    COMMON -.-> SR
    COMMON -.-> AA
    COMMON -.-> AR
    COMMON -.-> UA
    COMMON -.-> UR
    COMMON -.-> LO

    DBSETUP -->|"migrate:up"| Mongo
    STATUS -.polls health of.-> PA
    STATUS -.polls health of.-> PR
    STATUS -.polls health of.-> SA
    STATUS -.polls health of.-> SR
    STATUS -.polls health of.-> AA
    STATUS -.polls health of.-> AR
    STATUS -.polls health of.-> UA
    STATUS -.polls health of.-> UR
    STATUS -.polls health of.-> LO
```

Solid arrows: real runtime calls (GraphQL over HTTP, Mongoose driver calls, Redis client calls). Dashed
arrows: compile-time (`marketplace-common`, synced not linked), documentation-only (`nginx`), or
monitoring (`marketplace-services-status`).

---

## 3. Container descriptions

### Backend services — 9 deployables, Koa 3 + Apollo Server 5, entry `src/index.mts`, Node `^24.18.0`, ESM

| Container | Port | Tier | Technology | Responsibility |
|---|---|---|---|---|
| `marketplace-dev-public-authorization` | 4028 | public | Koa 3 + Apollo Server 5, `ENDPOINT = '/public-authorization'` (`BEs/dev/marketplace-dev-public-authorization/src/index.mts`) | Mints the initial session for **all three** authenticated tiers — `login` (ShopOwner), `loginAdmin`, `loginUser` mutations. No business queries. All three run `guardPublicLogin` first — two Redis rate-limit counters (per IP, per email) then Cloudflare Turnstile verification — so this service calls `siteverify` as well as `public-resource` does. `loginAdmin` carries the tightest ceilings on the platform, 10/hr per IP and 30/hr per email. |
| `marketplace-dev-public-resource` | 4027 | public | Koa 3 + Apollo Server 5 at `/public-resource`, **plus** a real `@koa/router` (`BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts`) prefixed `/check` | Public catalogue reads (published `company`/`item`/`itemCategory` only), customer registration, and the platform's only 3 REST endpoints: `GET /check/`, `GET /check/verify-email/:email/:hash`, `GET /check/verify-email-user/:email/:hash`. Verifies Cloudflare Turnstile. |
| `marketplace-dev-authenticated-authorization` | 4029 | ShopOwner | Koa 3 + Apollo Server 5, `ENDPOINT = '/authenticated-authorization'` | ShopOwner token lifecycle only — refresh/rotate, re-reads the account to re-check `checkUserAuthorizationDisDel` gates. Body shared via `marketplace-common@1.0.0`'s `resolveAuthorizationSession`/`findAccountForSession`/`refreshSessionTokens` (`BEs/marketplace-common/src/others/resolveAuthorizationSession.mts`). |
| `marketplace-dev-authenticated-resource` | 4026 | ShopOwner | Koa 3 + Apollo Server 5, `ENDPOINT = '/authenticated-resource'` | Domain data for ShopOwner — `shopOwnerCompanies`, `companyItems`, `itemCategories` reads; `company*`, `itemAdd`/`itemUpdate`/`itemDel` mutations; file uploads (`sharp`, `clamscan`, `file-type`, `graphql-upload` — only resource services carry these). |
| `marketplace-dev-authenticated-logout` | 4030 | **all three tiers** | Koa 3 + Apollo Server 5, `ENDPOINT = '/logout'` | One `logout` mutation, shared by every frontend. Deletes the Redis session key by **token content**, never inspects which collection minted it — the reason `REDIS_KEY` must stay one shared prefix (`docs/architecture.md` §Auth model). |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | Admin | Koa 3 + Apollo Server 5, `ENDPOINT = '/admin-authenticated-authorization'` | Admin token lifecycle, same shared-body pattern as the other two `*-authenticated-authorization` services. |
| `marketplace-dev-admin-authenticated-resource` | 4024 | Admin | Koa 3 + Apollo Server 5, `ENDPOINT = '/admin-authenticated-resource'` | Domain data for Admin — `shopOwnerAdd`/`shopOwnerUpdateStatus` (approval), **sole writer** of `itemCategory` (`funItemCategoryAdd.mts` enforces the depth-2 cap), moderation (`companyDel` any company, `itemUpdatePublished`/`itemDel`). Since 2026-08-25 also the admin's only reach into `user`: `usersActiveTbl` pages customer accounts and `userUpdateStatus` suspends or restores one, ending every session of the suspended account through `endEveryUserSession` (E19). ⚠️ **This is the only service that reads `user` for anyone other than its owner**, and it can do nothing else to one — no create, no delete, no edit of a customer's data. |
| `marketplace-dev-user-authenticated-authorization` | 4031 | User | Koa 3 + Apollo Server 5, `ENDPOINT = '/user-authenticated-authorization'` | User (customer) token lifecycle. Signs/verifies the customer refresh cookie together with `public-authorization`'s `loginUser` — both read the same wrapped Redis record and neither boots without `KEYGRIP_KEK` (ADR-034). |
| `marketplace-dev-user-authenticated-resource` | 4032 | User | Koa 3 + Apollo Server 5, `ENDPOINT = '/user-authenticated-resource'` | Customer account data — `personalData`, `addresses[]` CRUD, `defaultAddress` pointer maintenance. `funUserAddressDel.mts` is the platform's one pipeline update and must coerce ids to `ObjectId` before they enter it. |

### Frontends — 3 deployables, Vite 8 + React 19 + TypeScript strict

| Container | Port | Tier | Technology | Responsibility |
|---|---|---|---|---|
| `marketplace-admin` | 3043 | Admin | SPA — TanStack Router, urql, react-hook-form + zod, Tailwind 4 (`marketplace-admin/vite.config.ts:39`, `env.PORT ?? 3043`) | Admin UI. `loginAdmin`, then manage ShopOwners, approve onboarding, curate `itemCategory`, moderate `company`/`item`. Points at 4024/4025/4028/4030. |
| `marketplace-shopowner` | 3044 | ShopOwner | SPA, same stack, mirror of `marketplace-admin` (`marketplace-shopowner/vite.config.ts:39`, `env.PORT ?? 3044`) | Shop-owner UI, deliberately thinner. Manages own `company` document(s) + `item` catalogue. Points at the four non-admin services: 4028/4029/4026/4030. |
| `marketplace-user` | 3045 | User + anonymous | TanStack Start — SSR for public routes, `ssr: false` for `/account/*` (`marketplace-user/vite.config.ts:86`, `env.PORT ?? 3045`) | The only server-rendered surface. Public catalogue pages render server-side; `/account/*` never does — a security boundary, not a style choice. Production is served by `marketplace-user/serve.mjs`, which binds `127.0.0.1` only (`serve.mjs:34`, `const HOSTNAME = '127.0.0.1'`) — the one deliberate loopback bind on the platform, because nginx sits in front of it in production and this process has no auth of its own. |

### Data stores

| Container | Technology | Responsibility |
|---|---|---|
| MongoDB | primary datastore | 6 collections — `admin`, `shopOwner`, `company`, `user`, `item`, `itemCategory` — each with a strict `$jsonSchema` validator and `additionalProperties: false`, defined in `BEs/marketplace-db-setup/lib/schemas/`. Ownership chain `shopOwner ──idShopOwner──> company ──idCompany──> item ──idCategory──> itemCategory`. Read/written by all 9 backend services via Mongoose. |
| Redis (cluster) | session store + rate-limit counters | Opaque access/refresh token session hashes, one shared prefix — `REDIS_KEY=marketplaceDev:` (verified `BEs/dev/marketplace-dev-authenticated-resource/env`). Every hash carries a `tier` field asserted by `assertTier` (`BEs/marketplace-common/src/others/assertTier.mts:21`). Cluster topology means Redis deletes must be one key per `del` call — a multi-key `del` throws `CROSSSLOT`. |

### Non-deployed but real — ship code, never listen on a port

| Container | Technology | Responsibility |
|---|---|---|
| `marketplace-common` | ESM npm-named library, `@axiumine/marketplace-common` (`BEs/marketplace-common/package.json:2`) | Shared Mongoose models, `TIER` constant and `assertTier` (`src/others/Tier.mts`, `src/others/assertTier.mts`), and — since v4.4.0 — the Koa/GraphQL-shaped session-resolution trio `resolveAuthorizationSession`/`findAccountForSession`/`refreshSessionTokens` consumed by the three `*-authenticated-authorization` services. Published to `registry.npmjs.org` at `3.0.0` (`1.0.1` when this cell was written, `2.0.0` on 2026-08-27, `2.0.1` on 2026-08-28, `3.0.0` on 2026-08-30), every consumer on `^3.0.0` (`ADR-037`). ⚠️ **A release is the only way an edit leaves this repo** ([ADR-047](./adr/ADR-047-a-common-change-ships-as-a-published-release.md)): an unpublished edit is dead weight to all 9 services, and `yarn install` in a consumer is authoritative — it resolves the version that consumer's `yarn.lock` names and can undo nothing. The `deploy-local.sh` sync this cell described until 2026-08-30 is deleted. ⚠️ This cell read *"Not on any npm registry"* until 2026-08-27. |
| `marketplace-db-setup` | migrate-mongo runner, no server | Applies immutable migrations (`migrations/`) built from `$jsonSchema` builders under `lib/schemas/` (`account.js`, `collection.js`, `geo.js`, `shopOwner.js`, `company.js`, `user.js`, `item.js`, `itemCategory.js`). `yarn migrate:up`/`migrate:status`/`migrate:down`. Every database that has run these migrations is the one place collection shape is defined — resource services never define their own schema. |
| `marketplace-services-status` | Node monitoring app, parent-tracked (`marketplace-services-status/package.json:2`, name `marketplace-services-status`) | Polls the 9 backend services' health; has no git repo of its own — tracked directly by this parent workspace repo, gated by the parent's own `.githooks/pre-commit` and `.githooks/pre-push` rather than a repo-local hook. |
| nginx | reverse proxy, TLS terminator, HTML cache — **written and tested, installed nowhere** | Configs at `marketplace-nginx/` in the workspace root: one vhost per hostname (`marketplace-domain.com`, `shopowner.`, `admin.`), plus `conf.d/` (upstreams, rate-limit zones, cache, TLS, hardening) and `snippets/` (the proxy/cookie rewrite and the two header policies). **No nginx binary and no `/etc/nginx` exist anywhere in this workspace or on this machine**, but `marketplace-nginx/test/run.sh` runs `nginx -t` and every behavioural assertion in `test/suite.sh` against a live nginx in a container, so these are executed rather than merely deployable. They carry the `proxy_cache` bypass-on-session-cookie rule, PMTiles range requests, the auth-path rate-limit zones, and — critically — `proxy_cookie_flags ~ secure httponly samesite=strict`, the only thing on the platform that sets `Secure` on the session cookie. |

---

## 4. Key communications

| From | To | Protocol | Data |
|---|---|---|---|
| Browser (Anon/User/ShopOwner/Admin) | nginx → frontend | HTTPS | static HTML/JS (SPA) or SSR HTML (`marketplace-user` public routes) |
| `marketplace-user` SSR server | `marketplace-dev-public-resource` (4027) | HTTP, GraphQL over `fetch`, direct — **bypasses nginx** | `PUBLIC_RESOURCE_URL` (deliberately not `VITE_`-prefixed), a **new urql client built per request** — a shared client would leak one visitor's cached response to the next |
| Any frontend | its tier's `*-authorization` service or `public-authorization` (4028) | GraphQL mutation (`login`/`loginAdmin`/`loginUser`, or refresh) over HTTPS | sets/reads the refresh-token cookie — Koa signed cookie, Keygrip SHA-512 over the shared Redis key record (ADR-034), httpOnly |
| Any frontend | its tier's `*-resource` service | GraphQL query/mutation over HTTPS | `Authorization: Bearer access:<token>` header, validated against Redis; `preferGetMethod: false` is load-bearing since urql sends no CSRF-preflight headers |
| All 3 frontends | `marketplace-dev-authenticated-logout` (4030) | GraphQL mutation `logout` | deletes the Redis session key by token content — no tier check, no tier-named mutation |
| Any `*-resource`/`*-authorization` service | MongoDB | Mongoose driver | reads/writes one or more of the 6 `$jsonSchema`-validated collections |
| Any `*-resource`/`*-authorization` service | Redis cluster | Redis client (`hGetAll`/`hSet`/`del` etc.) | opaque session hash under the shared `REDIS_KEY` prefix; `del` is one key per call — cluster mode throws `CROSSSLOT` on multi-key `del` |
| Any service | any other service (declared, not concretely traced) | `x-introspectioncode` header (`INTROSPECTION_CODE`) | bypasses the access-token check for service-to-service calls — treated as a secret, never logged, never sent to a browser (`docs/architecture.md` §Auth model) |
| `marketplace-common` (compile-time) | all 9 backend services | `yarn install` from `registry.npmjs.org`, at build time only | each consumer resolves `^3.0.0` through its own `yarn.lock`. ⚠️ **There is no filesystem sync**: `deploy-local.sh` copied `dist/` into every consumer's `node_modules` and is deleted ([ADR-047](./adr/ADR-047-a-common-change-ships-as-a-published-release.md)) — an edit here reaches a service only as a published version |
| `marketplace-db-setup` | MongoDB | migrate-mongo | `yarn migrate:up` applies migrations that define every collection's `$jsonSchema` |
| `marketplace-services-status` | all 9 backend services | HTTP health poll | no GraphQL — reads whatever health surface each service exposes |

---

## 5. Technology decisions

| Decision | Choice | ADR |
|---|---|---|
| Identity is the collection you authenticate against — no `role` field, no permission enum | `admin`/`shopOwner`/`user` are three separate collections, three separate service pairs | [`docs/devprotocol/phase3/adr/ADR-002-role-is-authentication-collection.md`](./adr/ADR-002-role-is-authentication-collection.md) |
| Every Redis session hash carries `tier`; every service asserts its own via `assertTier`, 403 not 401, missing tier is invalid not a wildcard | `BEs/marketplace-common/src/others/assertTier.mts` | [`docs/devprotocol/phase3/adr/ADR-004-per-tier-session-assertion.md`](./adr/ADR-004-per-tier-session-assertion.md) |
| One logout service for all three authenticated tiers, keyed by token content | `marketplace-dev-authenticated-logout`, port 4030 | [`docs/devprotocol/phase3/adr/ADR-005-single-logout-service-all-tiers.md`](./adr/ADR-005-single-logout-service-all-tiers.md) |
| Three `*-authenticated-authorization` services share their handler body via `marketplace-common@1.0.0` but stay three separate deployables, three ports | `resolveAuthorizationSession`/`findAccountForSession`/`refreshSessionTokens` in common; `TIER.*`, model, projection stay per-service | [`docs/devprotocol/phase3/adr/ADR-006-authorization-services-share-body-keep-deployables.md`](./adr/ADR-006-authorization-services-share-body-keep-deployables.md) — see §7 below |
| Catalogue is domain-neutral: one `item` + `itemCategory` pair, no per-product-type collection | presumes nothing about what is sold; a new product type must not reintroduce vocabulary that presumes one | [`docs/devprotocol/phase3/adr/ADR-008-domain-neutral-catalogue.md`](./adr/ADR-008-domain-neutral-catalogue.md) |
| No `price` field on `item`, permanently | Order/Cart/Delivery/Payment are permanently out of scope (ADR-038, 2026-08-27) — a price with nothing to buy is a guess, and nothing will ever arrive to settle it | [`docs/devprotocol/phase3/adr/ADR-009-no-price-on-item.md`](./adr/ADR-009-no-price-on-item.md) |
| English-only naming across code, routes, comments, fixtures and migrations | no exception anywhere; the `en-GB` locale and `english` text-index stemming are market choices, not names | [`docs/devprotocol/phase3/adr/ADR-013-english-only-naming.md`](./adr/ADR-013-english-only-naming.md) |
| Opaque tokens + Redis sessions, not JWT | despite a stale `JWT` type name in some `schema.graphql` slices | no dedicated ADR verified on disk — see [`docs/architecture.md`](../../architecture.md) §Auth model and CON-03 in [`docs/devprotocol/phase3/CONSTRAINTS.md`](./CONSTRAINTS.md) |
| Public routes SSR, `/account/*` `ssr: false` | pairs with a `proxy_cache` bypass on the session cookie — one security mechanism, two halves | no dedicated ADR verified on disk — see [`docs/frontends.md`](../../frontends.md) §marketplace-user and CON-10 in [`docs/devprotocol/phase3/CONSTRAINTS.md`](./CONSTRAINTS.md) |

---

## 6. Directory layout — where to add code

Verified on disk this session (`ls`, `find`, `grep`), not inferred.

```
fullstack-marketplace-blueprint/                 # parent workspace, its own git repo — tracks only workspace files
├── BEs/
│   ├── marketplace-common/                      # WHY: shared code consumed by npm PACKAGE NAME, not a path link —
│   │   ├── src/others/Tier.mts                   #      an edit here is invisible to all 9 services until a release carries it
│   │   ├── src/others/assertTier.mts
│   │   ├── src/others/resolveAuthorizationSession.mts
│   ├── marketplace-db-setup/                     # WHY: single source of every collection's $jsonSchema — migrations immutable
│   │   ├── lib/schemas/                           #      (account.js, collection.js, geo.js, shopOwner.js, company.js,
│   │   │                                          #       user.js, item.js, itemCategory.js) — builders, not the migrations themselves
│   │   └── migrations/                            #      one file per applied change, never edited after landing
│   └── dev/                                       # WHY: 9 independent git repos — tier × concern split, one deployable each
│       ├── marketplace-dev-public-authorization/
│       ├── marketplace-dev-public-resource/       #      the one service with a real @koa/router, src/middleware/router/
│       ├── marketplace-dev-authenticated-authorization/
│       ├── marketplace-dev-authenticated-resource/
│       ├── marketplace-dev-authenticated-logout/  #      the one service that serves all 3 tiers
│       ├── marketplace-dev-admin-authenticated-authorization/
│       ├── marketplace-dev-admin-authenticated-resource/
│       ├── marketplace-dev-user-authenticated-authorization/
│       ├── marketplace-dev-user-authenticated-resource/
│       └── upload-local/                          # NOT a repo — empty dir the *-resource services write uploads into
├── marketplace-admin/                             # WHY: separate deployable, separate Qodana project (VOZEg — was written 1rylx), Admin tier only
│   └── src/graphQLApi or src/gql/, src/routes/     # (per-repo CLAUDE.md/README.md/COVERAGE.md — read before editing)
├── marketplace-shopowner/                         # WHY: mirror of marketplace-admin, thinner — ShopOwner tier only
├── marketplace-user/                              # WHY: the only server-rendered surface — SSR/CSR split is a security boundary
│   ├── src/routeOptions/                          #      behaviour as router-free constants, testable without mounting a router
│   ├── serve.mjs                                  #      binds loopback only — the one deliberate exception on the platform
│   └── docs/nginx/README.md                       #      pointer only — the edge moved to marketplace-nginx/ at the workspace root
├── marketplace-services-status/                               # WHY: monitor with no repo of its own — tracked + gated by THIS parent repo
├── docs/
│   ├── decisions/                                 # ADRs referenced from CLAUDE.md prose (e.g. authorization-service-consolidation.md)
│   └── devprotocol/                               # this document set — phase1 (PDR/SYSTEM_CONTEXT/NFR), phase2 (UL/EventStorming/BoundedContext),
│       └── phase3/                                #   phase3 (this file + C4_CONTEXT.md + CONSTRAINTS.md + adr/)
└── CLAUDE.md                                       # authoritative project brief — read in full before any cross-repo change
```

### Where to add

| Change | Destination |
|---|---|
| New domain query/mutation for an existing tier | `BEs/dev/marketplace-dev-<tier>-resource/src/graphQLApi/schema/{queries,mutations}/` — **public-resource spells it `src/graphQLPublic/`, not `src/graphQLApi/`** |
| Token-lifecycle change (refresh/rotate) | the matching `*-authenticated-authorization` service only, or `marketplace-common`'s `resolveAuthorizationSession`/`refreshSessionTokens` if the change applies to all three |
| New shared Mongoose model or session helper | `BEs/marketplace-common/src/`, add its entry to `package.json` `exports` (no barrel export — an unlisted file is unreachable), then **publish a release** and move each consumer's range |
| New collection or schema change | `$jsonSchema` builder in `BEs/marketplace-db-setup/lib/schemas/<name>.js`, new migration under `migrations/`, then a full rebuild of every database that ran the migrations |
| New product type | model in `marketplace-common` → its `exports` entry → **published release** → migration in `marketplace-db-setup` → resolvers in the resource services → schema slice + codegen in the frontends that read it (`docs/data-model.md`) — but check first whether it is genuinely a new type or just an `item` with a different `idCategory` |
| Admin SPA screen | `marketplace-admin/src/` |
| ShopOwner SPA screen | `marketplace-shopowner/src/` |
| Public page or customer-account screen | `marketplace-user/src/routeOptions/` for behaviour, a one-line `createFileRoute(id)(options)` route file to wire it in |
| New ADR | `docs/devprotocol/phase3/adr/ADR-0NN-<slug>.md`, DevProtocol-numbered |

### Rules

- Services never import each other's `src/` directly. `marketplace-common` is the only shared import, and
  it is **installed from the registry**, never linked and never copied in — an edit is invisible until a
  release carries it and the consumer's range reaches that version (ADR-047).
- Resource services own every domain write; authorization services carry token-lifecycle code only. Put a
  new domain mutation in the wrong one and it is unreachable from the frontend that needs it.
- `itemCategory` writes exist **only** in `marketplace-dev-admin-authenticated-resource` — the depth-2 cap
  is enforced in that resolver, not in the `$jsonSchema`. Adding a write path anywhere else silently
  removes the cap.
- English only — domain names, UI text, routes, comments (CON-11). Tabs, not spaces, enforced by eslint
  and prettier together. Node `^24.18.0` with the caret kept, `yarn` everywhere.
- Never edit an applied migration under `BEs/marketplace-db-setup/migrations/` — add a new one.
- No `Shop` collection, ever — a shop *is* a `company` (CON-02). No `role` field or permission enum on any
  collection or session (CON-01).

---

## 7. Why the authorization/resource split, and why 3 authorization services stay 3

Two axes, not one. **Tier** (public / ShopOwner / Admin / User) answers *who*; **concern**
(authorization / resource) answers *what*. The concern axis is fixed platform-wide:
**authorization** = refresh-token cookie → Redis session lookup → mint/rotate tokens, no business
queries ever; **resource** = `Authorization: Bearer access:<token>` header → Redis lookup → serves
domain GraphQL, and only resource services carry `sharp`, `clamscan`, `file-type`, `graphql-upload`
(`docs/architecture.md` §Services). A new domain query belongs in a resource service; touching an
authorization service for anything but token lifecycle is out of scope by construction.

**The logout row breaks the pattern on purpose.** `marketplace-dev-authenticated-logout` (4030) is the
one deployable that serves all three tiers, because its resolver deletes the Redis key by **token
content** and never asks which collection minted it — tier-named logout mutations were evaluated and
rejected (`docs/devprotocol/phase3/adr/ADR-005-single-logout-service-all-tiers.md`). It is the exception
that proves the rule: everywhere else, tier and concern together select exactly one service.

**Why not merge the three `*-authenticated-authorization` services into one process?** Asked and answered
2026-08-07, decided against — full argument in [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md)
and [`docs/devprotocol/phase3/adr/ADR-006-authorization-services-share-body-keep-deployables.md`](./adr/ADR-006-authorization-services-share-body-keep-deployables.md), held as
CON-06 in [`docs/devprotocol/phase3/CONSTRAINTS.md`](./CONSTRAINTS.md). This document does not re-argue it, only states the
two load-bearing reasons so a reader does not reopen it as an obvious refactor:

- **Dispatching on a tier read out of a session is the exact pattern the platform's identity model
  rejects for `role`.** [`CLAUDE.md`](../../../CLAUDE.md) §Terminology: "role = which collection you authenticate against" —
  collapsing three tier-scoped processes into one that branches on a session field reintroduces the same
  shape one layer up.
- **One `process.exit(1)` for three tiers is an availability cost paid by customers**, not by the admin
  who caused it. A crash in the Admin-tier auth path would take down ShopOwner and User token refresh
  too, where three separate deployables fail independently.

**What did ship instead: dedupe the body, keep the deployables.** Since `marketplace-common@1.0.0`, the
session lookup, the account re-read and the token rotation are one shared implementation —
`resolveAuthorizationSession`, `findAccountForSession`, `refreshSessionTokens`
(`BEs/marketplace-common/src/others/resolveAuthorizationSession.mts`) — and each of the three services
supplies only its own `TIER.*` constant (`BEs/marketplace-common/src/others/Tier.mts`), its own Mongoose
model, and its own projection. The duplication that existed before is gone; the three ports, three
processes and three independent failure domains are not. Ports 4025 (Admin), 4029 (ShopOwner) and 4031
(User) stay distinct, verified this session against each repo's `env` template.
