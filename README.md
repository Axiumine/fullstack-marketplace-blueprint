# Marketplace — workspace root

[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Axiumine/fullstack-marketplace-blueprint/badge)](https://scorecard.dev/viewer/?uri=github.com/Axiumine/fullstack-marketplace-blueprint)

> [!WARNING]
> **Work in progress — this software is not tested yet.** It has never run outside a developer
> workstation: no real deployment, no load test, no security review, no upgrade path. Parts of the
> platform are deliberately unbuilt, and anything here — schemas, endpoints, configuration, file
> layout — can still change without notice. Whatever automated gates this repo runs, treat the result
> as unproven: do not point it at real users or real data.
> Read [`docs/PRODUCTION_HARDENING.md`](./docs/PRODUCTION_HARDENING.md) before taking any of it further.

Multi-tenant marketplace — many independent shops, one platform. The catalogue is domain-neutral:
nothing in `item` / `itemCategory` presumes what is sold, and no vocabulary that presumes a product
type belongs in it. Everything is named in English — identifiers, collections, routes, UI text,
comments.

This directory is the parent workspace of all Marketplace repos (polyrepo, sixteen of them), published at
<https://github.com/Axiumine/fullstack-marketplace-blueprint>. Since ADR-031 it tracks the fifteen
sub-repos as submodules with relative URLs, so `git clone --recurse-submodules` rebuilds the whole
workspace over whichever transport you clone with — see [`docs/workflow.md`](./docs/workflow.md) §Cloning the workspace, which
also covers the detached-HEAD trap that follows every `git submodule update`, and what is not yet pushed.
**Running it for the first time: [`SETUP.md`](./SETUP.md)** — prerequisites, the database cluster, the
CSFLE key, the shared secrets, migrations and demo data, the nine services, the three frontends, nginx.

Start from [`CLAUDE.md`](./CLAUDE.md); it
routes to [`docs/architecture.md`](./docs/architecture.md), [`docs/data-model.md`](./docs/data-model.md), [`docs/frontends.md`](./docs/frontends.md), [`docs/testing.md`](./docs/testing.md),
[`docs/workflow.md`](./docs/workflow.md), [`docs/conventions.md`](./docs/conventions.md) and [`docs/gitnexus.md`](./docs/gitnexus.md), and to
[`docs/devprotocol/phase3/adr/ADR-INDEX.md`](./docs/devprotocol/phase3/adr/ADR-INDEX.md) for the rationale behind every decision below.

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
[`docs/architecture.md`](./docs/architecture.md), *Ports and binding*.

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

### The env gates, and what they do not check

`checkRequiredEnv()` now agrees with the matrix: every service that connects to Mongo lists
`MONGODB_URI` in its `REQUIRED_ENV_VARS`, and `marketplace-dev-authenticated-logout` — the one that
does not connect — does not list it. The two authorization services that used to boot without it, and
fail later inside `MongoDBConnect()` instead of naming the variable, no longer do.

Presence is one of two passes. Each service also declares an `ENV_SHAPES` map and calls
`assertEnvShape()` from `@axiumine/marketplace-common`, which refuses a value of the wrong *kind* — a
port with a typo in it, `true` where koa-utils compares against `'1'`, a `mongodb://` URI in the Redis
slot. Presence is checked first and shape second, so a boot that is missing a variable says so rather
than complaining about the format of one nobody has written yet.

⚠️ **Neither pass knows what the rest of the fleet was pointed at.** A plausible value of the right
shape — the right-looking password for the wrong server — passes both and always will. That residual
is the open half of `RISK_REGISTER` R04.

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

All three read the same run — vitest, v8 provider, `coverage.include` over `src/**/*.mts`,
lcov into `coverage/lcov.info`. That `include` is load-bearing: without it the v8 provider
reports only the files a test imported, so a source file no suite loads is absent from the
report rather than listed at 0% and the 100% threshold passes straight over it
([`RISK_REGISTER`](./docs/devprotocol/phase5/RISK_REGISTER.md) R07). Redundancy is the point:
skip the hook and Qodana still fails; never run Qodana and the hook still fails.

Verified present in all seven services on 2026-07-26: `thresholds` in every `vitest.config.mts`,
`total: 100` / `fresh: 100` in every `qodana.yaml`, and an **executable** `.githooks/pre-push` in
every repo. The executable bit matters — git skips a non-executable hook with only a hint, so the
gate disappears silently; `marketplace-dev-public-authorization` shipped that way once.

### Where the gates fire — push and commit, in all sixteen repos

All sixteen gate on **both**, but not with the same content. `marketplace-nginx` has no `package.json`,
so there is no lint, coverage, mutation or Qodana step it could run: its `pre-push` runs `test/run.sh`
— `nginx -t` plus the behavioural suite in a throwaway container — and blocks on any failed check, and
its `pre-commit` is the secret guard below and nothing else (ADR-030).

### The second layer — six of the eight gates, on GitHub, since 2026-09-20

**The hooks are still the authoritative layer, and they are no longer the only one.**
`.github/workflows/gates.yml` in all sixteen repos runs the same gates against the same scripts on every
pull request and on every push to `main`, and `main` requires the check (ADR-055). It exists for the one
path a local hook can never see: a merge performed on github.com, which is how a Dependabot pull request
used to reach `main` having passed nothing at all.

What runs there, per repo class:

|Repo class|Gates in CI|
|---|---|
|the thirteen sub-repo packages + `marketplace-services-status`|semgrep → trivy → `lint:check` → `typecheck` → `test:cov` → `test:mutation`|
|the nine services, out of those fourteen|the same, with `test:unit` in place of `test:cov`|
|`marketplace-nginx`|`test/run.sh`|

Three things it does **not** do, and a green check is not a substitute for any of them:

- **Qodana** — needs a JetBrains Cloud token this workspace does not put in CI. Local hook only.
- **the Scorecard floor** — has its own workflow, and grades the repository's state on GitHub rather than
  a diff, so per-pull-request it would say nothing new.
- **the integration project, and with it the coverage measurement, in the nine services** — those suites
  need the MongoDB replica set with its `MONGO_TEST_*` users, the Redis ACL, and the sibling
  `marketplace-db-setup` checkout whose migrations `globalSetup` replays. None of the three exists on a
  runner. CI runs `yarn test:unit` instead — a differently-named gate, not a lowered threshold; the
  coverage gate is untouched and still fires in `pre-push`, here, where the datastores are.

`enforce_admins` stays **false**, so a direct `git push` to `main` from this machine runs the hooks and no
server-side check — which is the arrangement the hooks were designed for, and the reason CI is a second
layer rather than the layer.

**Semgrep joined `pre-push` on 2026-08-13, in all fifteen projects that carry a ruleset, and it is
push-only on purpose.** ⚠️ **In fourteen of the fifteen, as it turned out: `marketplace-db-setup`'s hook
kept its five gates and called no semgrep step until 2026-09-20**, while this sentence read as though it
did. The divergence surfaced only when ADR-055 put the same gates in CI and the repo's own `semgrep:ci`
reported a finding on its first run — a ruleset nothing calls is not a gate, which is the very point the
rest of this paragraph makes. Before that date it was in no hook at all — fifteen `semgrep/` directories, a
`semgrep` and a `semgrep:ci` script in every `package.json`, and nothing that ever ran either: a
ruleset is not a gate. It runs **first** of the gates in each hook, because at ~3 s it is cheaper than
the rest by an order of magnitude, so a rule violation is reported in seconds rather than after a full
coverage + mutation + Qodana run. Push is also the only place its verdict can be trusted: semgrep scans
**files git already tracks**, so a new file is invisible to a "clean" scan until it is committed —
which, at push time, everything being pushed is. It stays out of `pre-commit` for the same reason
mutation does: it needs Docker and a pinned image, and a hook paid per commit is a hook that gets
bypassed out of habit. Bypass for a Docker outage, never for a finding: `SKIP_SEMGREP=1 git push`.

**Trivy joined `pre-push` on 2026-08-13, in all fourteen repos that carry a `yarn.lock` — the fifteenth
gated tree, `marketplace-services-status`, through the parent hook.** It is the answer to a question nothing on this
platform was answering: semgrep and Qodana both read the code *written* here, and neither reports on the
code *installed* here. Qodana looked like it did — `VulnerableLibrariesLocal` is armed in every
`qodana.yaml` and runs on every commit and push — but that inspection is a ~0.03 s offline heuristic that
queries no advisory feed and reports zero on every repo, while the class that does query one
(`VulnerableLibrariesGlobalInspection`) ships in the same image and appears in no profile and in no scan
log this workspace has ever produced. A check that cannot report is indistinguishable from a passing one,
which is the same failure the fifteen unrun `semgrep/` directories were.

Not `yarn audit`, and ⚠️ **the reason changed on 2026-08-27.** This paragraph said yarn 1 aborts the
whole run over the unpublished `@axiumine/marketplace-common`. It does not any more — the package is
published (`ADR-037`), and `yarn audit` in `marketplace-dev-public-resource` now completes: **734 packages
audited, 80 advisories**, or **268 and 28** with `--groups dependencies`. It is still not the gate, for
the reason that outlived the 404: it has no way to suppress devDependencies short of that flag, and
`npm audit` wants a `package-lock.json` nothing here has. Trivy reads `yarn.lock` natively, in a pinned
container, and **suppresses devDependencies by default** — which is the property that makes the gate
keepable rather than the one everybody learns to bypass: an advisory in something only `yarn build` loads
does not block a push. HIGH and CRITICAL only, matching `qodana.yaml`'s own critical 0 / high 0. It runs
second, after semgrep and before everything slow, at well under a second once the vulnerability database
is cached. Bypass for a Docker or network outage, never for a finding: `SKIP_TRIVY=1 git push`.

⚠️ **The threshold was not tuned to green the current tree, and the current tree is not green.**
`marketplace-dev-public-resource` blocks on `axios@0.21.4` — ten HIGH advisories, R49 on the risk register
— and every other repo passes. That is the gate reporting, not the gate misconfigured: the fix is the
upgrade, not a `.trivyignore`, and there is no `.trivyignore` anywhere in this workspace. ⚠️ The database
updates independently of the pinned image tag, so a tree that is clean today can go red tomorrow with no
commit in between.

⚠️ It is **not** a second copy of Qodana's SAST. Qodana runs JetBrains inspections; semgrep runs the
vendored registry packs plus each repo's own `semgrep/custom.yml`, whose two secret-in-logs rules —
auth token, reset secret — are this platform's own and no general-purpose linter
knows them. `marketplace-nginx` is the one gated repo with no ruleset and therefore no such step; it
ships no code.

`.githooks/pre-commit` runs the secret guard — which since 2026-08-09
opens with **check 0**, the only check on the platform that reads the *working tree* rather than the
staged index: it blocks when a repo's `.env`, `env` or `env.shared` holds a value broken across two physical
lines — the failure that silently truncated all ten `KEYGRIP_KEY_*` values that day
(`.claude/SECRETS.md` §3, R05b) — or, since 2026-09-01, an unquoted value holding whitespace or a `#`,
which dotenv and direnv do not read the same way (R05), or a tail that reads as its own `KEY=VALUE`
line — `kJ3xQ==` is one, and base64 padding makes them — then `yarn lint:check`, then `yarn typecheck`,
then `yarn test:cov`, then a full Qodana scan through
`./qodana.sh` (~1 min), and only when the staged paths can move a verdict — a docs-only commit skips all
of it. Two gates stay push-only: mutation, far too slow to pay for per commit, and semgrep, which is
fast but needs Docker and is only trustworthy over committed files (see above).

`marketplace-db-setup` runs a shorter chain, and the one omission left is a decision rather than a gap.
Its `pre-commit` is the secret guard, `yarn test:cov` and Qodana; its `pre-push` is
trivy → scorecard floor → `test:cov` → `test:mutation` → Qodana. **No lint and no type gate**, because it is the one repo on the
platform with no `eslint.config.js`, no `.prettierrc` and no TypeScript at all — its content is applied migrations, which are immutable, so a
formatter that rewrites them is the wrong tool. Qodana still *inspects* those files, which is the part
worth having.

⚠️ **A coverage or mutation gate over migrations only means something because the suite is not only the
replay.** An end-to-end `up()`/`down()` against a real database, on its own, measures whether every
migration got added to a list — not whether any schema is right, and a mutation score over it would be
noise. Five suites is what makes the number real: `test/mongoUrl.test.mjs` and
`test/migrateMongoConfig.test.mjs` cover the URL and config builders as plain units,
`test/encryption.test.mjs` drives the four CSFLE guards a healthy environment never trips, and
`test/migrationCalls.test.mjs` freezes the ordered driver-call log of every migration in both directions
— that last one is what makes mutation testing worth anything here, because it is the only suite that can
tell two migrations apart when they leave the same database behind. 100% on all four coverage metrics and
**mutation score 100 over 788 mutants**. The replay suite is push-only in spirit — it needs the database
up — but it is what `test:cov` runs, so `pre-commit` needs Mongo reachable too.

**The fifteenth gated repo is this workspace itself, and it gates `marketplace-services-status`.** The parent dir is
a git repo like the other fourteen, but it is the only gated one that is not a package: it has no
`package.json`, and until 2026-08-07 its `.githooks/` held a secret guard and nothing else. That left `marketplace-services-status` — a
subdirectory here rather than a repo of its own — carrying a `qodana.yaml`, a `stryker.config.mjs` and a
100% coverage threshold with **nothing that ran any of them**. Three configs, zero enforcement, and the
appearance of a gated project. Both parent hooks now close it:

|Hook|Gates|Scope|
|---|---|---|
|`.githooks/pre-commit`|secret guard, then `yarn test:cov`, then Qodana|the last two only when a staged non-`.md` path is under `marketplace-services-status/`|
|`.githooks/pre-push`|`yarn semgrep:ci` → trivy → scorecard floor → `yarn test:cov` → `yarn test:mutation` → Qodana|**unscoped** — every push, whatever it touches|

The asymmetry is on purpose. `pre-commit` is per-commit and can be skipped with `--no-verify`, and a merge
commit never fires it at all, so scoping it by path is safe only because `pre-push` re-runs everything with
no filter on the way out. Note the missing gate: **no lint**, for the same reason as `marketplace-db-setup`
— `marketplace-services-status` has no `lint` script. Its type check is not missing though, it is just not its own
step: `test:cov` is `yarn build && vitest run --coverage`, so `tsc` runs first and a type error fails the
coverage gate before a single test executes. Read the **first** error in that output, not the last.

First live run of the mutation gate: **1102 killed / 1 timeout / 0 survived, score 100.00 in 52 s**
(`config.ts` 305 mutants, `server.ts` 434, `systemd.ts` 199, `monitor.ts` 148, `probe.ts` 16). Reaching it
meant deleting eight guards no input could reach — a `typeof value === 'string'` in front of a `Set#has`, a
`.toLowerCase()` the WHATWG URL parser had already applied — which is the same "delete the dead code"
verdict `marketplace-db-setup` reached, one repo over.

⚠️ **Two things about the parent hooks that nothing else here has to worry about.** Qodana's step scans
`marketplace-services-status` and uploads to its own Cloud project, `MP Service Status` (`xPKXD`) — the
scan artefact under `marketplace-services-status/.qodana/results/` is the proof it got there. It **no
longer blocks**: this paragraph said it did, because that project did not exist when it was written, and
`SKIP_QODANA=1` went from a standing workaround back to the one-shot bypass it is described as below. The
hook still fails closed if the token goes missing — it prints the fixing command and exits 1, by design.
And this repo has **no
`package.json`**, so it has no `"prepare"` script to re-run `git config core.hooksPath .githooks` — the
fourteen sub-repos that are packages restore that setting on every `yarn install`, and this one has no
such install to hang it off. ⚠️ **One path does restore it and is worth knowing rather than relying on**:
`marketplace-services-status` is a package *inside this repo* rather than a submodule of it, so it shares
this `.git`, and a `yarn install` there arms **this** repo's `core.hooksPath` as a side effect — but
`SETUP.md` §11 marks that step optional and nothing else in the setup reaches it. After a fresh clone of
this directory, run `./scripts/bootstrap.sh` — it arms all sixteen repos and is safe to re-run — or all
three gates and the secret guard are simply off. `./scripts/audit-check.sh` §7 is how you find out which
repos are in that state, and it has to be a check rather than a gate: in an unarmed repo, the hook that
would complain is the one that is off.

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
|GitHub action|`.github/workflows/qodana.yml` — koa-utils only; the marketplace repos run Scorecard and CodeQL (ADR-054), not Qodana, in CI|`JetBrains/qodana-action@v2026.2`|

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

Every sub-repo that ships code carries a `qodana.yaml` — all fourteen — and so does `marketplace-services-status`,
scanned by this workspace's hooks rather than by one of its own. The fifteenth sub-repo,
`marketplace-nginx`, ships no code and so has no Qodana config; what it has instead is a `pre-push` hook
running `test/suite.sh`, which is the gate that fits what it does ship. **Every repo is gated by
something on push, and that is the invariant to keep.** A new repo without a config and without a hook
is silently outside every layer described above.

⚠️ **All fifteen have a config and a project of their own to upload it to** — verified 2026-08-27 from
the `.qodana/results/open-in-ide.json` each repo's last scan left behind. This paragraph used to name
four that had a config and nowhere to send it (`marketplace-services-status`, `marketplace-user` and the
two `*-user-authenticated-*` services, all built after the first Cloud projects were created); they are
`xPKXD`, `dXO5E`, `B5NEV` and `eobk1`, and no repo commits with `SKIP_QODANA=1` as its normal mode. The
full repo → project table is in [`docs/devprotocol/phase1/SYSTEM_CONTEXT.md`](./docs/devprotocol/phase1/SYSTEM_CONTEXT.md)
§5.12. **Do not point a new repo at an existing repo's token** — that is exactly the interleaving
described above, and it is the reason each of the fifteen has its own.

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
`marketplace-db-setup`, the three frontends and `marketplace-services-status`.

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

## License

GPL-3.0-or-later — see [LICENSE](./LICENSE).
