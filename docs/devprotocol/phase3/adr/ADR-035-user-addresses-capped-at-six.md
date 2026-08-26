# ADR-035 — `user.addresses` is capped at six, in the validator and in the write that appends
# Marketplace

**Status:** accepted
**Date:** 2026-08-26
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`user.addresses` is an array where `shopOwner` has one embedded `personalData.address` (divergence #1,
`docs/data-model.md`). Until 2026-08-26 it was **unbounded**: no `maxItems` in the validator, no count in
`funUserAddressAdd`, no ceiling in the account area. That was not a decision that had been taken and
recorded — it was a question nobody had asked.

Three facts make the absence matter more here than on a typical embedded array:

- **The whole array lives in one document, under a 16 MB ceiling.** That is the same fact that makes the
  `defaultAddress` pointer enforceable at all (ADR-010): one document, one atomic write. Growth of the
  array is growth of the document.
- **`me` loads all of it on every account read.** There is no projection, no paging and no separate
  address query — the private area reads the customer's whole account.
- ⚠️ **ADR-029 leaves the server unable to measure anything else about this collection.** Every member of
  an address element is `AEAD_AES_256_CBC_HMAC_SHA_512-Random` ciphertext, so what is at rest is `binData`
  and `maxLength: 250` on a street measures a length the database never sees. `maxItems` counts
  *elements*, and encryption does not change how many there are — it is the one length rule left.

The `itemCategory` depth cap (ADR-012) is the platform's precedent for a bound of this kind and its
counter-example: that cap lives in a resolver because `$graphLookup` in a validator is not available, and
the ADR records the cost — a rule the database cannot keep, enforced by an application path someone can
forget to call. Nothing forces that compromise here.

The number was set by the platform owner: **six**.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Leave it unbounded | Nothing to build; no number to justify | A document that grows without limit under a hard ceiling, loaded whole on every read; the failure arrives late, at an unknown size, as a write that stops working |
| Cap in the application only (`funUserAddressAdd` counts, then pushes) | One repo touched; the number is a constant that can be changed without a migration | The database will hold what any other writer puts there — a script, a fixture, a second service — and the count-then-push shape has a window: two adds fired at once both read five and both push |
| Cap in the validator only (`maxItems: 6`) | The rule is the database's, so it is true of every writer | The customer meets it as a validator failure the service can only report as a 500 — no number, no next move, and the account area keeps offering a button that cannot work |
| **Both, with the validator as the rule (adopted)** | The database refuses the seventh whatever any client does; the service turns that refusal into a 400 naming the limit; the account area stops offering the form. Each layer does the thing only it can do | The number is spelled in three repositories that share no library, so raising it is a coordinated change plus a `collMod` for every database already built |

---

## Decision

All three layers, with a strict ranking between them:

1. **`maxItems: 6` on `addresses` in `validatorUser()`** (`BEs/marketplace-db-setup/lib/schemas/user.js`)
   **is the rule.** Applied to databases already built by `migrations/20260826000000-user-cap-addresses.js`,
   a `collMod`; the create migration `20260301000300` stays the statement of record and a fresh replay
   never runs the catch-up as anything but a no-op.
2. **`MAX_ADDRESSES` in `funUserAddressAdd.mts`** (4032) buys the *shape of the refusal* and nothing else:
   a 400 whose `extensions.description` reads `addresses: at most 6 addresses can be saved`, instead of a
   validator failure surfacing as a 500 with nothing in it a customer could act on.
3. **`MAX_ADDRESSES` in `AddressList.tsx`** (`marketplace-user`) hides "Add an address" at six and says
   why. A courtesy: it spares the customer a form that cannot be submitted.

⚠️ **The service's guard is a clause of the update filter, not a count taken beforehand:**

```ts
const ret = await User.updateOne(
  { _id: _id, [`addresses.${MAX_ADDRESSES - 1}`]: trusted({ $exists: false }) },
  { $push: { addresses: { ...address, _id: addressId } } }
).exec()
```

Index 5 exists exactly when the array already holds six, so requiring it *absent* is requiring room for one
more — and a missing `addresses` has no index 5 either, which is what keeps the first address addable
without an `$ifNull`. Counting and appending are one operation, so two adds fired at once cannot both fit
through the window a read-then-push would leave.

Two spellings are unavailable rather than merely unidiomatic, both because koa-utils' MongoDB data source
sets `mongoose.set('sanitizeFilter', true)` process-wide:

- `$expr: { $lt: [{ $size: '$addresses' }, 6] }` **throws** — `$expr is not allowed with sanitizeFilter` —
  on every call, not only the one that should have been refused.
- an untrusted `{ $exists: false }` is silently rewritten to `{ $eq: { $exists: false } }`, a search for an
  element equal to that literal object. It matches nothing, so the guard would refuse *every* address
  including the first. `mongoose.trusted()` is what stops the rewrite, and `userLib.test.mts` deep-equals
  against `trusted(...)` so the symbol is pinned rather than assumed.

`matchedCount: 0` cannot say which clause missed, so the failing path — and only the failing path — pays
one `countDocuments` to tell a full account (400) from an account that is gone (500). A 400 rather than a
409, following `funUserUpdatePwd`'s "passwordNew must differ from passwordOld": the request is refused for
what it asks relative to the account's state, and this codebase spells that 400.

### This is the first `collMod` on the platform, and it fires two recorded revisit triggers

ADR-010 and ADR-014 both end on the same risk, written when no migration had ever modified a collection:
a `collMod` restates a validator **wholesale — it never merges**, so anything that hands MongoDB the
`$jsonSchema` half of `user`'s `$and` pair silently drops `PLAIN_DEFAULT_ADDRESS_IS_ONE_OF_ADDRESSES`, the
clause that keeps `defaultAddress` pointing at an element of this document's own array. Nothing fails at
that moment; the first symptom is a dangling pointer written weeks later. Both ADRs name the same revisit
trigger — *the first migration that modifies rather than creates a collection* — and both were written
before ADR-014's own compliance grep could return a legitimate hit.

The trigger has now fired, and the answer is the one those ADRs designed for:
`20260826000000-user-cap-addresses.js` calls `validatorUser()` and passes what it returns, whole. It never
names `$jsonSchema` on the way in, because `validatorUser()` returns the `$and` pair and there is no way to
obtain half of it — which is exactly the property ADR-010 says the function's shape exists to guarantee.
`test/migrations.test.mjs` asserts the `$expr` clause is still present after the `collMod`, so a future
edit that reaches for the schema object alone fails a test instead of shipping.

⚠️ **ADR-014's first compliance grep is stale from today and cannot be edited** — ADRs are immutable. It
reads "a `$jsonSchema` literal written directly in a migration, or a `collMod` call, is the violation", and
now returns two lines from this migration, both legitimate. The rule it was protecting is narrower than its
grep: *a migration must not assemble a validator of its own*. Its replacement, which this ADR owns:

```bash
# A collMod is allowed. Assembling the validator inline is not — the argument must be a call into lib/schemas/.
grep -rn 'collMod' BEs/marketplace-db-setup/migrations/ | grep -vE ':[0-9]+:\s*(//|\*)'
grep -rnE '\$jsonSchema\s*:' BEs/marketplace-db-setup/migrations/ | grep -vE ':[0-9]+:\s*(//|\*)'
```

The first may return hits and each one must pass a validator obtained from `lib/schemas/`; the second must
still return nothing. ADR-014's second check — filenames — is untouched by this.

---

## Consequences

### Positive
- An unbounded array under a hard document ceiling stops being a thing that will eventually fail at an
  unknown size, in production, as a write that quietly stops working.
- The bound is the database's, so it holds against every writer — a migration, a fixture, a script, a
  second service — not only against the one resolver that happens to call the guard. This is the property
  ADR-012's resolver-side depth cap does *not* have, and the reason it is worth the extra layer here.
- The customer meets a sentence, not a stack trace: the button is gone with a line saying why, and the
  racing case (a second tab that added the sixth a moment ago) ends in a 400 the form already renders.

### Negative
- **Six is spelled in three repositories and cannot be shared between them.** The migrations repo depends
  on no library of ours, and the frontend is a browser bundle that could not require a Node one. Raising the
  limit is three files plus a `collMod` for every database already built, in one piece of work.
- `userAddressAdd` becomes the only write on the User tier that answers 400 for a well-formed input.
  `validateUserAddress` cannot see it — it is handed one address and knows nothing about the document it is
  going into — so the refusal lives in the lib function, away from every other input rule.
- The failing add costs a second round trip. Paid only on the path that is already failing.

### Risks
- **A copy drifting.** The three numbers agree today and nothing mechanical keeps them agreeing. The
  cheapest symptom is benign — a frontend still offering a seventh form is refused by the server — and the
  expensive one is not: a *service* constant raised above the validator's turns a 400 into a 500. Revisit
  trigger: any change to the number. Grep: `grep -rn "MAX_ADDRESSES\|maxItems" BEs/marketplace-db-setup/lib/schemas/user.js BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressAdd.mts marketplace-user/src/features/account/AddressList.tsx`.
- **A database that never ran the catch-up migration.** `collMod` changes the validator, not the documents;
  a database still on the old validator accepts a seventh address and then cannot be brought current
  without dealing with the documents that already violate the new rule. The Dev database was empty of
  `user` documents when this landed (checked before writing the migration), so nothing was stranded there.
- **Six proving wrong.** It is a product number, not a technical limit — the technical limit is far higher.
  Raising it is the coordinated change described above and needs no design work; *lowering* it is the one
  that strands documents, and would need a data pass before the `collMod`.

---

## Compliance

Verify the rule is the database's:
`grep -n "MAX_ADDRESSES\|maxItems" BEs/marketplace-db-setup/lib/schemas/user.js` — the constant must be
defined and used as `maxItems` on the `addresses` property.

Verify the guard is still a filter clause and still trusted:
`grep -n "addresses.\${MAX_ADDRESSES\|trusted" BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressAdd.mts`
— the cap must appear inside the first argument of `User.updateOne`, wrapped in `trusted(...)`.

Verify both sides stay pinned: `test/integration/addresses.itest.mts` must add six through the real
mutation and assert the seventh's 400 *and* prove the collection refuses a seventh element on insert and on
`$push`; `BEs/marketplace-db-setup/test/migrations.test.mjs` must assert `maxItems` is 6 and that a
seventh address is rejected while an edit to one of the six is not.

Verify the first `collMod` did not become the template for a hand-assembled validator: the two greps in
*This is the first `collMod`* above, replacing ADR-014's first compliance check.

A violation on disk looks like: `maxItems` gone from the validator, a count taken with a separate read
before the `$push`, `trusted(` removed from the filter, or the three numbers no longer equal.
