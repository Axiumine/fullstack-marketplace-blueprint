# ADR-010 — A single `defaultAddress` pointer instead of a boolean on each address, enforced in the validator
# Marketplace

**Status:** accepted
**Date:** 2026-08-05
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`user` collection (`BEs/marketplace-db-setup/migrations/20260804000000-create-user.js`) mirrors `shopOwner` but diverges 4 ways. One divergence: `shopOwner` holds one `personalData.address`; `user` holds `addresses` array — customer got home, office, friend's flat. Need way to mark one as the delivery default.

Original spec (per migration's own comment, `20260804000000-create-user.js` header): optional `default: true` boolean on each `addresses[]` element, "only one may be true" as constraint.

Constraint "only one true" not expressible in `$jsonSchema` at all — `$jsonSchema` cannot compare sibling array elements against each other. Forces enforcement, if any, into `$expr` — collection validators accept `$and` of `$jsonSchema` + query expr, first used on this platform by `company` (`20260803000000-create-company`, alter `20260804010000`).

Write path for a boolean-per-element default is inherently two-step: clear old default, set new one. Two `updateOne` calls (or one non-atomic multi-update) open a window where zero or two elements read `default: true` — readable by a concurrent request, or left behind by a crash mid-sequence.

`user.addresses[]._id` is Mongoose-minted, required (`lib/schemas/user.js:19-21` — `addressItem()` doc comment: "`_id` is REQUIRED, which is what makes `defaultAddress` expressible: a pointer needs something to point at"). That precondition is what makes a pointer design possible at all.

No cart/order model exists yet (`item` has no `price` — `BEs/marketplace-db-setup/lib/schemas/item.js`) so `defaultAddress` has no consumer beyond "which saved address does `me` highlight" today — decision is about data-integrity shape, not about a checkout flow that does not exist.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Per-element `default: true` boolean, no DB-level "at most one" check | Simplest write — plain `$set` on the matched array element | Two defaults becomes a silently storable state; every reader has to guess which one wins; matches original spec but abandons the constraint entirely |
| Per-element `default: true` boolean, `$expr` counts true values, rejects `>1` | Keeps the boolean shape the spec asked for; DB still refuses the bad state | `$expr` for a count-over-array is a `$size`/`$filter` expression on every write, not simpler than a pointer check; setting a new default is still clear-then-set — two sequential writes, so the *window* between them still exists even though the *end state* is checked; a crash mid-sequence still leaves 0 defaults, which the `$expr` cannot distinguish from "customer never picked one" |
| Top-level `defaultAddress` ObjectId, `$expr` checks it is absent or present in `addresses[]._id` (**adopted**) | Second default is structurally inexpressible — not a rule checked at write time, a shape that cannot hold the bad state; setting the default is one atomic `$set`, no window; the only failure mode (dangling pointer) is checkable with one `$in`/`$map` | Reading "is this address the default" is a comparison against a sibling field, not a local boolean; delete-address path must clear the pointer in the same write or the DB rejects it, which forces an aggregation-pipeline update instead of a plain `$pull` |

---

## Decision

Adopted the top-level `defaultAddress` pointer (table row 3). Reasoning stated in `lib/schemas/user.js:52-68` and restated by the migration itself (`20260804000000-create-user.js`): "at most one default" moved from a **rule** (checked, and checkable-violatable) to a **shape** (cannot represent the violation). Row 2's boolean-plus-`$expr` still leaves a two-step write with a real interleaving window; row 3's pointer needs one `$set` because there is only ever one field naming the default, never N fields that all have to agree.

Validator lives in `validatorUser()` (`BEs/marketplace-db-setup/lib/schemas/user.js:104-199`) as `$and: [ {$jsonSchema}, DEFAULT_ADDRESS_POINTS_INTO_ADDRESSES ]`:

```js
const DEFAULT_ADDRESS_POINTS_INTO_ADDRESSES = {
  $expr: { $or: [
    { $eq: [{ $type: '$defaultAddress' }, 'missing'] },
    { $in: ['$defaultAddress',
        { $map: { input: { $ifNull: ['$addresses', []] }, in: '$$this._id' } } ] }
  ] }
};
```

`$ifNull: ['$addresses', []]` is load-bearing, not defensive filler: `$map` over a missing `addresses` field yields `null`, and `$in` against a `null` array **errors** rather than returning `false` — without the `$ifNull`, a brand-new customer with no addresses yet would fail to insert at all.

---

## Consequences

### Positive
- Setting the default (`userDefaultAddressSet`, per `docs/devprotocol/phase2/UBIQUITOUS_LANGUAGE.md:533`) is one atomic `$set` — no clear-then-set sequence, no interleaving window.
- "Two defaults" is not a bug class on this collection — the shape cannot hold it, so no test has to prove a race can't produce it.
- Only one failure mode exists (dangling pointer) and it is mechanically checkable by the DB itself, not by an app-layer guard someone can forget to call.

### Negative
- "Is this address the default?" costs a sibling-field comparison (`addr._id.equals(user.defaultAddress)`) instead of reading a local boolean; any API surface wanting a plain boolean derives it at read time. Recorded cost, not a surprise — `lib/schemas/user.js:52-68` states it up front.
- Deleting the default address cannot be a plain `$pull` — the validator rejects a write that removes the addressed element while leaving `defaultAddress` pointed at it. `funUserAddressDel` (`BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:34-68`) is an aggregation-pipeline `updateOne` for exactly this reason: stage 1 `$filter`s the array (pipeline form of `$pull`, since `$pull` is an update operator and unavailable inside a pipeline), stage 2 `$cond`s `defaultAddress` to itself or to `'$$REMOVE'` in the same atomic write.

### Risks
- **`collMod` restating only the `$jsonSchema` half.** `collMod` replaces the validator wholesale; a future alter migration that copies just the `$jsonSchema` object silently drops the `$expr` clause, and nothing fails until a dangling pointer gets written. Revisit trigger: any new `<ts>-alter-user-*.js` migration — check it restates both `$and` members, not one.
- **A write path bypassing the pipeline update.** Any future `user.addresses` mutation using a plain `updateOne` update-document (not the `[...]` pipeline array form) to remove an element risks the same dangling-pointer rejection `funUserAddressDel` was built to avoid, surfacing as a write error rather than silent corruption (fail-closed, but still a revisit trigger if it starts happening routinely). Grep for `User.updateOne` with an object second argument touching `addresses` outside `funUserAddressDel.mts`.
- **Reopening the boolean design.** `CONSTRAINTS.md` §4 already lists this shape as an architectural invariant Phase 3 may not redesign ("`defaultAddress` is single top-level ObjectId pointer, not per-element boolean ... already paid for, not up for re-litigation"). Not a live risk under current rules, listed for completeness.

---

## Compliance

Verify the shape exists: `grep -n "DEFAULT_ADDRESS_POINTS_INTO_ADDRESSES" BEs/marketplace-db-setup/lib/schemas/user.js` — must appear both as the const definition and inside `validatorUser()`'s `$and` array (currently lines 70-82 and 196).

Verify no boolean regression: `grep -n "default.*true\|default:" BEs/marketplace-db-setup/lib/schemas/user.js` should find nothing describing a per-address boolean field in `addressItem()`.

Verify the delete path stays pipeline-shaped: `grep -n "updateOne" BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts` — second argument must be an array (`[ {$set:...}, {$set:...} ]`), not a plain update document.

A violation on disk looks like: an `addresses[]` element carrying a `default` field, an `$expr` clause deleted or narrowed to only the `$jsonSchema` half, or an address-delete mutation calling `User.updateOne` with a bare `$pull` instead of the two-stage pipeline.
