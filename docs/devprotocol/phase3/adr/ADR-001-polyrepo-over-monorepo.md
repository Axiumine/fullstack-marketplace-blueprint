# ADR-001 — Polyrepo — sixteen independent git repos under one parent workspace
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Platform split across 3 tiers (ShopOwner, Admin, User) × 9 backend services + `marketplace-common` lib
+ `marketplace-db-setup` migrations + `marketplace-nginx` edge + 3 frontend SPA/SSR apps. Fifteen
packages, one workspace directory, and a source-layout decision owed before any of it is committed.

Origin constraint: there is no existing commit history to split. So the choice is not "split an existing
monorepo" — it is "commit 15 independently-versioned packages plus a parent, from scratch, in one
sweep."

Forces:
- 9 backend services each own a Koa 3 + Apollo Server 5 process, own port, own `.env`, own
  `.githooks/`, own Qodana project/token. Verified: `BEs/dev/marketplace-dev-public-authorization/.git`
  through the other 8 each a separate `.git` dir.
- `marketplace-common` is consumed as an npm package name (`@axiumine/marketplace-common`), published
  on npmjs since 2026-08-26 ([`ADR-037`](./ADR-037-marketplace-common-is-published-to-npm.md)) — `1.0.1` that
  day, `2.0.0` since 2026-08-27 — this bullet said the name 404s there, which was true when it was written
  and is not now. Edits the
  registry has not released are bridged locally by `BEs/marketplace-common/deploy-local.sh` syncing
  `dist/` into every consumer's `node_modules/` (`docs/workflow.md` §Repo layout, CON-09). Package-name
  coupling, not path coupling — already decoupled from source-tree shape before this ADR, and publication
  did not change that, which is the only thing this ADR rests on.
- 3 frontends (`marketplace-admin`, `marketplace-shopowner`, `marketplace-user`) are independent Vite
  apps, different rendering models (2 SPA, 1 SSR via TanStack Start), different ports (3043/3044/3045).
- `marketplace-nginx` has no `package.json` at all — its gates are a shell suite of its own (ADR-030),
  which no JS-package tooling would run.
- Quality gates are heavy and per-package: 100% coverage + 100 mutation score + lint + `tsc --noEmit` +
  Qodana, enforced via `.githooks/pre-commit` and `.githooks/pre-push` (CON-08). Each repo needs its
  own Qodana cloud project — tokens are per-project, a shared token would corrupt baselines
  (`docs/frontends.md` §marketplace-admin and marketplace-shopowner and §marketplace-services-status).
- No forge decided yet — publishing destination/org is explicitly the user's undecided call
  (`docs/workflow.md` §Repo layout, phase3 CONSTRAINTS.md §5).

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Single monorepo (all 15 packages + parent in one `.git`) | One commit spans every affected package — atomic cross-cutting change; one set of hooks/CI to wire; one Qodana project | 9 services need independent deploy/restart cadence with no shared release train; per-package `.githooks` gates (100/100 coverage+mutation, own Qodana token) don't map onto one repo's CI without inventing path-filtering from scratch; `marketplace-common` is already consumed by package name via `deploy-local.sh`, so folding it into the same tree buys nothing the sync script doesn't already give; `marketplace-nginx` has no `package.json` and would sit inside a JS monorepo as an exception to every rule |
| Hybrid — one repo for the 9 backend services, separate repos for the lib, the migrations, the edge and the 3 frontends | The 9 services are the most alike of the packages, so one release train covers the largest group; cuts the repo count from 16 to 7 | The 9 services are exactly where the per-package gate stack is heaviest — 9 Qodana projects, 9 mutation runs, 9 `.env` files, 9 ports — so it collapses the group whose boundaries carry the most, and buys atomicity only *within* it while the `marketplace-common` change that actually spans repos still crosses the boundary; picks an arbitrary line ("services are one thing, apps are another") that nothing in the deploy model supports |
| Polyrepo — 16 independent repos, one per package plus the parent workspace (**chosen**) | Each service/lib/app/edge keeps its own git history, hooks, gates and Qodana project untangled from the other 14; matches the per-package `.env`/port/`deploy-local.sh` boundary that already exists; the parent stays thin — docs, `.claude/`, workspace [`CLAUDE.md`](../../../../CLAUDE.md) — and one clone of it is a workspace, not a code drop | One logical change (e.g. a `marketplace-common` field rename) becomes N separate commits across N repos with no atomic transaction; branch discipline must be re-applied 16 times (`docs/workflow.md` §Git rules, "never commit on main") |

---

## Decision

Polyrepo, 16 independent repos, no monorepo. Chosen over the monorepo row because the package-name
coupling for `marketplace-common` (`deploy-local.sh` sync, CON-09) already gives cross-repo propagation
without a shared tree, and the per-repo gate stack (100/100 coverage+mutation, own Qodana token) maps
directly onto "one repo = one hook set = one cloud project" — collapsing to a monorepo would mean
inventing path-scoped CI to recover what git-repo boundaries give for free. Chosen over the hybrid row
because the group it merges is the one whose per-package boundaries carry the most weight, and the
cross-repo change it fails to make atomic is the only one that happens often.

Sixteen histories is the whole of this decision. **How the parent workspace *references* the fifteen
sub-repos is a separate question, decided in ADR-031: it tracks each as a submodule, recording a pinned
commit SHA and nothing else.** A gitlink is a pointer, not a merge — sub-repo files are versioned in the
sub-repo and never in the parent, and every commit, branch, hook and gate stays where it is. The two
decisions compose: ADR-001 says the histories are separate, ADR-031 says the parent can name a consistent
set of them.

`marketplace-services-status` is the deliberate exception to the count: it has no repo of its own and is tracked
directly by the parent (`git ls-files marketplace-services-status` returns real paths — `coverage`, `dist`, `env`,
`marketplace-services-status/.gitignore`, `.hgignore`, `.nvmrc`), which is also why its gates had to be bolted onto
the parent's own `.githooks/pre-commit` rather than living in a repo-local hook (ADR-025,
[`docs/frontends.md`](../../../frontends.md) §marketplace-services-status). `marketplace-docker-DBs/` is tracked by the parent for the same reason — it is
compose files and scripts, not a package.

```
BEs/
├── marketplace-common/    # own .git — submodule of the parent
├── marketplace-db-setup/  # own .git — submodule of the parent
└── dev/                   # 9 service dirs, each own .git, each a submodule
marketplace-admin/         # own .git — submodule
marketplace-nginx/         # own .git — submodule, no package.json, own gates (ADR-030)
marketplace-shopowner/     # own .git — submodule
marketplace-user/          # own .git — submodule
marketplace-services-status/           # NO own .git — tracked by parent directly
marketplace-docker-DBs/                # NO own .git — tracked by parent directly
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
  baseline — fifteen repos, fifteen distinct projects, enumerated in `phase1/SYSTEM_CONTEXT.md` §5.12.
  ⚠️ This bullet cited `marketplace-admin`'s project as `1rylx` on the authority of `docs/frontends.md`;
  it is `VOZEg`, and `docs/frontends.md` names only `marketplace-services-status`'s `xPKXD`, which is the
  repo whose near-miss is the actual example of the risk.
- Rollback/blame at the sub-repo level works normally — `git log`, `git bisect`, `git blame` inside any
  one of the 16 answer real questions about that package's history.
- `marketplace-nginx` needs no place in a JS toolchain it does not belong to: its own repo, its own shell
  gates, no `package.json` anywhere in the argument.

### Negative
- No atomic cross-repo commit. A `marketplace-common` schema field change that must land in a service's
  resolver too is N separate commits with no transaction boundary — [`docs/workflow.md`](../../../workflow.md) §Repo layout states
  this outright: "There is no atomic cross-repo commit." The parent's submodule pointers record the
  resulting state (ADR-031); they do not make the change atomic.
- Coordination is manual and convention-only, not tool-enforced: "one logical change = N+1 `git`
  commits, one per affected repo plus the parent pointer bump," landing dependencies first
  (`marketplace-common` → `deploy-local.sh` → bump consumers) is a sequencing rule a human/agent must
  remember every time, not something git or CI verifies.
- Branch-first discipline ("never commit on `main`") must be independently re-applied in all 16 repos;
  nothing propagates a branch decision made in one repo to the others.
- Cross-repo value agreement (shared env vars like `KEYGRIP_KEY_1/2`, `INTROSPECTION_CODE`) is
  unenforced by construction — no test spans two repos, so drift between them is invisible until a manual
  fingerprint sweep.
  ⚠️ **Amended 2026-08-13 (E18-S06).** The consequence stands; the first example no longer exists.
  `KEYGRIP_KEY_1`/`_2` are gone from every `env` template and every `REQUIRED_ENV_VARS` — the signing keys
  are one wrapped Redis record all holders read (**ADR-034**), a service that cannot unwrap it exits rather
  than binding a port, and `<REDIS_KEY>keygrip:holders` shows a per-service fingerprint, so that one value
  is now enforced across repos by construction instead of by sweep. Read the bullet against
  `INTROSPECTION_CODE` and `REDIS_PASSWORD`, which are still exactly as described.

### Risks
- **Risk:** a change spanning `marketplace-common` + N services gets committed in some repos but not
  others (partial rollout), leaving consumers on mismatched contract versions with no atomic guard.
  Revisit trigger: two or more such partial-rollout incidents traced to missing atomicity within one
  quarter — would argue for either a cross-repo commit-orchestration script or the monorepo option
  re-opened at that specific pain point (not wholesale).
- **Risk:** merged-branch cleanup (`git branch -d`) is a manual per-repo habit, and at sixteen repos a
  missed one is invisible. Revisit trigger: dead-branch count crossing double digits would argue for a
  repo-local `post-merge` hook doing the deletion automatically.
- **Risk:** 16 separate repos means 16 separate "where does this get published" decisions
  deferred to the user (`docs/workflow.md` §Repo layout). Revisit trigger: first actual publish request —
  at that point org/forge topology needs answering for all 16 at once, not one at a time, or the polyrepo
  boundary drifts from the publish boundary.

---

## Compliance

From the workspace root, verify repo count and boundary:

```bash
find . -maxdepth 4 -name .git -type d -not -path './node_modules/*' | wc -l   # 16 — parent plus 15 sub-repos
git ls-files -s | grep -c '^160000'                                          # 15 — one gitlink each (ADR-031)
git ls-files marketplace-services-status | wc -l                                         # nonzero — the tracked exception
```

The boundary check is that the parent records **only** gitlinks under the sub-repo paths — a submodule
pins a sub-repo, it does not absorb it:

```bash
git ls-files -s $(git config -f .gitmodules --get-regexp 'submodule\..*\.path' | awk '{print $2}') \
  | grep -vc '^160000'          # must be 0 — anything else is a sub-repo's files committed into the parent
```

A violation looks like: a sub-repo's ordinary files appearing in the parent's index rather than a single
gitlink; two packages sharing one `.git` (a re-monorepo by merging histories); or a new backend/frontend
package added without its own `.git` + `.githooks/` + `core.hooksPath` config, which is silently ungated —
the state `marketplace-services-status` was in before ADR-025 (`docs/frontends.md` §marketplace-services-status).
