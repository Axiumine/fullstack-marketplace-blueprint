# ADR-024 — Tabs everywhere, enforced by eslint and prettier together, over the whole tree
# Marketplace

**Status:** accepted
**Date:** 2026-08-07
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Thirteen repos run eslint + prettier: nine backend services under `BEs/dev/`, `BEs/marketplace-common`,
and three frontends (`marketplace-admin`, `marketplace-shopowner`, `marketplace-user`). `marketplace-db-setup`
is a deliberate fourteenth exception — no prettier, no eslint, content is immutable applied migrations.

eslint enforces `indent: ['error','tab']` per [`docs/conventions.md`](../../../conventions.md) §Formatting. Prettier's `useTabs` key
was present in only one repo (`marketplace-admin`) before this decision. Everywhere else prettier's default
(`useTabs: false`) fought eslint: prettier reindented with spaces exactly what eslint demanded back as tabs,
and whichever tool ran last in a given workflow won. Nobody could safely run both in sequence without one
undoing the other.

Second, independent problem in the same area: `lint` and `lint:check` scripts were scoped inconsistently.
Some repos ran eslint-only; others ran `prettier --write 'src/**/*.mts'` — a glob that excludes test files,
config files (`eslint.config.js`, `stryker.config.mjs`) and yaml. Those categories drifted unformatted for
as long as the narrow glob stood.

Third, a silent-failure mode in eslint's flat config: a path matching no `files` glob is linted by
**nothing**, and eslint reports that as **success** (exit 0), not as "no config found". It is how a repo's own
`eslint.config.js` and `stryker.config.mjs` go unchecked: `@axiumine/eslint-config-be` scopes its JS block
to `src/**/*.{js,cjs,mjs}`, and no repo here has JS under `src/`, so every root-level JS file matches
nothing and passes. The same hole swallows `marketplace-common`'s test files and vitest configs unless the
library carries the `test/**/*.mts` block the services have. Each repo therefore adds a root-level
`files: ['*.js', '*.mjs', '*.cjs']` block of its own — `BEs/dev/marketplace-dev-public-authorization/eslint.config.js`
is the reference — and that block is load-bearing rather than decorative.

All thirteen repos' `lint` / `lint:check` scripts are identical in shape (`marketplace-admin/package.json`
line 22-23: `"lint": "eslint --fix . && prettier --write .", "lint:check": "eslint . && prettier --check ."`;
same two lines verbatim in `BEs/dev/marketplace-dev-public-authorization/package.json` line 16-17), and both
gates run in `.githooks/pre-commit` and `.githooks/pre-push` per [`docs/workflow.md`](../../../workflow.md) §Git hooks.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Leave `useTabs` unset except in `marketplace-admin`, keep narrow `src/**` globs | Zero migration cost, no 111-file diff to review | eslint and prettier fight forever on indentation in 12 of 13 repos; test/config/yaml files silently unformatted; the copy-paste `admin`-only setting looks intentional when it is an accident of which repo got touched first |
| Set `useTabs: true` in every `.prettierrc`, keep `lint`/`lint:check` scoped to `src/**` | Fixes the eslint/prettier fight | Leaves the second problem untouched — test files, `eslint.config.js`, `stryker.config.mjs`, yaml still never formatted, and the silent no-glob-match hole stays undetected |
| Set `useTabs: true` in every `.prettierrc`, widen `lint`/`lint:check` to run over the whole tree (`.` not `src/**`), route genuine exclusions through `.prettierignore`, and require every new eslint block to be checked with `npx eslint --print-config <file>` | Closes both problems at once; `.prettierignore` gives one auditable exclusion list instead of N different narrow globs; the print-config check turns the silent-success hole into a checkable invariant | One-time 111-file reformat commit per affected repo; anyone adding a new eslint block must remember to verify it resolves, since eslint gives no warning if it doesn't |

---

## Decision

Third option. `useTabs: true` went into every `.prettierrc` that lint gates (all thirteen — verified: the
nine backend services, `marketplace-common`, and the three frontends all now carry it, e.g.
`BEs/dev/marketplace-dev-public-authorization/.prettierrc`). `lint` and `lint:check` were widened to run over
the whole tree rather than a `src/**` glob, with anything genuinely out of scope — `node_modules/`, `dist/`,
`coverage/`, `package-lock.json`, `yarn.lock`, vendored semgrep rules, `.gitnexus/`-written files, and
markdown (`proseWrap: "never"` would collapse every hand-wrapped CLAUDE.md paragraph onto one line) — moved
into `.prettierignore` (`BEs/dev/marketplace-dev-public-authorization/.prettierignore`) instead of staying as
a narrower glob on the script. The first wide run touched 111 files across the tree, which is the
measurable cost of how long the narrow scope had stood.

The third option is the only one that also closes the silent-success hole: a `files` glob that matches
nothing is invisible under a narrow-glob regime because nothing was expected to be linted there anyway.
Running wide makes an unmatched file conspicuous — it shows up in the file list but never in a lint error —
which is what surfaced the `eslint.config.js` / `stryker.config.mjs` / `marketplace-common` test-file gaps.
The fix for each was a `files: ['*.js', '*.mjs', '*.cjs']` block scoped to the config file's own directory
(flat-config `*.js` means the config's own directory only, never `**/*.js` — the distinction that also keeps
a root-JS block off the minified Qodana report), plus a `test/**/*.mts` block for `marketplace-common`.

---

## Consequences

### Positive
- Running `lint` (format) then `lint:check` (verify) in either order no longer produces a diff — one
  indentation authority, not two fighting.
- Test files, eslint/stryker configs, and yaml are now covered by the same gate as source, closing a class
  of file that drifted for as long as it existed unmeasured.
- The `npx eslint --print-config <file>` check (~400 rules expected, `undefined` means the file is unlinted)
  is now the standard verification step before trusting a new `files` block, in all thirteen repos.
- `.prettierignore` is a single auditable exclusion list per repo instead of N ad hoc globs scattered
  across scripts — thirteen `.prettierignore` files are byte-identical bar per-repo lines
  (`marketplace-user` adds `src/routeTree.gen.ts`, its own generated file).

### Negative
- The 111-file reformat is noise in `git blame` / `git log -p` for every touched file, permanently.
- `lint` running over the whole tree is slower than a `src/**`-scoped run, on every invocation, in all
  thirteen repos.
- A repo owner adding a new tool config file must remember `.prettierignore` vs a `files` block distinction
  — get it backwards (narrow glob instead of ignore entry) and the old failure mode returns for that one
  file, silently.

### Risks
- **New file category added without an ignore-or-glob decision.** Trigger to revisit: a future `lint:check`
  run comes back green while a manual `npx eslint --print-config` on a suspect file prints `undefined` —
  same signature as the `eslint.config.js` / `stryker.config.mjs` hole this ADR closed.
- **A repo's `.prettierrc` drifts from the other twelve** (e.g. someone flips `useTabs` back on a rebase or
  copy-paste from an older reference). Trigger to revisit: `diff` across all thirteen `.prettierrc` files
  stops being byte-identical.
- **`marketplace-db-setup` gets prettier/eslint added later** without re-litigating why it was excluded —
  its content is immutable applied migrations, and reformatting one would violate the immutability rule in
  [`docs/conventions.md`](../../../conventions.md) §Lint scripts (CON-07 in `docs/devprotocol/phase3/CONSTRAINTS.md`).

---

## Compliance

Verify per repo:
- `cat <repo>/.prettierrc` shows `"useTabs": true` — expect this in all thirteen gated repos, never in
  `BEs/marketplace-db-setup`.
- `grep -n '"lint"' <repo>/package.json` shows `eslint --fix . && prettier --write .` (the bare `.`, not a
  `src/**` glob) — same check against `lint:check`.
- `npx eslint --print-config <any-file-expected-to-be-linted>` — expect ~400 rules resolved. `undefined` or
  a near-empty rule set is a violation: the file matches no `files` glob and is silently unlinted.
- `<repo>/.prettierignore` lists every genuine exclusion (`node_modules/`, `dist/`, `coverage/`, lockfiles,
  `*.md`, `.gitnexus/`) — a narrow glob reappearing in a `lint` script instead of an `.prettierignore` entry
  is a violation of the "exclusions live in `.prettierignore`" rule this ADR sets.
- `.githooks/pre-commit` and `.githooks/pre-push` both run `lint:check` as their first gate in all thirteen
  repos — a repo where it is missing or scoped narrower than `.` is non-compliant with this decision.
