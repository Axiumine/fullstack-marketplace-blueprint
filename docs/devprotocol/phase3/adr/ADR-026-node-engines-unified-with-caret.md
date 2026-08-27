# ADR-026 — engines.node is ^24.18.0 in every package.json, caret included
# Marketplace

**Status:** accepted
**Date:** 2026-08-07
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Polyrepo, 16 repos (`docs/workflow.md` §Repo layout), 15 `package.json` on disk under this workspace — 14 sub-repos
plus `marketplace-services-status/package.json` (parent-tracked, no repo of its own). Node pinned via `engines.node` in
14 of them; the parent workspace has none.

Before this decision `engines.node` was spelled four ways: `^24.14.0`, `^24.14`, `24.14`, `24.14.0`, and
two repos had no `engines` block at all. Two of those four spellings carry no caret. Under semver a bare
`24.14` resolves as `24.14.x` and a bare `24.14.0` resolves as that one release only — neither means "24.14
or newer". Three services therefore rejected a local Node 24.18.0 outright while the rest installed clean.

`engines` is enforced under yarn classic, all 14 repos use yarn (`docs/workflow.md` §Commands). A mismatch is a
hard gate: `yarn install` / any yarn invocation exits 1 with `The engine "node" is incompatible with this
module`, not a warning. Every repo's `.githooks/pre-push` shells out to yarn for its gates (lint, coverage,
mutation, Qodana) — an unpinned or wrong-caret `engines.node` meant a node/yarn mismatch died under
whichever gate ran first, and the failure read as that gate's own error (a lint failure, a type error)
rather than as a node version problem. Verified in
`BEs/dev/marketplace-dev-public-authorization/.githooks/pre-push:14` (comment: "Ahead of all four: node.
Every gate shells out to yarn, and `engines.node` is a…") and `:33` (`REQUIRED_NODE="$(node -p
'require("./package.json").engines.node' …)"`), `:70` (`does not satisfy engines.node ^$REQUIRED_NODE —
switching via nvm`).

`packageManager` is a separate, narrower pin, and it is now in **all 15 packages** — the same
`yarn@1.22.22+sha512.…` string everywhere, verified via `grep -l '"packageManager"' */package.json
BEs/*/package.json BEs/dev/*/package.json` returning 15 files. It was in 7 when this ADR was written
(`marketplace-db-setup`, the two `*-user-authenticated-*` services, the three frontends and
`marketplace-services-status`); `marketplace-common` and the seven original backend services resolved to whatever
yarn Corepack found on `PATH`, which is a different yarn per developer for the repos that publish and
consume `@axiumine/marketplace-common`. It stays orthogonal to this ADR: `packageManager` fixes the
yarn binary, `engines.node` fixes the Node runtime the gates and the app run under.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Leave spellings as-is, document the difference | No edit required, zero risk of breaking a currently-working repo | 3 of 14 stay silently broken against the actual dev Node; failures keep surfacing as unrelated gate errors; every future Node bump repeats the same confusion in a new repo |
| Pin exact version, no caret (`24.18.0` everywhere) | Fully reproducible, no ambiguity, matches the "24.14.0" style already present in 2 repos | Blocks every patch release (`24.18.1`, security fixes) until every one of 14 `package.json` is bumped by hand; turns a routine patch update into a 14-repo sweep |
| Pin caret range, unified string (`^24.18.0`) everywhere | Patch/minor updates within `24.x` install without an edit; one spelling to grep for; matches semver's actual meaning of "24.18.0 or compatible newer" | Slightly less reproducible than an exact pin — a contributor on `24.19.x` could see gate behavior a `24.18.0` machine hasn't hit, though `nvm use` in `pre-push` collapses that gap at gate time |
| Move the pin to `.nvmrc` only, drop `engines` | Single file per repo instead of a JSON block; conventional for nvm-based workflows | Loses yarn's own hard gate — yarn classic does not read `.nvmrc`, so the exit-1 enforcement at `yarn install` disappears and a mismatch would only be caught later, inside `pre-push`, again reading as the wrong error |

---

## Decision

Unify on the fourth table row's *string* (`^24.18.0`, caret kept) using the third row's *mechanism*
(`engines.node`, not `.nvmrc`). Caret over exact pin: the codebase already needs to move Node forward as
patches land, and an exact pin would turn every patch bump into a mandatory 14-repo edit for no gain — the
`pre-push` `nvm use` step (`BEs/dev/marketplace-dev-public-authorization/.githooks/pre-push:70`) already
normalizes the actual running version at gate time, so the caret's small reproducibility cost is already
covered by that step. `engines.node` over `.nvmrc`-only: yarn classic's hard exit-1 on `engines` mismatch
(`docs/conventions.md` §Node and package manager: "a mismatch exits 1 with `The engine "node" is incompatible with this module`, it is not a warning") is what makes the failure
visible *before* a gate runs under the wrong Node and mislabels itself — an `.nvmrc`-only approach loses
that pre-check and reproduces exactly the "reads as a type error" failure mode this decision exists to
close.

---

## Consequences

### Positive
- One string, `^24.18.0`, greppable across all 14 `package.json` — verified present in all 14 sub-repos
  plus `marketplace-services-status/package.json` (15 total, parent workspace excluded, matching [`docs/workflow.md`](../../../workflow.md) §Commands
  wording).
- `yarn install` / `yarn <script>` now fails loud and immediately on a genuinely incompatible Node, instead
  of three specific services failing while the rest silently worked.
- `pre-push`'s node-selection step (`BEs/dev/marketplace-dev-public-authorization/.githooks/pre-push:33-70`)
  has one predictable place to read the required version from in every repo — no per-repo special-casing
  for a bare-number spelling.

### Negative
- 14 separate edits for what is conceptually one decision — no atomic cross-repo commit exists in this
  polyrepo (`docs/workflow.md` §This directory is the parent workspace), so this ADR itself required touching 14
  `package.json` files as 14 separate commits, one per repo.
- Caret range means two contributors' machines can legitimately run different `24.x` patch levels; the
  only thing guaranteeing they converge at gate time is the `nvm use` step in `pre-push`, not the pin
  itself.

### Risks
- **Node 25 or a Node 24 EOL forces a major bump.** Revisit when `^24.18.0` needs to become `^25.x.0` (or
  later) — the same 14-repo sweep applies, and the caret-vs-exact tradeoff should be re-checked against
  whatever the ecosystem's patch cadence looks like then.
- **A new repo is added to the workspace without copying the exact string.** Revisit if a fifteenth
  sub-repo's `package.json` ships with a bare number or a missing `engines` block — the drift this ADR
  fixes recurs one repo at a time exactly the way it started.
- **`packageManager` and `engines.node` drift apart in meaning over time** (e.g. someone reads
  `packageManager` as also pinning Node). Revisit only if that confusion actually causes a mis-pin; today
  the two fields are independent and both correctly set where present.

---

## Compliance

Verify with a single grep across the workspace:

```bash
grep -A1 '"engines"' */package.json BEs/*/package.json BEs/dev/*/package.json 2>/dev/null | grep '"node"'
```

Every line must read `"node": "^24.18.0"`, no exceptions, no bare-number or no-caret variant. A violation
looks like any of: a `package.json` with `"node"` set to `24.18.0` (no caret), `^24.14.0` or any stale
version, a bare `24.18` with no caret, or a `package.json` with no `engines` block at all in one of the 14
sub-repos or `marketplace-services-status`. When bumping Node, the sweep is complete only when this grep returns the
new string on every one of the 14 sub-repo `package.json` files plus `marketplace-services-status/package.json` — check
the count, not just that the command ran clean.
