# ADR-013 — Everything is named in English, and a naming sweep may rewrite applied migrations in place
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

The platform is one vocabulary across fifteen repos: a collection name appears in a migration, in a
`$jsonSchema` builder, in a model, in a resolver, in a GraphQL field, in three frontends and in every doc
that describes any of them. Nothing maps between those layers — a `grep` for a name is expected to find
all of them, and that expectation is what makes the polyrepo navigable at all.

So the naming language is not a style preference here, it is a structural property. **Everything is
English** — collection names, field names, identifiers, function names, routes, UI text, comments, test
fixtures, migration files. A single name in a second language is not a local blemish: it is a name that
one layer spells differently from the others, and the layer that reads it wrong is usually the database.

Forces:

- Applied migrations are supposed to be immutable (`BEs/marketplace-db-setup/lib/schemas/README.md`
  "Why this is allowed here" section) — a later edit retroactively changes the meaning of a migration
  that already ran. Normal rule: never edit one, add a new one instead.
- But collection and field names live INSIDE those already-applied migrations
  (`BEs/marketplace-db-setup/migrations/20260301000000-create-admin.js`,
  `20260301000100-create-shopOwner.js`, and 13 others). A platform-wide naming correction applied only
  via new migrations would leave the historical files spelling names the code no longer uses — the code
  saying one thing and the migration history another, permanently.
- No production, no staging exists on this platform. `lib/schemas/README.md`: "There is one environment,
  `Dev`, plus the throwaway `MONGO_TEST_*` database each suite drops on every run... The owner can drop
  and replay both databases from these files at will, and does." The one condition that makes migration
  immutability necessary — a database out there that cannot be rebuilt — does not hold here.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Rewrite applied migrations in place, rebuild every DB that ran them | Migration history reads as if the collection was always called what it is called now; no permanent split between code and history; zero legacy databases exist to break | Breaks the "migrations are immutable" rule — the one time it has ever been broken here |
| Add new migrations on top (rename collections/fields via `collMod`/`renameCollection`, leave old migrations untouched) | Immutability rule stays intact everywhere, no exception carved | Every applied migration file permanently narrates the platform under names nothing else uses; more migration files than the correction needs |
| Correct identifiers in code only, leave DB collection/field names as they were, map at the ORM/resolver boundary | No migration touched at all, immutability rule untouched | Two vocabularies forever — Mongo shell inspection, `$jsonSchema` error strings and raw driver seeding (`marketplace-db-setup` `README.md`/integration test convention) would keep the old spellings while every service, resolver and doc uses the new ones; the mapping layer is a new permanent surface with its own bugs |

---

## Decision

**English everywhere, with no carve-out.** There is no field, no comment, no fixture and no locale
argument that licenses a second language into an identifier. `docs/devprotocol/phase2/UBIQUITOUS_LANGUAGE.md`
is the list of the names; §19 Banned Terms states the rule as a ban.

When a naming correction has to reach names that already live in applied migrations, rewrite those
migrations in place — option 1 — and pay for it with a full rebuild of every database that had run them,
in the same piece of work: `dbMarketplaceDev` dropped and replayed with `SEED_DEMO=true`, plus each
repo's own integration database, which its `globalSetup` drops on every run regardless
(`docs/data-model.md` §Migrations).

This is the one exception to migration immutability on the whole platform, and it is only affordable
because of the environment fact stated above: zero permanent databases exist that the rewrite could
silently desynchronize. `lib/schemas/README.md`'s own argument for keeping the rule elsewhere is "that
argument depends on a database existing that cannot be rebuilt. On this platform none does" — the same
reasoning applies to a naming sweep, not just to the general shared-builder design. Option 2 was rejected
because it leaves every migration file — permanent, since migrations are otherwise never edited — spelling
names nothing else uses, i.e. the split option 1 avoids becomes permanent instead of one-time. Option 3
was rejected because it creates a second vocabulary at the DB layer that every future migration, seed
script and raw-driver test would have to keep straight against the code layer, forever, for a platform
with no legacy data forcing that cost.

Scope of the rule: identifiers, collection names, field names, routes, UI text, comments, test fixtures —
everything. The locale a frontend formats dates with (`en-GB`) and the `default_language` a MongoDB text
index stems with (`english`) are market choices rather than names, and they are English too; neither is a
licence for anything around them.

```
// BEs/marketplace-db-setup/migrations/20260301000100-create-shopOwner.js
// Initial schema migration for the `shopOwner` collection.
// Creates the collection with its $jsonSchema validator + indexes.
```

That comment is what "reads as if the collection had never been called anything else" looks like on
disk.

---

## Consequences

### Positive
- One vocabulary platform-wide: collection names, resolver names, GraphQL field names, UI strings, and
  the migration history that produced them all agree — a `grep` for `shopOwner` finds every layer.
- Removes the split-vocabulary failure mode entirely rather than fencing it off, because there is no
  second copy of the schema anywhere for two spellings to disagree about.
- A reviewer needs no judgement call about which names are exempt: none are.

### Negative
- The migration immutability rule now has a documented exception instead of being absolute — every future
  reader of `lib/schemas/README.md` has to understand *why* that one rewrite was safe instead of relying
  on a blanket "never" rule.
- A naming sweep of this kind touches every repo in the platform in one coordinated pass, so it is never
  an isolated, revertable change: it lands as N commits, one per repo, and it is only complete when the
  databases have been rebuilt too.

### Risks
- **Risk: a second permanent database appears (staging/production) before another schema-shape edit is
  needed.** Revisit trigger: the day `migrate-mongo-config.js` gains a second environment block, the
  "no database exists that cannot be rebuilt" argument stops holding, and any future in-place migration
  edit — naming or otherwise — needs a new ADR before it happens again.
- **Risk: a contributor introduces a non-English identifier because a domain word "has no good English
  equivalent".** Trigger for revisit: any PR proposing one. The answer is a defined English name in
  `UBIQUITOUS_LANGUAGE.md` plus a comment explaining precisely what it holds — see §12, which does exactly
  that for the five registration fields on `company`.
- **Risk: a locale or stemming setting gets read as licence for non-English content.** Trigger for
  revisit: any UI string or fixture in another language. A locale formats dates, it does not decide what
  language the product is written in.

---

## Compliance

Verify: a dictionary sweep of the tracked and untracked source of all fifteen repos should surface no
non-English word outside third-party vendor directories (`semgrep/vendor/`, lockfiles). A hit inside
`src/`, `migrations/`, `lib/schemas/`, a GraphQL schema slice, a test fixture or a doc is a violation.

Verify the migration side specifically: every file under `BEs/marketplace-db-setup/migrations/` should
read as English — check the two oldest, `20260301000000-create-admin.js` and
`20260301000100-create-shopOwner.js`, since if a sweep reached those it reached everything applied after.

Verify the rule is stated as a ban, not as a preference: `docs/devprotocol/phase2/UBIQUITOUS_LANGUAGE.md`
§19 must carry the non-English-identifier row. Removing it, or replacing it with a list of allowed
exceptions, is a violation of this decision rather than a clarification of it.

A violation looks like: a PR adding a field, collection, fixture or UI string in another language, or a
migration file (new or edited) that introduces one.
