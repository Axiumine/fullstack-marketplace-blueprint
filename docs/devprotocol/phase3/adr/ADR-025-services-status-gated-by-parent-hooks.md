# ADR-025 — services-status has no repo of its own and is gated by the parent workspace hooks
# Marketplace

**Status:** accepted
**Date:** 2026-08-07
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`services-status` (realtime monitor + control panel for the platform's systemd user units, see
`services-status/package.json` `description`) is not one of the fifteen sub-repos under
`BEs/`, `marketplace-admin/`, `marketplace-nginx/`, `marketplace-shopowner/`, `marketplace-user/`. It is a
plain subdirectory tracked by the **parent** workspace repo (`fullstack-marketplace-blueprint`), the same
repo that also holds [`CLAUDE.md`](../../../../CLAUDE.md) and `.claude/`.

Every other package on the platform lives in its own git repo and carries its own `.githooks/pre-commit` /
`pre-push`, so its gates fire on its own commits (`docs/workflow.md` §Git hooks — Qodana runs in
pre-commit and in pre-push, in every sub-repo that has a `package.json`). `services-status` has none of
that by construction. Left alone it would carry the same appearance of rigor as everyone else — `services-status/qodana.yaml` (`testCoverageThresholds: total:
100, fresh: 100`, `failureConditions.severityThresholds: critical: 0, high: 0`),
`services-status/stryker.config.mjs` (`thresholds: { high: 100, low: 95, break: 100 }`), a
`services-status/vitest.config.mts` with the same 100%-on-every-metric shape as the nine backend services —
and **nothing local would run any of them**. No repo boundary means no `.githooks/`, and no `.githooks/`
means the configs are read by nobody until someone runs `yarn test:cov` by hand. Configuration is not
enforcement, and this is the one package on the platform where that gap opens by default.

Two further constraints from the parent repo, both load-bearing for the option that was picked:

- The parent's ordinary commit is a docs edit — [`CLAUDE.md`](../../../../CLAUDE.md), [`README.md`](../../../../README.md), `.claude/` — and building + testing
  a Node server on every prose change is exactly how a hook gets bypassed out of habit
  (`.githooks/pre-commit` comment block, "services-status — the one piece of application code this repo
  tracks").
- `services-status` has **no lint script** — it is not one of the thirteen eslint/prettier repos. Its type
  check is not separate either: `services-status/package.json` `scripts.test:cov` is `"yarn build && vitest
  run --coverage"`, and `build` is `tsc`, so a type error fails the coverage gate before a single test runs
  (`docs/frontends.md` §marketplace-user block, "`services-status` … has no `lint` script … `tsc` runs as the first
  half of its own `test:cov`").

This is CON-08 territory (`docs/devprotocol/phase3/CONSTRAINTS.md`): 100% coverage on all four metrics plus
100 mutation score is required of every package that ships code, `services-status` included, and the
constraint forbids lowering a threshold or removing a gate to get there.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — give `services-status` its own git repo, matching the fifteen sub-repos | Uniform with the rest of the platform; gets its own `.githooks/`, its own `core.hooksPath` wiring via a `prepare` script | It is a monitor **for** the platform's systemd units, not a tenant-facing service — splitting it out means a sixteenth sub-repo to track, provision, add to `.gitmodules` and remember to `git config core.hooksPath` in, for one small app; contradicts why it sits in the parent to begin with |
| B — leave it gate-less, rely on manual `yarn test:cov` before every push | Zero setup cost | This is what "the appearance of a gate" means in practice; violates CON-08 (`CONSTRAINTS.md` CON-08) the moment anyone forgets |
| C — gate it from the **parent** repo's own `.githooks/pre-commit` and `pre-push`, scoped to `services-status/` paths | No new repo; reuses the parent's already-committed `.githooks/` (`docs/workflow.md` §Git hooks, hook wiring section); path-scoping in pre-commit keeps a docs-only commit fast; pre-push (unscoped) catches merge commits and `--no-verify` commits pre-commit structurally cannot see | The parent repo runs Node/yarn/Docker logic in a hook, which is unlike everything else it gates; the parent has no `package.json`, so nothing restores `core.hooksPath` automatically after a fresh clone |
| D — drop the coverage/mutation/Qodana threshold to whatever the app happens to score, since it has no repo to enforce them anyway | No gate-authoring work at all | Directly forbidden by CON-08 (`CONSTRAINTS.md`); the code had real bugs behind uncovered branches — lowering the bar hides them instead of fixing them |

---

## Decision

Option **C**. The parent workspace repo's `.githooks/pre-commit` and `.githooks/pre-push` gate
`services-status/` directly, in place of giving it a sub-repo of its own (rejected: option A), leaving it
running on trust (rejected: option B) or weakening CON-08 to fit the gap (rejected: option D, blocked by
the constraint doc itself).

`pre-commit` scopes to staged, non-markdown paths under `services-status/` — `grep -E "^services-status/" |
grep -qvE '\.md$'` — and runs `yarn test:cov` (build + vitest + 100% coverage) followed by Qodana
(`SKIP_TESTS=1 ./qodana.sh`, reusing the `coverage/lcov.info` the previous step wrote). No lint step: the
app has none, and its type check already rides inside `test:cov`.

`pre-push` runs **unscoped**: `yarn test:cov` → `yarn test:mutation` → Qodana, in that order. It exists
because `pre-commit` cannot see everything that reaches `main`: `git merge --no-ff` never fires
`pre-commit` (git only runs that hook for `git commit`), and a branch can carry `--no-verify` commits made
on the way there. `pre-push` stands after the merge, so it is the one gate on the revision that actually
reaches the remote's history — the same reasoning ADR-017 gives for running Qodana in both hooks across
the sub-repos, applied to the one package that has no repo of its own.

Mutation testing was deliberately left out of `pre-commit` and kept push-only, matching every other package
on the platform: the run is minutes, not seconds, and paying that per commit is how a hook gets bypassed out
of habit (comment at the top of `services-status`'s Gate 2 block in `.githooks/pre-push`).

Reaching the 100/100 these gates enforce is **a matter of changing the code, never the threshold**. The
surviving mutants in this app are overwhelmingly guards no input can falsify — `typeof value === 'string'`
in front of a `Set#has`, a `.toLowerCase()` the WHATWG URL parser has already applied, `mainPidRaw !== null`
in front of `> 0` — and the fix is to delete the guard with the argument for its equivalence recorded at
the site (`.githooks/pre-push` Gate 2 failure message, point 2). A genuinely equivalent mutant is silenced
with `// Stryker disable next-line <Mutator>: <reason>`, never with `ignoreStatic` and never by lowering
`thresholds.break` in `services-status/stryker.config.mjs`.

```
if ! yarn test:cov; then
    …
    "PUSH BLOCKED — services-status failed to build, failed its tests, or fell below 100% coverage."
    …
```
(`.githooks/pre-push`, Gate 1)

---

## Consequences

### Positive
- `services-status/qodana.yaml` and `services-status/stryker.config.mjs` are enforced rather than
  decorative — every commit touching non-markdown `services-status/` paths runs coverage + Qodana, every
  push runs coverage + mutation + Qodana.
- The gate earns its keep on real findings, not hypothetical ones: unfalsifiable guards deleted from
  `server.ts` and `systemd.ts`, and a `RegExpRedundantEscape` in `hostnameOnly` that only a real Qodana
  scan surfaces.
- Path-scoping in `pre-commit` keeps the parent repo's normal docs workflow (`CLAUDE.md`, `README.md`
  edits) fast; editing prose never shells out to `yarn` or `docker`.

### Negative
- The parent workspace repo, otherwise a docs tree, carries Node/yarn/Docker/Qodana invocation logic in
  its hooks — a different shape of complexity from the sub-repos' `.githooks/`, which gate their own code
  rather than a subdirectory of a sibling repo.
- The parent has no `package.json`, so nothing restores `core.hooksPath` after a fresh clone the way the
  fourteen packaged sub-repos' `"prepare": "git config core.hooksPath .githooks || true"` does (ADR-017).
  A clone that skips the manual `git config core.hooksPath .githooks` step silently loses this gate along
  with the secret guard documented in [`CLAUDE.md`](../../../../CLAUDE.md).
- ⚠️ The gate depends on `services-status/qodana.sh` being mode `100755`. Committed at `100644` it dies
  with `Permission denied` before reaching Qodana, and the hook then reports "Qodana failed on
  services-status" pointing at a SARIF that was never written — a chmod bug rendered as an apparent scan
  failure. Both hooks test executability separately from file existence for that reason (ADR-017).

### Risks
- **Risk:** a future contributor gives `services-status` a repo of its own "for consistency" and drops the
  parent-hook scoping without re-checking whether `core.hooksPath` gets wired for it. Revisit
  condition: `services-status` gains its own `.git`, `origin`, or `package.json` `prepare` script.
- **Risk:** the parent repo stays `package.json`-less indefinitely, so every fresh clone needs a
  human to remember `git config core.hooksPath .githooks` by hand before either gate fires. Revisit
  condition: a push lands twice with the gate silently off.
- **Risk:** `services-status/qodana.yaml`'s `image: jetbrains/qodana-js:2026.2` pin goes stale against a
  future Qodana CLI that no longer publishes that tag, and the parent's `pre-commit`/`pre-push` block on a
  failed `docker pull` rather than warning. Revisit condition: JetBrains stops publishing the `2026.2` image
  tag.

---

## Compliance

Verify the gate is live, from the workspace root: `git config core.hooksPath`
must print `.githooks`. `git hook run pre-commit` from the parent repo root, with a staged non-markdown
change under `services-status/`, must print `pre-commit: services-status — building, testing and holding
100% coverage`.

Verify the app itself still holds the bar: `cd services-status && yarn test:cov` must complete with all
four v8 metrics at 100 (thresholds live in `services-status/vitest.config.mts`); `yarn test:mutation` must
report `break: 100` held (`services-status/stryker.config.mjs`).

A violation looks like: a merged `services-status/` change with `coverage/index.html` showing <100% on any
metric, or `services-status/reports/mutation/mutation.html` showing a `Survived` mutant with no
`// Stryker disable` comment and reason at that line, or a `qodana.yaml` `testCoverageThresholds` /
`failureConditions.severityThresholds` value lowered from `100` / `critical: 0, high: 0` in a diff. Also a
violation: `services-status/qodana.sh` committed at mode `100644` again (check with `git ls-files -s
services-status/qodana.sh` — the mode digits must start `100755`).
