# The Auth Path, Observed — Login, Refresh, Logout, Wrong Tier

# Marketplace

**Status:** investigation finding — closes E18-S09. Not baselined, not a requirement document
**Version:** 1.3
**Date:** 2026-08-13 (v1.2 — F1 and F2 both fixed the same day; §5 and §6 say how, and what each fix
leaves alone; v1.3, 2026-08-28, repoints the "Reads against" E14 citation below — `epics/E14.md` is
deleted today and its record distributed, not moved — to `../devprotocol/phase5/EPICS_STORIES.md` §2's
E14 row for the epic generally and to `token-handling-security-audit.md` §3.4 for E14-S06's own
cross-service-harness residual, which in turn cites this document's own §6 as the running-platform
observation behind it; no finding changes)
**Scope:** what the running Dev stack does, per tier, for the four calls the seven phase-5 epics are
written about: a login, an authenticated call, that same call against a service of another tier, a
refresh and a logout. For each: the response, the cookies, and the Redis keyspace before and after.
**Method:** measurement first, reading second. All nine services were started on this machine — the first
time they have all run here at once — against the LAN Dev datastores (`rs0.gio.lan`, and the three-node
Redis cluster the same hosts carry). Every probe is a `curl` at a service's own endpoint with a real
cookie jar; every Redis statement is a diff of a full three-node `SCAN` taken before and after the call.
Static reading was used only to explain a result already observed, and every such explanation carries a
file-and-line citation so the two halves stay distinguishable.
**Reads against:** [`token-handling-security-audit.md`](./token-handling-security-audit.md) §5, §3.4 ·
[`multi-tab-refresh-behaviour.md`](./multi-tab-refresh-behaviour.md) ·
[`E15.md`](../devprotocol/phase5/epics/E15.md) §3, E15-S01 ·
[`../devprotocol/phase5/EPICS_STORIES.md`](../devprotocol/phase5/EPICS_STORIES.md) §2's E14 row, E14-S06
(⚠️ **Repointed 2026-08-28.** `epics/E14.md` is deleted and its record distributed, not moved; E14-S06's
own cross-service-harness residual is what the `token-handling-security-audit.md` §3.4 citation above now
carries) · [`E16.md`](../devprotocol/phase5/epics/E16.md) §3 · [`E18.md`](../devprotocol/phase5/epics/E18.md)
E18-S09 · [`SETUP.md`](../../SETUP.md) §5, §8

⚠️ **No token, token prefix, key or key prefix appears in this document**, per E17 §2. Token values are
given as lengths, Redis key names as shapes: `<hex>` stands for a digest, `<uuid>` for a lineage id. The
harness that produced these numbers scrubbed both on the way to the terminal, because a transcript is a
display like any other.

---

## 1. Verdict

**The session machinery behaves as the epics describe it, and the one live defect those epics named is
genuinely fixed.** Logout is not a no-op: it deletes both session hashes and the account's index row, and
expires both cookies. Tier isolation holds in all six wrong-tier combinations. Refresh rotates, tombstones
and re-files the index row. A replayed refresh token inside the grace window is answered 409 and touches
nothing; the same token replayed after it kills the whole lineage and files a reuse event. That is four
epics' worth of design, working, on the first run.

**Two things were found that reading had not.**

| # | Finding | Severity |
|---|---|---|
| F1 | A first registration stores the password hashed **twice**, so the account can never log in. Both public tiers. | **High — registration was broken in production. Fixed 2026-08-13, see §5** |
| F2 | An access token minted by a refresh that carried no `Authorization` header is reachable by no revocation path — not logout, not family revocation, not the operator console — and lives out its 30–91 minutes. Five such tokens accumulated over this session's own probing. | **Medium — the orphan and the accumulation are fixed, 2026-08-13, see §6. One residual left open by decision** |

Three smaller divergences (F3–F5) are recorded in §6. F1 is not an E18 finding in origin: it is a
production defect in a story nobody had written, and it is stated here because this is the document that
found it. It was fixed the same day, outside any story, on the user's decision — §5 records what was
changed and what the fix deliberately leaves alone. **F2 was fixed the same day and on the same
decision**, also with no story: the unreachable token and its accumulation are gone. The one narrower
residual it left — revocation ending refresh sessions only — was carried as R54 and **closed the same day**;
§6 records both, including the fact that R54 named one path too many.

## 2. What was driven

| Tier | Login | Authenticated call | Refresh | Logout |
|---|---|---|---|---|
| Admin | `loginAdmin` (4028) | 4024 | 4025 | 4030 |
| ShopOwner | `login` (4028) | 4026 | 4029 | 4030 |
| User | `loginUser` (4028) | 4032 | 4031 | 4030 |

All three login mutations live on `marketplace-dev-public-authorization` (4028) — a login cannot require a
token. Each service answers on its own path, not on `/graphql`: `ctx.path === ENDPOINT`, and `ENDPOINT` is
the service's own name (`src/index.mts:20-26`, the exact line differing per service). A probe sent to `/graphql` gets a bare 404 with no GraphQL
body, which is worth knowing before diagnosing a 404 as a routing failure.

⚠️ **The Admin and ShopOwner accounts already existed on this machine; the User tier had none, and one had
to be made.** Not through `userRegister`: SocketLabs is configured with real credentials in this
environment and registration sends an activation message inside the transaction, so calling it would have
put a real message on the wire. Not by hand either — `login.email` is deterministically encrypted
client-side (ADR-029) and `mongosh` holds no key. The account was written through the service's own
model with the service's own CSFLE configuration, verified on creation, used, and deleted afterwards
along with every Redis key naming it. **Making that account is what turned up F1.**

## 3. The negative paths

Identical on every service tested, and all four are middleware answers that never reach a resolver.

| Probe | Status | Body |
|---|---|---|
| no `Authorization` header | 412 | `No authorization header.` |
| header present, not `Bearer access:<token>` | 499 | `Access Token Required.` |
| well-formed token, no session behind it | 498 | `Access Token is expired or deleted by Admin.` |
| refresh with no cookie jar | 412 | `No authorization cookie.` |

The `access:` prefix is part of the Redis key, not decoration — a token sent without it is not a wrong
token, it is a malformed header, and the two get different codes. The 498 text is the same one a genuinely
expired session gets, which is the intended answer: a caller holding a dead token learns that it is dead
and nothing about why.

## 4. The happy path, per tier

**Login.** 200, one 36-character access token in the body, and two cookies:

```
refresh_token=…;     path=/; expires=<+90 days>; samesite=strict; httponly
refresh_token.sig=…; path=/; expires=<+90 days>; samesite=strict; httponly
```

⚠️ **No `Secure` attribute** — correct here and only here: the services speak plain HTTP on loopback, and
the edge adds `Secure` on the way out (`marketplace-nginx`). Observed on the service, not through the
edge.

Four keys appear, and the same four on all three tiers:

| Key shape | Type | TTL observed | Fields |
|---|---|---|---|
| `<hex>` — the refresh session | hash | 7 775 990–7 775 998 s (90 d) | `_id`, `tier`, `familyId`, `originalLogin`, `sessionCapDays` |
| `<hex>` — the access session | hash | 2 614 / 4 411 / 4 936 / 5 232 s | `_id`, `email`, `tier` |
| `idx:<tier>:<accountId>` | hash | 2 591 997 s (30 d) | one field per session: `<hex>` → `{"tier":…,"mintedAt":…}` |
| `rl:<loginMutation>:email:<hex>` | string | ≤ 3 598 s | the hourly counter, 60/h for `login` and `loginUser`, 30/h for `loginAdmin` |

The four access TTLs are not four different bugs: `accessTokenExpiry()` returns a uniform random value in
**[30, 91) minutes** per token (`@axiumine/koa-utils/lib/tokens`). The refresh hash always gets the full
physical 90 days; the *policy* lifetime is `originalLogin + sessionCapDays`, checked at refresh time.

⚠️ **`sessionCapDays` is 1 for `rememberMe: false` and 30 for `true` — and the cookie says 90 days in both
cases.** That is the design (E14: the cap is enforced server-side at rotation, `sessionCapDeadline`), but
it means a browser holds a 90-day cookie for what is a one-day session, and a client reading its own
cookie expiry would be wrong by 89 days. **The cap firing was not observed** — doing so takes a day of
wall clock — so this document confirms the fields and not the enforcement.

**Authenticated call, and the wrong tier.** Six combinations, all as designed:

| Token | 4024 Admin | 4026 ShopOwner | 4032 User |
|---|---|---|---|
| Admin | 200 | **403** | **403** |
| User | **403** | **403** | 200 |

`assertTier` answers 403, not 498: the token is real and the caller is simply not entitled here, and the
two cases must not be confusable by a caller probing for which tier a token belongs to.

**Refresh.** 200 with a new token and a new cookie pair. The diff:

- created: the new access + refresh hashes, `used:<hex>` (the tombstone: `familyId`, `consumedAt`, `_id`,
  `tier`; TTL 90 d), `family:<uuid>` (a set), `rl:refresh:family:<hex>` and `rl:refresh:token:<hex>`;
- deleted: the previous refresh hash;
- **kept**: `idx:<tier>:<accountId>`, whose single field is rewritten to the new digest carrying the
  **original** `mintedAt` — one row per session, not one per rotation (E15-S03), confirmed.

⚠️ **`family:<uuid>` is created by the first rotation, not by the login.** `newSessionLineage` stamps the
three lineage fields and files nothing; the `sAdd` is in `refreshSessionTokens.mts:222`. A session that has
never refreshed therefore has no family set at all, and the pair a login minted is in no family for as
long as it lives. This matters for F2 and is not written down anywhere else.

**Logout.** 200 `{"logout": true}`. Both session hashes are deleted, the index row is deleted, and both
cookies are re-set to `expires=Thu, 01 Jan 1970 00:00:00 GMT`. Re-presenting either token afterwards
returns 498, and the emptied jar returns 412 at the refresh endpoint. The `family:<uuid>` set and the
tombstones survive — deliberately: they are the replay-detection record, not the session.

**Replay of a retired refresh cookie.** Two distinct behaviours, ten seconds apart:

| When | Status | Body | Keyspace |
|---|---|---|---|
| within `GRACE_SECONDS = 10` | **409** | `Refresh In Progress` — "This refresh token was just rotated by another request. Retry with the current cookie." | nothing created, nothing deleted |
| after it (measured at 205 s and at 12 s) | **498** | `Refresh Token is expired or deleted by Admin.` | family set **and both current session hashes** deleted; `reuse:<tier>:<accountId>` list appended — `{familyId, tier, accountId, action:"refreshTokenReplayed", at}`, TTL 30 d |

Both halves of E14's reuse design, working, including the deliberate refusal to revoke a family for what
is probably a second browser tab.

## 5. F1 — a registered account cannot log in

`registerNewUser` hashes the password and hands the hash to `User.create`
(`BEs/dev/marketplace-dev-public-resource/src/lib/db/registerNewUser.mts:34`). ⚠️ **That line number and
`registerNewShopOwner.mts:41` below are where the defect was read, and both functions were rewritten by the
fix in this section** — following either one today lands on code that hands over the plaintext deliberately
and says so in a comment. `LoginSubDocSchema` carries
a `pre('save')` that hashes `password` whenever it is modified
(`BEs/marketplace-common/src/models/MongoDB/sub/LoginSubDocSchema.mts:43-50`), and a create counts as
modified. The stored string is therefore **bcrypt(bcrypt(password))**, while `tryLoginUser` compares the
plaintext against it — which cannot match, ever.

Measured, through the service's own model, on the Dev database:

| Question | Answer |
|---|---|
| is the stored string the hash the caller passed in? | no |
| does the plaintext password verify against it? | **no** |
| does *that hash* verify against it? | **yes** |

The consequence is not subtle: a customer registers, receives the activation mail, clicks it, and is told
`Unauthorized` at every login attempt for ever. `loginUser` answers 401 with no distinguishing text —
correctly, as an anti-enumeration measure — so the support signature of this defect is indistinguishable
from a forgotten password.

**It is not confined to the User tier.** `registerNewShopOwner` does the same thing at
`registerNewShopOwner.mts:41`, into a model built on the same subdocument schema. Only the User half was
executed, so the ShopOwner half is a structural inference, not a measurement.

**Why it survived every gate.** The two *restart* paths write with `updateOne`
(`restartUserRegistration.mts:29`, `restartShopOwnerRegistration.mts:34`), which is a query and runs no
document middleware, so a registration restarted before verification stores a single hash and then works.
The two password-change functions do the same and say so in a comment that names this exact hook
(`funUserUpdatePwd.mts:62-64`, `funAdminUpdatePwd.mts:57-59`) — the trap was known on the update side and
missed on the create side. Unit tests mock the model; no test registers and then logs in, because those
are two services and the boundary suites stop at the service edge (E18-S02).

**The fix is one word in two files** — pass the plaintext and let the hook hash it, or keep the explicit
hash and drop the hook — plus the end-to-end test that would have caught it.

**Fixed the same day, the first way** (`marketplace-dev-public-resource`, `fix/double-hashed-registration-password`).
Dropping the hook was the other candidate and the more dangerous one: every write path that relies on it
would then store a **plaintext** password until someone noticed, and `shopOwnerAdd` on the Admin service is
already such a path — it hands its operator's plaintext straight to `create`. An unusable hash is a broken
account; a plaintext one is a breach. So the rule is now stated where both functions can be read: **the write
operator decides, never the field** — `create`/`save` hash themselves, `updateOne`/`findOneAndUpdate` do not.

The test lives in `test/integration/index.itest.mts`, not beside the unit tests, because the unit tests are
where this hid: they mock the model, and a mock runs no middleware. Both functions are now driven against
real MongoDB and the stored credential is handed to `bcrypt.verify` with the plaintext — which is exactly
the question this section had to open a shell to answer. **The ShopOwner half is no longer an inference:**
it is measured by the second of those two tests.

Two things this does not do. It does not repair accounts already registered through the broken path — their
stored hash is unrecoverable and they need a password reset — and nobody has counted them; and it does not
touch `restartUserRegistration` or `restartShopOwnerRegistration`, which were correct as they stood.

## 6. F2–F5

**F2 — access tokens outlive every revocation path.** Measured, User tier, one session:

| Step | AT1 (login) | AT2 (first refresh) | AT3 (second refresh) |
|---|---|---|---|
| after refresh 1 | **200** | 200 | — |
| after refresh 2 | **200** | **200** | 200 |
| after `logout` presenting AT3 | **200** | **200** | 498 |
| after a replay-triggered family revocation | **200** | 498 | — |

E14-S06 retires the previous access token at rotation, but only `if (presentedAccessToken)`
(`refreshSessionTokens.mts:253`, the line this finding was read at — the guard is still there and is no
longer alone, see the fix below) — the client has to send it. The frontends do send it when they have one,
and structurally cannot on the path that matters most: a page reload wipes the in-memory token and the
first operation after it refreshes with nothing to present (`marketplace-user/src/api/client.ts:82-92`).
Every reload therefore orphans one access token, which is in no family (§4), listed in no index row — the
index names refresh sessions only — and so reachable by neither `revokeSessionFamily` nor
`revokeAllSessionsForAccount` nor the E17 operator console. **This session's own probing left five of
them**, found by scanning for the account's `email` field and deleted by hand.

That access tokens outlive a revocation is already stated where it matters
(`marketplace-admin/src/api/operations/adminResource/mutations.ts` — ⚠️ the comment that said so was
rewritten when R54 closed, and the file now says the opposite at `:201`: the session hash records the key
of its own access token and a revocation ends it). What is new here is that they also
outlive *logout*, that they accumulate one per reload rather than existing one at a time, and that nothing
can enumerate them.

**Fixed 2026-08-13, outside any story, on the user's decision.** The refresh session now records the key of
the access session minted beside it, in an `accessKey` field on its own hash, so the server never has to be
*told* by a client which access token belongs to the session in front of it:

- **login** stamps it — `setRedisLoginSession` writes both hashes in one `Promise.all`, the refresh one
  carrying `accessKey` (`marketplace-dev-public-authorization`);
- **every rotation** retires the union of the key the consumed session records and the key of a presented
  token, then stamps the successor with its own (`refreshSessionTokens.mts`, `marketplace-common`). The
  `if (presentedAccessToken)` guard is no longer the only path to the predecessor, so a refresh with no
  `Authorization` header kills its predecessor exactly like one with a header;
- **logout** deletes the key the session names as well as the presented one, deduplicated through a `Set`
  so the ordinary two-delete logout stays two deletes (`marketplace-dev-authenticated-logout`).

A stored key is a *key*, not a token: it is the digest already used as the Redis address, it grants nothing
to whoever reads it, and it is never projected into a session the resolvers return, so E17 §2 holds.

What this closes, exactly: no access token is unreachable any more, and none accumulates — at most one
access token per session is live at any moment, and logout ends it. The measured table above no longer
reproduces; the reload path in particular now behaves as row 1 already did for a header-carrying refresh.

⚠️ ~~**What it deliberately does not close — the residual, carried as R54.** `revokeSessionFamily`,
`revokeAllSessionsForAccount` and the E17 operator "end session" button still end *refresh* sessions only.
An account whose password was changed, or which an operator has just revoked, keeps its current access
token for up to the rest of its 30–91 minutes.~~ **The decision was taken the same day and R54 is closed.**
`revokeAllSessionsForAccount` and `funRevokeSession` call `retireAccessSession` before each session `del` —
before, because the `accessKey` field lives inside the hash being deleted and a read afterwards finds
nothing. A password change, a disable and an operator's revoke all end the access token now.

⚠️ **The residual named three paths and only two were in it.** `revokeSessionFamily` was never part of this
window: the family set holds the *pair* every rotation files (`refreshSessionTokens.mts:222`), so a family
revocation has deleted access halves since E14-S02. This document said otherwise for a few hours, and the
correction is worth more than the tidy sentence — the claim was written from the index's shape rather than
from the set's contents. What is left is the session hash written before `accessKey` existed: it names no
access half, so revoking it leaves that one token for the rest of its own 30–91 minutes, and none can be
written any more.

**F3 — a revoked family leaves its index row behind.** `revokeSessionFamily` deletes the members and the
set and never touches `idx:<tier>:<accountId>` (`revokeSessionFamily.mts:64-66`). Observed: after the
replay revocation the row remained, still naming the digest of a session that no longer exists, for the
remaining 30 days of its own TTL. Nothing is granted by it — the digest resolves to nothing — but the
E17 console's session list and count read that row, so an account shows a session it does not have.
`revokeAllSessionsForAccount` cleans up whatever it finds, so the row self-corrects at the next
account-wide revocation.

**F4 — `SETUP.md` is wrong by one service, and it is a boot-blocking wrongness.** §5 line 169 assigns
`KEYGRIP_KEK` to "the four `*-authorization` services, `marketplace-dev-authenticated-logout` and
`marketplace-db-setup` — 5 of 9", and line 173 says "The four `*-resource` services sign no cookie and
**must not** carry `KEYGRIP_KEK`". Six services require it:
`marketplace-dev-admin-authenticated-resource` requires it too, and says why at `src/index.mts:65-71` —
it hosts the E17 rotation mutations, which mint and reseal the record. Following SETUP.md on a fresh
machine leaves that service refusing to boot. Corrected in the same change as this document.

The holders table is a separate count and is **still five**, as E16 §3 says: `admin-authenticated-resource`
opens the record but signs no cookie, so it files no `keygrip:holders` row. Live: six services required the
KEK at boot, five rows present, all at one fingerprint. Both numbers are right; they are answers to
different questions, and SETUP.md conflates them.

**F5 — the 90-day cookie for a one-day session**, §4 above. Recorded as observed behaviour, not as a
defect: the cap is enforced at rotation and the cookie expiry is not a control. It is noted because a
reader of the cookie jar would draw the wrong conclusion, and because nothing else says so.

## 7. E15-S01 — confirmed fixed

E15 §3 records `logout` as having "returned success and left both tokens live until natural expiry" until
E15-S01 landed on 2026-08-12. **Observed on all three tiers: it does not.** A logout deletes the refresh
session named by the cookie, the access session named by the header and the account's index row; both
tokens answer 498 afterwards and the emptied jar answers 412. The claim in E15 §3 is a historical
statement about the pre-fix code and needs no correction — it is already written in the past tense, with
the fix attributed.

⚠️ **One qualification, which was F2 and not a regression:** logout ends the session it is shown. It does
not end the *lineage*: `family:<uuid>` survives it. As observed, an access token from an earlier generation
of the same session survived too — that half is what the F2 fix closed. Since 2026-08-13 a rotation retires
its predecessor's access session whether or not the client presented the token, so by the time logout runs
there is at most one access session left in the lineage and logout deletes it, by the key the refresh hash
names, without needing the header. "Logged out" now means the refresh chain is dead and every access token
the session minted with it.

## 8. What this document does not cover

- **The three frontends were not driven.** Every probe is a direct service call. The reload path in F2 is
  read from `client.ts`, not measured through a browser.
- **The absolute session cap was not observed firing** — it needs a day of wall clock (§4).
- **The activation and password-reset flows were not exercised**, because both send mail through a live
  SocketLabs account (§2). F1 was therefore proven on the write, not through the mailbox.
- **The ShopOwner half of F1 is inferred**, not measured (§5).
- **The edge was not in the path**, so the `Secure` rewrite and the vhost split are untested here — they
  are `marketplace-nginx`'s own test container's subject.
- The replay probe run against the real ShopOwner account did what a replay is supposed to do and **ended
  that account's session**. Its `reuse:shopOwner:<hex>` row is a genuine audit entry for an event that
  really happened and has deliberately been left in place.
