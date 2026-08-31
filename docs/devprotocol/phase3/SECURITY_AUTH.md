# Security & Auth Design
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.16
**Date:** 2026-08-30
**Author:** security-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.
v1.16 - 2026-08-30: §Supply chain's two `@axiumine/*` rows drop the local sync bridge. The platform owner
ruled that an edit to `marketplace-common` reaches a consumer by being published and by nothing else, and
the script is deleted ([`adr/ADR-047-a-common-change-ships-as-a-published-release.md`](./adr/ADR-047-a-common-change-ships-as-a-published-release.md)),
which *narrows* the supply-chain surface rather than widening it: every consumer now runs a build that a
version number identifies and a lockfile pins, so what a machine is executing can be verified from the
registry. The `koa-utils` row loses a comparison to a script that no longer exists. Versions move to
`3.0.0` / `^3.0.0`. No threat, control or mitigation changed.
v1.15 - 2026-08-28, later the same day: §3's threat table gains one clarification —
**`checkShopOwnerApproval` is called after the password check, not
before it**, because refusing a parked account earlier answers faster for a parked address than for an
unknown one and turns the login into an enumeration oracle. The row also records that since the
2026-08-13 session-revocation fix ([`phase5/SESSION_TERMINATION.md`](../phase5/SESSION_TERMINATION.md) §3.1) the flag
revokes rather than only refuses. Nothing else in this document changed, and no control's residual moved.
v1.14 - 2026-08-28: §3.6's exclusivity claim is superseded, not corrected — an appended block records that
`refresh` has carried two more `assertUnderRateLimit` buckets since the fix landed on 2026-08-10:
pre-lookup (`REFRESH_ATTEMPT_BUCKET`, `REFRESH_ATTEMPTS_PER_WINDOW` = 20 per `REFRESH_ATTEMPT_WINDOW_SECONDS`
= 60, keyed on `hashSessionToken(presentedRefreshToken)`) and post-lookup (`REFRESH_FAMILY_BUCKET`,
`REFRESH_MINTS_PER_WINDOW` = 20 per `REFRESH_FAMILY_WINDOW_SECONDS` = 3600, keyed on `familyId`), both
defined in `BEs/marketplace-common/src/others/refreshRateLimit.mts` and called from the three authorization
services' middleware. The sizing rationale for the two windows lives in `phase5/RISK_REGISTER.md` R52. No control changed.
v1.13 - 2026-08-27, later the same day: the two `marketplace-common` version strings follow the release of
`2.0.0` — the supply-chain row and the published-at note read `2.0.0` / `^2.0.0`, with `1.0.1` kept where it
records what 2026-08-26 shipped. `2.0.0` narrows the `@axiumine/koa-utils` peer to `>=6`; no control this
document describes is changed by it.
v1.12 - 2026-08-27: §6's "Not yet protected" heading was a schedule, not a boundary, and §1's summary said "nothing exists yet to protect". ADR-038 (2026-08-27) puts cart, order, delivery and payment permanently out of scope, so the section becomes "Never protected", each row says why no control is pending rather than late, and the PCI-DSS line in §8 stops being a today-only claim — there is no payment surface and no path to one.
v1.7 - 2026-08-25: the `itemCategory` depth-cap row cited `funItemCategoryAdd.mts:24`, the wrong file and a line of docblock — corrected to the guard and both call sites. Its mitigation column now distinguishes "no mutation on another tier" (true) from "no write on another tier" (not true since `holdItemCategory`).
v1.1 - 2026-08-11: §NFR-SE01–SE12 paragraph follows `phase1/NFR.md` to v1.1 — a 🔴 Critical change needs a
written owner decision, not team sign-off. No requirement changed.
v1.2 - 2026-08-11: §6 two rows corrected against measurement (findings from *Investigation: what do the application and access logs actually contain* and *Investigation: capture one real Sentry event and read it*, [`phase5/TELEMETRY_EGRESS_HARDENING.md`](../phase5/TELEMETRY_EGRESS_HARDENING.md) §4) — `httpBodies: []`
gates the span attribute and not `event.request.data`, and the mailed one-time links are logged by nginx.
No control changed; two claims that were stronger than the evidence are now qualified.
v1.3 - 2026-08-11: the mailed-links row follows *The mailed links stop writing a live credential to the access log* ([`phase5/TELEMETRY_EGRESS_HARDENING.md`](../phase5/TELEMETRY_EGRESS_HARDENING.md) §4), which fixed it the same day — four link shapes
rather than the two measured, the `Referer` field as well as the request line, and the residual that the
credential is still in the URL and therefore still in Cloudflare's logs and the browser history.
v1.4 - 2026-08-11: that residual has an owner. ***The customer's reset credential leaves the URL*** ([`phase5/TELEMETRY_EGRESS_HARDENING.md`](../phase5/TELEMETRY_EGRESS_HARDENING.md) §4) moves the customer reset link into the URL
fragment, which no browser transmits, so the credential stops reaching the log, the `Referer`, the cache key
and Cloudflare at once; the two verify links stay in the path, with the reason stated in the row. No control
changed here — the row now names the story instead of ending at the residual.
v1.5 - 2026-08-12: *A seller registers themselves and waits for an admin* ([`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](../phase5/SHOPOWNER_ONBOARDING_APPROVAL.md) §4) opened `shopOwner` to self-registration, which turns the `waitApprov` row in
§3.3 from a gate on a flag nobody set into the gate that makes the public form safe to expose, and closes
§9 q2. The rate-limit paragraph, the `shopOwner` field list and the `user`-divergence pointer follow. One
new control surface, none weakened: the mutation is behind the same `guardPublicWrite` + Turnstile pair as
`userRegister`, on its own counter.
v1.6 - 2026-08-13: §9 q3 closes and §3.3's onboarding paragraph stops calling the missing self-advance "an
open gap, not a design decision" — as of *Admin sets onboarding and session preferences* ([`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](../phase5/SHOPOWNER_ONBOARDING_APPROVAL.md) §4) it is exactly a design decision, deferred rather than
built. Nothing about the security posture moves: neither `onboardingStep` nor `onboardingDone` is read by
any gate, on any tier, which is the fact that makes the deferral free here and is now stated where a
reader would otherwise have to check.
**Depends on:** `phase1/PDR.md` ✅ · `phase1/NFR.md` ✅ · `phase1/SYSTEM_CONTEXT.md` ✅ · `phase2/BOUNDED_CONTEXT.md` ✅
**Mutability:** requires security review to modify
v1.8 - 2026-08-26: NFR-CO02 restated and open question 9 closed — GDPR applicability was decided by the platform owner out of phase, which is what §5 said should happen. The trace note now separates what §4 actually satisfies (Art. 32 technical measures) from the five limbs it does not, so a reader cannot take the encryption regime for compliance. No control changed.
v1.11 - 2026-08-27, later the same day: v1.10's supply-chain cell read as though installing and `deploy-local.sh` were
coupled. They are not - no install path in any of the 16 repos invokes the script. The residual risk is narrowed to the
window where it is real: while `marketplace-common` carries an edit no release has shipped. No control changed.
v1.10 - 2026-08-27: §7's supply-chain table said `@axiumine/marketplace-common` is *"not on any registry"* and
*"404s on `registry.npmjs.org`"*. `ADR-037` published it on 2026-08-26 at `1.0.1` —
`2.0.0` since 2026-08-27, consumers on `^2.0.0`. The risk does not disappear, it inverts: a fresh
`yarn install` now resolves the *released* build, so an unreleased edit is
silently absent and an install after `deploy-local.sh` silently puts the released build back. The `koa-utils` row and
the `trivy` row are untouched, and no control changed.
v1.9 - 2026-08-26: the stale "168 behavioural assertions" count replaced by a citation of `marketplace-nginx/test/suite.sh` itself. The number was stale by 67 — the suite ran 235 assertions before 2026-08-26 and 242 after — and a count written into prose goes stale silently every time an assertion is added. Nothing measured or decided changed.

---

## 1. Purpose

Marketplace = multi-tenant platform, 3 auth tiers (`Admin`, `ShopOwner`, `User`) + anon public traffic, 16 repos, one shared Redis key prefix across 9 backend services. Security posture built on one fence: opaque token + Redis session + per-request `tier` assertion. No `role` field anywhere - identity = which of 3 MongoDB collections a session authenticated against (`CLAUDE.md` §Terminology). This doc states what that fence requires to hold, where each piece lives on disk, what already broke once, and what has zero control because nothing exists to protect and nothing ever will (Order/Cart/Delivery/Payment - permanently out of scope per `phase3/CONSTRAINTS.md` §5 and ADR-038).

Prescriptive, not descriptive: every rule below is a requirement the codebase must keep satisfying, cited to the file that currently satisfies it. Where a control is documentation-only (nginx) or unverified (Mongo RBAC), that is stated plainly rather than implied as done.

---

## 2. Threat model

### Assets to protect

| Asset | Sensitivity | Risk if exposed |
|---|---|---|
| Redis session hashes (access + refresh token → tier + account id) | Critical | full account takeover, any tier, until token expiry |
| bcrypt password hashes, `login.password` on `admin`/`shopOwner`/`user` | Critical | offline crack attempt if DB dumped |
| `KEYGRIP_KEK` and the wrapped key record it opens | Critical | forged or tampered signed refresh cookies. The keys themselves are not an env value since ADR-034 — they are one AES-256-GCM record in Redis, so this row is two assets that must leak together to be useful |
| `REDIS_PASSWORD`, `MONGODB_URI` | Critical | direct datastore access, bypasses every application-level guard including `assertTier` |
| `user.personalData`, `user.addresses[]` (incl. GeoJSON `position`) | High | PII + physical location of a customer |
| `shopOwner.personalData`, `company.taxCode` / `vatNumber` / `certifiedEmail` | High | PII + legal-identity data (tax code, VAT number, certified mailbox) |
| `shopOwner.notes` (admin-only sub-document) | Medium | internal Admin commentary on a ShopOwner, never meant for the ShopOwner tier to read |
| Draft / unpublished `company` and `item` documents (`published: false`) | Medium | business/competitive info before the owner chose to publish |
| `QODANA_TOKEN`, `SOCKETLABS_SERVER_ID` / `SOCKETLABS_SERVER_APIKEY` | Medium | Qodana Cloud quota/report corruption; spoofed transactional email |
| Browser-held session cookie (refresh token) | High | session hijack for that one account |

### Threat actors

| Actor | Likelihood | Capability |
|---|---|---|
| Anonymous internet caller against public GraphQL (`marketplace-dev-public-resource`, `marketplace-dev-public-authorization`) | High | scripted registration / login / password-reset / verify-resend abuse, enumeration attempts |
| Authenticated caller of one tier probing another tier's resource service with their own valid token | Medium | this is the exact hole that existed until 2026-08-05 - see §3 |
| Credential-stuffing / brute-force bot against `login` / `loginAdmin` / `loginUser` | Medium | automated password guessing at scale — now metered by `guardPublicLogin` on all three (per IP and per email an hour) plus Turnstile, and by a per-hostname `limit_req_zone` at the edge |
| Malicious or compromised npm dependency | Low-Medium | code execution inside any of the 16 repos via `yarn install` - see §7 Supply chain |
| Developer accidentally echoing or committing a secret | Medium | secret lands in git history or in a Claude Code transcript (`~/.claude/projects/<slug>/*.jsonl`) permanently |
| Insider / process with direct Mongo or Redis access | Low | bypasses every application-level guard; MongoDB collection-level RBAC beneath the shared app connection is **unverified** - open question, `phase1/SYSTEM_CONTEXT.md` §7 item 3 |
| Malicious file upload through a resource service | Low-Medium | attempts to smuggle malware or a spoofed image MIME type through the upload pipeline |

### Threats, controls, residual risk

| Threat | Control | Where it lives | Residual risk |
|---|---|---|---|
| Foreign-tier access token accepted by wrong resource service | `assertTier(actual, expected)` — throws 403, missing `tier` = invalid never wildcard | `BEs/marketplace-common/src/others/assertTier.mts:21-23`; call site e.g. `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:51-61` | Closed by design as of 2026-08-05. Re-opens only if a future edit reverts to "any non-empty hash" — `impact()` on `assertTier` and `detect_changes()` are mandatory before touching this function or its call sites |
| Login response distinguishes "wrong password" from "email unconfirmed" (enumeration oracle) | Same `throwUnauthorizedError()` for both branches | `BEs/dev/marketplace-dev-public-authorization/src/lib/db/login/tryLoginUser.mts:33-41` | `userVerifyEmailResend` exists precisely because login cannot hint — the frontend must offer resend unconditionally, never conditioned on a login error |
| Credential stuffing / brute force on auth mutations | Fixed-window rate limiter, one Redis key per (bucket, identity) pair, `INCR` + `EXPIRE`, cluster-safe by construction | `BEs/marketplace-common/src/others/assertUnderRateLimit.mts` | Fixed window allows up to 2× the limit across a window boundary — accepted tradeoff ("make automation expensive, not meter a paid API") |
| Refresh cookie forged or tampered | Keygrip SHA-512 signed cookie, httpOnly | [`docs/architecture.md`](../../architecture.md) §Auth model; ADR-034; `KEYGRIP_KEK` | Minting service (`marketplace-dev-public-authorization`, `loginUser`) and verifying service (`marketplace-dev-user-authenticated-authorization`) hold the **same** keys by construction since ADR-034: one wrapped Redis record, and a service whose KEK cannot open it exits 1 at boot rather than signing. Real historical bug, from before that: 2026-08-07 audit found the user-tier authz service's `env` was copied from an unrelated project with a different Keygrip pair — every customer refresh returned 401 while both services' own suites stayed green, because each signs and verifies with itself. That shape is now a service that does not start |
| Password compromise via DB dump | bcrypt via `@node-rs/bcrypt`, `SALT_ROUNDS=14` | `BEs/marketplace-common/src/models/MongoDB/Admin.mts:46`, `.../User.mts:174`, `.../sub/LoginSubDocSchema.mts:44` | Cost factor fixed platform-wide at 14; raising it later needs a lazy re-hash-on-login migration, not designed |
| Deleted/disabled account still authenticating | `checkUserAuthorizationDisDel` gate | `BEs/marketplace-common/src/others/checkUserAuthorizationDisDel.mts:4`, invoked from `findAccountForSession.mts:48` on **every** refresh, not login-only | Disable takes effect within one access-token lifetime rather than up to the 90-day refresh expiry |
| ShopOwner logging in before manual approval | `waitApprov` read at login **and at every refresh** | `BEs/marketplace-common/src/others/checkShopOwnerApproval.mts`, projected by `tryLoginShopOwner` (4028) and `tokenInfoShopOwner` (4029) | **Enforced since 2026-08-12** — it was not before: the flag was written and displayed and read by nothing, so parking a shop owner changed nothing about their access (`phase2/BOUNDED_CONTEXT.md` §7 q8, closed). Refusing on refresh as well as at login is what makes parking bite within one access-token lifetime instead of one refresh-token lifetime. ⚠️ **This gate is what makes self-registration safe to expose** (the story *A seller registers themselves and waits for an admin* in [`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](../phase5/SHOPOWNER_ONBOARDING_APPROVAL.md) §4): `shopOwnerRegister` writes `waitApprov: true`, so a stranger may ask to become a shop owner and cannot become one — `shopOwnerAdd` writes nothing, because an admin creating an account by hand has approved it by doing so. Which mutation ran is the whole meaning of the flag. ⚠️ **Where the gate is called is load-bearing: `checkShopOwnerApproval` runs *after* the password check, never before it.** Refusing a parked account earlier would answer faster for a parked address than for an unknown one, turning the login into a timing oracle that says which addresses belong to real-but-parked shop owners — exactly the enumeration this table's login row exists to close. Reordering it to "cheap check first" is the optimisation to refuse. Since the session-revocation fix of 2026-08-13 ([`phase5/SESSION_TERMINATION.md`](../phase5/SESSION_TERMINATION.md) §3.1) the flag also *ends* sessions rather than only refusing new ones: parking an account revokes every session it holds, so the bite is immediate rather than one access-token lifetime away — [`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](../phase5/SHOPOWNER_ONBOARDING_APPROVAL.md) §4, per *Admin grants or withholds login access as one full-state write* |
| Authenticated HTML leaking cross-customer via shared HTML cache | `/account/*` is `ssr:false` + nginx cache bypasses on session-cookie presence | `marketplace-user/src/routeOptions/account.tsx:59`; `marketplace-nginx/conf.d/30-cache.conf:32-35` | The nginx half is written and exercised by `marketplace-nginx/test/run.sh` in a container, but installed on no host — see §5 |
| Malicious file upload (malware, spoofed image type) | `sharp` (reprocess), `clamscan` (AV scan), `file-type` (magic-byte check, not extension), via `graphql-upload` | resource services' `package.json`, e.g. `BEs/dev/marketplace-dev-authenticated-resource/package.json:42,44,49,56` | Only resource services carry these deps by convention — nothing structural stops a future resource service shipping without one |
| `itemCategory` depth escaping the 2-level cap | Resolver-level check, not a validator (`$jsonSchema` cannot see a parent's parent) | `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/throwIfParentNotTopLevel.mts:47-64`, called from `funItemCategoryAdd.mts:44` and `funItemCategoryUpdate.mts:52` | Every `itemCategory` mutation lives in the Admin-tier resource service by convention — adding a second one elsewhere silently removes the cap. The one non-mutation writer outside that tier, `holdItemCategory`'s `$inc` on `__v`, reaches no `idParent` and cannot |
| Draft/unpublished `company` or `item` exposed to anonymous traffic | Single shared `livePublic` / `LIVE_PUBLIC_PIPELINE` filter stage, applied once | `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts` | A new public query that forgets to compose this stage bypasses the protection entirely — no test enforces every future public query uses it |
| Secret printed to terminal / LLM transcript | `permissions.deny` + `no-secret-leak` PreToolUse hook + `pre-commit` guard + 2-level `.gitignore` | [`.claude/SECRETS.md`](../../../.claude/SECRETS.md) §1-4 | Hook inspects the command line, not a launched script's contents — `bash leak.sh` where `leak.sh` runs `cat .env` is **not caught**, documented gap |
| Secret value silently truncated by dotenv on unquoted whitespace | Rule: quote any value containing whitespace | none — a written convention, not a lint/test | An 89-char Keygrip key was truncated to 76 chars this way in the user-tier authz service's `env`, 2026-08-07, undetected until a manual cross-repo fingerprint sweep — no automated check exists for this class |
| Secret value silently truncated by a **line break inside a quoted value** | `.githooks/pre-commit` check 0 — quoting does not help here, the newline ends the value regardless | [`.claude/SECRETS.md`](../../../.claude/SECRETS.md) §3; [`docs/workflow.md`](../../workflow.md) §Environment files; RISK_REGISTER R05b | 2026-08-09: all 5 `.env` files holding `KEYGRIP_KEY_1`/`_2` had both 88-char keys wrapped after 76 chars, the 12-char tail sitting on the next line with no `KEY=` prefix, so dotenv exported a truncated key **and** a junk variable named after the tail. The user-tier authz file had the tail duplicated a second time. Repaired by rejoining; all 5 files now fingerprint-identical. The detector — a non-blank, non-comment line that does not match `^[A-Za-z_][A-Za-z_0-9]*=`, or a value opening a quote the line never closes — now **runs as pre-commit check 0** in all 15 repos that carry a pre-commit, reading the working tree because a `.env` is never staged. Residual: `--no-verify`, and merge commits, do not fire it |
| Mongo write violating collection shape | `$jsonSchema` + `additionalProperties: false` per collection | `BEs/marketplace-db-setup/lib/schemas/*.js` | MongoDB collection-level RBAC beneath the shared app connection is **unverified** — open question |

---

## 3. Auth design

### 3.1 Token model, end to end

Opaque tokens + Redis sessions. **Not JWT**, despite a stale `JWT` type surviving in some frontend `schema.graphql` slices — those slices are hand-maintained, drift from the real schema, and are dead naming only. Do not read them as design intent (`phase2/UBIQUITOUS_LANGUAGE.md` §19 bans `JWT` as a real mechanism; `phase3/CONSTRAINTS.md` CON-03).

- **Refresh token**: Koa signed cookie, Keygrip SHA-512 over the key array in the wrapped Redis record (ADR-034 — no signing key is an environment variable), httpOnly. Minted at login (`login` / `loginAdmin` / `loginUser` on `marketplace-dev-public-authorization`), rotated by the `refresh` mutation on the matching `*-authenticated-authorization` service.
- **Access token**: opaque string sent as `Authorization: Bearer access:<token>` header, validated on every resource-service call by a Redis lookup — never decoded, never trusted on its own.
- Both tokens are looked up, never parsed for claims. There is no signing key that proves anything about a token's *content* — only Redis membership does that. This is the reason a Redis compromise is catastrophic (§2) where a leaked token alone is bounded by TTL.

```ts
// BEs/marketplace-common/src/others/assertTier.mts:21-23
export function assertTier(actual: string | undefined, expected: Tier): void {
	if (actual !== expected) throw throwForbiddenError()
}
```

### 3.2 Three-tier session model

Every session hash carries a `tier` field — `'admin' | 'shopOwner' | 'user'`, the `TIER` constant (`BEs/marketplace-common/src/others/Tier.mts:12-18`). Every resource/authorization service asserts its own expected tier before trusting `ctx.state.user`. Full reasoning recorded in `docs/decisions/authorization-service-consolidation.md`; this doc summarises, does not re-argue:

- **A missing `tier` is invalid, not a wildcard.** `actual !== expected` has no carve-out branch for `undefined`. Sessions minted before the field existed (pre-2026-08-05) fail closed rather than being grandfathered in as trusted — the alternative would have kept the cross-tier hole open for up to `REFRESH_TOKEN_EXPIRY` (90 days).
- **Mismatch answers 403, never 401.** The caller authenticated correctly, just against the wrong tier's session. A 401 tells a client "refresh and retry," which cannot fix a tier mismatch and would mask the real condition.
- **`REDIS_KEY` stays one shared prefix across all 9 services, on purpose.** The single `marketplace-dev-authenticated-logout` service (port 4030, serves all 3 tiers) deletes a session by token content alone and never asks which collection minted it — a per-tier prefix would break that service structurally. `assertTier` is therefore the *entire* boundary holding tiers apart; the shared prefix is a decided tradeoff, not an oversight (`phase3/CONSTRAINTS.md` CON-04).

Call site, one of three near-identical (each resource service hardcodes its own `TIER.*`):

```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:51-61
const redAccessSession = await redisClient.hGetAll(`${process.env.REDIS_KEY}${accessToken}`)
if (redAccessSession != null && Object.keys(redAccessSession).length !== 0) {
	const redData = { ...redAccessSession } as unknown as IRedisDataAdmin
	assertTier(redData.tier, TIER.admin)
	ctx.state.user = makeAuthCtx(redData)
} else throwAccessTokenExpiredOrDeleted()
```

### 3.3 The hole this closed

Until 2026-08-05, `authorizationAuthenticatedResourceHandler.mts` set `ctx.state.user` on **any non-empty Redis hash**, with no tier check at all. Because all 9 services share one `REDIS_KEY` prefix, a valid `Admin` access token was accepted by the ShopOwner resource service, and the reverse — any authenticated caller of one tier could reach another tier's domain data by presenting their own token to the wrong port. `assertTier` is the fix, and it is the *only* thing standing between the shared key space and cross-tier data access — treat any edit near this function as `impact`-checked, per this repo's Always-Do rule, before touching it.

### 3.4 `checkUserAuthorizationDisDel` and account-state gates

Shared guard, gates every authenticated resource call and every token refresh on `deleted` / `disabled`:

```ts
// BEs/marketplace-common/src/others/checkUserAuthorizationDisDel.mts:4
export function checkUserAuthorizationDisDel(user: IAuthorizationDisDel) {
```

Invoked from `findAccountForSession.mts:48`, which runs on **every** refresh, not just at login — a disable/delete takes effect within one access-token lifetime rather than waiting out the refresh token's 90-day window.

Per-tier divergence beyond the shared gate:

- **`shopOwner`** additionally carries `waitApprov` (manual Admin approval gate, `BEs/marketplace-db-setup/lib/schemas/shopOwner.js`) and `onboardingStep` / `onboardingDone` (`BEs/marketplace-common/src/models/MongoDB/sub/LoginSubDocSchema.mts:25,28`). `waitApprov` is written by `shopOwnerUpdateStatus` (Admin tier, `$set` when true and `$unset` when false, so the field is truthy-or-absent and never `false`) and, since 2026-08-12, raised at creation by `shopOwnerRegister` on the public service — the one write of it outside the Admin tier, and the only one an unauthenticated caller can cause. Read by the two BC-01 gates. `onboardingStep` is read into the session (`BEs/dev/marketplace-dev-authenticated-resource/src/lib/auth/makeAuthCtx.mts:11-12`) and written only by `shopOwnerUpdatePreferences`, an Admin typing a value in — **nothing advances it or `onboardingDone` as a side effect of the shop owner's own progress**, confirmed by grep across every `mutations/` directory. ⚠️ **That half became a design decision on 2026-08-13, per *Admin sets onboarding and session preferences* ([`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](../phase5/SHOPOWNER_ONBOARDING_APPROVAL.md) §4): the admin's hand is the writer, and stays the only one until a shop-owner onboarding flow is designed.** It is deferred work rather than a gap nobody noticed, and neither field is a security control — no gate anywhere reads either one, so what is deferred costs nothing in this document's terms. *A seller registers themselves and waits for an admin* (same record, §4) is why it is worth naming at all: a self-registered account is approved carrying a login and nothing else (`phase2/BOUNDED_CONTEXT.md` BC-03, `phase5/RISK_REGISTER.md` R53).
- **`user` has no `waitApprov`.** A customer self-serves with nothing to approve — registration requires only `login` + `registeredAt`, and no manual approval step exists for the `User` tier by design (`docs/data-model.md`, `user` divergence #2). A shop owner may now self-serve too, and that is precisely where the two differ: the seller's account exists from the same moment and may not be used until an admin says so.
- **`loginUser` refuses an account whose `emailVerify.valid` is false**, returning the **same generic error** as every other login failure:

```ts
// BEs/dev/marketplace-dev-public-authorization/src/lib/db/login/tryLoginUser.mts:33-41
await checkUserAuthorization(user, password, user.login.password)

if (!user.emailVerify?.valid) {
	throw throwUnauthorizedError()
}

return user
```

This is deliberate anti-enumeration: telling an unverified caller "confirm your email" here would tell everyone else who registered that the email exists. The generic-error requirement is why `userVerifyEmailResend` exists as an unconditional option on the login screen rather than a conditional hint.

### 3.5 Password storage

bcrypt via `@node-rs/bcrypt`, `SALT_ROUNDS=14`, applied identically across all 3 auth-bearing collections:

```ts
// BEs/marketplace-common/src/models/MongoDB/sub/LoginSubDocSchema.mts:44
this.password = await bcrypt.hash(this.password, SALT_ROUNDS)
```

Same call shape in `BEs/marketplace-common/src/models/MongoDB/Admin.mts:46` and `.../User.mts:174`. Stored hash is exactly 60 chars (`$2y$14$…`), enforced by the `$jsonSchema` `minLength`/`maxLength: 60` on `login.password` — a shorter or longer string fails the write, not just the app-level check.

### 3.6 Application-level rate limiting on auth paths

Fixed-window limiter, one Redis key per `(bucket, identity)` pair — `INCR` + `EXPIRE` on a single key, cluster-safe by construction (a multi-key op would throw `CROSSSLOT`):

```ts
// BEs/marketplace-common/src/others/assertUnderRateLimit.mts
export interface IRateLimitStore {
	incr(key: string): Promise<number>
	ttl(key: string): Promise<number>
	expire(key: string, seconds: number): Promise<unknown>
}
```

Guards **both** registrations, login, password reset and verification-mail resend — "each one either mints a document, sends an email or tests a password, so an unbounded caller turns them into a spam relay, an enumeration oracle and a bcrypt-powered CPU sink respectively" (comment at the same file). Login limits by **both** email and IP (two calls, two buckets); resend limits by email alone. Callers pass the identity themselves — never a raw password or token, since the key lands in Redis in plaintext. Fixed window, not sliding: accepts up to 2× the limit across a window boundary, traded deliberately for the O(1) cost of a single integer key instead of a sorted set.

This is the platform's only application-level auth-path rate limiting. The nginx `limit_req_zone` directives in §5 are a second, independent layer at the edge — not a copy of this one, and not yet installed anywhere (§5).

> ⚠️ **Superseded 2026-08-28.** The claim above stopped being true on 2026-08-10, when a fix landed on
> `refresh` — the one authenticated endpoint that had carried no limiter of any kind — with two further
> `assertUnderRateLimit` call sites, both defined in
> `BEs/marketplace-common/src/others/refreshRateLimit.mts` and both called from the three authorization
> services' middleware (`marketplace-dev-authenticated-authorization`,
> `marketplace-dev-admin-authenticated-authorization`, `marketplace-dev-user-authenticated-authorization`):
>
> - **Pre-lookup** — `guardRefreshAttempt`, bucket `REFRESH_ATTEMPT_BUCKET` (`'refresh:token'`), keyed on
>   `hashSessionToken(presentedRefreshToken)` — **20 attempts / 60 s**
>   (`REFRESH_ATTEMPTS_PER_WINDOW` / `REFRESH_ATTEMPT_WINDOW_SECONDS`). This is the only Redis structure an
>   attacker can create at will, one key per distinct garbage token, which is why its window is short.
> - **Post-lookup** — `guardFamilyMintRate`, bucket `REFRESH_FAMILY_BUCKET` (`'refresh:family'`), keyed on
>   `familyId` — **20 attempts / 3600 s** (`REFRESH_MINTS_PER_WINDOW` / `REFRESH_FAMILY_WINDOW_SECONDS`). It
>   meters a different phenomenon on a different timescale — mints, not requests, by a lineage rather than a
>   presented token — and a single shared window would make one of the two buckets useless.
>
> The sizing rationale for both windows — "two windows, not one" — lives in
> `../phase5/RISK_REGISTER.md` R52. No
> control described in the paragraph above changed — the paragraph is simply no longer the complete list.

### 3.7 SSR cache boundary as a security control

`marketplace-user` is the one server-rendered surface on the platform, and the SSR/CSR split is a security boundary, not a performance choice:

```ts
// marketplace-user/src/routeOptions/account.tsx:59
{ ssr: false as const, head, component: Account }
```

Public routes (`/`, `/shops`, `/shop/:slug`, `/category/:slug`) render server-side; `/account/*` never does. Pairs with the nginx cache-bypass decision, keyed on session-cookie **presence**, never parsed:

```conf
# marketplace-nginx/conf.d/30-cache.conf:32-35
map $http_cookie $mkt_user_no_cache {
	default                            0;
	"~*(^|;\s*)refresh_token(\.sig)?=" 1;
}
```

⚠️ One map, not the two this document originally quoted. `proxy_cache_bypass` (skip the lookup) and `proxy_no_cache` (skip the store) both read this single variable: a request with a session must do both, there is no case where one is true and the other is not, and two maps were somewhere for those answers to drift apart. Anything still citing `$mkt_user_has_session` is citing a variable that no longer exists.

Both halves are load-bearing, and weakening either alone is enough to leak one customer's page to another: if `/account/*` were ever rendered server-side, a shared `proxy_cache` could serve customer A's authenticated HTML to customer B on the next request for the same cache key; if the cache stopped bypassing on the cookie, even a correctly-`ssr:false` route's cached shell could be replayed. The SSR server also builds a **new urql client per request** — no shared client, no `cacheExchange` at that layer — so one visitor's in-flight response can never leak into another's (`marketplace-user/src/api/ssr.ts:44-52`).

---

## 4. Credential management

### Rules

- No secret value may be read, echoed, or committed: `.env`, `.env.*`, `.npmrc`, `.yarnrc`, `.netrc`, `*.pem`, ssh keys. Placeholder templates named `env` and `npmrc` (no leading dot) are safe and the only files this doc or any agent working here reads directly.
- Protected values, named explicitly across the codebase: `KEYGRIP_KEK`, `REDIS_PASSWORD`, `DSN`, `MONGODB_URI`, `QODANA_TOKEN`, `SOCKETLABS_SERVER_ID`, `SOCKETLABS_SERVER_APIKEY`, any npm token.
- Every credential is referenced by env var, never inlined — `process.env.KEYGRIP_KEK`, `process.env.REDIS_PASSWORD`, etc. in each service's `src/index.mts` `REQUIRED_ENV_VARS`. ⚠️ **The list is per service, not universal.** `REDIS_PASSWORD` is in all 9; `KEYGRIP_KEK` is in **6** — the four `*-authorization` services and `marketplace-dev-authenticated-logout`, i.e. exactly those that mint or verify the refresh cookie, plus `marketplace-dev-admin-authenticated-resource`, which signs nothing and holds the KEK only so `keygripRotate` can reseal the record. The other three `*-resource` services authenticate over a bearer header checked against Redis, sign no cookie, and carry no keygrip variable in `REQUIRED_ENV_VARS` or in their `env` template. ⚠️ **`KEYGRIP_KEY_1`/`KEYGRIP_KEY_2` are gone** (*`KEYGRIP_KEY_1`/`_2` are gone, and the documents stop describing five files*, [`phase5/IDENTITY_ACCESS.md`](../phase5/IDENTITY_ACCESS.md) §4) — an eslint rule in `src/**` of the five signing services refuses `process.env.KEYGRIP_KEY_` by name, so a service cannot quietly go back to signing with a key of its own.
- **Quote any value containing whitespace.** dotenv terminates a bare value at the first space or `#` and reports nothing — the mechanism behind the 89→76 char Keygrip-key truncation in §2. Use single quotes; double quotes expand `\n`/`\r` escapes, which is its own trap for a key that should be opaque bytes.
- ⚠️ **Quoting is not enough on its own: a quoted value can still be broken across two physical lines.** dotenv stops the value at the newline and hands back the truncated prefix, and the tail — which is a bare fragment with no `KEY=` on it — is then parsed as its own garbage assignment. Found in 5 of the 9 `.env` files on 2026-08-09 (§2). A value must be exactly one line. It is visible in the one listing the guard allows — `grep -oE '^[A-Za-z_0-9]+' .env` — because the orphan tail is read as a variable and shows up as a bogus, non-`SCREAMING_SNAKE_CASE` key name. [`docs/workflow.md`](../../workflow.md) §Environment files.
- Secret files are inspected by **key name or salted fingerprint only, never by value**: `grep -oE '^[A-Za-z_0-9]+' .env` for names, `sha256(key + ' ' + value)` first-six-hex for cross-repo agreement checks. Never `cat`, never a value in a terminal — a value printed here is sent to the model API and written unencrypted to `~/.claude/projects/<slug>/*.jsonl`, with no un-send.

### Pattern

```bash
# BEs/dev/marketplace-dev-public-authorization/env  (committed placeholder template — safe)
KEYGRIP_KEK=
REDIS_PASSWORD=
MONGODB_URI=
```

The `KEYGRIP_KEK` line belongs to this template because `public-authorization` signs the refresh cookie
and must unwrap the key record to do it. Three of the four `*-resource` templates show the same file
**without** it — see the Rules above for the fourth, which rotates the record.

Real values live in each repo's untracked `.env`, one file per repo, never shared as a single platform-wide file — because the 9 backend `env` templates enumerate `REQUIRED_ENV_VARS` per service and some values (`KEYGRIP_KEK`, `REDIS_KEY`) must be **byte-identical across specific repo pairs** — the KEK differing is at least loud, since the service that holds a wrong one refuses to boot — while others (`MONGO_TEST_DB` family) must be **unique per repo** — see §6.

### Bootstrap responsibility

No bootstrap script generates `.env` files on this platform — each repo's untracked `.env` is populated by hand per machine, against the committed `env` template's key list. Nothing here auto-provisions a KEK or a shared keyspace prefix; getting two related services' copies to agree is a manual, currently unverified-by-tooling step (§2). This is a gap: **the enforcement layers below stop a secret leaving the machine, and since 2026-08-09 they stop one being silently cut in half on the way in, but nothing stops two machines' secrets from silently disagreeing.** Shape is now gated; equality is not. The only check for equality remains a manual fingerprint sweep, `sha256(key + ' ' + value)` per repo (`docs/workflow.md` §Environment files).

Four enforcement layers on the write/leak side, all in [`.claude/SECRETS.md`](../../../.claude/SECRETS.md):

1. **`permissions.deny`** (`~/.claude/settings.json`) — denies the `Read` tool outright on `**/.env`, `**/.env.*`, `**/.npmrc`, `**/.yarnrc*`, `**/.netrc`, `**/*.pem`, `**/*.p12`, ssh keys. Declarative, holds even if hooks are disabled.
2. **`no-secret-leak` PreToolUse hook** (`~/.claude/hooks/no-secret-leak.cjs`) — matches `Bash|Read|Grep|NotebookEdit`, denies content reads (`cat .env`), indirection (`echo $(cat .env)`), copy/transmit (`scp`, `curl -F`), staging (`git add .env`), shell expansion of a protected var (`echo $KEYGRIP_KEY_1`), bare env dumps (`printenv`), and inline interpreter lookups (`node -e "…process.env.X"`). Allows metadata verbs and key-name extraction. **Known limit**: inspects the command line, not a launched script's contents — `bash leak.sh` is not caught.
3. **`pre-commit` guard**, tracked at `.githooks/pre-commit` in all 16 repos — `marketplace-nginx` was the last to get one and, having no `package.json`, carries this guard and no gate after it (ADR-030) — opens with **check 0**, the only check on the platform that reads the *working tree* rather than the staged index (the file it exists for is git-ignored and never staged): it blocks when that repo's `.env`, `.env.*` or `env` holds a non-blank, non-comment line that is not `KEY=VALUE`, or a value opening a quote the line never closes, which are the two signatures of one value broken over two physical lines (§2, R05b). It prints file, line and key name, never a value. Then the two staged-secret scans: blocks a commit whose staged path looks like a secret file, or whose staged added lines contain a high-entropy pattern (npm token, PEM header, 40+ char non-placeholder `KEYGRIP_KEY_*`, a `QODANA_TOKEN`/`SOCKETLABS_*`/`REDIS_PASSWORD` literal ≥16 chars, a Mongo URI with a ≥10 char password). A self-declared placeholder line (`KEY=test-…`, `dummy`/`fake`/`sample`/`example`/`changeme`) is exempted so committed templates and vitest fixtures pass without `--no-verify`. Escape hatch is `git commit --no-verify`, which is a gap by design — nothing prevents a developer from using it.
4. **Two-level `.gitignore`** — `~/.config/git/ignore` (machine-wide, protects a repo before anyone thinks about it) plus each repo's own `.gitignore`. Verified 2026-08-09: no `.env` path tracked in any of the 16 repos, none in their histories.

⚠️ **Not fixed as of this baseline**: `BEs/marketplace-db-setup/setup/mongodb.js` is tracked and contains live-looking database credentials in `mongodb+srv://` URIs. The pre-commit guard blocks the *next* edit to those lines, but does not retroactively purge history. Rotation and history-purge (`git filter-repo`, free before first push) is a standing action item, not yet done.

---

## 5. Network security

### Service binding

All 9 backend services bind the **unspecified address** (`::`, every interface) — `httpServer.listen({ port })` with no `host` key, on every `src/index.mts`. This is intentional: the integration suites fetch `http://127.0.0.1:<port>`, and binding a LAN address in the env template would break all nine. A prior `hostname:` key was a no-op (`net.Server.listen` has no such option) and has been removed rather than converted, with a comment at each call site recording the wildcard bind as deliberate.

`marketplace-user`'s `serve.mjs` is the **one deliberate exception** and binds loopback only:

```js
// marketplace-user/serve.mjs:34
const HOSTNAME = '127.0.0.1'
```

It has no authentication of its own — reaching it directly bypasses every nginx rate limit and cache rule documented below.

### nginx security surface — written and tested, installed nowhere

`marketplace-nginx/` at the workspace root is the edge: `conf.d/` (hardening, upstreams, rate limits, cache, TLS), `snippets/` (the proxy body and two header policies) and a vhost per hostname in `sites-available/` — apex, `shopowner.`, `admin.`. The customer-only copy this section used to cite, `marketplace-user/docs/nginx/*.conf`, is deleted.

**Nothing is installed on this machine** — no `/etc/nginx`, no `nginx` binary in `PATH` — so every claim below is still what the config *specifies* rather than a control running in production. It is no longer unverified, though, which is the part that changed: `marketplace-nginx/test/run.sh` starts a container, runs `nginx -t`, then drives every behavioural assertion in `test/suite.sh` against stand-in backends — including that a `Set-Cookie` emitted exactly the way koa-utils emits it comes back `Secure; HttpOnly; SameSite=Strict` from all seven cookie-minting endpoints. Five real defects that `nginx -t` accepts were found and fixed this way; [`marketplace-nginx/README.md`](https://github.com/Axiumine/marketplace-nginx/blob/main/README.md) lists them.

Upstream map, all loopback, matching the port table in [`docs/architecture.md`](../../architecture.md) §Services (`marketplace-nginx/conf.d/10-upstreams.conf:24-56`, comments elided):

```conf
upstream mkt_user_ssr        { server 127.0.0.1:3045; keepalive 32; }
upstream mkt_public_resource { server 127.0.0.1:4027; keepalive 16; }
upstream mkt_public_authz    { server 127.0.0.1:4028; keepalive 16; }
upstream mkt_user_resource   { server 127.0.0.1:4032; keepalive 16; }
upstream mkt_user_authz      { server 127.0.0.1:4031; keepalive 16; }
upstream mkt_owner_resource  { server 127.0.0.1:4026; keepalive 16; }
upstream mkt_owner_authz     { server 127.0.0.1:4029; keepalive 16; }
upstream mkt_admin_resource  { server 127.0.0.1:4024; keepalive 16; }
upstream mkt_admin_authz     { server 127.0.0.1:4025; keepalive 16; }
upstream mkt_logout          { server 127.0.0.1:4030; keepalive 8;  }
upstream mkt_nominatim       { server 127.0.0.1:8080; keepalive 8;  }
```

⚠️ **The `Secure` flag on both auth cookies is set here and nowhere else.** `@axiumine/koa-utils` ships `secure: false` with a comment saying to rewrite it at the edge; `marketplace-nginx/snippets/proxy-backend.conf` does it with `proxy_cookie_flags ~ secure httponly samesite=strict;` (`~` is the empty regex — it matches every cookie name). Serving any authorization endpoint without that snippet in front of it puts a session cookie on the wire without `Secure`.

**TLS + HSTS + response headers** (`marketplace-nginx/snippets/security-headers-public.conf:26-31`):

```conf
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options    "nosniff" always;
add_header Referrer-Policy           "strict-origin-when-cross-origin" always;
add_header Cross-Origin-Opener-Policy  "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
add_header Permissions-Policy "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()" always;
```

Plus a `Content-Security-Policy` (`marketplace-nginx/snippets/security-headers-public.conf`; the panels get a strictly tighter one from `security-headers-private.conf`). Two load-bearing nginx traps recorded in the files themselves. The value must sit on **one line**: nginx does no backslash line-continuation inside a quoted string, so the readable one-directive-per-line form embeds a literal LF and the header is dropped entirely — silently, with every other header in the same block still working. And `add_header` does **not** merge — any `location` block declaring even one `add_header` of its own discards every header inherited from the `server` block, so every location that needs these headers must repeat them, not assume inheritance.

**Auth-path rate-limit zones**, edge layer independent of the application-level limiter in §3.6 (`marketplace-nginx/conf.d/20-rate-limit.conf`):

```conf
limit_req_zone $binary_remote_addr zone=mkt_auth:10m       rate=20r/m;   # customer login / reset
limit_req_zone $binary_remote_addr zone=mkt_verify:10m     rate=30r/m;
limit_req_zone $binary_remote_addr zone=mkt_public:20m     rate=120r/m;
limit_req_zone $binary_remote_addr zone=mkt_geocode:10m    rate=60r/m;
limit_req_zone $binary_remote_addr zone=mkt_owner_auth:10m rate=20r/m;   # shopowner. vhost
limit_req_zone $binary_remote_addr zone=mkt_owner_api:10m  rate=300r/m;
limit_req_zone $binary_remote_addr zone=mkt_admin_auth:10m rate=10r/m;   # admin. vhost
limit_req_zone $binary_remote_addr zone=mkt_admin_api:10m  rate=300r/m;
```

⚠️ **Zone name = counter, so the three logins need three zones.** All of them reach the same process (public-authorization, 4028) and the edge is the only layer that still knows which hostname was asked for; sharing one zone would let a credential-stuffing run against admin accounts spend the customers' allowance. `marketplace-nginx/test/suite.sh` asserts each budget engages independently.

⚠️ **There is deliberately no registration zone**, and this is the one place where the app-layer limiter is the stronger control rather than a redundant one. A `mkt_register` zone at 5r/m existed, attached to an `/api/register` location the application has never had, and it metered nothing. It was removed rather than repointed: registration is a GraphQL POST with no URL of its own, so at the edge it is bounded by `mkt_public` like every other public write, and the real limit is `guardPublicWrite` (§3.6) — two Redis counters per hour, one on `ctx.ip` and one on **the email address**. A zone keyed on `$binary_remote_addr` never sees the address, so no edge configuration can stop a distributed source mail-bombing a single inbox.

**Cache bypass on session cookie** — the nginx half of the §3.7 mechanism, `marketplace-nginx/conf.d/30-cache.conf:32-35` (quoted there in full). PMTiles range requests and the Nominatim proxy topology are documented in `phase1/SYSTEM_CONTEXT.md` §5.8-5.9 and are out of Phase-3 auth scope.

⚠️ **Two gaps came out of cross-checking the docs against the `marketplace-user` tree, and they closed in opposite directions.** The `/api/register` proxy was an unbuilt route rather than a stale doc, and the block was deleted rather than the route built — registration is client → GraphQL `userRegister` (or, since 2026-08-12, `shopOwnerRegister`) straight to `/public-resource`, and the guard that matters (`guardPublicWrite`, per IP and per email) is one nginx cannot replicate. The missing admin-facing vhost was also real: nothing under `marketplace-user/docs/nginx/` described ports 4024/4025, because only the customer surface had ever been written. All three vhosts now live in `marketplace-nginx/sites-available/` at the workspace root and the duplicate directory in `marketplace-user` is gone.

### Upload handling

Only **resource** services carry the upload/scan toolchain — `sharp` (image reprocessing), `clamscan` (AV scan), `file-type` (magic-byte detection, not extension-based), `graphql-upload` (multipart GraphQL upload spec):

```json
// BEs/dev/marketplace-dev-authenticated-resource/package.json:42,44,49,56
"clamscan": "^2.4.0",
"file-type": "^22.0.1",
"graphql-upload": "^17.1.0",
"sharp": "^0.35.3",
```

**Authorization** services carry none of these — verified absent from `marketplace-dev-public-authorization/package.json`. This matches the concern split in [`docs/architecture.md`](../../architecture.md) §Services: authorization does token lifecycle only, resource does domain data including anything file-shaped. A new upload path belongs in a resource service by construction; adding one to an authorization service would be a structural regression.

---

## 6. Data residency

| Data | Where it goes | User control |
|---|---|---|
| Session hashes (access/refresh tokens, `tier`, account id) | Redis cluster, `${REDIS_KEY}<token>` | Deleted on logout (BC-02, all 3 tiers → port 4030) or natural expiry; no self-serve "log out everywhere" exists |
| `admin` / `shopOwner` / `user` documents | MongoDB, one collection each, `$jsonSchema`-validated | Soft-delete convention (`deleted`: date, never removed; `disabled`: bool) — a "deleted" account's document persists indefinitely (`BEs/marketplace-db-setup/lib/schemas/account.js`) |
| `user.addresses[]` incl. GeoJSON `position` | Embedded in the `user` document, MongoDB | Customer can add/remove/re-label addresses and set `defaultAddress`; no export/download control exists |
| `company` legal-identity fields (`vatNumber`, `taxCode`, `certifiedEmail`, `legalName`) | MongoDB `company` collection | ShopOwner-entered at company creation; retiring a company (`companyDel`) stamps `deleted` but keeps `vatNumber`/`certifiedEmail` uniqueness occupied permanently — deliberate, one VAT number is one company forever |
| Password hashes | MongoDB, `login.password`, bcrypt cost 14 | Never exported, never returned by any resolver's projection (not independently re-verified per resolver this session) |
| Verify-email / reset-password links | Sent via SocketLabs, delivered to the account's own email address | One-time hash-bearing links, `GET /check/verify-email/:email/:hash` and `…-user/:email/:hash` — the only 2 REST endpoints besides the health check. ⚠️ **Measured 2026-08-11**: being GETs, both landed in the nginx access log's `"$request"` with the address and the live hash in plaintext, on two vhosts — and so did the two reset links, `/reset-password/:email/:hash` and `/x/reset/:email/:hash`, which the probe never drove. ✅ **Fixed the same day** (*The mailed links stop writing a live credential to the access log*, [`phase5/TELEMETRY_EGRESS_HARDENING.md`](../phase5/TELEMETRY_EGRESS_HARDENING.md) §4): the format redacts the tail of all four, and the `Referer` beside it, at http level. ⚠️ The credential is still **in the URL** — Cloudflare's logs, the SSR disk cache, the browser history and the mail client keep it — and ***The customer's reset credential leaves the URL*** (same record, §4) closes the closable half by moving the customer reset link into the URL fragment, which no browser transmits. The two verify links stay in the path: they are REST `GET`s a fragment never reaches, and their hash is spent by the request that logs it. `docs/report/log-sink-inventory.md` §5 + §10 |
| Error/perf traces | Sentry SaaS, opt-in on non-empty `DSN` | `dataCollection` explicitly denies `userInfo`, `cookies`, most `httpHeaders`, `httpBodies`, `urlQueryParams` (`marketplace-user/src/instrument.ts:30-47`) — the app handles customer passwords and a partial block would leak more than the single line it replaced. ⚠️ **Measured 2026-08-11**: `httpBodies: []` denies the **span attribute** only. The raw GraphQL POST body still reaches `event.request.data` and was observed on the wire with a plaintext `password` in it — `docs/report/sentry-event-capture.md` §5, and *The request body never reaches Sentry* in [`phase5/TELEMETRY_EGRESS_HARDENING.md`](../phase5/TELEMETRY_EGRESS_HARDENING.md) §4 |
| Static analysis reports | Qodana Cloud, one project + token per repo | Platform-internal only, never customer-facing; a misdirected token corrupts another repo's baseline, not a data leak to a third party |

### Never protected — the feature is permanently out of scope

The following have **no control**, because the feature they belong to does not exist and is never going to. Do not design a control for them — `phase3/CONSTRAINTS.md` §5 forbids presuming a shape for BC-11 (Ordering & Fulfilment [WILL NOT BUILD]), and [ADR-038](./adr/ADR-038-commerce-is-permanently-out-of-scope.md) (2026-08-27) closes the context that would have needed one. ⚠️ **A future control for any row below is not pending work.** An unprotected asset that will never exist is not a residual risk; it is not an asset:

- **Payment data** — no gateway chosen, no integration, no field anywhere on the platform.
- **Order data** — no `order` collection, no state machine, no resolver.
- **Cart data** — no `cart` collection.
- **Delivery addresses in transit to a courier** — no delivery concept exists, no collection, no resolver, no design; `user.addresses[]` is a customer's own saved-address book, not a delivery record, and nothing reads it for fulfilment today.
- **Price** — deliberately and permanently absent from `item` (`BEs/marketplace-db-setup/lib/schemas/item.js`) for exactly this reason: a price with nothing to buy is a guess at a decision nobody is going to make, and so is any control protecting it. A display-only price was offered and refused on 2026-08-27 (ADR-009 §Note).

When any of these get built, this document requires a new version — per its own Mutability header — not a retrofitted paragraph here.

---

## 7. Supply chain

| Dependency | Risk | Mitigation |
|---|---|---|
| `@axiumine/marketplace-common`, published to `registry.npmjs.org` at `3.0.0`, consumers on `^3.0.0` (`ADR-037`, `ADR-047`) | 9 services depend on a package whose *released* build is the only thing a `yarn install` can resolve — and since 2026-08-30 the only thing any consumer runs at all: no local copy exists to diverge from it. The residue is that an edit nobody published is silently absent, with no error at the call site until the symbol is used. ⚠️ This cell used to read *"not on any registry … 404s on `registry.npmjs.org`"*, true until 2026-08-26, and then described a local sync script that is now deleted | the nine-step release flow in `BEs/marketplace-common/CLAUDE.md` §Publishing a release — every consumer's build is identified by a version and pinned by its own `yarn.lock`; `yarn test:contract` gates the `exports` map |
| `@axiumine/koa-utils` | Second internal package, seventeenth repo outside this workspace, same class of risk | Lives outside this workspace, so none of the release discipline recorded here is observable from it — verify its consumption path before assuming parity with `marketplace-common` |
| npm registry as a whole (`yarn install` across 9 services + 3 frontends) | Malicious or compromised published version of any transitive dependency | `yarn.lock` per repo pins exact versions. ⚠️ **Corrected 2026-08-13.** This cell used to read "no automated dependency-audit gate found … **not a control that exists today**", which was true of what the gate *did* and wrong about what was wired: Qodana's `VulnerableLibrariesLocal` had been running on every commit and every push in all fourteen repos, querying no advisory feed and reporting zero problems — indistinguishable from a passing scan (`phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md` §6, R21). Since then the control is `trivy fs`, pinned at `aquasec/trivy:0.70.0`, HIGH and CRITICAL, production dependencies only, in the `pre-push` of the fourteen repos with a `yarn.lock` plus the parent's for `marketplace-services-status`. It was exercised in both directions before landing and blocks `marketplace-dev-public-resource` today over R49's `axios@0.21.4`. There is no `.trivyignore` anywhere, and no CI to fall back on — the two git hooks are the whole apparatus |
| `@node-rs/bcrypt` (native binding) | Native code in the password-hashing path | Standard, widely-used package; no additional sandboxing found |
| `clamscan` | Depends on an external ClamAV daemon/signatures being present and updated on the host running the resource service | Signature freshness is an operational concern outside this repo's tooling — not verified as automated here |
| Qodana Cloud (JetBrains SaaS) | Every repo's `pre-commit`/`pre-push` sends code to a third-party static-analysis service | One project + token per repo, `SKIP_QODANA=1` escape hatch exists (used only where documented, e.g. historically for `marketplace-services-status` before its project was provisioned) |
| SocketLabs (transactional email SaaS) | Credential (`SOCKETLABS_SERVER_APIKEY`) compromise → spoofed verify/reset emails sent as the platform | Credential handling per §4; no key-rotation schedule found in the repo — operational gap |
| Cloudflare Turnstile | Client-side widget + server-side `siteverify` call, both third-party | Server verifies the token server-side rather than trusting client assertion alone (`phase1/SYSTEM_CONTEXT.md` §5.10) |

---

## 8. Compliance

- **NFR-SE01–SE12** (`phase1/NFR.md` §2.4) are the security requirement set this document exists to satisfy — opaque-token sessions, Keygrip-signed cookies, bearer-token validation, bcrypt cost 14, tier assertion with fail-closed missing-tier and 403-not-401, anti-enumeration on `loginUser`, the no-substitute-for-a-session boundary, the SSR/cache boundary, response headers, `$jsonSchema` validation, and the four-layer secret-handling regime. All 12 are 🔴 Critical, non-negotiable per `phase1/NFR.md` §3 priority matrix, requiring a written owner decision + a new `PDR.md` version to change (§4 NFR change control).
- **NFR-CO01** (secrets) — 🔴 Critical, satisfied by the §4 credential-management layers.
- **NFR-CO02** (GDPR) — 🟡 Medium, and **no longer an open question**: the platform owner decided on 2026-08-26 that GDPR is in scope (`phase1/NFR.md` §2.7, open question 1 closed). Deciding it was out of Phase 3 scope (`phase3/CONSTRAINTS.md` §5) and it was decided elsewhere, as that constraint intended. ⚠️ **This document still does not claim GDPR compliance, and in scope is not compliant.** `user.personalData` and `user.addresses[]` are PII by any reasonable reading and are encrypted whole (ADR-029); what §4's controls satisfy is the technical measures limb (Art. 32), not lawful basis, erasure, portability, retention or processor agreements — six obligations that have no implementation and are carried by `phase1/NFR.md` open question 6.
- **NFR-AV01/AV02** (three-authorization-service topology) — 🔴 Critical, load-bearing for availability under the crash-domain argument in [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md): one `process.exit(1)` taking down all three tiers' token lifecycle was ranked worse than the deduplication a merge would buy. Security and availability intersect here — do not re-propose the merge as a security simplification; it was evaluated as one and rejected.
- **NFR-MA01/MA02/MA05** (100/100 coverage+mutation, never-lower gates) — 🔴 Critical, the mechanism that keeps every control in §3-§5 from silently regressing. A weakened threshold is itself a security regression on this platform, not a tooling nicety.
- No SOC2/HIPAA/PCI-DSS applicability found or claimed anywhere in Phase 1/2 docs — none apply, and PCI-DSS in particular never will: there is no payment surface (§6) and there will not be one (ADR-038, 2026-08-27). No health data either.

---

## 9. Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Does MongoDB collection-level RBAC exist beneath the shared application connection, independent of `assertTier`? | platform owner / DBA | open — `phase1/SYSTEM_CONTEXT.md` §7 item 3, not verified this session |
| 2 | Whether a freshly created `ShopOwner` starts `waitApprov`-gated or ungated | platform owner | **closed 2026-08-12, per *A seller registers themselves and waits for an admin* in [`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](../phase5/SHOPOWNER_ONBOARDING_APPROVAL.md) §4 — it depends on who created it.** `shopOwnerRegister` writes `true`, `shopOwnerAdd` writes nothing. No backfill: every document on disk predates the public form, so every one of them is Admin-created and correctly ungated (`phase2/BOUNDED_CONTEXT.md` BC-03 hotspot 1 and §7 q3, both closed) |
| 3 | What advances `onboardingStep`/`onboardingDone` — nothing but an Admin calling `shopOwnerUpdatePreferences`, and a self-registered seller is approved with an empty `personalData` | platform owner | **Closed 2026-08-13, per *Admin sets onboarding and session preferences* in [`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](../phase5/SHOPOWNER_ONBOARDING_APPROVAL.md) §4** — an Admin calling `shopOwnerUpdatePreferences`, by decision, until the onboarding flow is designed. Neither field gates anything, so nothing in this document depends on the answer; residual `phase5/RISK_REGISTER.md` R53 |
| 4 | Is the documented `/api/register` SSR proxy route stale doc, or an unbuilt route? | platform owner | **closed** — unbuilt, and deleted rather than built; it would have weakened both controls it claimed to add. `phase1/SYSTEM_CONTEXT.md` §5.11 |
| 5 | Does an admin-facing nginx vhost exist for `marketplace-admin`/`marketplace-shopowner`? | platform owner / ops | **closed** — it did not, and now all three do: `marketplace-nginx/sites-available/`, [`marketplace-nginx/README.md`](https://github.com/Axiumine/marketplace-nginx/blob/main/README.md) |
| 6 | No automated dependency-audit gate found for npm supply-chain risk (§7) — should one be added to `.githooks/pre-push`? | platform owner | open, raised this session |
| 7 | No key-rotation schedule found for `SOCKETLABS_SERVER_APIKEY`, `QODANA_TOKEN`, or Keygrip pairs — is rotation cadence a requirement? | platform owner | open, raised this session |
| 8 | `BEs/marketplace-db-setup/setup/mongodb.js` still carries live-looking, unrotated credentials in tracked source (§4) | platform owner | open, carried from [`.claude/SECRETS.md`](../../../.claude/SECRETS.md) §Not fixed here |
| 9 | GDPR applicability (NFR-CO02) — decision outstanding, out of Phase 3 scope to resolve | platform owner | **closed 2026-08-26** — decided out of phase, as §5 intended: GDPR is in scope (`phase1/NFR.md` §2.7). Nothing in this document depended on the answer, and nothing here becomes a compliance claim. The unimplemented obligations continue as `phase1/NFR.md` open question 6 |
