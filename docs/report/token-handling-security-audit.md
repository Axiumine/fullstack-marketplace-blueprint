# Access & Refresh Token Handling — Security Audit
# Marketplace

**Status:** review finding — not baselined, not a requirement document
**Version:** 1.0
**Date:** 2026-08-08
**Scope:** access token + refresh token handling only. Password hashing, upload scanning, catalogue
authorization and the unbuilt Order/Cart/Delivery/Payment surface are out of scope.
**Method:** static audit. Six independent security lenses over `docs/devprotocol/**`, each finding then
adversarially refuted by a separate reviewer against the cited source; 25 of 26 findings survived
refutation. Every finding marked ✅ below was re-verified by hand at the cited source before publication.
**Reads against:** `docs/devprotocol/phase1/NFR.md` · `phase3/SECURITY_AUTH.md` ·
`phase3/adr/ADR-003`, `ADR-004`, `ADR-005`, `ADR-018`, `ADR-021` · `phase4/API_CONTRACTS.md` ·
`phase5/SEQUENCE_DIAGRAMS.md` · `phase5/RISK_REGISTER.md` · `docs/architecture.md` §Auth model

---

## 1. Verdict

The **token model** is a good decision, well argued. Opaque UUIDv4 tokens looked up in Redis instead of
JWT (ADR-003) buys immediate revocation and a server-side `tier` discriminator that no client can forge,
and the reasoning recorded in ADR-003/ADR-004 holds up under adversarial reading. Rotation with atomic
rollback, `assertTier` failing closed, the access token living in browser memory only, and a single
content-addressed logout service are all genuinely implemented, not merely claimed.

The **handling around that model** is where it falls short. Four gaps that 2026 practice (OAuth 2.1 /
RFC 9700 session management, adapted to a first-party opaque-token design) treats as baseline are absent,
and — this is the material point — **none of the four is an argued tradeoff in any ADR.** They are
unexamined rather than decided. The platform elsewhere is scrupulous about naming its tradeoffs out loud
(the fixed-window rate limiter's 2× boundary overshoot, the shared `REDIS_KEY` prefix, 403-not-401); these
four got no such treatment.

Net: **a strong foundation with most of the refresh-token safety net missing** — not a broken design with
a good safety net poorly applied.

The single most consequential item is §3.1. Every other control in the session design implicitly assumes
it is in place.

---

## 2. What is genuinely well done

Recorded first, because the gaps below should not be read as a verdict on the whole design.

| Control | Where |
|---|---|
| `httpOnly: true` and `sameSite: 'Strict'` really enforced — Strict, not the common Lax default | `@axiumine/koa-utils/dist/lib/tokenOptions.mjs:4-5` |
| No `Domain` attribute — cookie is host-only, a sibling-subdomain compromise does not inherit it | same file, attribute absent |
| Keygrip signature comparison is constant-time (`tsscmp`); a key mismatch fails closed with 401 | `node_modules/keygrip/index.js` |
| Tokens are CSPRNG-backed — `uuidv4()` → `crypto.randomUUID`, never `Math.random` | `@axiumine/koa-utils/dist/lib/tokens.mjs:4-11` |
| Access-token TTL is jittered 30–90 minutes rather than fixed | `tokens.mjs`, `accessTokenExpiry()` |
| Access token never persisted client-side in any of the three SPAs — module-scoped memory only | `marketplace-admin/src/api/tokenStore.ts:11-20` and equivalents |
| Rotation rollback is atomic: any throw mid-rotation deletes **both** freshly-minted keys before rethrow | `BEs/marketplace-common/src/others/refreshSessionTokens.mts:103-122` |
| `access:` / `refresh:` key namespacing is consistent on write and read — no token-confusion path | `setRedisLoginSession.mts:15-16`, `authorizationAuthenticatedResourceHandler.mts:51` |
| `disabled` / `deleted` re-checked on **every** refresh, not login-only — bounds a revoked account to one access-token lifetime | `checkUserAuthorizationDisDel.mts:4-17`, called from `findAccountForSession.mts:48` |
| Logout deletes both keys by content and is idempotent — no half-logged-out state | `authorizationLogoutHandler.mts:58-78` |
| Rate-limiter keys are `(bucket, identity)` and never contain a token — no token oracle in Redis | `assertUnderRateLimit.mts` |
| Three independent CSRF layers: `SameSite=Strict`, Apollo `csrfPrevention: true` (verified method-agnostic), and no CORS allowlist on any of the 9 services | `tokenOptions.mjs:5`; ADR-021 |

---

## 3. Gaps, ranked

### 3.1 🔴 Critical — `Secure` is `false`, everywhere, with no compensating control ✅

```js
// @axiumine/koa-utils/dist/lib/tokenOptions.mjs:3-8
const baseOptions = {
	httpOnly: true,
	sameSite: 'Strict',
	secure: false, // rewrite a true in Nginx !
	expirationDate: 0
}
```

Both the access-token and refresh-token cookie options derive from this object.

The comment defers the fix to an nginx rewrite **that did not exist when this was written**. All four
checked-in configs under `marketplace-user/docs/nginx/` were searched: zero `proxy_cookie_flags`, zero
Secure directive. The only hit for the string was `upgrade-insecure-requests` inside the CSP, which is
unrelated.

✅ **Closed since.** The rewrite now exists, once, in a snippet every proxying location includes:
`proxy_cookie_flags ~ secure httponly samesite=strict;` in `marketplace-nginx/snippets/proxy-backend.conf` (`~` is the
empty regex — it matches every cookie name, so `refresh_token` and its `.sig` companion are both covered
without naming either). `marketplace-nginx/test/run.sh` asserts it: stand-in backends emit a `Set-Cookie` exactly as
`tokenOptions.mjs` does today — `secure: false`, no flags — and every one of the seven cookie-minting
endpoints across the three vhosts, plus the three logout paths, comes back `Secure; HttpOnly;
SameSite=Strict`.

⚠️ **The finding is closed in configuration, not in production.** nginx is installed on no host — still no
`/etc/nginx`, no nginx binary in this workspace — so the flag is set by a file nothing is currently
serving. It is also now the single point of failure this audit warned about from the other direction:
`koa-utils` still ships `secure: false`, so any deployment that serves an authorization endpoint without
that snippet in front of it puts a session cookie on the wire in cleartext. `marketplace-nginx/README.md` §Verifying a
live deployment carries the `curl` that checks it on a real host.

Why this outranks everything else: Keygrip's constant-time signature stops an attacker who wants to
**write** a cookie (fixation, injection). It does nothing whatsoever against an on-path attacker who
**reads** the cookie in cleartext and replays it verbatim, `.sig` companion included. `SameSite=Strict`
does not help either — it constrains which *sites* may send the cookie, not which *networks* may observe
it. Without `Secure`, one plaintext HTTP request to the cookie's host is enough.

`NFR-SE02` asks only for "a Keygrip-signed httpOnly cookie" — `Secure` is absent from the requirement
text, so no gate on the platform would ever flag this. No ADR discusses or excuses it;
`ADR-INDEX.md:87` records the production network topology as an open, unresolved gap.

**Fix.** Set `secure: true` unconditionally in the shared cookie-options module. Koa's `cookies` package
already resolves http-vs-https per request via `req.protocol` / `isRequestEncrypted`, so this does not
require knowing the deployment topology in advance and does not need to wait for the topology ADR.

⚠️ **This code lives in `@axiumine/koa-utils` — the sixteenth repo, outside this workspace.** It is not
fixable from any of the fifteen repos here, and `koa-utils` is not bridged by `deploy-local.sh` the way
`marketplace-common` is (`phase3/SECURITY_AUTH.md` §7). Sequencing that edit is part of the work.

---

### 3.2 🟠 High — rotation without reuse detection ✅

`refreshSessionTokens` rotates correctly: it mints a new pair, writes both keys, then deletes the
just-consumed refresh key by content (`refreshSessionTokens.mts:99-101`). That is the first half of the
OAuth 2.1 / RFC 9700 rotating-refresh-token pattern. The second half — **detect that a consumed token was
presented again, and revoke the whole family** — is absent:

- The refresh hash is `IRefreshData = { _id, tier }` (`IRefreshData.mts:11-14`). No family id, no
  generation counter, nothing to chain a revocation through.
- A miss produces one generic `throwRefreshTokenExpiredOrDeleted()`
  (`resolveAuthorizationSession.mts:70-77`), identical for "expired" and "someone else already used
  this". Nothing distinguishes the two, so nothing can react to the second.

Consequence: an attacker holding a stolen refresh cookie races the legitimate client. Whoever refreshes
first wins and holds a valid, fully-rotating session. The loser sees a routine-looking error and simply
logs in again — producing a *second* live session rather than any alarm. The theft is silent, and combined
with §3.3 it is unbounded in time.

**Fix.** Add a `familyId` to the refresh hash, carried unchanged through every rotation. On rotation,
write a short tombstone for the consumed token (TTL = `REFRESH_TOKEN_EXPIRY`) before deleting the live
key. A refresh that misses the live table but hits a tombstone is provable reuse — revoke every live key
tagged with that `familyId`. This does not reopen ADR-003: tokens stay opaque, sessions stay in Redis.

Design note for whoever implements it: two browser tabs of one legitimate session can race each other into
a false-positive reuse signal. Worth resolving during design, not before.

---

### 3.3 🟠 High — no absolute session lifetime ✅

```js
// @axiumine/koa-utils/dist/lib/tokens.mjs:2
export const REFRESH_TOKEN_EXPIRY = 90 * 24 * 60 * 60 // 90 days
```

`refreshSessionTokens.mts:95` re-applies that full 90 days on **every** rotation, with no reference to when
the session originally began and no cap on rotation count. No field anywhere records an original-login
timestamp.

So the 90 days is not a session lifetime — it is an inactivity timeout. A session touched once per quarter
never expires, and never forces re-authentication, no matter how many times the legitimate owner logs in
elsewhere or changes anything about the account.

This compounds §3.2 exactly: an attacker who wins one refresh race owns the account indefinitely.

ADR-004 uses the 90-day figure, but only to size a *different*, already-closed vulnerability window (the
pre-`tier` session population). It was never reasoned about as an absolute-lifetime decision.

**Fix.** Stamp the original-login timestamp into the refresh hash at login; refuse to rotate past
`originalLogin + N days` regardless of activity. Independent of §3.2 and worth having even alongside it.

---

### 3.4 🟠 High — no credential write invalidates any session ✅

Every password-write path on the platform was checked for a Redis reference. All of them have **zero**:

| Path | File |
|---|---|
| Customer changes own password | `marketplace-dev-user-authenticated-resource/src/lib/user/funUserUpdatePwd.mts` |
| Operator changes own password | `marketplace-dev-admin-authenticated-resource/src/lib/admin/funAdminUpdatePwd.mts` |
| ShopOwner reset-confirm | `marketplace-dev-public-resource/src/lib/access/resetPwdFlow.mts` |
| Customer reset-confirm | `marketplace-dev-public-resource/src/lib/access/resetPwdFlowUser.mts` |
| Customer reset-confirm mutation | `.../graphQLPublic/schema/mutations/userUpdatePwd.mts` |

Changing a password is the only remediation a compromised user can perform without contacting an operator,
and on this platform it remediates nothing. An attacker's established session — including one obtained
through §3.2 — survives the password change untouched, bounded only by the uncapped sliding window of
§3.3. `funShopOwnerUpdateEmail.mts:15-19` acknowledges the same shape in its own comment, correctly noting
it as platform-wide behaviour rather than a decision taken there.

`phase3/SECURITY_AUTH.md:331` states "no self-serve *log out everywhere* exists" as a plain fact with no
risk analysis attached. It is the same gap seen from the feature side.

**Fix.** In the two authenticated change-password paths the account id is already on `ctx.state.user` —
delete that caller's live session keys as part of the write. The unauthenticated reset-confirm paths cannot
be fully closed without §3.7 (no account→sessions index), but the authenticated paths close today.

---

### 3.5 🟠 High — the old access token survives a refresh ✅

`refreshSessionTokens.mts:99-101` deletes the old **refresh** key only. The corresponding pre-rotation
access key is never touched; it lives out its original 30–90 minute TTL.

`phase5/SEQUENCE_DIAGRAMS.md:216-217` reads "a stolen copy of the old token is worthless the moment the
legitimate client refreshes." That is true of the refresh token and false of the access token. An access
token leaked on its own — a referrer header, a server log, shell history on a shared machine, a one-shot
XSS read of the `Authorization` header — stays usable after the victim has already rotated past it.

**Fix.** Pass the access token the call arrived with (already on `ctx` via the `Authorization` header) into
`refreshSessionTokens` and delete its key alongside the old refresh key. Symmetric with the rollback logic
already there.

---

### 3.6 🟠 High — the Admin service sends more to Sentry than the other eight, over an unverified TLS connection ✅

```mts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/instrument.mts:16-23
Sentry.init({
	dsn: process.env.DSN,
	transportOptions: { httpModule: insecureHttpsModule },
	enableLogs: true,
	sendDefaultPii: true
})
```

`sendDefaultPii: true` appears in exactly one of nine backend services — the highest-privilege tier — and
is documented nowhere. `phase3/SECURITY_AUTH.md` §6 covers the frontend's `dataCollection` denials in
detail and says nothing about any backend service. At minimum this widens POST-body and client-IP capture
for the Admin tier alone; whether it also widens header capture (and therefore the `Authorization: Bearer
access:<token>` value, which is a directly replayable credential under this token model) was not resolved
by source reading and needs runtime confirmation.

**Found during hand-verification, not by the lens pass — all nine services disable TLS certificate
verification on that same transport:**

```mts
export const insecureHttpsModule = {
	...https,
	request: (options, callback) => {
		options.rejectUnauthorized = false   // in all 9 src/instrument.mts
		return https.request(options, callback)
	}
}
```

Nine hits, one per service. Independently this is an egress hardening defect; combined with
`sendDefaultPii: true` it means the Admin tier's error payloads travel to a third party over a connection
that accepts any certificate presented to it.

**Fix.** Bring the Admin service's `instrument.mts` in line with the other eight (drop `sendDefaultPii`),
or — if the flag is intentional — add a `beforeSend` hook stripping `Authorization` and `Cookie` before any
event leaves the process, and document the exception in `SECURITY_AUTH.md` §6 the way the frontend's
`dataCollection` block already is. Separately, establish why `rejectUnauthorized = false` is there at all;
if it exists to tolerate a local proxy's certificate, scope it to that case rather than to all egress.

---

### 3.7 🟡 Medium — the remainder

| # | Finding | Evidence | Note |
|---|---|---|---|
| a | Redis keys are the **raw** token, not `sha256(token)` | `setRedisLoginSession.mts:15-16`; `authorizationAuthenticatedResourceHandler.mts:51` | An RDB/AOF dump, a misconfigured replica or an over-privileged `SCAN` hands over directly replayable credentials rather than dead hashes. Docs call a Redis compromise "catastrophic" (§2, §3.1) yet no ADR discusses key-hashing. Refresh half is partly mitigated — the Keygrip cookie is a second factor whose keys never reach Redis — so realistic exposure is the access token's 30–90 min window |
| b | No account→sessions index exists | `setRedisLoginSession.mts:15-16`; ADR-005 | Sessions are addressable only by token value, so "revoke every session for account X" is structurally impossible. The working lever is `disabled: true` (checked every refresh) — but that nukes the whole account, and there is no self-serve version. An unexamined side effect of the content-addressed design; worth a real ADR decision, accept-or-fix |
| c | `INTROSPECTION_CODE` is reachable wherever the port is | `SECURITY_AUTH.md:257` (wildcard bind, intentional), `:270` (nginx not installed); plain `===` at `authorizationAuthenticatedResourceHandler.mts:30` and `resolveAuthorizationSession.mts:73` | "Service-to-service only" is enforced by no network control that exists in this workspace. One static, unrotated string is the whole gate, and it has already drifted across repos once (2026-08-07). `ctx.state.user` does stay unset on that path — the bypass grants no identity — but any resolver not itself requiring a session becomes reachable unauthenticated. Blocked on the production-topology ADR that `ADR-INDEX.md:87` already records as owed |
| d | `assertTier`'s **reject** path is untested in 2 of 3 resource services | admin + shopOwner `test/authorizationAuthenticatedResourceHandler.test.mts:21-26` seed only the accepting tier; reference implementation exists at `marketplace-dev-user-authenticated-resource/test/authorizationAuthenticatedResourceHandler.test.mts:52-89` | The code is correct in all three today. But ADR-004 §Risks:104-108 names this exact regression class as its own unmitigated risk, and 100% coverage plus mutation score 100 would **not** catch a dropped `assertTier` in two of three services, because no assertion exercises the rejecting branch. Port the user-tier tests across; no gate needs lowering |
| e | `waitApprov` is enforced nowhere — and `SECURITY_AUTH.md` says it is | `checkUserAuthorizationDisDel.mts:4-17` (only `disabled`/`deleted`); `tokenInfoShopOwner.mts:19-25` (not in projection) | `SECURITY_AUTH.md:63` lists "`waitApprov` read at login" as the control. The code disagrees, in a comment at `resetPwdFlow.mts:43`: *"`waitApprov` is deliberately absent. Nothing gates on it anywhere — login neither projects nor reads it."* An Admin calling `shopOwnerUpdateStatus(waitApprov: true)` has no effect on live or future sessions. Already open as `SECURITY_AUTH.md` Q2 / BC-03 hotspot 1 — but the doc's own threat table currently overstates it as mitigated |
| f | Keygrip's rotation capability is unused | `node_modules/keygrip/index.js` (`sign` uses `keys[0]`, `verify` loops all keys) | The two-key array exists precisely to allow rotate-without-logout; here it is one permanent pair, manually synced across repos, no cadence. Already `RISK_REGISTER.md` R02 (🟠 High) and `SECURITY_AUTH.md` open question #7. One cross-service integration test — mint a cookie on the minting service, verify it on the consuming one — would close the specific gap that let the 2026-08-07 incident through with every suite green |
| g | No CSP or nginx vhost in-repo for `marketplace-admin` / `marketplace-shopowner` | `SECURITY_AUTH.md:309`, open question #5; both READMEs say the vhost lives on the fronting host | The two higher-privilege SPAs have no checked-in header policy while the public one does. Undocumented rather than proven absent; access token is memory-only in both and no `dangerouslySetInnerHTML` sink was found, so this is a documentation asymmetry on the higher-blast-radius tiers |

---

### 3.8 🔵 Low

| # | Finding | Evidence |
|---|---|---|
| a | `rememberMe` is collected, stored, and has zero effect on any lifetime | `login.mts:29,68` (reaches only `updateLoginStats`); `setRedisLoginSession.mts:9-24` (no `rememberMe` parameter, unconditional TTLs). `ERD.md:78,109,196` documents it as a "persistent-session flag" — docs and code disagree. A user leaving the box unchecked on a shared device still gets the standard 90-day sliding cookie. Either wire it to a materially shorter TTL at mint time, or remove the control from the three login forms |
| b | Redis persistence (RDB/AOF) and Redis-protocol TLS are undocumented | `AOF`, `RDB`, `appendonly`, `snapshot`, `maxmemory` return zero hits across all of `docs/devprotocol/`. `INFRA.md:535` ("no TLS anywhere in Topology A") is scoped to service ports and does not explicitly cover the Redis wire protocol. Documentation void, not a confirmed exploit — current topology is one dev workstation. Interacts with §3.7a: whether a dump exists to leak is currently unstated |
| c | `SameSite=Strict` is doing real work but is named in no ADR | `grep -rn -i sameSite docs/devprotocol/` returns nothing; the attribute is at `tokenOptions.mjs:5`. ADR-021 credits CSRF protection entirely to `csrfPrevention` + `preferGetMethod: false`. Because it is unnamed, a `koa-utils` bump that relaxed it would trip none of ADR-021's revisit triggers. Redundant defence-in-depth today, not a live exposure — add it as a named control and a revisit trigger |
| d | Stale docstring at the one site reasoning about key-namespace safety | `resolveAuthorizationSession.mts:21-22` documents `refreshToken` as arriving *unprefixed*; `verifySignedRefreshToken.mjs:35` returns `` `refresh:${refreshToken}` ``. Code is correct today; a maintainer trusting the docstring and re-prepending would double-prefix and silently miss every session |

---

## 4. Do not "fix" these

Checked and deliberately left alone. Listed so a later reader does not re-raise them.

- **ADR-018's "cookie scoped to API paths" is inaccurate prose, but root-scoping is load-bearing.** The
  cookie is genuinely root-scoped (`path` is commented out in `tokenOptions.mjs`). Narrowing it to match
  the prose would break NFR-SE09's cache-poisoning defence, which needs nginx to see the cookie on public
  catalogue requests (`marketplace-nginx/conf.d/30-cache.conf:32-35`). **Correct the sentence, not the scope.**
- **`expirationDate: 0` in the shared cookie options is inert.** The underlying `cookies` package consumes
  only `maxAge`. Reads like a control, is not one. Code-quality noise, not a session weakness.
- **UUIDv4's 122 effective bits and `Math.random()` in `accessTokenExpiry()` are both fine.** 122 bits is
  far beyond brute force, and the `Math.random()` call jitters the expiry window only — it never touches
  token bytes.
- **Opaque-vs-JWT is settled (ADR-003) and should not be re-litigated.** The 2026-08-07 Keygrip incident
  was a key-synchronisation process failure, not evidence against the architecture.
- **The shared `REDIS_KEY` prefix (CON-04) and the single logout service (ADR-005/CON-05) are settled.**
  Every fix proposed above is compatible with both.

---

## 5. This audit's own blind spots

Stated so the report is not read as more complete than it is.

- **Static only.** No runtime observation. Whether `Secure` would in fact be set once a real
  TLS-terminating proxy exists, and precisely which fields Sentry's `sendDefaultPii` gates at runtime
  (header vs body vs IP), are argued from source reading rather than observed.
- **Application/access logging was not audited.** Whether the nine services' own loggers capture
  `Authorization` or `Cookie` headers to disk is an independent bearer-token leak channel, distinct from
  §3.6, that no finding here covers.
- **Rate limiting on the `refresh` mutation itself was not confirmed either way.** Only login and write
  mutations were verified as limited. This matters directly to §3.2: a limiter on `refresh` slows an
  attacker racing for the rotation window.
- **Multi-tab concurrent-refresh behaviour was not examined.** Relevant to designing §3.2's fix, not to
  the finding itself.
- **Encryption at rest for the MongoDB collections holding PII and legal-identity fields**
  (`taxCode`, `vatNumber`, `certifiedEmail`) is out of scope for a token audit but is the adjacent
  question this review did not touch.
- **No full dependency-tree audit** of `@axiumine/koa-utils` or `@sentry/node` beyond the specific
  mechanisms each finding needed.

---

## 6. Suggested order of work

1. **§3.1 `Secure`** — needs a `@axiumine/koa-utils` release; start it first because it is the long pole
   and everything else assumes it.
2. **§3.4 password-write session teardown** and **§3.5 old access-token deletion** — both small, both
   inside `marketplace-common` / the resource services, both independently valuable.
3. **§3.7d `assertTier` reject-path tests** — pure test work, ports an existing reference implementation,
   closes a regression class the coverage gate cannot see.
4. **§3.2 reuse detection** + **§3.3 absolute lifetime** — design together, they share the refresh-hash
   schema change.
5. **§3.6 Sentry** — decide `sendDefaultPii` and `rejectUnauthorized` deliberately, then document.
6. **§3.7b, §3.7c, §3.7f** — ADR-shaped decisions rather than edits: session index, production network
   topology, key-rotation cadence.

None of the above requires lowering a coverage or mutation threshold, and none removes an existing
control.
