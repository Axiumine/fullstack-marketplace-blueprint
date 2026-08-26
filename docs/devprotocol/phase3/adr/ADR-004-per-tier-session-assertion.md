# ADR-004 — Session tier field plus assertTier — fail closed, answer 403, keep REDIS_KEY shared
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Nine backend services, three tiers (`Admin`, `ShopOwner`, `User`), one Redis instance. All nine share
`REDIS_KEY=marketplaceDev:` on purpose — the single logout service
(`BEs/dev/marketplace-dev-authenticated-logout`, port 4030) deletes a session by token content alone and
never asks which collection minted it (`docs/architecture.md` §Services, logout row).

With no discriminator in the session hash, the only thing
`authorizationAuthenticatedResourceHandler.mts` in a resource service can do is
`redisClient.hGetAll(REDIS_KEY + accessToken)` and accept any non-empty hash as proof of auth. Under a
shared prefix that is a cross-tier hole by construction: an Admin access token, looked up under the same
prefix, authenticates cleanly against the ShopOwner resource service — and the reverse. No collection
check, no tier check, nothing; `ctx.state.user` is set from `makeAuthCtx(redData)` regardless of which
collection issued the token
(`BEs/dev/marketplace-dev-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:52-61`).

Forces: the shared prefix cannot be un-shared (logout depends on it structurally, CON-05). Sessions
already in Redis at ship time have no discriminator field, so whatever fix lands must define behavior for
absent data. Refresh sessions live `REFRESH_TOKEN_EXPIRY` = 90 days, so anything that treats old data as
implicitly trusted stays exploitable for up to that whole window.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Per-tier `REDIS_KEY` prefix (e.g. `marketplaceDev:admin:`, `marketplaceDev:shopOwner:`) | Isolation without a check — wrong-tier lookup finds nothing at the key | Breaks the single logout service, which deletes by token content and does not know the tier at delete time (CON-05); would require either a 4th/per-tier logout service (rejected, see ADR on logout) or a fan-out delete across 3 prefixes per logout call |
| Session hash gains `tier`; each resource service calls `assertTier(actual, expected)`, missing/mismatched tier → 403 | Closes the hole at the one call site every resource service already has; REDIS_KEY stays shared, logout untouched; explicit fail-closed behavior for pre-existing sessions | Every one-time cross-tier session existing when this ships is force-logged-out (accepted cost, one re-login) |
| Session hash gains `tier`, but treat missing `tier` as trusted (wildcard) for backward compatibility | No forced re-login for a session written without the field | A missing `tier` is exactly the state the hole lives in, so trusting it leaves the hole open for up to 90 days (`REFRESH_TOKEN_EXPIRY`) — it adopts the discriminator and declines to use it |
| Mismatch → 401 instead of 403 | Reuses an existing generic "unauthorized" error path, less new error-handling code | 401 tells the client "refresh and retry," which is exactly wrong here — the caller has a valid, undamaged session, just for the wrong tier; a refresh cannot fix that and the client would loop |

---

## Decision

Chosen: row 2 — stamp `tier` into the session hash, assert it per service, fail closed on missing tier,
answer 403 on mismatch, leave `REDIS_KEY` shared.

`TIER` is the three-value union (`BEs/marketplace-common/src/others/Tier.mts:12-16`, `'admin' | 'shopOwner'
| 'user'`) written once as data specifically so a session can carry it and a service can check it.
`assertTier` (`BEs/marketplace-common/src/others/assertTier.mts:21-23`) is `if (actual !== expected) throw
throwForbiddenError()` — no branch for `undefined`, so an old session without the field is rejected by the
same comparison as a wrong-tier one. Chosen over row 3 (treat missing as wildcard) because a session with no
`tier` is precisely the state this decision exists to refuse; trusting it would carry the hole for up to
`REFRESH_TOKEN_EXPIRY` for anyone already holding such a session. The cost — one forced re-login per
session without the field — is cheaper than a 90-day live hole.

403 over 401 (row 4 rejected) because the caller did authenticate, correctly, just against the wrong
collection — a 401 signals "your credentials are stale, refresh," and a refresh changes nothing about
which tier the token belongs to; the client would retry forever against the wrong service.

Per-tier `REDIS_KEY` (row 1 rejected) was not viable at all: logout is one service for three tiers by
design (CON-05, [`docs/architecture.md`](../../../architecture.md) §Services), and it identifies a session purely by the token value it
is asked to delete. Splitting the prefix means logout can no longer find a session without first knowing
its tier, which it structurally does not.

Call site, one per resource service, e.g.
`BEs/dev/marketplace-dev-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:60`:

```ts
const redData = { ...redAccessSession } as unknown as IRedisDataShopOwner
assertTier(redData.tier, TIER.shopOwner)
ctx.state.user = makeAuthCtx(redData)
```

Verified present with the matching `TIER.*` constant in all three resource services that read Redis
sessions this way:
`BEs/dev/marketplace-dev-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts`,
`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts`,
`BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts`.

---

## Consequences

### Positive
- Cross-tier token acceptance closed at the one shared choke point (`assertTier` call in each resource
  handler) rather than three ad-hoc fixes.
- `REDIS_KEY` stays shared, so the single logout service (`marketplace-dev-authenticated-logout`) needed
  zero changes.
- Fail-closed default: any future field-name typo or serialization bug that drops `tier` from a written
  session produces a rejected session, not a silently-trusted one.

### Negative
- Any session hash without a `tier` is invalidated on its first resource-service call — one forced
  re-login, accepted as the cost of failing closed instead of treating a missing discriminator as a
  wildcard for the remaining `REFRESH_TOKEN_EXPIRY`.
- `makeAuthCtx` deliberately drops `tier` from the `ForNode` context shape it builds
  (`BEs/dev/marketplace-dev-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:56-59`),
  so `assertTier` at the handler is the *only* place the check happens — nothing downstream re-derives or
  re-checks it.

### Risks
- **Single choke point.** If a resource service's auth middleware is refactored and the `assertTier` call
  is dropped or reordered after `ctx.state.user` is set, the check silently disappears with no second
  layer to catch it. Revisit if any resource service's `authorizationAuthenticatedResourceHandler.mts` is
  rewritten — re-verify the call survives, in order, before the handler returns.
- **New tier without a matching `TIER.*` constant.** CON-01/UBIQUITOUS_LANGUAGE.md §4 caps `Tier` at one
  value per collection; adding a fourth collection without extending `TIER` and wiring `assertTier` in its
  resource service reopens the pre-fix acceptance for that tier by omission. Revisit at the point a fifth
  role/collection is added (`CLAUDE.md` §Terminology).
- **Session write path drifts from session read path.** If a login/refresh path (`resolveAuthorizationSession`,
  `findAccountForSession`, `refreshSessionTokens` in `marketplace-common`, per CON-06) stops stamping
  `tier` into the hash, every session it mints is a permanent-missing-tier session, rejected forever, not
  just once — indistinguishable from an outage. Revisit if login/refresh error rates spike after any change
  to those three shared functions.

---

## Compliance

Verify per resource service: `grep -n "assertTier" BEs/dev/marketplace-dev-*-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts`
must return one call per service, each with a `TIER.*` literal matching that service's own tier (`TIER.admin`
in the admin resource service, `TIER.shopOwner` in the shop-owner one, `TIER.user` in the user one). A
service whose grep is empty, or whose `assertTier` call passes a variable tier instead of its own fixed
`TIER.*` constant, is the violation this ADR forbids.

Verify the shared prefix survives: `grep -rn "REDIS_KEY" BEs/dev/*/src/lib/db/authorizationAuthenticatedResourceHandler.mts`
must show every service reading the same `process.env.REDIS_KEY` env var name, no per-tier suffix appended
in code. A per-tier prefix appearing in any of these files is CON-04's violation case.

Verify fail-closed: `BEs/marketplace-common/src/others/assertTier.mts` must contain no branch that returns
normally when `actual` is `undefined` — the single `if (actual !== expected) throw …` is the whole
function. Any added `if (actual === undefined) return` is the violation.

Verify status code: `throwForbiddenError` import in `assertTier.mts` must resolve to a 403, not a 401,
implementation in `@axiumine/koa-utils`.
