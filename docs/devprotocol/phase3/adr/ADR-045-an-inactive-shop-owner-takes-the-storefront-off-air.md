# ADR-045 — An inactive shop owner takes the storefront off-air, and only the owner puts it back
# Marketplace

**Status:** accepted, **amended 2026-08-29** — see the Amendment at the foot of this page
**Date:** 2026-08-29
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Suspending a shop owner does nothing to their shop. `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts:32-34`
— `livePublic()` — filters public reads on `company`'s **own** fields, `{ published: true, deleted: { $exists: false } }`,
and reads nothing at all on `shopOwner`. `companies.mts:59` and `companyBySlug.mts:35` both go through it, so
an owner an admin has suspended (`disabled: true`) or closed (`deleted` stamped) keeps a fully live,
browsable storefront, and every `item` beneath it, to anonymous visitors.

That was tolerable while suspension was one of several levers. It stopped being tolerable on 2026-08-29:
[ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) removed deletion as an
alternative — nothing on this platform is destroyed — and
[ADR-044](./ADR-044-suspension-names-an-actor-and-a-reason.md) made suspension the admin's answer to a
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
an act the owner performs, not a side effect of an admin clearing a flag** — so there is nothing to
restore, nothing to remember, and no second copy of the truth to keep in sync.

Two things already in the codebase say this is the grain of the design rather than a shortcut:

- **An admin can already unpublish a single shop.** `marketplace-dev-admin-authenticated-resource/src/lib/company/funCompanyUpdatePublished.mts:26-27`
  writes `{ $set: { published } }` with no ownership filter, and its own comment says *"unpublishing here
  hides the shop's whole catalogue in one write."* The cascade is the bulk form of an operation the admin
  has had all along.
- **Republishing after somebody else unpublished is an established flow.** `GraphQLInputItem.mts:32-35`
  keeps `published` out of the update input precisely so a form save cannot *"republish an item an admin
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

⚠️ **`item` is cascaded as well** — the Amendment below, the platform owner's ruling of the same day. An
item already disappears when its company does (`livePublic()` gates both, and `funCompanyUpdatePublished`'s
own comment records that unpublishing a company hides its whole catalogue), so the cascade is not what makes
an item invisible. What it changes is that each item's own `published` value goes false too, which costs the
owner a list to rebuild rather than one company-level click. That cost is real and is answered by a bulk
control that clears the list in one action, not by pretending it is small.

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
- **Suspension becomes a real lever.** The admin's only remaining sanction now reaches the thing people
  complain about, which is what ADR-044 assumed it did.
- **Reads do not change at all.** No new clause, no new index, no aggregation on the anonymous hot path. The
  cheapest possible reading of *"cheap read"*: the filter already excludes what has to be excluded.
- **One copy of the truth.** A shop is off-air because `published` is false, and that is the only fact
  anybody has to check. Nothing can drift from anything, so no reconciliation, no invariant query, no
  self-healing sweep — none of it has to exist.
- **Coming back is an explicit, audited act by the owner**, through a mutation with an ownership filter and a
  validator, rather than a bulk write performed on their behalf by an admin clearing an unrelated flag.
- **Coming back is one bulk action rather than hundreds.** The cascade clears item-level publish state, and
  the Amendment pairs it with a bulk control so restoring a catalogue is one call per shop rather than one
  per item.

### Negative
- **The owner's prior publish state is lost.** After un-suspension the platform cannot say which shops were
  live before, and neither can the owner, except from memory. This is the price of the ruling and is not a
  defect to be fixed later by remembering the old value — remembering it *is* option B.
- **A shop the owner had already unpublished is indistinguishable** from one the platform took down, so the
  owner may republish something they had deliberately taken offline.
- **A silently dark shop.** An owner who never logs back in leaves a storefront down permanently with no
  admin action having explicitly taken it down. That is the intended reading of *"by hands"*, but it means
  un-suspension alone does not restore the platform to its prior state and never will.
- **The item's own publish state is destroyed, not remembered.** The cascade writes `published: false` on
  every item, so after un-suspension neither the platform nor the owner can say which items were live
  before — the same price §Negative's first bullet names, paid a second time one level down.

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

# 5. The item cascade exists too, and nothing republishes items on the owner's behalf (Amendment).
grep -rn "published: false" BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/shopOwner/

# 4. The public read is unchanged — two clauses, not three.
sed -n '31,34p' BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts
```

The suite must prove the case a happy path would miss: **clearing `disabled` leaves every company
`published: false`**. Suspend an owner with two published shops, un-suspend them, assert both are still
unpublished and that the owner can bring one back with `companyUpdatePublished` while the other stays down.

A violation on disk looks like: `published: true` written by any status or closure path; a new
`ownerInactive`-style field on `company`; the company update sitting outside the `shopOwner` write's session;
an item cascade that is missing (see the Amendment); or a public catalogue
read that does not go through `livePublic()`.

---

## Amendment 2026-08-29 — the cascade reaches `item`, fires from either tier, and coming back is a bulk action

**Scope: the treatment of `item`, and which writers the cascade hangs off.** Everything above about
`company` stands unchanged — the cascade, the absence of any automatic restore, the untouched
`livePublic()`, the absence of any schema change.

The platform owner ruled, hours after this page was accepted:

> *"item must cascade to unpublish. and manually enabled by hand when user re-enable them in 30 days
> windows. allow shopowner to select items, one-by-one or all by a checkbox next to it in the page that
> displays them for enable them in one click"*

### What changes

Both cascade writers gain a second `updateMany`, in the **same** `session.withTransaction` as the first:

```js
Item.updateMany(
  { idCompany: { $in: <every company of that owner> } },
  { $set: { published: false } },
)
```

The company ids come from the same read the company cascade already performs, so this is one extra write
against a set already in hand, not a second traversal. `item` carries no `idShopOwner` — ownership is
transitive through `idCompany`, exactly as `throwIfShopOwnerDontOwnItem` documents — so the item filter is
necessarily the second hop and cannot be shortened.

Nothing restores `item.published` automatically, for the same reason nothing restores `company.published`.

### Who fires it, and what coming back touches

A second ruling the same day settles both ends:

> *"so disable a shop owner, by shop owner or by admin, unpublish companies and items. restoring a
> shopowner, restore only his account"*

**The cascade hangs off the state, not off the tier that changed it.** The Decision's writer table names the
admin-side functions because they are the ones that exist; the obligation is on *any* path that makes an
owner inactive. A shop owner disabling or closing their own account — the ShopOwner-tier self-service
counterpart of `funUserDel`, which this platform does not have yet — carries exactly the same two
`updateMany` calls in exactly the same transaction. Whoever builds it inherits this paragraph, and a
self-closure that skips the cascade is the same defect as an admin closure that skips it.

⚠️ **Restoring a shop owner restores the account and nothing else.** Whatever lifts `disabled` — and
whatever, if anything, is ever built to lift a `deleted` stamp — writes to the `shopOwner` document alone.
It does not touch `company`, it does not touch `item`, and it does not read what either of them held before.
This is the ruling stated as an invariant, because it is the one a well-meaning refactor breaks: the account
comes back, the storefront does not, and the owner puts the storefront back themselves.

### The bulk control this obliges

Withdrawing every item makes the hand work real: an owner with two hundred items cannot be asked to click
two hundred buttons, and `Items.tsx` renders one full editable card per item rather than a compact row. So
the ruling pairs the cascade with its remedy, and the remedy is part of this decision rather than a
follow-up:

- **A checkbox per item**, in the card header beside the `Published:` state and the existing single-item
  Publish button, which stays exactly as it is.
- **A select-all checkbox** in the `Items` heading row, beside the add-item control.
- **One button that publishes the selection** in a single call.

That button needs a mutation the ShopOwner tier does not have: **`itemsUpdatePublished(_ids: [ID!]!,
published: Boolean!)`**, on `marketplace-dev-authenticated-resource`. `itemUpdatePublished` takes one `_id`,
and issuing N of them from a browser is N round trips and N partial failures.

⚠️ **Its guard is the two-hop one, and the batch is all-or-nothing.** `shopOwnerCompanyIds(shopOwnerId)`
first, then a `countDocuments` over the named ids scoped to that set; if the count is not the length of the
list, the whole call is refused with 403 and nothing is written. A filter that silently skips ids the owner
does not hold would let a client learn which ids exist by watching how many rows changed. The pattern is
`throwIfShopOwnerDontOwnItem`'s, widened from one id to a list, and the `trusted()` wrappers are not
optional — `sanitizeFilter` is global.

⚠️ **The list needs a bound.** An unbounded `[ID!]!` is a work-amplification vector on an authenticated but
cheap-to-obtain session, which is the same reasoning that gives `publicRead.mts` its `MAX_LIMIT`. The bound
belongs with whatever `companyItems` can return for one shop, since "select all, publish" must remain
possible for a real catalogue; if that query is unbounded today, this is where it stops being unbounded.

`published: Boolean!` rather than a publish-only mutation, so bulk withdrawal is the same call. It matches
`itemUpdatePublished`'s own signature, and a bulk control that can only go one way is the shape owners work
around by hand.

### What this costs, restated

The Positive bullet claiming the catalogue survives is withdrawn above. After a suspension the owner's
item-level publish state is gone as well as their shop-level state, and no record of it is kept — keeping
one is the rejected option, at item scale. What the owner gets instead is a control that makes restoring the
whole catalogue one click, which is the trade the ruling makes explicitly.

### The thirty days are ADR-041's, and impose nothing here

*"in 30 days windows"* was put to the platform owner as a reading and confirmed as one: it is
[ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md)'s existing retention window, **not
a new clock and not a deadline on republishing.** A suspended owner has no clock at all — un-suspension
happens whenever it happens, and the shops wait, unpublished, for as long as it takes. Nothing expires an
owner's right to bring their own catalogue back.

⚠️ **Superseded the same day by [ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md).** This
paragraph read: *"Restoring a shop owner therefore means lifting a suspension, and nothing else. Closure
stays one-way, exactly as ADR-041 left it: a `deleted` stamp is never lifted, and re-registering inside the
window mints a new `_id` — which owns no company, so there is nothing for it to re-enable."* It also said
that making closure reversible would need its own ADR and the platform owner's word. It got both, hours
later: the thirty days are an **undo** window, and re-registering at the same address restores the closed
account rather than minting a new one.

**What that changes here is only which document comes back, never what comes back with it.** A restored
owner keeps their `_id`, so they still own every company and item they owned before — all of them
`published: false`, and all of them theirs to republish by hand. The rule this page exists for is
unchanged and now covers both ways back: **restoring an owner writes to the `shopOwner` document alone.**
A restore additionally re-raises `waitApprov`, so an admin who closed a seller for cause can decline to
approve them a second time.

### The whole lifecycle on one page

Asked for by the platform owner on 2026-08-29 — *"make a table of what happen if admin or shop owner delete
his account and what happen to the companies and to the item and what will happen when the shop owner try to
register again within the deletion window and after that window"*. Nothing here is new: it is
[ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md),
[ADR-042](./ADR-042-registration-is-a-pending-redis-record.md),
[ADR-044](./ADR-044-suspension-names-an-actor-and-a-reason.md) and this page read together, in the order the
events happen.

**What each act writes.** The cascade hangs off the state, not off who changed it, so the admin column and
the owner column are identical wherever both exist:

| Act | `shopOwner` | `company` | `item` | Sessions | Reversible |
|---|---|---|---|---|---|
| Admin suspends | `disabled: true`, `disabledReason`, `disabledBy` = the `admin` `_id`, `disabledAt` | every one → `published: false` | every one under those companies → `published: false` | all of that owner's are ended | yes — by an admin clearing `disabled` |
| Owner closes their own account | `deleted` stamped | every one → `published: false` | every one → `published: false` | all ended | **yes, for 30 days** — ADR-046 |
| Admin closes an account | `deleted` stamped, `deletedBy` = the `admin` `_id` | every one → `published: false` | every one → `published: false` | all ended | **yes, for 30 days** — ADR-046 |
| Admin lifts a suspension | `disabled` cleared | **untouched — still `published: false`** | **untouched — still `published: false`** | none restored | — |
| Retention sweep, day 30 after `deleted` | identity overwritten in place, `scrubbedAt` stamped | untouched — already dark | untouched — already dark | — | **no** |

There is no row for *"admin lifts a closure"* because there is no such act. A `deleted` stamp is never
cleared, by anybody, on any tier.

⚠️ **A suspension is lifted by the tier that imposed it, and by nothing else.** A suspended owner cannot log
in at all, so there is no session from which they could clear their own flag, and no login can "resume" an
account by happening: `tryLoginShopOwner` hands the account to `checkUserAuthorization`, which calls
`checkUserAuthorizationDisDel`, which refuses `disabled: true` before a session exists; `findAccountForSession`
re-runs the same guard on **every refresh**, so raising the flag on somebody already logged in ends their
session within one access-token lifetime rather than one refresh-token lifetime. `disabled` is written in
exactly one place on the platform — `funShopOwnerUpdateStatus`, Admin tier — and self-closure writes
`deleted` and never `disabled`, exactly as `funUserDel` does on the customer tier. **A suspended owner
therefore has no way out of a suspension except an admin, and no way to close their account either.**

**What the owner has to do to come back from a suspension:** wait for an admin to clear `disabled` —
nothing they do brings the account back — then log in, then republish each shop with
`companyUpdatePublished`, then republish the items in each with `itemsUpdatePublished` — select-all, one
click, per shop. The platform never does either on their behalf, and there is no deadline on doing it.

**Registering again with the same address.** The address is only free once the document holding it is closed;
`submitRegistration` reads the account without any liveness filter and branches on `deleted` alone:

| When | What `shopOwnerRegister` does | What the confirmation click does | What the new account owns |
|---|---|---|---|
| While the account is live — including suspended | writes no pending record, sends the *already registered* mail, answers `true` | — | — |
| Day 1–30 after closure, before the sweep | writes the pending Redis record and sends the link, exactly as for a free address | **restores the closed account** (ADR-046): clears `deleted`/`deletedBy`, sets the new password, re-raises `waitApprov`. No new document, no scrub | **everything it owned before** — same `_id`, same companies, same items, all still `published: false` |
| Day 31 onward, after the sweep | the address is free: the sweep already moved it. An ordinary registration | inserts a new document; there is nothing left to restore | **nothing.** A fresh `_id`, `waitApprov: true`, no company, no item |

⚠️ **A suspended owner cannot register again at that address, and that is deliberate.** Their document is
live, so the address is taken; registering around a suspension would be the whole point of one defeated by a
second sign-up form.

⚠️ **The two windows differ in the outcome, and that is the whole of ADR-046.** Inside thirty days the click
hands the *same* document back, so the shops — which point at that `_id` — come back with it, dark. Outside
it, the address has already moved to `deleted-<id>@invalid.local` and there is nothing to restore: the click
mints a new `_id`, which owns nothing and never will. **Re-registering is the way back in, and it is the only
one**; there is no restore login, because a closed account cannot obtain a session to ask from.

### Build record

- **Built as `E20-S05`, `E20-S06` and `E20-S10`.** `E20-S05` is `shopOwnerDel`, which takes no argument —
  the account is the one the session authenticated as, so no id from the wire can name another owner — stamps
  `deleted` with no `deletedBy`, leaves `disabled` untouched in either direction, and takes every company and
  item dark in the same transaction. `E20-S06` is `itemsUpdatePublished`: one intent, one call, bounded at
  500 ids, de-duplicated before the bound and before the ownership guard, and all-or-nothing, because a
  partial application is unreportable behind a `Boolean!` and skipping the ids that did not match would make
  the mutation an existence oracle. `E20-S10` is the owner's side of both — the catalogue's select-all bar,
  chunked at 500, which is how an owner puts the shop back up, and the close-account card that states the four
  consequences in plain words, since a refused login is deliberately generic on every tier.
