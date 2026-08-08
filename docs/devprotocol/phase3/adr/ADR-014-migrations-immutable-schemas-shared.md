# ADR-014 — Migrations are immutable, but their $jsonSchema shapes live in a shared lib/schemas/
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`marketplace-db-setup` runs migrate-mongo. Original rule: every migration self-contained — inline its own `validator` + `indexes`, never import a shared shape. Rationale: an edit to a shared helper retroactively changes what an already-applied, never-rerun migration means. Two databases with the same `changelog` could then hold different schemas, undetected.

That rule held while the platform carried a large set of near-identical product-type collections, plus separate collections for the shop and for catalogue sections — each restating a base validator inline. `BEs/marketplace-db-setup/lib/schemas/README.md` counts the cost: a dozen-plus identical product validators, 5 restatements of the shop collection, 3 of `shopOwner`, 2 of another product-type collection — roughly 3500 of the repo's 5100 migration lines were copies of another migration. Qodana reported four `DuplicatedCode` findings. No edit inside `migrations/` could clear them, because clearing duplication is exactly what the self-contained rule forbade.

Forcing function: the collections causing this duplication were dropped outright, replaced by a domain-neutral `item` + `itemCategory` pair (`docs/data-model.md`). The old duplication problem was gone with the collections that caused it, but the rule that produced the duplication was still in force for whatever replaced them — and the replacement work needed a second historical shape of `company` (`20260803000000-create-company` then `20260804010000-alter-company-public`), which is exactly the shape-reuse case the old rule blocked.

Constraint that actually licenses a change here: there is no unrebuildable database on this platform. `migrate-mongo-config.js` has no staging/production block — one `Dev` environment (`dbMarketplaceDev`) plus a throwaway `MONGO_TEST_*` database each suite drops on every run, both replayable from the migration files at will (`BEs/marketplace-db-setup/CLAUDE.md` §Prerequisites, §Testing).

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Keep restating every validator inline per migration (status quo) | No retroactive-meaning risk at all; a migration file is fully self-describing forever | 3500/5100 lines were copies; 4 unfixable `DuplicatedCode` findings; every new product type meant copy-pasting a ~270-line validator and re-auditing it for drift |
| Extract shapes to a shared `lib/schemas/` directory, each builder carrying every historical shape by flag, paid for with a full DB rebuild on every edit | Kills the duplication at the source (not the symptom); one builder is the one place a collection's whole history lives; cheap here because both databases are disposable and already get dropped/replayed by test tooling | An edit to a builder changes what every already-applied migration produced — invisible unless the databases are actually rebuilt; requires new discipline (never delete a flag branch a `down` still needs) |
| Version the shared shapes (e.g. `company.v1.js`, `company.v2.js`, no flags, no in-place edits) | Same duplication removal, but an old migration's import target never moves under it — closer to true immutability | Same multiplication problem one level down: a builder file per historical shape reproduces the "5 restatements of the shop collection" the extraction exists to remove; still needs a rebuild the first time a *bug* in an old shape must be fixed, so it buys less safety than it appears to |

---

## Decision

Chose row 2: extract to `lib/schemas/`, one builder per collection, historical shapes selected by flag (`validatorShopOwner({ emailVerify: true, position: true, note: true })` is today's shape; called with fewer flags it reproduces an earlier one — `BEs/marketplace-db-setup/lib/schemas/README.md` §How the builders carry history). Row 1 was rejected because it was the status quo actively producing unfixable findings, not a real alternative going forward. Row 3 was rejected because it re-creates the exact duplication problem in a different file layout — 5 restatements of `company` become 5 files instead of 5 inline blocks — without buying meaningfully more safety, since a real bug found in an old shape still forces a rebuild either way (nothing prevents editing `company.v1.js`).

The old rule's justification — a shared-helper edit retroactively changes an applied migration's meaning — is true in general but not load-bearing here, because its premise (an unrebuildable database) is false on this platform. So the rule is replaced, not broken: **a change under `lib/schemas/` is followed by a full rebuild of every database that has run these migrations — `yarn migrate:down` to empty, `yarn migrate:up` to replay — in the same piece of work, not later** (`BEs/marketplace-db-setup/lib/schemas/README.md` §Why this is allowed here). `migrations/` itself keeps the original immutability rule fully intact: never edit what an existing call site produces; adding a new flag so a *new* migration can express a *new* shape is normal, changing an existing flag's output is the same forbidden edit one file further away.

---

## Consequences

### Positive
- 4 `DuplicatedCode` Qodana findings cleared without touching `migrations/` — `BEs/marketplace-db-setup/lib/schemas/README.md` records the before/after scan (51 problems including 45 in a false-positive mongosh file, down to 6 `DuplicatedCode`, now 0).
- A new product type variant is a flag on an existing builder or a new small builder (`item.js`, `itemCategory.js`), not a ~270-line inline copy re-audited for drift.
- `company`'s second historical shape (`20260804010000-alter-company-public`, adding `publicName`/`slug`/`description`/`published`) reused `validatorCompany()` instead of re-inlining the whole legal-entity shape a second time.

### Negative
- A builder file is no longer "the current schema" — it is every shape the collection ever had, selected by flag, which is a harder read than one inline literal per migration (`lib/schemas/README.md` §How the builders carry history).
- Deleting a flag branch because "nothing current uses it" can silently break an old migration's `down` — only `grep -r <name> migrations/` returning zero hits licenses removal (the `COORDINATE_DECIMAL` case, same README).
- Every edit under `lib/schemas/` now carries a mandatory full-rebuild step that a plain `migrations/`-only change never needed.

### Risks
- **Risk: someone edits a builder and forgets the rebuild.** `dbMarketplaceDev`'s `changelog` would then disagree with what a fresh replay produces, and nothing local detects the drift automatically. Revisit trigger: any drift actually observed between a running `Dev` database and a fresh replay — would mean adding an automated shape-hash check to `test/migrations.test.mjs` rather than relying on discipline.
- **Risk: an unrebuildable database (staging or production) gets introduced.** The whole justification collapses the moment one exists. Revisit trigger: the day `migrate-mongo-config.js` gains a staging/production block — `lib/schemas/` freezes at that point and the pre-2026-08-03 inline-per-migration rule comes back (`lib/schemas/README.md` §Why this is allowed here, final paragraph).
- **Risk: a `collMod` restates only the `$jsonSchema` half of an `$and` validator** (`user`, `company` since `20260804010000`), silently dropping the `$expr` half. Not caught by the schema builder pattern itself. Revisit trigger: a dangling `user.defaultAddress` or an unpublished company with a slug observed in `Dev` — would mean a lint/test asserting every `collMod` call site restates both clauses.

---

## Compliance

Verify with:
- `grep -rn "validator" BEs/marketplace-db-setup/migrations/*.js` — every `create`/`alter` migration should call a builder imported from `../lib/schemas/*`, not inline a `$jsonSchema` literal. A literal validator object appearing directly in a `migrations/*.js` file is the violation.
- `git diff` scoped to `BEs/marketplace-db-setup/lib/schemas/` in a commit: the same piece of work must also touch `dbMarketplaceDev` (rebuild) or explain why not (e.g. a comment/doc-only change). No test enforces the rebuild itself — it is a process rule, not a CI gate.
- `yarn test` in `BEs/marketplace-db-setup` — `test/migrations.test.mjs` walks the full `up` ladder then unwinds `down` one rung at a time; a builder edit that breaks an older shape fails here first.
- `grep -r <flagOrConstName> BEs/marketplace-db-setup/migrations/` before deleting any flag branch from a builder — zero hits is the only condition that licenses removal (`lib/schemas/README.md` §"Nothing current uses it" and "no migration on disk references it" are different statements).
- Violation on disk looks like: a `$jsonSchema` object written directly inside a `migrations/<ts>-*.js` file instead of imported from `lib/schemas/`, or a `lib/schemas/` commit with no corresponding `dbMarketplaceDev` drop-and-replay in the same change.
