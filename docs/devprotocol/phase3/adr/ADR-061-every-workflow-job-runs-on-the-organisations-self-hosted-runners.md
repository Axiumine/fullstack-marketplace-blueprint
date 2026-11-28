# ADR-061 — every workflow job runs on the organisation's self-hosted runners
# Marketplace

**Status:** accepted
**Date:** 2026-11-28
**Deciders:** Giovanni Manzoni, platform owner, in the working sessions of 2026-11-25, *"use only private server runners. I will double check PR
from users that are not me for check what they will run on my runners"*, and of 2026-11-28, that no runner is to be created for this platform and
*"all private runners available"* are to be used.
**Supersedes:** [`ADR-054`](./ADR-054-the-supply-chain-score-is-a-gate-with-a-floor.md) in part, publishing the score and its badge (§Decision 1);
[`ADR-055`](./ADR-055-the-gates-run-on-github-too-and-main-requires-them.md) in part, the §Compliance rule against a self-hosted runner.
**Superseded by:** —

---

## Context

Every job of the platform's workflows, in all seventeen repositories, ran on GitHub-hosted `ubuntu-latest`. The organisation has its own
self-hosted runners: persistent, in the organisation's default runner group, labelled `self-hosted`, `Linux`, `X64`, and shared with other
repositories of the organisation. The owner ruled that these, and only these, run the platform's jobs.

ADR-055 refused to move the gates onto a self-hosted runner on the development workstation, because a `pull_request` trigger, a self-hosted
runner and a public repository together let any fork execute code on it. The organisation's runners are not that workstation, and the fork path is
met by approval: a fork's pull request runs nothing until the owner has approved it.

## Decision

1. Every job declares `runs-on: [self-hosted, Linux, X64]`, which any of the organisation's runners satisfies. No GitHub-hosted label is used,
   and no runner, runner group or label is created for this platform.
2. Fork pull requests require approval for all external contributors (`all_external_contributors`, verified on all seventeen repositories on
   2026-11-28). The owner reads the whole diff, workflow files included, before approving.
3. `scorecard.yml` sets `publish_results: false` and drops `id-token: write`, because `api.scorecard.dev` accepts results from GitHub-hosted
   runners only. The Scorecard badge leaves the READMEs. The `.scorecard-floor` gate in `pre-push` is unchanged, and the SARIF still reaches the
   Security tab.
4. Because the runners are persistent, `gates` keeps Corepack, Yarn and npm state under `RUNNER_TEMP`, which keeps ADR-055's rule that no
   dependency cache passes from one pull request to the next. The `timeout-minutes` of the fourteen-package `gates.yml` rises from 120 to 360,
   because the runners differ in speed; no gate and no threshold changes. `codeql` installs Node with `actions/setup-node`, which GitHub's
   images carried and these runners do not.
5. Dependabot's own update jobs stay on GitHub-hosted runners: GitHub does not run them on self-hosted runners for public repositories. The
   workflows its pull requests trigger run on the organisation's runners like every other job.

## Consequences

### Positive

- The owner decides which machines execute the platform's code.
- No GitHub-hosted job is left in any repository's workflows.

### Negative

- Code from a pull request runs on persistent hosts shared with other repositories; what one job leaves behind, a later job can meet.
- Approval covers forks only. A pull request from Dependabot, or from a branch pushed by anyone with write access, runs without approval.
  ADR-059's `enableScripts: false` limits what a newly bumped dependency executes at install; its code still runs under the test and mutation
  gates.
- `runs-on` is routing, not a boundary: a pull request runs its own copy of the workflow file.
- With every runner offline, the required `gates` check waits. The way out is a pull request that changes `runs-on` back, which runs under its
  own copy of the workflow.
- The public Scorecard badge and the `api.scorecard.dev` entry stop being updated.

## Compliance

- No workflow names a GitHub-hosted label.
- No workflow gains a `pull_request_target` or `workflow_run` trigger, or a dependency cache.
- The fork approval setting stays `all_external_contributors`.
