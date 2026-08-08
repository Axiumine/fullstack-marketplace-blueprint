# ADR-011 — Soft delete by a deleted date stamp, with global uniques that a retired company keeps occupying
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

`company` was extracted into its own collection, from an earlier embedded shop sub-document, in
migration `BEs/marketplace-db-setup/migrations/20260803000000-create-company.js`. Two identity fields
carry global unique indexes: `vatNumber` and `certifiedEmail` — one legal
entity, one VAT number, whoever registered it. `companyDel` needs a delete path. Two things collide:
platform-wide soft-delete convention (`shopOwner`, `item`, `itemCategory` all carry an optional
`deleted` date, never a hard remove — `BEs/marketplace-db-setup/lib/schemas/account.js` `DELETED`
shape) and the fact that a hard-deleted row frees its unique keys for reuse while a soft-deleted one,
by default, does not — someone has to decide whether a retired VAT number becomes available again.

Two resource services expose `companyDel` against the same collection under different tiers:
`BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts`
(ShopOwner, acting on rows they own) and
`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts`
(Admin, acting on any row). Both stamp `deleted` via `funCompanyDelete`; only the ShopOwner path runs
an ownership guard first (`throwIfShopOwnerDontOwnCompany`), and that guard's filter has to decide
whether an already-retired company still counts as "yours to act on."

Precedent already existed inside the same migration: `shopOwner.login.email_unique` is a global unique
with no `partialFilterExpression`, so a disabled/deleted shop owner keeps their login email occupied
(`BEs/marketplace-db-setup/migrations/20260803000000-create-company.js:52-57` states the match is
deliberate). Counter-precedent existed too, one migration later: `company.slug_unique` in
`BEs/marketplace-db-setup/migrations/20260804010000-alter-company-public.js:83` IS a partial index
(`partialFilterExpression: { slug: { $type: 'string' } }`) — so the team had the partial-index tool in
hand for this exact collection and chose not to point it at `vatNumber`/`certifiedEmail`.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A. Hard delete the row | Frees `vatNumber`/`certifiedEmail` immediately | Breaks platform soft-delete convention every other collection follows; loses the retirement date; any dangling `item.idCompany` reference (unenforced by Mongo — no FK) now points at nothing at all instead of a stamped, inspectable row |
| B. Soft delete (`deleted` date stamp) + global unique index, no `partialFilterExpression` — CHOSEN | Matches `shopOwner.login.email_unique` precedent exactly; one VAT number can never be double-assigned, retired or not; enforcement is the index itself, nothing to forget in application code | Same legal entity can never re-register under the same `vatNumber` again, ever — no un-retire path exists |
| C. Soft delete + partial unique index filtered on `deleted` absent (the `company.slug_unique` pattern, same collection, one migration later) | Retired VAT number becomes registrable again; symmetric with how `slug` already behaves on this same collection | Weakens "one VAT number is one company, whoever registered it and whenever they stopped trading" to "one *live* VAT number" — two different companies could hold the same VAT number across time, and nothing downstream distinguishes that from data corruption |
| D. Push a `deleted`-filter into the delete write itself (`funCompanyDelete`), uniform across both tiers, instead of leaving it to the ownership guard | One code path, one answer, same status for both tiers | Conflates two different questions — "is this row still live" (a read/existence concern) with "should this write happen" (idempotency of the delete verb itself); would make the Admin tier's moderation ability depend on liveness, which it deliberately does not need |

---

## Decision

Row B, plus the tier split that falls out of where row D was rejected. `companyDel` stamps `deleted`
(a date, never a bool — `BEs/marketplace-db-setup/lib/schemas/account.js` `DELETED` shape) rather than
removing the document, matching `shopOwner`/`item`/`itemCategory`. `vatNumber_unique` and
`certifiedEmail_unique` stay plain global uniques with no `partialFilterExpression`
(`BEs/marketplace-db-setup/migrations/20260803000000-create-company.js:70-88`) — same shape as
`shopOwner.login.email_unique`, deliberately not the shape `company.slug_unique` uses one migration
later, because a VAT number is a legal identity and a slug is a URL segment: reusing a retired URL is
harmless, reusing a retired VAT number is not.

Row D was rejected on the reasoning, not just the outcome: liveness filtering belongs on read paths
and on existence/ownership guards, never on the delete write itself. That single rule produces both
observed tier behaviors from one cause. ShopOwner tier's
`throwIfShopOwnerDontOwnCompany` (`BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts`)
is an *ownership* guard — `Company.countDocuments({ _id, idShopOwner, deleted: trusted({ $exists:
false }) })` — and it filters `deleted` because an already-retired company is gone from
`shopOwnerCompanies`, so the only way a client still names one is a stale id it kept from before; a
second `companyDel` on it answers 403. Admin tier's `companyDel.mts` calls `funCompanyDelete` with no
ownership or liveness guard in front of it at all — an operator's job is to be able to act on any
company, retired or not, for moderation, and gating that on `deleted` would block exactly the rows an
operator most needs to reach. Both answers are correct for what each guard checks; neither tier was
"fixed" to match the other.

---

## Consequences

### Positive
- Idempotent audit trail: a retired company's row, its retirement date, and its VAT and certified-mailbox history all
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
  status on an already-retired row — that has not been asked for.
- **Re-registration demand.** If a real shop owner needs to reincorporate under a VAT number they
  previously retired on this platform, today's only fix is a manual document edit, outside any
  resolver. Revisit if this is requested more than once — a dedicated "reinstate" flow becomes
  cheaper than repeated manual intervention at that point.

---

## Compliance

Verify the index shape hasn't drifted: `grep -n "vatNumber_unique\|certifiedEmail_unique" -A3
BEs/marketplace-db-setup/migrations/20260803000000-create-company.js` must show no
`partialFilterExpression` on either block. A violation is a **new** migration adding one to either
index (migrations are immutable — the fix is always additive, never an edit to this file).

Verify the tier split: `BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts`
must still filter `deleted: trusted({ $exists: false })` inside its `countDocuments`; `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyDel.mts`
must still call `funCompanyDelete` with no preceding guard. A violation is either file gaining/losing
that `deleted` clause without this ADR being superseded first.

No `price` field, no `Order`/`Cart` reference is implied or required by this decision — soft delete on
`company` is orthogonal to commerce, which remains unbuilt.
