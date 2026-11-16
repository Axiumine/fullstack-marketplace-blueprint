# Code conventions

## Formatting — two spaces, tree-wide (ADR-058, ADR-024)

**Indentation is two spaces**, set by prettier (`"useTabs": false`, `"tabWidth": 2`) and mirrored by every `.editorconfig`
(`indent_style = space`). Prettier is the one authority: ADR-024's rule that eslint and prettier must never disagree about
indentation stands, and ADR-058 changed its value from a tab to two spaces.

The thirteen `.prettierrc` files are byte-identical: no semicolons, single quotes,
`"trailingComma": "none"`, `printWidth: 129`, `proseWrap: "never"`, `useTabs: false`, `tabWidth: 2`. So are the thirteen
`.prettierignore` files bar per-repo lines — `marketplace-user` adds `src/routeTree.gen.ts`, which its
build generates. **Keep it that way**: when they differed per repo, a snippet moved between two of them
failed `yarn lint` on the commas alone.

⚠️ **The shared eslint package still ships `indent: ['error','tab']`.** `@axiumine/eslint-config-be` switches it off for `src/**`
through its trailing prettier entry, but a `test/**/*.mts` or `vitest.*.mts` block that spreads `sharedTsBlock.rules` after it
re-arms the rule, and `eslint --fix` then rewrites prettier's spaces back into tabs. Each repository therefore overrides it in
its own `eslint.config.js` — `indent: 'off'` in all ten backend repos (nine services and `marketplace-common`), and an own rule at 2 in the three
frontends. **When you add a block that spreads `sharedTsBlock.rules`, override `indent` in it too.**

⚠️ **In the three frontends, `src/gql/*/gql.ts` is generated and keyed by the exact text of each embedded GraphQL document.**
Reindenting those documents leaves the keys stale — `typecheck` fails, and at runtime the lookup misses. After any reformat
of them run `yarn codegen` and stage `src/gql` in the same commit.

Markdown is ignored on purpose — `proseWrap: "never"` flattens every hand-wrapped paragraph in these
docs onto one line.

`marketplace-db-setup` has neither prettier nor eslint, deliberately: its content is applied migrations,
which are immutable, so a formatter that rewrites them is the wrong tool.

`marketplace-services-status` is two-space like the rest, by the platform owner's ruling of 2026-10-17. It is not one of the
thirteen gated repos and has no eslint or prettier (ADR-025), so nothing enforces it: a file added there follows it by hand.

**Still tab-indented, on purpose:** shell scripts and git hooks (a bash `<<-` heredoc strips leading tabs and nothing else, so
converting one breaks it), `marketplace-db-setup`, the `marketplace-nginx` configuration and the shell in `marketplace-docker-DBs`.
Files prettier ignores or has no parser for — `package.json` where it is ignored, `.gitnexusrc`, the `*.fixture` lint inputs and
the contents of template literals — keep what they had. Markdown code fences in older documents may still show tabs.

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

- **`engines.node` is `^26.13.1` in all fifteen packages** (the parent workspace has no `package.json`),
  `.nvmrc` says `26.13.1`, and Node 24 is gone from the project (the owner's order of 2026-11-16, ADR-026).
  Keep the caret: semver reads `26.13` as `26.13.x` and bare `26.13.1` as that one release. ⚠️ **Yarn 4
  does not read `engines`**: `yarn install` and `yarn dev` run under any Node and say nothing. The field
  is what each `pre-push` reads to select the pinned Node through nvm — it blocks with the `nvm install`
  line when that version is missing — and CI takes the version from `.nvmrc`; that hook check is the
  enforcement. When bumping Node, bump all fifteen in one sweep.
- **`packageManager` is in all fifteen packages**, one identical `yarn@4.18.1+sha512.…` string. Keep
  it that way: it is what makes Corepack hand every repo the same yarn binary, and the eight that used
  to lack it — `marketplace-common` and the seven original backend services — were the ones where a
  divergent yarn would be least visible, since they are also the pair that publishes and consumes an
  unregistered package by name. A new package copies the line verbatim; a yarn bump changes all fifteen
  in one sweep, exactly like `engines.node`. ADR-059 records the move from Yarn 1.22.22.
- ⚠️ **Node 26 ships without Corepack, so Corepack is installed, and pinned.** Node 25 and later no longer
  bundle it. On a machine: `npm install -g corepack@0.36.0 && corepack enable`, once per Node install —
  the fix line the hooks print says the same. In CI: each repository carries
  `.github/tools/package.json` and `package-lock.json` naming `corepack` 0.36.0, and `gates.yml` installs it
  with `npm ci`, outside the checkout, with scripts off. Never a bare `npm install -g corepack` in a workflow:
  it is an unpinned download, and Scorecard's `Pinned-Dependencies` would fall below its floor of 10
  (ADR-054). Dependabot watches `/.github/tools`, so the version moves by a pull request someone reads.
  A new repository copies the directory with its lockfile.
- **Each of the fifteen commits a `.yarnrc.yml` holding three settings and a comment, and nothing else**:
  `nodeLinker: node-modules` (vitest, Stryker, `tsc` with `paths` and the production start scripts read
  `node_modules`, so Plug'n'Play is not used), `enableScripts: true` (Yarn 4.18 does not run a dependency's
  install script by default, and `mongodb-client-encryption` fetches its native binding in one) and
  `enableTelemetry: false`. ⚠️ **No `npmRegistryServer` and no credential in it**: a project-level registry
  overrides the mirror in `~/.yarnrc.yml` for everyone who clones. Credentials and the LAN mirror —
  `npmRegistryServer`, plus `unsafeHttpWhitelist` for an `http` host — live in `~/.yarnrc.yml`, which no
  repository holds. The `pre-commit` guard lets the file through by path and refuses a staged one whose
  blob names a credential key (`.claude/SECRETS.md`). Each `.gitignore` carries `.yarn/`, `.pnp.*` and
  `!.yarnrc.yml`, because a global git ignore may match the file.
- **Yarn 1 habits that no longer work.** `yarn install --immutable` replaces `--frozen-lockfile` (the
  `gates.yml` install); `yarn upgrade` is gone (see below); `yarn audit` is `yarn npm audit`; a `.yarnrc` is
  ignored; and no `prepare` runs on install — `docs/workflow.md` §Git hooks says what replaced it. A Yarn 4
  lockfile carries no registry URL, so `scripts/lockfile-registry-filter.sh` has nothing to rewrite: it is
  still wired and does nothing, and retiring it is an open follow-up (ADR-059).

## Dependency ranges, and the two exceptions to them (2026-09-20)

- **A refresh re-resolves, it does not widen.** In a package, `yarn up -R '**'` moves every tree to the
  newest version each declared range already allows and rewrites `yarn.lock`, leaving `package.json`
  alone; that is the whole remedy for an advisory against a transitive (the refresh of 2026-09-20, under
  Yarn 1, cleared every advisory in the workspace but one). Keep the quotes — a shell expands a bare `**`.
  ⚠️ **`yarn up '**'` without `-R` is the opposite**: it ignores the declared ranges and rewrites the
  manifest to each package's latest release. `yarn upgrade` is not a Yarn 4 command. The refresh also
  re-resolves `node-gyp@latest`, the entry Yarn 4 adds for `mongodb-client-encryption`'s `binding.gyp`, so
  it can move a build tool no `package.json` names. Reach for a range edit only when the fix is outside
  the range, and say so in the commit.
- **`resolutions` is for a transitive pinned exactly by a dependency that will not move.** All fifteen
  packages carry `"qs": "^6.15.2"`, because `typed-rest-client` inside `@stryker-mutator/core` asks for
  `qs@6.15.1` by exact version and nothing in a range refresh can reach it. Two packages carry one more —
  `axios` in `marketplace-dev-public-resource`, `js-yaml` in `marketplace-user`. ⚠️ **A `resolutions`
  entry is global to the tree it sits in**, so keep them to patch-level fixes with a named reason, and
  never use one to satisfy a peer range.
- ⚠️ **`@sentry/node` is an exact version, with no caret, in the nine services and in
  `marketplace-common`: `10.78.0` in five services, `10.76.2` in the other four and in `marketplace-common`
  (2026-11-14).** `test/sentryVersionGuard.test.mts` asserts that exact version because
  `src/instrument.mts` rests on SDK internals read at it (`RISK_REGISTER` R42), and on 2026-09-20 a
  lockfile refresh moved the SDK off its pin and put ten suites red. The range now says what the guard
  says. A bump is a manifest edit somebody reads — or a Dependabot pull request somebody reads — never a
  side effect of `yarn up -R`. ⚠️ **10.75.0 is the first version this arrangement has admitted**, and it
  was admitted by comparing both releases' tarballs file by file; **10.76.2 is the second**, admitted the same
  way and then measured, although two files of the audited surface changed (the change only narrows what is
  sent); **10.78.0 is the third**, admitted on the tarballs alone, with nothing in the audited surface changed
  and no measurement run. The comparisons are in the guard's own header comment, which holds all three, so the
  next bump starts from something rather than from nothing. The guard asserts five packages: `@sentry/node`,
  `core`, `node-core`, `opentelemetry` and `server-utils`, the last two because `@sentry/node` pins them
  exactly (`docs/architecture.md` §Observability).

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
