# ADR-014 — Migrations are immutable, but their $jsonSchema shapes live in a shared lib/schemas/
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`marketplace-db-setup` runs migrate-mongo over six collections — `admin`, `shopOwner`, `company`,
`user`, `itemCategory`, `item` — each with a strict `$jsonSchema` validator, `additionalProperties: false`
and its own index set.

The standing rule of migration tooling is that a migration must be **self-contained**: it inlines its own
`validator` and `indexes` and imports no shared shape, because an edit to a shared helper retroactively
changes what an already-applied, never-rerun migration means. Two databases reporting the same `changelog`
could then hold different schemas, with nothing detecting it.

Applied literally here, that rule has a price this platform pays in full:

- Three of the six collections are things you log in as. `admin`, `shopOwner` and `user` share the whole
  credential shape — a bcrypt hash pinned at exactly 60 characters, a deterministically encrypted
  `login.email` with its unique index, the reset-password and email-verification blocks. Role on this
  platform is *which collection you authenticate against* (ADR-002), so this is not incidental overlap:
  the three genuinely have one login.
- Three of the six carry a street address, and each one carries the same GeoJSON point inside it —
  `coordinates: [<lng>, <lat>]`, longitude bounded ±180, latitude ±90, `['double', 'int', 'long']`.
  Restated inline three times, a swapped axis order in one of them is a difference no reader can see and
  no validator can reject, since both orders are well-formed.
- Which fields are ciphertext differs per collection but the *way* a field becomes ciphertext does not
  (ADR-029): `bsonType: 'binData'` and the loss of every `maxLength`, `minLength` and `pattern` that went
  with it.

Qodana runs over this repo at critical 0 / high 0, and `DuplicatedCode` is one of the inspections it
raises. Under a strict self-contained rule no edit inside `migrations/` can ever clear such a finding,
because removing the duplication is precisely what the rule forbids.

Constraint that licenses reconsidering it: **there is no unrebuildable database on this platform.**
`migrate-mongo-config.js` has no staging or production block — one `Dev` environment (`dbMarketplaceDev`)
plus the throwaway `MONGO_TEST_*` database each suite drops on every run, both replayable from the
migration files at will (`BEs/marketplace-db-setup/CLAUDE.md` §Prerequisites, §Testing).

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Restate every validator inline, one per migration (the textbook rule) | No retroactive-meaning risk at all; a migration file is fully self-describing forever | The login shape written out three times and the geo point three times, with drift between copies invisible; `DuplicatedCode` findings unfixable by construction; every new collection is a copy-paste of a long literal that must then be re-audited against the one it was copied from |
| Extract the shapes to `lib/schemas/`, one builder per collection returning exactly one shape, paid for with a full database rebuild whenever a builder changes | Kills the duplication at its source; one builder is the single place a collection's shape lives, so the login rule and the axis order exist once and cannot drift; cheap here, because both databases are disposable and the test tooling already drops and replays them | An edit to a builder changes what an already-applied migration produced, and that is invisible unless the databases really are rebuilt; the rebuild becomes a discipline nothing in CI enforces |
| Version the shared shapes (`company.v1.js`, `company.v2.js`, never edited in place) | Duplication removed, and an old migration's import target never moves under it — closer to true immutability | Reproduces the multiplication one level down: N historical shapes become N files instead of N inline blocks; and it buys less than it looks, since fixing a real bug in an old shape still forces a rebuild — nothing stops someone editing `company.v1.js` |

---

## Decision

**Row 2.** Shapes live in `lib/schemas/`, one builder per collection. `migrationCreation(collection,
validator, indexes)` is the only export of `lib/schemas/collection.js` and is the whole body of every
`<ts>-create-<coll>.js`.

Two rules make that safe, and they are one decision, not two:

**Every migration creates a collection; none alters one.** Six creates plus one optional demo seed. There
is no `collMod` in this repository and no `<ts>-alter-<coll>.js`, so a collection is declared once, in its
final shape — validator, encryption and every index in one call. That is what lets a builder return
**one** shape and take no arguments: there is no earlier version for it to reproduce, and no `down` that
has to walk back to one. `migrations/` then reads as the schema the database has rather than as the sum of
a ladder, and nobody has to replay six files in their head to learn what a field is today.

**A change under `lib/schemas/` is followed by a full rebuild of every database that has run these
migrations — `yarn migrate:down` to empty, `yarn migrate:up` to replay — in the same piece of work, not
later** (`BEs/marketplace-db-setup/lib/schemas/README.md` §Why sharing a shape is allowed here).

So the textbook rule is replaced rather than broken. Its justification — a shared-helper edit silently
rewrites history — is true in general and not load-bearing here, because its premise, an unrebuildable
database, is false on this platform. And a builder edit cannot reach a live database by itself in any
case: `createCollection` does not run twice, so it lands only through a replay.

Immutability itself keeps its full force in the form that still applies: **never edit a migration that may
already be applied somewhere it cannot be replayed.** As long as every such database can be dropped,
correcting a shape means correcting the create and rebuilding in the same change.

Row 1 was rejected because the duplication it mandates is not a cost paid once — it is a copy of the login
rule and of the axis order per collection, each free to drift, plus a class of static-analysis finding
that can never be cleared. Row 3 was rejected because it recreates that same multiplication in a different
file layout while buying no real extra safety.

---

## Consequences

### Positive

- The credential shape exists once (`lib/schemas/account.js`), the address block once (`geo.js`), the
  ciphertext seam once (`encrypted.js`). A change to what a password or a login email is happens in one
  place, and cannot half-land.
- The GeoJSON point is built inside `geo.js` and is not exported. Every collection that stores a position
  stores the *same* position, and the axis order is not something a new collection can get wrong.
- A migration file is short enough to read in one screen: an import, a `COLLECTION` constant, an `indexes`
  array and one `migrationCreation()` call. What is *specific* to that collection is exactly what is
  visible in it.
- A new collection is a builder plus one `<ts>-create-<coll>.js`, not a long inline literal re-audited
  against the one it was copied from.

### Negative

- Every edit under `lib/schemas/` carries a mandatory full-rebuild step that a `migrations/`-only change
  would never have needed.
- The shape of a collection is one file away from the migration that installs it, so reading a migration
  alone no longer tells you the whole schema.
- Nothing in CI enforces the rebuild. It is a process rule.

### Risks

- **Risk: someone edits a builder and skips the rebuild.** `dbMarketplaceDev` then disagrees with what a
  fresh replay produces and nothing local detects the drift. Revisit trigger: any drift actually observed
  between a running `Dev` database and a fresh replay — would mean a shape-hash assertion in
  `test/migrations.test.mjs` rather than relying on discipline.
- **Risk: an unrebuildable database (staging or production) gets introduced.** The whole justification
  collapses the moment one exists. Revisit trigger: the day `migrate-mongo-config.js` gains a staging or
  production block. At that point `lib/schemas/` freezes, the create-only rule ends, and the first
  altering migration needs a `collMod` helper that deliberately does not exist yet.
- **Risk: the first `collMod` restates only the `$jsonSchema` half of an `$and` validator.**
  `validatorUser()` and `validatorCompany()` both return `$and: [{ $jsonSchema }, { $expr }]`, and a
  validator is replaced wholesale rather than merged — so passing the schema half alone silently drops the
  `$expr` rule, and nothing fails until a dangling `user.defaultAddress` or a published company with no
  slug is written weeks later. The builders return the pair and nothing else precisely so there is no way
  to obtain half of one. Revisit trigger: the first `collMod` on the platform — it needs a test asserting
  every call site restates both clauses.

---

## Compliance

Verify with:

- Must return nothing — a `$jsonSchema` literal written directly in a migration, or a `collMod` call,
  is the violation. Comment lines are excluded on purpose: several migrations *discuss* both, and a
  check that cannot tell prose from code is a check nobody runs twice.

```bash
grep -rnE '(collMod|\$jsonSchema)' BEs/marketplace-db-setup/migrations/ | grep -vE ':[0-9]+:\s*(//|\*)'
```

- `ls BEs/marketplace-db-setup/migrations/` — every file is `<ts>-create-<coll>.js` apart from the single
  `<ts>-seed-demo.js`. A `<ts>-alter-*.js` filename is the violation.
- `grep -rn "module.exports" BEs/marketplace-db-setup/migrations/*-create-*.js` — each must export the
  result of one `migrationCreation()` call.
- `grep -rn "function validator" BEs/marketplace-db-setup/lib/schemas/*.js` — every builder takes zero
  arguments. A flag parameter selecting between shapes is the violation: it means a historical variant is
  being carried, which the create-only rule exists to make unnecessary.
- A commit touching `BEs/marketplace-db-setup/lib/schemas/` must also drop and replay `dbMarketplaceDev`
  in the same piece of work, or be doc-only. No test enforces this — it is a process rule, not a CI gate.
- `yarn test` in `BEs/marketplace-db-setup` — `test/migrations.test.mjs` applies every migration against a
  real MongoDB and asserts the whole of every validator and every index, so a builder edit that breaks a
  collection fails there first.
