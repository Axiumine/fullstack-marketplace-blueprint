# ADR-060 — marketplace-services-status is a repo of its own, tracked as the sixteenth submodule
# Marketplace

**Status:** accepted
**Date:** 2026-11-25
**Deciders:** Giovanni Manzoni, platform owner, in the working session of 2026-11-25: *"make it a repo, remove the code from the root project and use
it as submodule as other submodules repo"*.
**Supersedes:** [`ADR-025`](./ADR-025-services-status-gated-by-parent-hooks.md)
**Superseded by:** —

---

## Context

[ADR-025](./ADR-025-services-status-gated-by-parent-hooks.md) kept `marketplace-services-status` as a directory of the parent workspace, gated by
the parent's hooks, and rejected giving it a repository. It was the one application on the platform that did not follow the shape
[ADR-001](./ADR-001-polyrepo-over-monorepo.md) and [ADR-031](./ADR-031-sub-repos-tracked-as-submodules.md) give every other one, and every rule
about branches, commits, hooks and CI carried an exception for it. The owner reversed that choice. This ADR records the decision and what it costs,
and does not argue a motive beyond the owner's instruction.

## Decision

1. `marketplace-services-status` is a repository of its own, `Axiumine/marketplace-services-status`. Its history is the directory's history in the
   parent, extracted with `git subtree split`.
2. The parent tracks it as a submodule at the same path, with the relative URL `../marketplace-services-status.git`, exactly as ADR-031 does for the
   others. The workspace is seventeen repositories: the parent and sixteen submodules.
3. The gates move with the code and none is dropped. The new repository's `pre-commit` runs the secret guard, then `typecheck`, `test:cov` and Qodana
   on staged non-markdown paths; `pre-push` runs the seven gates in their previous order; `.github/workflows/gates.yml`, `codeql.yml`,
   `scorecard.yml`, `dependabot.yml`, `.github/tools` and `SECURITY.md` live there. `core.hooksPath` is restored by its own `postinstall`.
4. The parent ships no package. Its `pre-commit` is the secret guard alone. Its `pre-push` and its `gates` job run the self-tests of the cross-repo
   checks (`scripts/*-selftest.sh`), and `pre-push` keeps the Scorecard floor. The job id `gates` stays, because branch protection names it.

## Consequences

### Positive

- One shape for every application: no directory-scoped hook, no workflow with a `working-directory`, no exception to the N+1 commit rule.
- `scripts/audit-check.sh` sections that walk the submodules now read this application's source too, including the third-party host check.

### Negative

- A change to the application is two commits: one in its repository and one pointer bump in the parent.
- A fresh clone of the parent holds no application code until the submodule is initialised.

### Open

- ⚠️ **The parent's `Fuzzing` check.** OpenSSF Scorecard detected the `fast-check` imports in this application's tests as part of the parent's own tree.
  They now belong to the new repository, so the parent scores 0 on that check once this change reaches `main`, below the `Fuzzing=10` in the parent's
  `.scorecard-floor`. The floor is not changed here: that is the owner's ruling to make ([ADR-054](./ADR-054-the-supply-chain-score-is-a-gate-with-a-floor.md)).
- The new repository's `.scorecard-floor` records its first measurement, 2026-11-25, when `main` held only the extracted history: `Dependency-Update-Tool`,
  `SAST` and `Security-Policy` read 0 and `Dangerous-Workflow`, `Pinned-Dependencies` and `Token-Permissions` read -1. Raise them once the branch that
  adds the workflows, `SECURITY.md` and the Dependabot config is merged into `main`.

## Compliance

From the workspace root, `git submodule status marketplace-services-status` prints one entry, and
`git -C marketplace-services-status rev-parse --show-toplevel` prints the submodule's own directory. A violation looks like application files of
`marketplace-services-status` tracked by the parent, or a gate of ADR-025's list missing from the new repository's hooks.
