# ADR-048 — An admin closes a customer account, and the retention clock starts once
# Marketplace

**Status:** accepted
**Date:** 2026-08-30
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Since ADR-044 an admin could **suspend** a customer and could not **close** one. The Admin tier carried
`shopOwnerDel` for a seller and had no counterpart for `user`, so an account that had to go took a
hand-made write against the one collection encrypted whole. Three documents recorded the absence and none
of them defended it: [`ADR-036`](./ADR-036-erasure-is-not-something-the-platform-suspends.md) §Consequences
called it *"the Admin counterpart is still missing"*, `phase5/epics/E19.md` and `phase5/epics/E20.md` each
carried it as an open question, and `docs/data-model.md` described `deletedBy` as a field only the seller
tier could ever write.

ADR-036 also left a warning for whoever built it:

> *"Whoever builds it inherits this question from the other side and should not assume the answer is
> symmetric: an admin closing somebody else's account is not the exercise of a data-subject right."*

The platform owner settled the shape on 2026-08-29:

> *"admin must act on shop owners and on customers in the same way, and customers must mirror shopOwners
> when deleted, suspended by themself or from admin"*

and ordered the build on 2026-08-30:

> *"so implement Parity build if it is mapped and waiting. ok diff suspension implementation for ensure it
> work in the same way"*

Diffing the two tiers against each other to obey that instruction turned up a second thing. The customer's
**own** close, `funUserDel`, read the document and then wrote it — two round trips with a window between
them — while the seller's `funShopOwnerDel` carries `deleted: {$exists: false}` as a clause of the filter.
The read-then-write shape lets two closures fired at once both see a live account and both stamp `deleted`,
and the second stamp moves the day-30 scrub thirty days further out. That is not a tidiness point: `deleted`
is what [`ADR-041`](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) measures the retention
window from and what [`ADR-046`](./ADR-046-the-retention-window-is-an-undo-window.md) turns into an undo
window, so a re-stamp postpones an erasure the platform already promised.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — leave it: an admin suspends and never closes | nothing to build; suspension already stops a customer using the platform | it does not stop the platform **holding** their data, which is the thing an admin closing an account is for. And it leaves the one operation that has to happen sometimes as a hand write on the collection where every personal field is ciphertext — the least reviewable place on the platform |
| B — extend `userUpdateStatus` with a `deleted` flag | one mutation, one screen, one round trip | it merges two decisions that must stay apart. Closing and suspending write different fields for different reasons, and a mutation able to write both is a mutation able to trade one for the other — the exact laundering ADR-046 keeps the `disabled*` trio across a restore to prevent |
| C — a new `userDel` mirroring `shopOwnerDel` | it is the instruction, literally: same argument, same answer, same actor rule, same revoke. Nothing new to learn, and the divergences are forced by the data rather than chosen | a second closure path on `user`, so `deleted` now has two writers on two tiers and the difference between them has to be carried by something |

---

## Decision

**Option C, and the difference is carried by `deletedBy` exactly as it already is on `shopOwner`.**

1. **`userDel(_id: ID!): Boolean!` on `marketplace-dev-admin-authenticated-resource`**, calling
   `funUserDelete(_id, adminId)`. It stamps `deleted` and `deletedBy` in one guarded write and then ends
   every session the customer holds, unconditionally — a closure has no "off" to compare against, unlike a
   status change. The admin's id comes off `ctx.state.user` and never off the wire (ADR-044).
2. **The three divergences from `funShopOwnerDelete` are forced, not chosen.** No `waitApprov` to drop —
   the customer approval gate was closed permanently on 2026-08-25. No `mongoose.startSession()` — one
   write cannot be half-applied. No storefront cascade — a customer owns no company and no item, since the
   FK chain runs `shopOwner → company → item` and `user` sits outside it, so ADR-045 has nothing to reach
   for here.
3. **A closure writes no `disabled*` field and a suspension writes no `deleted*` field, in either
   direction and on either tier.** ADR-036's warning is answered by keeping the two instruments apart
   rather than by making the admin's closure a weaker version of the customer's: an admin closing an
   account is the platform letting go of it, a customer closing their own is the data-subject right, and
   both stamp the same two fields because the *record* is the same act. What differs is who is named.
4. **`funUserDel` on the customer tier becomes a guarded write** — `deleted: trusted({$exists: false})` in
   the filter, `new Date()` rather than `Date.now()`, and the read demoted to the mismatch branch, where
   it decides between 401 (the session outlived the account) and 410 (already closed). The retention clock
   can therefore start exactly once, whichever tier starts it. The 500 that stood for *"it went away
   between the two queries"* is gone with the two queries.

---

## Consequences

- **`deletedBy` now has two possible writers and its absence still means one thing.** Present: an admin
  closed the account, on either tier. Absent: the holder did. No field names which collection the id came
  from, deliberately — that would be a `role` field arriving by the back door and ADR-002 refuses one.
- **The undo window applies to an admin closure too** (ADR-046). The same person registering again at the
  same address inside thirty days restores the document, `deletedBy` and all. What the restore does **not**
  lift is a suspension: the `disabled*` trio comes back exactly as it stood, so closing a suspended
  customer hands them no way in.
- **An admin can now end a customer's access in one step and cannot undo it in one.** Suspension is
  reversible by the tier that applied it; closure is reversible only by the customer, and only by
  re-registering. That asymmetry is deliberate and is the same one the seller tier has had since ADR-041.
- **`funUserDel`'s 500 branch is gone**, and with it the test that covered it. Nothing else answered 500 on
  that path, so no caller loses a case it handled — the two refusals a guarded write can produce are the
  two it already answered.
- **No migration.** `user.deletedBy` has been in `lib/schemas/user.js` and on the model since ADR-044; it
  simply had no writer until now.
- **Neither closure has a screen.** `shopOwnerDel` has had none since it was built and `userDel` has none
  either, which keeps the two tiers at parity in the admin app as well. Add the operation document in
  `marketplace-admin` alongside the screen that needs it, not before.

---

## Compliance

The Admin tier can close both kinds of account, and by the same route:

```bash
# Two files, one per account collection, both taking (_id, adminId).
ls BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/{shopOwner,user}/fun*Delete.mts
```

No closure path writes a suspension field, and no suspension path writes a closure field:

```bash
# Silence on both — the docblock lines are dropped first, since each helper names the other's field in
# prose to say it does not write it. The two instruments never touch each other's fields in code.
A=BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/user
grep -vE '^\s*(\*|/\*)' $A/funUserDelete.mts | grep -n 'disabled'
grep -vE '^\s*(\*|/\*)' $A/funUserUpdateStatus.mts | grep -n 'deleted'
```

Every closure on `user` guards the stamp in its filter, so the clock starts once:

```bash
# Two hits, one per tier — funUserDelete.mts and funUserDel.mts. `-F`, because the pattern is full of
# regex metacharacters and ugrep reads a bare one as an extended regular expression.
grep -rlF 'deleted: trusted({ $exists: false })' \
  BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/user/ \
  BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/
```
