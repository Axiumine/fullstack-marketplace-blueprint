# ADR-013 — Everything is named in English, with no carve-out
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

The platform is one vocabulary across sixteen repos: a collection name appears in a migration, in a
`$jsonSchema` builder, in a model, in a resolver, in a GraphQL field, in three frontends and in every doc
that describes any of them. Nothing maps between those layers — a `grep` for a name is expected to find
all of them, and that expectation is what makes the polyrepo navigable at all (ADR-001).

So the naming language is not a style preference here, it is a structural property. A single name in a
second language is not a local blemish: it is a name that one layer spells differently from the others,
and the layer that reads it wrong is usually the database, where a strict `$jsonSchema` with
`additionalProperties: false` rejects the write rather than accepting a near-miss.

Forces:

- The owner and the first market are Italian, so the pull toward Italian domain words is real and
  constant: `partitaIva`, `codiceFiscale`, `ragioneSociale` are the words the paperwork actually uses,
  and each of them has a legal meaning that its English rendering does not carry by itself.
- The names are hardest to change exactly where they matter most. A collection name lives inside a
  migration, and every migration here creates a collection rather than altering one (ADR-014) — so a
  name is decided once, at creation, and changing it later means rewriting the create and rebuilding
  every database that ran it.
- Nothing translates. There is no ORM naming strategy, no GraphQL field alias layer and no i18n
  dictionary anywhere in these sixteen repos, so any second language is a second spelling that some
  layer has to keep straight by hand.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| English everywhere, no exceptions (**chosen**) | One spelling per concept across all sixteen repos; a reviewer needs no judgement call about which names are exempt, because none are; `grep` finds every layer | Some domain words lose the precision their Italian original carries, so a few fields need a comment saying exactly what they hold |
| English for code, the owner's language for domain-specific fields where it is more precise | Keeps the legal precision of `partitaIva` / `codiceFiscale` at the point where precision is legally load-bearing | Puts the second language in exactly the layer that cannot translate — a `$jsonSchema` key, a GraphQL field name, a migration; and "domain-specific enough" is a per-field judgement call with no defensible line, so the carve-out grows |
| Two vocabularies with a mapping layer — database in one language, code in another, translated at the ORM/resolver boundary | Each layer reads naturally in its own audience's language | A new permanent surface with its own bugs; Mongo shell inspection, `$jsonSchema` error strings and raw-driver seeding would all keep the database spellings while every service, resolver and doc uses the other set, so every debugging session crosses the boundary twice |

---

## Decision

**English everywhere, with no carve-out.** There is no field, no comment, no fixture and no locale
argument that licenses a second language into an identifier. Scope of the rule is everything:
collection names, field names, identifiers, function names, routes, UI text, comments, test fixtures,
migration files and docs. [`docs/devprotocol/phase2/UBIQUITOUS_LANGUAGE.md`](../../phase2/UBIQUITOUS_LANGUAGE.md) is the list of the names;
§19 Banned Terms states the rule as a ban rather than a preference.

Option 2 was rejected on where it puts the exception, not on how large it is. The fields it would carve
out — the registration block on `company` — are precisely the ones written into a `$jsonSchema`, a
migration, a model, a resolver and three frontends, so a carve-out there is a second spelling in every
layer that cannot translate. Option 3 was rejected because a mapping layer is a permanent new surface
bought for a platform with no legacy data forcing it: the two vocabularies would have to be kept in step
by hand, forever, by every future migration, seed script and raw-driver test.

**A name that loses precision in translation gets a comment, not a second language.** That is the whole
of the price this decision pays, and it is paid in one place: `UBIQUITOUS_LANGUAGE.md` §12 defines the
five registration fields on `company`, of which `legalName` (the registered name) and `publicName` (the
trading name) are the pair worth knowing, and the builder repeats the definition next to the field. A
comment saying what a field holds is strictly better than a foreign identifier that only a reader who
knows the source language can decode.

The locale a frontend formats dates with (`en-GB`) and the `default_language` a MongoDB text index stems
with (`english`) are market and algorithm choices rather than names. Both happen to be English, and
neither is a licence for anything around them.

```
// BEs/marketplace-db-setup/migrations/20260301000100-create-shopOwner.js
// Creates the `shopOwner` collection with its $jsonSchema validator, encryption and indexes.
```

That is what the rule looks like on disk: the migration that creates a collection spells its name the
same way the resolver, the GraphQL field and the frontend do, because there was never another spelling.

---

## Consequences

### Positive
- One vocabulary platform-wide: collection names, resolver names, GraphQL field names, UI strings and
  the migrations that created them all agree — a `grep` for `shopOwner` finds every layer.
- The split-vocabulary failure mode does not exist rather than being fenced off, because there is no
  second copy of a name anywhere for two spellings to disagree about.
- A reviewer needs no judgement call about which names are exempt: none are.
- Nothing needs a translation layer, so nothing can be out of date with one.

### Negative
- Some names are less precise than their Italian originals and rely on a comment to close the gap —
  `taxCode` and `vatNumber` say what they are, not which national register they come from.
- The rule has to be restated to every contributor, because the pull toward the local domain word is
  real and does not go away; it is stated in [`CLAUDE.md`](../../../../CLAUDE.md), here, and in `UBIQUITOUS_LANGUAGE.md` §19.

### Risks
- **Risk: a contributor introduces a non-English identifier because a domain word "has no good English
  equivalent".** Revisit trigger: any PR proposing one. The answer is a defined English name in
  `UBIQUITOUS_LANGUAGE.md` plus a comment explaining precisely what it holds — see §12, which does
  exactly that for the five registration fields on `company`.
- **Risk: a locale or stemming setting gets read as licence for non-English content.** Revisit trigger:
  any UI string or fixture in another language. A locale formats dates; it does not decide what language
  the product is written in.
- **Risk: the product is sold into a market whose users do not read English.** That is a UI translation
  question and not a naming one — it would mean an i18n layer over UI strings, and it must not reach
  identifiers, collection names or fields. Revisit trigger: a decision to ship a second UI language,
  which needs its own ADR stating that boundary explicitly.

---

## Compliance

Verify: a dictionary sweep of the tracked and untracked source of all sixteen repos should surface no
non-English word outside third-party vendor directories (`semgrep/vendor/`, lockfiles). A hit inside
`src/`, `migrations/`, `lib/schemas/`, a GraphQL schema slice, a test fixture or a doc is a violation.

Verify the database side specifically: every file under `BEs/marketplace-db-setup/migrations/` and
`BEs/marketplace-db-setup/lib/schemas/` reads as English, keys included. That is where a second language
is most expensive, because a collection is created once and its name is what every other layer spells.

Verify the rule is stated as a ban, not as a preference: [`docs/devprotocol/phase2/UBIQUITOUS_LANGUAGE.md`](../../phase2/UBIQUITOUS_LANGUAGE.md)
§19 must carry the non-English-identifier row. Removing it, or replacing it with a list of allowed
exceptions, is a violation of this decision rather than a clarification of it.

A violation looks like: a PR adding a field, collection, fixture or UI string in another language; a
migration introducing one; or a mapping/alias layer added anywhere to let two spellings coexist.
