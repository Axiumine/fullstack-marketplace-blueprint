# NFR — Non-Functional Requirements
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.0
**Date:** 2026-08-07
**Author:** nfr-agent
**Depends on:** PDR.md ✅ · SYSTEM_CONTEXT.md ✅
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree. No prior DEVPROTOCOL documents existed.

---

## 1. Purpose

NFRs = quality constraints, not features. How the 16-repo Marketplace platform behaves, not what it does. Public catalogue hit by anonymous traffic at scale → perf/security load-bearing. 4 auth tiers sharing one Redis key prefix → security boundary is one fn (`assertTier`), not four. Every package gated at 100% coverage + 100 mutation score → maintainability is enforced, not aspirational. Getting these wrong mid-project is expensive: an NFR here is downstream of `PDR.md` scope and `SYSTEM_CONTEXT.md` boundary contracts, and every Phase 3+ doc inherits it. Retrofit mode: every requirement below states what the codebase already enforces, cited to the file that enforces it — not a wishlist.

---

## 2. NFR catalogue

### 2.1 Performance

| ID | Requirement | Rationale |
|---|---|---|
| NFR-PF01 | Any geo query against `company.address.position` (`companiesNearby`, "shops near me") must resolve via `IXSCAN` on `address.position_2dsphere`, never `COLLSCAN` | Public catalogue read by anonymous traffic at scale — index built in `BEs/marketplace-db-setup/migrations/20260804010000-alter-company-public.js:90-97` (`name: 'address.position_2dsphere'`). Verify: `.explain()` on the query, expect `IXSCAN` in the winning plan |
| NFR-PF02 | `company` listing reads (`/shops`, `/shops/:city`) must not trigger a blocking in-memory SORT | `published_list` (`{published:1,deleted:1}`, `20260803000000-create-company.js`) answers the filter only; `published_publicName` and `published_city_publicName` (`{published,deleted,publicName}` / `{published,deleted,'address.city',publicName}`) append the sort key — `BEs/marketplace-db-setup/migrations/20260804040000-index-company-public-read.js:75-92`. A blocking SORT past 32 MB throws `QueryExceededMemoryLimitNoDiskUseAllowed`, not a slow query — this is a correctness boundary, not just a speed one |
| NFR-PF03 | `company.slug` lookup (`/shop/:slug`) must resolve via a unique index | `slug_unique`, partial on `{slug:{$type:'string'}}` — `BEs/marketplace-db-setup/migrations/20260804010000-alter-company-public.js:76-89` |
| NFR-PF04 | `item` catalogue reads (owner list, per-company slug lookup, published-by-company, published-by-category) must not COLLSCAN, and neither listing route may blocking-sort by name | `idCompany_list`, `idCompany_slug_unique` (`BEs/marketplace-db-setup/migrations/20260804030000-create-item.js:56-73`); the original 3-key `idCompany_published` / `idCategory_published` (same file, lines 75-93) were **dropped and replaced** by 4-key `idCompany_published_name` / `idCategory_published_name` in `BEs/marketplace-db-setup/migrations/20260804050000-index-item-listing-sort.js:46-64` once both listings needed a `name` sort key — measured 100 000 keys / 170 ms before vs 24 keys / 3 ms after on a 100 000-item category |
| NFR-PF05 | `item` and `company` free-text search must use the collection's one text index, never a `COLLSCAN` | `search_text` on `item` (`idCompany_slug_unique`'s sibling, weights `name:10, description:1`, `default_language:'english'` — `20260804030000-create-item.js`) and on `company` (weights `publicName:10, description:1` — `20260804040000-index-company-public-read.js:61-68`). Both are deliberately **not compound** — MongoDB requires an equality predicate on every non-text prefix key, which would foreclose the platform-wide search the customer app actually runs |
| NFR-PF06 | `itemCategory` reads (flat list, children-of-parent, both ordered) must be index-backed | `slug_unique` and `idParent_position` — `BEs/marketplace-db-setup/migrations/20260804020000-create-itemCategory.js:36-57` |
| NFR-PF07 | `user` login lookup must be index-backed | shared `login.email_unique` from `lib/schemas/account.js`'s `INDEXES_LOGIN_EMAIL`, applied in `BEs/marketplace-db-setup/migrations/20260804000000-create-user.js` |
| NFR-PF08 | SSR HTML for anonymous visitors must be servable from cache, bypassing the Node process on a repeat request | `proxy_cache mkt_user_html` zone, `proxy_cache_valid 200 1h` — `marketplace-nginx/conf.d/30-cache.conf`; bypass keyed on session-cookie presence (see NFR-SE09). Installed on no host, but no longer unverified: `marketplace-nginx/test/run.sh` drives MISS → HIT → BYPASS through a live nginx and asserts the session response is never stored (`docs/architecture.md` §nginx) |
| NFR-PF09 | Vector basemap tiles must be served as HTTP range requests against one static archive, never proxied through a live tile-serving process | `location /tiles/` with `Accept-Ranges: bytes` and `Cache-Control: public, max-age=604800` — `marketplace-nginx/sites-available/marketplace-domain.com.conf:102-110`; consumed via `maplibregl.addProtocol('pmtiles', new Protocol().tile)` — `marketplace-user/src/features/map/ShopMap.tsx:41-48` |

---

### 2.2 Availability

| ID | Requirement | Rationale |
|---|---|---|
| NFR-AV01 | The three `*-authenticated-authorization` services (`Admin`/`ShopOwner`/`User`) must remain three separate deployables, never merged into one process | Each `index.mts` calls `process.exit(1)` on any uncaught exception — one process is one crash domain per tier. Merging makes a single bug in the least-tested tier (Admin) take down authorization for all three — `docs/decisions/authorization-service-consolidation.md:88-89,113,154`. Decided against 2026-08-07; re-opening needs a fresh CR (`PDR.md` §9) |
| NFR-AV02 | Logout must remain the one deliberate exception: a single shared service (port 4030) serving all three tiers | Its `start()` connects Redis only — no MongoDB, so no tier-specific document to re-read — tier-blindness is what makes one service safe for three tiers where authorization cannot be: minting a token requires re-reading a tier-specific collection (`docs/decisions/authorization-service-consolidation.md:35-45`). All three frontends point at 4030 (`docs/architecture.md` §Services) |
| NFR-AV03 | Anti-bot verification (`assertTurnstile`) must fail **closed** in production when no secret is configured, and only there | `if (!secret) { if (process.env.NODE_ENV === 'production') throw throwForbiddenError(); return }` — `BEs/marketplace-common/src/others/assertTurnstile.mts:26,29-32`. A missing secret must read as "the gate is broken", not "the gate is off" |
| NFR-AV04 | Every backend service must bind the unspecified address (`::`), not a single interface, so the integration suites and any reachable host can hit it | `httpServer.listen({ port })` with no host — `docs/architecture.md` §Ports and binding, verified for all nine; `marketplace-user/serve.mjs` is the one deliberate exception and binds `127.0.0.1` because it has no auth of its own |
| NFR-AV05 | A push must never land code that fails lint, coverage, mutation, or a Qodana High/Critical finding | `.githooks/pre-push` runs `lint:check → test:cov → test:mutation → Qodana` in that order, in all 14 sub-repos that ship code (`docs/workflow.md` §Git hooks, `.githooks/pre-push` header comment — verified in `BEs/dev/marketplace-dev-user-authenticated-resource/.githooks/pre-push:3-6`). A missing prerequisite (docker, `qodana` CLI, `QODANA_TOKEN`) blocks and prints the fixing command; it never warns and continues |

---

### 2.3 Scalability

| ID | Requirement | Rationale |
|---|---|---|
| NFR-SC01 | `marketplace-user`'s address search must hit a self-hosted, nginx-cached Nominatim instance — never the public OSM API directly | A public site "sized for 500 000 registered customers does not [fit inside the] 1 req/s policy" OSM imposes — `marketplace-user/src/lib/nominatim.ts:8-18`; proxied at `location /geocode/` with `limit_req zone=mkt_geocode` and `proxy_cache_valid 200 1h` — `marketplace-nginx/sites-available/marketplace-domain.com.conf:217-225`. `marketplace-admin`/`marketplace-shopowner` call OSM directly because their traffic (a handful of operators) fits inside the same policy — `marketplace-admin/src/lib/nominatim.ts:17` |
| NFR-SC02 | Every public-facing write and auth path must be rate-limited per client, independent of app-layer logic | Eight `limit_req_zone` zones plus one `limit_conn_zone` — `marketplace-nginx/conf.d/20-rate-limit.conf`. Four are the customer surface's (`mkt_auth` 20r/m, `mkt_verify` 30r/m, `mkt_public` 120r/m, `mkt_geocode` 60r/m); four more arrived with the two panel vhosts (`mkt_owner_auth` 20r/m, `mkt_owner_api` 300r/m, `mkt_admin_auth` 10r/m, `mkt_admin_api` 300r/m). ⚠️ The panels get zones of their own because all three logins reach the same process on 4028 and the edge is the only layer that still knows which hostname was asked for — a shared zone would let a stuffing run against operator accounts spend the customers' allowance; `marketplace-nginx/test/suite.sh` asserts all three budgets separately. ⚠️ There is deliberately no registration zone. A ninth (`mkt_register`, 5r/m) existed against an `/api/register` location the application has never had and metered nothing; it was removed rather than repointed, because registration is a GraphQL POST with no URL of its own — it spends `mkt_public` at the edge and is then limited properly by `guardPublicWrite`, per IP **and per email address**, which a zone keyed on `$binary_remote_addr` cannot be (`SYSTEM_CONTEXT.md` §5.11). Turnstile verification (NFR-AV03) sits **behind** both Redis counters in `guardPublicWrite`, so a tokenless flood never reaches the Cloudflare round trip — `BEs/dev/marketplace-dev-public-resource/src/lib/access/guardPublicWrite.mts`. ⚠️ The three logins on 4028 carry the same shape through `guardPublicLogin`: per IP and per email an hour, 20/60 for `login` and `loginUser`, 10/30 for `loginAdmin`, then Turnstile. So the app layer, not only the edge, meters every auth path — `BEs/dev/marketplace-dev-public-authorization/src/lib/access/guardPublicLogin.mts` |
| NFR-SC03 | Session and rate-limit state must scale horizontally without a single-node bottleneck | Redis is deployed as a **cluster** — every consumer deletes one key per call rather than a multi-key `DEL`, which throws `CROSSSLOT` across cluster slots (`docs/testing.md` §Integration test conventions) |
| NFR-SC04 | Adding a fourth or fifth product-catalogue index-backed query must not require a schema migration for growth alone | `item`/`company`/`itemCategory` index sets (§2.1) are sized for collection growth, not fixed document counts — verified against a 100 000-document `item` category in `20260804050000-index-item-listing-sort.js` header comment |
| NFR-SC05 | Adding a fifth auth tier must cost one collection + one `TIER` value, never a shared dispatcher that couples tiers' scaling profiles together | `TIER` is 3 hardcoded strings — `BEs/marketplace-common/src/others/Tier.mts:12-16`; a dispatch-on-`tier` design (option (a)) was evaluated and rejected on doctrine grounds, not merely deferred — `docs/decisions/authorization-service-consolidation.md`, `PDR.md` §4 Out of scope |

---

### 2.4 Security

| ID | Requirement | Rationale |
|---|---|---|
| NFR-SE01 | Sessions must be opaque server-side tokens in Redis, never JWT | `docs/architecture.md` §Auth model: "Opaque tokens + Redis sessions. **Not JWT** (ADR-003), despite a stale `JWT` type in `schema.graphql`" |
| NFR-SE02 | Refresh token must travel as a Keygrip-signed httpOnly cookie | `Refresh token: Koa signed cookie (Keygrip SHA-512, KEYGRIP_KEY_1/2), httpOnly` — `docs/architecture.md` §Auth model |
| NFR-SE03 | Access token must be validated as `Authorization: Bearer access:<token>` against Redis on every resource-service call | `docs/architecture.md` §Auth model; call site `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:51-61` |
| NFR-SE04 | Passwords must be hashed with bcrypt, cost factor 14, never a lower/reversible scheme | `Passwords: bcrypt via @node-rs/bcrypt, SALT_ROUNDS=14` — `docs/architecture.md` §Auth model; stored as `$2y$14$…`, exactly 60 chars enforced by the `$jsonSchema` `minLength/maxLength: 60` |
| NFR-SE05 | Every session hash must carry a `tier`, and every service must assert its own before trusting `ctx.state.user` | `assertTier(actual, expected)` — `BEs/marketplace-common/src/others/assertTier.mts:21-23` (`if (actual !== expected) throw throwForbiddenError()`); a missing `tier` is **invalid, not a wildcard** — sessions minted before the field existed are rejected by the same `!==` branch with no carve-out (`docs/architecture.md` §Auth model) |
| NFR-SE06 | A foreign-tier token must be refused with **403**, never 401 | The caller authenticated correctly, just for a different tier — a 401 would tell the client to refresh, which cannot fix a tier mismatch. `throwForbiddenError()` in `assertTier.mts:23`; call site `authorizationAuthenticatedResourceHandler.mts:57` |
| NFR-SE07 | `loginUser` must refuse an account whose email is unconfirmed using the **same generic error** every other login failure returns | `docs/architecture.md` §Auth model: "`loginUser` refuses an account whose `emailVerify.valid` is false, returning the same generic error as every other failure so it cannot be used as an enumeration oracle" |
| NFR-SE08 | Service-to-service calls may bypass the user-session check only via a header matching a server-side secret, never sent to a browser | `x-introspectioncode` header checked against `INTROSPECTION_CODE`; `authorizationAuthenticatedResourceHandler.mts:27-37`. Treat as a secret — never logged, never exposed client-side (`docs/architecture.md` §Auth model). The bypass path leaves `ctx.state.user` unset rather than a stub session (`docs/decisions/authorization-service-consolidation.md` §As implemented) |
| NFR-SE09 | Authenticated HTML must never be rendered by the SSR process, and the HTML cache must bypass on session-cookie presence | `/account/*` sets `{ ssr: false as const, ... }` — `marketplace-user/src/routeOptions/account.tsx:59`; cache-bypass keyed on cookie presence, never parsed — `map $http_cookie $mkt_user_no_cache { default 0; "~*(^|;\s*)refresh_token(\.sig)?=" 1; }` — `marketplace-nginx/conf.d/30-cache.conf:32-35`, read by both `proxy_cache_bypass` and `proxy_no_cache` (the old relay map into `$mkt_user_has_session` is gone; one variable, so the two answers cannot drift). Weakening either half alone leaks one customer's page to another |
| NFR-SE10 | Every public frontend response must carry HSTS, a restrictive CSP, and cross-origin isolation headers | `Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Permissions-Policy` denying camera/mic/payment/usb — `marketplace-nginx/snippets/security-headers-public.conf:26-31`, with the CSP at `:56`. ⚠️ That CSP shipped as **no header at all** until it was fixed: written one directive per line with a trailing `\`, which nginx does not treat as a line-continuation inside a quoted string — the escape embeds a literal LF and the header is dropped while every sibling `add_header` keeps working. `marketplace-nginx/test/run.sh` asserts it now. The panels get a strictly tighter policy from `security-headers-private.conf` |
| NFR-SE11 | Every MongoDB collection must validate writes against a strict `$jsonSchema` with `additionalProperties: false` | Verified in `BEs/marketplace-db-setup/lib/schemas/item.js:94` (`additionalProperties: false`); same convention on all 6 collections (`docs/data-model.md`) |
| NFR-SE12 | No secret value (`.env`, `KEYGRIP_KEY_1/2`, `REDIS_PASSWORD`, `INTROSPECTION_CODE`, `MONGODB_URI`, `QODANA_TOKEN`, `SOCKETLABS_*`) may be read, echoed, or committed | Four layers: `permissions.deny` (`~/.claude/settings.json`), `no-secret-leak` PreToolUse hook (`~/.claude/hooks/no-secret-leak.cjs`), a `pre-commit` guard tracked at `.githooks/pre-commit` in all repos with `core.hooksPath=.githooks`, and `.gitignore` — `.claude/SECRETS.md:10,18,45,66,85` |

---

### 2.5 Portability

| ID | Requirement | Rationale |
|---|---|---|
| NFR-PO01 | Every repo with a `package.json` must declare `engines.node: "^24.18.0"`, and this must be a hard gate under yarn classic | Verified in `BEs/dev/marketplace-dev-user-authenticated-resource/package.json:30-31`; `docs/conventions.md` §Node and package manager — a mismatch is `exit 1` with `The engine "node" is incompatible with this module`, not a warning. `pre-push` selects the pinned version via nvm before shelling to yarn, in every repo (`docs/workflow.md` §Git hooks) |
| NFR-PO02 | Every backend service must be authored as ESM `.mts`, compiled to `.mjs`, never CommonJS | `docs/architecture.md` §Services: "Entry always `src/index.mts`. ESM (`.mts` → `.mjs`)" |
| NFR-PO03 | Every backend service must mount Apollo Server 5 on Koa 3 via `@as-integrations/koa`, at one GraphQL path per service | `docs/architecture.md` §Services — the one exception is `marketplace-dev-public-resource`, which also mounts a real `@koa/router` at `/check` for the three REST verify-email/health endpoints |
| NFR-PO04 | `marketplace-common` must remain buildable and consumable without a real npm publish | `BEs/marketplace-common/deploy-local.sh` builds `dist/` and syncs it plus `package.json` into every consumer's `node_modules/@axiumine/marketplace-common/` (`docs/workflow.md` §Repo layout); `registry.npmjs.org` 404s on that package name today |
| NFR-PO05 | Node version must be switchable per-repo without touching the machine default | `dev.sh` in each service bind-mounts `node_modules` onto a tmpfs ramdisk via nvm (`docs/workflow.md` §Commands) |

---

### 2.6 Maintainability

| ID | Requirement | Rationale |
|---|---|---|
| NFR-MA01 | Every package that ships code must sit at 100% coverage on all four metrics (statements/branches/functions/lines) | `thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }` — `BEs/dev/marketplace-dev-user-authenticated-resource/vitest.config.mts:43`. Applies to all 9 services, `marketplace-common`, `marketplace-db-setup`, the 3 frontends and `services-status` — 15 packages (`README.md` §Test quality gates) |
| NFR-MA02 | Every package must sit at a 100 mutation score (Stryker) | `thresholds: { high: 100, low: 95, break: 100 }` — `BEs/dev/marketplace-dev-user-authenticated-resource/stryker.config.mjs:47`. Coverage asks whether a line ran; mutation asks whether a wrong line would fail a test — they diverge badly: `marketplace-common` first scored 45.95%, `marketplace-db-setup` 52.92% while both sat at 100% coverage (`README.md` §The mutation layers) |
| NFR-MA03 | The coverage threshold must be enforced identically in Qodana's own config, not only in the test runner | `testCoverageThresholds: { total: 100, fresh: 100 }` — `BEs/dev/marketplace-dev-user-authenticated-resource/qodana.yaml:122-124` |
| NFR-MA04 | Coverage and mutation gates must block both `git commit` (scoped) and `git push` (unscoped) | `.githooks/pre-commit` runs `yarn test:cov` + Qodana on staged paths; `.githooks/pre-push` runs `test:cov → test:mutation → Qodana` unscoped, because a push can carry `--no-verify` commits and merge commits `pre-commit` never saw (`README.md` §Test quality gates — Qodana deliberately runs in **both** hooks) |
| NFR-MA05 | No threshold may ever be lowered to accommodate a failing gate — the fix is a test, never a config edit | `CLAUDE.md` §Rules that apply to every task: "**Never lower a coverage or mutation threshold, and never remove a gate.**" Reinforced per-service: `marketplace-db-setup`'s `vitest.config.mjs` comment: "Never lower these numbers. See COVERAGE.md" |
| NFR-MA06 | Every commit and push must pass `lint:check` (ESLint + Prettier, unwritten) and `tsc --noEmit` before coverage/mutation run | `.githooks/pre-push` header: `# 1. lint — eslint + prettier --check over the whole tree (yarn lint:check)` — `BEs/dev/marketplace-dev-user-authenticated-resource/.githooks/pre-push:3`; `marketplace-db-setup` is the one repo without a lint config, argued in its own hook header |
| NFR-MA07 | A vitest project declaring an `integration` suite with zero matching test files must be treated as a red flag, not a pass | `marketplace-dev-user-authenticated-resource` collected zero `*.itest.mts` and reported success at 100% coverage/100 mutation for its whole life until 2026-08-07 — `docs/testing.md` §Traps that make a green run lie. First real run found every customer address delete answering 500 (`Mongoose 9` array-update rejection + a pipeline-update ObjectId/string cast mismatch). **Count the test files, not the checkmarks** |
| NFR-CS01 | Indentation must be tabs, enforced by both ESLint and Prettier in agreement — never mixed enforcement | `indent: ['error','tab']` and `"useTabs": true` in the byte-identical `.prettierrc` across 13 linted repos; running only one used to reindent against the other (`docs/conventions.md` §Formatting) |
| NFR-CS02 | All identifiers, routes, UI text, comments, test fixtures and migrations must be English, with no exception | `CLAUDE.md` §Two naming rules, ADR-013, `UBIQUITOUS_LANGUAGE.md` §19. The `en-GB` date locale and the `english` stemming on the two text indexes are market choices, not names. Reintroducing vocabulary that presumes a specific product domain, or a non-English identifier, is a regression, not a style nit |
| NFR-CS03 | An `eslint.config.js` block added for a new file glob must resolve to the shared rule set, not silently lint zero rules | `npx eslint --print-config <file>` should report ~400 rules; a path matching no `files` glob checks nothing and exits 0 — this exact gap left every backend test file and vitest config unlinted until closed (`docs/conventions.md` §Lint scripts) |

---

### 2.7 Compliance

No formal compliance framework (GDPR, HIPAA, SOC2) is named anywhere in `CLAUDE.md`, `PDR.md` or `SYSTEM_CONTEXT.md` — not asserted here as a requirement, per the rule against inventing compliance scope. Two things are documented and load-bearing enough to record as requirements; one gap is logged rather than silently skipped.

| ID | Requirement | Rationale |
|---|---|---|
| NFR-CO01 | No secret or credential may appear in a terminal output, a tool result, or a committed file | Four enforcement layers, `.claude/SECRETS.md:10,18,45,66,85` (see NFR-SE12) — the closest thing this platform has to a compliance control today |
| NFR-CO02 | GDPR applicability is undecided, not ruled out | `user` and `shopOwner` store PII (name, address, email, phone) for an EU-market platform storing legal-entity identifiers (`vatNumber`, `taxCode`, `certifiedEmail`) — `BEs/marketplace-db-setup/lib/schemas/user.js`, `CLAUDE.md` §Two naming rules. No retention policy, data-subject-access flow, or lawful-basis documentation exists on this platform. **Logged as an open question (§ below), not asserted as in-scope** — inventing a compliance requirement the platform owner has not raised would violate the brownfield-retrofit rule against fabricating scope |

---

## 3. NFR priority matrix

| ID | Category | Priority | Negotiable? |
|---|---|---|---|
| NFR-SE01–SE09 | Security (auth/token/tier boundary) | 🔴 Critical | No — the whole platform shares one Redis key prefix; this is the entire fence |
| NFR-SE11, SE12 | Security (data validation, secrets) | 🔴 Critical | No |
| NFR-AV01, AV02 | Availability (deployable topology) | 🔴 Critical | No — decided against merging twice, 2026-08-07 (`docs/decisions/authorization-service-consolidation.md`) |
| NFR-MA01, MA02, MA05 | Maintainability (coverage/mutation/never-lower) | 🔴 Critical | No — enforced four times over, platform-wide |
| NFR-PF01, PF02 | Performance (geo + listing sort) | 🟠 High | No — public catalogue at anonymous scale; a regression here is a `QueryExceededMemoryLimitNoDiskUseAllowed` outage, not a slowdown |
| NFR-PF03–PF07 | Performance (remaining indexes) | 🟠 High | Yes, individually — a dropped index degrades one query path, not the platform |
| NFR-SC01, SC02 | Scalability (Nominatim topology, rate limits) | 🟠 High | No — the self-hosted/public split exists specifically because OSM's 1 req/s policy cannot be renegotiated |
| NFR-SC03 | Scalability (Redis cluster CROSSSLOT) | 🟠 High | No — a violation is a runtime exception, not a perf tradeoff |
| NFR-PO01 | Portability (Node engine gate) | 🟠 High | No — a mismatch is `exit 1` across 14 repos simultaneously |
| NFR-AV03–AV05 | Availability (fail-closed, wildcard bind, push gate) | 🟠 High | AV04 partial — `marketplace-user`'s loopback bind is a deliberate, documented exception |
| NFR-MA03, MA04, MA06, MA07 | Maintainability (gate wiring) | 🟠 High | No |
| NFR-CS01–CS03 | Maintainability (code style) | 🟡 Medium | CS02 (English-naming) is non-negotiable on doctrine grounds; CS01/CS03 are tooling hygiene |
| NFR-PF08, PF09 | Performance (nginx cache, PMTiles) | 🟡 Medium | Yes — documentation-only in this workspace today (no nginx installed); becomes 🟠 the day it is deployed |
| NFR-PO02–PO05 | Portability (module system, framework, build bridge) | 🟡 Medium | PO04 (deploy-local.sh) is High in practice — skipping it silently stales every consumer |
| NFR-SC04, SC05 | Scalability (schema/tier growth path) | 🟡 Medium | No — SC05 is doctrine (`PDR.md` §9 change control), not a preference |
| NFR-CO01 | Compliance (secrets) | 🔴 Critical | No |
| NFR-CO02 | Compliance (GDPR applicability) | 🟡 Medium | Yes — open question, not yet a requirement |

---

## 4. NFR change control

🔴 Critical → full team sign-off + a new `PDR.md` version before any change. Applies to the tier/token boundary (NFR-SE01–SE12), the three-deployable authorization topology (NFR-AV01, AV02), the 100/100 gate regime (NFR-MA01, MA02, MA05), and secret handling (NFR-CO01) — all five are doctrine positions recorded in `PDR.md` §9 Change control, not implementation defaults.

🟠 High → new ADR required. Applies to performance-critical indexes (NFR-PF01, PF02), the Nominatim/rate-limit topology (NFR-SC01–SC03), the Node engine gate (NFR-PO01), and gate-wiring requirements (NFR-AV03–AV05, MA03, MA04, MA06, MA07).

🟡 Medium → PR + one approver. Applies to remaining performance indexes, code-style requirements (NFR-CS01–CS03), portability details (NFR-PO02–PO05), documentation-only infra (NFR-PF08, PF09), and the schema/tier growth path (NFR-SC04, SC05).

Any NFR change must be reviewed against every Phase 3–5 document for downstream impact before it is accepted, per `RULES.md` §Phase gate rules — NFR sits at the top of that dependency chain.

---

## Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Is GDPR (or another data-protection framework) formally in scope, given `user`/`shopOwner` store EU-market PII with no documented retention or data-subject-access flow? (NFR-CO02) | platform owner | open |
| 2 | Who installs the nginx configs that carry NFR-PF08, PF09, SE09, SE10, SC01, SC02, and on what host — they live at `marketplace-nginx/` in the workspace root and are exercised by `marketplace-nginx/test/run.sh`, but there is no `/etc/nginx` anywhere in this workspace | platform owner / ops | open — carried from `PDR.md` §8 item 4; the configs are no longer the blocker, the topology decision is (`ADR-INDEX.md` §5) |
| 3 | Does MongoDB collection-level RBAC exist beneath the shared application connection, as a defense-in-depth layer under NFR-SE11? | platform owner / DBA | open, explicitly not verified — `docs/decisions/authorization-service-consolidation.md` §Not verified |
| 4 | 4 repos (`services-status`, `marketplace-user`, both `*-user-authenticated-*` services) have no Qodana Cloud project — NFR-MA03/MA04 run with `SKIP_QODANA=1` there today. Who provisions the missing projects? | platform owner | open — `PDR.md` §8 item 8 |
| 5 | Does a function-length cap or a documented comment policy exist for application code (beyond the caveman-style convention used in decision docs), or is code-style limited to the lint/format/naming rules in §2.6? | platform owner | open — not found in `CLAUDE.md`, not invented here |
