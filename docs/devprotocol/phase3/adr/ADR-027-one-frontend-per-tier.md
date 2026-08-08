# ADR-027 — One frontend application per tier rather than one application that switches on role
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Platform has 3 auth tiers, each own collection, own service pair, own port pair. `Admin` (operator,
`admin` collection, 4024/4025), `ShopOwner` (shop owner, `shopOwner` collection, 4026/4029), `User`
(customer, `user` collection, 4031/4032). ADR-002 (`ADR-002-role-is-authentication-collection.md`) already
decided backend has no `role` field, no permission enum — role IS which collection session auth against,
enforced by `assertTier` (`BEs/marketplace-common/src/others/assertTier.mts`) reading `tier` stamped in
Redis session hash.

Frontend needed a decision independent of that one: ship it as 1 codebase or N. 1 bundle serving all 3
tiers would need a client-side role switch to decide which screens/queries/mutations to expose — the exact
concept the backend refuses. It would also mean every customer browser downloads the operator SPA's code
(shopOwner approval queue, `itemCategory` moderation, admin stats) even though it never runs it — Content
delivered ≠ content authorized is a leak surface (bundle inspection, source maps, unminified strings) even
if UI hides it.

Constraint from `docs/architecture.md` §Services: each tier's resource service exposes a genuinely different
GraphQL surface — `marketplace-dev-admin-authenticated-resource` (4024) owns `itemCategory` CRUD and
moderation, `marketplace-dev-authenticated-resource` (4026) owns `company`/`item` CRUD for the owner's own
rows, `marketplace-dev-user-authenticated-resource` (4032) owns account/personalData/addresses. No overlap
in mutation set. `marketplace-dev-authenticated-logout` (4030) is the one exception — it serves all 3
tiers already, by design (deletes Redis key by token content, never asks which collection minted it), so
its existence does not argue for merging the frontends either.

`marketplace-user` additionally needs SSR for public pages (`docs/frontends.md` §marketplace-user, CON-10 in
`phase3/CONSTRAINTS.md`) while `/account/*` stays CSR — a rendering-mode split that has no equivalent need
in `marketplace-admin` or `marketplace-shopowner`, which are pure SPA.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| One frontend app, role switch at runtime (read tier from session, branch UI/router/queries) | Single codebase, single build, single deploy artifact, shared components trivially reused | Ships operator+shopOwner+customer code to every browser regardless of tier; reintroduces `role`-shaped branching backend explicitly rejected (ADR-002); one urql client config must reconcile 3 different endpoint sets and 3 different codegen outputs; a bug in the switch is a cross-tier data leak, not a build error; SSR-vs-CSR split (`marketplace-user` only) would infect the other 2 tiers' routing for no reason |
| One frontend app, 3 separate build entry points (multi-page build, shared `src/`) | Some code sharing without runtime role switch; still 1 repo, 1 `package.json`, 1 `node_modules` | Still 1 dependency tree — a `marketplace-user`-only package (MapLibre GL, PMTiles) ships to operator/shopOwner installs too; 1 `.githooks/pre-push` gate (100% coverage + mutation, `README.md` §Test quality gates) now spans 3 apps' worth of code, so an operator-only test failure blocks a shopOwner-only change from shipping; 1 Qodana project/token for 3 surfaces corrupts the per-tier baseline the way a misrouted token does elsewhere on this platform (`docs/frontends.md` warns against exactly this for `services-status`); still needs a build-time (not runtime) role split, which is a smaller version of the same coupling |
| Three separate repos/apps, one per tier — `marketplace-admin` (3043), `marketplace-shopowner` (3044), `marketplace-user` (3045) | No tier's code ever reaches another tier's browser; each app talks only to its own tier's endpoints (CON_ports above), so an operator bug cannot touch customer traffic; each gets its own coverage/mutation/Qodana gate and project token, matching the backend's per-service gating pattern already established; `marketplace-user` free to be the one SSR app without dragging SSR concerns into the 2 pure-SPA tiers; mirrors the backend split 1:1 (tier × concern), so the pattern engineers already learned reading `docs/architecture.md` §Services applies again here | 3 codegen setups, 3 dependency trees, 3 things to keep in sync when a shared concept (e.g. `Company` shape) changes on all 3 — no shared package like `marketplace-common` exists for frontend code; genuinely divergent behaviour between `marketplace-admin` and `marketplace-shopowner` (see Decision) must be tracked per-repo, nothing enforces they stay consistent where they should be |

---

## Decision

Chosen: three separate repos, one per tier — row 3. Reasoning stated in `CLAUDE.md` §Build state
and §Frontends table: `marketplace-admin` (Admin, 3043, SPA), `marketplace-shopowner` (ShopOwner, 3044,
SPA), `marketplace-user` (User + anonymous, 3045, SSR public / CSR account). This is the frontend
consequence of ADR-002 — a role switch inside one bundle would (a) ship the operator surface to every
customer browser, a leak surface no minifier removes, and (b) reintroduce the role-as-branching-condition
concept the backend refuses at `assertTier` (`BEs/marketplace-common/src/others/assertTier.mts`). Row 2
(shared repo, split entry points) was rejected for the same underlying reason at smaller scale, plus it
would have forced the SSR/CSR split (CON-10) onto 2 apps that need no such thing, and it would have made
one Qodana project cover 3 tiers' worth of surface — the platform's stated position (`docs/frontends.md`, on the
`services-status` misrouted-token risk) is that a shared token/project across unrelated surfaces corrupts
the baseline.

`marketplace-shopowner` is explicitly built as "a mirror of the operator app: same stack, same
conventions, same hooks" (`docs/frontends.md` §marketplace-admin and marketplace-shopowner) — same TanStack
Router, urql + `cacheExchange` + `@urql/exchange-auth`, graphql-codegen `client-preset`, Tailwind 4,
Sentry — but that mirroring is convention only, not code sharing. Consequence recorded here because a
"mirror" invites the assumption of identical GraphQL contract, and it is not identical. Three points where
the tiers diverge on purpose and must not be "corrected" into matching (source: `docs/frontends.md`
§marketplace-admin and marketplace-shopowner, "Three things there are not copies…"):

```
companyAdd            -> OnlyIdType   (ShopOwner tier)   vs Boolean (Admin tier's create mutations)
GraphQLInputCompanyPosition -> requires type: String!   (ShopOwner)
                             -> forbids type             (Admin — server stamps 'Point')
resetPwdFlow           -> bound for ShopOwner model, but marketplace-shopowner ships no screens for it yet
```

Any future change that makes these 3 match "for consistency" is not a bugfix — it changes 2 independent
GraphQL contracts and needs its own ADR, not a silent PR.

---

## Consequences

### Positive
- No tier's frontend code (routes, components, GraphQL documents) is ever served to another tier's
  browser — `marketplace-admin`'s bundle contains no `marketplace-user` code and vice versa, verifiable by
  inspecting `dist/client` of each app.
- Each app's `.githooks/pre-push` gates its own 100% coverage + 100 mutation score + Qodana independently
  (`docs/workflow.md` §Git hooks) — a failing test in one tier's app never blocks a deploy of another.
- `marketplace-user` alone carries the SSR/CSR split and MapLibre/PMTiles dependency weight; the other 2
  apps stay pure SPA with no trace of either.
- Matches the backend's tier × concern split 1:1 — an engineer who has read `docs/architecture.md` §Services
  recognizes the same shape in `marketplace-admin` / `marketplace-shopowner` / `marketplace-user`.

### Negative
- No shared frontend package equivalent to `marketplace-common` — a type or convention shared by, say,
  `marketplace-admin` and `marketplace-shopowner` (both consume `Company`) is duplicated by hand in each
  app's `schema/*.graphql` slice and codegen output, not centrally maintained.
- 3 separate `yarn dev`, 3 separate `yarn build`, 3 separate `yarn codegen` invocations, 3 separate
  `qodana.cloud` project tokens to keep straight (`marketplace-admin` is `1rylx` per `docs/frontends.md`) — mixing
  up a token misroutes a report the way `services-status` almost did.
- The `companyAdd`/`GraphQLInputCompanyPosition`/`resetPwdFlow` divergences above are undocumented in code
  — nothing stops a future edit reconciling them by mistake; this ADR is presently the only place that
  states they are intentional.

### Risks
- **Risk:** a future engineer, seeing `marketplace-shopowner` described as "a mirror of the operator app,"
  merges the 2 apps into 1 repo to cut duplication. Revisit condition: only if a formal ADR reopens this
  decision with the same rigor CON-06 required for the authorization-service merge question
  (`docs/decisions/authorization-service-consolidation.md`) — not as an opportunistic refactor.
- **Risk:** the 3 intentional Admin/ShopOwner GraphQL contract divergences get silently "fixed" to match,
  breaking whichever tier depended on the divergent behaviour (e.g. a shopOwner client expecting
  `OnlyIdType` back from `companyAdd` receiving `Boolean` instead). Revisit condition: any PR touching
  `companyAdd`, `GraphQLInputCompanyPosition`, or `resetPwdFlow` in either app must cite this ADR or
  `docs/frontends.md` §marketplace-admin and marketplace-shopowner in its description.
- **Risk:** a 4th tier is added (CLAUDE.md §Terminology names the pattern: "a fifth role means a fifth
  collection and a fifth service pair") without a 4th frontend repo, because someone tries to save setup
  time by bolting it onto an existing app. Revisit condition: any new tier gets its own repo by the same
  reasoning as this ADR, unless a future ADR explicitly argues otherwise.

---

## Compliance

Verify: 3 separate git repos exist and build independently —
`ls -d /media/nvme/websites/fullstack-marketplace-blueprint/marketplace-admin
/media/nvme/websites/fullstack-marketplace-blueprint/marketplace-shopowner
/media/nvme/websites/fullstack-marketplace-blueprint/marketplace-user`, each with its own `package.json`,
`.githooks/`, `env` (ports 3043/3044/3045 respectively — `grep -m1 '^PORT=' <app>/env`). Each app's `env`
or `src/api/endpoints.ts`/equivalent should reference only its own tier's service ports (Admin: 4024/4025;
ShopOwner: 4026/4029; User: 4027/4031/4032; all 3: 4030 logout) — a reference to another tier's resource
port (e.g. `marketplace-user` importing 4024) is a violation.

Violation on disk looks like: a shared `src/` directory imported via relative path across
`marketplace-admin`/`marketplace-shopowner`/`marketplace-user` (there is no shared frontend package, so any
cross-app `import` is by definition a boundary break); a `role` or tier-branch conditional inside any one
app's router or component tree (`grep -rn "tier ===" marketplace-admin/src marketplace-shopowner/src
marketplace-user/src` should return nothing meaningful — each app has exactly 1 tier, so a runtime branch
on tier signals the merge this ADR rejected); or a PR that makes `companyAdd`'s ShopOwner-tier and
Admin-tier return types match without citing this ADR.
