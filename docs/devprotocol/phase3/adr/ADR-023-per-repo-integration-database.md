# ADR-023 — Every repo integration suite owns its own MongoDB database, named identically in three variables
# Marketplace

**Status:** accepted
**Date:** 2026-08-07
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

10 repos run integration suites against real Mongo: `marketplace-common`, `marketplace-db-setup`, and 8 of
the 9 backend services (`marketplace-dev-authenticated-logout` excluded — its suite never touches Mongo,
per [`docs/testing.md`](../../../testing.md) §Per-repo integration database). Each `globalSetup.mts` DROPS its test database and replays
migrations before the suite runs — verified at
`BEs/dev/marketplace-dev-authenticated-resource/test/integration/globalSetup.mts:60`
(`await db.dropDatabase()`).

Naming that database takes 3 separate env vars, not 1: `MONGO_TEST_DB` (what mongoose dials, what
`globalSetup` drops), `MONGO_TEST_CONN_STRING` (its path segment — what any non-mongoose client dials),
`MONGO_TEST_AUTH_ADMIN` (authSource — the two `MONGO_TEST_UDBOWNER`/`MONGO_TEST_UDBRW` users are defined
per-database, not globally, per `BEs/marketplace-common/vitest.mongo.mts:51-67`). 3 vars, 3 places to
drift, and the drift is silent by default: rebuilding the URL path from `MONGO_TEST_DB` alone makes a
`MONGO_TEST_CONN_STRING` naming a different database still produce a URL that connects fine — pointed at,
and about to drop, a database its own connection string never named (`BEs/marketplace-common/vitest.mongo.mts`
comment).

Cross-repo, the databases must all be distinct — `dbMarketplaceTest` (db-setup), `…Common`, `…PublicAuthz`,
`…PublicRes`, `…OwnerAuthz`, `…OwnerRes`, `…AdminAuthz`, `…AdminRes`, `…UserAuthz`, `…UserRes` (`docs/testing.md` §Per-repo integration database) — confirmed on disk: `MONGO_TEST_AUTH_ADMIN=dbMarketplaceTestOwnerRes` and
`MONGO_TEST_DB=dbMarketplaceTestOwnerRes` in
`BEs/dev/marketplace-dev-authenticated-resource/env:51,61`. Users are provisioned per test-db name in a
loop in `BEs/marketplace-db-setup/setup/mongodb.js:63-69`; dropping a database does not delete its users,
Mongo keeps them in `admin.system.users` regardless of which db authenticated them.

No test on this platform spans 2 services — every cross-repo value agreement (db names, but also
`KEYGRIP_KEY_1/2`, `REDIS_KEY`) is therefore unenforced by construction. That is what let both
`*-user-authenticated-*` services' `.env` files stay copies of an unrelated older project — 5
`MONGO_TEST_*` keys empty (loud), 3 more populated and wrong (silent), and a mismatched `KEYGRIP` pair that
broke every customer refresh while both repos' suites stayed green (`docs/workflow.md` §Environment files).
Found only by a salted-hash fingerprint sweep across all 9 `.env` files, not by reading any single one.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Assert 3-var agreement at `globalSetup` time, fail closed (chosen) | Catches a mismatch before any drop; error names which var disagrees (`vitest.mongo.mts:73-85`) | Only covers same-repo agreement — a wrong-but-internally-consistent trio still passes; adds a required check every repo must call |
| Silently rebuild the URL from `MONGO_TEST_DB` alone (the prior behavior) | Fewer required vars to keep in sync, no throw to handle | Exactly the bug it replaced — a divergent `MONGO_TEST_CONN_STRING` drops the wrong database with no error, discoverable only by noticing data loss after the fact |
| One shared test database across all repos | 1 db, 1 pair of users to provision, no per-repo naming discipline | `fileParallelism: false` only serializes tests *within* one repo's run — nothing stops repo A's `globalSetup.dropDatabase()` firing mid-run of repo B's suite; this is the isolation [`docs/testing.md`](../../../testing.md) §Per-repo integration database says the distinct-name convention exists to prevent |
| Doc-only convention, no runtime assertion | Zero code | The exact failure class that actually happened: an env file copied wholesale from an unrelated project passes every local check because nothing compares it against anything else — required a manual fingerprint sweep to find, not a gate |

---

## Decision

Row 1: runtime-assert the 3-var trio at connection-build time, refuse to hand back a URL on mismatch.
`assertTestMongoDbNames()` (`BEs/marketplace-common/vitest.mongo.mts:69-86`) throws naming the exact
disagreeing pair (`MONGO_TEST_CONN_STRING` vs `MONGO_TEST_DB`, or `MONGO_TEST_AUTH_ADMIN` vs
`MONGO_TEST_DB`) before `buildTestMongoUrl` returns anything `globalSetup` could connect with. Chosen over
row 2 because row 2 is what this replaced, and the failure mode is not "test fails" — it is "test passes,
having dropped a database its own connection string never named." Chosen over row 3 because
`fileParallelism: false` is a per-repo vitest setting with no cross-repo reach — a shared db reintroduces
the exact concurrent-drop hazard 8 distinct database names exist to avoid. Chosen over row 4 because row 4
is the pattern that let the `*-user-authenticated-*` `.env` corruption ship: nothing local disagreed with
itself, so nothing local caught it.

What this decision does **not** cover, on purpose, because a single-repo `globalSetup` structurally cannot
check it: agreement *between* repos (matching `REDIS_KEY` across all 9; matching cookie-signing
keys across the authorization services, until ADR-034 took that pair out of the environment entirely and
made a wrong `KEYGRIP_KEK` a refused boot). That gap is real, already bit once, and its mitigation is the
fingerprint sweep, not a per-repo assertion — recorded here so it is not re-discovered as a surprise.

---

## Consequences

### Positive
- A misconfigured `.env` in one repo fails loud at `globalSetup`, before `dropDatabase()` runs, naming the
  exact variable that disagrees.
- 10 distinct database names make a concurrent cross-repo test run (e.g. CI running several suites at once)
  safe from one repo's drop nuking another's fixtures.
- The error message doubles as the fix instruction (`vitest.mongo.mts:33-37`): copy users from
  `marketplace-db-setup/.env`, then set the 3 vars to the repo's own name.

### Negative
- 3 vars per repo instead of 1 — every new integration-suite repo must remember to keep all 3 in sync, by
  hand, with no shared source.
- The assertion only proves internal consistency. A `.env` wrong in a way that is internally consistent
  (all 3 vars agree, but the value is copied from the wrong project) still passes. That is the residual
  failure mode this decision does not close, and nothing else does either.
- Adds one more required-env check to `globalSetup`, on top of `assertTestMongoEnv`'s presence check.

### Risks
- **A future repo picks a `MONGO_TEST_DB` value already used by an existing repo.** Nothing at write time
  stops it — `assertTestMongoDbNames` checks internal agreement, never global uniqueness. Revisit if
  `grep -h '^MONGO_TEST_DB=' BEs/**/env BEs/*/env` ever shows a duplicate value.
- **Cross-repo secret/env agreement stays unenforced by construction**, same class as the KEYGRIP incident,
  for any value this ADR's check does not reach (`REDIS_KEY`, `KEYGRIP_KEY_1/2`, `REDIS_PASSWORD`
  pairing). Revisit if a second cross-repo drift incident happens — that would be the signal a scheduled
  fingerprint sweep needs to become a gate rather than a one-off audit.
  ⚠️ **Amended 2026-08-13.** `KEYGRIP_KEY_1/2` left this list by ceasing to exist: **ADR-034**
  moved the signing keys into one wrapped Redis record, so the value that caused the incident this bullet
  names is no longer a per-repo env value at all. The revisit trigger stands for the two that are.
- **A per-machine `.env` silently reverts to a stale copy** (e.g. a workstation reset, a bad `cp`). The
  3-var assertion still passes if the stale copy is internally consistent; only a fingerprint sweep against
  the other 9 repos would catch it.

---

## Compliance

Verify per-repo: run that repo's `yarn test:int` (or `test:cov` for suites that fold integration in) and
confirm a deliberately mismatched `MONGO_TEST_CONN_STRING` throws from `assertTestMongoDbNames` rather than
connecting. The throw site is `BEs/marketplace-common/vitest.mongo.mts:73-85`; every consuming repo's own
`vitest.mongo.mts` copy is the same file, near-duplicated per [`docs/workflow.md`](../../../workflow.md) §This directory is the parent workspace ("Cross-
service shell scripts are near-duplicates").

Verify cross-repo uniqueness by name, not by running anything:
`grep -h '^MONGO_TEST_DB=' BEs/marketplace-db-setup/env BEs/marketplace-common/env BEs/dev/*/env | sort | uniq -d`
must return nothing. A violation on disk looks like: a repo's `env` template with `MONGO_TEST_DB`,
`MONGO_TEST_AUTH_ADMIN` and the path segment of `MONGO_TEST_CONN_STRING` not all equal (the case the
assertion throws on), or two repos' `env` templates sharing one `MONGO_TEST_DB` value (the case nothing
throws on — grep is the only check). Cross-repo secret agreement (KEYGRIP, REDIS_PASSWORD) is not
verified by any of the above — that requires the salted-hash fingerprint sweep described in [`docs/workflow.md`](../../../workflow.md) §Environment files, re-run by hand, not by a committed script as of this date.
