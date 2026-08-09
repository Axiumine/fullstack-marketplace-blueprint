# ADR-007 — A shop is a company — company is a collection of its own, never an embedded subdocument
# Marketplace

**Status:** accepted
**Date:** 2026-08-03
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

The platform sells through shops, and a shop is run by a legal entity: `legalName`, `vatNumber`,
`taxCode`, `contactPerson`, `administrator`, `certifiedEmail`, `registryExtract`. Two of those —
`vatNumber` and `certifiedEmail` — identify the entity itself and must be **globally** unique: one VAT
number is one company, whoever registered it.

The obvious modelling shortcut is to hang that legal block inside the shop's own document as an embedded
object. It does not survive the real-world cardinality. One shop owner registers one company and may run
several points of sale under it — a company with three shops. Embedded, that stores one full copy of the
legal data per shop, and the second copy is then rejected outright as a duplicate `vatNumber` by the very
unique index meant to protect it. The model and the constraint contradict each other, and no field-level
fix reconciles them: `idShopOwner` has to be a real FK on whatever holds the legal data, which is a
statement about collections, not about fields.

The same question decides what a *shop* is on this platform. Given a `company` collection that already
carries the legal record, a separate shop entity would be a second document per shop holding a name, a
URL and a description — and nothing else that `company` cannot hold. Per [`CLAUDE.md`](../../../../CLAUDE.md) §Terminology and
`CONSTRAINTS.md` CON-02, **a shop is a company**: the storefront-facing fields (`publicName`, `slug`,
`description`, `published`) live on `company` itself.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A. Embed the company on a shop document, scope the two unique indexes per-shop instead of global | One collection fewer; a shop card reads one document | Wrong semantics — a VAT number is a legal identifier, not a per-shop attribute; two shops of the same company each mint their own "copy" and drift apart; loses the platform-wide fraud-detection value of a truly global unique |
| B. Embed the company, relax "one company one document" with app-side dedupe/merge tooling | No second collection | Does not address the cause — data is still duplicated N times per company, three stored copies can silently disagree, the toil is permanent, and there is no database-level guarantee at all |
| C. `company` is its own collection with a required `idShopOwner` FK, `vatNumber_unique` / `certifiedEmail_unique` GLOBAL, and the storefront fields on the same document (**chosen**) | Cardinality is expressible (1 shopOwner : N companies); one document is one legal entity, so the indexes mean what they say; a shop is a company, so the storefront needs no second entity | Adds a hop — rendering a shop means resolving `idCompany` rather than reading an embedded field; a company that is not a shop and a shop that is not yet published share one collection, so the public read paths always carry `published` and `deleted` predicates |
| D. A separate `Shop` collection referencing `Company`, modelling many physical points of sale per company | Would fully model "one company, several storefronts" | Rejected — no requirement for multiple physical locations per company exists on this platform; the catalogue (`item`) is scoped to `idCompany`, not to a location; doubles the entity model for a need nobody stated, and the bar for a new collection ("a shape the existing one genuinely cannot hold") is not cleared |

---

## Decision

Option C. `company` is a collection of its own, created in one migration with a required `idShopOwner`,
global `vatNumber_unique` and `certifiedEmail_unique`, `idShopOwner_list` for the one list query
(`shopOwnerCompanies`), and the storefront fields and their indexes on the same document. It is the only
option that expresses the cardinality without inventing a fourth entity nothing on the platform calls for
(rejected D) and without leaving the legal data duplicated and drifting (rejected A, B).

Three shapes worth naming, because each is easy to get wrong in the other direction: `taxCode` is exactly
11 digits, optional and **not** unique — it is a legal entity's tax code, distinct from `vatNumber`, and
sharing an index with it would be wrong. `registryExtract` carries `maxLength: 1000` because it is a file
path, not the file; it is the one string field that would otherwise escape the platform's per-string cap.
`address` is a full street block with a **required** `position`, because a shop that cannot be placed on
the map is not a shop.

---

## Consequences

### Positive
- Legal identity is normalised: one `company` document is one legal entity, whoever owns it, and the two
  global unique indexes (`vatNumber_unique`, `certifiedEmail_unique`) enforce exactly what they claim to.
- `company.idShopOwner` (required) backs `shopOwnerCompanies`, the only list query the collection serves —
  a shop owner can hold N companies.
- The catalogue hangs off `idCompany`, a real reference to a real document, rather than off an embedded
  object with no identity of its own.
- One collection answers both "who is this legally" and "what does the customer see", so a shop page and
  an operator's registry view read the same document and cannot disagree.

### Negative
- Extra hop to render a shop: a shop card resolves `idCompany` rather than reading an embedded field.
- `company.address` is the legal seat, not a per-storefront address, and `address.position_2dsphere` — the
  only distance query on the platform — therefore places a shop at its registered seat. The model assumes
  one storefront per company.
- Legal and public data share one document, so every public read path has to carry `published: true` and
  `deleted: { $exists: false }`; dropping either exposes an unpublished or soft-deleted registry entry.

### Risks
- **Multi-location need.** If a real requirement surfaces for one company running several physically distinct points of sale (the case option D was rejected for), this ADR's 1:1 company-shop assumption needs revisiting — do not pre-build it, per `CONSTRAINTS.md` §5 discipline on unbuilt scope.
- **Occupied identifiers on soft delete.** `vatNumber_unique`/`certifiedEmail_unique` carry no `partialFilterExpression`, so a soft-deleted (`companyDel`-stamped) company keeps its `vatNumber` and `certifiedEmail` occupied forever — revisit only if a legitimate re-registration case appears (e.g. a closed company re-registering under new ownership), not proactively.
- **Unenforced FK.** `idShopOwner` is a plain ObjectId and nothing stops a `company` pointing at a deleted or nonexistent `shopOwner`. Currently mitigated only in application code (`throwIfShopOwnerDontOwnCompany` on the ShopOwner tier before any write). Revisit if orphaned `company` documents are ever observed in `dbMarketplaceDev`.

---

## Compliance

Verify: `grep -n "idShopOwner" BEs/marketplace-db-setup/lib/schemas/company.js` must show it in
`required`. Verify the three identity indexes exist by name in
`BEs/marketplace-db-setup/migrations/20260301000200-create-company.js` — `vatNumber_unique`,
`certifiedEmail_unique`, `idShopOwner_list` — alongside the storefront ones (`slug_unique`,
`published_list`, `published_publicName`, `published_city_publicName`, `address.position_2dsphere`,
`search_text`). Verify no shop collection exists anywhere:
`find BEs/marketplace-db-setup/lib/schemas BEs/marketplace-common/src -iname "shop.*" -o -iname "shop[A-Z]*"`
restricted to non-`shopOwner` hits must return nothing. A violation looks like: a new `Shop`
model/collection/migration appearing anywhere (banned outright by `CONSTRAINTS.md` CON-02); company legal
fields reappearing embedded in another document; or a migration that inlines a company validator instead
of calling the `lib/schemas/company.js` builder (ADR-014).
