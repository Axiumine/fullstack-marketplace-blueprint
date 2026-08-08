# ADR-006 — The three authorization services share a body in marketplace-common and keep three deployables
# Marketplace

**Status:** accepted
**Date:** 2026-08-07
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Platform runs one logout service for all 3 tiers (`marketplace-dev-authenticated-logout`, port 4030) but 3 separate `*-authenticated-authorization` services:

| Service | Port | Tier |
|---|---|---|
| `marketplace-dev-authenticated-authorization` | 4029 | `ShopOwner` |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | `Admin` |
| `marketplace-dev-user-authenticated-authorization` | 4031 | `User` |

Question raised: can these 3 collapse into 1 process the way logout already did? Since 2026-08-05 every Redis session hash carries `tier` (`admin`/`shopOwner`/`user`), asserted per-service by `assertTier(actual, expected)` (`BEs/marketplace-common/src/others/assertTier.mts`) — the discriminator a merged handler would need already exists server-side. So the real question is not whether the tier is knowable, it is whether *dispatching* on a tier read out of the session is the right shape.

Full survey and evidence trail already written at `docs/decisions/authorization-service-consolidation.md` (245 lines read, doc reports 304 total) — this ADR summarises its headings (*The question*, *The discriminator already exists*, *Why logout can be one service and authorization cannot, trivially*, *How little actually differs*, *Options*, *Decision*, *What (c) does not change*, *As implemented*) and states the decision it reached; it does not restate the doc's evidence.

Constraints in force: `CLAUDE.md` Terminology says "a fifth role means a fifth collection and a fifth service pair, not a role check bolted onto the existing ones" — dispatch-on-tier is textually the pattern that line rejects. Logout is tier-blind by construction (deletes by token content, never asks which collection minted it, no Mongo connection at all — `docs/architecture.md` §Services) so it is not a precedent for a tier-*aware* merge. Each service's `src/index.mts` calls `process.exit(1)` on an uncaught exception, so 1 process is 1 crash domain regardless of how many tiers it serves.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| (a) One service, one path, dispatch on `redData.tier` via a `TIER_STRATEGY` map | Max dedup, 1 deployable/port/systemd unit, mirrors logout topology, 5th tier = 1 map entry | Blocked twice: textually the pattern `CLAUDE.md` rejects, and thins the 2026-08-05 `REDIS_KEY` fix from 6 independent hardcoded `assertTier` sites to 1 dispatcher — a bug there risks every tier at once. Admin branch is least-tested (foreign-tier 403 unit test exists only in the user-tier repo). `process.exit(1)` makes it 1 crash domain for 3 tiers |
| (b) One service, three mounted paths, path supplies expected tier, `assertTier` still compares 2 independently-sourced values | Same dedup as (a), keeps the 2-source security property intact, doctrine-compliant (nothing dispatches on session-read tier), preserves nginx per-path `mkt_auth` rate-limit zones (`marketplace-user.conf:133-136`) | Crash-domain coupling from (a) remains in full — 1 `process.exit(1)`, 3 tiers down together. Deploying a ShopOwner-only change redeploys Admin and User. 3 ports collapse to 1, erasing per-tier blast-radius isolation. Medium migration cost: env/`MONGO_TEST_*` reconciliation across 3 repos, frontend config, nginx blocks, `services-status` entries, systemd units, GitNexus group membership |
| (c) Three services stay, shared body moved into `marketplace-common` — **CHOSEN** | Removes the duplication that motivated the question; every security property untouched — each service still hardcodes its own `TIER.*`, all 6 `assertTier` sites survive; zero operational risk — no port/nginx/frontend change, no repo retired; doctrine-compliant; 5th tier still costs a new collection + service pair, now with less to copy | Dedup only moderate — 3 deployables/systemd units/ports remain, ops surface does not shrink. `marketplace-common` gains a Koa/GraphQL-shaped surface deployed to all 9 services though only 3 use it — widens blast radius of a common-side break. Every edit needs `./deploy-local.sh` before consumers see it |
| (d) Do nothing | Zero risk, zero work | Duplication drifts — survey found it had already: user-tier repo on `marketplace-common ^4.3.0`/`koa-utils ^5.8.0` vs the other two on `^4.0.0`/`^5.7.0`; `qodana.yaml` `dependencyOverrides` stale at `1.16.14` in ShopOwner/Admin, correct at `4.3.0` in user; Admin's `stryker.config.mjs` excludes `instrument.mts` so it mutation-gates less; user repo had 1 integration file vs 3 in the others |

---

## Decision

**(c).** Minimizing risk was ranked above reducing deployable count. Duplication is a maintenance cost; the crash-domain coupling shared by (a) and (b) is an availability cost paid by customers when it fires — one `process.exit(1)` taking down all 3 tiers' token refresh at once. Only (c) removes the duplication without buying that coupling. (a) is additionally blocked on doctrine grounds independent of availability: dispatching on `redData.tier` is the exact shape `CLAUDE.md` names and rejects for a "5th role." (b) is recorded as a legitimate design that could be revisited if the ops cost of 3 deployables ever becomes the binding constraint; (a) cannot be revisited without changing the doctrine in `CLAUDE.md` first — that is a separate decision.

Shipped as `marketplace-common@4.4.0` (`BEs/marketplace-common/package.json:3`) plus 1 commit per service, same day. Three helpers under `BEs/marketplace-common/src/others/`, verified on disk — `resolveAuthorizationSession.mts`, `findAccountForSession.mts`, `refreshSessionTokens.mts` — plus `assertTier.mts` and the `TIER` constant in `Tier.mts`, all present in that directory and all listed in `package.json`'s `exports` map (lines 205–215 for the three new ones). `resolveAuthorizationSession.mts` exports `TAuthorizationSession<TAccountData>`, now the declared type of `ctx.state.user` in all three authorization services, replacing 3 hand-written local session interfaces. Each service keeps only its own `TIER.*` constant, its own model, its own projection:

```
|Helper                     |Replaces                                              |Kept per service|
|resolveAuthorizationSession|hGetAll → assertTier → read → build-session body      |Koa middleware wrapper, TIER.* constant, readSessionData callback|
|findAccountForSession      |tokenInfoShopOwner / tokenInfoAdmin / tokenInfoUser   |model + projection|
|refreshSessionTokens       |whole body of refresh.mts                             |nothing — resolver is 4 args now|
```

---

## Consequences

### Positive
- Duplication removed: `authenticatedAuthorizationHandler.mts` 93→57 lines, `refresh.mts` 94→26 lines, each `tokenInfo*.mts` down to a single `findAccountForSession(...)` call (per `docs/decisions/authorization-service-consolidation.md`, *As implemented*).
- All 6 independent `assertTier` call sites survive — the 2026-08-05 `REDIS_KEY`-sharing fix keeps its "1 bug cannot corrupt the others" property.
- No port, nginx, or frontend change; no repo retired. 3 ports (4025/4029/4031) unchanged.
- 5th tier still costs a new collection + new service pair per `CLAUDE.md` Terminology, not a map entry — doctrine intact.
- No service test file needed editing — existing unit tests (73/42/56 across the three) passed unchanged against the delegating implementations, evidence the extraction is behaviour-preserving.

### Negative
- `marketplace-common` now has a Koa/GraphQL-shaped surface consumed by only 3 of the 9 services but deployed to all 9 via `./deploy-local.sh` (`docs/conventions.md` §marketplace-common plumbing) — an edit there is wider than it looks.
- Ops surface unchanged: 3 deployables, 3 systemd units, 3 ports remain. "1 BE like logout" not achieved.
- Every common-side edit needs a deploy-local run plus 1 separate bump commit per consuming service, not just the 3 authorization ones.
- Discovered mid-implementation, unrelated to the design itself: `Model<T>` is invariant in `T`, so `findAccountForSession` needed a structural `ISessionAccountModel<TAccount>` type rather than a plain generic reader; and moving code into the package moved it out of vitest's mock registry — `vi.mock('@axiumine/koa-utils/lib/tokens')` stopped intercepting once the import lived in common's dist, requiring both `@thedoctorweb_agency/marketplace-common` and `@axiumine/koa-utils` added to `inlineDeps` in each `vitest.mutation.config.mts`.

### Risks
- **Latent Admin-branch fault.** Foreign-tier 403 unit test existed only in the user-tier repo before 2026-08-07; ShopOwner/Admin repos never exercised an `assertTier` mismatch directly. Revisit if a tier-mismatch bug ships to production undetected by unit coverage — points at needing that test duplicated per service, not at merging.
- **Common-side breaking change hits 9 services at once.** A regression in `resolveAuthorizationSession`/`findAccountForSession`/`refreshSessionTokens` is invisible until `./deploy-local.sh` runs, then silently wrong at every one of the 3 call sites simultaneously. Revisit if this class of bug recurs — points at a common-side contract test, not at re-inlining.
- **Environment-file drift across repos is structurally unenforced.** The same 2026-08-07 work found both user-tier services' env files were copies of an unrelated project — `MONGODB_URI` naming `testRnApollo`, mismatched `INTROSPECTION_CODE`, mismatched `KEYGRIP_KEY_1`/`_2` against `marketplace-dev-public-authorization` — because no suite spans 2 services. Not caused by this ADR's decision but exposed by finally running the full gate; revisit only if a cross-repo contract-test mechanism is later proposed.
- **Ops-cost reversal.** If 3 systemd units / 3 ports ever become the binding operational constraint, option (b) is the documented fallback — not (a), which stays blocked on doctrine grounds independent of ops cost.

---

## Compliance

Verify body-sharing is in place: `grep -n "resolveAuthorizationSession\|findAccountForSession\|refreshSessionTokens" BEs/marketplace-dev-authenticated-authorization/src/**/*.mts BEs/marketplace-dev-admin-authenticated-authorization/src/**/*.mts BEs/marketplace-dev-user-authenticated-authorization/src/**/*.mts` should hit in all 3. Verify the 3 helpers exist and are exported: `ls BEs/marketplace-common/src/others/{resolveAuthorizationSession,findAccountForSession,refreshSessionTokens}.mts` and check the same 3 subpaths appear in `BEs/marketplace-common/package.json`'s `exports` map.

Verify the deployable count did not shrink: `grep -m1 '^PORT=' BEs/marketplace-dev-authenticated-authorization/env BEs/marketplace-dev-admin-authenticated-authorization/env BEs/marketplace-dev-user-authenticated-authorization/env` must return 3 distinct ports (4029/4025/4031) with no service removed.

A violation looks like: a `TIER_STRATEGY`-shaped map or an `if (redData.tier === ...)` branch inside a single shared handler dispatching to 3 different account models — reopens option (a), which CON-06 (`phase3/CONSTRAINTS.md`) names as decided against and forbids re-litigating on dedup grounds alone. Also a violation: any of the 3 authorization repos merged into 1 `package.json`/`src/index.mts`, or `assertTier` called from fewer than 6 independent sites across the 3 repos.
