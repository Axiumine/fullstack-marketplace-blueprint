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

## The auth-boundary contract (E18-S02)

Every authenticated service refuses the same set of things, and until this contract existed each one
decided for itself which of those refusals it tested. That is how the gap E18-S01 names appeared: three
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
