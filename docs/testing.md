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
| AB-08 | a valid `x-introspectioncode` is accepted with no credential at all, and reads no session |
| AB-09 | a wrong `x-introspectioncode` is refused |
| AB-10 | no `x-introspectioncode` at all leaves the ordinary refusal exactly as it is |
| AB-11 | a valid `x-introspectioncode` is refused outside the environment allowlist, indistinguishably from none |

**How a service answers.** A `// AB-xx: <the case>` comment sits above the test that proves it, and
`test/authBoundaryContract.test.mts` reads that service's own boundary suite and fails when a required tag
is absent. Seven such files exist, one per authenticated service, each naming itself with a hardcoded
`SERVICE` constant — `requiredAuthBoundaryCases()` **throws** on a name it does not know, so a typo fails
the suite instead of quietly asking for no cases at all, and a *new* service cannot ask what it owes until
somebody adds it to the contract. The scanner reads test files only, which is what keeps it out of
Stryker's way: Stryker instruments `src/`.

| Service | Owes | Excused, and why |
|---|---|---|
| `marketplace-dev-authenticated-resource` | AB-01..06, 08..11 | AB-07 — reads an access session, mints nothing, so has no token to replay |
| `marketplace-dev-admin-authenticated-resource` | same | same |
| `marketplace-dev-user-authenticated-resource` | same | same |
| `marketplace-dev-authenticated-authorization` | all eleven | — |
| `marketplace-dev-admin-authenticated-authorization` | all eleven | — |
| `marketplace-dev-user-authenticated-authorization` | all eleven | — |
| `marketplace-dev-authenticated-logout` | AB-01, 04, 05, 06, 08..11 | AB-02, AB-03 — the one service serving all three tiers (ADR-005): it finds a session by token content alone and asserts no tier. AB-07 — deletes the tokens it is given and mints none |

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
| MC-09 | every authenticated service proves all eleven boundary cases it owes | `yarn test` | `test/authBoundaryContract.test.mts`, seven services + the contract's own suite |
| MC-10 | the seven boundary suites exist at all | `./scripts/audit-check.sh` §5 | workspace root |
| MC-11 | no `.env`, `.npmrc` or `*.pem` value is staged | `git commit` | the secret guard in every `.githooks/pre-commit` |
| MC-12 | no dependency with a known advisory, no vulnerable transitive | `git push` | `trivy fs` in `aquasec/trivy:0.70.0`, HIGH + CRITICAL, production tree only — the `pre-push` hook of the fourteen repos with a `yarn.lock` plus the parent's, per [`README.md`](../README.md). ⚠️ **Qodana is not part of this row**: the inspection every `qodana.yaml` arms queries no advisory feed and reports zero everywhere |

⚠️ **`./scripts/audit-check.sh` exists because no test on this platform spans two repos.** Four of its
five checks are claims about *sixteen* repos agreeing — a key built in the wrong one, a lint block missing
from one, a boundary suite absent from one — and a vitest suite in any single repo is structurally unable
to see them. It reads only: no writes, no installs, no containers.

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
- ⚠️ **v8 coverage only reports files it saw *loaded*.** A file no suite requires is absent from the
  report rather than listed at 0%, so a 100% threshold passes vacuously over it. Check the file list,
  not just the percentages.
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
  list, both stopped refusing and connected to a real MongoDB instead, still green. They now delete
  `INTROSPECTION_CODE`. **A test that proves a refusal must delete a variable the list still requires**,
  so shortening the list is never a comment-only change.

## Integration test conventions

Integration tests run against real infrastructure and must clean up after themselves.

- **Seed through the raw driver** (`mongoose.connection.db!.collection(…)`), not the Mongoose model.
  Several models disagree with their collection's `$jsonSchema` — `ShopOwner` declares
  `personalData.birth.date` and no `contacts`, while the validator wants `birth.date` plus `contacts`.
- **Register every `_id` and every Redis key in a module-level array at creation time**, and drain both
  in `afterAll`. Registering at creation rather than in a per-test `finally` matters: a seed that throws
  before its `try` block leaks the session key.
- **Watch the unique indexes when seeding** — `shopOwner.login.email`, `user.login.email`,
  `company.vatNumber`, `company.certifiedEmail`, `company.slug`, `item.{idCompany,slug}` **and**
  `itemCategory.slug`. A fixed literal collides on the second seed of the same run.
- **Redis is a cluster** — delete one key per `del` call; a multi-key `del` throws CROSSSLOT.

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
