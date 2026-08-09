# Marketplace — workspace root

Multi-tenant marketplace — many independent shops, one platform. The catalogue is domain-neutral:
nothing in `item` / `itemCategory` presumes what is sold, and no vocabulary that presumes a product
type belongs in it. Everything is named in English — identifiers, collections, routes, UI text,
comments.

This directory is the parent workspace of all Marketplace repos (polyrepo). Start from `CLAUDE.md`; it
routes to `docs/architecture.md`, `docs/data-model.md`, `docs/frontends.md`, `docs/testing.md`,
`docs/workflow.md`, `docs/conventions.md` and `docs/gitnexus.md`, and to
`docs/devprotocol/phase3/adr/ADR-INDEX.md` for the rationale behind every decision below.

**This file is the gate policy** — which layer blocks what, and what the mutation rollout found.

## Backend datasource matrix

Which datasource each backend service actually connects to and uses at runtime. The two columns are
the datasource adapters `@axiumine/koa-utils` ships and this platform wires
(`dataSources/MongoDB`, `dataSources/Redis`).

Legend: ✅ connected and used · ❌ not used.

|Service|Port|Tier|MongoDB|Redis|
|---|---|---|---|---|
|`marketplace-dev-public-authorization`|4028|public|✅|✅|
|`marketplace-dev-public-resource`|4027|public|✅|✅|
|`marketplace-dev-authenticated-authorization`|4029|ShopOwner|✅|✅|
|`marketplace-dev-authenticated-resource`|4026|ShopOwner|✅|✅|
|`marketplace-dev-authenticated-logout`|4030|all three|❌|✅|
|`marketplace-dev-admin-authenticated-authorization`|4025|Admin|✅|✅|
|`marketplace-dev-admin-authenticated-resource`|4024|Admin|✅|✅|
|`marketplace-dev-user-authenticated-authorization`|4031|User|✅|✅|
|`marketplace-dev-user-authenticated-resource`|4032|User|✅|✅|

The **Port** column is reproducible: `grep -m1 '^PORT=' <repo>/env` in each service returns the
number above.

⚠️ The services do **not** bind `127.0.0.1` — they bind every interface (`::`), on purpose; see
`docs/architecture.md`, *Ports and binding*.

Support packages (not servers):

|Package|MongoDB|Redis|
|---|---|---|
|`marketplace-common`|✅ (mongoose models)|❌|
|`marketplace-db-setup`|✅ (migrate-mongo)|❌|

### `marketplace-dev-authenticated-logout` — the Redis-only service

It is the one service with **no MongoDB dependency at all**: logout only reads and deletes the two
Redis session hashes (`<REDIS_KEY>refresh:<token>` and `<REDIS_KEY>access:<token>`). Consequences:

- `start()` connects `RedisConnect()` only; `disconnectAllDatabases()` calls `RedisDisconnect()` only.
- `MONGODB_URI` is **not** in `REQUIRED_ENV_VARS` and is absent from the `env` template.
- Its integration project (`test/integration/*.itest.mts`) boots the real server against the real
  Redis cluster and needs **no Mongo instance** to run.
- `mongoose` is still a **devDependency**, and must stay one: `src/lib/authorizationLogoutHandler.mts`
  imports `IContextRefresh` from koa-utils, whose `.d.mts` does `import { Types } from 'mongoose'`.
  That is a type-only import erased at emit — nothing loads mongoose at runtime — but the repo sets
  `skipLibCheck: false`, so removing the package makes `tsc` (hence `yarn dev` and `yarn build`) fail
  with `TS2307: Cannot find module 'mongoose'`.

### Known inconsistency in the env gates

`checkRequiredEnv()` does not agree with actual Mongo usage in two services:

|Service|Connects to Mongo|`MONGODB_URI` in `REQUIRED_ENV_VARS`|
|---|---|---|
|`marketplace-dev-authenticated-authorization`|✅|❌ missing|
|`marketplace-dev-admin-authenticated-authorization`|✅|❌ missing|

Both boot without the variable and fail later inside `MongoDBConnect()` instead of fast-failing with a
named message. Not fixed yet — logged here so it is not mistaken for intent.

### How this table was verified

Per service, over `src/` (not docs, not `package.json`):

```bash
cd BEs/dev
for d in marketplace-dev-*/; do
	echo "### ${d%/}"
	grep -rhoE '(RedisConnect|MongoDBConnect)\(' "$d/src" | sort -u
	grep -rhoE 'koa-utils/dataSources/[A-Za-z]+' "$d/src" | sort -u
done
```

A `package.json` dependency is **not** evidence of use — the seven services share a copy-pasted
dependency block, so unused adapters and clients are listed everywhere. Read the connect calls.

Last verified: 2026-08-07 (all nine services).

## Test quality gates

Two different questions are gated, and they are not the same question:

|Gate|Question it answers|Tool|
|---|---|---|
|coverage|did a test **execute** this line?|vitest, v8 provider|
|mutation|would a test **fail** if this line were wrong?|Stryker|

100% coverage with weak assertions is the normal failure mode, and the coverage number cannot see
it. Mutation testing is what falsifies it: Stryker rewrites `src/` one small change at a time
(`true` → `false`, a string literal → `""`, a block → `{}`) and re-runs the suite. A mutant that
*survives* is an edit to the source that no test noticed.

### "Three times over" — the coverage layers

The 100%-on-every-metric coverage rule is not written down once. It is written down in **three
independent places**, each able to block on its own, so bypassing one still leaves two:

|Layer|Where|Blocks what|
|---|---|---|
|test run|`vitest.config.mts` → `test.coverage.thresholds`|`yarn test:cov` exits non-zero|
|static scan|`qodana.yaml` → `failureConditions.testCoverageThresholds` (`total`/`fresh` = 100)|`./qodana.sh` fails the scan|
|git hook|`.githooks/pre-push`|the push is refused|

All three read the same run — vitest, v8 provider, `all: true` over `src/**/*.mts`, lcov into
`coverage/lcov.info`. Redundancy is the point: skip the hook and Qodana still fails; never run
Qodana and the hook still fails.

Verified present in all seven services on 2026-07-26: `thresholds` in every `vitest.config.mts`,
`total: 100` / `fresh: 100` in every `qodana.yaml`, and an **executable** `.githooks/pre-push` in
every repo. The executable bit matters — git skips a non-executable hook with only a hint, so the
gate disappears silently; `marketplace-dev-public-authorization` shipped that way once.

### Where the gates fire — push and commit, in all sixteen repos

Fifteen of the sixteen gate on **both**. `marketplace-nginx` gates on **push only**: no `package.json`
means no lint, coverage, mutation or Qodana step to run, so its one `pre-push` gate runs `test/run.sh`
— `nginx -t` plus the behavioural suite in a throwaway container — and blocks on any failed check. It
carries no `pre-commit`, so ⚠️ **the secret guard below does not run there.**

`.githooks/pre-commit` runs the secret guard — which since 2026-08-09
opens with **check 0**, the only check on the platform that reads the *working tree* rather than the
staged index: it blocks when a repo's `.env` or `env` holds a value broken across two physical lines,
the failure that silently truncated all ten `KEYGRIP_KEY_*` values that day (`.claude/SECRETS.md` §3,
R05b) — then `yarn lint:check`, then
`yarn test:cov` (with `yarn typecheck` between them in `marketplace-admin`), then a full Qodana scan through
`./qodana.sh` (~1 min), and only when the staged paths can move a verdict — a docs-only commit skips all
of it. Mutation is the one gate that stays push-only; it is far too slow to pay for per commit.

`marketplace-db-setup` runs a shorter chain, and the one omission left is a decision rather than a gap.
Its `pre-commit` is the secret guard, `yarn test:cov` and Qodana; its `pre-push` is
`test:cov` → `test:mutation` → Qodana. **No lint**, because it is the one repo on the platform with no
`eslint.config.js` and no `.prettierrc` — its content is applied migrations, which are immutable, so a
formatter that rewrites them is the wrong tool. Qodana still *inspects* those files, which is the part
worth having.

⚠️ **The coverage and mutation gates there are new, and this file argued at length that neither could
exist.** The argument was that the repo's only suite drives real `up()`/`down()` against a real database,
so 100% would measure whether every migration got added to a list rather than whether any schema is
right. That was true of *one* suite and stopped being true when there were five: `test/mongoUrl.test.mjs`
and `test/migrateMongoConfig.test.mjs` cover the URL and config builders as plain units,
`test/migrationGuards.test.mjs` drives the error paths a healthy database never reaches, and
`test/migrationCalls.test.mjs` freezes the ordered driver-call log of every migration in both directions
— which is the piece that made mutation testing worth anything here, because it is the only suite that
can tell two migrations apart when they leave the same database behind. Baseline was **52.92%** at 100%
coverage; it is 100 now, over 848 mutants. The replay suite is still push-only in spirit — it needs the
database up — but it is what `test:cov` runs, so `pre-commit` needs Mongo reachable too.

**The fifteenth gated repo is this workspace itself, and it gates `services-status`.** The parent dir is
a git repo like the other fourteen, but it is the only gated one that is not a package: it has no
`package.json`, and until 2026-08-07 its `.githooks/` held a secret guard and nothing else. That left `services-status` — a
subdirectory here rather than a repo of its own — carrying a `qodana.yaml`, a `stryker.config.mjs` and a
100% coverage threshold with **nothing that ran any of them**. Three configs, zero enforcement, and the
appearance of a gated project. Both parent hooks now close it:

|Hook|Gates|Scope|
|---|---|---|
|`.githooks/pre-commit`|secret guard, then `yarn test:cov`, then Qodana|the last two only when a staged non-`.md` path is under `services-status/`|
|`.githooks/pre-push`|`yarn test:cov` → `yarn test:mutation` → Qodana|**unscoped** — every push, whatever it touches|

The asymmetry is on purpose. `pre-commit` is per-commit and can be skipped with `--no-verify`, and a merge
commit never fires it at all, so scoping it by path is safe only because `pre-push` re-runs everything with
no filter on the way out. Note the missing gate: **no lint**, for the same reason as `marketplace-db-setup`
— `services-status` has no `lint` script. Its type check is not missing though, it is just not its own
step: `test:cov` is `yarn build && vitest run --coverage`, so `tsc` runs first and a type error fails the
coverage gate before a single test executes. Read the **first** error in that output, not the last.

First live run of the mutation gate: **1102 killed / 1 timeout / 0 survived, score 100.00 in 52 s**
(`config.ts` 305 mutants, `server.ts` 434, `systemd.ts` 199, `monitor.ts` 148, `probe.ts` 16). Reaching it
meant deleting eight guards no input could reach — a `typeof value === 'string'` in front of a `Set#has`, a
`.toLowerCase()` the WHATWG URL parser had already applied — which is the same "delete the dead code"
verdict `marketplace-db-setup` reached, one repo over.

⚠️ **Two things about the parent hooks that nothing else here has to worry about.** Qodana's step
**blocks today**, because `services-status` has no Cloud project and therefore no `QODANA_TOKEN` — it
prints the fixing command and exits 1, exactly as designed, so a commit here needs `SKIP_QODANA=1` until
the user creates one (the placeholder key is in `services-status/env`). And this repo has **no
`package.json`**, so it has no `"prepare"` script to re-run `git config core.hooksPath .githooks` — the
fourteen sub-repos that are packages restore that setting on every `yarn install`, and this one restores
it never. After a fresh clone of this directory, run the line by hand or all three gates and the secret
guard are simply off.

Lint went in last, and its absence had already cost something. `lint` and `lint:check` existed in all nine
linted repos and no hook called either, so eslint and prettier were the only tools here whose verdict
nothing enforced — while `eslint.config.js`, `.prettierrc` and `.prettierignore` were also missing from the
backend `RELEVANT_PATHS`, so a commit touching only them skipped every other gate too. Both holes are
closed: `yarn lint:check` is the first gate of both hooks in all nine, and the three configs are in the
filter. It is the cheapest gate and the only one that can fail on a file the others are perfectly happy
with — the next `yarn lint` rewrites it regardless.

Qodana deliberately runs in **both** hooks. `git merge --no-ff` never fires `pre-commit` — git runs that
hook for `git commit` only — so in the branch → commit → merge → push flow the merge commit, the one
revision that actually reaches `origin`, is the single commit no pre-commit scan ever sees, and two
individually clean branches can merge into a tree that is not. And Qodana Cloud files every report under
the branch it was produced on (the CLI has no `--branch` flag, it reads git HEAD), while pre-commit always
runs on the feature branch *before* the commit exists — so a repo gated only there never produces a
`main`-tagged report and the "new problems" baseline has nothing stable to compare against. Every repo
that gates coverage passes `SKIP_TESTS=1` in both scans, reusing the `coverage/lcov.info` the preceding
gate just wrote — `marketplace-db-setup` included, since its `qodana.yaml` grew
`testCoverageThresholds` and there is now a report to reuse. `SKIP_QODANA=1` bypasses the scan alone;
the coverage and mutation gates still run.

Two details that make the difference between a gate and the appearance of one:

- **`severityThresholds` is what binds the inspection results.** Without it Qodana prints
  `✗ Found N new problems` and still exits 0, so `testCoverageThresholds` is the only condition that
  can fail a run — and vitest already enforces that, leaving the scan with nothing of its own to block
  on. Verified on `marketplace-common`: a run reporting a **High** `JSVoidFunctionReturnValueUsed` exited 0,
  and 255 once the two keys were added. `critical: 0` / `high: 0` is now in every `qodana.yaml`,
  `marketplace-db-setup`'s included — and that file now carries `testCoverageThresholds` as well, so
  severity is no longer the only condition its scan can fail on. `@axiumine/koa-utils` already had it.
- **A missing prerequisite blocks, it does not warn and continue.** Docker down, no `qodana` CLI, linter
  image absent, no `QODANA_TOKEN`, wrong Node — each exits 1 with the one command that fixes it. A gate
  that steps aside when it cannot run is the hole it exists to close, reopened one condition lower.

What the severity gate found the moment it existed: **14 High findings across all seven services**, every
one of them `ES6PreferShortImport` on the integration tests' `from '../../src/index.mts'`. The advice is
wrong here — the shortened form was applied and the suite run, and it fails with
`Cannot find module '/src'` — and every service already carried an exclusion saying exactly that. It was
scoped to `test/integration/index.itest.mts` alone, so `startFailure` and `shutdown` kept
reporting into a scan that exited 0 regardless. The scope is now the `test/integration` directory, and
the rescan that followed put all seven back at **exit 0** with nothing above Moderate left (1–4 each,
`DuplicatedCode` and `JSDeprecatedSymbols`, deliberately advisory).

`marketplace-db-setup` was the last repo never scanned — its `qodana.sh` exited at the empty-token check
(`QODANA_TOKEN missing or empty in .env`) with no output at all, a 0-byte log and exit 1 that reads like a
crash rather than a missing credential. The token now exists and the first real scan has run, against
Cloud project `ObD0L` (`db-setup`), which is its own project like every other repo's. (This line read
`9kVqd` until 2026-08-07; every report the repo has ever uploaded, from the first scan on 2026-08-04
onwards, went to `ObD0L` — the id is printed by the CLI at the end of each run and in
`.qodana/results/open-in-ide.json`, which is where to check it rather than trusting a doc.)

It failed, and the failure is worth recording because the shape recurs. **51 problems, 15 of them High,
and 45 of the 51 in one file: `setup/mongodb.js`** — `CommaExpressionJS` ×8, `UnnecessaryLabelJS` ×6,
`ThisExpressionReferencesGlobalObjectJS` ×1, `BadExpressionStatementJS` ×30. Every one is a false positive
of the same kind: that file is a **mongosh runbook**, not JavaScript. `use dbMarketplaceDev` is a shell
command; a JS parser reads it as a label plus a bare expression and reports both halves. Its sibling
`setup/redis.txt` is the same kind of file and escapes the whole thing only by being named `.txt`.

The fix was four `exclude` entries in `qodana.yaml`, each **scoped to that one path** and each carrying its
reason — deliberately not a blanket exclusion of the file, because `HardcodedPasswords` must keep firing
there: that runbook really does carry live credentials. The rescan came back **exit 0**, 6 problems, all
Moderate `DuplicatedCode` (four migrations, which duplicate on purpose, and the migration test).

⚠️ That is a symptom fix and the config says so. The root cause is the extension, and the next JS
inspection added to the profile will need a fifth entry. Renaming to `setup/mongodb.txt` kills the class
outright, and is the better move whenever the doc references and the `-name '*.js'` glob in that repo's
semgrep script can move with it.

### Linter version, CLI version, and one Cloud project per repo

Three settings that are invisible until they disagree, and none of them fails loudly when they do.

|Thing|Where it is pinned|Current|
|---|---|---|
|linter image|`qodana.yaml` (`image:` here, `linter:` in koa-utils)|`jetbrains/qodana-js:2026.2`|
|CLI|the machine, a hand-installed `.deb` (dpkg only, no apt repo)|`2026.2.0`|
|GitHub action|`.github/workflows/qodana.yml` — koa-utils only, no marketplace repo has CI|`JetBrains/qodana-action@v2026.2`|

The linter decides which inspections run, so two repos on different tags are not being held to the
same rules. A CLI *older* than its linter still scans, but prints `You are using a non-compatible
Qodana linter …` and keeps going. Bump the action tag alongside the image: `v2026.1` ships the 2026.1
CLI, which reintroduces that mismatch in CI after you have fixed it locally.

⚠️ **One Qodana Cloud project per repo, and nothing enforces it but the token.** The project a report
lands in is decided entirely by `QODANA_TOKEN` — not by the repo name, not by `qodana.yaml`. Paste one
repo's token into another and both upload into the same project, where their baselines and report
histories interleave and neither is trustworthy. That happened here: `marketplace-common` carried
`marketplace-dev-public-resource`'s token and had been uploading into `oDKeo` while its own project sat
empty. Fixed 2026-08-01. To check a repo, read the `qodana.cloud/projects/<id>` line the scan prints
and confirm the id is that repo's own — one project per repo, one distinct id each.

Every sub-repo that ships code carries a `qodana.yaml` — all fourteen — and so does `services-status`,
scanned by this workspace's hooks rather than by one of its own. The fifteenth sub-repo,
`marketplace-nginx`, ships no code and so has no Qodana config; what it has instead is a `pre-push` hook
running `test/suite.sh`, which is the gate that fits what it does ship. **Every repo is gated by
something on push, and that is the invariant to keep.** A new repo without a config and without a hook
is silently outside every layer described above.

⚠️ **Four of them have a config and no project to upload it to**, so their scan step blocks on the
missing `QODANA_TOKEN` rather than passing: `services-status`, `marketplace-user` and the two
`*-user-authenticated-*` services, all built after the Cloud projects were created. Creating a project is
the user's call; until then those four commit with `SKIP_QODANA=1`, and the coverage and mutation gates
still run. **Do not point them at an existing repo's token** — that is exactly the interleaving described
above.

### The mutation layers

|Layer|Where|Blocks what|
|---|---|---|
|mutation run|`stryker.config.mjs` → `thresholds.break: 100`|`yarn test:mutation` exits non-zero|
|git hook|`.githooks/pre-push`, the mutation step|the push is refused|

Only two layers, not three: **Qodana has no mutation gate**, so `pre-push` is the only thing
standing between a weakened assertion and `origin`. The hook runs lint, then coverage, then
mutation, and blocks on any of them.

Neither number may be lowered. When mutation goes red the fix is a stronger assertion, a deleted
dead branch, or — only for a mutant provably unable to behave differently on any reachable input —
a `// Stryker disable next-line <Mutator>: <why>` in the source with the reachability argument
written above it.

Rolled out first in `marketplace-dev-authenticated-logout`, whose `COVERAGE.md` is the reference write-up
(scope decisions, equivalent mutants, and why `rejects.toThrow()` is the assertion that hides the
most bugs). **Rollout is complete as of 2026-08-07**: every package that ships code is at mutation score
100 with `thresholds.break: 100` and a blocking `pre-push` — the nine services, `marketplace-common`,
`marketplace-db-setup`, the three frontends and `services-status`.

### What the rollout actually found

Every package was already at 100% coverage. None was at 100% mutation score:

|Package|Mutation score before|
|---|---|
|`marketplace-common`|45.95%|
|`marketplace-db-setup`|52.92%|
|`marketplace-dev-authenticated-resource`|85.09%|
|`marketplace-dev-admin-authenticated-authorization`|90.32%|
|`marketplace-dev-public-authorization`|96.47%|

`marketplace-common` reached 100 with **zero changes to `src/`** and zero Stryker disables — every one of
its survivors was a weak assertion, not a defensible piece of code. The gaps behind them were real:
the embedded company sub-document had no type or required checks at all, and the `LoginSubDocSchema`
pre-save hook never asserted the field name it passes to `isModified()`.

⚠️ **Do not add `ignoreStatic` to a Stryker config.** A mutant in module-load-time code throws during
Vitest's file-collection phase, before any test runs; Stryker cannot attribute the failure to a test
and reports **Survived** even though the suite did fail. That artifact is indistinguishable from a
real survivor and invites `ignoreStatic` as the fix, which then deletes whole classes of mutant from
the run — here it masked a wipe of `RESET_PWD_PATHS` to `{}`. The flag was briefly set in all seven
services on exactly that misdiagnosis and has since been removed from all of them. The real fix is a
dynamic `await import()` inside a `beforeEach`, so the throw lands inside a test that can fail.
`beforeEach`, not `beforeAll`: a throw in `beforeAll` marks dependent tests *skipped* rather than
failed, and the vitest-runner does not count a skipped test as a kill either.

⚠️ **The same root cause has a second face: a top-level `const` is evaluated once per process.**
Stryker switches the active mutant **per test**, so a module that was loaded before the switch hands
every test the *unmutated* value however thoroughly the test asserts it. That was 54 of
`marketplace-db-setup`'s 62 survivors — the const bodies in `lib/schemas/`, one for one, while the
shapes built inside a *function* body died on the first run because those re-execute per call. Read a
`Survived` in a pure-data module as "my test never saw the mutant", not as "my assertion is too weak":
the fix is to evict the module from the loader cache **inside** the test, with an `evictLib()` over
`require.cache` under CommonJS or a dynamic `await import()` in `beforeEach` under ESM.

And a survivor that no eviction can kill is usually telling you the code is dead. No test can
distinguish `maximum: 180` from `maximum: -180` in a constant nothing imports, so an unkillable mutant
in an exported-but-unreferenced value means the thing is orphaned and the fix is to delete it — that is
how `COORDINATE_DECIMAL` was found in `lib/schemas/geo.js`, left behind when the migrations that
restated it were deleted along with a since-removed collection. Deleting code is a legitimate way to clear
a mutant; lowering `thresholds.break` never is.
