# ADR-001 — Polyrepo — fifteen independent git repos under one parent workspace
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Platform split across 3 tiers (ShopOwner, Admin, User) × 9 backend services + `marketplace-common` lib
+ `marketplace-db-setup` migrations + 3 frontend SPAs/SSR apps. 2026-08-04: a platform-wide naming sweep landed
across the whole workspace (`CLAUDE.md` §Two naming rules, ADR-013).
Same day, source layout decision needed for the tree it produced.

Origin constraint: no existing per-repo commit history to split. So the choice was not
"split an existing monorepo" — it was "commit 14 independently-versioned packages plus a parent, from
scratch, in one sweep."

Forces:
- 9 backend services each own a Koa 3 + Apollo Server 5 process, own port, own `.env`, own
  `.githooks/`, own Qodana project/token. Verified: `BEs/dev/marketplace-dev-public-authorization/.git`
  through the other 8 each a separate `.git` dir.
- `marketplace-common` is consumed as an npm package name
  (`@axiumine/marketplace-common`) that 404s on npmjs — bridged locally by
  `BEs/marketplace-common/deploy-local.sh` syncing `dist/` into every consumer's `node_modules/`
  (`docs/workflow.md` §Repo layout, CON-09). Package-name coupling, not path coupling — already decoupled
  from source-tree shape before this ADR.
- 3 frontends (`marketplace-admin`, `marketplace-shopowner`, `marketplace-user`) are independent Vite
  apps, different rendering models (2 SPA, 1 SSR via TanStack Start), different ports (3043/3044/3045).
- Quality gates are heavy and per-package: 100% coverage + 100 mutation score + lint + `tsc --noEmit` +
  Qodana, enforced via `.githooks/pre-commit` and `.githooks/pre-push` (CON-08). Each repo needs its
  own Qodana cloud project — tokens are per-project, a shared token would corrupt baselines
  (`docs/frontends.md` §marketplace-admin and marketplace-shopowner and §services-status).
- No forge decided yet — publishing destination/org is explicitly the user's undecided call
  (`docs/workflow.md` §Repo layout, phase3 CONSTRAINTS.md §5).

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Single monorepo (all 14 packages + parent in one `.git`) | One commit spans every affected repo — atomic cross-cutting change; one set of hooks/CI to wire; one Qodana project | 9 services need independent deploy/restart cadence with no shared release train; per-service `.githooks` gates (100/100 coverage+mutation, own Qodana token) don't map onto one repo's CI without inventing path-filtering from scratch; `marketplace-common` is already consumed by package name via `deploy-local.sh`, so folding it into the same tree buys nothing the sync script doesn't already give |
| Polyrepo, 15 independent repos (14 sub-repos + parent), no atomic cross-repo commit | Each service/lib/app keeps its own git history, hooks, gates, Qodana project untangled from the other 13; matches the existing per-service `.env`/port/deploy-local.sh boundary that already existed pre-rename; parent stays thin (docs + `.claude/` + workspace `CLAUDE.md`), `.gitignore`s the 4 heavy dirs so `git status` at the top level stays fast | One logical change (e.g. a `marketplace-common` field rename) becomes N separate commits across N repos with no atomic transaction — `git diff`/`git log` at the top level answers nothing about a cross-repo change; branch discipline must be re-applied 15 times (`docs/workflow.md` §Git rules, "never commit on main") |
| Git submodules (parent repo, 14 submodule pointers) | Gets partial atomicity — parent commit pins exact sub-repo SHAs, so a cross-repo state can be captured in one parent commit | Submodule pointer bumps are still N+1 commits (14 subs + 1 parent) for any real cross-cutting change, so the coordination cost is not actually smaller than plain polyrepo; adds submodule-init/update friction to every `dev.sh` and CI run for no offsetting atomicity gain, since sub-repos still commit independently between parent syncs |

---

## Decision

Polyrepo, 15 independent repos, no submodules, no monorepo. Chosen over the monorepo row because the
package-name coupling for `marketplace-common` (`deploy-local.sh` sync, CON-09) already gives cross-repo
propagation without a shared tree, and the per-repo gate stack (100/100 coverage+mutation, own Qodana
token) maps directly onto "one repo = one hook set = one cloud project" — collapsing to a monorepo would
mean inventing path-scoped CI to recover what git-repo boundaries give for free. Chosen over submodules
because pointer-bump commits do not reduce the N-commits-per-change cost the polyrepo already pays, so
submodules add tooling friction (init/update on every clone, every `dev.sh` run) without buying back
atomicity that matters.

Parent (`fullstack-marketplace-blueprint`, this repo) tracks only workspace files (`CLAUDE.md`,
`.claude/`, `.agents/`) and `.gitignore`s `/BEs/`, `/marketplace-admin/`, `/marketplace-shopowner/`,
`/marketplace-user/` (verified on disk — `.gitignore` line-for-line matches). `services-status` is the
deliberate exception: it has no repo of its own and is tracked directly by the parent
(`git ls-files services-status` returns real paths — `coverage`, `dist`, `env`, `services-status/.gitignore`,
`.hgignore`, `.nvmrc`), which is also why its gates had to be bolted onto the parent's own
`.githooks/pre-commit` rather than living in a repo-local hook (`docs/frontends.md` §services-status).

```
BEs/
├── marketplace-common/    # own .git
├── marketplace-db-setup/  # own .git
└── dev/                   # 9 service dirs, each own .git
marketplace-admin/         # own .git — gitignored by parent
marketplace-shopowner/     # own .git — gitignored by parent
marketplace-user/          # own .git — gitignored by parent
services-status/           # NO own .git — tracked by parent directly
```

---

## Consequences

### Positive
- Each of the 9 backend services keeps its own `.githooks/pre-commit` / `pre-push` gate chain
  (lint → `tsc` → coverage → mutation → Qodana) scoped to exactly its own diff — no path-filtering
  config needed, the repo boundary *is* the filter.
- `marketplace-common` version bumps stay a deliberate, explicit act
  (`./deploy-local.sh` then a version bump commit in each of the 9 consumers) rather than an implicit
  side effect of a monorepo-wide build graph — matches the "consumed by package name, not path link"
  reality already baked into `package.json` (CON-09).
- Qodana Cloud projects stay one-token-per-repo, so a scan never files under the wrong project's
  baseline (`docs/frontends.md` explicitly names this risk for `marketplace-admin`'s `1rylx` project and
  `services-status`'s `xPKXD`).
- Rollback/blame at the sub-repo level works normally — `git log`, `git bisect`, `git blame` inside any
  one of the 15 answer real questions about that package's history.

### Negative
- No atomic cross-repo commit. A `marketplace-common` schema field change that must land in a service's
  resolver too is N separate commits with no transaction boundary — `docs/workflow.md` §Repo layout states
  this outright: "There is no atomic cross-repo commit."
- Coordination is manual and convention-only, not tool-enforced: "one logical change = N separate `git`
  commits, one per affected repo," landing dependencies first (`marketplace-common` →
  `deploy-local.sh` → bump consumers) is a sequencing rule a human/agent must remember every time, not
  something git or CI verifies.
- Branch-first discipline ("never commit on `main`") must be independently re-applied in all 15 repos;
  nothing propagates a branch decision made in one repo to the others.
- Cross-repo value agreement (shared env vars like `KEYGRIP_KEY_1/2`, `INTROSPECTION_CODE`) is
  unenforced by construction — no test spans two repos, so drift between them (documented: the
  2026-08-07 `*-user-authenticated-*` `.env` mismatch) is invisible until a manual fingerprint sweep.

### Risks
- **Risk:** a change spanning `marketplace-common` + N services gets committed in some repos but not
  others (partial rollout), leaving consumers on mismatched contract versions with no atomic guard.
  Revisit trigger: two or more such partial-rollout incidents traced to missing atomicity within one
  quarter — would argue for either a cross-repo commit-orchestration script or the monorepo option
  re-opened at that specific pain point (not wholesale).
- **Risk:** merged-branch cleanup (`git branch -d`) is a manual per-repo habit; already observed to
  fail at scale once (`chore/qodana-severity-gate` survived in 8 repos before the branch-deletion rule
  was written, per `docs/workflow.md` §Git rules). Revisit trigger: dead-branch count crossing double digits
  again would argue for a repo-local `post-merge` hook doing the deletion automatically.
- **Risk:** 15 separate repos means 15 separate "where does this get published" decisions
  deferred to the user (`docs/workflow.md` §Repo layout: "Deciding where these fifteen repos get published...
  has not been made"). Revisit trigger: first actual publish request — at that point org/forge topology
  needs answering for all 15 at once, not one at a time, or the polyrepo boundary drifts from the
  publish boundary.

---

## Compliance

From the workspace root, verify repo count and boundary: `find . -maxdepth 3 -name .git -type d | wc -l` must return 14 (sub-repos only; parent's own `.git` is at depth 1 and is the 15th). Verify parent ignores the 4 heavy dirs: `git check-ignore -v BEs marketplace-admin marketplace-shopowner marketplace-user` must each resolve to the `.gitignore` lines shown above. Verify `services-status` is the one tracked exception: `git ls-files services-status | wc -l` must be nonzero while the same command for `BEs`/`marketplace-admin`/etc must be zero.

A violation looks like: a `.git` directory appearing inside `BEs/` or one of the 3 frontend dirs (nested
repo, breaks the gitignore boundary); a cross-repo change landing as a single commit message spanning
two repo paths (impossible under separate `.git`s, but a symptom if someone re-monorepos by merging
histories); or a new backend/frontend package added without its own `.git` + `.githooks/` +
`core.hooksPath` config (silently ungated, as `services-status` was before 2026-08-07 — `docs/frontends.md`
§services-status).
