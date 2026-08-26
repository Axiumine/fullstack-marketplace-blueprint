# Phase 4 — Shared constraints
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.2
**Date:** 2026-08-26
**Author:** brainy-agent
**Changelog:** v1.0 - initial retrofit
v1.1 - 2026-08-25: DCON-05 restated. Its second sentence read "Write path for `itemCategory` exists ONLY in Admin tier" and its trigger fired on any design showing another tier writing the collection — which now describes shipped code. The three mutations are still Admin-only; `holdItemCategory` on the ShopOwner tier writes `__v` and nothing else, to close a write-skew window. The constraint now says which of the two it is, so the trigger stops firing on the exception it should permit.
v1.2 - 2026-08-26: same annotation as phase 5's — the inherited "GDPR call" row now says the call was made on 2026-08-26 and where. No constraint changed.

## 1. Purpose

Doc feed every Phase 4 agent same rules. 5 agent this phase: ERD, DDD_AGGREGATES, API_CONTRACTS x2,
ERROR_HANDLING. Stop agent A design contradict agent B. Stop Phase 4 contradict Phase 1-3.

RULES.md §11 mandate inject this file into all 5. Phase 3 built 28 ADR + own CONSTRAINTS.md — Phase 4
sit ON TOP, not replace. Phase 3 = architecture level (what exist, why). Phase 4 = design level (how
draw it, how name field, how shape error). Do not redecide Phase 3 architecture here.

If task collide with rule here — rule here win, unless §7 say otherwise.

## 2. Inherited constraints

Already settled. Do NOT restate body, point at source.

| What | Where settled |
|---|---|
| CON-01..CON-12 (role=collection, shop=company, opaque token, tier assert, single logout, 3-authz-stay-3, migration immutable, 100/100 gate, common deploy-local, SSR/CSR split, English+tabs+node, operator-only fields listed-and-linted rather than translated) | `phase3/CONSTRAINTS.md` §2 |
| Vocabulary lock (actor names, auth vocab, per-collection field vocab, banned terms, registration-field definitions, planned-commerce-vocab) | `phase3/CONSTRAINTS.md` §3, full source `phase2/UBIQUITOUS_LANGUAGE.md` |
| Architectural invariants Phase 3 could not redesign (6 collections, ownership chain, defaultAddress pointer shape, shared REDIS_KEY, 3 authz deployables, no barrel in common, quality gate regime, SSR/CSR, migration immutability, BC-01/03 + BC-01/07 conformist boundaries) | `phase3/CONSTRAINTS.md` §4 |
| Out of scope (order/cart/delivery/payment, price on item, nginx install, forge publish, GDPR call — ⚠️ the GDPR call was **made** on 2026-08-26, out of phase as intended: in scope, `phase1/NFR.md` §2.7) | `phase3/CONSTRAINTS.md` §5 |
| ADR-001..ADR-028, one row each, by area | `phase3/adr/ADR-INDEX.md` §2-3 |
| Decisions deliberately NOT re-opened (merge 3 authz, per-tier REDIS_KEY, role field, shop collection, price field, lower threshold, ignoreStatic, domain-neutral catalogue vocab) | `phase3/adr/ADR-INDEX.md` §4 |
| Gaps this platform still owes an ADR (ordering, repo publish target, prod topology) | `phase3/adr/ADR-INDEX.md` §5 |

Phase 4 agent read `phase3/CONSTRAINTS.md` full + `phase3/adr/ADR-INDEX.md` full before start. This doc
assume both already read — no re-explain here.

## 3. Design-level constraints

Numbered DCON-xx. NEW this phase — design-level detail Phase 3 named but did not spell out for
diagram/schema/contract work. Each row: rule, source path, what violation look like.

| ID | Constraint | Source | Violation looks like |
|---|---|---|---|
| DCON-01 | Validator authoritative, mongoose model is NOT. `ShopOwner` model declares `personalData.birth.date` and no `contacts`; validator want `birth.date` PLUS `contacts` — validator wins. ERD/aggregate diagram must draw the `$jsonSchema` shape, never the model file, when the two disagree. | `BEs/marketplace-db-setup/lib/schemas/shopOwner.js,85` (`contacts` block) | ERD/DDD doc draws a field from a mongoose model that the collection validator does not also declare |
| DCON-02 | Every collection validator carries `additionalProperties: false`. An undeclared field on a write is REJECTED, not silently dropped. Any new field in a design doc must be traceable to an actual/planned `$jsonSchema` entry, not "the model will just carry it." | `BEs/marketplace-db-setup/lib/schemas/item.js` | ERD/aggregate design shows a field with no corresponding validator entry and no migration noted to add one |
| DCON-03 | Soft delete = `deleted` date field, set once, never a hard remove. Liveness filter (`deleted: null`/absent) belongs on READ paths and on existence/ownership guards — never on the delete write itself. | `BEs/marketplace-db-setup/lib/schemas/item.js` (`deleted` field); `docs/data-model.md`, `company` `deleted` paragraph | Design shows a `DELETE` mutation removing a document, or puts `deleted: null` filter inside the delete-mutation's own query instead of on reads/guards |
| DCON-04 | These unique indexes stay GLOBAL (no `partialFilterExpression`) and a soft-deleted document keeps occupying its slot: `company.vatNumber`, `company.certifiedEmail`, `company.slug`, `shopOwner.login.email`, `user.login.email`, `item.{idCompany,slug}`, `itemCategory.slug`. | `BEs/marketplace-db-setup/migrations/20260301000200-create-company.js,85` (`vatNumber_unique`, `certifiedEmail_unique`); `docs/data-model.md` | Design proposes a `partialFilterExpression` on any of these 7 indexes to "free up" a retired document's value, or assumes re-registering a deleted company's vatNumber is possible |
| DCON-05 | `itemCategory` depth cap (max 2 levels) lives in the RESOLVER, not the validator — `$jsonSchema` cannot read a sibling document to check "does my parent have a parent." The three mutations that create, re-parent or retire a category exist ONLY in the Admin tier. ⚠️ **One deliberate exception, one field:** `holdItemCategory` on the ShopOwner tier `$inc`s `__v` on a category inside every `itemAdd`/`itemUpdate` transaction — no domain field, no `idParent`, so the depth cap is untouched; the write exists so the item write and a concurrent `itemCategoryDel` collide instead of skewing past each other under snapshot isolation. | `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/throwIfParentNotTopLevel.mts`; `BEs/dev/marketplace-dev-authenticated-resource/src/lib/item/holdItemCategory.mts`; ADR-012 | Design shows a `$jsonSchema` rule enforcing depth, or gives ShopOwner/User/public tier a mutation that writes a *domain* field of `itemCategory`. A concurrency-guard `$inc` on `__v` is not that, and a design that removes one without removing its Admin-side twin reopens a race |
| DCON-06 | Any id crossing INTO a mongo aggregation pipeline stage must be coerced `new Types.ObjectId(id)` first. `GraphQLID` resolves to a plain string; Mongoose casts a query filter against the schema but casts NOTHING inside a pipeline — an uncoerced string vs ObjectId comparison silently answers `matchedCount:1, modifiedCount:0`. | `BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:36-48,58,66` | API_CONTRACTS or ERROR_HANDLING design passes a `GraphQLID` arg directly into a `$cond`/`$ne`/pipeline stage with no `new Types.ObjectId()` step drawn |
| DCON-07 | Mongoose 9 refuses an ARRAY update unless `{ updatePipeline: true }` passed per-query — thrown client-side before the driver is reached. Not a global `mongoose.set()` — per-call. | `BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:72-79` | Design shows an array-shaped `updateOne`/`updateMany` (e.g. `addresses: [...]`) with no `{ updatePipeline: true }` noted, or shows it set globally at boot |
| DCON-08 | Create/delete mutations answer bare `Boolean` by default — a urql document cache invalidates NOTHING on a bare boolean unless the call site passes `additionalTypenames`. Two deliberate exceptions, do not "fix" toward them elsewhere without reason: `companyAdd` answers `OnlyIdType`; `GraphQLInputCompanyPosition` requires `type: String!` on ShopOwner tier, forbids it on Admin tier (Admin stamps `'Point'` server-side). | `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts`, `itemAdd.mts` | API_CONTRACTS design gives a new create/delete mutation a return type other than `Boolean` without naming it a deliberate exception, or copies `companyAdd`'s `OnlyIdType` pattern onto an unrelated mutation without justifying cache-invalidation need |
| DCON-09 | No `role` field, no permission enum, anywhere — in a collection, a session, a GraphQL type, an error code. Tier = which collection/service you hit. Every new design (ERD field, aggregate boundary, contract arg, error taxonomy) must be expressible under this — check before adding anything that smells like `role: "admin"`. | [`CLAUDE.md`](../../../CLAUDE.md) §Terminology; `phase3/CONSTRAINTS.md` CON-01 | Design adds `role`/`permissions` field to any schema, type, or error payload |

## 4. Modelling rules

Ownership chain, fixed, do not redraw differently:

```
shopOwner ──idShopOwner──> company ──idCompany──> item ──idCategory──> itemCategory
                                                                            ▲
                                                                    idParent ┘  (one level only, admin-write-only)
```

| Rule | Detail |
|---|---|
| `admin` stands OUTSIDE the chain | Owns nothing, owned by nothing. Do not draw an FK from `admin` into the chain. |
| `user` stands OUTSIDE the chain | Owns only its own embedded `addresses[]` (not a chain link — an embedded array on its own doc). Do not draw `user` as a parent/child of `shopOwner`/`company`/`item`. |
| Aggregate root = collection with a `_id`, always | 6 collections = 6 candidate roots: `admin`, `shopOwner`, `company`, `user`, `item`, `itemCategory`. `user.addresses[]` is embedded (no own collection) — model as a value-object list inside the `User` aggregate, NOT a 7th root. |
| No new collection this phase | DDD_AGGREGATES may show aggregate boundaries and invariants over the 6 EXISTING collections. It may NOT introduce a 7th (e.g. `Shop`, `Cart`, `Order`) — see §6. |
| Naming: aggregate/entity/VO names = the collection/field names already fixed | `ShopOwner`, `Company`, `Item`, `ItemCategory`, `User`, `Admin` for roots; `personalData`, `addresses`, `defaultAddress`, `idParent`, `slug` etc for fields — per `phase2/UBIQUITOUS_LANGUAGE.md` §5-10. Do not coin a new synonym (no "Shop" for `Company`, no "Product" for `Item`). |
| `defaultAddress` invariant is aggregate-internal | Single top-level ObjectId pointer into `user.addresses[]._id`, enforced by `$and: [$jsonSchema, $expr]` at the DB. Model it as a `User`-aggregate invariant, not a separate rule needing its own enforcement path. |
| `itemCategory` self-FK depth-2 cap is a resolver-level invariant, not a DB one | See DCON-05. When drawing aggregate boundaries, note the cap lives OUTSIDE the aggregate's own validator. |

## 5. Contract rules

| Rule | Detail |
|---|---|
| GraphQL is the whole API in 8 of 9 services | Only `marketplace-dev-public-resource` also mounts a `@koa/router` — 3 REST endpoints, all under `/check`: `GET /check/`, `GET /check/verify-email/:email/:hash`, `GET /check/verify-email-user/:email/:hash`. API_CONTRACTS design work is GraphQL-first; treat these 3 as the ONLY REST exception and do not invent more REST surface. |
| Resolvers are the source of truth | Each service builds its schema programmatically — no service has an SDL file. |
| Frontend `schema/*.graphql` slices are HAND-MAINTAINED and DRIFT | They are a convenience copy, not the contract. API_CONTRACTS agents must re-derive from resolver source (`src/graphQLApi/schema/` or `src/graphQLPublic/schema/` for public-resource — different root name, same shape) before designing a new operation, never trust a frontend slice as ground truth. |
| Contract cross-link tooling does not work here | GitNexus `group sync` returns 0 cross-links on this platform — Apollo mounted via inline `if (ctx.path === ENDPOINT)` dispatch, extractor has no GraphQL model. Do not cite `route_map`/contract cross-links as evidence of a GraphQL contract; verify by reading resolver source directly. |
| Resolver layout per resource service | `src/graphQLApi/schema/{queries,mutations}.mts` (roots), `{queries,mutations}/<entity><Add|Update|Del|Dis>.mts` (one file per op), `types/`, `GraphQLInput/`, `interfaces/`, `frag/`. `marketplace-dev-public-resource` spells the root `src/graphQLPublic/` — same shape, different folder name. |
| New product-type mutations go directly under `mutations/`, not a per-type subfolder | No per-product-type subfolder exists; follow `itemAdd.mts`/`itemUpdate.mts` as the pattern. |

## 6. Out of scope for Phase 4

Same 4 unbuilt commerce concepts as Phase 3 — still no shape, still ask before inventing:

- **Order** — no collection, no state machine, no resolver, no ERD node, no aggregate.
- **Cart** — no collection, no ERD node.
- **Delivery** — not built: no collection, no resolver, no design.
- **Payment** — no gateway, no integration, no error taxonomy for payment failure modes.

Also explicitly out of scope for THIS phase's design work:

- **No `price` field on `item`**, anywhere in ERD, aggregate, or contract — DCON already inherited (CON-09/phase3, ADR-009). A price with nothing to buy is a guess at an undesigned decision.
- **No new collection** — 6 stays 6. A "genuinely new product type" question (per `docs/data-model.md`) is a decision for whoever owns that scope next, not this phase.
- **No new tier** — `admin`/`shopOwner`/`user` stays 3. No `role` field as a shortcut around a 4th tier (see DCON-09).
- **No REST beyond the existing 3 `/check` endpoints** — see §5.

BC-11 "Ordering & Fulfilment [PLANNED - NOT BUILT]" in `phase2/BOUNDED_CONTEXT.md` covers all 4 commerce
concepts above; naming them in prose (glossary-reference only) is fine, drawing their ERD/aggregate/contract
shape is not.

## 7. Conflict resolution order

When two docs disagree, higher row wins:

| Rank | Document |
|---|---|
| 1 (highest) | `phase1/PDR.md` |
| 2 | `phase1/NFR.md` |
| 3 | `phase2/UBIQUITOUS_LANGUAGE.md` |
| 4 | `phase2/BOUNDED_CONTEXT.md` |
| 5 | `phase3/adr/ADR-*.md` (28 decisions) |
| 6 | `phase3/CONSTRAINTS.md` and other phase 3 docs |
| 7 (lowest) | Phase 4 docs (this file, the 5 agents' output) |

A Phase 4 output that contradicts anything ranked above it is WRONG, not a superseding decision — fix
the Phase 4 doc, don't reinterpret the higher-ranked one. A genuine error found in a higher-ranked doc
goes back through `RULES.md` change-control, not silently overridden here.

Within Phase 4 itself: this CONSTRAINTS.md wins over any single one of the 5 agents' output — that is
the whole reason it exists (RULES.md §11). Between the 5 agents' own outputs (e.g. ERD vs
DDD_AGGREGATES naming a field differently): whichever one matches §3/§4/§5 of THIS file wins; if
neither matches, escalate rather than let one silently override the other.
