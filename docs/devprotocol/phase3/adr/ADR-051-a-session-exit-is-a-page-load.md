# ADR-051 — A session exit is a page load
# Marketplace

**Status:** accepted
**Date:** 2026-08-30
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Each of the three apps builds **one urql client per page load**, at module scope, and gives it a
`cacheExchange`. That exchange is a document cache: it keys a result by the query and its variables, and
by nothing else. It does not know which session asked, because nothing about a document identifies one.

Signing out cleared what an app can see — the in-memory access token, the session store, the pending
address on the ShopOwner tier — and then navigated with the router. A router navigation re-renders; it does
not rebuild a module. So every cached result stayed exactly where it was, in a client that outlives the
sign-out, and a second sign-in inside the same page load could be answered from it.

The reads that matter are the ones with **no variables at all**, which is what makes the collision certain
rather than theoretical: `shopOwnerCompanies` on the ShopOwner tier — the query the loading screen probes
the session with, and the companies page's first fetch — and `Me` on the User tier, which is what
`AccountGate` asks before it renders anything private. Two sessions produce the same cache key, so the
second one is served the first one's document.

The same hole was open on the other exit. `onSessionLost` is raised from inside a fetch — from
`authExchange.refreshAuth` when a refresh cannot mint a token, and from the `mapExchange` on a terminal
401/412/499 — and it cleared the session store and navigated. It is the involuntary sign-out, and it left
the same cache standing.

## Options considered

| Option | What it does | Why not |
|---|---|---|
| **A — clear the cache on the way out** | ask urql to drop what it holds when the session ends | there is no public reset on `cacheExchange`; the way to empty it is to build another client, which is a second mechanism for what a page load already does — and it clears exactly one store, so the next module-scope value somebody adds is not covered by it |
| **B — a session exit is a page load** ✅ | `window.location.assign('/')` on both exits, in all three apps | one extra document load on an action that is already leaving |
| **C — key the cache by session** | put an identity in every operation's variables or context so two sessions cannot collide | every document, every call site, for ever; it makes the cache correct by arithmetic that has to be repeated, and a single query that forgets it is the bug back again with no symptom |

## Decision

**B.** The platform owner's ruling of 2026-08-30, answering E20 §6
question 6.

1. **Both exits end in `window.location.assign('/')`, in all three apps.** The logout button, through
   `src/auth/useLogout.ts`; and `onSessionLost`, in `src/main.tsx` for the two SPAs and in `src/router.tsx`
   for `marketplace-user`. Six call sites, one line each.
2. **The teardown still runs first, and still runs unconditionally.** `assign` is asynchronous — the
   document is not gone at the next statement — so anything that renders between the call and the unload
   has to see a signed-out app rather than an identity with no session behind it. A logout the server
   refused still clears everything here, which is what it did before.
3. **Nothing is awaited after it.** `assign` starts a navigation the browser finishes on its own.
4. **`/`, on all three.** On the two SPAs that is the login page. On `marketplace-user` it is the public
   home, deliberately: that app has a public site to fall back to, a signed-out customer reading shop pages
   is the normal case rather than an error state, and a hard bounce to `/login` would turn any future
   regression in the anonymous-endpoint list into a loop.
5. **A full load is the mechanism, not a stronger `clear()`.** It rebuilds every module at once — the
   document cache, the token store, the session store, the pending address, and whatever a later feature
   parks at module scope without telling anybody. That is what makes this correct by construction instead
   of a list somebody has to remember to extend.

## Consequences

- **A sign-out costs one document load.** It is the cheapest moment in the app to pay for one: the work is
  over, nothing is unsaved, and the destination is a page that renders from nothing.
- **Neither exit is a router navigation any more, and neither may become one again.** It reads like a
  navigation, so it is the kind of line a later reader tidies. Both sites carry the reason in a comment,
  and this is the decision behind them.
- **The tests assert the exit as a `location.assign`, not as a pathname.** jsdom defines `assign` as
  non-configurable, so `vi.spyOn(window.location, 'assign')` throws *"Cannot redefine property"*; each app
  has a `test/helpers/location.ts` that stubs the whole global instead, and `unstubGlobals` puts it back.
  The stub goes in **after** a render that starts the router at a path, or the router freezes on a copy of
  the wrong location.
- **The entrance was a decision of its own, and it went the same way.** `marketplace-user` links to
  `/login` from the header and the footer, so a signed-in customer can reach the form without a page load
  and sign in as somebody else while `Me` is still cached under a key that names neither of them. The two
  SPAs have no such path — nothing in either links to `/`, and the only soft return to the login screen is
  the loading screen's failed probe, which happens before any authenticated result exists.
  [`ADR-052`](./ADR-052-a-session-entrance-is-a-page-load-too.md) closes it with the mechanism this one
  uses, which makes the pair a single rule: **a session boundary is a page load, in both directions.**
- **Sentry sees a page load where it used to see a route change.** Sign-out stops appearing as a
  navigation in a session replay and appears as the end of the session, which is what it is.

## Compliance

```bash
# Six call sites, one per exit per app. Two files per app, and the User tier's second one is the router.
grep -rc "window.location.assign('/')" \
  marketplace-admin/src/auth/useLogout.ts marketplace-admin/src/main.tsx \
  marketplace-shopowner/src/auth/useLogout.ts marketplace-shopowner/src/main.tsx \
  marketplace-user/src/auth/useLogout.ts marketplace-user/src/router.tsx   # 1 each

# No exit navigates with the router any more. The two hits left are the loading screens' failed probe,
# which is not a session that ever started.
grep -rn "navigate({ to: '/' })" marketplace-*/src   # 2 — both src/pages/LoadingPage.tsx

# Each app stubs the whole `location` global, because jsdom refuses a spy on `assign`.
grep -lc 'stubGlobal' marketplace-{admin,shopowner,user}/test/helpers/location.ts   # 3 files
```
