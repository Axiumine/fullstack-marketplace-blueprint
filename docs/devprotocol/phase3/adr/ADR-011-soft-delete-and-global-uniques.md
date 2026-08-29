# ADR-011 — Soft delete by a deleted date stamp, with global uniques that a retired company keeps occupying
# Marketplace

**Status:** accepted, amended 2026-08-26, **the amendment superseded 2026-08-29**
**Date:** 2026-08-04
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md), **in part** — the 2026-08-26 Amendment
only. The main body below is untouched and still states the platform's soft-delete convention for all
five collections.
**Amended:** 2026-08-26 — see [§Amendment](#amendment--2026-08-26-the-user-collection-is-destroyed-rather-than-kept). Everything below stands for
`company`, `shopOwner`, `item` and `itemCategory`. It no longer describes `user`, which is the only
collection on the platform whose documents are removed — by a TTL index, and by one application write.
⚠️ **That last sentence stopped being true on 2026-08-29**, when [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) reversed the
amendment: no collection on this platform has its documents removed, `user` included. The amendment is
left standing below, struck where it no longer describes the tree, because it is cited elsewhere and a
reader arriving at it needs to be told rather than to find nothing.

---

## Context

`company` carries two identity fields under global unique indexes: `vatNumber` and `certifiedEmail` —
one legal entity, one VAT number, whoever registered it (ADR-007). `companyDel` needs a delete path, and
two things collide there: the platform-wide soft-delete convention (`shopOwner`, `item`, `itemCategory`
all carry an optional `deleted` date, never a hard remove — `BEs/marketplace-db-setup/lib/schemas/account.js`
`DELETED` shape) and the fact that a hard-deleted document frees its unique keys for reuse while a
soft-deleted one, by default, does not. Someone has to decide whether a retired VAT number becomes
available again.

Two resource services expose `companyDel` against the same collection under different tiers:
`BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts`
(ShopOwner, acting on companies they own) and
`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts`
(Admin, acting on any company). Both stamp `deleted` via `funCompanyDelete`; only the ShopOwner path runs
an ownership guard first (`throwIfShopOwnerDontOwnCompany`), and that guard's filter has to decide
whether an already-retired company still counts as "yours to act on."

Both answers already have a precedent on this platform, which is what makes the choice a real one.
`shopOwner.login.email_unique` is a plain global unique with no `partialFilterExpression`, so a disabled
or deleted shop owner keeps their login email occupied. And `company.slug_unique`, on this very
collection, **is** a partial index (`partialFilterExpression: { slug: { $type: 'string' } }`) — so the
partial-index tool is in hand for exactly these fields, and pointing it at `vatNumber` /
`certifiedEmail` is a decision, not an omission.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A. Hard delete the document | Frees `vatNumber`/`certifiedEmail` immediately | Breaks platform soft-delete convention every other collection follows; loses the retirement date; any dangling `item.idCompany` reference (unenforced) now points at nothing at all instead of a stamped, inspectable document |
| B. Soft delete (`deleted` date stamp) + global unique index, no `partialFilterExpression` — CHOSEN | Matches `shopOwner.login.email_unique` precedent exactly; one VAT number can never be double-assigned, retired or not; enforcement is the index itself, nothing to forget in application code | Same legal entity can never re-register under the same `vatNumber` again, ever — no un-retire path exists |
| C. Soft delete + partial unique index filtered on `deleted` absent (the `company.slug_unique` pattern, same collection) | Retired VAT number becomes registrable again; symmetric with how `slug` behaves on this same collection | Weakens "one VAT number is one company, whoever registered it and whenever they stopped trading" to "one *live* VAT number" — two different companies could hold the same VAT number across time, and nothing downstream distinguishes that from data corruption |
| D. Push a `deleted`-filter into the delete write itself (`funCompanyDelete`), uniform across both tiers, instead of leaving it to the ownership guard | One code path, one answer, same status for both tiers | Conflates two different questions — "is this document still live" (a read/existence concern) with "should this write happen" (idempotency of the delete verb itself); would make the Admin tier's moderation ability depend on liveness, which it deliberately does not need |

---

## Decision

Row B, plus the tier split that falls out of where row D was rejected. `companyDel` stamps `deleted`
(a date, never a bool — `BEs/marketplace-db-setup/lib/schemas/account.js` `DELETED` shape) rather than
removing the document, matching `shopOwner`/`item`/`itemCategory`. `vatNumber_unique` and
`certifiedEmail_unique` are plain global uniques with no `partialFilterExpression`
(`BEs/marketplace-db-setup/migrations/20260301000200-create-company.js`) — the same shape as
`shopOwner.login.email_unique`, and deliberately not the shape `company.slug_unique` uses on the same
collection, because a VAT number is a legal identity and a slug is a URL segment: reusing a retired URL
is harmless, reusing a retired VAT number is not.

Row D was rejected on the reasoning, not just the outcome: liveness filtering belongs on read paths
and on existence/ownership guards, never on the delete write itself. That single rule produces both
observed tier behaviors from one cause. ShopOwner tier's
`throwIfShopOwnerDontOwnCompany` (`BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts`)
is an *ownership* guard — `Company.countDocuments({ _id, idShopOwner, deleted: trusted({ $exists:
false }) })` — and it filters `deleted` because an already-retired company is gone from
`shopOwnerCompanies`, so the only way a client still names one is a stale id it kept from before; a
second `companyDel` on it answers 403. Admin tier's `companyDel.mts` calls `funCompanyDelete` with no
ownership or liveness guard in front of it at all — an operator's job is to be able to act on any
company, retired or not, for moderation, and gating that on `deleted` would block exactly the companies an
operator most needs to reach. Both answers are correct for what each guard checks; neither tier was
"fixed" to match the other.

---

## Consequences

### Positive
- Idempotent audit trail: a retired company's document, its retirement date, and its VAT and certified-mailbox history all
  stay on disk and queryable, matching every other soft-deleted collection on the platform.
- No double-assignment window: the unique index enforces "one VAT number, one company" at the database
  layer, not in application code that a future resolver could forget to check.
- Tier divergence is explainable from one rule (liveness belongs on read/ownership paths, not the
  delete write) instead of being two independently-tuned behaviors that could drift apart under
  maintenance.

### Negative
- No re-registration path: a legal entity that retires a company can never register a new one under the
  same `vatNumber`/`certifiedEmail` — there is no un-retire mutation and no migration undoes the index
  behavior without a schema change.
- A shopOwner cannot tell, from the 403 alone, whether a company id is foreign to them or simply
  already retired — both answer identically, by design, but that collapses two distinguishable
  failure states into one error for the caller.

### Risks
- **Tier-parity drift.** If a future edit adds a `deleted` filter to Admin's `funCompanyDelete` (or
  removes it from `throwIfShopOwnerDontOwnCompany`) to "make the two tiers consistent," it silently
  reverses this decision. Revisit only if product explicitly decides both tiers must return the same
  status on an already-retired company — that has not been asked for.
- **Re-registration demand.** If a real shop owner needs to reincorporate under a VAT number they
  previously retired on this platform, today's only fix is a manual document edit, outside any
  resolver. Revisit if this is requested more than once — a dedicated "reinstate" flow becomes
  cheaper than repeated manual intervention at that point.

---

## Compliance

Verify the index shape has not drifted: `grep -n "vatNumber_unique\|certifiedEmail_unique" -A3
BEs/marketplace-db-setup/migrations/20260301000200-create-company.js` must show no
`partialFilterExpression` on either block, while `slug_unique` in the same file must keep the one it
has. Changing either is a schema change and carries the full-rebuild rule of ADR-014.

Verify the tier split: `BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts`
must still filter `deleted: trusted({ $exists: false })` inside its `countDocuments`; `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts`
must still call `funCompanyDelete` with no preceding guard. A violation is either file gaining/losing
that `deleted` clause without this ADR being superseded first.

No `price` field, no `Order`/`Cart` reference is implied or required by this decision — soft delete on
`company` is orthogonal to commerce, which remains unbuilt.

---

## Amendment — 2026-08-26: the `user` collection is destroyed rather than kept

**Status:** accepted
**Deciders:** platform owner
**Scope:** the `user` collection only. `company`, `shopOwner`, `item` and `itemCategory` are untouched,
and none of the reasoning above is withdrawn for them.

⚠️ **Superseded 2026-08-29 by [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md), in part.** What is withdrawn is
this amendment's *mechanism* — the TTL index and the one application delete — and nothing else. Its
reading of the problem stands word for word: a closed account did burn its address, the retention period
was real, and a retention period nothing carries out is not a retention period. ADR-041 answers all three
by overwriting the personal data in place instead of destroying the document, which is also what let the
same rule reach `shopOwner` — see *§Why `user` and no other collection* below, which asked for exactly
that and got it.

### What this ADR was being read as saying

Row B was decided about `company`, but it is the platform's statement of the soft-delete convention and
it has been cited as one — including by ADR-036, by three repository `CLAUDE.md` files and by
`funUserDel`'s own header. The sentence people took from it is *no application code on this platform
removes documents*. That reading was correct on 2026-08-04, when every collection it covered was one
somebody or something still pointed at.

### What changed under it

Three things, all on 2026-08-26, none of which existed when row B was written.

1. **GDPR became scope as a matter of fact, not of choice** — NFR-CO02, open question 1 closed. Art.
   5(1)(e) then asks how long personal data is kept after it stops being needed, and the owner answered:
   **30 days after an account is closed**, open question 6.
2. **`userDel` shipped** (ADR-036) — the first delete on this platform whose subject is a *person's*
   relationship with it rather than a business record. It stamps `user.deleted` and revokes every session.
3. **The stamp made the address unusable.** `login.email_unique` has no `partialFilterExpression` — by
   this ADR — so a closed account keeps its email. `userRegister` reads a closed document as verified and
   answers "you are already registered", while `loginUser` refuses the same address 401. There is no
   un-delete and no Admin counterpart to reach it with. Under the original reading that was permanent:
   **closing an account burned its email address**, and the only remedy was a hand edit in the database.

A retention period that nothing carries out is not a retention period, and row B as read forbade the only
mechanism that would carry it out. That is the conflict this amendment resolves.

### Decision

~~**Two removals are permitted, and only on `user`.**~~ **— superseded 2026-08-29: none are, on any
collection.** Both mechanisms below are retired by [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md); `deleted_ttl` is dropped by a
new migration and `purgeClosedUser.mts` is deleted. What replaces them is an in-place overwrite at the
same thirty days, brought forward by the same re-registration, carried out by a sweeper rather than by
the storage engine. The two items below are kept as the record of what was retired:

1. **`user.deleted_ttl`** — a TTL index over `deleted`, `expireAfterSeconds: 2592000`, declared in
   `BEs/marketplace-db-setup/lib/schemas/user.js` and applied by
   `migrations/20260301000300-create-user.js`. MongoDB removes the document 30 days after `funUserDel`
   stamped it. **The stamp is the decision to erase and the index is the erasure** — there is no job, no
   scheduler and no application code involved, which is also why nothing can forget to run it.
2. **`purgeClosedUser`** — `BEs/dev/marketplace-dev-public-resource/src/lib/db/purgeClosedUser.mts`, one
   `deleteOne`, reachable only from `userRegister` and only for a document that is both stamped and
   verified. It destroys the closed account and registers the address again in the same transaction. This
   is not a second policy: it is the *same* removal, brought forward to the request that needs the
   address, so the erasure happens earlier than the retention rule requires rather than later.

~~Retention therefore reads **"30 days after closure, or until the same address registers again, whichever
comes first."**~~ **— the sentence survives the supersession almost intact.** Under ADR-041 it reads
*"30 days after closure, or the moment the same address is confirmed by a new registration, whichever
comes first"* — the clock, the bring-forward and the trigger are unchanged, and only what happens at the
end of it is: the document is emptied rather than removed. ⚠️ **`registers again` becomes `is confirmed`**,
which is not a wording change: the closed document is now untouched until the link is clicked
([ADR-042](./ADR-042-registration-is-a-pending-redis-record.md)).

⚠️ **Option C is still rejected, and this amendment is not a way back to it.** The address is freed
because the *document* goes, never because the index learns to ignore it. Three call sites look an
account up by email with no liveness filter —
`marketplace-dev-public-authorization/src/lib/db/login/tryLoginUser.mts`,
`marketplace-dev-public-resource/src/lib/db/userForRegistration.mts` and the verify-email flow in
koa-utils — and a `partialFilterExpression` would let two documents hold one address, at which point
`findOne` returns an arbitrary one of them and login is a coin toss. `user.login.email_unique` keeps
exactly the shape row B gave it.

### Why `user` and no other collection

| | Referenced by | Its unique key is | Retention decided | Removal |
|---|---|---|---|---|
| `company` | `item.idCompany` | a legal identity — VAT, PEC | no | stamp only |
| `shopOwner` | `company.idShopOwner` | a credential | no | stamp only |
| `item` | — | a per-company slug | no | stamp only |
| `itemCategory` | `item.idCategory`, `itemCategory.idParent` | a URL segment | no | stamp only |
| `user` | **nothing** | a credential | **yes — 30 days** | TTL, plus one write |

`user` is the only row where all four columns line up. Nothing on the platform holds a `user._id`, so a
removed document strands no reference. Its unique key is an address somebody proves they control, not a
legal identity that must never be reassigned — the whole of §Decision's VAT argument is about a key
`user` does not have. And it is the only collection anyone has decided a retention period for, because it
is the only one holding a *data subject* rather than a trader's registration.

⚠️ **`shopOwner` is deliberately not included, and the two rows above are closer than they look.** A shop
owner's address is a credential too. What separates them is that `company.idShopOwner` points at it, and
that no Art. 17 self-service path exists on that tier — a shop owner cannot close their own account today.
Whoever builds one inherits this question and should answer it here rather than assume symmetry.
⚠️ **Answered 2026-08-29, and the answer is symmetry — reached from the other end.** [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md)
gives `shopOwner` the same thirty-day retention and the same reclaimable address, and it is safe there
precisely because it stops removing documents: the objection in this paragraph — `company.idShopOwner`
points at it — is an objection to *deletion*, and an overwrite strands no reference. The self-service
Art. 17 path this paragraph also notes as missing is still missing; a shop owner is closed by an
operator, and the retention clock starts from that stamp either way.

### Consequences

#### Positive
- The retention decision is carried out by the database, so "we purge after 30 days" is a property of the
  schema rather than a claim about a job somebody has to keep running.
- Closing an account costs its owner nothing if they come back: the address is theirs again on the next
  registration, and the account they get is genuinely new — new `_id`, no personal data, unverified.
- The erasure is complete. Emptying a document in place is a list of paths to `$unset`, and every field
  added to `user` afterwards is one the next holder of that address silently inherits.

#### Negative
- The convention now has an exception, and "no application code hard-deletes" is no longer true as
  written. Anybody reasoning from the shape of the code will find one `deleteOne` and has to come here.
- A closed account is unrecoverable after the TTL fires, and immediately unrecoverable if the address is
  registered again. That is what erasure means, and there is no undo to build.
- `user` carries two indexes over `deleted` — `deleted_ttl` and `tbl_active_registeredAt` — which reads as
  redundancy and is not: `expireAfterSeconds` is rejected on a compound index, so the TTL cannot ride
  along on the other one.

#### Risks
- **The exception widening by analogy.** The next collection that acquires a retention period will look
  like this one. It is not: this amendment turns on *nothing references `user`*, and the four rows above
  all fail that test today. Revisit per collection, in this file, never by pattern-matching.
- **A database built before 2026-08-26 has no `deleted_ttl`.** The index was added by editing an already
  applied migration — the owner's call, taken because every database here is replayable — and
  `migrate-mongo-config.js` sets `useFileHash: false`, so the changelog says the migration ran and cannot
  say which version of it ran. A database that was not dropped and replayed keeps every closed account
  forever while reporting itself fully migrated.
- **`deleted` must stay unencrypted.** A TTL index is evaluated server-side and can only read plaintext.
  `deleted` is absent from `ENCRYPTED_FIELDS_USER` (ADR-029) and adding it would silently stop the purge —
  no error, no expiry, and the collection's own validator would still accept every write.

### Compliance

⚠️ **Superseded 2026-08-29.** Every check below verifies a state [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) removes: the
TTL index must now be **absent**, and `deleteOne` must return no call sites at all rather than one. Run
ADR-041 §Compliance instead. The greps are kept because their inverses are exactly the violations to
watch for now — a `deleted_ttl` reappearing, or a second `deleteOne` arriving.

Verify the index exists and expires at 30 days, on `user` and nowhere else:

```bash
# `deleted_ttl`, key { deleted: 1 }, expireAfterSeconds 2592000 — and nothing on any other collection.
grep -n "deleted_ttl\|CLOSED_ACCOUNT_RETENTION_SECONDS" BEs/marketplace-db-setup/lib/schemas/user.js
```

`BEs/marketplace-db-setup/test/migrations.test.mjs` pins both halves against a real replay: the index's
key, period and options, and that no other collection carries an `expireAfterSeconds` at all.

⚠️ **Verify the running database, not the changelog** — they can disagree, and only one of them is
evidence:

```js
db.user.getIndexes()   // must list deleted_ttl; if it does not, drop and replay
```

Verify the hard delete is still the only one, and still unreachable for a live document:

```bash
# Three hits, exactly one of them a call: purgeClosedUser.mts. The other two are prose in
# verifyEmailFlow.mts and verifyEmailFlowUser.mts, explaining why koa-utils stopped doing one.
grep -rn 'deleteOne\|deleteMany\|findOneAndDelete' BEs/dev/*/src/
```

`purgeClosedUser`'s filter must keep `deleted: trusted({ $exists: true })` — the guard is in the write, not
in the caller, so a future caller cannot skip it. `test/registrationDb.test.mts` asserts the filter and
`test/integration/index.itest.mts` proves against a real collection both that a live document survives it
and that a closed address can be deleted and re-inserted inside one transaction.

A violation on disk looks like: a `partialFilterExpression` appearing on `user.login.email_unique`, a
second `deleteOne` anywhere under `BEs/dev/*/src/`, `deleted` appearing in `ENCRYPTED_FIELDS_USER`, or
`purgeClosedUser` losing the `deleted` clause from its filter.
