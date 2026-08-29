# ADR-045 — An inactive shop owner takes the storefront off-air, and only the owner puts it back
# Marketplace

**Status:** accepted
**Date:** 2026-08-29
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Suspending a shop owner does nothing to their shop. `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts:32-34`
— `livePublic()` — filters public reads on `company`'s **own** fields, `{ published: true, deleted: { $exists: false } }`,
and reads nothing at all on `shopOwner`. `companies.mts:59` and `companyBySlug.mts:35` both go through it, so
an owner an operator has suspended (`disabled: true`) or closed (`deleted` stamped) keeps a fully live,
browsable storefront, and every `item` beneath it, to anonymous visitors.

That was tolerable while suspension was one of several levers. It stopped being tolerable on 2026-08-29:
[ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) removed deletion as an
alternative — nothing on this platform is destroyed — and
[ADR-044](./ADR-044-suspension-names-an-actor-and-a-reason.md) made suspension the operator's answer to a
misbehaving tenant. A lever that stops at the login is not an answer when the complaint is about the shop.

The question was opened as a §5 gap the same morning, because nobody had ever decided it either way, and
answered by the platform owner within the day, in three rulings that have to be read together:

> *"yes, suspending or closing a shopOwner takes the storefront off-air"*

> *"I prefer cheap read so denormalised flag on company"*

> *"un-suspending must not re-enable in the same place the companies, shopOwner must re-enable them by
> hands"*

**The third ruling is the one that decides the mechanism.** The obvious objection to writing
`company.published = false` is that it is not reversible: un-suspending could not tell a shop the owner had
*deliberately* taken down from one the platform hid, and would republish the first. That objection only bites
if un-suspending is supposed to restore anything. The platform owner ruled that it is not. **Coming back is
an act the owner performs, not a side effect of an operator clearing a flag** — so there is nothing to
restore, nothing to remember, and no second copy of the truth to keep in sync.

Two things already in the codebase say this is the grain of the design rather than a shortcut:

- **An operator can already unpublish a single shop.** `marketplace-dev-admin-authenticated-resource/src/lib/company/funCompanyUpdatePublished.mts:26-27`
  writes `{ $set: { published } }` with no ownership filter, and its own comment says *"unpublishing here
  hides the shop's whole catalogue in one write."* The cascade is the bulk form of an operation the operator
  has had all along.
- **Republishing after somebody else unpublished is an established flow.** `GraphQLInputItem.mts:32-35`
  keeps `published` out of the update input precisely so a form save cannot *"republish an item an operator
  had just taken down, without ever asking to."* The owner's route back is `companyUpdatePublished`, which
  exists, is gated by `idShopOwner`, and is the only way `published: true` is ever written.

So the cheap denormalised flag on `company` the owner asked for is the one that is already there.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — join `shopOwner` in every public read (`$lookup`) | one source of truth, correct by construction, nothing to keep in sync, and no write path can forget it | `livePublic()` returns a filter fragment for a `find`; a join makes every public catalogue read an aggregation pipeline, on the anonymous hot path, to consult a field that changes perhaps twice in a company's life |
| B — a **new** flag on `company`, e.g. `ownerInactive`, cleared when the owner comes back | keeps `published` untouched, so the owner's own state is preserved across a suspension | the ruling is that nothing is restored automatically, so nothing would ever clear it — leaving either a permanently dead shop or a second owner-facing publish switch that means the same thing as `published` and is guaranteed to drift from it. A field, a validator change, a model change, a backfill and a reconciliation sweep, all to express what one existing boolean already expresses |
| C — filter after the read, in the resolver | no schema change at all | breaks pagination: rows are dropped after `limit` has been applied, so a page of ten can return three and the total count lies. Not viable |
| D — cascade into `company.published`, and never cascade back | no new field, no migration, no model change, no drift: there is only one copy of the truth. `livePublic()` is not touched at all — the clause it needs is the clause it already has. The route back is a mutation the owner already has | the owner's prior publish state is lost — after un-suspension the platform cannot say which shops were live, and the owner has to republish each one from memory. Accepted deliberately: it is the direct consequence of the ruling, not an oversight |

---

## Decision

**Option D. Suspending or closing a shop owner writes `published: false` on every company they own. Nothing
ever writes `published: true` on their behalf.**

The owner comes back to a set of unpublished shops and republishes the ones they want live, one call each,
through `companyUpdatePublished` — the mutation they already use, gated by `idShopOwner`, validated by the
collection's `$expr`.

**No schema change, on any collection.** No new field, no `collMod`, no migration, no Mongoose model edit, no
backfill of existing documents, and no reconciliation sweep. `livePublic()` is not modified — `{ published:
true, deleted: { $exists: false } }` already excludes everything this decision needs excluded. The whole
change is in the two writers of the owner's state.

| Writer | Companies |
|---|---|
| `funShopOwnerUpdateStatus.mts` — sets `disabled` | `Company.updateMany({ idShopOwner }, { $set: { published: false } })` |
| `funShopOwnerUpdateStatus.mts` — clears `disabled` | **nothing** — the owner republishes by hand |
| `funShopOwnerDelete.mts` — stamps `deleted` | `Company.updateMany({ idShopOwner }, { $set: { published: false } })` |
| the retention scrub at day 30 | nothing — the shops are already down and stay down |
| the registration confirmation that inserts a new `shopOwner` | nothing — a new owner has no company yet |

Both writes belong in the **same `session.withTransaction`** as the `shopOwner` write they follow from. A
crash between the two leaves a suspended owner with a live shop, which is the one failure this decision
exists to prevent.

`{ idShopOwner }` carries no `$`-keyed value, so it needs no `trusted()` wrapper — unlike almost every other
filter in this codebase. `$set: { published: false }` is never refused by the collection's `$expr`, which
only demands a `slug` and a `publicName` when `published` is **true**.

**`item` is not touched.** An item disappears because its company does — `livePublic()` gates both, and
`funCompanyUpdatePublished`'s own comment already records that unpublishing a company hides its whole
catalogue. Each item keeps its own `published` value through the whole episode, so republishing the company
brings the catalogue back exactly as the owner left it. Cascading into `item` as well would destroy that and
give the owner a second, much longer list to rebuild by hand.

**The frontend has to say this out loud.** An owner who is un-suspended and finds their shops dark, with no
explanation, will read it as data loss. `marketplace-shopowner` must state on the company list that shops are
unpublished while an account is suspended and have to be republished — a sentence, and the one piece of this
that is not backend work.

**`waitApprov` is deliberately not part of this.** An owner re-gated to awaiting-approval is arguably in the
same position, and re-gating one today leaves their shop live for the same reason suspension did. That is a
separate question about a different field, nobody has asked it, and answering it by analogy is how this gap
was created in the first place. It is noted here so that whoever asks it finds it already framed.

---

## Consequences

### Positive
- **Suspension becomes a real lever.** The operator's only remaining sanction now reaches the thing people
  complain about, which is what ADR-044 assumed it did.
- **Reads do not change at all.** No new clause, no new index, no aggregation on the anonymous hot path. The
  cheapest possible reading of *"cheap read"*: the filter already excludes what has to be excluded.
- **One copy of the truth.** A shop is off-air because `published` is false, and that is the only fact
  anybody has to check. Nothing can drift from anything, so no reconciliation, no invariant query, no
  self-healing sweep — none of it has to exist.
- **Coming back is an explicit, audited act by the owner**, through a mutation with an ownership filter and a
  validator, rather than a bulk write performed on their behalf by an operator clearing an unrelated flag.
- **The catalogue survives intact.** Item-level publish state is untouched, so one call per shop restores
  what could otherwise be hundreds of items of hand work.

### Negative
- **The owner's prior publish state is lost.** After un-suspension the platform cannot say which shops were
  live before, and neither can the owner, except from memory. This is the price of the ruling and is not a
  defect to be fixed later by remembering the old value — remembering it *is* option B.
- **A shop the owner had already unpublished is indistinguishable** from one the platform took down, so the
  owner may republish something they had deliberately taken offline.
- **A silently dark shop.** An owner who never logs back in leaves a storefront down permanently with no
  operator action having explicitly taken it down. That is the intended reading of *"by hands"*, but it means
  un-suspension alone does not restore the platform to its prior state and never will.
- **Items are hidden transitively, not directly.** An `item` has no relationship to `shopOwner`; it
  disappears because its `company` does. Any future public read that reaches `item` without the company
  filter bypasses this entirely.

### Risks
- **A future refactor "helpfully" restoring `published`.** Clearing `disabled` and republishing what was
  unpublished looks like an obvious symmetry and is a direct contradiction of the ruling. It is recorded in
  §4 of the ADR index as a standing temptation, with this ADR as the reason.
- **The two writes escaping their transaction.** Moving the company update outside the session, or into a
  `Promise.all` beside it, reintroduces the window silently. Both writes belong in one
  `session.withTransaction`.
- **An owner with many shops.** `updateMany` over one owner's companies is bounded by how many shops a person
  runs, which is small, but it is a multi-document write inside a transaction and grows with the tenant.
- **The un-suspension path having no test of its own.** Its correct behaviour is that it does *nothing* to
  `company`, which is exactly the kind of assertion that never gets written. It needs an explicit test: clear
  `disabled`, assert every company is still `published: false`.

---

## Compliance

The invariant, as a query anybody can run — it must return zero:

```js
// companies visible to the public whose owner is not live
db.company.aggregate([
  { $match: { published: true, deleted: { $exists: false } } },
  { $lookup: { from: 'shopOwner', localField: 'idShopOwner', foreignField: '_id', as: 'o' } },
  { $match: { $or: [ { 'o.disabled': true }, { 'o.deleted': { $exists: true } } ] } },
  { $count: 'live-shop-of-inactive-owner' },
])
```

```bash
# 1. The cascade exists, on both writers of the owner's state.
grep -rn "published: false" BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/shopOwner/

# 2. Nothing restores it. Expect zero hits outside funCompanyUpdatePublished.
grep -rn "published: true" BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/

# 3. No new flag crept back in. Expect zero hits across all sixteen repos.
grep -rn "ownerInactive" .

# 4. The public read is unchanged — two clauses, not three.
sed -n '31,34p' BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts
```

The suite must prove the case a happy path would miss: **clearing `disabled` leaves every company
`published: false`**. Suspend an owner with two published shops, un-suspend them, assert both are still
unpublished and that the owner can bring one back with `companyUpdatePublished` while the other stays down.

A violation on disk looks like: `published: true` written by any status or closure path; a new
`ownerInactive`-style field on `company`; the company update sitting outside the `shopOwner` write's session;
a cascade reaching `item`; or a public catalogue read that does not go through `livePublic()`.
