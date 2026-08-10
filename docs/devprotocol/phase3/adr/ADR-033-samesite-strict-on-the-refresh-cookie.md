# ADR-033 — `SameSite=Strict` on the refresh cookie, enforced twice
# Marketplace

**Status:** accepted
**Date:** 2026-08-10
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

One cookie carries a session on this platform, and it is set in one place. `setLoginCookies` in
`@axiumine/koa-utils` writes `refresh_token` with `refreshTokenOptions` plus a `maxAge` of
`REFRESH_TOKEN_EXPIRY * 1000`; the `cookies` package signs it with Keygrip and emits `refresh_token.sig`
alongside, carrying the same attributes. `refreshTokenOptions` is:

```js
{ httpOnly: true, sameSite: 'Strict', secure: false /* rewrite a true in Nginx ! */, expirationDate: 0 }
```

**`sameSite: 'Strict'` is a real defence and it is named in no ADR.** That is the whole reason this
document exists — [`docs/report/token-handling-security-audit.md`](../../../report/token-handling-security-audit.md) §3.8c raised it as a gap rather than
as a defect: an undocumented control trips no revisit trigger, so the first redirect bug whose cause
looks like "the cookie did not come back" gets fixed by loosening it, and nothing in the repo argues
back. The value is correct. Only the record was missing.

What it defends: `Strict` tells the browser to withhold the cookie on **every** request initiated from
another site, top-level navigations included. An attacker's page cannot make the browser attach a live
session to a request at any of the three authorization services, whatever shape that request takes. It
is not the only layer — the API is GraphQL over POST with `csrfPrevention` on, and ADR-021 keeps
`preferGetMethod` at `false` precisely so no mutation is ever reachable by navigation — but it is the
layer that holds when one of those is misconfigured, and it is the only one that acts before the request
is sent.

What it costs, stated plainly: **a cross-site top-level navigation into the app does not carry the
session.** A customer following a link from a webmail client, a search result or any external page
reaches the first document render as an anonymous visitor. On this platform that is nearly free today,
and the reason is worth writing down rather than rediscovering:

- The only routes that need a session are `/account/*`, and ADR-018 already makes them **CSR-only**. The
  document request that arrives without the cookie renders nothing personal; the client-side call that
  follows is same-site and carries it.
- Email verification is three REST endpoints (ADR-028) whose authority is a token in the URL. They need
  no session and are unaffected.
- Nothing on the platform returns from an external site into an authenticated flow. **Ordering will** —
  a payment-gateway or 3-D Secure return is exactly the cross-site top-level navigation `Strict` blocks,
  and that is this decision's named revisit condition, not a reason to pre-emptively weaken it now.

Two constraints shape what can actually be decided here.

**The application-side value is not ours to change.** `tokenOptions.mjs` lives in `@axiumine/koa-utils`,
the seventeenth repo, outside this workspace and not bridged by `deploy-local.sh` the way
`marketplace-common` is (ADR-015). Editing `sameSite` from here is not a thing that can be done — but a
koa-utils release that relaxed it would arrive as an ordinary dependency bump and reach production with
no diff in any of the sixteen repos.

**The effective value is set at the edge, and that half *is* ours.**
`marketplace-nginx/snippets/proxy-backend.conf:45` is `proxy_cookie_flags ~ secure httponly
samesite=strict;` — the same line whose `secure` closed the audit's original 🔴 Critical, since koa-utils
ships `secure: false` with a comment saying to rewrite it at the edge. `~` is the empty regex, so it
matches `refresh_token` and `refresh_token.sig` both. `httponly` and `samesite=strict` are repeated
there deliberately: they cost nothing and they are what stops the bump above from being silent.

Two further things in that options object are not what they look like, recorded so the next reader does
not spend an afternoon on either:

- **`expirationDate: 0` is inert** ([`docs/report/token-handling-security-audit.md`](../../../report/token-handling-security-audit.md) §4). The `cookies`
  package consumes `maxAge` and nothing else; the lifetime that actually reaches the browser is
  `setLoginCookies`'s `maxAge: REFRESH_TOKEN_EXPIRY * 1000`. It is neither a session-cookie marker nor a
  zero-length expiry — it is code-quality noise, and reading it as a control is the mistake.
- **`accessTokenOptions` is exported and used by nothing.** The access token is not a cookie: it travels
  in the `Authorization: Bearer` header and lives in the SPA's memory. There is exactly one cookie pair
  on this platform, and it is the refresh one.

`path` being commented out in the same object is a third such thing, and it is the subject of ADR-018
and of the `ADR-INDEX.md` row that goes with it — the root scope is required by
`marketplace-nginx/conf.d/30-cache.conf:32-35`, not incidental.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — leave it as it is, undocumented | Zero work; the behaviour is already correct | This is the state the audit flagged. An unrecorded control has no revisit trigger and no argument behind it, so the first person whose cross-site redirect loses the session removes it as an obstacle |
| B — record `Strict`, keep it enforced in both places | The cost is stated before someone pays it by surprise; the edge copy survives a koa-utils bump that drops the application copy, and `test/suite.sh` already proves the header on every endpoint that mints a cookie | Two enforcement points to keep in step, one of which cannot be edited from this workspace at all |
| C — relax to `Lax` now, ahead of the ordering tier's payment return | Would make a future gateway redirect work with no change | Pays a real CSRF cost years before the flow it buys exists, against a design that has no such flow and no GET mutation to protect. `Lax` also re-opens exactly the top-level-GET case `Strict` closes, which is the only case an attacker can drive by navigation |
| D — drop `samesite=strict` from `proxy_cookie_flags` as redundant with the application value | One place instead of two; the application already sets it | Deletes the only copy this workspace controls and the only one a config review can see. A koa-utils release changing `sameSite` would then land in production with nothing in the sixteen repos showing it, which is the failure mode the `secure` rewrite on the same line exists to prevent |
| E — `SameSite=None` plus a CORS allow-list, so the API can be called cross-origin | Would allow the three SPAs to be served from origins other than the API's | Already rejected where it would have to be built: the vhost comments and `snippets/security-headers-private.conf` record that a cross-origin API needs `SameSite=None` *and* an allow-list on every service, and the platform instead serves each SPA same-origin with its API behind one hostname |

---

## Decision

Option **B**. `SameSite=Strict` on `refresh_token` and `refresh_token.sig` is a recorded decision with a
recorded cost, enforced in two independent places, and it is not loosened to fix a redirect.

- **Application side:** `sameSite: 'Strict'` in `@axiumine/koa-utils`'s `refreshTokenOptions`. Outside
  this workspace, therefore outside this workspace's control, therefore the *reason* the second half is
  not redundant.
- **Edge side:** `proxy_cookie_flags ~ secure httponly samesite=strict;`, server-level in all three
  vhosts. This is the authoritative value as far as the browser is concerned, and it is the half a
  reviewer here can read, change and gate.

The accepted cost is that a session does not survive a cross-site top-level navigation. `/account/*`
being CSR-only (ADR-018) is what makes that cheap today, and it stops being cheap the day an external
service redirects back into an authenticated flow — at which point the answer is a scoped, deliberate
change argued in a superseding ADR, not a one-line edit to a conf file.

---

## Consequences

### Positive
- The control now has a name, a cost and a revisit condition, so a redirect bug is diagnosed against a
  written expectation instead of being fixed by deleting the thing that caused it.
- The `ADR-INDEX.md` "decisions deliberately NOT re-opened" table carries the row, which is the surface
  a reader hits before proposing the change rather than after making it.
- Enforcing at the edge as well as in the application makes a koa-utils bump that relaxes `sameSite` a
  non-event for the browser, and `marketplace-nginx/test/run.sh` fails if the edge line is the one that
  goes.
- `expirationDate: 0` and the unused `accessTokenOptions` are written down as inert, closing two
  false leads that a reader of that options object hits in the first minute.

### Negative
- The two enforcement points can disagree, and only one of them is visible from here. If koa-utils drops
  `sameSite` entirely, nothing in this workspace reports it — the edge silently becomes the only copy,
  which is the intended safety net and also a state nobody is told about.
- The platform depends on a nginx directive for a browser-facing security attribute. A deployment that
  ever bypasses the edge — a service port reached directly — serves the cookie with `secure: false` and
  whatever `sameSite` koa-utils ships. Which deployments can do that is the topology question ADR-032
  records as owed.
- The ordering tier will meet this cost head-on. The work is already knowable and is not budgeted
  anywhere yet.

### Risks
- **Risk:** a cross-site redirect into an authenticated route is added — a payment return, an external
  identity provider, a partner deep link — and `Strict` is loosened to `Lax` as the fix. Revisit
  condition: any flow that re-enters the app from another origin expecting a live session. The change
  then belongs in a superseding ADR that states what CSRF surface `Lax` re-opens.
- **Risk:** a koa-utils release changes `sameSite` and the bump is reviewed as a version number. Revisit
  condition: any `@axiumine/koa-utils` upgrade — `tokenOptions.mjs` is four lines and reading it is the
  check.
- **Risk:** someone removes `httponly`/`samesite=strict` from `proxy_cookie_flags` as duplication.
  Revisit condition: any edit to `marketplace-nginx/snippets/proxy-backend.conf:45`; the suite fails,
  which is the intended outcome.
- **Risk:** `expirationDate: 0` is "fixed" — given a real value, or wired into a cookie option — on the
  belief that it controls the lifetime. Revisit condition: any change to that key. The lifetime is
  `maxAge`, and it is set by `setLoginCookies`.

---

## Compliance

The browser-facing value is asserted by the edge suite, which is what `pre-push` runs in
`marketplace-nginx` (ADR-030). From that repo:

```bash
./test/run.sh          # must end ALL CHECKS PASSED
```

`test/suite.sh:186` counts, for every endpoint that mints a cookie, the `set-cookie` lines that are
`Secure` **and** `HttpOnly` **and** `SameSite=Strict`, and fails if any cookie is missing one. It runs
against the real configuration and stand-in backends that deliberately set none of the three.

The application-side value, on a dependency bump:

```bash
grep -n 'sameSite\|secure\|path' BEs/marketplace-common/node_modules/@axiumine/koa-utils/dist/lib/tokenOptions.mjs
```

`sameSite: 'Strict'` must be present, `secure: false` is expected and closed by the edge, and both
`path` lines must stay commented out (ADR-018).

A violation looks like: `samesite` dropped from `proxy_cookie_flags`; a cookie set anywhere outside
`setLoginCookies`; `SameSite=None` or `Lax` appearing in any conf or any service; a cross-site redirect
flow shipped with the loosening done in a conf file and no superseding ADR.
