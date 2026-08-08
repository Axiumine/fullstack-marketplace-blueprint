# System Context
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.0
**Date:** 2026-08-07
**Author:** system-context-agent
**Depends on:** PDR.md ✅
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree. No prior DEVPROTOCOL documents existed.

---

## 1. Purpose

Names every external actor + system that crosses the Marketplace boundary, and states the contract each
crossing must honour. Internal impl (resolver layout, model shapes, repo-split rationale) lives in
`CLAUDE.md` + `docs/` and `PDR.md`, not here — this doc is boundary-only. Every claim below cites an on-disk path
verified this session; a path in backticks was opened, not guessed.

---

## 2. System boundary

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              MARKETPLACE                                  │
│                                                                           │
│  3 frontends          9 Koa+Apollo services       2 support pkgs        │
│  (admin/shopowner/    (public/shopOwner/admin/    (marketplace-common,  │
│   user SPA+SSR)        user × authz/resource       marketplace-db-setup)│
│                         + shared logout)                                │
│                                                                           │
│  services-status (parent-tracked monitor, no repo of its own)           │
└───────────────────────────────────────────────────────────────────────────┘
```

15 git working trees total (`docs/workflow.md` §Repo layout), per
`docs/devprotocol/phase1/PDR.md` §1, no `git` command run to re-verify (HARD RULE — never run git commands
in this doc's authoring). Outside the box above = external actor or system.

---

## 3. External actors

### 3.1 Human actors

|Actor|Code identity|Interaction with Marketplace|
|---|---|---|
|Anonymous visitor|no session|hits SSR public routes on `marketplace-user` — `/`, `/shops`, `/shop/:slug`, `/category/:slug` (`marketplace-user/CLAUDE.md` §Public is server-rendered) — GraphQL over `/public-resource`, no auth token|
|End customer|`User`, `user` collection|registers, confirms email via `GET /check/verify-email-user/:email/:hash`, logs in (`loginUser`), fills `personalData`, manages `addresses[]` + `defaultAddress` on `marketplace-user` `/account/*`. Cannot buy anything — `item.js:12-14` has no price field|
|Shop owner|`ShopOwner`, `shopOwner` collection|registers via `marketplace-shopowner`, awaits `waitApprov` from an `Admin`, manages own `company` row(s) and `item` catalogue under `Admin`-curated `itemCategory` values|
|Platform operator|`Admin`, `admin` collection|uses `marketplace-admin` — onboards/approves shop owners, exclusive write access to `itemCategory` (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemCategoryAdd.mts:14-17`)|
|Platform developer (thedoctorweb)|no session — operates the repos, not the app|runs migrations (`yarn migrate:up`), runs `BEs/marketplace-common/deploy-local.sh` to sync built common into 9 services' `node_modules/`, commits/pushes 15 independent repos, provisions Qodana Cloud tokens and Mongo/Redis credentials outside this tree|

No `role` field, no permission enum. Actor identity = which MongoDB collection the session authenticated
against (`CLAUDE.md` §Terminology). A 5th actor needs a 5th collection, never a role check.

### 3.2 External systems

|System|Type|Direction|What crosses the boundary|
|---|---|---|---|
|MongoDB|primary datastore|Marketplace ↔ MongoDB|6 collections read/written via Mongoose, `$jsonSchema` validated server-side|
|Redis (cluster)|session store + rate-limit counters|Marketplace ↔ Redis|opaque access/refresh token session hashes under shared `REDIS_KEY` prefix, per-IP/per-email rate counters|
|SocketLabs|transactional email API|Marketplace → SocketLabs|verify-email + reset-password links, sent via `@axiumine/koa-utils/email/SocketLabsLib`|
|Sentry|error/perf monitoring SaaS|Marketplace → Sentry|exception events + traces from every backend service and all 3 frontends, opt-in via DSN presence|
|Nominatim — self-hosted|geocoding API|`marketplace-user` browser → nginx `/geocode/` → on-prem Nominatim|address search-as-you-type, proxied, never public|
|Nominatim — public OSM|geocoding API|`marketplace-admin` / `marketplace-shopowner` browser → `nominatim.openstreetmap.org`|address search, low-volume internal-panel traffic only|
|Cloudflare Turnstile|bot-mitigation / CAPTCHA|browser → Cloudflare (widget script) **and** `marketplace-dev-public-resource` → Cloudflare `siteverify`|anti-bot token issued client-side, verified server-side over HTTPS|
|Protomaps PMTiles archive|static basemap tile source|`marketplace-user` browser ↔ nginx `/tiles/` (self-hosted static file)|vector map tiles via HTTP range requests — not a live 3rd-party tile server|
|nginx|reverse proxy / TLS terminator / HTML cache|internet ↔ nginx ↔ (`marketplace-user` SSR + all 9 backend services)|documentation-only in this workspace — configs exist, nothing installed here|
|Qodana Cloud (JetBrains)|static-analysis SaaS|every repo's `pre-commit`/`pre-push` hook → Qodana Cloud|SARIF-shaped scan report, one project + token per repo|
|npm registry (`registry.npmjs.org`)|package registry|`yarn install` in 9 services + 3 frontends → npm registry|resolves every dependency **except** `@thedoctorweb_agency/marketplace-common`, which 404s there|

---

## 4. Context diagram

```mermaid
graph TB
    subgraph Actors
        Anon[Anonymous visitor]
        Cust[User / customer]
        Owner[ShopOwner]
        Op[Admin / operator]
        Dev[Platform developer]
    end

    subgraph Edge["nginx — docs only, not installed here"]
        NG[TLS + HTML cache + rate limits]
    end

    subgraph Marketplace["MARKETPLACE"]
        FE_U[marketplace-user\nSSR + SPA account]
        FE_SO[marketplace-shopowner\nSPA]
        FE_AD[marketplace-admin\nSPA]
        SVC[9 Koa+Apollo services\npublic/shopOwner/admin/user\nx authz/resource + logout]
        COMMON[marketplace-common]
        DBSETUP[marketplace-db-setup]
    end

    Mongo[(MongoDB)]
    Redis[(Redis cluster)]
    Socket[SocketLabs]
    Sentry[Sentry]
    NomA[Nominatim self-hosted]
    NomB[nominatim.openstreetmap.org]
    Turn[Cloudflare Turnstile]
    PM[PMTiles archive - static]
    Qodana[Qodana Cloud]
    NPM[npm registry]

    Anon -->|GraphQL POST| NG
    Cust -->|GraphQL + cookie| NG
    Owner --> FE_SO
    Op --> FE_AD
    NG --> FE_U
    NG --> SVC
    FE_U -->|SSR direct, skips nginx| SVC
    FE_SO --> SVC
    FE_AD --> SVC

    SVC --> Mongo
    SVC --> Redis
    SVC --> Socket
    SVC --> Sentry
    SVC --> Turn
    FE_U --> Sentry
    FE_SO --> Sentry
    FE_AD --> Sentry
    FE_U --> NomA
    FE_SO --> NomB
    FE_AD --> NomB
    FE_U --> PM
    NG --> NomA

    Dev --> DBSETUP
    Dev --> COMMON
    COMMON -.deploy-local.sh, not npm.-> SVC
    Dev -->|yarn install, all others| NPM
    DBSETUP --> Mongo
    Dev --> Qodana
```

---

## 5. Key interface contracts

### 5.1 Browser ↔ SSR / SPA — the `ssr:false` trust boundary

Public routes render on the server; `/account/*` never does — `marketplace-user/src/routeOptions/account.tsx:59`
sets `{ ssr: false as const, ... }`. Rule: **no authenticated HTML may ever leave the SSR process.**
`marketplace-user/src/api/ssr.ts:44-52` builds one urql `Client` per request, no `cacheExchange`, no
`authExchange`, so a visitor's response can never leak to the next. This pairs with the nginx cache
bypass in §5.11 — weakening either alone leaks one customer's page to another.

### 5.2 Access-token trust boundary — shared `REDIS_KEY`, fenced by `assertTier`

All 9 services read Redis sessions under **one** `REDIS_KEY` prefix on purpose — the shared `/logout`
service (port 4030) deletes a session by token content and never asks which collection minted it
(`docs/architecture.md` §Auth model). Consequence: any session hash is *findable* by any service, so
`assertTier(actual, expected)` is the entire boundary:

```ts
// BEs/marketplace-common/src/others/assertTier.mts:21-23
export function assertTier(actual: string | undefined, expected: Tier): void {
	if (actual !== expected) throw throwForbiddenError()
}
```

Missing `tier` = invalid, never a wildcard. Mismatch = **403**, never 401 — caller authenticated
correctly, just not for this tier. Call site, admin resource service:

```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:51-61
const redAccessSession = await redisClient.hGetAll(`${process.env.REDIS_KEY}${accessToken}`)
if (redAccessSession != null && Object.keys(redAccessSession).length !== 0) {
	const redData = { ...redAccessSession } as unknown as IRedisDataAdmin
	assertTier(redData.tier, TIER.admin)
	ctx.state.user = makeAuthCtx(redData)
} else throwAccessTokenExpiredOrDeleted()
```

`TIER` is 3 hardcoded string values, `BEs/marketplace-common/src/others/Tier.mts:12-16` — `admin` /
`shopOwner` / `user`. A 4th tier costs a 4th collection + 4th value, never a dispatch table
(`docs/decisions/authorization-service-consolidation.md` §Why logout can be one service and authorization
cannot).

### 5.3 Service-to-service bypass — `x-introspectioncode`

Same handler that enforces §5.2 also honours a header bypass for internal calls with no user session at
all:

```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:27-37
if (typeof authorization === 'undefined') {
	if (ctx.request.header['x-introspectioncode'] === `${process.env.INTROSPECTION_CODE}`) {
		introspection = true
	} else { throw throwPreconditionFailedNoAuthHeader() }
}
```

Treat `INTROSPECTION_CODE` as a secret — never logged, never sent to a browser client (`docs/architecture.md` §Auth model). Bypass leaves `ctx.state.user` unset: `resolveAuthorizationSession` returns `null` on this path
rather than a stub session (`docs/decisions/authorization-service-consolidation.md` §As implemented).

### 5.4 Marketplace ↔ MongoDB

Direction: bidirectional, internal only — no external actor ever reaches Mongo directly. 6 collections,
`$jsonSchema` + `additionalProperties: false` on every one. Geo index that public search depends on:

```js
// BEs/marketplace-db-setup/migrations/20260804010000-alter-company-public.js:92-95
'address.position': '2dsphere'
...
name: 'address.position_2dsphere'
```

`item` and `user.addresses[]` deliberately carry **no** `2dsphere` index — nothing queries either by
distance (`BEs/marketplace-db-setup/migrations/20260804030000-create-item.js:42-44`,
`BEs/marketplace-db-setup/migrations/20260804000000-create-user.js:28`).

### 5.5 Marketplace ↔ Redis (cluster)

Direction: bidirectional, internal only. Two payload classes cross this line: opaque session hashes
(access/refresh tokens, keyed `<REDIS_KEY><token>`) and rate-limit counters (`guardPublicWrite`, see
§5.10). Redis is a **cluster** — a multi-key `DEL` throws `CROSSSLOT`; every consumer deletes one key per
call (`docs/testing.md` §Integration test conventions).

### 5.6 Marketplace → SocketLabs (transactional email)

One-directional outbound, `marketplace-dev-public-resource` only. Two link families, deliberately two
routes and two domains rather than one shared handler:

```ts
// BEs/dev/marketplace-dev-public-resource/src/lib/access/sendUserVerifyEmail.mts:1,11,27-29
import { SocketLabsLib } from '@axiumine/koa-utils/email/SocketLabsLib'
export const USER_VERIFY_LINK_PATH = '/check/verify-email-user'
export async function sendUserVerifyEmail(email: string, hash: string) {
	const SocketLabsObj = new SocketLabsLib()
	await SocketLabsObj.sendEmailVerify(email, hash, '', process.env.APP_DOMAIN_USER, USER_VERIFY_LINK_PATH)
}
```

`APP_DOMAIN_USER` (customer domain) vs `APP_DOMAIN` (shop-owner domain) — one process serves both
audiences and must send each link to the right host, or the click 404s. Env keys carrying the credential:
`SOCKETLABS_SERVER_ID`, `SOCKETLABS_SERVER_APIKEY`, `EMAIL_FROM`, `DEV_TEAM_EMAIL` (verified present as
key names in `BEs/dev/marketplace-dev-public-resource/env` — values never read, per HARD RULE 10).

### 5.7 Marketplace → Sentry

One-directional outbound, opt-in. Backend: `@sentry/node`, DSN from `process.env.DSN` —
`BEs/dev/marketplace-dev-public-resource/src/instrument.mts:3,17-18`. Frontend: `@sentry/react`, gated on
a non-empty DSN so a developer machine or CI reports nothing:

```ts
// marketplace-user/src/instrument.ts:30-47
if (env.sentryDsn !== '') {
	Sentry.init({ dsn: env.sentryDsn, environment: env.sentryEnvironment,
		dataCollection: { userInfo: false, cookies: false, httpHeaders: {...}, httpBodies: [],
			urlQueryParams: false, graphQL: {...}, stackFrameVariables: false, frameContextLines: 7 },
		tracesSampleRate: 0.1 })
}
```

Every `dataCollection` category is explicitly listed and mostly `false` — the app handles customer
passwords, and a partial block would leak more than the single line it replaced (comment,
`marketplace-user/src/instrument.ts:15-20`).

### 5.8 Marketplace ↔ Nominatim — two different topologies, not a copy-paste

`marketplace-user` calls a **self-hosted** instance, proxied by nginx and never exposed to the internet:

```
# marketplace-user/src/lib/nominatim.ts:8-18 (comment)
That one calls https://nominatim.openstreetmap.org directly ... A public site sized for 500 000
registered customers does not [fit inside the 1 req/s policy] ... VITE_NOMINATIM_URL points at the
local instance ... default is the root-relative /nominatim, so the request is same-origin
```

```conf
# marketplace-user/docs/nginx/marketplace-user.conf:187-195
location /geocode/ {
	limit_req zone=mkt_geocode burst=20 nodelay;
	proxy_pass http://mkt_nominatim/;
	proxy_cache mkt_user_html;
	proxy_cache_valid 200 1h;
}
```

`marketplace-admin` and `marketplace-shopowner` call the **public** OSM instance directly:

```ts
// marketplace-admin/src/lib/nominatim.ts:17
const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
```

Justification is traffic scale, not oversight: two internal panels, a handful of operators, fit inside
OSM's 1 req/s policy; the public customer surface does not (same comment block above).

### 5.9 Marketplace ↔ Protomaps PMTiles archive

Not a live tile server — one static `.pmtiles` file, served by nginx with byte-range support, read by
MapLibre GL via a browser-registered protocol handler:

```ts
// marketplace-user/src/features/map/ShopMap.tsx:41-48
let protocolRegistered = false
const registerPmtilesProtocol = () => {
	if (protocolRegistered) return
	maplibregl.addProtocol('pmtiles', new Protocol().tile)
	protocolRegistered = true
}
```

```conf
# marketplace-user/docs/nginx/marketplace-user.conf:102-110
location /tiles/ {
	alias /srv/marketplace-user/tiles/;
	add_header Accept-Ranges "bytes" always;
	add_header Cache-Control "public, max-age=604800" always;
}
```

`ShopMap.tsx` is reachable **only** through a dynamic import (`marketplace-user/CLAUDE.md` §The map is an
island) — statically importing it breaks SSR, since MapLibre touches `window`/WebGL at module scope, and
would put ~950 KB in every catalogue page's entry chunk.

### 5.10 Browser ↔ Cloudflare Turnstile, and Marketplace → Cloudflare `siteverify`

Two separate crossings, not one. Browser loads Cloudflare's widget script directly:

```ts
// marketplace-user/src/components/ui/Turnstile.tsx:22
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
```

`marketplace-dev-public-resource` verifies the resulting token server-side, over HTTPS, before rate
limiting:

```ts
// BEs/marketplace-common/src/others/assertTurnstile.mts:3,26,29-32
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
export async function assertTurnstile(token: string | undefined, remoteIp?: string) {
	const secret = process.env.TURNSTILE_SECRET
	if (!secret) {
		if (process.env.NODE_ENV === 'production') throw throwForbiddenError()
		return
	}
	...
```

Fails **closed** in production with no secret configured, bypasses everywhere else — a missing secret
reads as "the gate is broken", not "the gate is off" (comment, `assertTurnstile.mts:14-20`). Called from
`guardPublicWrite` (`BEs/dev/marketplace-dev-public-resource/src/lib/access/guardPublicWrite.mts:43-50`),
**after** the Redis rate-limit counter, so a tokenless flood never reaches the Cloudflare round trip.

### 5.11 nginx — TLS termination + cache (documentation only)

Configs exist and are deployable, nothing installed anywhere in this workspace or on this machine —
`marketplace-user/docs/nginx/{cache.conf,marketplace-user.conf,rate-limit.conf,security-headers.conf}`.
Upstream map, all loopback:

```conf
# marketplace-user/docs/nginx/cache.conf:36-42
upstream mkt_user_ssr        { server 127.0.0.1:3045; keepalive 32; }
upstream mkt_public_resource { server 127.0.0.1:4027; keepalive 16; }
upstream mkt_public_authz    { server 127.0.0.1:4028; keepalive 16; }
upstream mkt_user_authz      { server 127.0.0.1:4031; keepalive 16; }
upstream mkt_user_resource   { server 127.0.0.1:4032; keepalive 16; }
upstream mkt_logout          { server 127.0.0.1:4030; keepalive 8;  }
upstream mkt_nominatim       { server 127.0.0.1:8080; keepalive 8;  }
```

Cache-bypass decision is the session cookie, never parsed, only checked for presence — this is the other
half of the §5.1 mechanism:

```conf
# marketplace-user/docs/nginx/cache.conf:21-30
map $http_cookie $mkt_user_has_session {
	default 0;
	"~*(^|;\s*)refresh_token(\.sig)?="  1;
}
map $mkt_user_has_session $mkt_user_no_cache { 0 0; 1 1; }
```

⚠️ Doc/impl gap found this session: `marketplace-user.conf:173-176` documents a proxied `/api/register`
route ("the server route verifies the Turnstile token, then forwards to the userRegister mutation") that
does not exist in `marketplace-user/src/routes/` — no server route or `createServerFn` matching
`api/register` was found. Actual registration path is client → GraphQL `userRegister` straight to
`/public-resource`, verified server-side by `guardPublicWrite`/`assertTurnstile` in the resource service
itself (§5.10). Log as open question — see §7.

The admin-authenticated-authorization upstream (port 4025) is **absent** from every file under
`marketplace-user/docs/nginx/` — expected, since that traffic belongs to `marketplace-admin`, not this
app; whether an equivalent vhost exists for the two SPA frontends is unconfirmed
(`docs/decisions/authorization-service-consolidation.md` §Not verified).

### 5.12 Marketplace repos → Qodana Cloud

One-directional outbound from every repo's `.githooks/pre-commit` and `.githooks/pre-push`. One Cloud
project + one `QODANA_TOKEN` per repo, never shared — a shared token interleaves two repos' baselines
(`docs/architecture.md` §Services, `README.md` §Linter version). Verified project ids:
`marketplace-admin` = `1rylx` (`docs/frontends.md`), `services-status` = `xPKXD` (`docs/frontends.md` §services-status),
`marketplace-db-setup` = `ObD0L` (`README.md:233`). 4 repos still block on a missing token —
`services-status`, `marketplace-user`, both `*-user-authenticated-*` services — bypassed today with
`SKIP_QODANA=1` (`PDR.md` §8, open question 8).

### 5.13 `yarn install` → npm registry, and the gap `deploy-local.sh` bridges

`@thedoctorweb_agency/marketplace-common` is consumed as a package name by 9 services but is not
published:

```json
// BEs/marketplace-common/package.json:2
"name": "@thedoctorweb_agency/marketplace-common",
```

`registry.npmjs.org` 404s on that name (`docs/workflow.md` §Repo layout). Every other dependency of every repo
here resolves normally against the real registry — this is the one exception, and it is bridged locally,
not fixed: `BEs/marketplace-common/deploy-local.sh` builds `dist/` and syncs it plus `package.json`
straight into each consumer's `node_modules/@thedoctorweb_agency/marketplace-common/`, discovered by
globbing this workspace. Skipping it after an edit leaves consumers compiling the previous build with no
error at the call site.

### 5.14 Data flow summary

|Flow|Direction|Protocol|Payload class|
|---|---|---|---|
|Anonymous/User browser ↔ Marketplace|in/out|HTTP(S), GraphQL POST (8/9 services) + 3 REST `GET /check/*` routes|catalogue reads, account writes, auth tokens|
|`marketplace-user` SSR process → `marketplace-dev-public-resource`|out then in|HTTP, GraphQL POST, loopback, skips nginx|public catalogue data for server-rendered HTML|
|Marketplace services ↔ MongoDB|bidirectional|MongoDB wire protocol|persisted domain documents, `$jsonSchema` validated|
|Marketplace services ↔ Redis|bidirectional|RESP, cluster mode|session hashes, rate-limit counters|
|`marketplace-dev-public-resource` → SocketLabs|out|HTTPS API call|verify-email / reset-password send requests|
|Backend services + all 3 frontends → Sentry|out|HTTPS, Sentry SDK transport|exception events, sampled traces (10%)|
|`marketplace-user` browser → self-hosted Nominatim (via nginx)|out then in|HTTP, proxied, cached 1h|address search queries/results|
|`marketplace-admin`/`marketplace-shopowner` browser → OSM Nominatim|out then in|HTTPS, direct|address search queries/results|
|`marketplace-user` browser → PMTiles archive (via nginx)|in|HTTP range requests|vector map tile bytes|
|`marketplace-user` browser ↔ Cloudflare Turnstile|bidirectional|HTTPS, widget script + token|anti-bot challenge/response|
|`marketplace-dev-public-resource` → Cloudflare `siteverify`|out then in|HTTPS POST|token verification result|
|Every repo's hook → Qodana Cloud|out|Qodana CLI over HTTPS|static-analysis SARIF-shaped report|
|`yarn install`/`deploy-local.sh` → npm registry / local `node_modules`|in|HTTPS (registry) / filesystem copy (common)|package tarballs / built `dist/`|

---

## 6. What Marketplace does NOT touch

|System|Reason excluded|
|---|---|
|Cart, order, delivery, payment provider|no collection, no resolver, no design anywhere on the platform — `item.js:12-14` has no price field for exactly this reason (`CLAUDE.md` §Build state, `PDR.md` §4 Out of scope)|
|A payment gateway (Stripe/PayPal/etc.)|downstream of the missing order model — cannot be designed before it|
|GitHub / any git forge|no forge account is wired to this workspace; where/under which org the repos get published is the platform owner's open call (§7 q6)|
|A separate shop / point-of-sale collection|will not exist — a shop **is** a `company` (`CLAUDE.md` §Terminology, stated twice as a thing not to re-propose)|
|A CDN in front of PMTiles or static assets|nginx serves `dist/client` and `/tiles/` straight off disk with immutable cache headers — no CDN wired (`marketplace-user.conf:80-95`)|
|A live tile-serving backend|PMTiles is one static archive read via HTTP range requests, not a server (§5.9)|
|Any centralized log aggregator|only Sentry is wired for errors/traces; nginx `access_log`/`error_log` write to local files (`marketplace-user.conf:60-61`), no shipping config found|

---

## 7. Open questions

|#|Question|Owner|Status|
|---|---|---|---|
|1|`marketplace-user.conf:173-176` documents a proxied `/api/register` SSR route that does not exist in `src/routes/` or as a `createServerFn` — is the nginx doc stale, or is the route unimplemented?|platform owner|open — found this session, §5.11|
|2|Does an admin-facing nginx vhost exist for `marketplace-admin`/`marketplace-shopowner`, given port 4025 (admin authorization) is absent from every file in `marketplace-user/docs/nginx/`?|platform owner / ops|open, carried from `docs/decisions/authorization-service-consolidation.md` §Follow-ups|
|3|Does MongoDB collection-level RBAC exist beneath the shared application connection, independent of the `assertTier` application check (§5.2)?|platform owner / DBA|open, explicitly not verified (`docs/decisions/authorization-service-consolidation.md` §Not verified)|
|4|Who creates the 4 missing Qodana Cloud projects (`services-status`, `marketplace-user`, both `*-user-authenticated-*` services) so `SKIP_QODANA=1` can retire?|platform owner|open, `PDR.md` §8 item 8|
|5|Does `@thedoctorweb_agency/marketplace-common` ever get published to a real npm registry, retiring `deploy-local.sh` (§5.13)?|platform owner|open, `PDR.md` §8 item 5|
|6|Where do the 15 repos get published, and under which forge org?|platform owner|open, `PDR.md` §8 item 1|
