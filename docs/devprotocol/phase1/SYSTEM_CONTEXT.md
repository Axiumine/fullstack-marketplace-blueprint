# System Context
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.3
**Date:** 2026-08-27
**Author:** system-context-agent
**Depends on:** PDR.md ✅
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree. No prior DEVPROTOCOL documents existed.
v1.3 - 2026-08-27: §5.12 and §5.13 both described a world that had moved. §5.12 replaces a three-repo sample and a *"4 repos still block on a missing token"* claim with all **fifteen** Cloud projects enumerated from each repo's scan artefact — ⚠️ including `marketplace-admin` = `VOZEg`, where this document and three others cite `1rylx` — and open question 4 closes on it: nothing stands on `SKIP_QODANA=1`. §5.13 rewritten after `ADR-037`: the package is published at `1.0.1`, so `deploy-local.sh` bridges *edited → released*, not *unpublished → published*, and a plain `yarn install` now silently undoes it. Open question 5 closes with it. Boundaries, actors and flows unchanged — only claims about them.
v1.1 - 2026-08-26: the stale "168 behavioural assertions" count replaced by a citation of `marketplace-nginx/test/suite.sh` itself. The number was stale by 67 — the suite ran 235 assertions before 2026-08-26 and 242 after — and a count written into prose goes stale silently every time an assertion is added. Nothing measured or decided changed.
v1.2 - 2026-08-26: the vendor's trading name removed from this document. It named a company in prose that is about roles, and the role words — platform vendor, platform operator, platform owner — say everything the name said. Nothing described, decided or scored changed.

---

## 1. Purpose

Names every external actor + system that crosses the Marketplace boundary, and states the contract each
crossing must honour. Internal impl (resolver layout, model shapes, repo-split rationale) lives in
[`CLAUDE.md`](../../../CLAUDE.md) + `docs/` and [`PDR.md`](./PDR.md), not here — this doc is boundary-only. Every claim below cites an on-disk path
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
│  marketplace-services-status (parent-tracked monitor, no repo of its own)           │
└───────────────────────────────────────────────────────────────────────────┘
```

16 git working trees total (`docs/workflow.md` §Repo layout), per
[`docs/devprotocol/phase1/PDR.md`](./PDR.md) §1, no `git` command run to re-verify (HARD RULE — never run git commands
in this doc's authoring). Outside the box above = external actor or system.

---

## 3. External actors

### 3.1 Human actors

|Actor|Code identity|Interaction with Marketplace|
|---|---|---|
|Anonymous visitor|no session|hits SSR public routes on `marketplace-user` — `/`, `/shops`, `/shop/:slug`, `/category/:slug` (`marketplace-user/CLAUDE.md` §Public is server-rendered) — GraphQL over `/public-resource`, no auth token|
|End customer|`User`, `user` collection|registers, confirms email via `GET /check/verify-email-user/:email/:hash`, logs in (`loginUser`), fills `personalData`, manages `addresses[]` + `defaultAddress` on `marketplace-user` `/account/*`. Cannot buy anything — `item.js:12-14` has no price field|
|Shop owner|`ShopOwner`, `shopOwner` collection|registers via `marketplace-shopowner`, awaits `waitApprov` from an `Admin`, manages own `company` document(s) and `item` catalogue under `Admin`-curated `itemCategory` values|
|Platform operator|`Admin`, `admin` collection|uses `marketplace-admin` — onboards/approves shop owners, exclusive write access to `itemCategory` (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemCategoryAdd.mts:14-17`)|
|Platform developer|no session — operates the repos, not the app|runs migrations (`yarn migrate:up`), runs `BEs/marketplace-common/deploy-local.sh` to sync built common into 9 services' `node_modules/`, commits/pushes 16 independent repos, provisions Qodana Cloud tokens and Mongo/Redis credentials outside this tree|

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
|Cloudflare Turnstile|bot-mitigation / CAPTCHA|browser → Cloudflare (widget script) **and** `marketplace-dev-public-resource` / `marketplace-dev-public-authorization` → Cloudflare `siteverify`|anti-bot token issued client-side, verified server-side over HTTPS; all three frontends render the widget on their login page|
|Protomaps PMTiles archive|static basemap tile source|`marketplace-user` browser ↔ nginx `/tiles/` (self-hosted static file)|vector map tiles via HTTP range requests — not a live 3rd-party tile server|
|nginx|reverse proxy / TLS terminator / HTML cache|internet ↔ nginx ↔ (`marketplace-user` SSR + all 9 backend services)|three vhosts at `marketplace-nginx/` in the workspace root, exercised by `marketplace-nginx/test/run.sh`; still installed on no host|
|Qodana Cloud (JetBrains)|static-analysis SaaS|every repo's `pre-commit`/`pre-push` hook → Qodana Cloud|SARIF-shaped scan report, one project + token per repo|
|npm registry (`registry.npmjs.org`)|package registry|`yarn install` in 9 services + 3 frontends → npm registry|resolves every dependency, `@axiumine/marketplace-common` included — published at `1.0.1` since 2026-08-26 (`ADR-037`), where this row recorded a 404|

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

    subgraph Edge["nginx — marketplace-nginx/, 3 vhosts, tested; installed on no host"]
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
    Owner -->|GraphQL + cookie| NG
    Op -->|GraphQL + cookie| NG
    NG --> FE_U
    NG --> FE_SO
    NG --> FE_AD
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
// BEs/marketplace-db-setup/migrations/20260301000200-create-company.js
'address.position': '2dsphere'
...
name: 'address.position_2dsphere'
```

`item` and `user.addresses[]` deliberately carry **no** `2dsphere` index — nothing queries either by
distance (`BEs/marketplace-db-setup/migrations/20260301000500-create-item.js`,
`BEs/marketplace-db-setup/migrations/20260301000300-create-user.js`).

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
# marketplace-nginx/sites-available/marketplace-domain.com.conf:217-225
location /geocode/ {
	limit_req zone=mkt_geocode burst=20 nodelay;
	proxy_pass http://mkt_nominatim/;
	proxy_cache       mkt_user_html;
	proxy_cache_valid 200 1h;
	proxy_cache_key   "$scheme$request_method$host$request_uri";
	add_header X-Cache-Status $upstream_cache_status always;
	include snippets/security-headers-public.conf;
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
# marketplace-nginx/sites-available/marketplace-domain.com.conf:102-110
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

Two separate crossings, not one. Browser loads Cloudflare's widget script directly — the same component
in all three frontends, each with its own copy:

```ts
// marketplace-user/src/components/ui/Turnstile.tsx  (also marketplace-admin, marketplace-shopowner)
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
```

`marketplace-dev-public-resource` (registration, resend, the customer reset pair) and
`marketplace-dev-public-authorization` (all three logins) verify the resulting token server-side, over
HTTPS, after rate limiting:

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
two guards of the same shape — `guardPublicWrite`
(`BEs/dev/marketplace-dev-public-resource/src/lib/access/guardPublicWrite.mts`) and `guardPublicLogin`
(`BEs/dev/marketplace-dev-public-authorization/src/lib/access/guardPublicLogin.mts`) — and in both cases
**after** the Redis rate-limit counters, so a tokenless flood never reaches the Cloudflare round trip.

⚠️ The CSP has to allow it on every surface that renders it: `challenges.cloudflare.com` in both
`script-src` and `frame-src`, in `marketplace-nginx/snippets/security-headers-public.conf` *and* in
`security-headers-private.conf`. `marketplace-nginx/test/suite.sh` asserts both entries on all nine header probes.

### 5.11 nginx — TLS termination + cache (written and tested, not installed)

⚠️ **Rewritten after the edge moved.** This section originally described four files under
`marketplace-user/docs/nginx/` covering the customer surface alone. Those files are deleted. The edge is
now `marketplace-nginx/` at the workspace root: one vhost per hostname — `marketplace-domain.com`,
`shopowner.marketplace-domain.com`, `admin.marketplace-domain.com` — sharing one upstream table, one
rate-limit file and one TLS file.

Still nothing installed on this machine (no `/etc/nginx`, no binary in `PATH`), but "documentation only"
now understates it: `marketplace-nginx/test/run.sh` runs the whole configuration in a throwaway container —
`nginx -t` as a hard gate, then every assertion in `test/suite.sh` through a live nginx against stand-in backends. The
directives below are executed, not merely written.

Upstream map, all loopback, now eleven rather than seven — the two panels' tiers were never in the old
file:

```conf
# marketplace-nginx/conf.d/10-upstreams.conf:24-56
upstream mkt_user_ssr { server 127.0.0.1:3045; keepalive 32; }

upstream mkt_public_resource { server 127.0.0.1:4027; keepalive 16; }
upstream mkt_public_authz    { server 127.0.0.1:4028; keepalive 16; }

upstream mkt_user_resource { server 127.0.0.1:4032; keepalive 16; }
upstream mkt_user_authz    { server 127.0.0.1:4031; keepalive 16; }

upstream mkt_owner_resource { server 127.0.0.1:4026; keepalive 16; }
upstream mkt_owner_authz    { server 127.0.0.1:4029; keepalive 16; }

upstream mkt_admin_resource { server 127.0.0.1:4024; keepalive 16; }
upstream mkt_admin_authz    { server 127.0.0.1:4025; keepalive 16; }

upstream mkt_logout { server 127.0.0.1:4030; keepalive 8; }

upstream mkt_nominatim { server 127.0.0.1:8080; keepalive 8; }
```

⚠️ The edge is also the only thing on the platform that sets `Secure` on the session cookie —
`proxy_cookie_flags ~ secure httponly samesite=strict;` in `marketplace-nginx/snippets/proxy-backend.conf`, included
at server level in all three vhosts. koa-utils ships `secure: false` with a comment saying to rewrite it
here. Nothing fails without nginx in front; the cookie simply goes out replayable over plain HTTP.

Cache-bypass decision is the session cookie, never parsed, only checked for presence — this is the other
half of the §5.1 mechanism:

```conf
# marketplace-nginx/conf.d/30-cache.conf:32-35
map $http_cookie $mkt_user_no_cache {
	default                            0;
	"~*(^|;\s*)refresh_token(\.sig)?=" 1;
}
```

⚠️ One map now, not two. The old pair — `$mkt_user_has_session`, then a second map relaying it into
`$mkt_user_no_cache` — was collapsed: `proxy_cache_bypass` and `proxy_no_cache` both read this one
variable, the request must skip the lookup **and** never be stored, and there is no case where one is
true and the other is not. Two maps were a place for those answers to drift apart. Anything still citing
`$mkt_user_has_session` is citing a variable that no longer exists.

~~Doc/impl gap: the apex vhost proxies `/api/register`, and no such route exists in
`marketplace-user/src/routes/`.~~ **Resolved by removing the block, not by building the route.** There
was a `location = /api/register` and a `location /api/`, both proxying to the SSR process under a 5r/m
`mkt_register` zone. No `/api/*` route has ever existed in `marketplace-user/src/routes/` — no server
route, no `createServerFn` — so every request there 404'd at the renderer and the zone metered nothing.

The route was **not** built, because the design it described is weaker than what already runs on both
counts it claimed. The Turnstile secret is server-side already and always was: `assertTurnstile` calls
Cloudflare from `marketplace-dev-public-resource`, so no verification moves closer to the user by adding
an SSR hop. And the rate limit is already stricter than an edge zone can be: `guardPublicWrite` spends
two Redis counters per hour, one keyed on `ctx.ip` and one keyed on **the email address**, before the
Turnstile round trip (§5.10). A `limit_req_zone` keyed on `$binary_remote_addr` never sees the address,
so it cannot stop a distributed source mail-bombing one inbox — the half that matters is the half nginx
cannot express. Building the route would have pushed plaintext passwords through a second Node process
(against ADR-018) to end up with less.

Registration therefore reaches the edge as a GraphQL POST to `/public-resource` alongside every other
public write, bounded there by `mkt_public` (120r/m), and metered properly one hop later. Both the apex
vhost and `marketplace-nginx/conf.d/20-rate-limit.conf` carry this reasoning in place of the deleted block, so it is
not re-added on the strength of the comment that used to describe it.

~~The admin-authenticated-authorization upstream (port 4025) is **absent** from every file under
`marketplace-user/docs/nginx/`.~~ **Resolved: it was never written, and now it is.** `mkt_admin_authz`
(4025) and `mkt_admin_resource` (4024) are in the upstream table above, proxied from
`admin.marketplace-domain.com` at `/admin-authenticated-authorization` and
`/admin-authenticated-resource`; `mkt_owner_authz` (4029) and `mkt_owner_resource` (4026) likewise from
`shopowner.marketplace-domain.com`. The old files described the customer surface only, which is why the
other two tiers looked missing rather than unwritten.

### 5.12 Marketplace repos → Qodana Cloud

One-directional outbound from every repo's `.githooks/pre-commit` and `.githooks/pre-push`. One Cloud
project + one `QODANA_TOKEN` per repo, never shared — a shared token interleaves two repos' baselines
(`docs/architecture.md` §Services, `README.md` §Linter version).

⚠️ **Enumerated from disk 2026-08-27, replacing a three-repo sample and a claim that four repos had no
project at all.** Fifteen code-shipping repos, fifteen distinct Cloud projects, each named by the
`.qodana/results/open-in-ide.json` that repo's last scan wrote:

|Repo|Cloud project|id|
|---|---|---|
|`marketplace-admin`|MP Admin|`VOZEg`|
|`marketplace-shopowner`|MP Shop Owner|`Ggoyw`|
|`marketplace-user`|MP User|`dXO5E`|
|`marketplace-services-status`|MP Service Status|`xPKXD`|
|`marketplace-common`|MP common|`b892b`|
|`marketplace-db-setup`|MP DB setup|`ObD0L`|
|`marketplace-dev-admin-authenticated-authorization`|MP Admin Authenticated Authorization|`YO2El`|
|`marketplace-dev-admin-authenticated-resource`|MP Admin Authenticated Resource|`qbKvd`|
|`marketplace-dev-authenticated-authorization`|MP Authenticated Authorization|`kwKvb`|
|`marketplace-dev-authenticated-resource`|MP Authenticated Resource|`9kVGN`|
|`marketplace-dev-authenticated-logout`|MP Authenticated Logout|`xPKvo`|
|`marketplace-dev-public-authorization`|MP Public Authorization|`YO522`|
|`marketplace-dev-public-resource`|MP Public Resource|`oDK2l`|
|`marketplace-dev-user-authenticated-authorization`|MP User Authenticated Authorization|`B5NEV`|
|`marketplace-dev-user-authenticated-resource`|MP User Authenticated Resources|`eobk1`|

`marketplace-admin` is `VOZEg`, not the `1rylx` this section and three other documents cite. No repo
stands on `SKIP_QODANA=1`; it is the one-shot operator bypass `README.md` describes, and the four repos
named here as blocked on a missing token are not (`PDR.md` §8 item 8, closed 2026-08-27). ⚠️ The
artefact records where the *last* scan uploaded, not live account state — a project deleted in the Cloud
UI would still read as present on disk.

### 5.13 `yarn install` → npm registry, and the gap `deploy-local.sh` bridges

`@axiumine/marketplace-common` is consumed as a package name by 9 services, and since 2026-08-26 it is
also published — `registry.npmjs.org`, version `1.0.1`, consumers on `^1.0.1`
([`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md), which supersedes the
publication half of `ADR-015`):

```json
// BEs/marketplace-common/package.json:2
"name": "@axiumine/marketplace-common",
```

⚠️ **Rewritten 2026-08-27.** This paragraph read *"`registry.npmjs.org` 404s on that name"* and called
the package the one dependency in the workspace that does not resolve. It resolves. The gap
`deploy-local.sh` bridges is no longer *unpublished → published* but *edited → released*:
`BEs/marketplace-common/deploy-local.sh` builds `dist/` and syncs it plus `package.json` straight into
each consumer's `node_modules/@axiumine/marketplace-common/`, discovered by globbing this workspace, so
an edit reaches all 9 services before any release carries it. Two consequences, and the second is new:
skipping the script after an edit leaves consumers compiling the previous build with no error at the
call site — and a plain `yarn install` in any consumer now *undoes* the script, resolving `^1.0.1` from
the registry and restoring the last released build over the local one, equally silently.

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
|A CDN in front of PMTiles or static assets|nginx serves `dist/client` and `/tiles/` straight off disk with immutable cache headers — no CDN wired (`marketplace-nginx/sites-available/marketplace-domain.com.conf:80-110`)|
|A live tile-serving backend|PMTiles is one static archive read via HTTP range requests, not a server (§5.9)|
|Any centralized log aggregator|only Sentry is wired for errors/traces; each vhost's `access_log`/`error_log` write to local files under `/var/log/nginx/`, one pair per hostname (`marketplace-nginx/sites-available/marketplace-domain.com.conf:74-75`), no shipping config found|

---

## 7. Open questions

|#|Question|Owner|Status|
|---|---|---|---|
|1|~~Does the `/api/register` SSR route that the apex vhost proxies get built, or does the block go?~~|platform owner|**closed — the block went.** Neither thing it claimed to add was missing: the Turnstile secret is already server-side and `guardPublicWrite` already limits per IP *and per email*, which no `$binary_remote_addr` zone can do. Both `location`s and the `mkt_register` zone are deleted, §5.11|
|2|~~Does an admin-facing nginx vhost exist for `marketplace-admin`/`marketplace-shopowner`?~~|platform owner / ops|**closed** — it did not exist and was never written. Both now do: `marketplace-nginx/sites-available/{admin,shopowner}.marketplace-domain.com.conf`, §5.11|
|3|Does MongoDB collection-level RBAC exist beneath the shared application connection, independent of the `assertTier` application check (§5.2)?|platform owner / DBA|open, explicitly not verified (`docs/decisions/authorization-service-consolidation.md` §Not verified)|
|4|~~Who creates the 4 missing Qodana Cloud projects (`marketplace-services-status`, `marketplace-user`, both `*-user-authenticated-*` services) so `SKIP_QODANA=1` can retire?~~|platform owner|**closed 2026-08-27 — they were never missing.** All four have their own project (`xPKXD`, `dXO5E`, `B5NEV`, `eobk1`), and `SKIP_QODANA=1` is the standing mode of no repo. Full enumeration in §5.12; `PDR.md` §8 item 8|
|5|~~Does `@axiumine/marketplace-common` ever get published to a real npm registry, retiring `deploy-local.sh` (§5.13)?~~|platform owner|**closed 2026-08-26 — published; `deploy-local.sh` stays.** `registry.npmjs.org` at `1.0.1`, consumers on `^1.0.1` ([`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md)). The second half of the question answered no: the script is what carries an edit that has not been released yet, so publication changed what it bridges rather than retiring it (§5.13). [`PDR.md`](./PDR.md) §8 item 5|
|6|Where do the 16 repos get published, and under which forge org?|platform owner|open, [`PDR.md`](./PDR.md) §8 item 1|
