# ADR-018 — Public routes render on the server, /account/* never does, and the cache bypasses on the session cookie
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`marketplace-user` (port 3045) is the only server-rendered app on the platform — TanStack Start, Vite 8, React 19. It carries two halves in one codebase: an anonymous catalogue meant to be indexed (`/`, `/shops`, `/shop/:slug`, `/category/:slug`, `/search`) and a private account area (`/login`, `/register`, `/reset-password*`, `/account/*`) where a `User` reads and edits personal data and addresses. No order, cart, delivery or payment exists to render — out of scope, `docs/devprotocol/phase3/CONSTRAINTS.md` §5.

The SSR process sits behind a shared nginx layer with `proxy_cache` (`marketplace-user/docs/nginx/cache.conf`). A cache exists to serve the same bytes to many visitors — that is its entire value, and it is also the entire danger the moment a page contains one visitor's own data. Auth on this platform is opaque tokens + Redis sessions (`docs/architecture.md` §Auth model): the refresh token is a Keygrip-signed httpOnly cookie scoped to API paths, the access token lives in browser memory only. The SSR pass runs on the server and holds neither.

Two failure modes are live at once: (1) server-rendering a page built from `me`/personal-data/addresses caches that HTML and can serve customer A's data to customer B on the next cache hit; (2) even without caching, the SSR pass cannot authenticate — it has no access token to attach, so a would-be SSR'd private page would just 401.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| SSR everywhere, rely on `Cache-Control: private` / no-cache headers per response | One rendering mode, simpler mental model, best possible SEO/TTFB for account pages if they ever needed indexing (they don't) | One misconfigured header or a nginx directive override caches authenticated HTML — a header is advisory, easy to get wrong once and catastrophic when wrong; SSR still can't authenticate anyway since the access token isn't in server-reachable storage; zero SEO benefit for pages that must never be indexed |
| CSR everywhere (drop SSR for the catalogue too) | Removes the whole SSR/cache-poisoning class of bug, one rendering mode | Kills the actual reason this app exists server-rendered: `phase1/PDR.md` "In scope — Public SSR surface", anonymous catalogue needs to be crawlable and fast on first paint; throws away the win to avoid a risk that only applies to the private half |
| Split by route: public catalogue SSR, `/account/*` subtree forced `ssr: false`, paired with a cache bypass keyed on the session cookie | Shell with no data cannot leak whatever the cache does; SSR is only attempted where the server can actually answer the query (public-resource data needs no user auth); indexable surface stays server-rendered for SEO; the bypass is enforced upstream of the app so it holds even if a route forgets its own flag | Two rendering modes to keep straight; the safety property depends on **both** halves staying in sync — weakening either alone (turning SSR back on for one account route, or loosening the cookie-bypass regex) reopens the leak; no correctness signal if someone edits one half without the other |

## Decision

Chose the third option: `ssr: false` on the `/account` layout route (`marketplace-user/src/routeOptions/account.tsx:59`, inherited by every child under it — `account.addresses.tsx`, `account.password.tsx`, `account.index.tsx`), paired with the nginx bypass in `marketplace-user/docs/nginx/cache.conf:21-30`, which sets `$mkt_user_no_cache = 1` whenever `$http_cookie` matches `refresh_token` or `refresh_token.sig`.

Reasoning stated at the route itself (`account.tsx:11-28`), in order of how badly each one bites:

1. **Cache poisoning is the sharpest failure.** Public HTML is cached by nginx and handed to whoever asks next. Rendering one customer's name and addresses into that HTML is one missing `Vary` away from leaking to a different visitor. A shell with no data in it cannot leak, whatever the cache does — this is why the fix is "don't render the data" rather than "cache it correctly."
2. **The server literally cannot answer the query.** The access token lives in browser memory; the refresh cookie is httpOnly and scoped to API paths. SSR holds neither, so an SSR'd `me` query 401s on every request — "server-rendered" would mean "server-rendered error state."
3. **Zero SEO upside.** Nothing under `/account` should ever be indexed, so SSR's only remaining justification is absent. `noIndex` plus `robots.txt` disallowing the prefix (`marketplace-user/src/routes/robots[.]txt.ts:9`) back this up independently of the rendering mode, because the two protections fail differently.

The nginx side never parses the cookie's content, only its presence — the comment at `cache.conf:17-19` is explicit that presence of `refresh_token` or `refresh_token.sig` is read as "this visitor has a session," full stop. That is deliberate: correctness here should not depend on nginx understanding Keygrip signing.

## Consequences

### Positive
- Cache poisoning of personal data is structurally prevented at two independent layers (route flag + cookie bypass) rather than one.
- The public catalogue keeps full SSR — fast first paint, crawlable, matches `phase1/PDR.md`'s in-scope SSR surface.
- The account subtree is one layout route (`account.tsx`) rather than three siblings, so the `ssr: false` flag and its rationale live in exactly one place and are inherited, not repeated.

### Negative
- Two rendering modes in one app is genuine cognitive overhead — a contributor has to know which subtree they're in before reasoning about what the server can see.
- The account area gets no server-side data prefetch: `AccountGate` (`marketplace-user/src/features/account/AccountGate.tsx` per `account.tsx:3`) loads client-side, so first paint under `/account` is a loading shell rather than populated HTML.
- The safety property is not self-enforcing in code — nothing fails a build if someone adds `ssr: true` to a new file under `/account` outside the layout route, or edits the nginx regex.

### Risks
- **A new account route bypasses the layout.** If a future `/account/*` route is added as a sibling `createFileRoute` outside the `account.tsx` layout tree instead of a child of it, it does not inherit `ssr: false` and can render authenticated HTML server-side by accident. Revisit if `marketplace-user/src/routes/` ever gains an `account.*` file that is not nested under the existing layout.
- **The cookie-bypass regex drifts from the actual cookie name.** If `refresh_token`'s name or signing scheme changes in `marketplace-dev-public-authorization` or `marketplace-dev-user-authenticated-authorization` without updating `cache.conf:23`, the bypass silently stops firing and authenticated responses become cacheable again. Revisit any time the refresh-cookie name or Keygrip setup changes.
- **nginx config is documentation only.** `marketplace-user/docs/nginx/*.conf` is not installed anywhere in this workspace (`docs/architecture.md` §nginx confirms no `/etc/nginx` on this machine) — the mechanism's second half is unverified in any running environment until someone deploys it. Revisit once a real install exists and can be smoke-tested.

## Compliance

Verify on disk, two checks, both must hold together — checking one without the other is not verification:

- `grep -n "ssr: false" marketplace-user/src/routeOptions/account.tsx` must return the `accountRouteOptions` export line (`account.tsx:59`), and no other `routeOptions/*.tsx` file for a public route (`home.tsx`, `shop.tsx`, `category*.tsx`, `search.tsx`, `shopsCity.tsx`) may set `ssr: false`.
- `grep -n "refresh_token" marketplace-user/docs/nginx/cache.conf` must show the `$mkt_user_has_session` map still matching on the refresh-token cookie name currently issued by the auth services.

A violation looks like: a route under `/account` (or a new private route added as a sibling instead of a child of the `account` layout) missing `ssr: false`, or `cache.conf`'s cookie regex renamed/loosened without a matching change in the cookie name the auth services actually set. Either alone reopens the leak this ADR closes.
