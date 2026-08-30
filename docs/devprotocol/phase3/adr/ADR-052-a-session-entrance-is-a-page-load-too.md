# ADR-052 — A session entrance is a page load too
# Marketplace

**Status:** accepted
**Date:** 2026-08-30
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

[`ADR-051`](./ADR-051-a-session-exit-is-a-page-load.md) made both *exits* from a session a document load,
because the urql client is built once per page load at module scope and its `cacheExchange` keys a result
by the query and its variables and by nothing that names a session. It closed the sign-out and the
involuntary `onSessionLost`, and it said in as many words that the entrance was not covered.

The entrance is a door only on `marketplace-user`. That app has a public site, and the public site links to
`/login` from the header and from the footer — on every page, including the ones inside the account area.
So a signed-in customer reaches the sign-in form by ordinary in-app navigation, with the same document and
the same client still standing, and signing in as somebody else there was a soft route change. `AccountGate`
then asks `Me`, which takes no variables, and the cache answers it with the account the *previous* customer
was looking at.

The two SPAs have no equivalent path. Nothing in either links to `/`, and the only soft return to their
login screens is the loading screen's failed session probe, which runs at boot before any authenticated
result exists.

Two shapes were on the table, and the route's own documentation had already argued against one of them: a
`beforeLoad` guard on `/login` cannot see the session, because the session is browser-only module state and
the route is server-rendered, so a server that guessed would emit HTML the first client render contradicts.

## Options considered

| Option | What it does | Why not |
|---|---|---|
| **A — guard `/login`** | a `beforeLoad` sends a signed-in visitor to `/account` | The guard runs where the answer does not exist. `/login` is SSR'd and the session lives in module state a server render must read as signed out, so the redirect would either never fire or fire on a guess that the first client render contradicts |
| **B — the entrance is a page load** ✅ | `window.location.assign('/account')` on a successful sign-in | One document load on the one action that is starting a session anyway; the same mechanism as the exit, decided in the browser, after the only event that can change the answer |
| **C — leave it, and drop the cache on sign-in** | clear the client's cache when a token is minted | The same objection ADR-051 recorded: `cacheExchange` has no public reset, and emptying one store leaves the next module-scope value somebody adds uncovered |
| **D — remove the links** | stop linking to `/login` from the header and footer of the account area | Hides the door instead of closing it. The form is still reachable by URL, by a bookmark and by the browser's own history, and a public site that cannot offer "sign in" from its chrome is worse for the anonymous majority |

## Decision

**B.** The platform owner's ruling of 2026-08-30. This is the entrance half of ADR-051, and the two are one
rule: **a session boundary is a page load, in both directions.**

1. **A successful sign-in ends in `window.location.assign('/account')`**, in
   `marketplace-user/src/features/auth/LoginForm.tsx`. One call site — it is the only place on the platform
   that mints a customer session, and the two SPAs' login forms already sit behind a boot-time load.
2. **The token and the session store are still written first, and still written unconditionally.** Both are
   module state that the load rebuilds empty, so neither value reaches the account page; they are written
   for the interval between the call and the unload, where `Header` reads `signedIn` and would otherwise
   render a "Sign in" link over a form that has just succeeded. This is the mirror of ADR-051's rule that
   the teardown runs before the exit.
3. **The account page re-mints from the httpOnly refresh cookie.** That is not a new path: it is what every
   reload of the private area has always done, and what `AccountGate` is documented around — the access
   token has never survived a load, deliberately, because a token JavaScript can read out of storage is a
   token an XSS can exfiltrate.
4. **The submit button stays disabled for the length of the load.** `assign` is asynchronous, so the form is
   still mounted and interactive after it; `isSubmitting` drops back to false the moment the handler
   returns. A `leaving` flag, set once and never cleared, keeps the button busy until the document goes —
   without it a second click buys a second `LoginUser` and two tokens race for the store that is about to be
   discarded anyway.
5. **`/login` gains no guard, and none may be added.** The redirect a guard would perform is the one this
   decision performs, from the only place that can decide it.

## Consequences

- **The cache hole is closed in both directions.** No sign-in on this platform now shares a document with a
  previous session's results: the exits reload, the entrance reloads, and the SPAs' forms are only ever
  reached at boot.
- **A sign-in costs one document load.** It buys the account page a client, a token store and a session
  store built from nothing, which is what makes the guarantee structural rather than a list of stores
  somebody has to remember to clear.
- **`session.email` is written and then discarded.** It always was, on any reload; what changes is that the
  sign-in is now a reload, so the field never reaches a render outside the login page. Nothing reads it —
  `Header` reads `signedIn` — and it stays for the frame before the unload and for whatever later screen
  wants the address before `me` answers.
- **Neither boundary may become a router navigation again.** Both read like navigations, which is exactly
  why they are the kind of line a later reader tidies. ADR-051 covers `useLogout` and `onSessionLost`; this
  one covers `LoginForm`.
- **The test asserts the exit as a `location.assign`, not as a pathname**, for the reason ADR-051 gives:
  jsdom defines `assign` as non-configurable, so the whole `location` global is stubbed by
  `test/helpers/location.ts`, and the stub goes in *after* the render that positions the router.

## Compliance

```bash
# The one entrance, and it leaves the page.
grep -c "window.location.assign('/account')" marketplace-user/src/features/auth/LoginForm.tsx   # 1

# No router navigation left in the form, and no guard on the route. `beforeLoad:` with the colon, because
# the route's docblock names the option it turned down.
grep -c 'useNavigate' marketplace-user/src/features/auth/LoginForm.tsx   # 0
grep -c 'beforeLoad:' marketplace-user/src/routeOptions/login.tsx        # 0

# Four boundaries across the three apps, all of them loads: three exits plus this entrance. The open
# parenthesis keeps the prose that names the call out of the count.
grep -rc "window.location.assign('" \
  marketplace-admin/src/auth/useLogout.ts marketplace-admin/src/main.tsx \
  marketplace-shopowner/src/auth/useLogout.ts marketplace-shopowner/src/main.tsx \
  marketplace-user/src/auth/useLogout.ts marketplace-user/src/router.tsx \
  marketplace-user/src/features/auth/LoginForm.tsx   # 1 each
```
