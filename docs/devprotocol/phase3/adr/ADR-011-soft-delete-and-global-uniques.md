# ADR-011 — Soft delete by a deleted date stamp, with global uniques that a retired company keeps occupying
# Marketplace

**Status:** accepted
**Date:** 2026-08-04
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

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
