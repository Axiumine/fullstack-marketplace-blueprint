# Access & Refresh Token Handling — Security Audit
# Marketplace

**Status:** review finding — not baselined, not a requirement document
**Version:** 1.1
**Date:** 2026-08-10 (v1.0 2026-08-08; v1.1 drops the two findings `marketplace-nginx` closed — the
v1.0 🔴 Critical on `Secure` and the v1.0 §3.7g on the two private vhosts — and renumbers §3 accordingly)
**Scope:** access token + refresh token handling only. Password hashing, upload scanning, catalogue
authorization and the unbuilt Order/Cart/Delivery/Payment surface are out of scope.
**Method:** static audit. Six independent security lenses over `docs/devprotocol/**`, each finding then
adversarially refuted by a separate reviewer against the cited source; 25 of 26 findings survived
refutation. Every finding marked ✅ below was re-verified by hand at the cited source before publication.
**Reads against:** [`docs/devprotocol/phase1/NFR.md`](../devprotocol/phase1/NFR.md) · `phase3/SECURITY_AUTH.md` ·
`phase3/adr/ADR-003`, `ADR-004`, `ADR-005`, `ADR-018`, `ADR-021` · `phase4/API_CONTRACTS.md` ·
`phase5/SEQUENCE_DIAGRAMS.md` · `phase5/RISK_REGISTER.md` · [`docs/architecture.md`](../architecture.md) §Auth model

---

⚠️ **Every finding below describes the platform on 2026-08-10 and is never edited afterwards.** This is a
dated review artefact, not a live checklist: a finding is closed by the epic that remediates it, in that
epic's own text, and the finding here keeps saying what was true when it was written. Read a finding
alongside [`phase5/EPICS_STORIES.md`](../devprotocol/phase5/EPICS_STORIES.md) before believing it is still
open — E13, E14 and E15 have each closed several, and an un-annotated finding here means nothing either way.
The one exception is a finding whose *premise* was wrong at publication, which is corrected in place and
marked as such; being overtaken by later work is not that.

---

## 1. Verdict

The **token model** is a good decision, well argued. Opaque UUIDv4 tokens looked up in Redis instead of
JWT (ADR-003) buys immediate revocation and a server-side `tier` discriminator that no client can forge,
and the reasoning recorded in ADR-003/ADR-004 holds up under adversarial reading. Rotation with atomic
rollback, `assertTier` failing closed, the access token living in browser memory only, and a single
content-addressed logout service are all genuinely implemented, not merely claimed.

The **handling around that model** is where it falls short. Three gaps that 2026 practice (OAuth 2.1 /
RFC 9700 session management, adapted to a first-party opaque-token design) treats as baseline are absent,
and — this is the material point — **none of the three is an argued tradeoff in any ADR.** They are
unexamined rather than decided. The platform elsewhere is scrupulous about naming its tradeoffs out loud
(the fixed-window rate limiter's 2× boundary overshoot, the shared `REDIS_KEY` prefix, 403-not-401); these
three got no such treatment.

Net: **a strong foundation with most of the refresh-token safety net missing** — not a broken design with
a good safety net poorly applied.

The heaviest remaining items are §3.1 and §3.2, which compound each other.

---

## 2. What is genuinely well done

Recorded first, because the gaps below should not be read as a verdict on the whole design.

| Control | Where |
|---|---|
| `httpOnly: true` and `sameSite: 'Strict'` really enforced — Strict, not the common Lax default | `@axiumine/koa-utils/dist/lib/tokenOptions.mjs:4-5` |
| `Secure` set at the edge on every cookie, name-agnostically, and asserted by a suite that gates the push | `marketplace-nginx/snippets/proxy-backend.conf:45`, `marketplace-nginx/test/run.sh`, ADR-030 |
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

### 3.1 🟠 High — rotation without reuse detection ✅

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
with §3.2 it is unbounded in time.

**Fix.** Add a `familyId` to the refresh hash, carried unchanged through every rotation. On rotation,
write a short tombstone for the consumed token (TTL = `REFRESH_TOKEN_EXPIRY`) before deleting the live
key. A refresh that misses the live table but hits a tombstone is provable reuse — revoke every live key
tagged with that `familyId`. This does not reopen ADR-003: tokens stay opaque, sessions stay in Redis.

Design note for whoever implements it: two browser tabs of one legitimate session can race each other into
a false-positive reuse signal. Worth resolving during design, not before.

---

### 3.2 🟠 High — no absolute session lifetime ✅

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

This compounds §3.1 exactly: an attacker who wins one refresh race owns the account indefinitely.

ADR-004 uses the 90-day figure, but only to size a *different*, already-closed vulnerability window (the
pre-`tier` session population). It was never reasoned about as an absolute-lifetime decision.

**Fix.** Stamp the original-login timestamp into the refresh hash at login; refuse to rotate past
`originalLogin + N days` regardless of activity. Independent of §3.1 and worth having even alongside it.

---

### 3.3 🟠 High — no credential write invalidates any session ✅

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
through §3.1 — survives the password change untouched, bounded only by the uncapped sliding window of
§3.2. `funShopOwnerUpdateEmail.mts:15-19` acknowledges the same shape in its own comment, correctly noting
it as platform-wide behaviour rather than a decision taken there.

`phase3/SECURITY_AUTH.md:331` states "no self-serve *log out everywhere* exists" as a plain fact with no
risk analysis attached. It is the same gap seen from the feature side.

**Fix.** In the two authenticated change-password paths the account id is already on `ctx.state.user` —
delete that caller's live session keys as part of the write. The unauthenticated reset-confirm paths cannot
be fully closed without §3.6 (no account→sessions index), but the authenticated paths close today.

---

### 3.4 🟠 High — the old access token survives a refresh ✅

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

### 3.5 🟠 High — the Admin service sends more to Sentry than the other eight, over an unverified TLS connection ✅

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

### 3.6 🟡 Medium — the remainder

| # | Finding | Evidence | Note |
|---|---|---|---|
| a | Redis keys are the **raw** token, not `sha256(token)` | `setRedisLoginSession.mts:15-16`; `authorizationAuthenticatedResourceHandler.mts:51` | An RDB/AOF dump, a misconfigured replica or an over-privileged `SCAN` hands over directly replayable credentials rather than dead hashes. Docs call a Redis compromise "catastrophic" (`SECURITY_AUTH.md` §2, §3.1) yet no ADR discusses key-hashing. Refresh half is partly mitigated — the Keygrip cookie is a second factor whose keys never reach Redis — so realistic exposure is the access token's 30–90 min window |
| b | No account→sessions index exists | `setRedisLoginSession.mts:15-16`; ADR-005 | Sessions are addressable only by token value, so "revoke every session for account X" is structurally impossible. The working lever is `disabled: true` (checked every refresh) — but that nukes the whole account, and there is no self-serve version. An unexamined side effect of the content-addressed design; worth a real ADR decision, accept-or-fix |
| c | `INTROSPECTION_CODE` is reachable wherever the port is | `SECURITY_AUTH.md:263` (wildcard bind, intentional), `:278` (nginx written and tested, installed on no host); plain `===` at `authorizationAuthenticatedResourceHandler.mts:30` and `resolveAuthorizationSession.mts:73` | "Service-to-service only" is enforced by no *running* network control. One static, unrotated string is the whole gate, and it has already drifted across repos once (2026-08-07). `ctx.state.user` does stay unset on that path — the bypass grants no identity — but any resolver not itself requiring a session becomes reachable unauthenticated. The edge config does not close this: it fronts the ports, it does not firewall them. Blocked on the production-topology ADR that `ADR-INDEX.md` §5 *Gaps* still records as owed — which host runs the edge and how the service ports are closed to everything but it |
| d | `assertTier`'s **reject** path is untested in 2 of 3 resource services | admin + shopOwner `test/authorizationAuthenticatedResourceHandler.test.mts:21-26` seed only the accepting tier; reference implementation exists at `marketplace-dev-user-authenticated-resource/test/authorizationAuthenticatedResourceHandler.test.mts:52-89` | The code is correct in all three today. But ADR-004 §Risks:104-108 names this exact regression class as its own unmitigated risk, and 100% coverage plus mutation score 100 would **not** catch a dropped `assertTier` in two of three services, because no assertion exercises the rejecting branch. Port the user-tier tests across; no gate needs lowering |
| e | `waitApprov` is enforced nowhere — and `SECURITY_AUTH.md` says it is | `checkUserAuthorizationDisDel.mts:4-17` (only `disabled`/`deleted`); `tokenInfoShopOwner.mts:19-25` (not in projection) | `SECURITY_AUTH.md:63` lists "`waitApprov` read at login" as the control. The code disagrees, in a comment at `resetPwdFlow.mts:43`: *"`waitApprov` is deliberately absent. Nothing gates on it anywhere — login neither projects nor reads it."* An Admin calling `shopOwnerUpdateStatus(waitApprov: true)` has no effect on live or future sessions. Already open as `SECURITY_AUTH.md` Q2 / BC-03 hotspot 1 — but the doc's own threat table currently overstates it as mitigated |
| f | Keygrip's rotation capability is unused | `node_modules/keygrip/index.js` (`sign` uses `keys[0]`, `verify` loops all keys) | The two-key array exists precisely to allow rotate-without-logout; here it is one permanent pair, manually synced across repos, no cadence. Already `RISK_REGISTER.md` R02 (🟠 High) and `SECURITY_AUTH.md` open question #7. One cross-service integration test — mint a cookie on the minting service, verify it on the consuming one — would close the specific gap that let the 2026-08-07 incident through with every suite green |

---

### 3.7 🔵 Low

| # | Finding | Evidence |
|---|---|---|
| a | `rememberMe` is collected, stored, and has zero effect on any lifetime | `login.mts:29,68` (reaches only `updateLoginStats`); `setRedisLoginSession.mts:9-24` (no `rememberMe` parameter, unconditional TTLs). `ERD.md:78,109,196` documents it as a "persistent-session flag" — docs and code disagree. A user leaving the box unchecked on a shared device still gets the standard 90-day sliding cookie. Either wire it to a materially shorter TTL at mint time, or remove the control from the three login forms |
| b | Redis persistence (RDB/AOF) and Redis-protocol TLS are undocumented | `AOF`, `RDB`, `appendonly`, `snapshot`, `maxmemory` return zero hits across all of `docs/devprotocol/`. `INFRA.md:535` ("no TLS anywhere in Topology A") is scoped to service ports and does not explicitly cover the Redis wire protocol. Documentation void, not a confirmed exploit — current topology is one dev workstation. Interacts with §3.6a: whether a dump exists to leak is currently unstated |
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

- **Static only.** No runtime observation of the nine services — precisely which fields Sentry's
  `sendDefaultPii` gates at runtime (header vs body vs IP) is argued from source reading. The edge
  controls are the one thing observed rather than read, and only in a container: nginx runs on no
  production host yet (`phase3/SECURITY_AUTH.md` §5).
- **Application/access logging was not audited.** Whether the nine services' own loggers capture
  `Authorization` or `Cookie` headers to disk is an independent bearer-token leak channel, distinct from
  §3.5, that no finding here covers.
- **Rate limiting on the `refresh` mutation itself was not confirmed either way.** Only login and write
  mutations were verified as limited. This matters directly to §3.1: a limiter on `refresh` slows an
  attacker racing for the rotation window.
- **Multi-tab concurrent-refresh behaviour was not examined.** Relevant to designing §3.1's fix, not to
  the finding itself.
- **Encryption at rest for the MongoDB collections holding PII and legal-identity fields**
  (`taxCode`, `vatNumber`, `certifiedEmail`) is out of scope for a token audit but is the adjacent
  question this review did not touch.
- **No full dependency-tree audit** of `@axiumine/koa-utils` or `@sentry/node` beyond the specific
  mechanisms each finding needed.

---

## 6. Suggested order of work

1. **§3.3 password-write session teardown** and **§3.4 old access-token deletion** — both small, both
   inside `marketplace-common` / the resource services, both independently valuable.
2. **§3.6d `assertTier` reject-path tests** — pure test work, ports an existing reference implementation,
   closes a regression class the coverage gate cannot see.
3. **§3.1 reuse detection** + **§3.2 absolute lifetime** — design together, they share the refresh-hash
   schema change.
4. **§3.5 Sentry** — decide `sendDefaultPii` and `rejectUnauthorized` deliberately, then document.
5. **§3.6b, §3.6c, §3.6f** — ADR-shaped decisions rather than edits: session index, production network
   topology, key-rotation cadence.

None of the above requires lowering a coverage or mutation threshold, and none removes an existing
control.
