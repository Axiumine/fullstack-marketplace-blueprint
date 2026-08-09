# ADR-017 — Git hooks are enabled by core.hooksPath, restored by a prepare script, and Qodana runs in both pre-commit and pre-push
# Marketplace

**Status:** accepted
**Date:** 2026-08-07
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

15 gated repos here — 14 sub-repos + this parent workspace; `marketplace-nginx`, the sixteenth, has no `package.json`, so neither the `prepare` mechanism nor the lint/coverage/mutation/Qodana tail below reaches it and it gates on its own test suite and the secret guard instead (ADR-030). Every one of the 14 commits `.githooks/pre-commit` and `.githooks/pre-push`, mode `100755`, enforcing lint, 100% coverage (CON-08), mutation, Qodana. None of it fires by itself. Git reads `.git/hooks/` by default; a repo only looks in `.githooks/` if local config `core.hooksPath` points there. That config is per-worktree and not versioned — a fresh clone starts without it regardless of what is committed. A committed hook with no wiring is documentation of intent rather than a running control, and it fails open: the commit succeeds and prints nothing to say the gate never ran.

Two more findings in the same sweep, same root cause (a check exists on disk but nothing runs it):

- A `qodana.sh` committed at `100644` (non-executable) rather than `100755` dies with `Permission denied` before reaching Qodana. It then exits non-zero having written no results directory, so the hook reports a generic `Qodana failed on <app>` pointing at a SARIF path that was never created — indistinguishable from "Qodana ran and found nothing," and, from the log alone, indistinguishable from "hook path missing entirely."
- Even once `core.hooksPath` is set, `git merge --no-ff` does not run `pre-commit` — git only fires that hook for `git commit`. In the standing branch → commit → merge → push flow (`docs/workflow.md` §Git hooks, "never commit on main"), the merge commit — the one revision that actually reaches the tip of `main` — is the single commit no `pre-commit` scan ever inspects. Two branches individually clean at their own `pre-commit` can merge into a tree that isn't.
- Qodana Cloud files each report under the branch `git HEAD` names at scan time, and the CLI takes no `--branch` override. A repo gated only by `pre-commit` runs every scan on a feature branch and can never produce a report tagged `main` — so the cloud project has no branch to treat as its "new problems" baseline.

Constraint in force: CON-08 / `CONSTRAINTS.md` §4 marks the quality gate regime (100/100, lint, tsc, Qodana, hook wiring via `core.hooksPath`) as an invariant Phase 3 may not redesign, flagged 🔴 Critical in `phase1/NFR.md` NFR-MA01/MA02/MA05. This ADR records how the wiring works and stays working — it does not touch what the gates check.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A. `core.hooksPath` set once by hand per clone, no automation | Zero code, matches git's own model | Silently reverts on any fresh clone or worktree; exactly the failure mode that produced the bug — nothing errors, the gate just doesn't run |
| B. Symlink or copy `.githooks/*` into `.git/hooks/` at commit time via a helper script the user is told to run | Works without touching `package.json`; no reliance on `core.hooksPath` at all | Still manual and still silent on skip; `.git/hooks/` is untracked by design so the copy has no version control and drifts from `.githooks/` unnoticed |
| C. `"prepare": "git config core.hooksPath .githooks \|\| true"` in each sub-repo's `package.json`, run automatically by `yarn install` | Self-healing on every install a developer already runs (`dev.sh` calls `yarn install`); `\|\| true` keeps install from hard-failing in an environment without git; declarative and versioned alongside the code it gates | Requires a `package.json` — the parent workspace has none, so this repo needs a documented manual step; a developer who never runs `yarn install` (e.g. copies files by hand) still slips through |
| D. A CI-only gate, dropping local hooks entirely | Cannot be bypassed by a missing local config | No CI/CD pipeline is configured today (`docs/workflow.md` §Repo layout); would mean the gate never runs anywhere until a forge is chosen, which is explicitly the user's undecided call |

---

## Decision

Option C for the 14 sub-repos, option A (documented, not automated) for the parent. Each of the 14 sub-repos with a `package.json` carries `"prepare": "git config core.hooksPath .githooks || true"` — `marketplace-common` is the one that wraps it, calling a `hooks:install` script that sets the same config before building `dist/`, because its `prepare` has a second job. The `prepare` lifecycle script runs on every `yarn install`, which `dev.sh` already calls, so the config self-heals without a developer having to remember it. Option A alone was rejected precisely because it is git's own default posture and fails open in exactly the way described above.

The parent workspace has no `package.json` and therefore no `prepare` hook to piggyback on — option C is unavailable there by construction, not by oversight. The fallback is option A, explicit: after a fresh clone of the parent, run `git config core.hooksPath .githooks` by hand. Until that line runs, the parent's own `pre-commit`/`pre-push` — which also gate `services-status` (ADR-025) and the secret-leak guard (`.claude/SECRETS.md`) — are off.

Running Qodana in both hooks (not just `pre-push`) is the second half of the decision, and it is not redundant with the merge-commit and branch-baseline gaps in Context: `pre-push` runs after `git merge --no-ff` has already moved HEAD to `main`, so it is what can produce a `main`-tagged Qodana report at all, while `pre-commit` alone would leave the merge commit unscanned. Both hooks test executability separately from existence for every `qodana.sh` they invoke, rather than treating "file present" as "hook usable" — a missing prerequisite (docker, the `qodana` CLI, the linter image, `QODANA_TOKEN`, or an unset execute bit) blocks and prints the fixing command; it never warns and continues. For the executable-bit case specifically, both hooks print two commands, because the mode is tracked by git and a local `chmod` alone would be lost on the next checkout:

```
"chmod +x $APP/qodana.sh" \
"git update-index --chmod=+x $APP/qodana.sh"
```
(`.githooks/pre-commit`, `.githooks/pre-push`)

---

## Consequences

### Positive
- `yarn install` — already part of the normal workflow via `dev.sh` — is enough to restore hook wiring in all 14 sub-repos; no separate onboarding step to remember there.
- The executable-bit check turns a class of failure that otherwise looks like "Qodana ran clean, or Qodana found nothing" into a named, fixable error at commit/push time.
- Running Qodana at both hook points closes the merge-commit blind spot and gives Qodana Cloud a `main`-tagged baseline to diff future scans against.

### Negative
- The parent workspace carries a manual step (`git config core.hooksPath .githooks`) that nothing in this repo enforces or reminds a fresh clone about — it is documented in `docs/workflow.md` §Git hooks and here, and nowhere else.
- Qodana now runs twice per branch → commit → merge → push cycle (once per commit on the feature branch, once on `main` after merge) — real, accepted CI/compute cost for closing the blind spot, not a bug.
- A developer who edits files without ever running `yarn install` (rare, but possible with manual file copies or some editor-only workflows) still gets a silent `.git/hooks/` fallback in the 14 sub-repos, same failure shape this ADR fixes, just narrower.

### Risks
- **Risk:** a future new sub-repo is created without copying `prepare` into its `package.json`. Revisit if a new repo is added to `docs/workflow.md` §Repo layout without that line being checked at review time.
- **Risk:** `core.hooksPath` being local-only means any operation that creates a *new* worktree from the parent (e.g. `git worktree add`) starts unwired again, same as a fresh clone. Revisit if this workspace starts using `git worktree` — the fix would need documenting alongside the clone-time instruction, not a code change.
- **Risk:** Qodana running in both hooks doubles token/compute usage against `QODANA_TOKEN`'s cloud project quota. Revisit if a repo's Qodana Cloud plan starts rate-limiting or billing per scan.

---

## Compliance

Verify wiring is live: `git config --get core.hooksPath` inside any of the 15 gated repos must print `.githooks`; empty output means the gate is off regardless of what `.githooks/pre-commit` contains on disk. Verify the wiring is committed, not just locally set: `grep -n 'core.hooksPath .githooks' <subrepo>/package.json` must match in all 14 sub-repos with a `package.json` — directly in the `prepare` script for 13 of them, through `hooks:install` for `marketplace-common`. Verify executable bits: `git ls-files -s <repo>/qodana.sh` (or `.githooks/pre-commit`, `.githooks/pre-push` themselves) must report mode `100755`, not `100644` — a non-executable scanner looks exactly like a clean one: green log, no scan.

A violation looks like: a `git commit` or `git push` on any of the 15 gated repos completing with no `.githooks` output at all in the terminal (no lint/coverage/Qodana lines). That is the symptom to watch for, because the operation still succeeds and prints nothing to say the gate never ran.
