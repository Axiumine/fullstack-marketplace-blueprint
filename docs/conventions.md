# Code conventions

## Formatting — tabs, tree-wide (ADR-024)

**Indentation is tabs**, enforced by eslint (`indent: ['error','tab']`) *and* prettier
(`"useTabs": true`) so the two cannot disagree.

The thirteen `.prettierrc` files are byte-identical: no semicolons, single quotes,
`"trailingComma": "none"`, `printWidth: 129`, `proseWrap: "never"`, `useTabs: true`. So are the thirteen
`.prettierignore` files bar per-repo lines — `marketplace-user` adds `src/routeTree.gen.ts`, which its
build generates. **Keep it that way**: when they differed per repo, a snippet moved between two of them
failed `yarn lint` on the commas alone.

Markdown is ignored on purpose — `proseWrap: "never"` flattens every hand-wrapped paragraph in these
docs onto one line.

`marketplace-db-setup` has neither prettier nor eslint, deliberately: its content is applied migrations,
which are immutable, so a formatter that rewrites them is the wrong tool.

## Lint scripts

`lint` formats, `lint:check` verifies, **both over the whole tree** — `eslint --fix . && prettier
--write .` and `eslint . && prettier --check .`, identical in all thirteen. The scope is the point:
under a narrower glob, test files, configs and yaml are never formatted at all and drift silently.
Anything genuinely out of scope belongs in `.prettierignore`, not in a narrower glob.

`lint:check` is the **first** gate of both `.githooks/pre-commit` and `.githooks/pre-push` in all
thirteen, and `eslint.config.js`, `.prettierrc` and `.prettierignore` are all in the hooks'
`RELEVANT_PATHS` — an edit to any of them changes the verdict for every file in the tree without
appearing in any of them.

## ⚠️ A path matching no `files` glob is linted by nothing — and eslint reports that as success

Not "no config found": it checks zero rules and exits 0, so the gate is green and the file is unread.

`@axiumine/eslint-config-be` scopes everything to `src/**`. Two holes were closed by hand and must stay
closed:

- each backend repo carries a `files: ['*.js','*.mjs','*.cjs']` block for root-level `eslint.config.js`
  and `stryker.config.mjs`
- `marketplace-common` also carries a `test/**/*.mts` block

**When adding a block, check it resolves**: `npx eslint --print-config <file>` should report ~400 rules,
not `undefined`.

`*.js` in flat config means the config file's own directory only, never `**/*.js` — that scoping is what
keeps a root-JS block off the minified Qodana report.

## Node and package manager

- **`engines.node` is `^24.18.0` in all fifteen packages** (the parent workspace has no `package.json`).
  Keep the caret: semver reads `24.18` as `24.18.x` and bare `24.18.0` as that one release. **`engines`
  is a hard gate under yarn classic** — a mismatch exits 1 with `The engine "node" is incompatible with
  this module`, not a warning. When bumping Node, bump all fifteen in one sweep.
- **`packageManager` is in all fifteen packages**, one identical `yarn@1.22.22+sha512.…` string. Keep
  it that way: it is what makes Corepack hand every repo the same yarn binary, and the eight that used
  to lack it — `marketplace-common` and the seven original backend services — were the ones where a
  divergent yarn would be least visible, since they are also the pair that publishes and consumes an
  unregistered package by name. A new package copies the line verbatim; a yarn bump changes all fifteen
  in one sweep, exactly like `engines.node`.

## marketplace-common plumbing

- ⚠️ **No barrel export.** Consumers import per subpath, and every file needs its own entry in the
  `package.json` `exports` map (~38 entries) or it is unreachable. `yarn test:contract` catches
  omissions.
- ⚠️ **Consumed as a published package name but not on any registry** (ADR-015). `package.json` names it
  `@axiumine/marketplace-common`; the nine services depend on that name, which 404s on
  registry.npmjs.org. `BEs/marketplace-common/deploy-local.sh` builds it and syncs `dist/` +
  `package.json` into every consumer's `node_modules/`, discovered by globbing this workspace.
  **Re-run it after every edit to common**, or the consumers keep resolving the previous build — and the
  edit fails at the call site rather than at import. A fresh `yarn install` in a service still 404s until
  the package is genuinely published.

## Leftovers

`.orig` files are merge leftovers, not sources. Three survive — `yarn.lock.orig` in the two `*-resource`
services under `dev/`, and `marketplace-dev-public-resource/src/index.ts.orig`. Ignore them; do not sync
edits into them.
