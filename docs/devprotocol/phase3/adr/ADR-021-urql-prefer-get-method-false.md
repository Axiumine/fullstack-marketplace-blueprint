# ADR-021 — preferGetMethod stays false because every service sets csrfPrevention
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

All 9 backend services mount Apollo Server 5 with `csrfPrevention: true` in `ApolloServer` options, e.g.
`BEs/dev/marketplace-dev-public-authorization/src/index.mts:177`. Same line, same value, verified across all 9
`src/index.mts` under `BEs/dev/`. `csrfPrevention` rejects a GET request unless it carries a
preflight-forcing header (`apollo-require-preflight`, or a non-simple content-type) — the mechanism exists to
stop a page on another origin issuing `credentials: include` GET requests against a cookie-authed API.

Three frontends talk to these 9 services with urql: `marketplace-admin`, `marketplace-shopowner`,
`marketplace-user` (two clients there — SSR and browser). urql's default `fetchExchange` sends short queries
as GET with none of those headers. Mutations always POST, so they worked. A query short enough to fit in a
URL, at urql defaults, hit `csrfPrevention` and failed with a CSRF error — a failure mode that reads as
"query is broken" when the actual cause is transport method vs a server-side security check, two unrelated
layers.

Constraint in play: `phase3/CONSTRAINTS.md` CON-10 — `/account/*` on `marketplace-user` is CSR, public routes
SSR, `proxy_cache` bypasses on the session cookie. Any fix here has to survive that split: it cannot assume
GET queries are safe to cache at a shared edge just because they are idempotent, because a GET carrying
`credentials: include` is itself the shape CSRF prevention exists to stop.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — urql default (`preferGetMethod` unset/`true` for queries) | Queries cacheable by URL at a shared proxy; shorter code | Breaks immediately against `csrfPrevention: true` — every query-only screen 404/403s with a CSRF message, no code change signals why |
| B — inject `apollo-require-preflight` header on urql GET requests, keep GET | Keeps GET caching upside, satisfies Apollo's check without disabling it | New `fetchOptions` logic to write and maintain in 4 client configs instead of 1 flag; still sends `credentials: include` + GET, the exact shape the mechanism targets — satisfies the letter of the check, not the reason it exists |
| C — `preferGetMethod: false` (chosen) | One field, 4 files (`marketplace-admin/src/api/client.ts`, `marketplace-shopowner/src/api/client.ts`, `marketplace-user/src/api/client.ts`, `marketplace-user/src/api/ssr.ts`), all verified set to `false`; every operation POSTs, matches how mutations already worked; no query string with operation args in nginx access logs or browser history | Loses URL-based GET caching for queries — not a real loss here: `proxy_cache` already keys off the session cookie per CON-10, not off query GET-ability |
| D — set `csrfPrevention: false` on the 9 services instead | Queries could stay GET with no header dance | Removes a real protection across all 9 services to fix a client-side transport default; wrong layer to weaken |

---

## Decision

Option C. `preferGetMethod: false` set in all 4 urql client configs. Reasoning stated inline at the call site,
`marketplace-admin/src/api/client.ts:44-48`: `credentials: 'include'` plus a GET is the exact shape CSRF
prevention exists to stop, so forcing POST is the right call independently of Apollo's check — not merely a
workaround for it — and a query string would otherwise land in nginx access logs and browser history,
carrying operation variables (e.g. an operator's search term, a name). Option B would have satisfied Apollo's
check while keeping the shape CSRF prevention flags as risky; Option D would have removed the check platform
side instead of fixing the client. Option C matches the security reasoning and takes one line per client
instead of new logic per client.

---

## Consequences

### Positive
- Every query and mutation POSTs, uniformly, in all 3 frontends. No CSRF failures at urql defaults.
- No operation name or arguments end up in a query string, so neither nginx access logs nor browser history
  carry them.
- No per-service change needed — `csrfPrevention: true` stays as-is on all 9 services, protection intact.

### Negative
- Queries lose URL-based GET caching. Not exercised today: `marketplace-user`'s `proxy_cache`
  (`marketplace-user/docs/nginx/cache.conf`) bypasses on the session cookie per CON-10, so client-GET
  cacheability was never the mechanism carrying public-route performance.

### Risks
- A 5th frontend, or a new urql client instance inside an existing app, that omits `preferGetMethod: false`
  reintroduces the same CSRF failure on its first query. Revisit trigger: any new urql `Client(...)`
  instantiation anywhere in the 3 frontend repos.
- If Apollo Server's CSRF check changes shape in a future major version (different header name, different
  default), the reasoning in this ADR should be re-checked against the new default rather than assumed still
  correct.

---

## Compliance

Verify: `grep -rn "preferGetMethod" marketplace-admin/src marketplace-shopowner/src marketplace-user/src`
must return `false` at every match — 4 occurrences as of this decision
(`marketplace-admin/src/api/client.ts:48`, `marketplace-shopowner/src/api/client.ts:48`,
`marketplace-user/src/api/client.ts:61`, `marketplace-user/src/api/ssr.ts:50`). A violation looks like a new
`Client(...)` call in any frontend without `preferGetMethod: false` in its `fetchExchange`/`cacheExchange`
options, or a query failing in the browser network tab with an Apollo CSRF-prevention error message on a
service whose `src/index.mts` still sets `csrfPrevention: true`.
