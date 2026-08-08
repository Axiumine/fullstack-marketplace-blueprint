# ADR-012 — itemCategory depth capped at two, in the resolver, with writes admin-only
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`itemCategory` two-level taxonomy. Row with no `idParent` = category. Row whose `idParent` names a category = subcategory. Row whose `idParent` names a subcategory = disallowed, third level. Schema builder `BEs/marketplace-db-setup/lib/schemas/itemCategory.js` declares `idParent` as plain `bsonType: 'objectId'`, optional, no depth info in the shape itself.

Forcing function: MongoDB `$jsonSchema` validator sees ONE document at write time. Checking "is my parent itself a subcategory" needs a second document read — the parent's own `idParent`. A validator cannot do a lookup. Comment at `BEs/marketplace-db-setup/lib/schemas/itemCategory.js:9-14` states this outright: depth cap "is the one shape this file cannot express."

Taxonomy is platform-wide, not per-shop (`itemCategory` carries no `idShopOwner`) — two shops selling the same kind of thing must land in the same category or a customer-facing filter means nothing. That is the stated reason writes are Admin-only in the first place (`itemCategory.js:11-13`).

Constraint from `CONSTRAINTS.md` CON-02/CON-01 style thinking applies here too, though not by name: role = which collection/service you write through, no permission flag on the row. So "who may create a subcategory" has to be answered by "which service has the mutation," not by a field check.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — Enforce depth in `$jsonSchema` validator | Cheapest, no extra read, DB-level backstop, holds even against a raw insert | Structurally impossible — validator scope is one document, cannot read the parent row. Not a tradeoff, a hard MongoDB limit |
| B — Enforce in resolver, single write path (`itemCategoryAdd`/`Update` in `marketplace-dev-admin-authenticated-resource`), reject via lookup | Works today with the read the validator cannot do; one function (`throwIfParentNotTopLevel.mts`) is the entire enforcement surface, auditable in one place; matches existing Admin-only write boundary | Cap is a code convention, not a DB constraint — a raw driver insert or a second write path bypasses it silently |
| C — Denormalize a `level`/ancestry field on `itemCategory`, maintained by the resolver on every write | Depth check becomes a field comparison, no extra `findOne` per write | Adds a redundant field that must stay in sync with `idParent` by hand — same resolver-trust problem as B, plus a new failure mode (field drifts from reality) for no real gain at cap=2 |
| D — Let ShopOwner tier also write `itemCategory`, duplicating the depth check in `marketplace-dev-authenticated-resource` | Shop owners self-serve categories, no Admin bottleneck | Contradicts the platform-wide-taxonomy reason writes are Admin-only at all; multiplies the number of places the depth check must be kept correct, from one service to two |

---

## Decision

Option B. Depth cap lives in `throwIfParentNotTopLevel` (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/throwIfParentNotTopLevel.mts:32-44`), called from `funItemCategoryAdd.mts:23` and `funItemCategoryUpdate.mts:33`. Option A is off the table for a structural reason, not a preference — no `$jsonSchema` can read a second document, so there is no validator-only version of this decision to weigh. Between B, C and D, B wins because the write path was already single (Admin-only, per the taxonomy-is-platform-wide reasoning in `itemCategory.js:11-13`) before this decision — C adds a field to solve a problem B already has an acceptable answer for (one lookup, one call site, two call sites total), and D multiplies exactly the thing B keeps to one: the number of places a future editor has to remember to enforce the cap.

Three failure modes, three distinct answers, per `throwIfParentNotTopLevel.mts:16-27`:
- parent missing or soft-deleted → 404 (no FK in MongoDB, nothing else catches it)
- parent is itself a subcategory → 400, the depth-cap violation itself
- parent is the row being edited (`_id === idParent`) → 400, cheapest cycle two levels leave room for

```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/throwIfParentNotTopLevel.mts:32-43
export async function throwIfParentNotTopLevel(idParent: Types.ObjectId, _id?: Types.ObjectId) {
	if (String(_id) === String(idParent)) {
		throwErrorWrongUserInput('itemCategory.idParent: a category cannot be its own parent')
	}
	const parent = await ItemCategory.findOne({ _id: idParent, deleted: trusted({ $exists: false }) }, { idParent: 1 }).lean()
	if (parent === null) throwNotFoundError('parent category not found')
	if (parent.idParent !== undefined) {
		throwErrorWrongUserInput('itemCategory.idParent: the taxonomy is two levels deep — a subcategory cannot have children')
	}
}
```

---

## Consequences

### Positive
- Entire depth-cap enforcement is one function, one file — auditable without cross-referencing the schema builder.
- ShopOwner and public tiers cannot violate the cap by construction: they carry no `itemCategoryAdd`/`Update`/`Del` at all, verified absent under `BEs/dev/marketplace-dev-authenticated-resource/src` and `BEs/dev/marketplace-dev-public-resource/src`.
- Three-way error split (404 / 400-subcategory-parent / 400-self-parent) gives the Admin caller a precise reason, not a generic rejection.

### Negative
- Cap is enforced in application code, not the database — a raw driver write or a manual Mongo op against `itemCategory` bypasses it with nothing to stop it.
- Every write path that accepts `idParent` must remember to call `throwIfParentNotTopLevel` by hand — nothing forces the call, the schema builder only documents the obligation (`itemCategory.js:9-14` comment, "a third one inherits the obligation").
- One extra `findOne` round-trip per add/update that carries an `idParent` — accepted, no measured cost at current scale.

### Risks
- A second write path for `itemCategory` gets added outside `marketplace-dev-admin-authenticated-resource` (e.g. giving ShopOwner self-serve categories, Option D revisited) without importing `throwIfParentNotTopLevel` — cap silently disappears for that path. Revisit trigger: any new `itemCategoryAdd`/`Update`/`Del` file appearing under a different service.
- A migration or seed script inserts `itemCategory` rows directly via the raw driver, skipping the resolver entirely. Revisit trigger: evidence of a three-level row in the database, or a migration under `BEs/marketplace-db-setup/migrations/` that writes `itemCategory` without going through this check.
- `throwIfParentNotTopLevel` gets copy-pasted into a second service instead of shared, drifting the two copies apart. Revisit trigger: a decision to allow non-admin writes to `itemCategory` (currently out of scope per the platform-wide-taxonomy reasoning above).

---

## Compliance

Verify write-path exclusivity:
```
grep -rl "itemCategoryAdd\|itemCategoryUpdate\|itemCategoryDel" BEs/dev/*/src
```
must return files only under `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/`.

Verify every accepting write path calls the guard:
```
grep -n "throwIfParentNotTopLevel" BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/*.mts
```
must list both `funItemCategoryAdd.mts` and `funItemCategoryUpdate.mts`.

Violation on disk looks like: an `itemCategoryAdd.mts`/`itemCategoryUpdate.mts`/`itemCategoryDel.mts` file under `marketplace-dev-authenticated-resource/src` or `marketplace-dev-public-resource/src/graphQLPublic/schema/mutations/`; or a function under `lib/itemCategory/` that writes `idParent` without calling `throwIfParentNotTopLevel` first.
