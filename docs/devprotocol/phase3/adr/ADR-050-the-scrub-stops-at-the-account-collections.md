# ADR-050 — The scrub stops at the account collections
# Marketplace

**Status:** accepted
**Date:** 2026-08-30
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

Day 30 overwrites a closed account's personal data in place
([`ADR-041`](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md)): `retentionSweep` selects
documents whose `deleted` is older than the cutoff and that carry no `scrubbedAt`, and rewrites
`login.email`, `login.password` and the whole of `personalData` before stamping `scrubbedAt`. It runs over
two collections, `user` and `shopOwner`, and `buildAccountScrub` takes a `ScrubbableTier` that admits
exactly those two.

The keep-list is derived by exclusion: every field on those two collections that the scrub does not
overwrite is a field it was decided to keep. That derivation says nothing about any other collection, and
one other collection holds the name of a natural person. `company.contactPerson` and
`company.administrator` are the two encrypted fields on `company`
([`ADR-029`](./ADR-029-pii-at-rest-explicit-csfle.md)) precisely because they are, in the
schema's own words, *"the names of two natural persons hiding inside a legal record"*. The other fourteen
fields describe the entity or are published to anonymous visitors.

So a shop owner can close their account, wait thirty days, and be left with a scrubbed `shopOwner`
document sitting beside a `company` that still names them by hand. The company itself is not gone — an
inactive owner's storefront goes dark and the documents stay
([`ADR-045`](./ADR-045-an-inactive-shop-owner-takes-the-storefront-off-air.md)) — so the row outlives the
scrub by design.

Three facts bound what could be done about it:

- **The two fields are `required` on `company`.** The validator has `additionalProperties: false` and lists
  both in `required`, so `$unset` is not available: the write would be refused, and a scrub that fails
  halfway leaves an account that reports itself scrubbed and is not.
- **They are not necessarily the closing person.** A company's contact and its administrator are whoever
  the registration named. That may be the shop owner, and it may be two other people who never held an
  account here and never asked this platform for anything.
- **`company` has a `deleted` stamp of its own, and it is not a retention clock.** `funCompanyDelete`
  writes it when an owner removes one of their own shops — a different event on a different timeline, and
  one that does not happen when an account closes: ADR-045 takes the storefront dark and leaves every row
  standing. There is no `scrubbedAt` on the collection and nothing that records a scrub is due, so a sweep
  over `company` could not read its work off the collection at all — it would have to re-derive it from the
  owner's document on every run, for rows that may outlive several owners.

## Options considered

| Option | What it does | Why not |
|---|---|---|
| **A — the scrub reaches `company`** | day 30 overwrites `contactPerson` and `administrator` on every company the closed owner holds | Overwrites the names of people who may not be the closing person and never asked for anything; turns a legal record into a false one, since the company keeps trading its registration while its registered contact reads *Deleted User* |
| **B — the scrub stops at the account collections** ✅ | `user` and `shopOwner` are the whole of it; `company` keeps what it was registered with | The closed owner's name can survive on a company row, and the platform has to say so rather than imply otherwise |
| **C — `company` gets a closure of its own** | a company is closed and scrubbed on its own timeline, with a `scrubbedAt` and a retention meaning bolted onto the `deleted` stamp `funCompanyDelete` already writes | Designs a second lifecycle for a collection nobody asked to close; and a company with no legible contact is not a lighter record, it is a broken one |

## Decision

**B.** The platform owner's ruling of 2026-08-30, answering [`E20`](../../phase5/epics/E20.md) §6
question 1 — *does the scrub reach `company.contactPerson` and `company.administrator`?* — is **no**.

1. **`retentionSweep` reads and writes `user` and `shopOwner`, and no third collection.** `ScrubbableTier`
   admits `TIER.user` and `TIER.shopOwner`; adding a member to it is adding a collection to a destructive
   mass write, which is the widening the sweep's own filter comment refuses.
2. **`company.contactPerson` and `company.administrator` are registration data of a legal entity and are
   kept for as long as the company row is kept.** They are not the closed account's copy of anything: the
   account holds its own name in `shopOwner.personalData`, and that is what day 30 overwrites.
3. **A closed owner's name may therefore be legible on a company after the account that held it is
   scrubbed.** This is a consequence, not a defect, and no future work may "fix" it by widening the sweep.
   The fields stay randomly encrypted, so they are legible only where the key is and to nothing that
   queries.
4. **Changing this needs a superseding ADR, not a patch.** The scrub is a mass overwrite with no undo; its
   reach is a decision of record, and the one place it is written down is here.

## Consequences

- **The erasure story has a stated edge, and the edge is now written rather than discovered.** A reader of
  ADR-041 could reasonably have assumed day 30 leaves no name anywhere. It leaves two, on companies, and
  they were never the account's fields.
- **`RISK_REGISTER.md` R25 carries it as a recorded exposure.** It is not scored: nothing here is
  unlawful processing on a workstation with no host and no real personal data, and the erasure limb's
  obligations are counted where they already were.
- **The keep-list stays derived by exclusion on two collections**, which is what makes it readable. A
  keep-list that had to name `company` would have to name every collection that will ever hold a name.
- **`ScrubbableTier` is the guard.** It is a two-member union, so reaching a third collection from
  `buildAccountScrub` does not type-check — the refusal is in the types rather than in a review.
- **A shop owner who wants their name off a company changes the company's registration.** That is a shop
  owner's own edit through `companyUpdate`, not a retention event, and it is available before and after
  closure — after closure only through an admin, since the account can no longer sign in.
- **An admin closing a shop owner does not touch these fields either.** `shopOwnerDel` stamps the account
  and takes the storefront off air (ADR-045); the company keeps its registration, dark.

## Compliance

```bash
# The sweep imports two account models and no others. Two hits, neither of them Company or Item.
S=BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/retention/retentionSweep.mts
grep -c 'models/MongoDB' $S      # 2
grep -cF 'Company' $S            # 0

# The scrubbable tiers are exactly two, in the library that builds the update.
grep -n 'export type ScrubbableTier' BEs/marketplace-common/src/others/accountScrub.mts
# → typeof TIER.user | typeof TIER.shopOwner

# The two company fields are encrypted and required — the scrub could not unset them if it wanted to.
C=BEs/marketplace-db-setup/lib/schemas/company.js
grep -cF "encryptedField('the " $C           # 2 — contactPerson and administrator
grep -A11 "required: \[" $C | grep -cE "'(contactPerson|administrator)'"   # 2

# The collection has a `deleted` stamp of its own and no `scrubbedAt` — a shop removal, not a retention clock.
grep -cE '^ +deleted: \{' $C   # 1
grep -c 'scrubbedAt' $C         # 0
```
