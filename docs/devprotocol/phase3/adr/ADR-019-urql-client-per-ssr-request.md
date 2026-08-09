# ADR-019 — The SSR server builds a new urql client per request and reads a deliberately un-prefixed PUBLIC_RESOURCE_URL
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`marketplace-user` is the one server-rendered app on the platform (`docs/frontends.md` §marketplace-user). Public
catalogue routes (`/`, `/shops`, `/shop/:slug`, `/category/:slug`, etc) render on a shared Node process
before any browser is involved — [`marketplace-user/CLAUDE.md`](https://github.com/Axiumine/marketplace-user/blob/main/CLAUDE.md) §Public is server-rendered, private is not.
`/account/*` is `ssr: false` (ADR-covered elsewhere, CON-10) so this decision is scoped to the SSR half
only: the anonymous public surface.

Two forces collide on that shared process:

1. **Same-process, many visitors.** One Node process serves SSR for every concurrent visitor. Any
   module-level state on that process is shared across all of them for as long as the process lives.
2. **The SSR server must reach `marketplace-dev-public-resource` (port 4027) directly**, not through
   the browser-facing `/public-resource` path nginx proxies for the client bundle — skipping nginx saves a
   hop and keeps working if the public hostname is not resolvable from inside the network
   (`marketplace-user/src/api/ssr.ts:30-34`).

The urql client is the object that carries both the GraphQL endpoint config and, if given a
`cacheExchange`, a document cache. A GraphQL client built once at module load and reused would be exactly
the shared module-level state force (1) warns about. Separately, the endpoint URL naming
`http://127.0.0.1:4027/public-resource` is a loopback address with no meaning to a browser — it only makes
sense read inside the SSR process's own `process.env`.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Module-level singleton urql client, shared across all SSR requests | One allocation for the process lifetime; simplest code | A `cacheExchange` on it would serve visitor A's cached result to visitor B; `fetchOptions` set for one request (headers, cookies) would leak into the next — the whole class of "user A saw user B's page" SSR bug (`marketplace-user/src/api/ssr.ts:6-10`) |
| New `Client` built fresh inside every request handler, no `cacheExchange`, no `authExchange` | No cross-request state possible by construction; matches that public SSR carries no visitor session at all (public-resource has no auth middleware) | One extra object allocation per request — accepted as cheap (`marketplace-user/src/api/ssr.ts:10`) |
| Endpoint URL read from `import.meta.env.VITE_PUBLIC_RESOURCE_URL` | Same mechanism the browser client already uses for its own endpoints; no new env-reading path | Any `VITE_`-prefixed variable is inlined into the client bundle at build time — this would ship a loopback address (`127.0.0.1:4027`) into every visitor's browser, exposing internal network topology and useless to the browser besides, since it can't reach that address itself |
| Endpoint URL read from `process.env.PUBLIC_RESOURCE_URL`, no `VITE_` prefix | Never reaches the client bundle — server-only by construction; lets SSR bypass nginx and talk to the service on loopback directly | Requires a second, server-only env var distinct from whatever the browser-facing proxy path is configured with; must be kept in sync with `PORT` in `marketplace-dev-public-resource/env` and its `ENDPOINT` constant |

## Decision

Chosen: build a new `Client` per request (`createSsrClient` in `marketplace-user/src/api/ssr.ts:45-52`),
with **no `cacheExchange` and no `authExchange`**, and read the endpoint from `process.env.PUBLIC_RESOURCE_URL`
rather than a `VITE_`-prefixed variable.

The per-request client is the second table row: HTTP caching already has a correct home — nginx, keyed
and bypassed properly (`marketplace-nginx/conf.d/30-cache.conf`) — so a urql-level cache on a single-use object has nothing
to serve results *to*, only a liability to carry cross-request state by accident. `authExchange` is absent
for a structural reason, not an oversight: this client only ever talks to `public-resource`, which mounts
no auth middleware, and that absence is precisely what lets an anonymous crawler request render without
the server ever touching a visitor's token.

The un-prefixed env var is the fourth table row, chosen over the third for one reason: `VITE_*` variables
are inlined into the client bundle by Vite's build step, and a loopback address (`http://127.0.0.1:4027/public-resource`)
has no business shipping to every visitor's browser. `process.env.PUBLIC_RESOURCE_URL` is read only inside
`ssrEndpoint()`, which runs on the server, so the value never crosses into client-served JS.

## Consequences

### Positive

- No cross-visitor data leak is possible from the urql client layer — the class of bug is closed by
  construction (no shared client, no shared cache), not by discipline at each call site.
- The public SSR path can render for an anonymous crawler without the server ever handling or forwarding a
  visitor's authentication token, because `authExchange` was never wired in.
- The internal loopback topology (`127.0.0.1:4027`) never reaches a browser, closing an information
  disclosure that a `VITE_`-prefixed variable would have opened.

### Negative

- One extra `Client` allocation (and its `fetchExchange` pipeline) per SSR request instead of one for the
  process lifetime — accepted as cheap in `marketplace-user/src/api/ssr.ts:10`, unmeasured beyond that.
- Two separate configuration values now describe "where public-resource is": `PUBLIC_RESOURCE_URL`
  (server, loopback, no `VITE_` prefix) and the browser-facing `/public-resource` path nginx proxies. They
  must be kept pointed at the same service by two people/configs agreeing rather than one shared constant.

### Risks

- **Default drift**: `ssrEndpoint()` falls back to `'http://127.0.0.1:4027/public-resource'`
  (`marketplace-user/src/api/ssr.ts:41`) when `PUBLIC_RESOURCE_URL` is unset or empty. That default must
  keep matching `PORT` in `marketplace-dev-public-resource/env` and the `ENDPOINT` constant exported from
  its `src/index.mts` (comment at `marketplace-user/src/api/ssr.ts:36-37`). Revisit if that service's port
  or endpoint path ever changes without this file being updated in the same commit.
- **Someone adds a `cacheExchange` "for performance"**: the object doc comment
  (`marketplace-user/src/api/ssr.ts:14-16`) states why not, but a future PR could still add one without
  reading it. Trigger for revisit: any PR touching `src/api/ssr.ts` that adds an exchange — treat as a
  security regression review, not a perf tweak.
- **A `VITE_PUBLIC_RESOURCE_URL` gets introduced later** by someone assuming symmetry with the browser
  client's env pattern. Trigger for revisit: any grep for `VITE_` matching this variable name.

## Compliance

Verify with:

```bash
grep -n "createSsrClient" marketplace-user/src/api/ssr.ts   # must construct `new Client(...)` inside the function body, not at module scope
grep -n "cacheExchange\|authExchange" marketplace-user/src/api/ssr.ts   # must return nothing — only fetchExchange is wired
grep -n "PUBLIC_RESOURCE_URL" marketplace-user/env   # must exist un-prefixed; a VITE_PUBLIC_RESOURCE_URL entry is a violation
```

A violation looks like: a `Client` instance assigned to a module-level `const` and imported by multiple
route handlers in `marketplace-user/src/api/ssr.ts`, or `import.meta.env.VITE_PUBLIC_RESOURCE_URL`
appearing anywhere in `marketplace-user/src/`.
