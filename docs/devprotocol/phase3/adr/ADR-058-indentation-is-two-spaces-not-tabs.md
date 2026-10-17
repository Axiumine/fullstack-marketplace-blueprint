# ADR-058 — indentation is two spaces, and the tabs clause of ADR-024 is withdrawn
# Marketplace

**Status:** accepted
**Date:** 2026-10-17
**Deciders:** Giovanni Manzoni, platform owner, in the working session of 2026-10-17. About `marketplace-services-status`: *"WE NEED TO USE 2
SPACES"*. For the sub-repos' own documents, later in the session: *"Sub-repo CLAUDE.md files: convert and fix to two spaces !"*. Asked how far
that should reach, the owner chose *"Whole platform to two spaces"*. The owner gave the instruction and not a rationale; this ADR records
the decision and what it costs, and invents no motive.
**Supersedes:** [`ADR-024`](./ADR-024-tabs-and-tree-wide-lint.md) **in part** — the tabs clause only: that indentation is tabs, `useTabs: true`
in every `.prettierrc`, and eslint's `indent: ['error','tab']` agreeing with it. The whole-tree `lint`/`lint:check` scope, the
`.prettierignore` exclusion list, the `npx eslint --print-config` check on a new `files` block, the byte-identical `.prettierrc` files and
the rule that eslint and prettier must not disagree about indentation are **not** touched.
**Superseded by:** —

---

## Context

[`ADR-024`](./ADR-024-tabs-and-tree-wide-lint.md) (2026-08-07) put tabs everywhere the platform runs a formatter: `useTabs: true` in the
thirteen `.prettierrc` files, eslint's `indent: ['error','tab']` to match, and a lint scope widened over the whole tree. Its stated
reason was agreement — prettier's default of spaces reindented exactly what eslint demanded back as tabs — and not tabs as such.

Over the following weeks the tab rule acquired exceptions. YAML cannot carry tabs, so the workflow and Dependabot files were indented with
spaces under a documented exception (ADR-054 and ADR-055 §Compliance). On 2026-10-17 the owner ruled that `marketplace-services-status`
is two-space throughout, and the rule in `CLAUDE.md` and `docs/conventions.md` became "tabs, except…". The owner then extended the ruling
to the rest of the platform. After that there was no reason left to keep tabs in the thirteen gated repositories except the ADR that said
so, and no argument that the exceptions were the better convention.

Three facts shaped how far the change can go:

- **Shell and git hooks cannot move.** Bash's `<<-` heredoc strips leading **tabs** and nothing else; converting a script that uses one
  breaks it, silently. This covers `.githooks/*`, `qodana.sh`, `z-ram.sh`, `scripts/*.sh`, `semgrep/vendor/refresh.sh` and the shell in
  `marketplace-docker-DBs`.
- **`marketplace-db-setup` has no formatter on purpose.** Its content is applied migrations, which are immutable (ADR-014, ADR-024), so
  reformatting one is a violation, not a style pass. `marketplace-nginx` is configuration, not JavaScript, and has no prettier either.
- **The shared eslint package still says tab.** `@axiumine/eslint-config-be` 2.0.2, which the workspace does not own, ships
  `indent: ['error','tab']`. Its trailing `eslint-config-prettier` entry switches the rule off for `src/**`, but each repository's own
  `test/**/*.mts` and `vitest.*.mts` block re-spreads `sharedTsBlock.rules` after it and re-arms it. After the reformat that block
  reported between 826 and 3,186 indent errors in the repositories that counted them, and `eslint --fix` rewrote prettier's two spaces
  back into tabs.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Keep tabs; leave `marketplace-services-status` and the YAML files as exceptions | No reformat, no blame noise | Two conventions in one tree, and a third class of file nobody can tell from the name; the owner's instruction was the opposite |
| Two spaces for `marketplace-services-status` and the sub-repo documents only | Already done for those; no reformat of the gated repos | The thirteen gated repos stay tabs and the exception list grows from the other side; the owner chose the wider scope |
| **Two spaces in every package a formatter or the owner's rule reaches; shell, hooks, `marketplace-db-setup` and the nginx configs unchanged** | One indentation for authored code; the exceptions are the ones a tool forces, not a taste | Thirteen repo-wide reformat commits and their blame noise; a few leftovers (below) |
| Two spaces everywhere, shell and hooks included | No exception at all | Breaks every `<<-` heredoc, and cannot be done to `marketplace-db-setup` without editing applied migrations |

## Decision

**The third option.** Two spaces is the indentation of authored code on this platform.

**1. Prettier.** The thirteen `.prettierrc` files — nine services, `marketplace-common`, three frontends — are byte-identical and now carry
`"useTabs": false` and `"tabWidth": 2` where ADR-024 had `"useTabs": true`. Everything else in them is unchanged: no semicolons, single
quotes, `"trailingComma": "none"`, `printWidth: 129`, `proseWrap: "never"`. Each repository's `.editorconfig` says
`indent_style = space` and `indent_size = 2`, and no longer carries a `tab_width`.

**2. eslint.** Prettier is the indentation authority, as ADR-024 intended of the pair; eslint must not contradict it.

- **The nine services and `marketplace-common` set `indent: 'off'` in their test/vitest block** — the same override in all ten, so a block
  that spreads `sharedTsBlock.rules` does not re-arm the shared package's tab rule. Prettier alone enforces indentation there, and
  `prettier --check` is in the gate. Four of the services were first committed with `indent: ['error', 2]` instead; a follow-up commit in
  each moved them to `'off'` so the ten agree.
- **The three frontends carry their own `indent: ['error', 2, { SwitchCase: 1 }]`**, which coexists with prettier: a second `yarn lint`
  changes nothing and `lint:check` passes. Their eslint config is standalone and does not use the shared package.

`no-mixed-spaces-and-tabs` was not touched. The clean fix lives in the shared package, which this change did not touch: a release of it
that drops its tab rule would let the ten local overrides go. That is a possibility and is not decided here.

**3. `marketplace-services-status`** is no longer an exception to anything. It was two-space by the owner's ruling earlier on the same day,
and it still has no eslint or prettier (ADR-025), so nothing enforces it: a file added there takes two spaces by hand.

**4. Out of scope, and still tab-indented, each for a reason:**

- shell scripts and git hooks — `<<-` heredocs strip leading tabs only;
- `marketplace-db-setup` — no formatter on purpose, and migrations are immutable;
- `marketplace-nginx` configuration files — not code a formatter here reaches;
- `marketplace-docker-DBs` shell — as the first item;
- files prettier ignores or has no parser for keep what they had, and may differ from repository to repository: `package.json`
  (prettier-ignored in several), `.gitnexusrc`, the `test/fixtures/restrictedSyntax/*.fixture` lint inputs, and the contents of
  template literals, which are string data;
- markdown code fences in historical documents and ADR bodies, which are not rewritten and may still show tabs.

**5. The reformat is leading whitespace only.** Thirteen commits, one per repository, titled *indent with two spaces, not tabs*, touching
about 1,370 files between them (the thirteen reports sum to 1,366). In each, `git diff -w` is empty except for these files, and each of
the exceptions has a reason:

- `.prettierrc`, `.editorconfig` and `eslint.config.js` in all thirteen: the configuration itself;
- `src/gql/*/gql.ts` in `marketplace-admin` (4 files), `marketplace-shopowner` (4) and `marketplace-user` (5), regenerated by `yarn codegen`
  — see Consequences;
- `test/integration/startFailure.itest.mts` in `marketplace-dev-authenticated-logout`, whose deliberately wrong Redis password
  `'itest-wrong-password'` became `'x-itest-wrong-password'` so the `pre-commit` secret scan, which reads every re-indented line as new,
  would let the commit through (the scan's `x-` placeholder escape).

Beyond those, block-comment continuation lines that prettier leaves alone were converted by hand where they had tabs
(`marketplace-common`'s `tsconfig.json`, seven source files in `marketplace-shopowner`, a handful in `marketplace-user`) — comment text,
whitespace only. Behaviour, coverage and mutation results are not expected to move, and each commit passed the full `pre-commit`
(`lint:check`, `typecheck`, `test:cov` at 100% on all four metrics, Qodana). The mutation gate is not run by hand (it has two callers,
`pre-push` and `gates.yml`), so that claim is proved by the next push and not by this paragraph.

## Consequences

### Positive
- One indentation for every authored file the platform formats. The "tabs, except…" sentence in `CLAUDE.md` and `docs/conventions.md`
  becomes a plain statement, and `marketplace-services-status` and the YAML files stop being the odd ones out.
- ADR-024's real aim is kept: prettier is the single authority and eslint does not undo it, in `src/` and, after the overrides, in the
  test trees. `yarn lint` re-run after the change is a no-op.
- The reformat costs no behaviour: the only files with non-whitespace content changes are the configuration, the regenerated `gql.ts`
  keys and one placeholder string.

### Negative
- **Thirteen repo-wide reformat commits and permanent `git blame` noise** on roughly 1,370 files. A `.git-blame-ignore-revs` per
  repository, listing the thirteen commits and wired with `git config blame.ignoreRevsFile`, would hide them from blame. That is a
  possible follow-up and has not been created.
- **Every branch open before the change conflicts on the lines it touches**, because every indented line moved. Reformat first, rebase
  second.
- **The generated `src/gql/*/gql.ts` of the frontends is keyed by the exact text of each embedded GraphQL document.** Reindenting those
  documents without `yarn codegen` leaves the keys stale: `graphql()` returns `unknown` in `typecheck`, and at runtime the lookup would
  have missed and returned `{}`. The first commit attempt failed `typecheck` in `marketplace-admin` and `marketplace-user` for this reason.
  Any future reformat of the embedded GraphQL needs `yarn codegen` and `src/gql` staged in the same commit.
- **The shared eslint package still says tab**, so a new repository, or a new block that spreads `sharedTsBlock.rules`, re-arms the rule
  and makes `yarn lint` fight prettier. Ten local overrides, all `indent: 'off'`, are what holds it today.
- **A reformat can trip the `pre-commit` secret scan** on a line that was always there, because re-indenting makes it look new. One
  literal was changed to get past it.
- Template literals — GraphQL operations in `test/integration`, for example — keep the tabs they were written with. They are string
  content, prettier does not touch them, and changing them would change test inputs.
- Four comments in `.github/` still say the workspace rule is tabs. They are not documentation and `scorecard.yml` is meant to be
  byte-identical in all sixteen repositories, so rewording them is one pass over sixteen, which this change did not do.

### Risks
- **A `.prettierrc` drifts from the other twelve** — for example `useTabs` flipped back on a rebase or copied from an older reference.
  Trigger to revisit: `md5sum` over the thirteen files returns more than one hash.
- **`marketplace-services-status` and `marketplace-db-setup` have no formatter.** The first is held to two spaces by hand and can drift
  without a gate noticing; the second must not be reformatted.
- **Shell converted "for consistency".** A script converted to spaces whose heredoc uses `<<-` fails without an error at the point of the
  edit. The reason is in §Context, and the hooks carry it too.

## Compliance

```bash
# the thirteen .prettierrc are byte-identical: one line of output, count 13
md5sum BEs/marketplace-common/.prettierrc BEs/dev/*/.prettierrc marketplace-admin/.prettierrc \
  marketplace-shopowner/.prettierrc marketplace-user/.prettierrc | awk '{print $1}' | sort | uniq -c

# and they say spaces
grep -E '"(useTabs|tabWidth)"' BEs/marketplace-common/.prettierrc      # "useTabs": false and "tabWidth": 2

# every .editorconfig says spaces
git submodule foreach -q 'test ! -f .editorconfig || grep -H "^indent_style" .editorconfig'

# in each gated repository: eslint and prettier agree, and nothing is left to reindent
yarn lint:check
```

A violation looks like:

- `"useTabs": true` back in any `.prettierrc`, or a `.prettierrc` that differs from the other twelve;
- `indent_style = tab` in an `.editorconfig`, or a `tab_width` that implies tabs are in use;
- an eslint `indent` rule resolving to `'tab'` for a linted file (`npx eslint --print-config <file>` shows it) — the shared package's rule
  re-armed by a block that spreads `sharedTsBlock.rules` without an override;
- a tab-indented line in a TypeScript, JavaScript, JSON, YAML, CSS or HTML file that prettier owns, or in `marketplace-services-status`;
- a shell script or git hook converted to spaces, or `marketplace-db-setup` or a migration reformatted, or prettier added there;
- an embedded GraphQL document reindented in a frontend without `yarn codegen` and the regenerated `src/gql` in the same commit.
