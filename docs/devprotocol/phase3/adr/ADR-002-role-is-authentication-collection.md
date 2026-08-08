# ADR-002 — Role = which collection you authenticate against — no role field, no permission enum
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Platform serves 3 actor kinds needing auth: platform operator (Admin), shop owner (ShopOwner), end customer (User). Standard multi-tenant design puts them in one `account` collection plus `role` field or permission enum, checked per-resolver. This platform did the opposite from day one and hardened it further on 2026-08-05.

3 separate tenant collections exist: `admin`, `shopOwner`, `user`. Confirmed no shared account table — `admin`, `shopOwner`, `company`, `user`, `item`, `itemCategory` is the full 6-collection set, no 7th. Each auth collection has its own service pair under `BEs/dev/`: `marketplace-dev-admin-authenticated-authorization`+`-resource`, `marketplace-dev-authenticated-authorization`+`-resource` (ShopOwner), `marketplace-dev-user-authenticated-authorization`+`-resource`. One shared exception: `marketplace-dev-authenticated-logout` (port 4030) serves all 3, deleting Redis session by token content — never asks which collection minted it.

Forcing factor 2026-08-05: all 9 services share one Redis prefix `REDIS_KEY=marketplaceDev:` (needed structurally, see Consequences). Before that date `authorizationAuthenticatedResourceHandler.mts` did `hGetAll(${REDIS_KEY}${accessToken})` and trusted any non-empty hash. An `Admin` access token was accepted by the ShopOwner resource service, and the reverse — real hole, shared-prefix side effect, not a hypothetical.

`user.js` schema comment states the constraint directly: `BEs/marketplace-db-setup/lib/schemas/user.js:3` — "role on this platform is which collection you log in against, not a field on a row."

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Single `account` collection + `role: enum` field | 1 collection, 1 schema, 1 service pair, less duplication | `role` string forgeable/mutable at write time if any resolver skips the check; every query needs a `role` filter or leaks cross-tier; one collection means one downtime domain for all 3 actor kinds — operator outage takes customers down too |
| 3 collections, shared service, `role` check per-resolver | Less service duplication than full split | Still a mutable field — same forgery surface as above, just spread across resolvers instead of centralized; a missed check in one resolver is a silent privilege cross |
| 3 collections, 3 service pairs, role = which collection you logged into, `tier` stamped in session + `assertTier` per service (chosen) | Role is structural, not data — nothing to forge because there is no field holding it; blast radius of one tier's outage stops at that tier; adding a role means adding a collection+pair, an explicit act, not a flag flip | 3x service processes to deploy/monitor; duplication across the 3 `*-authenticated-authorization` bodies (mitigated separately, see `docs/decisions/authorization-service-consolidation.md` — shared logic factored into `marketplace-common`, deployables stay 3) |

---

## Decision

Chose row 3: role is which collection a session authenticated against, encoded structurally via 3 tenant collections + 3 service pairs, never as a data field. `TIER` constant (`admin`\|`shopOwner`\|`user`) written at `BEs/marketplace-common/src/others/Tier.mts`, stamped into the Redis session hash at login, carried through every `refresh`, asserted by `assertTier(actual, expected)` (`BEs/marketplace-common/src/others/assertTier.mts`) in each resource service's auth middleware.

Row-3 win over row 2 turns on forgeability: a `role` field, even correctly checked everywhere today, is one write bug away from privilege elevation because the value lives in mutable data. Collection identity cannot be forged the same way — a ShopOwner session simply has no path to become an Admin row. Row 1 loses on top of that for blast radius: one collection means one Mongo outage or one bad migration touches all 3 actor kinds simultaneously; kept separate, an Admin-tier incident does not touch User auth.

`assertTier` fails closed on a missing `tier`: `actual !== expected` has no branch for `undefined`, so pre-2026-08-05 sessions (minted before the field existed) are rejected outright rather than trusted as a wildcard — costs one re-login, not a re-opened hole for the remaining `REFRESH_TOKEN_EXPIRY` (90 days). Mismatch answers 403, not 401: the caller authenticated correctly, just against the wrong tier, and a 401 would tell a client to refresh its way out, which it cannot.

---

## Consequences

### Positive
- Adding a role is an explicit, reviewable act — new collection + new migration + new service pair — not a one-line enum addition that silently touches every existing resolver's permission surface.
- No permission-check code path to audit for missing branches; the check is "which collection did this session come from," answered once per service at the auth-middleware layer (`assertTier` call site inside each `*-authenticated-resource`'s handler).
- 3 independent deployables mean an operator-tier incident cannot take down customer auth, and vice versa.

### Negative
- 3x the service processes vs a single account+role design — 3 `*-authenticated-authorization` + 3 `*-authenticated-resource` (6 total) instead of 2.
- Duplication risk across the 3 authorization service bodies existed until 2026-08-05, when `marketplace-common@4.4.0` factored the shared session/refresh/account-lookup logic out (`resolveAuthorizationSession`, `findAccountForSession`, `refreshSessionTokens`) — deployables stayed 3 on purpose, see `docs/decisions/authorization-service-consolidation.md`.
- One shared `REDIS_KEY` prefix across all 9 services (kept for the shared logout service, `marketplace-dev-authenticated-logout`) means a session key from any tier is technically findable by any service — `assertTier` is the only thing standing between an Admin token and the ShopOwner resource API, not collection separation alone.

### Risks
- **Missing `tier` on a session treated as trusted** — would silently re-open the pre-2026-08-05 hole. Revisit trigger: any code review or diff touching `assertTier.mts` that adds an `undefined` branch, or any new service that reads the Redis hash without calling `assertTier`.
- **A 4th tier gets bolted on as a role check** instead of a collection + service pair. Revisit trigger: a PR or ADR proposing a `role` field on an existing collection, or a permission enum anywhere in `marketplace-common` or a resource service.
- **Per-tier `REDIS_KEY` prefix proposed as a "cleaner" separation.** Would break the shared logout service, which finds sessions by token content alone with no tier awareness. Revisit trigger: any change to `REDIS_KEY` construction in more than one service at once.

---

## Compliance

Verify: `grep -rn "role" BEs/marketplace-db-setup/lib/schemas/` returns no `role:` field definition in any `$jsonSchema` builder — only the explanatory comment at `BEs/marketplace-db-setup/lib/schemas/user.js:3`. `grep -rln "role" BEs/marketplace-common/src --include="*.mts"` should return only `Tier.mts` (the constant, spelled `tier` not `role`) and `IUserSchema.mts` (unrelated field). `ls BEs/dev/` should show exactly 9 service directories forming 3 tenant pairs + 1 shared logout — no 10th "role-checking" service.

Violation on disk looks like: a `role` string field added to any `$jsonSchema` in `lib/schemas/`, a `switch (session.role)` or equivalent branch in any resolver, or a new authenticated tier added as a check inside an existing `*-authenticated-resource` service rather than as a new collection + new service pair. Session-shape check: every session hash written at login must carry `tier` from `TIER` (`BEs/marketplace-common/src/others/Tier.mts`) — absence of `assertTier(...)` in a new resource service's auth path is the violation to look for in review.
