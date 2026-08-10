# Multi-tab Concurrent Refresh — Measured Behaviour

# Marketplace

**Status:** investigation finding — closes E14-S09. Not baselined, not a requirement document
**Version:** 1.0
**Date:** 2026-08-10
**Scope:** what the three SPAs and the three `*-authenticated-authorization` services actually do when two
tabs of the same app refresh at the same moment. It answers three questions and nothing else: can two
refresh calls race at all, how far apart are they in practice, and is `GRACE_SECONDS = 10` the right number.
**Method:** measurement against the running Dev stack on this machine, not a reading of the code. The
ShopOwner tier was stood up whole — `marketplace-dev-public-authorization` (4028),
`marketplace-dev-authenticated-authorization` (4029), `marketplace-dev-authenticated-resource` (4026),
`marketplace-dev-authenticated-logout` (4030), the Mongo replica set and Redis in Docker, and
`marketplace-shopowner` on 3044 — and driven with two real browser tabs through Playwright, with `fetch`
wrapped in each tab to timestamp every call to the rotation endpoint. Static reading was used only to
explain results already observed.
**Reads against:** [`token-handling-security-audit.md`](./token-handling-security-audit.md) §5 ·
[`docs/devprotocol/phase5/epics/E14.md`](../devprotocol/phase5/epics/E14.md) E14-S02, E14-S04, E14-S08 ·
`BEs/marketplace-common/src/others/{resolveAuthorizationSession,refreshSessionTokens,sessionLifetime,throwRefreshRaceRetry}.mts` ·
`marketplace-{admin,shopowner,user}/src/api/{client.ts,errors.ts}`

---

## 1. Verdict

`GRACE_SECONDS = 10` **is confirmed, not lowered.** The measured dispatch spread between two tabs is
**0.6 ms median, 49.9 ms worst of eighteen simultaneous double reloads** — three orders of magnitude inside
the window, and nowhere near the ten seconds that would have meant something other than a race. The
measurement does not, however, support *lowering* the number, and §6 says why: what the window has to cover
is the spread **plus the loser's own request latency**, and a loopback stack cannot measure the second term.

The window is not what this investigation found wrong. Two defects are, and both were found by running the
thing rather than reading it:

- **🔴 Two simultaneous refreshes on one token both succeed.** Under roughly 5.6 ms of separation neither
  request sees the other's write, both rotate, and one refresh token becomes **two independently usable
  lineages**. The tombstone is never consulted, no 409 is raised, and reuse detection does not fire. In
  **nine of ten** real two-tab reloads this — not the grace window — is what happened.
- **🔴 The 409 the grace window raises never reaches the client in a shape the client can read.** The race
  reply is a `GraphQLError` carrying `extensions.code = 'REFRESH_RACE_RETRY'`, but it is thrown in Koa
  middleware that runs *before* Apollo, so what goes on the wire is `{"message":…,"description":…}` with no
  `errors[]` at all. All three SPAs branch on `graphQLErrors[0].extensions.code`. **E14-S04's retry path
  therefore cannot execute in any of the three apps**, and a lost race that does reach the 409 logs the
  owner out instead of retrying — observed end to end, §5.

A third, operational, result fell out of the same session: **the family mint budget is spent twice as fast
as intended**, because every forked reload burns two mints. Nine two-tab reloads exhausted it and both tabs
were 429'd back to the login screen for the rest of the hour (§7).

Neither defect is in E14's design. Both are in the wiring underneath it, which is exactly the kind of thing
a story written as "go and look" exists to catch.

---

## 2. Can two refresh calls race at all — per SPA

Yes, but only across tabs. Within a single tab it is structurally impossible, and that answer is the same
in all three apps for the same reason.

| App | Clients per tab | In-flight de-duplication | Concurrent refresh possible? |
|---|---|---|---|
| `marketplace-admin` | one `Client`, module scope in `src/main.tsx` | yes — `authExchange` single-flight | only between tabs |
| `marketplace-shopowner` | one `Client`, module scope in `src/main.tsx` | yes — identical code | only between tabs |
| `marketplace-user` | one browser `Client` per page load (`src/router.tsx`); the SSR client has **no** `authExchange` and never refreshes | yes, in the browser client | only between tabs |

**Every SPA already de-duplicates in-flight refreshes**, and E14-S09 asks for that to be said explicitly.
`@urql/exchange-auth` 3.0.0 keeps one `authPromise` per `Client`, assigned synchronously before any other
operation can run; every operation that needs auth while a refresh is in flight is parked in `retryQueue`
and replayed when it settles (`urql-exchange-auth.js:124-132`, `:150-153`). `@urql/core` 6.0.3 dedups
queries by operation key but explicitly never mutations, so the dedup that matters here is the auth
exchange's, not the core's.

Two consequences worth stating plainly:

- **A single tab can never race itself.** Any design that assumes it can — a per-operation refresh, a retry
  that fires while a refresh is in flight — is solving a problem that does not exist.
- **E14-S04's retry path is nevertheless not dead code on that account.** It is reachable across tabs, which
  is the case it was written for. It is dead for a different and fixable reason: §5.

The cookie is host-only (no `Domain`), so the shared jar that makes the race possible is shared *per app
host* — two tabs of the shop-owner app, never a shop-owner tab and an admin tab. On this machine the Vite
dev proxy stands in for nginx and both tabs sat on `127.0.0.1:3044`, which is the same single-origin shape
the three production vhosts have.

---

## 3. The measured spread

Two tabs on `/companies`, both reloaded in the same event-loop turn, `performance.timeOrigin +
performance.now()` recorded in each tab at the moment `fetch` was called on `/authenticated-authorization`.
Eighteen trials over two runs.

| Statistic | Value |
|---|---|
| trials with two refresh calls | 16 of 18 |
| spread, median | **0.6 ms** |
| spread, minimum | 0.0 ms |
| spread, maximum | **49.9 ms** |
| winner's round trip, median | 12.7 ms |

Individual spreads, milliseconds: 0.0, 0.1, 0.2, 0.2, 0.5, 0.5, 0.6, 1.0, 1.1, 3.0, 3.4, 4.9, 20.7, 20.8,
32.9, 49.9.

**The measured spread does not exceed ten seconds** — it does not exceed one tenth of a second. There is no
sign of the pathology E14-S09 warned about: no retry loop, and no SPA holding a token outside the cookie jar
(the access token is a module-scope variable in all three, wiped by the reload that starts the race, and the
refresh token is `HttpOnly` and never visible to JS).

---

## 4. What actually happens in a race: the fork

The spread is the input; the outcome depends on where it falls relative to the service's own read-then-write
window. `resolveAuthorizationSession` reads the session hash and `refreshSessionTokens` deletes it later, in
separate round trips to Redis, with no compare-and-delete between them. Two requests that both read before
either deletes both succeed.

Measured by driving the rotation endpoint directly, one login per trial, the second call delayed by a
growing amount (33 trials, three per step):

| Separation of the two calls | Second call |
|---|---|
| 0.3 – 5.6 ms | **200** — both rotate |
| 5.7 ms and above | 409, `Refresh In Progress` |

And the fork is real, not a double-answer: after two concurrent refreshes on one token both returned 200
with a `Set-Cookie` each, **both new refresh tokens were then used independently and both were accepted**.
One consumption produced two live lineages.

In the browser, with the natural spread of §3, **nine of ten** two-tab reloads landed in the fork band and
answered `200, 200`. **Zero** produced a 409. The grace window and the tombstone — E14-S02 and E14-S04, the
controls this whole area exists for — did not run at all in the case they were built for.

Why this matters beyond tidiness: reuse detection is what makes a stolen refresh token detectable
(BCON-04). A replay that lands within 5.6 ms of a legitimate refresh is not detected as reuse, is not
tombstoned, and leaves the thief with a lineage of their own that survives the victim's next rotation. The
window is narrow and needs the attacker to be racing the victim, which is why this is 🔴 and not the top of
the list — but it is the one finding here that costs *detection* rather than convenience.

The fix is not in E14's design either: it is making the read-and-consume atomic — a `GETDEL`-shaped
operation, a Lua script, or a per-family lock — so that exactly one of two concurrent refreshes wins and the
loser takes the tombstone path that already exists and is already tested.

---

## 5. The 409 the client cannot read

When the calls *are* far enough apart, the service does the right thing and the client still loses.

The service answers, verbatim, HTTP 409 with:

```json
{"message":"Refresh In Progress","description":"This refresh token was just rotated by another request. Retry with the current cookie."}
```

There is no `errors` array, no `extensions`, no `code`. What `throwRefreshRaceRetry()` builds *does* carry
`extensions.code = 'REFRESH_RACE_RETRY'` — but it is thrown from `resolveAuthorizationSession`, called by
the authorization handler that every one of the three services installs as **Koa middleware, before the
Apollo endpoint** (`src/index.mts`: the handler at line ~145, `apolloServerKoa` at line ~165). The
`GraphQLError` never passes through Apollo's formatter; `tdwKoaErrorHandler` serialises it as a plain
platform error and only the HTTP status survives.

All three SPAs test for the code and nothing else (`src/api/errors.ts:87`, identical in all three):

```ts
export const isRefreshRaceRetry = (error: CombinedError | undefined): boolean =>
	prop(error?.graphQLErrors[0]?.extensions, 'code') === REFRESH_RACE_RETRY_CODE
```

With no `errors[]` on the wire, `graphQLErrors` is empty, the predicate is false, `refreshAuth()` breaks out
of its loop on the first attempt and calls `clearAccessToken()` and `onSessionLost()`.

Observed end to end: a tab given a single 409 **in the exact body the service serves** dropped its session
and landed on the login screen. The same tab given the same 409 in GraphQL shape retried, which is the
behaviour E14-S04 specifies.

The client's own comment explains why it matches on the code rather than the status — "a proxy that
rewrites the status must not be able to turn a race into a logout" — and that reasoning is sound. **The
client is not the thing to change.** The service should raise this error where Apollo can format it, or the
Koa error handler should preserve `extensions.code`; either way the contract E14-S04 documents becomes true
on the wire instead of only in the source.

Until then, in all three tiers: **a lost refresh race that reaches the 409 is a logout.**

---

## 6. `GRACE_SECONDS`: confirmed at 10

E14-S09 permits this finding to lower the number. It does not.

The case for lowering is the measurement: 49.9 ms worst observed, so ten seconds is ~200× what was seen and
2 s would still be ~40×. The case against is what the measurement *is*. The spread in §3 is the spread
between the two tabs' **dispatches**, on loopback, where a request reaches the service in under a
millisecond. The quantity the window actually has to cover is the interval between the winner's consumption
and the loser's arrival — dispatch spread **plus the loser's request latency**. On a poor mobile link that
second term is the dominant one and is measured in seconds, and nothing in this Dev stack can observe it.

The asymmetry recorded on the constant itself decides the tie: too wide costs *detection* (a replay inside
the window is told to retry rather than tripping revocation, gaining the attacker nothing because the grace
branch mints nothing), too narrow costs *the user* (a legitimate second tab has its whole family revoked and
is logged out everywhere). Lowering a number on evidence that omits the term that would justify it is how a
control ends up hurting the people it protects.

**Recorded decision: `GRACE_SECONDS = 10` stands, on a measured dispatch spread of ≤ 49.9 ms and an
unmeasured mobile-latency term.** The measurement that would justify lowering it is the same experiment run
once against a real network path — which is worth doing when there is a deployed environment to run it in,
and is not worth standing up on its own.

---

## 7. Side effect worth its own line: the family mint budget

The rate limiter E14-S08 added counts mints per family: `REFRESH_MINTS_PER_WINDOW = 20` per
`REFRESH_FAMILY_WINDOW_SECONDS = 3600`. Because a forked reload mints **two** tokens instead of one, two
tabs spend that budget at double rate.

Observed: after nine simultaneous double reloads plus the login, the tenth answered **429 to all four
calls** and both tabs went to the login screen; the two trials after it made no refresh call at all. That is
roughly **ten two-tab reloads per hour before a hard logout** — reached in under a minute by a person
holding <kbd>F5</kbd>, and reached honestly by anyone who works with two tabs open and reloads a few times
an hour.

The bucket is not obviously mis-sized; the fork is what makes it bite twice as fast, so fixing §4 halves the
consumption. Whether 20/hour is right once rotations are single is a separate question this finding does not
answer, but it should be asked before the limiter meets real traffic.

---

## 8. What had to be fixed before anything could be measured

No backend service on this machine would start. Every one of the nine imports `setupFieldEncryption`, which
did `import { connection } from 'mongoose'`; Mongoose is CommonJS and exposes `connection` as a getter, so
Node's static analysis of the CJS module does not see it and the process died at load with:

```
SyntaxError: The requested module 'mongoose' does not provide an export named 'connection'
```

It type-checks, it bundles, and it passes every test, because Vitest's CJS interop synthesises the named
export that Node will not. Fixed in `marketplace-common` by reaching through the default export
(`mongoose.connection`), with the reason written at the import so it is not "tidied" back.

This is recorded here because it is a genuine gate gap rather than an incident: **nothing in any repo's test
suite starts a service on plain Node**, so an import that only Vitest can resolve reaches `main` green. A
smoke test that boots each service and hits `/health` would have caught it; there is no such test today.

---

## 9. What this finding asks for

Ranked. None of it is in this document's own scope to land.

| # | Work | Why |
|---|---|---|
| 1 | Make read-and-consume of a refresh token atomic | §4 — without it the tombstone, the grace window and reuse detection do not run in the case they exist for |
| 2 | Put `extensions.code` on the wire for the race reply | §5 — E14-S04's client retry cannot execute until it is there, in all three tiers |
| 3 | A boot smoke test per service (`/health` against a real `node`) | §8 — the gates cannot currently see a service that will not start |
| 4 | Re-ask whether 20 mints/hour/family is right, after 1 | §7 — the budget is spent at double rate today |
| 5 | Re-run §3 against a real network path when one exists | §6 — the only measurement that could justify lowering `GRACE_SECONDS` |

---

## 10. This finding's blind spots

- **Only the ShopOwner tier was driven end to end.** Admin and User were read, not run: the three services
  install the same handler ahead of Apollo and the three SPAs carry the same `isRefreshRaceRetry`, so §5
  applies to all three by identical wiring — but only 4029 was measured.
- **Loopback, not a network.** Every number here has a sub-millisecond transport under it. §6 turns on that
  fact rather than working around it.
- **Chromium only, two tabs, one machine.** No second browser, no mobile, no two devices sharing an account.
- **Redis was not inspected directly** — it requires credentials this investigation deliberately did not
  read. Every claim about what the store holds is inferred from what the service answered, and the fork
  claim specifically from both rotated tokens being accepted on a later call.
- **The rate-limit trip in §7 was found, not designed for.** It was reached with an artificial reload rate;
  the "ten reloads per hour" figure is arithmetic from the constants plus the observed doubling, not a
  measured user journey.
