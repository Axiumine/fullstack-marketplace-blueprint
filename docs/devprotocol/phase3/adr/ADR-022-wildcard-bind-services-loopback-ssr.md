# ADR-022 — The nine services bind the wildcard address; the SSR server binds loopback
# Marketplace

**Status:** accepted
**Date:** 2026-08-07
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Nine Koa 3 services (`BEs/dev/*`) each call `httpServer.listen(...)` with no `host` key, e.g.
`marketplace-dev-public-authorization/src/index.mts:204-211`. No host means Node binds the
unspecified address — every interface, `::` — not just loopback.

**No key at all is written deliberately, and a comment sits where a key would go.** The spelling that
looks right is `hostname:` — and `hostname` is not a `net.Server.listen` option at all. Node silently
ignores the unknown key and binds wide anyway, so a `HOSTNAME` env var read into it has exactly zero
effect regardless of what it is set to, while reading as though the bind address were configured. An
absent key states the bind honestly; a `hostname:` key states a lie that nothing reports.

Forcing loopback would look like the "safer" default. It is not available here: all nine
integration suites open a real socket and fetch it back over `http://127.0.0.1:<port>` —
`marketplace-dev-public-authorization/test/integration/index.itest.mts:150` sets
`base = http://127.0.0.1:${address.port}`, and the shutdown suite dials the same address
directly (`test/integration/shutdown.itest.mts:94,219`). `127.0.0.1` resolves inside the
loopback interface, so as long as the server binds loopback too the fetch works either way —
the constraint that actually bites is deployment: these nine are meant to be reachable from
nginx and from each other across the box, which a hardcoded loopback bind would break in any
topology where the reverse proxy is not the same process.

One frontend does the opposite. `marketplace-user/serve.mjs:34,45` sets
`const HOSTNAME = '127.0.0.1'` and calls `serve({ fetch: handler.fetch, port, hostname: HOSTNAME })`.
That SSR process has no authentication layer of its own — see [`docs/frontends.md`](../../../frontends.md) §marketplace-user — and
sits behind nginx for TLS, rate limiting (`marketplace-nginx/conf.d/20-rate-limit.conf`) and the
`proxy_cache` bypass keyed on the session cookie (CON-10, `phase3/CONSTRAINTS.md:33`). A wildcard
bind on that one process would let a caller who can reach the box on `3045` skip every one of those
nginx layers directly, including the cache-bypass-on-cookie mechanism that CON-10 calls a security
boundary, not a perf choice.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — wildcard bind everywhere (all 9 services + SSR) | one bind policy, no per-repo exception to remember | SSR has no auth of its own; a wildcard bind lets any LAN caller reach `/account/*` HTML directly, skipping nginx rate-limit and cache-bypass-on-cookie (CON-10) |
| B — loopback bind everywhere (all 9 services + SSR) | narrowest attack surface, matches SSR's own choice | breaks reachability from nginx/other hosts for the 9 services in any topology where the proxy is not co-located; nothing in the 9 services' integration suites would catch this at dev time since `127.0.0.1` still resolves loopback-side |
| C (chosen) — wildcard on the 9 services, loopback only on `marketplace-user`'s SSR process | matches each process's actual trust boundary: the 9 are meant to be reached across the box, the SSR process is meant to be reached only through nginx | two policies to remember instead of one; a new service added later must consciously pick, not copy either existing pattern blindly |
| D — configurable host via env var (`HOSTNAME` as a real `host:`) | flexible per-deployment | an env var whose wrong value fails silently — nothing reports a bind on the wrong interface unless someone tests the actual socket; and it is one typo (`hostname:`) away from the ignored-key trap in Context, which looks identical in a diff |

---

## Decision

Option C. The 9 services (`BEs/dev/*`) keep the no-`host` wildcard bind — row A/C tradeoff resolves
in favor of wide binding for them because nothing about their design assumes co-location with
nginx, and the integration suites already exercise `127.0.0.1` reachability so nothing regresses.
`marketplace-user/serve.mjs` keeps its explicit `hostname: '127.0.0.1'` — row C's reasoning applies
in the opposite direction here: that one process is unauthenticated by design and sits directly
behind the nginx configs in `marketplace-nginx/` at the workspace root, so binding wide would be a direct bypass
of rate-limit and cache-bypass rules that CON-10 treats as load-bearing security, not tuning.
Option D is rejected outright: a host-from-env pattern is one `hostname:` typo away from configuring
nothing at all and reporting nothing about it, which is the trap Context describes rather than an
alternative to this decision.

---

## Consequences

### Positive
- Each process's bind matches its actual trust model instead of a single copy-pasted default.
- The dead `HOSTNAME` env var and its silent-no-op key are gone; a service with neither `.env` nor
  `PORT` set now fails to start on the parameter that is actually checked (`PORT`), rather than
  appearing to accept a `HOSTNAME` that never did anything.
- All 9 integration suites keep working unmodified — `127.0.0.1` reachability holds under a
  wildcard bind.

### Negative
- Two bind policies exist on the platform instead of one; a contributor copying a service's
  `index.mts` pattern into a new service is copying the wide-bind pattern by default and must
  separately know that SSR-style processes need the opposite.
- Nothing in the 9 services enforces "wildcard bind" as policy beyond the comment at each call
  site — a future edit could add a `host:` key back without any test catching the change, since the
  suites only check that `127.0.0.1` answers, not that other interfaces also do.

### Risks
- **Risk:** a future service copies `marketplace-user/serve.mjs`'s loopback bind by mistake and
  ends up unreachable from nginx in production, or copies a `BEs/dev/*` service's wildcard bind for
  a new unauthenticated user-facing process and reopens the exact bypass this ADR closes for
  `marketplace-user`. Revisit if a tenth backend service or a second SSR-style process is added —
  decide its bind explicitly against this ADR's reasoning rather than by nearest-neighbor copy.
- **Risk:** the nginx config that fronts this process (`marketplace-nginx/sites-available/marketplace-domain.com.conf`,
  upstream `mkt_user_ssr` in `marketplace-nginx/conf.d/10-upstreams.conf:24`) is installed on no host —
  [`docs/architecture.md`](../../../architecture.md) §nginx states no nginx binary and no `/etc/nginx` exist in this
  workspace or on this machine. Revisit if that config is ever deployed and the actual upstream
  bind does not match `127.0.0.1:3045`, since nothing here verifies the deployed nginx target
  against the loopback bind at runtime.

---

## Compliance

Verify a backend service's bind: `grep -n "listen(" -A5 BEs/dev/<service>/src/index.mts` — the
options object passed to `listen` must carry `port` only, no `host` or `hostname` key, with the
"bind every interface on purpose" comment intact (see
`BEs/dev/marketplace-dev-public-authorization/src/index.mts:204-211` as reference).

Verify the SSR process: `grep -n "HOSTNAME\|hostname" marketplace-user/serve.mjs` — must show
`const HOSTNAME = '127.0.0.1'` and `hostname: HOSTNAME` passed into `serve(...)`.

Violation on disk looks like either: a `host:`/`hostname:` key appearing in any of the 9 services'
`listen()` call (silently narrows a service meant to be wide, or reintroduces a config surface that
already once did nothing without anyone noticing), or `marketplace-user/serve.mjs` losing its
literal `127.0.0.1` in favor of no host / `0.0.0.0` / an env-driven host (removes the one boundary
standing between an anonymous LAN caller and unauthenticated `/account/*` SSR output).
