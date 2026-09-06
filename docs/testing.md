# Testing

Gate **policy** — which layer blocks what, and what the rollout found — is in [`README.md`](../README.md), *Test
quality gates*. This file is the operational side: how the suites are laid out and the traps that make
a green run lie.

## Layout — all nine services

Two vitest projects, identical everywhere:

| Project | Files | Environment |
|---|---|---|
| `unit` | `test/*.test.mts` | Redis mocked, `REDIS_KEY=test:` |
| `integration` | `test/integration/*.itest.mts` | `PORT=0`, `fileParallelism: false`, 30 s timeouts, **real** Redis cluster + MongoDB from `.env`, isolated under `REDIS_KEY=marketplaceDev:itest:` |

Scripts: `yarn test` · `test:unit` · `test:integration` · `test:cov` · `test:mutation`.

Outside `dev/`, coverage lives in `marketplace-common` (vitest + stryker) and `marketplace-db-setup`
(vitest + stryker against a real Mongo; assertions are `node:assert/strict`, the runner is vitest).
`marketplace-dev-authenticated-logout/COVERAGE.md` is the reference write-up of the pattern.

## The auth-boundary contract

Every authenticated service refuses the same set of things, and until this contract existed each one
decided for itself which of those refusals it tested. That is how the gap this contract now closes appeared: three
resource services, three boundary-test shapes, one of them missing the wrong-tier case for months while
coverage read 100% and mutation read 100. **The numbers cannot see a case nobody wrote.**

The list is single-sourced in
[`BEs/marketplace-common/src/others/authBoundaryContract.mts`](https://github.com/Axiumine/marketplace-common/blob/main/src/others/authBoundaryContract.mts)
— test data, imported by test files only, never by a runtime path:

| # | The case |
|---|---|
| AB-01 | a valid credential is accepted and the session it resolves reaches `ctx.state.user` |
| AB-02 | a session minted for another tier is refused with 403, not 401 |
| AB-03 | a session carrying no tier at all is refused — fail closed, never a wildcard |
| AB-04 | a request carrying no credential is refused |
| AB-05 | a credential of the wrong shape is refused — a bad scheme, a broken signature |
| AB-06 | a credential whose session is gone from Redis is refused |
| AB-07 | a refresh token presented a second time is refused, and its family revoked with it |

**How a service answers.** A `// AB-xx: <the case>` comment sits above the test that proves it, and
`test/authBoundaryContract.test.mts` reads that service's own boundary suite and fails when a required tag
is absent. Seven such files exist, one per authenticated service, each naming itself with a hardcoded
`SERVICE` constant — `requiredAuthBoundaryCases()` **throws** on a name it does not know, so a typo fails
the suite instead of quietly asking for no cases at all, and a *new* service cannot ask what it owes until
somebody adds it to the contract. The scanner reads test files only, which is what keeps it out of
Stryker's way: Stryker instruments `src/`.

| Service | Owes | Excused, and why |
|---|---|---|
| `marketplace-dev-authenticated-resource` | AB-01..06 | AB-07 — reads an access session, mints nothing, so has no token to replay |
| `marketplace-dev-admin-authenticated-resource` | same | same |
| `marketplace-dev-user-authenticated-resource` | same | same |
| `marketplace-dev-authenticated-authorization` | all seven | — |
| `marketplace-dev-admin-authenticated-authorization` | all seven | — |
| `marketplace-dev-user-authenticated-authorization` | all seven | — |
| `marketplace-dev-authenticated-logout` | AB-01, 04, 05, 06 | AB-02, AB-03 — the one service serving all three tiers (ADR-005): it finds a session by token content alone and asserts no tier. AB-07 — deletes the tokens it is given and mints none |

The two public services are outside the contract: they authenticate nobody, so there is no boundary to
refuse at. An exemption is a written sentence in `AUTH_BOUNDARY_SERVICES`, never an empty cell — the unit
suite in `marketplace-common` fails an exemption whose reason is blank or whose id is not a real case.

- ⚠️ **A tag is a claim, and the scanner cannot check the claim.** It catches the case nobody wrote a test
  for; it does not catch a tagged test that was gutted while its tag stayed. That one is caught by mutation
  testing, one gate later. Do not read a green contract test as "the boundary is proven".
- ⚠️ **`Object.hasOwn`, never truthiness, when reading the service map.** It is a plain object literal, so
  `AUTH_BOUNDARY_SERVICES['constructor']` answers a *function* — a lookup written the obvious way hands an
  unknown service a required-case list nobody wrote down, instead of throwing.
- **Adding a case means adding it everywhere in the same piece of work**: the array, the seven suites, and
  an exemption sentence for any service it does not apply to. The contract test turns a forgotten service
  into a failing suite, which is the whole point of it.

## The mechanical checks

The phase-5 security audit was manual, static-only and single-pass, and it is the reason most of the
sections on this page exist. **Most of what it did by reading is now a command**, and this is the list —
what is checked, what runs it, and for the two that are still a human reading code, why.

Nothing here needs a service running, a container, or a network. Everything is `yarn` in a repo or one
script in the workspace root.

⚠️ **MC-13 is the one exception.** It reads the `coverage/lcov.info` that `yarn test:cov` has just
written, so it inherits everything that run needs — including the real Redis and MongoDB the
integration project boots against. It runs no test of its own and fails, rather than passes, when
the report is absent.

| # | The check | Runs it | Where |
|---|---|---|---|
| MC-01 | no Redis key is built outside `marketplace-common`, and every builder digests a token or says in writing why it does not | `yarn test` | `marketplace-common/test/redisKeyspace.test.mts` |
| MC-02 | no key shape exists that `docs/data-model.md` §Key shapes does not list | `./scripts/audit-check.sh` §2 | workspace root |
| MC-03 | no `rejectUnauthorized`, no `NODE_TLS_REJECT_UNAUTHORIZED`, no `sendDefaultPii`, no `beforeSend` without `beforeSendTransaction`, no request body captured | `yarn lint:check` | the `no-restricted-syntax` block in each `eslint.config.js` |
| MC-04 | each of those selectors actually fires, and the compliant shape does not | `yarn test` | `test/restrictedSyntax.test.mts` (`.ts` in the three apps) |
| MC-05 | all thirteen repos that ship the block — the nine services, the three apps, the library the scrubber lives in — carry both of the above | `./scripts/audit-check.sh` §4 | workspace root |
| MC-06 | no network-derived value reaches an event, a span, a breadcrumb or a log line | `yarn test` · `yarn semgrep` | `marketplace-common/test/sentryBeforeSend.test.mts`; `marketplace-no-log-*` in each backend `semgrep/custom.yml`, `marketplace-fe-no-log-auth-token` in each app's |
| MC-07 | a rate-limit bucket key digests its identity and no service can obtain a client address | `yarn test` · `./scripts/audit-check.sh` §3 | `redisKeyspace.test.mts`; `app.proxy` set nowhere |
| MC-08 | the admin session console cannot print a token, a digest or a key prefix | `yarn test` | `marketplace-dev-admin-authenticated-resource/test/sessionNoLeak.test.mts` |
| MC-09 | every authenticated service proves all seven boundary cases it owes | `yarn test` | `test/authBoundaryContract.test.mts`, seven services + the contract's own suite |
| MC-10 | the seven boundary suites exist at all | `./scripts/audit-check.sh` §5 | workspace root |
| MC-11 | no `.env`, `.npmrc` or `*.pem` value is staged, and no file whose **path** says it holds one — the extension list, anything under `secrets/`, and `marketplace-db-setup`'s `setup/mongodb.js` provisioning runbook, which carries a live database credential by design (R57) | `git commit` | the secret guard in every `.githooks/pre-commit` |
| MC-12 | no dependency with a known advisory, no vulnerable transitive | `git push` | `trivy fs` in `aquasec/trivy:0.70.0`, HIGH + CRITICAL, production tree only — the `pre-push` hook of the fourteen repos with a `yarn.lock` plus the parent's, per [`README.md`](../README.md). ⚠️ **Qodana is not part of this row**: the inspection every `qodana.yaml` arms queries no advisory feed and reports zero everywhere |
| MC-13 | every tracked source file under a declared source root is accounted for by the report the thresholds were computed over — gated by `coverage.include` and present in it, **or** matched by no `coverage.include` glob at all — and every file that is not is named one per line with the reason | `yarn test:cov` | `scripts/coverage-audit.mjs` in all fifteen gated repos, plus `coverage-exempt.txt` in the five that need one — `marketplace-db-setup`, `marketplace-services-status` and the three apps |
| MC-14 | all fifteen gated packages still carry `scripts/coverage-audit.mjs`, still call it from `test:cov`, and carry the current copy of it rather than one predating the R56 extension-drift scan | `./scripts/audit-check.sh` §6 | workspace root |
| MC-15 | all sixteen repos have `core.hooksPath=.githooks` and a `.githooks/pre-commit` git can execute — the two ways every gate in a repo is silently off | `./scripts/audit-check.sh` §7 | workspace root |
| MC-16 | all sixteen `.githooks/pre-commit` scan for the same secret rules — every **value** rule a repo carries is one the parent's list has, every repo carries the credential-flag rule a `mongosh … -password` line needs, and all sixteen **path** rules are the same string, which is then run against seventeen paths it must refuse or pass | `./scripts/audit-check.sh` §8 | workspace root |
| MC-17 | no object reachable from a branch or a tag, in any of the sixteen object databases, matches a secret rule — the history behind the staged diff, which MC-11 never sees | `./scripts/history-scan.sh`, also run by `./scripts/audit-check.sh` §9 | workspace root, plus `scripts/history-scan-allow.txt` |
| MC-18 | no function in `marketplace-dev-public-resource` reads `Company` or `Item` without naming `livePublic` or `LIVE_PUBLIC_PIPELINE` in its own body, and the nine files that read either model are an exhaustive list | `yarn test` | `marketplace-dev-public-resource/test/publicCatalogueFilter.test.mts` and its six fixtures |
| MC-19 | no service other than `marketplace-dev-admin-authenticated-resource` writes `itemCategory`, in any of the three spellings — the call, the computed call, the aliased import — and the one exemption (`holdItemCategory`'s `$inc: { __v: 1 }`) is one file and one verb wide | `yarn lint:check` (blocking) | the `ITEMCATEGORY_NO_WRITE` block in each of the eight `eslint.config.js`, exercised by `test/restrictedSyntax.test.mts`, cross-checked by `./scripts/audit-check.sh` §10 |
| MC-20 | the ClamAV daemon behind each resource service is asked how old its signature database is, once at boot, and a database past seven days or a daemon that will not answer inside 5s reaches Sentry | service startup | `reportClamSignatureAge.mts` in both resource services, over `clamSignatureFreshness` in `marketplace-common`, with nine tests a side |
| MC-21 | every absolute host literal in any sub-repo's `src/` is named in `docs/devprotocol/phase5/PROCESSOR_INVENTORY.md` — §2 if personal data crosses it, §3 with a written reason if it provably does not | `./scripts/audit-check.sh` §11 | workspace root |
| MC-22 | no `del` or `unlink` call takes more than one key, in any of the three spellings — `del(a, b)`, `del([a, b])`, `del(...keys)` — anywhere in the ten repos that hold a Redis client | `yarn lint:check` (blocking) | the `REDIS_ONE_KEY_PER_DEL` block in each of the ten `eslint.config.js`, exercised by `test/restrictedSyntax.test.mts` and its four fixtures, cross-checked by `./scripts/audit-check.sh` §12 |
| MC-23 | no file under `test/integration/**` in any of the nine services imports a Mongoose model from `marketplace-common` — an integration fixture reaches its collection through the raw driver and through nothing else | `yarn lint:check` (blocking) | the `INTEGRATION_SEED_NO_MODEL` block in each of the nine `eslint.config.js`, exercised by three cases in `test/restrictedSyntax.test.mts` and its two fixtures, cross-checked by `./scripts/audit-check.sh` §13 |
| MC-24 | every repo declaring `@axiumine/marketplace-common` resolves the range it declares, holds the version its lockfile names, names a version that repo says it released, and imports no path that version does not export — a consumer lagging the shipped version is allowed and is reported, not failed | `node ./scripts/common-consumer-check.mjs` (blocking, and run by `./scripts/audit-check.sh` §14) | twelve `package.json`/`yarn.lock`/`node_modules` triples against `marketplace-common`'s own `CHANGELOG.md` |
| MC-27 | a personal field is encrypted in both halves of ADR-029 or in neither — every path in `marketplace-common`'s four field-map lists is `binData` in `marketplace-db-setup`'s validators, and every `binData` leaf in those validators is in a list | `./scripts/audit-check.sh` §17 (blocking) | `node ./scripts/encryption-coverage-check.mjs` over the real sources, proved in both directions first by `./scripts/encryption-coverage-check-selftest.sh` — five cases on a two-repo `mktemp -d` tree, including the two ways a source can be unreadable, which exit 2 rather than passing |
| MC-26 | every file that needs a shared environment value holds the same one — `KEYGRIP_KEK` across its seven holders, `REDIS_PASSWORD` and `REDIS_KEY` across their ten — and no repo shadows a shared key with a value only a shell without the direnv hook would read; and `REDIS_TLS` is spelt one of the two ways its reader accepts, `true` or `false`, rather than a `TRUE` that silently means off (R45) | `./scripts/audit-check.sh` §16 (blocking) | `./scripts/env-fingerprint-sweep.sh` over the real files, proved in both directions first by `./scripts/env-fingerprint-sweep-selftest.sh` — twelve cases on a `mktemp -d` tree, never a real one |
| MC-25 | all sixteen `.githooks/pre-commit` refuse a commit whose `HEAD` is `main`, exempt an in-progress merge (`MERGE_HEAD`), and name `SKIP_MAIN_GUARD` as the way past — a copy missing any of the three is drift nothing else can see | `./scripts/audit-check.sh` §15 | the sixteen `.githooks/pre-commit` files |
| MC-28 | every public catalogue query answers with published, undeleted rows only — driven against a real MongoDB seeded with a draft shop, a soft-deleted shop, a draft item, a soft-deleted item, a soft-deleted category and a **published item under an unpublished shop**, and asserting that none of them is ever an answer | `yarn test:integration` | `marketplace-dev-public-resource/test/integration/publicCatalogueLiveness.itest.mts` — nine queries, twenty-one assertions, each proved by planting a dropped-value fault at its composition site, and the nine are asserted to be the whole public read surface, so a tenth query fails this file until it is seeded a draft of its own |
| MC-29 | every service reaches exactly the collections the role written for it in `marketplace-docker-DBs/init/roles.js` would grant — every model a service's `src/` imports is in its row, every collection its row grants is one it imports a model for, the service declared to hold no connection holds none, every `BEs/dev/marketplace-dev-*` directory is in one of the two lists, and no service reaches MongoDB through `connection.db`, `db.collection(…)` or `getSiblingDB` at all | `./scripts/audit-check.sh` §18 (blocking) | `node ./scripts/service-role-check.mjs` over the real sources, proved in both directions first by `./scripts/service-role-check-selftest.sh` — nine cases on a three-service `mktemp -d` tree, including the three ways a source can be unreadable, which exit 2 rather than passing |

⚠️ **`./scripts/audit-check.sh` exists because no test on this platform spans two repos.** Seventeen of its eighteen
checks are claims about *sixteen* repos agreeing — a key built in the wrong one, a lint block missing from
one, a boundary suite absent from one, a coverage gate quietly dropped from one, a repo whose hooks were
never armed, a secret rule one repo has and the others do not, a third party reached from one repo's source
that no inventory names — and a vitest suite in any single repo is structurally unable to see them. It reads
only: no writes, no installs, no containers.

⚠️ **MC-15 is the one check that could not be a gate even in principle.** The condition it looks for —
`core.hooksPath` unset, or a `.githooks/pre-commit` without its executable bit — is exactly the condition
under which no hook in that repo runs, so a hook can never be the thing that reports it. Git refuses to
let a repository arm its own hooks from tracked content, deliberately: a clone would then execute a
stranger's script. `./scripts/bootstrap.sh` is the one command that arms all sixteen after a fresh
checkout, and MC-15 is how you find out afterwards whether anybody ran it (RISK_REGISTER R09).

⚠️ **MC-16 checks the path rule two ways, because until R57 it checked it no ways.** The value rules
were compared here from the day this section existed and `SECRET_PATH` was not, so the drift it exists to
catch had happened inside it: fifteen hooks carried one spelling and `marketplace-nginx` carried another,
narrower in five names — and that repo is the one whose working tree holds TLS keys. A missing name in one
hook is the shape nobody notices, because every repo refuses *something*. The comparison is **equality**,
not the subset rule the value list uses: unlike a value, there is no path worth refusing in one repo and
not in the next, so one line is cheaper than sixteen judgements. Then the rule is **run** — against nine
paths it must refuse and eight it must not, named in `./scripts/audit-check.sh` itself and fed to
`grep -E` as text, so no file is created and none is read. Sixteen identical copies of a regex that had
stopped matching would satisfy every other check in this section, and the second list is the half worth
keeping honest: `setup/mongodb.js` is refused and `setup/mongodb.test.js` is not, because a rule that
swallowed the test file would be edited out by the first person it inconvenienced (RISK_REGISTER R57).

⚠️ **MC-18 is a structural check rather than a behavioural one, and the AST in it is load-bearing.**
It proves a *shape* — that every function reading the public catalogue names the shared liveness filter —
and not that any particular query returns the right rows, which is what the integration suite is for. The
parse is not tidiness: `Company.aggregate<IPin>(` is this codebase's idiom at every aggregation call site,
and a type argument between the method name and its parenthesis defeats a `\.aggregate\(` regex while
changing nothing about the call, so the obvious text version of this check would have been blind to a whole
class of resolver. It is per **enclosing function**, not per file, because the failure it exists for is a
second resolver pasted next to a compliant one. The two cross-cutting helpers that bake the filter in are
deliberately not accepted names — a definition that satisfies a rule by referencing itself proves nothing
(RISK_REGISTER R18; MC-28 is the half a syntactic check cannot reach).

⚠️ **MC-28 follows the value where MC-18 follows the name, and the two are not interchangeable.**
A filter can be built and then shadowed by a later spread, or `livePublic()` can be called for its
return value and the return value dropped — both satisfy a check that looks for an identifier in a
function body, and both serve drafts to anonymous traffic. Nothing static distinguishes them, so this
suite runs the queries instead: the rows exist, the requests go over HTTP to a booted server, and the
drafts must not come back. Every assertion is two-sided — the published sibling must be present in the
same answer the hidden one is absent from — so a filter that stopped filtering and a filter that
matches nothing both fail, and the seed is read back through the raw driver before any of it, because a
row the validator rejected would leave every absence assertion passing for the wrong reason. The one
fixture no single-collection predicate can express is a **published item under an unpublished shop**:
it is why the cross-shop reads join `company` at all, and it is the row that catches a `$lookup`
sub-pipeline losing its `$match`. Thirteen faults were planted one at a time to prove the suite bites —
one per composition site, each dropping the value while leaving the name in the file — and all thirteen
turned it red while **MC-18 stayed green under every one of them**, which is the measurement that says
this file earns its place next to that one. The nine reads are also asserted to **be** the public read
surface — the field list of `QueriesPublic` less the two demo queries — so a tenth query fails this file
until somebody seeds a draft for it, which is what makes it a gate on tomorrow's resolvers rather than a
snapshot of today's (RISK_REGISTER R58).

⚠️ **MC-17 is the only check that reads what a commit already did rather than what it is about to do.**
Every other secret gate on this platform scans the *staged diff*, so a value committed before its rule
existed, or committed past the rule with `--no-verify`, is invisible to all of them for as long as the
repository lives. `./scripts/history-scan.sh` reads `git cat-file --batch-all-objects` — every object git
holds, reachable or not — with the pattern list taken out of the parent's own `.githooks/pre-commit`, so
there is one list and not two. It **blocks** on a match reachable from a branch or a tag, because that is
what a push and a clone carry, and merely **prints** a match in a dangling object, which travels with
nothing and disappears at the next `git gc`. Cleared blobs are named one per line in
`scripts/history-scan-allow.txt` by object name, never by path — an object name is its content, so an
entry can wave through the exact bytes somebody read and nothing else — and a stale entry fails the run,
the same both-directions rule `coverage-exempt.txt` follows (RISK_REGISTER R14).

⚠️ **MC-29 gates a table describing accounts that do not exist yet, which is the only moment gating it
is cheap.** The nine services share one `marketplaceRwDev` login whose `readWrite` is scoped to the
database rather than to a collection, so today every one of them can read and write all six collections
(RISK_REGISTER R59). The narrow shape that ends that is written down — eight accounts, eight roles, one
row of collections each, in `marketplace-docker-DBs/init/roles.js` — but **minting those accounts is
provisioning work outside these sixteen repos, by ADR-039 and ADR-040**, so nothing here can close the
risk and this check does not pretend to. What it removes is the second failure, the one that arrives on
the day somebody *does* mint them: a hand-written table that stopped matching the code months earlier,
and takes a service down at first use for a collection a resolver quietly started importing. The
derivation is mechanical — a model import is reach, `ItemCategory` is `itemCategory` — and it is checked
**both ways**, because a row granting a collection nothing imports is the quieter mistake: it breaks
nothing, which is exactly why it survives as standing access to a collection the service has no code
for. ⚠️ **The check also re-asserts its own premise.** Reading imports is a valid measure of reach only
while no service reaches MongoDB another way, so a `db.collection(…)`, a `connection.db` or a
`getSiblingDB` anywhere under a service's `src/` fails the run rather than being silently excluded from
it — the day one appears, every row in that table is a guess and this is what says so. `rbac-probe.sh`
remains the other half and answers a different question: whether the accounts, once real, actually
refuse what the table says they refuse.

### Still manual, and why

Two, both of them the same shape: a check that would have to judge intent rather than match a pattern.

- **What a caller passes as a rate-limit `identity`.** MC-07 proves the identity is digested and MC-03's
  sibling proves no service can read a client address — but a resolver that passed something inappropriate
  would produce a key indistinguishable from a correct one, because digesting is exactly what hides it. The
  line is held one level up, structurally: `app.proxy` stays off in all nine services, so there is no
  address in the process to pass. **Adding `app.proxy` is what to refuse**, not the call site.
- **Whether a tagged boundary test still tests its case.** The contract scanner reads `// AB-xx:` comments
  and cannot check the claim above one; a gutted test with its tag intact passes it. That is caught one
  gate later by mutation testing, and is the reason `thresholds.break: 100` is not negotiable — see
  *Mutation testing traps* below.

Two more things this list deliberately does **not** claim to cover. Neither is a gap to be closed by
another grep:

- **The audit was static.** MC-01..12 read source; none of them sends a request to a running platform.
  A hands-on run against a live platform did that once, and found two things every static check had passed
  over — the registration path storing `bcrypt(bcrypt(password))` among them. A green checklist is not a
  working system. ⚠️ **The general form is worth stating, because it is what kept that defect invisible for
  so long: a file-and-line citation proves the line exists, not that the path reaches it.**
  `LoginSubDocSchema`'s `pre('save')` and `registerNewUser`'s `encryptPassword` were each correct alone,
  and each carried a citation saying so. Running them together is the only thing that showed the double
  hash. A document that cites both is not therefore describing a working path, and no amount of
  cross-referencing between citations turns two static facts into one dynamic one.
- **A check that names a file proves the file exists, not that it is honest.** MC-05 and MC-10 are
  presence checks by construction; what makes them worth running is that the thing they look for is the
  thing a new repo forgets.

## Traps that make a green run lie

- ⚠️ **A vitest project with no matching files passes.** It collects nothing and reports success,
  indistinguishable from a suite that ran, while the repo still shows 100% coverage and a 100 mutation
  score. **Count the files, not the checkmarks.** Reference points: eight services carry 3–5
  `*.itest.mts`; `marketplace-dev-user-authenticated-authorization` carries 1.
- ⚠️ **v8 coverage only reports files it saw *loaded*, and `coverage.include` is the only thing that
  changes that.** Leave it null and the provider lists nothing a test did not `import`: a file no suite
  requires is absent from the report rather than sitting at 0%, so a 100% threshold passes vacuously
  over it. All fifteen gated packages set it, and MC-13 fails the run if one stops. ⚠️ **`coverage.all`
  is not that mechanism and never was on vitest 4** — it and `extension` were removed from
  `CoverageOptions`, an unchecked spread swallowed both, and ten configs carried them until 2026-09-06
  reading as though they were the gate. What `include` cannot reach is the other half: a
  `coverage.exclude` glob. `src/gql/**` exempts whatever is dropped into that directory next, silently,
  with the run still green — which is why every such file is now listed one per line in
  `coverage-exempt.txt`, and why MC-13 compares the two sets rather than trusting either.
  ⚠️ **And `include` is also the third hole (R56), because it decides both sides of that comparison.**
  A file whose extension no glob matches is absent from the report *and* absent from the list the
  report is compared against — a `.js` in an app whose globs say `.ts`, a stylesheet beside it — so
  nothing goes red for it. MC-13 therefore reads the *roots* of those globs too, everything before a
  pattern's first wildcard segment, and any tracked file under one of them that no glob matches has to
  be in `coverage-exempt.txt` by name. That scan found `marketplace-services-status/src/public/app.js`
  on its first run: 924 lines of browser code that no threshold had ever measured (**R60**).
  **Never read a percentage without the file count beside it.**
- ⚠️ **Unit tests that mock the model cannot see driver-level failures.** Two live bugs got through
  that way: Mongoose 9 refuses an array update unless `{ updatePipeline: true }` is passed, and Mongoose
  casts a query filter against the schema but casts **nothing inside a pipeline** — `GraphQLID` resolves
  to a *string*, so `{ $ne: ['$$this._id', '68b1…'] }` compares an ObjectId to a string, never matches,
  and answers `matchedCount: 1, modifiedCount: 0`. **Coerce with `new Types.ObjectId(…)` before any id
  enters a pipeline.** `funUserAddressDel` is the only pipeline update on the platform.
- ⚠️ **No test on this platform spans two services**, so every cross-repo value agreement is unenforced
  by construction — see [`docs/workflow.md`](./workflow.md), *Environment files*.
- ⚠️ **100/4 and mutation 100 do not distinguish "this branch is impossible" from "this branch is never
  driven".** A fully covered happy path sits next to an unexercised guard and the numbers stay green:
  `assertTier` was itself tested, and two of the three resource services never proved they *reached* it with
  the right expectation — the part a refactor breaks silently. That is why the boundary contract above
  enumerates cases by name rather than trusting the percentages, and why the mechanical checks above exist at all.
- ⚠️ **A service that fails its own required-env check can still exit 0.** `checkRequiredEnv()` throws
  outside `start()`'s try, so the throw reached only the entrypoint's `.catch`, which reported to a Sentry
  client that discards events when no DSN is configured — the state this platform boots in — and then let
  Node exit cleanly. Every restart policy reading the exit code saw a deliberate shutdown. The handler now
  logs to stderr and calls `process.exit(1)`. **A refusal that is not an exit code is not a
  refusal to anything watching the process.**
- ⚠️ **Removing a name from `REQUIRED_ENV_VARS` changes exactly one runtime behaviour — the service now
  boots without it — and that is enough to gut a test silently.** Two `startFailure.itest.mts` suites
  forced a boot refusal by deleting `PLATFORM_NAME`; once that name was dropped from the required
  list, both stopped refusing and connected to a real MongoDB instead, still green. They now delete a
  name the list still carries. **A test that proves a refusal must delete a variable the list still requires**,
  so shortening the list is never a comment-only change.

## Integration test conventions

Integration tests run against real infrastructure and must clean up after themselves.

- **Seed through the raw driver** (`mongoose.connection.db!.collection(…)`), not the Mongoose model.
  A model is a second description of a collection whose first description is the `$jsonSchema` validator
  in `marketplace-db-setup`, and the two can disagree: `ShopOwner` **used to** declare
  `personalData.birth.date` and no `contacts` at all while the validator demanded both. ⚠️ **That one is
  fixed** — the model has mirrored the validator field for field since `6d090c1` (2026-08-26), pinned by
  `marketplace-common/test/integration/models.int.test.mts` — and the convention outlives it, because
  **these databases carry no validator**. Nothing on the way in disagrees with a model-shaped seed, so
  the suite passes on a document the real collection would have refused. Since 2026-09-06 this is a lint
  rule rather than a convention (MC-23): `no-restricted-imports` refuses a `models/MongoDB/*` import
  under `test/integration/**` in all nine services, and nowhere else — unit tests mock those models by
  name, and `marketplace-common`'s own suite is where a model is the thing under test.
- **Register every `_id` and every Redis key in a module-level array at creation time**, and drain both
  in `afterAll`. Registering at creation rather than in a per-test `finally` matters: a seed that throws
  before its `try` block leaks the session key.
- **Watch the unique indexes when seeding** — `shopOwner.login.email`, `user.login.email`,
  `company.vatNumber`, `company.certifiedEmail`, `company.slug`, `item.{idCompany,slug}` **and**
  `itemCategory.slug`. A fixed literal collides on the second seed of the same run.
- **Redis is a cluster** — delete one key per `del` call; a multi-key `del` throws CROSSSLOT. Since
  2026-09-06 this is a lint rule rather than a convention (MC-22): the batched form is refused in all
  three spellings, in a cleanup block exactly as in a resolver.

## Per-repo integration database (ADR-023)

Every repo's integration suite owns its own MongoDB database, and **three variables must carry the same
string**: `MONGO_TEST_DB`, `MONGO_TEST_AUTH_ADMIN` and the database path of `MONGO_TEST_CONN_STRING`.
That string must be **unique to the repo** — each `globalSetup` drops its own database, so a shared name
means one suite wiping another's data mid-run. `vitest.mongo.mts` enforces the agreement
(`assertTestMongoDbNames`) and refuses to build a URL otherwise.

Because the authSource *is* the test database, the two `MONGO_TEST_*` users must exist in every one of
them — provision with the loop in `marketplace-db-setup/setup/mongodb.js`. Dropping a database does not
delete them; MongoDB keeps all users in `admin.system.users`.

Names: `dbMarketplaceTest` (db-setup), `…Common`, `…PublicAuthz`, `…PublicRes`, `…OwnerAuthz`,
`…OwnerRes`, `…AdminAuthz`, `…AdminRes`, `…UserAuthz`, `…UserRes`.
`marketplace-dev-authenticated-logout` has no block — its suite never touches Mongo. ⚠️ Renaming one of
these databases is never a one-file edit: the authSource *is* the database, so the two users have to be
created in the new one before any `.env` points at it, and the old one dropped afterwards.

## Per-repo Redis namespace, and the keygrip record it must hold

Each integration project also pins its own `REDIS_KEY` — `marketplaceDev:itest:<service>:` — for the same
reason the database name is unique: two suites sharing a prefix delete each other's keys. Since all nine
services refuse to boot without the ADR-034 record at `<REDIS_KEY>keygrip`, a namespace nothing seeded
makes `start()` exit 1 with `KEYGRIP_RECORD_MISSING`, and `yarn seed:keygrip` never writes into an itest
prefix. So each `globalSetup` seeds one itself, beside the throwaway database and as disposable.

- `marketplace-dev-admin-authenticated-resource` seeds a **real** record, wrapped with a throwaway KEK
  minted per run: it is the service that rotates, so its suite has to open what it wrote.
- The three other resource services seed an **opaque** one from `vitest.keygrip.mts` — 64 fixed bytes,
  base64. They hold no `KEYGRIP_KEK` and must not, and `assertRedisNamespace` reads presence only.

## Mutation testing traps

Stryker (`stryker.config.mjs`, `thresholds.break: 100`) runs as the second step of every
`.githooks/pre-push`, after coverage. Coverage asks whether a line *ran*; mutation asks whether a test
would have *failed* had that line been wrong.

- ⚠️ **A top-level `const` is evaluated once per process — the single trap behind most survivors here.**
  Stryker switches the active mutant **per test**, so any module loaded before the switch hands every
  test the *unmutated* value however thoroughly it is asserted. Shapes built inside a *function* body
  die on the first run because those re-execute per call. **Fix: evict the module from the loader cache
  inside the test** so the const re-evaluates under the active mutant — an `evictLib()` over
  `require.cache` under CommonJS (`test/migrationCalls.test.mjs`), a dynamic `await import()` in
  `beforeEach` under ESM. `beforeEach`, not `beforeAll`: a throw in `beforeAll` marks dependent tests
  *skipped*, and a skipped test is not a kill either.
- **A dead literal is a permanent survivor no test can ever kill.** A survivor in an
  exported-but-unimported const means the code is orphaned and the fix is to **delete it**.
- ⚠️ **Never add `ignoreStatic`.** It masks real gaps and deletes whole classes of mutant from the run.
  The survivor it appears to fix is usually a load-time mutant needing the dynamic-import fix above.
- **Silence a genuinely equivalent mutant with `// Stryker disable <Mutator>` plus a reason** — never by
  lowering `thresholds.break`. A `disable next-line` directive must be the **leading** comment of the
  mutant's own line: written as the last line of a multi-line comment it lands on the wrong line, and
  placed inside a `try` it never reaches the `catch`. Use the `disable` … `restore` range form there.
- **Reaching 100 means changing the code, never a threshold.** A guard no input can falsify is dead
  code; delete it and record the argument at the site.
