# ADR-008 — Domain-neutral catalogue: one generic item plus a two-level itemCategory
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

One vendor operates the platform, tenants are arbitrary shops (`company`), product types unknown in
advance.
The obvious modelling — and the one a catalogue drifts into — gives each product type its own
collection, with its own migration, mongoose model, resolver set and test file. Adding a product type
then means a new collection top to bottom, and the collections differ in their *category*, not in their
shape.

Platform target is a domain-neutral marketplace — "not tied to any one product domain" per [`CLAUDE.md`](../../../../CLAUDE.md)
§Two naming rules, restated twice. Forces: the catalogue has to (1) let a shop sell anything without a
schema migration per product type, (2) keep category/subcategory browse, (3) not smuggle
domain-specific vocabulary back in — CON-11/vocab-lock bans it — and (4) not invent commerce fields
(`price`) with no order/cart/payment model to attach to (ADR-009).

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Keep per-type collections, one collection per product type (previous approach, extended) | No migration risk on existing data; matches an already-built per-type mental model | Every new product type = new collection + migration + model + resolver + test, forever; base shape stays domain-shaped; does not solve "domain-neutral" — bakes the assumption deeper |
| One generic `item` collection, flat, no category at all | Simplest possible write path; one model, one resolver set | No browse/filter axis — public catalogue page becomes one long unstructured list; loses the category browse UX the platform needs; punts a real requirement instead of solving it |
| One generic `item` collection + separate `itemCategory` two-level self-referencing tree, `item.idCategory` FK (chosen) | New product type = new `idCategory` value, no migration in the common case; category browse preserved and generalized past any single product type; depth cap enforced in resolver keeps the tree from becoming an unbounded taxonomy nobody asked for | Genuinely new product *type* (not just new category) still needs a real new collection — this doesn't eliminate the extension seam, it narrows how often it's hit; two-level cap is a resolver-level guard, not database-enforced (`$jsonSchema` cannot read a parent document) |
| Generic `item` with a free-form `type` string field instead of `itemCategory` collection | No second collection, no self-FK, no depth-cap logic | `type` as arbitrary string is exactly the shape [`CLAUDE.md`](../../../../CLAUDE.md) bans elsewhere for role (`no role field, no permission enum, ever` — CON-01) applied to a sibling problem: uncontrolled strings drift, can't be edited/renamed/reordered by an Admin, no `position` for menu ordering, no tree for subcategories |

---

## Decision

Chose row 3: `item` (flat, domain-neutral, hangs off `company` via `idCompany`) plus `itemCategory`
(two-level self-referencing tree via `idParent`, admin-only writes). Reasoning: per-type collections
never actually differed in shape — they differed in category, not in shape — so collapsing them to one
collection removes the real duplication (near-identical `$jsonSchema` validators, near-identical
resolver sets) without giving up the browse structure a marketplace needs. Row 2 (no category at all)
was rejected because it discards a real requirement rather than generalizing it. Row 4 (free-form
`type` string) was rejected on the same "no uncontrolled enum-like field" logic CON-01 already applies
to `role` — a taxonomy needs edit/rename/reorder/parent-child, a string gives none of that. Row 1 (keep
per-type collections) was rejected because it does not solve the stated problem at all — it only adds
new collections, not a domain-neutral shape.

Evidence on disk: `BEs/marketplace-db-setup/lib/schemas/item.js` (validator + comment block explaining the
seam), `BEs/marketplace-db-setup/lib/schemas/itemCategory.js`, `BEs/marketplace-common/src/models/MongoDB/Item.mts`
and `.../ItemCategory.mts` with their interfaces in `MongoDBInterfaces/IItemSchema.mts` /
`IItemCategorySchema.mts`.

```
shopOwner ──idShopOwner──> company ──idCompany──> item ──idCategory──> itemCategory
                                                                            ▲
                                                                    idParent ┘  (one level only)
```

---

## Consequences

### Positive
- New product *category* (most of the time what "new product type" turns out to mean) is a document insert
  under `itemCategory`, not a migration — usually an item with a different idCategory, not a new
  collection.
- One resolver set (`itemAdd.mts`, `itemUpdate.mts` in ShopOwner resource service, per
  [`docs/architecture.md`](../../../architecture.md) §Resolver layout) replaces what would otherwise be a near-duplicate
  `*Add.mts`/`*Update.mts` pair per product type.
- One `$jsonSchema` validator (`lib/schemas/item.js`) replaces what would otherwise be one near-identical
  validator per product type, removing the `DuplicatedCode` Qodana finding class repeated per-type
  validators would produce (`docs/data-model.md` §Migrations).
- Nothing in the shape presumes what is sold — none of `item`'s 8 fields
  (`_id, idCompany, idCategory, name, description, slug, published, deleted`) is domain-specific.

### Negative
- A genuinely new product *type* — not just a new category — is not free. It still needs its own
  collection, migration, model and resolvers per [`docs/data-model.md`](../../../data-model.md)'s closing paragraph: "check
  first whether it is genuinely a new type or just an item with a different idCategory." The ADR narrows
  the seam, it does not remove it.
- Depth cap on `itemCategory` (max 2 levels) is enforced only in the Admin resolver
  (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemCategoryAdd.mts`),
  not in the `$jsonSchema` validator — a `$jsonSchema` cannot read a parent document to check its own
  `idParent`. Writes to `itemCategory` exist in exactly that one service; ShopOwner and public tiers are
  read-only on it by convention, not by a database-level block.
- `item` carries no `price` by design (`lib/schemas/item.js:12-17` comment block) — this ADR does not
  attempt to fill that gap, and CONSTRAINTS.md §5 keeps it explicitly out of Phase 3 scope.

### Risks
- **Risk: a future service adds an `itemCategory` write path outside `marketplace-dev-admin-authenticated-resource`.**
  Revisit condition: any resolver under the ShopOwner or public resource services calls
  `ItemCategory`'s model with a write op (`create`/`updateOne`/`findOneAndUpdate` etc). That silently
  removes the two-level depth cap, since the cap lives in the resolver the new write path would bypass.
- **Risk: `idCategory`/`idCompany` FK integrity drifts.** Both are application-enforced ("resolvers
  check both before writing" per `item.js` comment). Revisit condition: an integration test or
  production incident finds an `item` document pointing at a deleted/nonexistent
  `company` or `itemCategory` — signals the check was skipped on some write path.
- **Risk: pressure to add `price` "just as a field" before order/cart/payment exist.** Revisit condition:
  a Phase 3 or later ADR proposes adding `price` to `item` without a corresponding Order/Cart/Payment
  design landing in the same piece of work — CONSTRAINTS.md §5 already flags this as guessing at an
  undesigned decision.

---

## Compliance

Verify no domain-specific vocabulary was reintroduced: `BEs/marketplace-db-setup/lib/schemas/item.js`
and `itemCategory.js` should list only the documented fields
(`_id, idCompany, idCategory, name, description, slug, published, deleted` for `item`); any field name
that presumes what is sold, added outside a migration, is a violation.

Verify collection count matches CONSTRAINTS.md §4 invariant (6 total): `admin`, `shopOwner`, `company`,
`user`, `item`, `itemCategory` — check migration filenames under `BEs/marketplace-db-setup/migrations/`,
a per-product-type migration is the violation.

Verify depth cap stays resolver-only in the one place it's supposed to be: `itemCategory` write mutations
(`itemCategoryAdd.mts`, `itemCategoryUpdate.mts`) should exist only under
`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/`. A grep for the
same filenames under `marketplace-dev-authenticated-resource` or `marketplace-dev-public-resource` finding
a hit is the violation signal for the first risk above.

Verify no `price` field: `grep -n 'price' BEs/marketplace-db-setup/lib/schemas/item.js` should return
nothing outside the explanatory comment block at lines 12–17.
