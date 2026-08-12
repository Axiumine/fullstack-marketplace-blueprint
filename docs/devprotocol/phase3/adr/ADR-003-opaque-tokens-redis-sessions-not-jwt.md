# ADR-003 — Opaque tokens with Redis-backed sessions instead of JWT
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Platform needs auth for 3 tiers (`Admin`, `ShopOwner`, `User`), each own collection, own service pair
(authorization + resource), per [`CLAUDE.md`](../../../../CLAUDE.md) §Terminology. No `role` field, no permission enum anywhere —
role = which collection session authenticated against (CON-01, `phase3/CONSTRAINTS.md`).

Two token halves already fixed by the time this ADR records them: refresh token in Koa signed httpOnly
cookie (Keygrip SHA-512, `KEYGRIP_KEY_1`/`KEYGRIP_KEY_2` — ⚠️ **amended 2026-08-12 by ADR-034**, which moved
those keys out of the environment into one wrapped Redis record; nothing else here changes, because this
ADR is about what a token *is*, not where the signing key lives), access token as `Authorization: Bearer
access:<token>` header. Question this ADR answers: what IS the token — self-contained claims (JWT) or a
lookup key against server state (opaque + session store)?

Forces:
- 9 backend services, 1 shared `REDIS_KEY=marketplaceDev:` prefix across all of them, on purpose — one
  `marketplace-dev-authenticated-logout` (port 4030) serves all 3 tiers and deletes a session by token
  content alone, asking no collection which minted it (CON-05).
- The shared prefix makes cross-tier acceptance the default failure rather than an edge case: a resource
  service that accepts any non-empty Redis hash as valid authenticates an `Admin` access token against the
  `ShopOwner` resource service. The answer is a `TIER` constant plus `assertTier` (CON-04, ADR-004), so
  whatever token scheme this ADR picks has to carry that discriminator and let a service refuse a foreign
  one, cheaply, per request.
- Immediate logout matters — `marketplace-dev-authenticated-logout` exists as its own service; whatever
  the token is, revoking it before natural expiry cannot require a second piece of infrastructure bolted
  on afterward.
- `schema.graphql` slices (hand-maintained, not authoritative — [`docs/frontends.md`](../../../frontends.md) §marketplace-admin and marketplace-shopowner) still name
  a `JWT` type in places. `phase2/UBIQUITOUS_LANGUAGE.md:105,633` records this explicitly as a stale name,
  not a design statement — resolvers are the source of truth, not the SDL slice.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| JWT (self-contained, signed claims) | No DB/cache round trip to validate — verify signature locally. Standard libraries, standard `exp` claim. | Revocation before `exp` needs a blocklist — which is a session store again, just a second one, with none of the read-latency win kept. Embedding `tier` in a claim does not make it cheaper to assert; it makes tampering a signature question instead of a lookup question. Immediate logout (already a shipped service) becomes "add to blocklist," an extra moving part for a state the platform can already delete outright. |
| Opaque token + Redis-backed session (chosen) | `logout` deletes one hash, no other party needs to know — exactly what the 1-service-3-tiers logout design (CON-05) needs. `tier` is one more hash field, asserted server-side per request (`assertTier`), not trusted from the token itself. Session is mutable in place — `refresh` rotates access+refresh tokens without re-deriving anything from a signed claim. | Every resource-service request costs a Redis `hGetAll`. Redis becomes a hard auth dependency — an outage there is a full-platform login/verify outage, no local-signature fallback. Shared `REDIS_KEY` prefix across all 9 services (kept on purpose, CON-04) means the tier check is the *only* boundary — get `assertTier` wrong once and every service is wrong the same way, which is exactly the hole ADR-004 exists to close. |
| Opaque token + DB-backed session (session doc in MongoDB) | Same revocability as Redis, no second datastore to operate. | Adds a 7th collection against an architecture that has exactly 6 (`admin`, `shopOwner`, `company`, `user`, `item`, `itemCategory` — `phase3/CONSTRAINTS.md` §4 architectural invariants) and a `$jsonSchema` validator to define for pure ephemeral state. No native TTL as cheap as Redis `EXPIRE` — would need a background reaper or a query filter on every read. Every access-token check becomes a primary-database read, adding load to the store that also carries `company`/`item` catalogue traffic instead of isolating session churn to its own tier.

---

## Decision

Opaque token + Redis-backed session — middle row of the table above. The deciding force is revocation
plus the tier discriminator together, not either alone: JWT gets revocation only by re-adding a lookup
(losing its own advantage), and a Mongo-backed session gets revocation but at the cost of a 7th collection
and load on the primary store the catalogue also depends on. Redis was already the natural home for
short-lived, frequently-mutated, per-request-checked state, and `tier` slots into the existing hash as one
field rather than as a new claim format to parse and verify:

```mts
const redAccessSession = await redisClient.hGetAll(`${process.env.REDIS_KEY}${accessToken}`)
if (redAccessSession != null && Object.keys(redAccessSession).length !== 0) {
	const redData = { ...redAccessSession } as unknown as IRedisDataShopOwner
	assertTier(redData.tier, TIER.shopOwner)
	ctx.state.user = makeAuthCtx(redData)
} else throwAccessTokenExpiredOrDeleted()
```
`BEs/dev/marketplace-dev-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:51-56`

`TIER` (`admin`/`shopOwner`/`user`) and `assertTier` live once in `BEs/marketplace-common/src/others/Tier.mts`
and `BEs/marketplace-common/src/others/assertTier.mts`, called from every resource service's own copy of
this handler — not a role field, a per-request assertion against session state (CON-01, CON-04).

---

## Consequences

### Positive
- `logout` stays 1 service for 3 tiers — deletes the Redis hash by token content, needs no per-tier
  knowledge (`BEs/dev/marketplace-dev-authenticated-logout`, CON-05).
- Revocation is immediate and free of a second store — no blocklist, no `exp`-window exposure window
  after a user logs out.
- `tier` travels as ordinary session data, asserted per request server-side (`assertTier`), not trusted
  from client-supplied claims — closes that class of bug at the source (ADR-004).
- `refresh` mutates the session in place (rotates tokens) instead of minting a new signed artifact whose
  old copy must separately be invalidated.

### Negative
- Every authenticated request pays a Redis round trip (`hGetAll`) — no local, infra-free verification
  path the way a JWT signature check would be.
- Redis is now a hard dependency for all auth, all 3 tiers, all 9 services — an outage there is a full
  login/verify outage platform-wide, not a degraded corner.
- Shared `REDIS_KEY=marketplaceDev:` prefix (kept intentionally, CON-04/CON-05) means `assertTier` is
  the *only* isolation between tiers' sessions — no prefix-level separation to fall back on if that one
  check is ever skipped in a new service.

### Risks
- **Pre-tier-field sessions treated as trusted.** Already closed: `assertTier` fails closed on a missing
  `tier` (`actual !== expected`, no wildcard branch) rather than accepting it — revisit only if a future
  migration needs to grandfather old sessions in, which nothing on the roadmap calls for.
- **Redis cluster outage or CROSSSLOT-class operational fault takes down all auth.** Revisit the
  DB-backed-session row above if Redis availability becomes the platform's dominant outage cause —
  not before; no such data exists yet.
- **Stale `JWT` type in `schema.graphql` slices gets read as a live design signal** by someone editing a
  frontend without checking the resolver. Revisit only if the slices are ever promoted from
  hand-maintained to generated/authoritative (`docs/frontends.md` §marketplace-admin and marketplace-shopowner) — until then the fix is
  documentation, not code, and `UBIQUITOUS_LANGUAGE.md:633` already flags it as banned-if-read-as-real.

---

## Compliance

Verify: every resource service's `src/lib/db/authorizationAuthenticatedResourceHandler.mts` calls
`assertTier(<sessionTierField>, TIER.<ownTier>)` before setting `ctx.state.user` — grep pattern
`assertTier(` across `BEs/dev/*/src/lib/db/authorizationAuthenticatedResourceHandler.mts`, one hit per
resource service, none with the check commented out or replaced by a truthy check on the hash alone.

Violation looks like: a resource service reading `redisClient.hGetAll` and setting `ctx.state.user` on
any non-empty result without an `assertTier` call in between (the exact shape ADR-004 exists to prevent,
per [`docs/architecture.md`](../../../architecture.md) §Auth model) — or a new mutation/service that mints or verifies a `jsonwebtoken`/`jose`
signed token instead of writing/reading a Redis hash under `REDIS_KEY`.
