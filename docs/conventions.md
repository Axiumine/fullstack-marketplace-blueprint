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

## ⚠️ Two tsconfigs per package — the build one emits, the test one checks (MC-31, R62)

Same shape as the section above, one tool over: the build config of the nine services, of
`marketplace-common` and of `marketplace-services-status` is `rootDir: ./src`, so `tsc` never opened
`test/`, and vitest transpiles without checking. Nothing was red; 160 errors were sitting in the test
trees of those eleven packages.

`tsconfig.test.json` is the second config: `noEmit`, `rootDir: "."`, `include` over `src/`, `test/` and
the vitest configs, and it **extends** the build config rather than restating its options — a copied
`strict` block is a block that drifts, and the point is to check the tests under exactly the strictness
the source is checked under. `yarn typecheck` runs it, both hooks gate on it, and
`./scripts/audit-check.sh` §20 checks that all fourteen TypeScript packages still carry script, config,
`include` and both hook calls.

The three apps need no second config: vite emits, so their root `tsconfig.json` was never a build config
and already includes `test`. `marketplace-db-setup` has no TypeScript and `marketplace-nginx` ships no
JavaScript, so neither is in the fourteen.

⚠️ **The gate proves what `include` names compiles, not that a new file is inside `include`.** A test
file outside `src/`, `test/` and the named vitest configs is read by nothing again.

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
- ⚠️ **Consumed by package name, and published** — ADR-015 for the consumption pattern, `ADR-037` for
  the publication, `ADR-047` for the release-only rule. `package.json` names it
  `@axiumine/marketplace-common`; the twelve consumers depend on that name, each declaring its own caret
  range, and `registry.npmjs.org` serves it. **An edit reaches a consumer when it is published and not
  before** — the nine-step
  release flow in `BEs/marketplace-common/CLAUDE.md`, every step, every time. ⚠️ **There is no local
  deploy.** `deploy-local.sh` synced `dist/` into every consumer's `node_modules` and is **deleted**
  (2026-08-30): the build it wrote carried no version, no integrity hash and no `yarn.lock` entry, so it
  existed on one machine only and the next `yarn install` there silently replaced it. `yarn install` is
  authoritative everywhere and destroys nothing.

## Leftovers

`.orig` files are merge leftovers, not sources. Three survive — `yarn.lock.orig` in the two `*-resource`
services under `dev/`, and `marketplace-dev-public-resource/src/index.ts.orig`. Ignore them; do not sync
edits into them.
