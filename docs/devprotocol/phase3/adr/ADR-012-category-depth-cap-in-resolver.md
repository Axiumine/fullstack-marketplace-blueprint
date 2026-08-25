# ADR-012 — itemCategory depth capped at two, in the resolver, with writes admin-only
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`itemCategory` two-level taxonomy. Document with no `idParent` = category. Document whose `idParent` names a category = subcategory. Document whose `idParent` names a subcategory = disallowed, third level. Schema builder `BEs/marketplace-db-setup/lib/schemas/itemCategory.js` declares `idParent` as plain `bsonType: 'objectId'`, optional, no depth info in the shape itself.

Forcing function: MongoDB `$jsonSchema` validator sees ONE document at write time. Checking "is my parent itself a subcategory" needs a second document read — the parent's own `idParent`. A validator cannot do a lookup. Comment at `BEs/marketplace-db-setup/lib/schemas/itemCategory.js:9-14` states this outright: depth cap "is the one shape this file cannot express."

Taxonomy is platform-wide, not per-shop (`itemCategory` carries no `idShopOwner`) — two shops selling the same kind of thing must land in the same category or a customer-facing filter means nothing. That is the stated reason writes are Admin-only in the first place (`itemCategory.js:11-13`).

Constraint from `CONSTRAINTS.md` CON-02/CON-01 style thinking applies here too, though not by name: role = which collection/service you write through, no permission flag on the document. So "who may create a subcategory" has to be answered by "which service has the mutation," not by a field check.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — Enforce depth in `$jsonSchema` validator | Cheapest, no extra read, DB-level backstop, holds even against a raw insert | Structurally impossible — validator scope is one document, cannot read the parent one. Not a tradeoff, a hard MongoDB limit |
| B — Enforce in resolver, single write path (`itemCategoryAdd`/`Update` in `marketplace-dev-admin-authenticated-resource`), reject via lookup | Works today with the read the validator cannot do; one function (`throwIfParentNotTopLevel.mts`) is the entire enforcement surface, auditable in one place; matches existing Admin-only write boundary | Cap is a code convention, not a DB constraint — a raw driver insert or a second write path bypasses it silently |
| C — Denormalize a `level`/ancestry field on `itemCategory`, maintained by the resolver on every write | Depth check becomes a field comparison, no extra `findOne` per write | Adds a redundant field that must stay in sync with `idParent` by hand — same resolver-trust problem as B, plus a new failure mode (field drifts from reality) for no real gain at cap=2 |
| D — Let ShopOwner tier also write `itemCategory`, duplicating the depth check in `marketplace-dev-authenticated-resource` | Shop owners self-serve categories, no Admin bottleneck | Contradicts the platform-wide-taxonomy reason writes are Admin-only at all; multiplies the number of places the depth check must be kept correct, from one service to two |

---

## Decision

Option B. Depth cap lives in `throwIfParentNotTopLevel` (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/throwIfParentNotTopLevel.mts:47-65`), called from `funItemCategoryAdd.mts:44` and `funItemCategoryUpdate.mts:52`. Option A is off the table for a structural reason, not a preference — no `$jsonSchema` can read a second document, so there is no validator-only version of this decision to weigh. Between B, C and D, B wins because the write path was already single (Admin-only, per the taxonomy-is-platform-wide reasoning in `itemCategory.js:11-13`) before this decision — C adds a field to solve a problem B already has an acceptable answer for (one lookup, one call site, two call sites total), and D multiplies exactly the thing B keeps to one: the number of places a future editor has to remember to enforce the cap.

Three failure modes, three distinct answers, per `throwIfParentNotTopLevel.mts:17-23`:
- parent missing or soft-deleted → 404 (nothing else catches it)
- parent is itself a subcategory → 400, the depth-cap violation itself
- parent is the document being edited (`_id === idParent`) → 400, cheapest cycle two levels leave room for

⚠️ **Amended 2026-08-25 (E06 §6) — the decision stands, the guard's read became a write.** The three write paths each run their reads and their write inside one `session.withTransaction`, and the lookup above is now a `findOneAndUpdate` that `$inc`s the parent's `__v`. Nothing about the cap changed: it is still resolver-enforced, still one function, still the same three refusals. What changed is that the check now *touches* the document it reads, so a concurrent `itemCategoryDel` of that parent collides with it instead of committing past it. The full reasoning is under **Risks** below; the code as it stands today:

```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/throwIfParentNotTopLevel.mts:47-65
export async function throwIfParentNotTopLevel(idParent: Types.ObjectId, session: ClientSession, _id?: Types.ObjectId) {
	if (String(_id) === String(idParent)) {
		throwErrorWrongUserInput('itemCategory.idParent: a category cannot be its own parent')
	}

	const parent = await ItemCategory.findOneAndUpdate(
		{ _id: idParent, deleted: trusted({ $exists: false }) },
		{ $inc: { __v: 1 } },
		{ projection: { idParent: 1 } }
	)
		.session(session)
		.lean()

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

  ⚠️ **Amended 2026-08-25 (E06 §6) — "Admin-only writes" now carries exactly one exception, and it is deliberate.** `holdItemCategory` (`BEs/dev/marketplace-dev-authenticated-resource/src/lib/item/holdItemCategory.mts:41-53`) writes `itemCategory` from the ShopOwner tier: `$inc` on `__v`, and nothing else — no `idParent`, no `name`, no `slug`, no `deleted`, and no insert. It exists to make an item write collide with an `itemCategoryDel` that would strand it, which is the item half of the same race the guard above closes. **The depth cap therefore still has exactly one writer**: a field the cap does not read, written by a path that cannot create, retire or re-parent a category, is not a second write path in the sense this ADR means. Option D remains rejected — this is not self-serve categories by the back door, and a ShopOwner-tier mutation that wrote any domain field of `itemCategory` would be the violation this bullet describes.
- Three-way error split (404 / 400-subcategory-parent / 400-self-parent) gives the Admin caller a precise reason, not a generic rejection.

### Negative
- Cap is enforced in application code, not the database — a raw driver write or a manual Mongo op against `itemCategory` bypasses it with nothing to stop it.
- Every write path that accepts `idParent` must remember to call `throwIfParentNotTopLevel` by hand — nothing forces the call, the schema builder only documents the obligation (`itemCategory.js:9-14` comment, "a third one inherits the obligation").
- One extra round-trip per add/update that carries an `idParent` — a `findOneAndUpdate` since the 2026-08-25 amendment, not a `findOne`. Accepted, no measured cost at current scale.
- ⚠️ **Contention on the taxonomy, which is new and is not free on the ShopOwner side.** Every write that names a category now takes that document. On the Admin tier that is two operators editing one branch of the tree at the same instant — a retry nobody observes. `holdItemCategory` puts the same write on **every item add and every item save on the platform**, so two owners stocking the same category serialise on it, one of them retried. It is one extra write per item write with no lock held beyond the transaction, so the queue is short — but it is why the hold is called once, inside the transaction, and never on a read path, and it is the cost this design accepts in exchange for the window below.

### Risks
- A second write path for `itemCategory` gets added outside `marketplace-dev-admin-authenticated-resource` (e.g. giving ShopOwner self-serve categories, Option D revisited) without importing `throwIfParentNotTopLevel` — cap silently disappears for that path. Revisit trigger: any new `itemCategoryAdd`/`Update`/`Del` file appearing under a different service.
- A migration or seed script inserts `itemCategory` documents directly via the raw driver, skipping the resolver entirely. Revisit trigger: evidence of a three-level document in the database, or a migration under `BEs/marketplace-db-setup/migrations/` that writes `itemCategory` without going through this check.
- `throwIfParentNotTopLevel` gets copy-pasted into a second service instead of shared, drifting the two copies apart. Revisit trigger: a decision to allow non-admin writes to `itemCategory` (currently out of scope per the platform-wide-taxonomy reasoning above).

⚠️ **Amended 2026-08-25 (E06 §6) — a read-then-write window existed under all three paths, and is closed.** Recorded here because this is where it belongs: the cap is enforced by a resolver reading a second document, and a read of a document another transaction is about to retire is exactly the shape that races.

- **The window.** None of the three write paths was a transaction, so each read and then wrote with a gap. `itemCategoryAdd({ idParent: P })` passed its parent check while `itemCategoryDel(P)` counted zero live children and stamped `deleted`, then the create landed — a live subcategory under a retired parent, the exact document `funItemCategoryDelete` exists to prevent. Symmetrically, `itemCategoryUpdate(C, { idParent: P })` passed `throwIfHasChildren(C)` while `itemCategoryAdd({ idParent: C })` found `C` still top-level, and the pair produced three levels with no single write naming the grandchild. Closed by implementation on the platform owner's call: each path now opens a session and does its reads and its write inside one `session.withTransaction`, and every guard takes that session so nothing in them escapes it.
- ⚠️ **A transaction alone would not have closed it, which is why the guards read with a write.** MongoDB transactions are snapshot-isolated, not serialisable, and snapshot isolation permits **write skew**: two transactions that each read a document the other writes both commit, each having seen a consistent snapshot. That is the first interleaving exactly. `$inc`-ing `__v` makes the guard a writer of the very document the racing delete stamps, so the server aborts one with a `WriteConflict`; that error carries the `TransientTransactionError` label, and `withTransaction` retries the loser against the taxonomy the winner left. `__v` is the field to touch because nothing reads it — mongoose maintains it for `save()` on documents with arrays, this collection is never written that way, and the validator already declares it `bsonType: 'int'`. The second interleaving needs no `$inc` of its own: `throwIfHasChildren(C)` guards an update that writes `C`, and the racing add writes `C` too.
- ⚠️ **The item half of the same race is closed from another repo, and the two sides are one rule.** `funItemCategoryDelete` also refuses to retire a category that still holds live items, and that count raced an `itemAdd` on the ShopOwner tier creating a document this service could not see. `holdItemCategory` supplies the missing collision from `marketplace-dev-authenticated-resource`. Either the category is gone and the item write answers 404, or the item exists and the delete refuses with "the category still holds items". **Changing one side without the other reopens the window with nothing failing to say so** — no test in either repo can observe the other's absence. Revisit trigger: any change to `throwIfParentNotTopLevel`, `holdItemCategory`, or the transaction boundary of any of the five write paths that now share this rule.
- **What is still not closed, and is not closable here.** A raw driver write or a migration touching `itemCategory` directly bypasses both the cap and the collision, exactly as the two bullets above this one already say. The transactions changed the concurrency story, not the application-code-not-database one.

---

## Compliance

Verify write-path exclusivity:
```
grep -rl "itemCategoryAdd\|itemCategoryUpdate\|itemCategoryDel" BEs/dev/*/src
```
must return files only under `BEs/dev/marketplace-dev-admin-authenticated-resource/src` — the three resolvers under `graphQLApi/schema/mutations/`, the functions they delegate to under `lib/itemCategory/`, and the two type/registry files that name them. Any hit under another service is the violation.

Verify every accepting write path calls the guard:
```
grep -n "throwIfParentNotTopLevel" BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/*.mts
```
must list both `funItemCategoryAdd.mts` and `funItemCategoryUpdate.mts`.

Verify both sides of the collision still exist (amended 2026-08-25):
```
grep -rn '\$inc' BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/ \
                 BEs/dev/marketplace-dev-authenticated-resource/src/lib/item/
```
must return `throwIfParentNotTopLevel.mts` and `holdItemCategory.mts`, one `{ $inc: { __v: 1 } }` each. One without the other is a reopened window, not a cleanup.

Verify the ShopOwner tier's write of `itemCategory` is still only that:
```
grep -rn 'ItemCategory\.' BEs/dev/marketplace-dev-authenticated-resource/src
```
must show exactly three uses: `find` (the read-only `itemCategories` query), `countDocuments` (`throwIfItemCategoryMissing`), and the one `findOneAndUpdate` whose update is `{ $inc: { __v: 1 } }` (`holdItemCategory`). No `create`, no `insertMany`, no `updateOne`, no `deleteOne`, and no `$set` of any field.

Violation on disk looks like: an `itemCategoryAdd.mts`/`itemCategoryUpdate.mts`/`itemCategoryDel.mts` file under `marketplace-dev-authenticated-resource/src` or `marketplace-dev-public-resource/src/graphQLPublic/schema/mutations/`; a function under `lib/itemCategory/` that writes `idParent` without calling `throwIfParentNotTopLevel` first; a ShopOwner- or public-tier write of `itemCategory` that touches anything other than `__v`; or a write path in either repo that reads a category outside the transaction that writes.
