# ADR-005 — One logout service for all three tiers
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Platform splits backend on two axes: tier (who) × concern (what). Three tiers exist —
`ShopOwner`, `Admin`, `User` — each with own collection, own `authorized-*` service pair, own
`tier` value stamped in the Redis session (`docs/architecture.md` §Auth model, CON-04). Pattern holds for
login, refresh, domain resource. Logout is the one operation that does not need it.

Session state lives in Redis under one shared `REDIS_KEY=marketplaceDev:` prefix across all nine
services — CON-04 forbids per-tier prefixes because the shared prefix is what makes a single
lookup by token possible. A logout call carries a refresh-token cookie and/or an
`Authorization: Bearer access:<token>` header. Both are opaque strings (CON-03 — not JWT, no
embedded claims to read a tier out of). The only thing a logout resolver needs to do is delete
the Redis hash(es) at `${REDIS_KEY}${token}` and clear the cookie
(`BEs/dev/marketplace-dev-authenticated-logout/src/graphQLApi/schema/mutations/logout.mts:17-27`).
Nothing in that operation opens `shopOwner`, `admin` or `user` collection, or reads `ctx.state.user.tier`.

Forces: three frontends (`marketplace-admin`, `marketplace-shopowner`, `marketplace-user`) each
need a logout call. Nine backend services already means nine deployables, nine ports, nine
`pre-push` gates (CON-08, 100/100 everywhere) — one more service per tier for an operation with no
tier-dependent logic would be pure duplication paid for at every gate, every deploy, every review.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| One shared logout service (chosen) | One resolver, one deployable, one port, one gate suite; token-content lookup means it is correct by construction for any tier, including future ones | Service name carries no tier — a reader has to know the reason; one outage affects all three tiers' logout at once |
| Tier-named logout mutations (`shopOwnerLogout`, `adminLogout`, `userLogout`), each in its own `*-authenticated-authorization` service | Symmetric with login/refresh; failure isolated per tier | Triples a resolver that reads and writes nothing tier-specific — same `redisClient.del` three times over; three more `pre-push` gates (lint, 100% coverage, 100 mutation, Qodana) for logic that cannot diverge; violates CON-05 directly |
| Fold logout into each `*-authenticated-authorization` service as one more mutation (no new service, no tier-named mutation) | No new deployable | Still triples the resolver code and its test suite across three repos; `authorization` services already share body via `marketplace-common@1.0.0` (CON-06) for login/refresh precisely because that logic *can* diverge by tier (different account model, different projection) — logout has no such per-tier shape to share, so tripling it would be duplication with no offsetting reuse, unlike the authorization consolidation |

## Decision

Chosen: one shared logout service, `marketplace-dev-authenticated-logout`, port 4030
(`BEs/dev/marketplace-dev-authenticated-logout/env:1` → `PORT=4030`), serving all three tiers.
Matches row 1 of the table above.

Reasoning: `authorizationLogoutHandler` never opens a tier collection and never reads `tier` off
the session — it validates the refresh cookie via `verifySignedRefreshToken`, looks up
`readSessionField(..., '_id')` for the refresh session and, if present, the access session too
(`BEs/dev/marketplace-dev-authenticated-logout/src/lib/authorizationLogoutHandler.mts:78-110`), then
the `logout` resolver deletes both keys by token content
(`BEs/dev/marketplace-dev-authenticated-logout/src/graphQLApi/schema/mutations/logout.mts:17-23`).
Tier-agnostic by construction, not by omission — there is no branch anywhere in that path that
could read differently for `ShopOwner` vs `Admin` vs `User`. Tripling that logic per the second and
third table rows buys isolation the operation has no use for (nothing about session teardown can
fail differently per tier — it is one `del` either way) while paying the full CON-08 gate cost
three times over. `marketplace-shopowner/src/api/endpoints.ts:16-19` states the same conclusion at
the call site: "`/logout` is the one both apps share, legitimately... it is tier-agnostic by
construction." All three frontends' `CTX_LOGOUT` point at the identical `env.logout` shape —
verified `marketplace-admin/src/api/endpoints.ts:26`, `marketplace-shopowner/src/api/endpoints.ts:31`,
`marketplace-user/src/api/endpoints.ts:29`, each `Object.freeze({ url: ENDPOINT.logout })`.

**Amended 2026-08-12 by E15-S01 — the decision stands, one line of its evidence did not.** The refresh
lookup quoted above read the field `id`, and no writer on this platform has ever written one: the refresh
hash is `IRefreshData`, whose identity is `_id`. The lookup therefore returned `null` for every real
session, the handler answered `throwAlreadyDone`, and **logout deleted nothing for as long as this service
existed** — while returning success to the caller. Nothing about the tier-agnostic argument depended on the
field name, which is exactly why the wrong one survived here: this ADR was reasoning about *which
collection* the read does not touch, not about whether the read finds anything. The field is now `_id`, and
the pairing is asserted against a writer-shaped hash rather than a hand-seeded field
(`test/helpers/sessionFixtures.mts`).

## Consequences

### Positive
- One resolver, one test suite, one `pre-push` gate to maintain for an operation used by every tier — no logout logic to keep in sync across three repos.
- Correct by construction for a future fifth tier: a new tier's logout needs no new code here, only pointing its frontend's `CTX_LOGOUT` at port 4030.
- Matches CON-04's `REDIS_KEY` sharing rationale exactly — the shared prefix and the tier-agnostic logout are the same design decision seen from two sides.

### Negative
- The service name and directory (`marketplace-dev-authenticated-logout`) carry no tier marker, unlike every other backend service — a reader unfamiliar with this ADR has to be told why, which is why the comment at `marketplace-shopowner/src/api/endpoints.ts:16-19` exists and must not be deleted.
- `assertTier` (CON-04) is deliberately **not** called anywhere in this service — a change that "fixes" that by adding tier assertion here would break all three frontends' logout at once, since the whole point is accepting any tier's token.

### Risks
- **Risk:** a future edit adds tier-specific behaviour to logout (e.g., a tier-scoped audit log, a tier-specific cookie name) — revisit this ADR the day such a requirement appears, because the "no branch needed" argument above would no longer hold. Until then, CON-05 blocks re-splitting it.
- **Risk:** the shared `REDIS_KEY` prefix this service depends on is ever accidentally scoped per-tier elsewhere — logout would then only clear one tier's key shape. Trigger for revisit: any change to `REDIS_KEY` construction in `marketplace-common`.
- **Risk:** availability — one process outage takes down logout for all three tiers simultaneously (no client-side session clear as fallback observed in the frontends). Trigger for revisit: an NFR sets a logout-specific SLA distinct from the other authorization services (none exists today, `phase1/NFR.md` not consulted for a tier-specific number here).

## Compliance

Verify: all three frontends' `src/api/endpoints.ts` `CTX_LOGOUT` resolve to `env.logout`, and each
`env.logout` / `.env` template points at port `4030` — `grep -n "logout" marketplace-*/src/api/endpoints.ts`
should show identical `Object.freeze({ url: ENDPOINT.logout })` shapes in `marketplace-admin`,
`marketplace-shopowner`, `marketplace-user`. Verify the resolver stays tier-agnostic:
`grep -n "tier\|assertTier" BEs/dev/marketplace-dev-authenticated-logout/src/graphQLApi/schema/mutations/logout.mts BEs/dev/marketplace-dev-authenticated-logout/src/lib/authorizationLogoutHandler.mts`
must return nothing.

Violation looks like: a second logout service appearing under `BEs/dev/` (e.g.
`marketplace-dev-admin-authenticated-logout`), or a tier-named mutation (`adminLogout`,
`shopOwnerLogout`, `userLogout`) added to any `*-authenticated-authorization` service's
`mutations.mts`, or `assertTier`/`ctx.state.user.tier` appearing inside
`marketplace-dev-authenticated-logout/src/`.
