# ADR-016 — Every package is gated at 100% coverage on all four metrics and a 100 mutation score
# Marketplace

**Status:** accepted
**Date:** 2026-08-06
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Platform is 15 packages: 9 Koa/Apollo backend services under `BEs/dev/`, `BEs/marketplace-common`,
`BEs/marketplace-db-setup`, 3 frontends (`marketplace-admin`, `marketplace-shopowner`,
`marketplace-user`), plus `marketplace-services-status` (tracked by the parent repo, no repo of its own). Coverage
alone was already the house rule and every package sat at 100% on it — and mutants still survived under
that green number. `marketplace-common` scored 45.95% mutation score, `marketplace-db-setup` 52.92%, both
with 100% line/branch/function/statement coverage reported at the same time (`README.md` §Test quality gates). Coverage asks whether a line ran during a suite; mutation asks whether any assertion would fail if
that line's logic were wrong. A line can run under a hundred tests and still be checked by none of them —
that gap is exactly where those two numbers diverged.

Two on-disk failure classes made the gap concrete rather than theoretical:

- **Load-once const vs per-test mutant switch.** Stryker swaps the active mutant per test, but a
  top-level `const` — the bulk of `BEs/marketplace-db-setup/lib/schemas/`'s `$jsonSchema` builders —
  evaluates once when the module first loads. 54 of db-setup's 62 survivors were exactly this: the const
  body froze under whichever mutant was active at first import and every subsequent test inherited the
  frozen, unmutated value. `BEs/marketplace-db-setup/test/migrationCalls.test.mjs:79` defines `evictLib()`
  to purge `require.cache` so the module re-evaluates per test under the live mutant.
- **v8 coverage reports only files a suite actually loaded.** A file no test `import`s is absent from the
  report rather than listed at 0% — so a 100% threshold can pass while a whole file goes unexercised.
  Checking the percentage alone hides this; checking the file list in the coverage report does not.

Constraint from [`docs/devprotocol/phase3/CONSTRAINTS.md`](../CONSTRAINTS.md) CON-08: 100/100 applies to every package that
ships code, threshold reduction and gate removal are both explicitly forbidden, and `phase1/NFR.md` marks
the maintainability requirements behind this (NFR-MA01/MA02/MA05) 🔴 Critical, requiring a written owner decision
to touch.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Coverage-only gate (status quo before this decision) | Cheap to run, already wired in all 15 packages, fast feedback | Proven blind to real bugs — `marketplace-common` and `marketplace-db-setup` both sat at 100% coverage while entire classes of logic (schema builders, several guard branches) could be silently inverted and no test would notice |
| Mutation gate with a threshold below 100 (e.g. `break: 90`) | Tolerates equivalent/near-equivalent mutants without per-case suppression comments, less friction on large diffs | A threshold under 100 is a standing exception with no owner — CON-08 forbids it outright, and every survivor left under the line is an untested behavior nobody has to name or justify |
| Coverage 100% + mutation 100%, enforced four times over (vitest `thresholds`, `qodana.yaml` `testCoverageThresholds`, `test:cov` in both `.githooks/pre-commit` and `pre-push`, `stryker.config.mjs` `thresholds.break: 100` as the second `pre-push` step) — **chosen** | Closes the exact gap the 45.95%/52.92% numbers exposed; every survivor is either killed by a new test, a dead branch deleted, or a documented `// Stryker disable next-line <Mutator>: <reason>` — never a silent pass | Slower CI, forces two load-bearing test-authoring patterns (`evictLib`-style module eviction for top-level consts, checking the coverage file list rather than only its percentage) that are easy to get wrong on a first pass |
| `ignoreStatic` on Stryker config to silence hard-to-kill survivors | Fastest path to a green mutation report | Masks real gaps rather than closing them — [`docs/testing.md`](../../../testing.md) §Mutation testing traps names this explicitly as the wrong fix, because the survivor it appears to clear is usually a load-time mutant needing a dynamic `await import()` inside `beforeEach`, not a static exemption |

---

## Decision

Chosen: coverage 100% + mutation 100%, enforced four times over — third row of the table above. The
100%-coverage-only status quo (row 1) is not a hypothetical rejected option; it is what this platform ran
until the `marketplace-common`/`marketplace-db-setup` numbers were measured, and it is the option this
decision replaces. A threshold below 100 (row 2) or `ignoreStatic` (row 4) would each re-open exactly the
hole the measurement found, just at a different visible number — CON-08 rules both out by name. Redundant
enforcement (vitest thresholds, `qodana.yaml`, two githook stages, Stryker `break: 100`) is deliberate, not
duplicated effort: `git merge --no-ff` never fires `pre-commit`, so the merge commit that actually reaches
`main` is seen only by `pre-push`; two individually-clean branches can merge into a tree that is not
(`docs/workflow.md` §Git hooks, Qodana bullet). The two failure classes found on disk — the
load-once-const trap and the vacuous-pass-on-unloaded-file trap — are recorded as the two things a survivor
count of zero does not by itself prove, and the fix pattern for each (`evictLib`, checking the file list) is
now house convention rather than a one-off discovery.

---

## Consequences

### Positive
- Coverage alone is proven insufficient and no longer trusted as a completeness signal by itself; mutation
  score is the number that actually answers "would a wrong line get caught."
- The `evictLib()` pattern (`BEs/marketplace-db-setup/test/migrationCalls.test.mjs:79`) is now the
  documented fix for any top-level `const` built from `lib/schemas/`-style builders, instead of being
  rediscovered per package.
- Every silenced survivor carries a `// Stryker disable next-line <Mutator>: <reason>` at the site, so an
  accepted exception is visible in the diff instead of hidden in a config threshold.

### Negative
- CI is materially slower: `pre-push` runs lint → `test:cov` → `test:mutation` → Qodana in sequence, and
  Stryker's sandboxed mutant runs are the most expensive of the four in every one of the 15 packages.
- Every new file needs a genuine assertion against its own logic, not just execution — a smoke test that
  merely calls a function and checks it doesn't throw passes coverage but is killed instantly by mutation,
  so the bar for "done" moved for every contributor.
- `marketplace-services-status` is the standing illustration of a gate that exists on paper: it carries
  `stryker.config.mjs` and a 100% threshold, and it has no `.githooks/` of its own to invoke either —
  a config with no runner is an appearance of a gate rather than a gate, which is why its steps live in
  the parent's hooks instead (ADR-025, [`docs/frontends.md`](../../../frontends.md) §marketplace-services-status).

### Risks
- **Equivalent-mutant creep.** A contributor under deadline pressure reaches for `ignoreStatic` or a
  threshold edit instead of a `// Stryker disable next-line` comment with a stated reason. Revisit trigger:
  any `stryker.config.mjs` diff that adds `ignoreStatic` or lowers `thresholds.break` below 100 — CON-08
  names this exact failure mode.
- **Hooks silently not firing.** The gate depends on `core.hooksPath` being set locally; it is not global
  git config and does not travel with a clone, so a fresh clone of any of the 15 gated repos starts
  ungated until `git config core.hooksPath .githooks` runs there (ADR-017, [`docs/workflow.md`](../../../workflow.md) §Git hooks).
  `git hook run pre-commit` is what proves it is wired. Revisit trigger: a merge lands on `main` with a
  coverage or mutation regression that no hook caught.
- **A gate with no invoking mechanism reads identically to a passing one from outside**, exactly the
  `marketplace-services-status` case — a `stryker.config.mjs` with no `.githooks/` of its own to run it. Revisit trigger: any package
  added to the platform that has a `stryker.config.mjs` / coverage threshold but no `.githooks/` (or, for
  `marketplace-services-status`, no scoped step in the parent's own `.githooks/pre-commit` / `pre-push`) referencing it.

---

## Compliance

Verify per package:

```bash
# coverage — 100 on every metric
yarn test:cov

# mutation — 100 score, thresholds.break enforced
yarn test:mutation
```

On disk, per package: `stryker.config.mjs` must show `thresholds: { high: 100, low: 95, break: 100 }`
(confirmed at `BEs/marketplace-common/stryker.config.mjs`), the vitest config must show
`thresholds: { 100: true }` (confirmed at `BEs/marketplace-common/vitest.config.mts:21`), and
`qodana.yaml` must carry `testCoverageThresholds: { total: 100, fresh: 100 }` (confirmed at
`BEs/marketplace-common/qodana.yaml:72-74`). `.githooks/pre-commit` must run coverage before Qodana;
`.githooks/pre-push` must run lint → coverage → mutation → Qodana in that order (confirmed at
`BEs/marketplace-common/.githooks/pre-push`).

A violation on disk looks like: a `thresholds.break` value under 100 in any `stryker.config.mjs`; an
`ignoreStatic: true` line anywhere in a Stryker config; a `// Stryker disable` comment with no `<Mutator>`
name or no reason string after the colon; a `.githooks/pre-push` missing the `test:mutation` step or
reordering it before `test:cov`; or a package with a `stryker.config.mjs` present but no
`.githooks/` directory (or, for `marketplace-services-status`, no matching scoped step in the parent's own hooks)
invoking it. A threshold nothing reads is the failure shape to look for, because it reports nothing.
