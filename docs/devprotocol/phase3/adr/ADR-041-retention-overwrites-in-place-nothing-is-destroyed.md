# ADR-041 — Nothing is destroyed: closure is a stamp, and retention expiry overwrites the personal data in place
# Marketplace

**Status:** accepted, **superseded in part 2026-08-29**
**Date:** 2026-08-29
**Deciders:** platform owner
**Supersedes:** [ADR-011](./ADR-011-soft-delete-and-global-uniques.md), **in part** — the 2026-08-26
Amendment only. The main body of ADR-011, its Decision and its refusal of Option C, are untouched and
still govern `company`, `shopOwner`, `item` and `itemCategory`.
**Superseded by:** [ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md), **in part** — the thirty
days are now an **undo** window. Closure is still a stamp, nothing is still ever destroyed, and the day-30
overwrite is unchanged; what this page got wrong is that `deleted` is never cleared. Re-registering at the
same address inside the window clears it and hands the account back.

---

## Context

ADR-011's Amendment of 2026-08-26 permitted two removals, on `user` alone: the `deleted_ttl` index
(`BEs/marketplace-db-setup/lib/schemas/user.js:244,285-296`, applied by
`migrations/20260301000300-create-user.js`) removes a closed document thirty days after `funUserDel`
stamped it, and `purgeClosedUser`
(`BEs/dev/marketplace-dev-public-resource/src/lib/db/purgeClosedUser.mts:39-49`) brings that removal
forward to the moment the same address registers again. It is the only hard delete anywhere in the fifteen
repos.

The Amendment solved a real problem — a closed account kept its email address, so closing an account burned
it — and it solved it by destroying the document. Asked to confirm that trade on 2026-08-29, the platform
owner reversed it:

> *"Reverse it — stamp-only forever but allow re register again with that email. after that period of 30
> days, clear user personal data but do not delete the user document that record him. same for shopOwner"*

Three things follow from that sentence, and all three are constraints rather than preferences.

**The document is the record that the person existed.** A removed `user` leaves the platform unable to
answer *was there ever an account on this address, and what became of it* — which is the question an
admin asks first, and the question an audit of a closure asks. ADR-011's Amendment treated the document
as nothing but a container for personal data; the owner treats it as two things, a container and a record,
and only the first is erasable.

**`shopOwner` cannot be removed at all.** The Amendment restricted itself to `user` on the explicit ground
that *nothing on the platform holds a `user._id`* — `company.idShopOwner` holds a `shopOwner._id`, so a
removed shop owner strands every company beneath it. "Same for shopOwner" is therefore not a widening of
the Amendment by analogy; it is only implementable at all because the mechanism changed from removal to
overwrite. ADR-011's own warning — *"the next collection that acquires a retention period will look like
this one. It is not"* — is honoured rather than ignored: the exception it feared was a second `deleteOne`,
and this ADR retires the first.

**The address must come back within the thirty days, not after them.** The owner was explicit that the
window is not a lockout:

> *"days 1-30 the user must be able to register again !!"*

That is what makes this hard. `user.login.email_unique` and `shopOwner.login.email_unique` are the same
index, shared verbatim from `BEs/marketplace-db-setup/lib/schemas/account.js:161-171`, with **no `sparse`
and no `partialFilterExpression`**. A closed document holds its address until something changes the value,
so between day 1 and day 30 the address is spoken for while the person is entitled to it. ADR-011 refused
`partialFilterExpression` for a reason that has not weakened — three call sites look an account up by email
with no liveness filter, `tryLoginUser.mts`, `userForRegistration.mts` and the verify-email flow in
koa-utils, and two documents holding one address make `findOne` a coin toss — so the address has to be
freed by changing the *value*, not by teaching the index to ignore it.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — keep ADR-011's Amendment: TTL removal at day 30, plus `purgeClosedUser` bringing it forward | already shipped and already proved; erasure is a property of the schema, carried out with no code | destroys the record of the account having existed, which the owner declined; unavailable on `shopOwner`, where `company.idShopOwner` would dangle; leaves the platform's only hard delete in place, an exception ADR-011 itself flagged as liable to widen by analogy |
| B — keep the document, `$unset` every personal path at day 30 | the obvious reading of *"clear user personal data"*; no new values to invent | **fatal on the index.** `login.email_unique` has no `sparse`, so a missing `login.email` is indexed as `null`; the first scrubbed account takes `null` and the second collides with `E11000` at the moment of erasure. It also breaks the validator's `required` arrays and every non-nullable GraphQL field reading those paths |
| C — keep the document, **overwrite** every personal path with a placeholder, the identifying ones derived from `_id` | every path stays present, so `required`, the unique index and the non-nullable resolvers all keep working unchanged; `deleted-<_id>@invalid.local` is unique by construction, because `_id` is; no index, no `sparse`, no partial filter, no migration to the index at all | the placeholders are values the codebase has to recognise as not-a-person; a scrubbed document is indistinguishable from a live one to any reader that does not check `scrubbedAt` |
| D — `partialFilterExpression` on `login.email_unique` so closed documents leave the index | frees the address the instant it is stamped, with no scrub and no placeholder | refused by ADR-011 and still refused, for the same three call sites. Two documents would hold one address and `findOne` would return an arbitrary one of them — login becomes a coin toss and re-registration a race |

---

## Decision

**Option C, on `user` and on `shopOwner` alike. No application code and no index removes a document from
this platform. ADR-011's Amendment is superseded: `deleted_ttl` is dropped and `purgeClosedUser` is
deleted.**

The lifecycle is three states and one clock.

1. **Closure stamps `deleted`** — four writers, one per tier and account kind: `funUserDel` and
   `funShopOwnerDel` for a holder closing their own account, `funUserDelete`
   ([ADR-048](./ADR-048-an-admin-closes-a-customer-account.md)) and `funShopOwnerDelete` for an admin closing
   somebody's. All four stamp the same field and start this same clock; the admin pair also writes
   `deletedBy`, which is what says who closed it (ADR-044). Each mutation revokes every session that
   account holds, in the same operation and unconditionally — a closure has one direction. ⚠️ **Every one
   of the four guards the stamp in its filter** — `deleted: trusted({$exists: false})` — so the thirty days
   below are measured from the first closure and a second one answers 404 or 410 instead of restarting
   them. A read-then-write would let two concurrent closes both stamp and push the day-30 overwrite thirty
   days out; the `trusted()` wrapper is what keeps `sanitizeFilter` from rewriting the clause into an
   equality that matches nothing.
2. **Days 1 to 30, the document is untouched and still holds the address.** Nothing is cleared early and
   nothing is destroyed. The window is an undo window ([ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md)): registering again at that address
   and confirming the message clears `deleted` and hands the same document back, which is the only way
   back in and takes the holder proving control of the address again.
3. **At day 30 the personal data is overwritten in place** and `scrubbedAt` is stamped. The document
   survives, permanently, carrying `_id`, `deleted`, `deletedBy`, `disabled`, `disabledBy`, the registration
   date and `scrubbedAt` — enough to answer *there was an account, it closed on this date, at whose
   instruction* and nothing more.

The placeholders are fixed by this ADR, not left to the implementation:

```
login.email       → `deleted-${_id}@invalid.local`     (unique by construction — `_id` is)
login.password    → a bcrypt hash of crypto.randomBytes, well-formed, no known preimage
name              → 'Deleted User'
```

⚠️ **`login.password`'s placeholder must be a real 60-character bcrypt hash, not sixty `x`s.**
`tryLoginUser` reads by email and compares before the liveness check refuses; a malformed hash turns a
refusal into an error path, and `LOGIN`'s validator pins the length at exactly 60 either way.

**The scrub list is derived by exclusion, never hand-maintained.** A keep-list names the handful of paths
that survive; every other path on the collection is overwritten if the validator requires it and removed if
it does not. This is the direct answer to `purgeClosedUser`'s own docblock, which argued against
scrub-in-place precisely because *"emptying a document in place is a list of paths to `$unset`, and every
field added to `user` afterwards is one the next holder of that address silently inherits"*. Inverted, that
objection disappears: a field added later is scrubbed by default, and keeping it takes a deliberate edit to
the keep-list with a reviewer looking at it.

Its second objection — that one `_id` would end up holding two data subjects — is answered by the
re-registration path rather than argued away. **A returning person gets a new document with a new `_id`.**
The old one is never revived, never reused and never logged into again.

**Retention therefore reads: thirty days after closure, or the moment the same address is confirmed by a new
registration, whichever comes first.** The second clause is the same bring-forward `purgeClosedUser`
performed, with overwrite in place of removal: when a new registration for that address is confirmed, one
Mongo transaction scrubs the closed document — freeing the address by changing its value — and inserts the
new one. That transaction is specified in
[ADR-042](./ADR-042-registration-is-a-pending-redis-record.md), which is what makes the days-1-to-30 window
work at all: no second document exists to collide until the moment the first one stops holding the address.

**The scrub at day 30 is carried out by a sweeper, and the sweeper is application code.** This is the cost of
the reversal and it is stated plainly: ADR-011's Amendment could say *"the stamp is the decision to erase and
the index is the erasure — there is no job, no scheduler and no application code involved, which is also why
nothing can forget to run it."* That sentence stops being true here. A TTL index can only delete a whole
document; it cannot modify a field, so no index can carry out an overwrite. The sweeper runs on an interval
inside `marketplace-dev-admin-authenticated-resource` — the admin surface, which already writes both
collections and is not the internet-facing unauthenticated service — under a single-key Redis lock
(`SET NX PX`) so that a multi-instance deployment scrubs once.

⚠️ **The sweeper's filter must be wrapped in `trusted()`.** `sanitizeFilter` is on process-wide; a
`$`-keyed filter that is not wrapped is rewritten to `{$eq: <object>}` and matches nothing, silently and
forever. A sweeper that no-ops looks exactly like a sweeper with nothing to do
(`usersActiveTblDb.mts:127-130` documents the trap; `purgeClosedUser.mts:39,49` is the existing correct use,
and it is being deleted, so the last live example of the idiom goes with it).

---

## Consequences

### Positive
- **No hard delete anywhere.** The convention ADR-011 stated on 2026-08-04 — *no application code on this
  platform removes documents* — is true again, without the exception, and `grep -rn 'deleteOne\|deleteMany\|findOneAndDelete' BEs/dev/*/src/`
  goes back to returning prose only.
- **`shopOwner` gets a retention period and a reclaimable address, which it has never had.** ADR-011 left
  this open in as many words — *"whoever builds one inherits this question and should answer it here rather
  than assume symmetry"* — and the answer is symmetry, arrived at from the other end: the mechanism that
  makes it safe for `shopOwner` is the one that stops removing documents, so `company.idShopOwner` never
  dangles.
- **The index is untouched.** No `sparse`, no `partialFilterExpression`, no migration against
  `login.email_unique` on either collection. ADR-011's Option C refusal is honoured rather than routed
  around, and the three liveness-blind call sites keep working because there is never more than one
  document per address.
- **Closure becomes auditable.** A closed account leaves a permanent row an admin can find, with a date
  and an actor ([ADR-044](./ADR-044-suspension-names-an-actor-and-a-reason.md)), rather than a hole where a
  record used to be.

### Negative
- **Erasure is now a job, and a job can fail to run.** If the admin service is down for a week, the scrub is
  a week late, and nothing in the schema says so. ADR-011's Amendment had exactly the property this gives
  up. What replaces it is a check rather than a guarantee — see §Compliance.
- **A scrubbed document is not obviously scrubbed.** `deleted-…@invalid.local` reads as an address, and
  `Deleted User` reads as a name, to any resolver that does not look at `scrubbedAt`. Nothing on the
  platform displays closed accounts today, so this is a trap for the next surface that does rather than a
  present defect.
- **The keep-list is a second place a schema change has to be considered.** Adding a field to `user` or
  `shopOwner` now has a scrub consequence, and the default — it gets scrubbed — is the safe one, which is
  the point, but it is still a place to look.
- **`disabledReason` cannot simply be removed by the scrub.** The validator requires it whenever
  `disabled` is true (ADR-044), so removing it makes an already-suspended document unwritable; it is
  overwritten with a fixed string, like every other required path. This interaction is the reason the scrub
  is specified as overwrite-or-remove-per-path rather than as a blanket `$unset`.

### Risks
- **The two mechanisms must land together.** Dropping `deleted_ttl` without the sweeper leaves closed
  accounts holding their addresses forever with no erasure at all; shipping the sweeper without dropping the
  index leaves MongoDB's TTL monitor deleting the very documents this ADR exists to keep, on a schedule
  nothing in the sweeper can see. ⚠️ `user.js:281-283` records that `collMod` can only *retune*
  `expireAfterSeconds` — there is no `collMod` path that strips TTL-ness — so retiring it takes
  `dropIndex('deleted_ttl')` in a **new** migration, applied in the same piece of work as the sweeper.
  Migrations are immutable (ADR-014): the existing one is not edited.
- **A database built before this ADR still has `deleted_ttl`.** The same hazard ADR-011 recorded in the
  other direction, for the same reason — `migrate-mongo-config.js` sets `useFileHash: false`, so the
  changelog cannot say which version of a migration ran. Verify `db.user.getIndexes()`, not the changelog.
- **The sweeper widening its own filter.** It exists to scrub documents whose `deleted` is older than the
  retention period and whose `scrubbedAt` is absent. A future change that lets it match on anything else is
  a mass overwrite with no undo. The filter belongs in one function with its own tests, the way
  `purgeClosedUser` kept its `deleted` clause in the write rather than in the caller.
- **`deleted` and `scrubbedAt` must stay unencrypted.** `deleted` is absent from `ENCRYPTED_FIELDS_*`
  (ADR-029) and `scrubbedAt` joins it: the sweeper compares both server-side, and a deterministic
  ciphertext supports equality but not `$lte`. Encrypting either silently stops the scrub — no error, and
  the validator would still accept every write.

---

## Compliance

The retirement is complete only if all four hold:

```bash
# 1. No TTL index anywhere. Expect zero hits.
grep -rn "expireAfterSeconds" BEs/marketplace-db-setup/lib/

# 2. No hard delete in any service. Expect prose only — no call.
grep -rn 'deleteOne\|deleteMany\|findOneAndDelete' BEs/dev/*/src/

# 3. purgeClosedUser is gone, not merely unreferenced.
test ! -e BEs/dev/marketplace-dev-public-resource/src/lib/db/purgeClosedUser.mts && echo retired

# 4. The scrub keep-lists exist and are the only place field names are enumerated.
grep -rn "SCRUB_KEEP" BEs/
```

⚠️ **Verify the running database, not the changelog:**

```js
db.user.getIndexes()        // must NOT list deleted_ttl
db.shopOwner.getIndexes()   // must not have grown one either
```

The sweeper's filter must keep both clauses and keep them wrapped:
`trusted({ deleted: { $lte: cutoff }, scrubbedAt: { $exists: false } })`. An unwrapped filter is a permanent
no-op that reports success, so the integration test must prove a scrub against a real collection — a unit
test asserting the filter object cannot tell the two apart.

A violation on disk looks like: any `deleteOne`/`deleteMany`/`findOneAndDelete` under `BEs/dev/*/src/`; a
`partialFilterExpression` or `sparse` appearing on either `login.email_unique`; `expireAfterSeconds`
reappearing in `lib/schemas/`; `deleted` or `scrubbedAt` appearing in an `ENCRYPTED_FIELDS_*` list; a scrub
that `$unset`s a path the validator requires; or a second enumeration of field names outside the keep-list.
