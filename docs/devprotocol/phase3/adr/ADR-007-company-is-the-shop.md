# ADR-007 — A shop is a company — company extracted from an embedded subdocument into its own collection
# Marketplace

**Status:** accepted
**Date:** 2026-08-03
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Pre-2026-08-03, company legal data (`legalName`, `vatNumber`, `contactPerson`, `administrator`, `uniqueCode`, `certifiedEmail`, `registryExtract`) sat embedded inside the shop's own document, in a collection that no longer exists. Two GLOBALLY unique indexes sat on `company.vatNumber` and `company.certifiedEmail` inside that embedded shape.

Real-world cardinality: one shop owner can register one company and run several points of sale under it — a company with three shops. Embedded form forced one full copy of the legal data per shop, then the second shop's copy got rejected outright as a duplicate `vatNumber` by the same unique index meant to protect it. Model and constraint contradicted each other.

`idShopOwner` needed to be a real FK on whatever held the legal data, so the fix had to live at the collection level, not the field level. Migration `20260803000000-create-company.js` is the artifact; its header states the rationale: one `shopOwner` owns N companies, one company has N shops. No shop collection exists on the platform and per `CLAUDE.md` §Terminology and `CONSTRAINTS.md` CON-02 none will — the collection that used to hold the shop's identity was removed the next day, and `company` itself grew the storefront-facing fields (`publicName`, `slug`, `description`, `published`) two days later in `20260804010000-alter-company-public.js`. This ADR records the extraction that made that consolidation possible.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A. Keep company embedded on the shop, scope the two unique indexes per-shop instead of global | No migration, no new collection, smallest diff | Wrong semantics — a VAT number is a legal identifier, not a per-shop attribute; two different shops of the same company could each mint their own "copy," drifting apart; loses the platform-wide fraud-detection value of a truly global unique |
| B. Keep company embedded, relax the "one company one document" rule with app-side dedupe/merge tooling | No schema change | Doesn't fix root cause — data still duplicated N times per company, drift risk (three stored copies can silently disagree), ongoing manual admin toil forever, no database-level guarantee |
| C. Extract `company` into its own collection with required `idShopOwner` FK, keep `vatNumber_unique`/`certifiedEmail_unique` GLOBAL | Cardinality now expressible (1 shopOwner : N companies); one document is one legal entity, indexes finally mean what they say; new collection created empty, no backfill needed for the legal fields | Adds a hop — rendering a shop now means resolving `idCompany` rather than reading an embedded field; every consumer (resolvers, `marketplace-common` models, frontends) has to be updated to the new shape |
| D. Also introduce a separate `Shop` collection referencing `Company`, modeling many physical points of sale per company | Would fully model "one company, several storefronts" | Rejected — no requirement for multiple physical locations per company exists on this platform; the catalogue (`item`) is scoped to `idCompany`, not to a location; doubles the entity model for a need nobody stated; the *Data model* bar for a new collection ("a shape `item` genuinely cannot hold") is not cleared |

---

## Decision

Option C. Extract `company` into its own collection (row C above), required `idShopOwner`, unchanged global scope on `vatNumber_unique`/`certifiedEmail_unique`, new `idShopOwner_list` for the one list query (`shopOwnerCompanies`). This is the only option that fixes the cardinality contradiction without inventing a fourth entity nothing on the platform calls for (rejected D) and without leaving the underlying data duplicated and drifting (rejected A, B). Field shapes carried over verbatim from the embedded sub-document (`lib/schemas/company.js`), with two additions the embedded form never had: `taxCode` (11 chars, optional, not unique — distinct from `vatNumber` only for entities where sharing an index would be wrong) and a required `address` block with required `position`. `registryExtract` gained `maxLength: 1000` where the embedded form was unbounded — a file path, not a document, and the one field that had escaped the platform's usual per-string cap.

---

## Consequences

### Positive
- Legal identity now normalized: one `company` document is one legal entity, whoever owns it, and the two global unique indexes (`vatNumber_unique`, `certifiedEmail_unique`) finally enforce what they claim to.
- `company.idShopOwner` (required) backs `shopOwnerCompanies`, the only list query the collection serves — a shop owner can hold N companies, verified against `BEs/marketplace-db-setup/migrations/20260803000000-create-company.js:91-98`.
- Unblocked the two migrations that followed: `20260804010000-alter-company-public.js` (storefront fields) and the catalogue (`item`/`itemCategory`) hanging off `idCompany` rather than an embedded object.

### Negative
- Extra hop to render a shop: a shop card now resolves `idCompany` instead of reading an embedded field — every resolver and frontend query that touched the old shape needed updating.
- `company.address` is the legal seat (required `position`, no `2dsphere` index at creation — added later in `20260804040000-index-company-public-read.js`), not a per-storefront address; the model still assumes one storefront per company, same as the embedded form did.

### Risks
- **Multi-location need.** If a real requirement surfaces for one company running several physically distinct points of sale (the case option D was rejected for), this ADR's 1:1 company-shop assumption needs revisiting — do not pre-build it, per `CONSTRAINTS.md` §5 discipline on unbuilt scope.
- **Occupied identifiers on soft delete.** `vatNumber_unique`/`certifiedEmail_unique` carry no `partialFilterExpression`, so a soft-deleted (`companyDel`-stamped) company keeps its `vatNumber` and `certifiedEmail` occupied forever — revisit only if a legitimate re-registration case appears (e.g. a closed company re-registering under new ownership), not proactively.
- **Unenforced FK.** `idShopOwner` is a plain ObjectId and nothing stops a `company` pointing at a deleted or nonexistent `shopOwner`. Currently mitigated only in application code (`throwIfShopOwnerDontOwnCompany` on the ShopOwner tier before any write). Revisit if orphaned `company` documents are ever observed in `dbMarketplaceDev`.

---

## Compliance

Verify: `grep -n "idShopOwner" BEs/marketplace-db-setup/lib/schemas/company.js` must show it in `required`. Verify the three indexes exist by name in `BEs/marketplace-db-setup/migrations/20260803000000-create-company.js` (`vatNumber_unique`, `certifiedEmail_unique`, `idShopOwner_list`). Verify no shop collection exists anywhere: `find BEs/marketplace-db-setup/lib/schemas BEs/marketplace-common/src -iname "shop.*" -o -iname "shop[A-Z]*"` restricted to non-`shopOwner` hits should return nothing — confirmed empty at ADR write time. A violation looks like: a new `Shop` model/collection/migration appearing anywhere (banned outright by `CONSTRAINTS.md` CON-02), or a migration that inlines a company validator instead of calling the `lib/schemas/company.js` builder (violates CON-07's single-source-of-shape rule alongside this one).
