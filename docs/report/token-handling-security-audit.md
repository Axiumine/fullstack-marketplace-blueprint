# Access & Refresh Token Handling — Security Audit
# Marketplace

**Status:** review finding — not baselined, not a requirement document
**Version:** 1.3
**Date:** 2026-08-10 (v1.0 2026-08-08; v1.1 drops the two findings `marketplace-nginx` closed — the
v1.0 🔴 Critical on `Secure` and the v1.0 §3.7g on the two private vhosts — and renumbers §3 accordingly;
v1.2, 2026-08-13, appends an outcome to every finding and adds [§7](#7-closing-record--what-happened-to-every-finding),
rewriting none of what was already here; v1.3, 2026-08-28, appends the topology outcome to the three
places that ended on ADR-032 — §3.6c, §3.7b and §7's owed-ADR entry — in the same append-only way)
**Scope:** access token + refresh token handling only. Password hashing, upload scanning, catalogue
authorization and the Order/Cart/Delivery/Payment surface are out of scope — that surface was unbuilt when
this audit ran and became **permanently** out of scope on 2026-08-27 (ADR-038), so nothing here is pending
re-audit once it ships. It does not ship.
**Method:** static audit. Six independent security lenses over `docs/devprotocol/**`, each finding then
adversarially refuted by a separate reviewer against the cited source; 25 of 26 findings survived
refutation. Every finding marked ✅ below was re-verified by hand at the cited source before publication.
**Reads against:** [`docs/devprotocol/phase1/NFR.md`](../devprotocol/phase1/NFR.md) · `phase3/SECURITY_AUTH.md` ·
`phase3/adr/ADR-003`, `ADR-004`, `ADR-005`, `ADR-018`, `ADR-021` · `phase4/API_CONTRACTS.md` ·
`phase5/SEQUENCE_DIAGRAMS.md` · `phase5/RISK_REGISTER.md` · [`docs/architecture.md`](../architecture.md) §Auth model

---

⚠️ **Every finding below describes the platform on 2026-08-10 and its text is never edited afterwards.**
This is a dated review artefact, not a live checklist: the finding keeps saying what was true when it was
written. The one exception is a finding whose *premise* was wrong at publication, which is corrected in
place and marked as such; being overtaken by later work is not that.

**Since v1.2 (2026-08-13) each finding carries an outcome appended below it, and [§7](#7-closing-record--what-happened-to-every-finding)
records all fifteen in one table.** That reverses only *where* the answer lives, not what a finding says:
E18-S06 amends this report in place rather than putting a v1.2 beside it, on the platform owner's decision,
because a reader who found this file had no way of knowing which epic had overtaken it. An outcome block is
always dated, always names the story that did the work, and never rewrites the sentence above it. The epics
remain the authority on how each was built — read a finding alongside
[`phase5/EPICS_STORIES.md`](../devprotocol/phase5/EPICS_STORIES.md) for that. `git log` on this path is the
only frozen snapshot of the report as first written, and is deliberately the only one.

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

> **Outcome — fixed, 2026-08-13 (E14-S01…S04).** `familyId` is stamped at login and carried unchanged
> (`marketplace-common/src/others/newSessionLineage.mts:31`); rotation tombstones the consumed token at
> `<REDIS_KEY>used:<sha256(token)>` **before** deleting the live key
> (`src/others/refreshSessionTokens.mts:230-260`), and a replay revokes every member of
> `<REDIS_KEY>family:<familyId>` (`src/others/revokeSessionFamily.mts:49`). The design note was right and
> was answered rather than assumed away: a replay inside `GRACE_SECONDS = 10`
> (`src/others/sessionLifetime.mts:56`) is a retry, not an attack, and E14-S09 measured what the three SPAs
> actually do with several tabs open. Confirmed live, not only by test: `report/live-auth-path-observation.md`.

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

> **Outcome — fixed, 2026-08-13 (E14-S05, E14-S07).** `originalLogin` is stamped once at login and no
> rotation moves it; `resolveAuthorizationSession` refuses a session past
> `originalLogin + sessionCapDays` with the same error every other refusal throws, and revokes its family.
> The cap is **1 day, or 30 when the login carried `rememberMe: true`**
> (`marketplace-common/src/others/sessionLifetime.mts:20,35`), which also closed §3.7a: the checkbox had
> been collected and ignored. `REFRESH_TOKEN_EXPIRY` is untouched — the 90 days is still the cookie's
> `Max-Age`, and the cap is a comparison rather than a cookie attribute.

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

> **Outcome — fixed, 2026-08-13 (E15-S02, E15-S05, E15-S06, E15-S07).** The index the fix said was missing
> was built first (`<REDIS_KEY>idx:<tier>:<accountId>`), so the unauthenticated reset-confirm paths closed
> alongside the authenticated ones rather than being left behind: every password write, every email change
> and every ShopOwner status transition calls `revokeAllSessionsForAccount`
> (`marketplace-common/src/others/revokeAllSessionsForAccount.mts:79`). The `SECURITY_AUTH.md:331` line this
> finding quoted is no longer true of an operator, and remains true of the account holder — there is still
> no self-serve *log out everywhere* screen, and none was in scope here. E15-S01 also fixed a live defect
> found while auditing this: `logout` matched on a field name that never existed, so it had never once
> ended a session.

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

> **Outcome — fixed, then the residual it left was fixed too, both 2026-08-13 (E14-S06; residual found by
> E18-S09).** The access token the call arrived with is deleted in the rotation pass, and so is the one the
> *session* records: `refreshSessionTokens.mts:250-255` builds a `Set` of both names and issues one `del`
> per distinct key. The set is what closes the residual this paragraph used to end on — a refresh sent with
> **no** `Authorization` header, which is exactly what a page reload does, presented nothing to delete, and
> that access token then lived out its own TTL unreachable by logout, family revocation and the operator
> console alike. It was observed on the running platform rather than inferred
> (`report/live-auth-path-observation.md` §6), and it is reachable now because the refresh hash carries
> `accessKey`: the session names its own access half, so the rotation is right whatever the request looked
> like. `presentedAccessToken` is kept alongside it rather than replaced by it — the two differ when a
> client presents an access token older than the one its session records, and a pre-cutover session has no
> bound key at all.
>
> **How both halves of E14-S06's last criterion are proved, since no test drives two live services.** Three
> links, each asserted against a real cluster: the rotation deletes the retired access key
> (`marketplace-dev-authenticated-authorization/test/integration/index.itest.mts:473`); the successor
> refresh hash names that exact key in `accessKey`, and the access hash really lives under it
> (`marketplace-dev-user-authenticated-authorization/test/integration/index.itest.mts:388-409`), which is
> what makes the key a resource service derives and the key a rotation deletes the same key rather than two
> that happen to agree; and a `Bearer access:` token with no key on the cluster is refused **498** by the
> resource service (`marketplace-dev-authenticated-resource/test/integration/index.itest.mts:189`, customer
> tier `:88`). What no suite does is put one request through two processes.

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

> **Outcome — fixed, and the fix outgrew the finding, 2026-08-11..13 (E12, 26 stories).** Certificate
> verification is on in all nine services and the `insecureHttpsModule` is gone (E12-S01);
> `sendDefaultPii` is `false` in all nine (E12-S03); neither can return by accident — an eslint rule and a
> per-service test refuse both shapes (E12-S04), and a Sentry major bump trips a named revisit (E12-S05).
> What the finding asked for as "a `beforeSend` hook stripping `Authorization` and `Cookie`" became
> `sentryBeforeSend`, which walks every bag on every event type (E12-S02, E12-S22) and was verified against
> a real captured event (E12-S13) and against real browser traffic (E12-S24). The audit's own §5 blind spot
> — that this was argued from source reading — is what closed it.

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

**Outcome, row by row — 2026-08-13.** The rows above are unedited; this is what became of each.

- **a — fixed (E13-S01).** A session lives under `<REDIS_KEY><sha256('access:'+token)>`, built by
  `marketplace-common/src/others/sessionKeys.mts:52` and nowhere else. The digest is of the **prefixed**
  token, so the two hashes of one login stay distinguishable. **Amended 2026-08-14:** the sentence that
  stood here said a read still fell back to the old shape for sessions minted before the cutover, counted
  at `<REDIS_KEY>dual-read-hits`, and that E13-S10 was the one story of this backlog a date still held
  shut. E13-S10 landed on 2026-08-14 and deleted the fallback, the counter and `DUAL_READ_REMOVE_AFTER`
  together: the digest is now the only name a session has. Neither precondition ever had to be waited out —
  the platform has never been deployed, so no pre-cutover session existed anywhere, and the counter read
  zero on the one dev cluster.
- **b — fixed (E15-S02, E15-S03; operator half E17).** `<REDIS_KEY>idx:<tier>:<accountId>`, one field per
  live session, each `HEXPIRE`d to its own session's cap (`sessionKeys.mts:104`). It is what E15's
  credential-write revocation and E17's operator console are both built on. No `SCAN` was introduced —
  BCON-08 still forbids it.
- **c — comparison fixed, exposure routed (E13-S03, E13-S11; ADR-032).** Six comparison sites became
  `constantTimeEquals` (`marketplace-common/src/others/constantTimeEquals.mts:53`) and the bypass is
  refused outside development by `isIntrospectionBypassAllowed`
  (`src/others/isIntrospectionBypassAllowed.mts:33`). The seventh site lives in `@axiumine/koa-utils`,
  outside all sixteen repos, and is stated as out of reach rather than quietly counted. **The finding's
  actual subject — that the port is reachable at all — is not closed by code and cannot be**: it is the
  production-topology decision ADR-032 still owes. ⚠️ **Answered 2026-08-28** — [`ADR-039`](../devprotocol/phase3/adr/ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md) supersedes
  ADR-032 and closes the port: one application host, a default-deny cloud security group, 443 from
  Cloudflare's ranges alone. The `NODE_ENV` allowlist is **not** relaxed by that and is not allowed to be
  (ADR-039 §5) — what changed is the blast radius, not the control.
- **d — fixed, and generalised (E18-S01, E18-S02).** The reject-path tests existed by the time this was
  checked; what did not exist was anything stopping the next service from shipping without them. Eleven
  cases AB-01..AB-11 are single-sourced in `marketplace-common/src/others/authBoundaryContract.mts` and a
  per-repo meta-test fails on a missing tag in all seven authenticated services.
- **e — fixed by code, so the document became true (E01-S11, E15-S07, E15-S08).** `checkShopOwnerApproval`
  (`marketplace-common/src/others/checkShopOwnerApproval.mts:35`) is read at login on 4028 and on every
  refresh on 4029, and a status transition now revokes live sessions outright rather than waiting for the
  next refresh. `SECURITY_AUTH.md:80` describes a control that exists; E15-S08 verified the sentence
  against the code rather than rewriting it.
- **f — fixed and measured (ADR-034, E01-S12…S15, E16-S08).** The keys are one AES-256-GCM-wrapped Redis
  record, no signing key is an environment variable, rotation and retirement reach a running process
  without a restart, and a rotate-and-retire cycle was clocked on the live Dev stack at **37 ms** and
  **8 ms** to all five signers (`report/keygrip-rotation-propagation.md`). Residuals stay open and named:
  R02 for the per-machine KEK, R47 for the retirement window.

---

### 3.7 🔵 Low

| # | Finding | Evidence |
|---|---|---|
| a | `rememberMe` is collected, stored, and has zero effect on any lifetime | `login.mts:29,68` (reaches only `updateLoginStats`); `setRedisLoginSession.mts:9-24` (no `rememberMe` parameter, unconditional TTLs). `ERD.md:78,109,196` documents it as a "persistent-session flag" — docs and code disagree. A user leaving the box unchecked on a shared device still gets the standard 90-day sliding cookie. Either wire it to a materially shorter TTL at mint time, or remove the control from the three login forms |
| b | Redis persistence (RDB/AOF) and Redis-protocol TLS are undocumented | `AOF`, `RDB`, `appendonly`, `snapshot`, `maxmemory` return zero hits across all of `docs/devprotocol/`. `INFRA.md:535` ("no TLS anywhere in Topology A") is scoped to service ports and does not explicitly cover the Redis wire protocol. Documentation void, not a confirmed exploit — current topology is one dev workstation. Interacts with §3.6a: whether a dump exists to leak is currently unstated |
| c | `SameSite=Strict` is doing real work but is named in no ADR | `grep -rn -i sameSite docs/devprotocol/` returns nothing; the attribute is at `tokenOptions.mjs:5`. ADR-021 credits CSRF protection entirely to `csrfPrevention` + `preferGetMethod: false`. Because it is unnamed, a `koa-utils` bump that relaxed it would trip none of ADR-021's revisit triggers. Redundant defence-in-depth today, not a live exposure — add it as a named control and a revisit trigger |
| d | Stale docstring at the one site reasoning about key-namespace safety | `resolveAuthorizationSession.mts:21-22` documents `refreshToken` as arriving *unprefixed*; `verifySignedRefreshToken.mjs:35` returns `` `refresh:${refreshToken}` ``. Code is correct today; a maintainer trusting the docstring and re-prepending would double-prefix and silently miss every session |

**Outcome, row by row — 2026-08-13.**

- **a — fixed (E14-S07).** `rememberMe` chooses `sessionCapDays` at login: unchecked is one day, checked is
  thirty, and an absent or non-boolean argument resolves to the shorter of the two
  (`marketplace-common/src/others/sessionLifetime.mts:75`). The control was neither removed from the three
  forms nor left decorative. `ERD.md`'s "persistent-session flag" wording was corrected in the same story,
  and the persisted `shopOwner.login.rememberMe` field is documented as a stored preference that does not
  touch a session already running.
- **b — documented, and the TLS half accepted with a trigger (E13-S04, E13-S05).** Redis persistence is
  written down as it actually is, and the transport is stated rather than wished away: every service sets
  `REDIS_IS_CLUSTER=1` and koa-utils hardcodes `redis://` on that branch, so the session hash crosses the
  wire in the clear. That is **R45**, and `marketplace-common/test/redisScheme.test.mts` fails the day a
  koa-utils release makes the scheme configurable, so the position is revisited rather than left true by
  inertia. ⚠️ **That day was 2026-08-28**: `@axiumine/koa-utils@7.1.0` reads the scheme from a
  `REDIS_TLS` flag, the three assertions failed on the bump, and the position was revisited — R45
  rewritten, the test retargeted. It did not close: the flag is set nowhere and no Redis here serves
  TLS, so the sentence above still describes the wire. Whether the wire is confined to a trusted network is again ADR-032's question. ⚠️ **Answered
  2026-08-28** — [`ADR-039`](../devprotocol/phase3/adr/ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md) puts Redis and MongoDB on their own host on a private LAN segment the
  platform owner declares **trusted**. Confined, and still cleartext: **R45 stays open**, re-scored 🟢 Low,
  because a declared boundary is not encryption.
- **c — fixed (E13-S08, ADR-033).** `SameSite=Strict` is a named control with its own ADR and its own
  revisit triggers, so a `koa-utils` bump that relaxed it now trips something. E18-S13 found the adjacent
  defect while removing dead variables: a `SAMESITE_COOKIE=lax` sat in seven `env` templates configuring
  nothing, describing the cookie wrongly.
- **d — fixed (E13-S06).** The docstring at `marketplace-common/src/others/resolveAuthorizationSession.mts`
  describes the prefixed token it actually receives, and the surrounding block now also states which reads
  belong to the miss path.

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

> **Outcome — held, 2026-08-13.** Every item on this list survived the backlog as written. The first was
> acted on exactly as instructed: **E13-S07 corrected ADR-018's sentence and touched no scope**, and
> `ADR-INDEX.md`'s *deliberately NOT re-opened* table now carries the reason, so the next reader who spots
> the root-scoped cookie finds the answer before the objection. The last one turned out to be load-bearing
> in a way the note did not anticipate: the shared prefix is what let one index, one family set and one
> tombstone namespace serve all three tiers, and the tier discriminator (ADR-004) is what makes that safe.

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
  **Answered 2026-08-13 by E18-S05**, in
  [`encryption-at-rest-coverage.md`](./encryption-at-rest-coverage.md). Those three fields are not
  encrypted and should not be — they identify a company, which is public record. Thirty personal-data
  paths across four collections are, under four per-collection DEKs (ADR-029). The **storage** beneath
  all of them is not: MongoDB Community 8.0.28 carries no encryption option in the binary, and both
  volumes sit on an unencrypted filesystem in Dev — unknown for any other environment, because no other
  environment exists. Two things that finding surfaced and this audit did not: `shopOwner`'s first name,
  last name and city are permanently plaintext for the operator table's sake, and the Redis
  access-token session hash carries the account's email in the clear, into the AOF.
- **No full dependency-tree audit** of `@axiumine/koa-utils` or `@sentry/node` beyond the specific
  mechanisms each finding needed. **Answered 2026-08-13 by E18-S04**, in
  [`dependency-tree-advisory-scan.md`](./dependency-tree-advisory-scan.md). Both are clean, and so is every
  other package in the auth path — `keygrip@1.1.0`, `cookies@0.9.1`, `koa@3.2.1`, `redis@6.2.0`, both Sentry
  packages. Fifty-four advisories match installed versions across the fourteen repos that have a tree; 29 sit
  in a production zone and none of those is reachable through an attacker-influenced path. Two things that
  finding surfaced and this audit did not: seven services ship `@socketlabs/email`'s `axios@0.21.4` and never
  load a line of it, and Qodana's vulnerable-dependency inspection runs on every commit and every push and
  reports zero problems in every repo — a security gate that cannot be told apart from a passing one.

**Outcome, blind spot by blind spot — 2026-08-13.** The three not already answered above:

- **Static only — answered (E18-S09).** The platform was brought up and driven:
  [`live-auth-path-observation.md`](./live-auth-path-observation.md). Tier isolation in all six wrong-tier
  combinations, rotation, tombstones, the grace window and the reuse revocation all behave as designed, and
  two things no amount of reading had found did not: a first registration hashed the password twice, so a
  customer who registered and activated could never log in, and a refresh without an `Authorization` header
  orphaned an access token. Both were fixed the same day, outside any story, on the user's decision.
  E18-S08 then wrote down the twelve mechanical checks (MC-01..12) so the next
  audit is a command rather than a reading.
- **Application/access logging — answered (E12-S12, and acted on).** Measured rather than assumed, in
  [`architecture.md`](../architecture.md) §*What the logs actually contain*. What the measurement found
  was fixed in the same epic: no resolver echoes its argument (E12-S20), the edge records no client address
  (E12-S07), every container log is bounded (E12-S18) and its retention is pinned by the repo (E12-S19).
- **Rate limiting on `refresh` — answered (E14-S08).** It was not limited; it is now, keyed on the session's
  own lineage rather than on a client IP, which is the constraint E12 had already imposed. **The residual
  this leaves is named, not hidden:** a distinct-token flood still reaches Redis once per token, carried as
  a risk-register row rather than as a claim of completeness.
- **Multi-tab behaviour — answered (E14-S09).** Measured across the three SPAs before the grace window was
  designed, which is why §3.1's design note produced a 10-second retry rather than a false-positive
  revocation.

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

> **Outcome — followed, with one deliberate deviation, 2026-08-13.** The order held except at the front:
> E13 ran its key-digest cutover before §3.3 and §3.4, because the index E15 needed and the family sets
> E14 needed are both built on the hashed keyspace, and doing it afterwards would have meant migrating them
> twice. The deviation is recorded in E13 itself. The closing promise held too: **no coverage or mutation
> threshold was lowered anywhere in this backlog, and no gate was removed.** Two were added — a boundary
> contract (E18-S02) and a dependency-advisory scan that actually reports (E18-S11).

---

## 7. Closing record — what happened to every finding

Written 2026-08-13 by **E18-S06**, when the seven epics this report opened had landed all but three of
their stories. Fifteen findings, none unassigned. "Fixed" means the mechanism the finding asked for exists
and is tested; "accepted" means the platform decided to live with it and wrote down the trigger that would
reopen it; "routed" means it was never a code question and now belongs to a decision that is owed.

| # | Finding, in one line | Outcome | Landed in |
|---|---|---|---|
| 3.1 | Rotation without reuse detection | fixed | E14-S01…S04 — `newSessionLineage.mts`, `refreshSessionTokens.mts`, `revokeSessionFamily.mts` |
| 3.2 | No absolute session lifetime | fixed | E14-S05, E14-S07 — `sessionLifetime.mts:20,35` |
| 3.3 | No credential write invalidates a session | fixed | E15-S02, S05, S06, S07 — `revokeAllSessionsForAccount.mts:79` |
| 3.4 | The old access token survives a refresh | fixed | E14-S06 — `refreshSessionTokens.mts:250-255`; header-less path closed 2026-08-13 by the `accessKey` field, `live-auth-path-observation.md` §6; the revocation residual **R54** closed the same day, `sessionKeys.mts` `retireAccessSession`. Both halves of the last acceptance criterion are proved by three real-cluster assertions across two suites rather than by one two-service test — §3.4's outcome block names them |
| 3.5 | Admin-only `sendDefaultPii`, unverified TLS in all nine | fixed | E12-S01…S05, S13, S21, S22, S24 — `sentryBeforeSend.mts` |
| 3.6a | Redis keys are the raw token | fixed | E13-S01 — `sessionKeys.mts:52`; E13-S10 still owes the fallback's removal |
| 3.6b | No account→sessions index | fixed | E15-S02, S03 — `sessionKeys.mts:104`; operator half in E17 |
| 3.6c | `INTROSPECTION_CODE` reachable wherever the port is | comparison fixed, exposure **routed** | E13-S03, E13-S11 — `constantTimeEquals.mts:53`, `isIntrospectionBypassAllowed.mts:33`; the port itself is **ADR-032** |
| 3.6d | `assertTier` reject path untested in 2 of 3 | fixed, and generalised | E18-S01, E18-S02 — `authBoundaryContract.mts`, AB-01..AB-11 |
| 3.6e | `waitApprov` enforced nowhere, doc says otherwise | fixed in code | E01-S11, E15-S07, E15-S08 — `checkShopOwnerApproval.mts:35` |
| 3.6f | Keygrip rotation capability unused | fixed, measured | ADR-034, E01-S12…S15, E16-S08 — `keygrip-rotation-propagation.md` |
| 3.7a | `rememberMe` has no effect | fixed | E14-S07 — `sessionLifetime.mts:75` |
| 3.7b | Redis persistence and Redis-protocol TLS undocumented | documented; TLS **accepted** | E13-S04, E13-S05 — **R45**, `redisScheme.test.mts` is its trigger |
| 3.7c | `SameSite=Strict` named in no ADR | fixed | E13-S08 — **ADR-033** |
| 3.7d | Stale docstring on key-namespace safety | fixed | E13-S06 — `resolveAuthorizationSession.mts` |

§4's five do-not-fix items all held, and §5's five blind spots were all answered — three by investigations
this backlog ran (E12-S12, E14-S09, E18-S09) and two by reports written for the purpose (E18-S04, E18-S05).

**What this report leaves open, stated so nobody reads the table as "done":**

- ~~**E13-S10** — the pre-cutover dual-read fallback and its counter~~ — **closed 2026-08-14.** It was
  held shut by a date and a counter reading zero rather than by a decision; both preconditions turned out
  to be moot, because the cutover was never deployed and the counter key was never created. The raw-key
  read, `DUAL_READ_REMOVE_AFTER`, the dated test and the counter left in one change, the dual delete
  became one key, and E13-S02's integration test was **inverted** rather than deleted: it still seeds a
  session in the pre-cutover shape and now asserts it does not authenticate. §3.6a is owed nothing.
- ~~**ADR-032** — which host runs the edge and how the nine service ports are closed to everything but it.
  §3.6c's real subject, and §3.7b's second half depends on the same answer.~~ **Written 2026-08-28**:
  [`ADR-039`](../devprotocol/phase3/adr/ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md) — Cloudflare at the edge, one application host, a cloud security group closing every
  port but 443, datastores on a separate host on a trusted private segment. **R46 closes with it; R45 does
  not**, and §3.6c's control stands unchanged by owner's decision rather than by omission.
- ~~**Revocation still ends refresh sessions only**~~ — **closed 2026-08-13, hours after it was written
  here.** `revokeAllSessionsForAccount` and the E17 console's `funRevokeSession` retire the access half
  through the refresh hash's `accessKey` before deleting the hash that names it, so a password change, a
  disable and an operator's revoke all end the access token now (§3.4's residual, **R54**, closed).
  `revokeSessionFamily` was named in that residual and never belonged in it: its set holds the pair every
  rotation files, so it has deleted both halves since E14-S02. The *orphaned* access token found live on
  2026-08-13 was fixed earlier the same day, by the field this closure reads. §3.4 has no residual left.
- **The residuals carried as risk rows** rather than as claims of completeness: the per-machine `KEYGRIP_KEK`
  (R02), the retirement adoption window (R47), unencrypted Redis transport (R45), storage-level encryption
  (R48), `axios@0.21.4` in `public-resource` (R49), and the distinct-token flood against `refresh`. E18-S07
  is the story that gives each of them a row, an owner and a trigger — **landed the same day**: the flood is
  **R52**, the dual-read fallback's removal is **R51** (closed 2026-08-14 by E13-S10), and the per-machine
  `KEYGRIP_KEK` became **R50** when
  R02 closed, since a closed row may not carry an open residual. The other three were already rows.
