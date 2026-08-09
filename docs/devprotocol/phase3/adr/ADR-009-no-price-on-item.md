# ADR-009 — item carries no price field until ordering is designed
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`item` is the platform's domain-neutral catalogue collection (ADR-008). Builder
`BEs/marketplace-db-setup/lib/schemas/item.js`, migration
`BEs/marketplace-db-setup/migrations/20260301000500-create-item.js`. Strict `$jsonSchema`,
`additionalProperties: false`.

No cart, order, delivery or payment collection exists anywhere in
`BEs/marketplace-db-setup/migrations/` — zero files match `order`/`cart` in that directory. No
model, no resolver, no state machine for any of the four. `CLAUDE.md` names them "genuinely new
design with no existing model to copy — ask before inventing them." A `price` field is the one piece
of that undesigned commerce tier that would otherwise land on `item` by habit.

Forces:
- A price is not a bare number. It drags a currency, a precision/rounding rule, a VAT treatment and a
  discount model behind it — four decisions, none made.
- `Decimal128` is the correct BSON type for money and is already a **rejected write** on this
  platform: resolvers use `.lean()`, mongoose getters never run, and `GraphQLFloat.serialize(Decimal128)`
  throws — documented in the header comment of `lib/schemas/item.js` and in
  `BEs/marketplace-db-setup/CLAUDE.md` under *Naming* → geo `position`, where the same type on a
  coordinate answers 500 on every call for the same reason.
- Nothing reads a price today. `item` has no `Cart`/`Order` consumer, so a `price` field would sit
  unused — the platform's own convention (`published`, `deleted`) is that a field earns its place by a
  reader that needs it, argued field-by-field in `docs/data-model.md`.
- `CONSTRAINTS.md` §5 states this outright as an out-of-scope boundary for the current build phase:
  "Price on `item` — deliberately absent, the header comment in
  `BEs/marketplace-db-setup/lib/schemas/item.js` says why. Do not add 'just a field'."

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A. Add `price` now as `Float`/`Number` | Unblocks any UI wanting to show a number today; cheapest schema change | `Float` loses precision for money (binary rounding); still guesses currency and VAT with no consumer to validate the guess against; a later correct type means rewriting the create migration's shape plus the full-database-rebuild cost `lib/schemas/README.md` requires for any `lib/schemas/` change (ADR-014) |
| B. Add `price` now as `Decimal128` (correct money type) | Right precision, matches how a real price should be stored | Already a *known-broken* write path on this platform — `.lean()` + `GraphQLFloat.serialize(Decimal128)` throws, same class of bug the geo-position fix in `BEs/marketplace-db-setup/CLAUDE.md` had to work around; still no currency/VAT/discount design; adds a field with zero readers |
| C. Defer — ship `item` with no price field, design it together with `Cart`/`Order`/`Payment` when that tier is built | Matches the platform's existing "field earns its place by a reader" convention (`published`, `deleted`); avoids shipping a type known to break the `.lean()`→GraphQL path; no debt from an undesigned currency/VAT/discount decision baked into a strict-schema collection | Storefront cannot display a price today; any commerce demo waits on the ordering tier; whenever it does land, the shape and the rebuild are paid then rather than now (ADR-014) |

---

## Decision

Option C. `item` is created with **no `price` field**, its required list is
`idCompany, idCategory, name, description, slug, published`, and `additionalProperties: false`
rejects any write that adds one outside a migration.

The reasoning is the type problem, not just the missing design: Option B is not merely "premature", it is
the same failure mode this codebase already paid for once — a BSON type that cannot survive `.lean()` into
GraphQL — so adding it now would ship a field that is broken from the first read, not just unused. Option A
avoids that specific break but replaces it with a silent one: a `Float` price stored today is the wrong
type the moment currency/VAT/discount are actually designed, and fixing the type is exactly the kind of
`lib/schemas/` edit that forces a full rebuild of every database that ran the migrations (ADR-014,
`BEs/marketplace-db-setup/CLAUDE.md` → *Authoring migrations*). Option C pays that shape-plus-rebuild
cost once, at design time, instead of twice.

---

## Consequences

### Positive
- Catalogue ships now without blocking on the undesigned ordering tier.
- No dead field: every field on `item` has a reader today, matching the platform convention argued for
  `published`/`deleted` in `docs/data-model.md`.
- Avoids re-introducing the `.lean()` / `GraphQLFloat.serialize(Decimal128)` failure class the
  `lib/schemas/item.js` header comment describes.

### Negative
- No shop-owner UI can show a price yet — `marketplace-shopowner`'s item screens have nothing to bind
  to, and won't until the ordering tier lands.
- Adding `price` later means changing the shape `lib/schemas/item.js` returns — every migration here
  creates a collection and none alters one (ADR-014) — and any `lib/schemas/` change is followed in the
  same piece of work by a full rebuild of every database that ran the migrations (`dbMarketplaceDev`
  plus each repo's throwaway test DB).

### Risks
- A future migration adds `price` (or `cost`/`amount`) to `item` without a matching `Cart`/`Order`
  design — reproduces exactly the guess this ADR rejects. Revisit trigger: a `Cart`/`Order`/`Payment`
  ADR exists and specifies currency, precision and VAT/discount handling; `price` is added as part of
  that same piece of work, not ahead of it.
- Product pressure to show a marketing price ("starting from €X") without transactional capability.
  Revisit trigger: an explicit product decision to add a *display-only* price, argued and recorded in
  its own ADR — not silently smuggled into an unrelated `item` edit.

---

## Compliance

Verify: `grep -n "price" BEs/marketplace-db-setup/lib/schemas/item.js` returns nothing outside the
explanatory header comment. `db.item.getSchema()` (or reading the validator programmatically)
required-list has no `price`/`cost`/`amount` key, and `additionalProperties: false` means the database
itself rejects a write carrying one.

Violation looks like: a migration under `BEs/marketplace-db-setup/migrations/` adding `price` (any
BSON type) to the `item` validator with no corresponding `Cart`/`Order` collection, migration, or ADR
landing in the same piece of work. Also a violation: any resolver in
`BEs/dev/marketplace-dev-authenticated-resource` or `BEs/dev/marketplace-dev-admin-authenticated-resource`
accepting a `price` argument on `itemAdd`/`itemUpdate` — check
`src/graphQLApi/schema/mutations/itemAdd.mts` / `itemUpdate.mts` for an unlisted input field, which
`GraphQLInput` types would surface at the schema-slice level before it ever reached the database.
