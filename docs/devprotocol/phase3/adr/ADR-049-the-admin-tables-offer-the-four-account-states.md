# ADR-049 — The admin tables offer the four account states, on both tiers
# Marketplace

**Status:** accepted
**Date:** 2026-08-30
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Two flags decide what an account is, and they are independent of one another. `disabled` is the platform
taking the account away ([`ADR-044`](./ADR-044-suspension-names-an-actor-and-a-reason.md)); `deleted` is the
account being given up, by its holder or by an admin
([`ADR-041`](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md),
[`ADR-048`](./ADR-048-an-admin-closes-a-customer-account.md)). Nothing writes one while writing the other:
a closure writes no `disabled*` field and a suspension writes no `deleted*` field, on either tier, which is
ADR-048's third decision and what ADR-046 keeps intact across an undo.

Two independent flags make **four** states. The admin app offered fewer than four on both of its tables,
and each table fell short in its own way.

`/customers` shipped on 2026-08-25 with two — the live enabled accounts and the suspended ones — although
`usersActiveTbl` has taken `disabled` and `deleted` as separate `Boolean!` arguments since it was built. A
closed customer was therefore unreachable from the app. A customer suspended **and then** closed was worse
than unreachable: it belonged to no filter the screen could express at all, so the two levers an admin
holds were between them able to remove a row from the only table that lists it — and neither lever looks,
from the outside, like the one that did it.

`/shopOwners` offered none of the four. `shopOwnersActiveTbl` hard-wired
`{disabled: {$exists: false}, deleted: {$exists: false}}` into its filter, so a shop owner suspended by
`shopOwnerUpdateStatus` or closed by `shopOwnerDel` — two mutations the same admin app has carried for
weeks — left the table at the moment the admin acted, and nothing on the platform could list them again.

The platform owner ruled the shape on 2026-08-29:

> *"admin must act on shop owners and on customers in the same way"*

which is the sentence ADR-048 built the services' parity on. The tables are the other half of it: a state
reachable on one screen and not on the other is the asymmetry ADR-048 brought the backend out of.

⚠️ **The indexes rule out the control everyone reaches for first.** `user.tbl_active_registeredAt` is
`{deleted, disabled, registeredAt, _id}`, and all four of `shopOwner`'s `tbl_active_*` lead with
`{deleted, disabled}`. A filter that leaves either flag unbound — *either*, *all*, an unchecked box — loses
the index for the sort as well as for the match, and the sort becomes a blocking in-memory one under a
32 MB cap, on two collections that only grow.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — a three-value status enum: Active, Suspended, Closed | one argument, one dropdown, and it reads like the word the status column already prints | it cannot name the state the two flags most easily produce together. An account suspended and then closed carries both, answers to none of the three, and stays exactly as invisible as it is now — the defect kept, wearing a better control |
| B — a state filter plus an *include closed* checkbox | it spells the two flags as two controls, which is what they are | the unchecked box means *either*, which is the one thing an index-leading field may not be. It also offers combinations that are not states — closed **and** all three statuses at once — so the screen would have to refuse some of what it renders |
| C — the 2×2 matrix: four named filters over the two `Boolean!` arguments | each of the four is a state an account can actually be in, each is a single indexed query, and the name of the filter is the word the row prints. One table of four drives both dropdowns, both route schemas and both status columns | the four are exclusive, so there is no *all accounts* view: an admin hunting an account whose state they do not know may have to look in more than one place |

---

## Decision

**Option C, on both tables, out of one shared table of four.**

1. **`marketplace-admin/src/lib/accountStatus.ts` is the single source.** `ACCOUNT_FILTER` maps each of
   `active`, `suspended`, `closed` and `closedSuspended` to its label and to the two booleans the query
   sends. `ACCOUNT_STATUSES` is derived from it and is what both dropdowns render *and* what both route
   schemas validate — `z.enum(ACCOUNT_STATUSES).catch('active')`, so a hand-edited URL degrades to the
   state an admin arrives on rather than to an error. `closedOrSuspendedLabel` labels the row from the same
   table, so a row can never print a word no filter offers.
2. **`shopOwnersActiveTbl` takes `disabled: Boolean!` and `deleted: Boolean!`, both defaulting to `false`**,
   and its row projects the `disabled` trio and `deleted` so the status column can read what it renders.
   `usersActiveTbl` already did both; this is the half that was missing.
3. **The state crosses the wire as two booleans and never as a status name.** That is the index constraint
   above, and it is also what keeps the four states a decision of the app rather than of the schema. Both
   `false` branches match `$exists: false`, because `disabled` is true-or-absent and never stored `false`;
   the `deleted` branch matches on **presence**, because `deleted` is a timestamp rather than a boolean
   (ADR-011, ADR-041).
4. **Closed is read before suspended when a row is labelled.** An account closed after being suspended is
   both, and calling it merely *Suspended* would offer an admin a lift that leaves the account closed.
5. **A closed row carries no action button on either table**, only the em-dash placeholder. Suspending a
   closed account is not an operation either tier's services accept, and a control that cannot succeed is
   worse than an absent one.
6. **The chosen state lives in the URL, `?status=…`, on both routes.** A filtered table is a link, the back
   button walks the filter, and a support conversation can name a screen exactly.

---

## Consequences

- **The two levers can no longer make a row vanish.** Every combination an admin can produce is a
  combination the tables can list, which is the property that was missing rather than a convenience.
- **The four states are exclusive, and there is no *all accounts* view.** Deliberate: that view is the
  unbound leading field, and it would cost the index on the two collections most certain to grow.
- **The two tables now differ only where their tiers do** — `waitApprov` and the search box on the
  shop-owner side, `emailVerified` on the customer side (ADR-029 still refuses that table a search box).
- **The shop-owner row carries `disabledReason`, and it is legible only here.** The field is randomly
  encrypted (ADR-029, ADR-044) and this service holds the data key; the shop-owner tier's own services do
  not, so the reason is admin-visible by construction rather than by a permission check.
- **No migration, no new resolver, no new mutation.** All five indexes involved already lead with the pair
  the filter binds, and the tables read — the levers are the ones ADR-044 and ADR-048 already built.
- **The counter above `/customers` disagrees with the table's `total` under all four filters**, as it
  already did under one: it counts every account ever registered (E19 §6 question 2).
- **A fifth state costs one entry in `ACCOUNT_FILTER`** — provided it is a state those leading fields can
  express. One that is not is a new index, not a new label.
- **E19 §6 question 5 is answered by the build**: an admin arrives on *Active*, and a hidden account is
  reached by naming its state rather than by being greyed in place — greying would mean fetching rows the
  index cannot bound.

- **`E19-S06` trued up the documents this surface contradicted.** Four documents and one validator comment
  said, correctly for the day they were written, that nothing reads `user` from the Admin tier. Each was
  narrowed rather than deleted: `lib/schemas/user.js` now says the admin table reads no encrypted field, which
  is why every personal field stays encrypted for exactly the reason it always was, and
  [`phase5/CUSTOMER_ACCOUNT_ADDRESSES.md`](../../phase5/CUSTOMER_ACCOUNT_ADDRESSES.md) §6 — whose closing
  paragraph is where the epic came from — says the lever is built and names the mutation.

---

## Compliance

The four states exist once, and everything that offers or validates them reads that one file:

```bash
# Four hits: the file itself, the two tables, and the route schemas that validate `?status=`.
grep -rl 'ACCOUNT_STATUSES' marketplace-admin/src
```

Both server-side tables take the account state as two required booleans with the same default:

```bash
# Two hits per file — `disabled` and `deleted`. Any third state would have to be a nullable argument,
# which is what the index forbids.
Q=BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/queries
grep -cF 'defaultValue: false' $Q/usersActiveTbl.mts $Q/shopOwnersActiveTbl.mts
```

Every index the two tables page on leads with the pair the filter binds:

```bash
# Four on shopOwner, one on user, and `disabled: 1` is the next line of each.
M=BEs/marketplace-db-setup/migrations
grep -A1 -F 'deleted: 1,' $M/20260301000100-create-shopOwner.js $M/20260825000000-user-add-tbl-active-index.js
```

The filter names stay inside the app — no operation and no generated type carries one:

```bash
# Silence. `closedSuspended` is a label and a URL value, never a field, an enum member or an argument.
grep -rn 'closedSuspended' marketplace-admin/src/api marketplace-admin/src/gql
```
