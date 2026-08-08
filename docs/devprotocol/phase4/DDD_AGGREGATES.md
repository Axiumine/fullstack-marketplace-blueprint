# DDD Aggregates
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.0
**Date:** 2026-08-07
**Author:** ddd-agent
**Depends on:** PDR.md ✅ · EVENT_STORMING.md ✅ · BOUNDED_CONTEXT.md ✅ · UBIQUITOUS_LANGUAGE.md ✅
**Mutability:** careful — changing aggregate boundaries affects data and code
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.

---

## 1. Purpose

Defines the tactical domain model of Marketplace: the 6 aggregates that exist on disk (`ShopOwner`, `Company`, `Item`, `ItemCategory`, `User`, `Admin`), each aggregate's root entity, the entities/value objects it contains, the invariants it enforces and where, the commands that mutate it, and the events it emits. Binds to `phase2/BOUNDED_CONTEXT.md` (BC-01..BC-11) — every aggregate below sits inside a named BC and is referred to by that id — and to `phase2/EVENT_STORMING.md` for its commands/events/policies. Per `phase4/CONSTRAINTS.md` §4 ("No new collection this phase"), this document draws boundaries over the 6 collections that already exist. It introduces zero new collections and designs zero commerce concepts — Cart, Order, Delivery, Payment stay named gaps (§9).

The single most load-bearing fact this document states, because nothing upstream states it explicitly: **an aggregate boundary here is a MongoDB single-document write boundary, and nothing more.** There are no cross-collection ACID transactions in any domain-write resolver on this platform (§5). Every invariant that looks like it spans two aggregates is in fact enforced by an application-level resolver guard racing ahead of an unguaranteed second read — not by the database, and not by a saga, and not by an event.

---

## 2. Aggregate map

```
BC-01 Identity & Access ─┬─ reads shopOwner.login/resetPwd/emailVerify ──┐
                          ├─ reads user.login/resetPwd/emailVerify ───────┤   Conformist, same doc,
BC-03 Onboarding&Approval┘  writes shopOwner.waitApprov/notes            │   no schema wall
BC-07 Customer Account ──┘  writes user.personalData/addresses          │  (BOUNDED_CONTEXT.md §1,§4,§6)
                                                                          ▼
┌─────────────────────────┐        idShopOwner        ┌─────────────────────────┐
│   ShopOwnerAggregate     │───────────(FK, unchecked │   CompanyAggregate       │
│   ─────────────────      │            by MongoDB)──▶│   ─────────────────      │
│   Root: ShopOwner        │  guard: none at write —  │   Root: Company          │
│   BC-01 + BC-03           │  read via                │   BC-04                  │
│   PersonalData (VO)       │  throwIfShopOwnerDont-   │   Address (VO, geo.js)   │
└─────────────────────────┘  OwnCompany               └────────────┬─────────────┘
                                                                     │ idCompany
                                                    guard: throwIfShopOwnerDontOwnCompany
                                                    (checked BEFORE idCategory below)
                                                                     ▼
┌─────────────────────────┐        idParent           ┌─────────────────────────┐
│ ItemCategoryAggregate    │◀──(self-FK, same          │    ItemAggregate         │
│ ─────────────────        │    collection, depth      │   ─────────────────      │
│ Root: ItemCategory       │    ≤2 via resolver         │   Root: Item             │
│ BC-06, admin-write-only  │    throwIfParentNotTopLevel)│  BC-05                   │
└──────────▲───────────────┘                            └─────────────────────────┘
           │ idCategory (FK, unchecked by MongoDB)
           │ guard: throwIfItemCategoryMissing (checked AFTER company ownership)
           └──────────────────────────────────────────────────────────────────────

┌─────────────────────────┐                            ┌─────────────────────────┐
│    UserAggregate         │                            │    AdminAggregate        │
│   ─────────────────      │                            │   ─────────────────      │
│   Root: User              │                            │   Root: Admin             │
│   BC-01 + BC-07            │                            │   BC-01 only             │
│   PersonalData (VO)        │                            │   owns nothing,           │
│   Address[] (entity,       │                            │   owned by nothing         │
│     own _id, no own        │                            │   (docs/data-model.md)  │
│     lifecycle)             │                            └─────────────────────────┘
│   defaultAddress (VO,      │
│     pointer)               │
└─────────────────────────┘

No arrow above is a MongoDB foreign key — MongoDB enforces none of them (6 collections, `additionalProperties:
false` validators, zero `$ref`/FK mechanism). Every arrow is a resolver-side guard function, named at the
arrowhead, that runs as an unguaranteed extra read before the aggregate's own single-document write.
```

---

## 3. Aggregate definitions

### ShopOwnerAggregate

**Root entity:** `ShopOwner` — collection + Mongoose model `BEs/marketplace-common/src/models/MongoDB/ShopOwner.mts`, validator `BEs/marketplace-db-setup/lib/schemas/shopOwner.js`.
**Bounded context:** primary **BC-03** (Shop Owner Onboarding & Approval) — BC-03 governs the account's lifecycle (`shopOwnerAdd`/`shopOwnerUpdateStatus`/`shopOwnerUpdateNote`/`shopOwnerUpdatePreferences`, all four in `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/`). **BC-01** (Identity & Access) also touches this same document — it reads `login`/`resetPwd`/`emailVerify` and reads `waitApprov` to refuse a login. This is not a clean single-BC ownership: `phase2/BOUNDED_CONTEXT.md` §1/§4/§6 names it explicitly as "Conformist, convention only — same `shopOwner` collection, no schema-level wall." One aggregate, one document, two contexts reaching into different sub-documents of it with nothing but code review keeping the split honest.
**Boundary:** one `shopOwner` document. Everything inside `required`/`properties` of the validator's `$jsonSchema` block is inside the transaction; nothing outside the document is.

**Entities and value objects:**
| Name | Type | Description |
|---|---|---|
| `ShopOwner` | Root entity | `login`/`resetPwd`/`emailVerify` sub-docs (shared `LOGIN`/`RESET_PWD`/`EMAIL_VERIFY` shapes, `BEs/marketplace-db-setup/lib/schemas/account.js:18-125`), `waitApprov`, `notes`, `onboardingStep`/`onboardingDone`, `disabled`, `deleted` |
| `PersonalData` | Value object | required at creation: `firstName`, `lastName`, `birth.date`, `address` (GeoJSON `position` optional), `contacts` (requires BOTH `mobile` and `email`) — `BEs/marketplace-db-setup/lib/schemas/shopOwner.js:38-88` |

**Invariants:**
- `login.email` unique across the collection — `INDEXES_LOGIN_EMAIL` (shared shape from `account.js`).
- `personalData` (with nested `contacts.mobile`/`contacts.email`) is REQUIRED at document creation — `shopOwner.js:38-40,51-56,85-88`. ⚠️ The Mongoose model disagrees: it declares `personalData.birth.date` and omits `contacts` entirely. The `$jsonSchema` validator wins on every write — a mongoose-only field with no validator entry is silently rejected (`additionalProperties: false`).
- `waitApprov: true` blocks `loginAdmin`/authorization login — enforced in the authorization resolver reading this field, not in the schema itself; the schema only stores the boolean.
- `disabled`/`deleted` gate every authenticated call, all tiers, via `checkUserAuthorizationDisDel` (`BEs/marketplace-common/src/others/checkUserAuthorizationDisDel.mts`).
- `shopOwnerUpdateStatus` writes `disabled` and `waitApprov` together as one full-state `$set`, never a partial patch (`BEs/dev/marketplace-dev-admin-authenticated-resource/.../shopOwnerUpdateStatus.mts:29-30`) — this is a design choice about the write shape, not a DB-enforced rule.
- Whether a freshly created `ShopOwner` starts gated (`waitApprov`) or ungated is **unresolved on disk** — `shopOwnerAdd` never sets the field at creation (`EVENT_STORMING.md` §5 hotspot 1). Nothing enforces an answer either way.
- `onboardingStep`/`onboardingDone` are read in three places (`tokenInfoShopOwner.mts`, `authenticatedAuthorizationHandler.mts`, `makeAuthCtx.mts`) but **no mutation on the platform writes either field** (`EVENT_STORMING.md` §5 hotspot 2) — an invariant with a read side and no discoverable write side.

**Commands (mutate this aggregate):** `shopOwnerAdd`, `shopOwnerUpdateStatus`, `shopOwnerUpdateNote`, `shopOwnerUpdatePreferences` (all Admin tier, `marketplace-dev-admin-authenticated-resource`); `login`/refresh writes touch `login.lastLogin` (authorization services).

**Events emitted:** Shop Owner Account Created, Duplicate Login Email Rejected, Shop Owner Approval Granted, Shop Owner Approval Withheld, Shop Owner Disabled, Shop Owner Note Recorded, Shop Owner Logged In, Login Refused (`UBIQUITOUS_LANGUAGE.md` §15, `EVENT_STORMING.md` §2.2/§2.4).

---

### CompanyAggregate

**Root entity:** `Company` — a company IS the shop, no separate shop collection exists or will (ADR-007). Model `BEs/marketplace-common/src/models/MongoDB/Company.mts`, validator `BEs/marketplace-db-setup/lib/schemas/company.js`.
**Bounded context:** **BC-04** (Legal Entity / Company).
**Boundary:** one `company` document. It is the consistency boundary for both halves of what a company is at once — its legal identity (`legalName`, `vatNumber`, `taxCode`, `certifiedEmail`) and its own publication state (`publicName`, `slug`, `description`, `published`). Both halves live in the same document because there is exactly one write boundary to put them in.

**Entities and value objects:**
| Name | Type | Description |
|---|---|---|
| `Company` | Root entity | `idShopOwner` (FK, unenforced by MongoDB), `legalName`, `vatNumber`, `taxCode`, `certifiedEmail`, `address`, `publicName`, `slug`, `description`, `published`, `deleted` |
| `Address` (company) | Value object | shared `address` block from `BEs/marketplace-db-setup/lib/schemas/geo.js:89-123`; `position` (GeoJSON) is REQUIRED here, unlike `user.addresses[].position` which is optional |

**Invariants:**
- `PUBLISHED_IMPLIES_LINKABLE`: `published: true` implies `slug` and `publicName` are both present strings — DB-enforced `$expr`:
```js
// BEs/marketplace-db-setup/lib/schemas/company.js:88-100
const PUBLISHED_IMPLIES_LINKABLE = {
  $expr: { $or: [
    { $ne: ['$published', true] },
    { $and: [ { $eq: [{ $type: '$slug' }, 'string'] }, { $eq: [{ $type: '$publicName' }, 'string'] } ] }
  ] }
};
```
- `vatNumber_unique`, `certifiedEmail_unique`, `slug_unique` — global unique indexes, NO `partialFilterExpression`. A soft-deleted company keeps occupying its `vatNumber`/`certifiedEmail`/`slug` slot forever (ADR-011). One VAT number is one company, whoever registered it and whenever they stopped trading.
- `idShopOwner` FK is unenforced by MongoDB — checked only when `throwIfShopOwnerDontOwnCompany` runs (`BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts`), and only on the ShopOwner tier's own mutations. The Admin tier's `companyAdd`/`companyUpdate`/`companyDel` can act on any row and the question of what `idShopOwner` an Admin-created company gets stamped with is unexamined on disk (`EVENT_STORMING.md` §5 hotspot 5).
- `companyDel` is soft delete only — `deleted` date stamped, row never removed (DCON-03, ADR-011).
- The two writer tiers deliberately diverge on an already-retired row: ShopOwner tier's guard filters `deleted` and answers 403; Admin tier's guard does not filter it and answers 200 — this is the platform's canonical example that liveness belongs on read/ownership guards, never on the delete write itself (`docs/data-model.md`).

**Commands:** `companyAdd`/`companyUpdate`/`companyDel` — two writer services, `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts` (ShopOwner tier, own rows, answers `OnlyIdType`) and the Admin-tier sibling of the same name (any row, answers `Boolean`). Contract divergence only — same aggregate, same root, same validator.

**Events emitted:** Company Registered, Duplicate vatNumber/certifiedEmail/slug Rejected, Company Updated, Company Made Public, Company Retired, Delete Refused - Already Retired, Delete Accepted On Already-Retired Row.

---

### ItemAggregate

**Root entity:** `Item` — the single generic, domain-neutral catalogue entry: it presumes nothing about what is sold, and a new product type is an `itemCategory` row rather than a new collection or vocabulary of its own (ADR-008). Model `BEs/marketplace-common/src/models/MongoDB/Item.mts`, validator `BEs/marketplace-db-setup/lib/schemas/item.js`.
**Bounded context:** **BC-05** (Catalogue).
**Boundary:** one `item` document. `idCompany` and `idCategory` name the parent and the taxonomy slot but neither is inside this document's own write — `Item` is conceptually "inside its company" but is its OWN aggregate root and its OWN MongoDB collection; nothing ties an `item` write and its parent `company`'s state into one transaction (§5).

**Entities and value objects:**
| Name | Type | Description |
|---|---|---|
| `Item` | Root entity | `idCompany` (req FK), `idCategory` (req FK), `name` (req, ≤150), `description` (req, ≤2000), `slug` (req), `published` (bool), `deleted` (date, optional) |

**Invariants:**
- `idCompany` ownership is checked BEFORE `idCategory` existence, deliberately — "a caller who does not own the shop learns nothing about which category ids are real" (comment at the call site):
```ts
// BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/itemAdd.mts:39-46
async resolve(_: unknown, args: IArgs, ctx: IContextShopOwnerAuthenticatedResource) {
  await throwIfShopOwnerDontOwnCompany(ctx.state.user._id, args.item.idCompany)
  await throwIfItemCategoryMissing(args.item.idCategory)
  const newItem: IItemSchema = { _id: new Types.ObjectId(), ...args.item }
```
- `idCategory` existence has no MongoDB FK — substituted entirely by `throwIfItemCategoryMissing` (`BEs/dev/marketplace-dev-authenticated-resource/src/lib/item/throwIfItemCategoryMissing.mts`), a second, unguaranteed-atomic read run before the write.
- `idCompany_slug_unique` — a slug is unique per company, not globally, per `docs/data-model.md` §Indexes.
- No `price` field, anywhere — deliberate (ADR-009). Orders/cart/delivery/payment have no model to copy; a price with nothing to buy is a guess at an undesigned decision.
- Two independent writers of `item.published` — `ShopOwner`'s own `itemUpdate` and `Admin`'s `itemUpdatePublished` (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemUpdatePublished.mts`) — both write the same flag on the same document with **no version/lock field in the schema**. A race between an owner unpublishing and an admin moderating is enforced by **nothing** (`EVENT_STORMING.md` §5 hotspot 4).

**Commands:** `itemAdd`/`itemUpdate`/`itemDel` (ShopOwner tier, own company only); `itemUpdatePublished`/`itemDel` (Admin tier, moderation).

**Events emitted:** Item Added, Add Refused - Company Not Owned, Add Refused - Category Missing, Item Updated, Item Published/Unpublished, Item Deleted, Item Published/Unpublished By Admin, Item Deleted By Admin.

---

### ItemCategoryAggregate

**Root entity:** `ItemCategory` — the platform-wide, two-level taxonomy every `Item` files under. Model `BEs/marketplace-common/src/models/MongoDB/ItemCategory.mts`, validator `BEs/marketplace-db-setup/lib/schemas/itemCategory.js`.
**Bounded context:** **BC-06** (Category Taxonomy), Admin-only writes.
**Boundary:** one `itemCategory` document. The self-FK (`idParent`) points at a SECOND document in the same collection; checking it is a cross-document read within one collection, still not atomic with the eventual insert/update.

**Entities and value objects:**
| Name | Type | Description |
|---|---|---|
| `ItemCategory` | Root entity | `name` (req, ≤100), `slug` (req, unique, `^[a-z0-9]+(?:-[a-z0-9]+)*$`), `idParent` (optional self-FK, absent = top-level), `position` (req int, sort ordinal — NOT the GeoJSON `position` of `geo.js`, `itemCategory.js` explicit "Not to be confused with" note), `deleted` |

**Invariants:**
- Depth capped at 2 levels. `$jsonSchema` cannot express it — "the parent's own `idParent` lives in a different document, and a MongoDB validator sees exactly one document at a time" (`itemCategory.js` header comment). Enforced entirely in the resolver:
```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts:23-33
export async function funItemCategoryAdd(data: IItemCategoryValidated) {
  if (data.idParent !== undefined) await throwIfParentNotTopLevel(data.idParent)
  try { await ItemCategory.create({ _id: new Types.ObjectId(), ...data }) }
  catch (e) { if (duplicateKey(e)) throwAlreadyTakenError('slug already used by another category'); throw e }
}
```
via `throwIfParentNotTopLevel` (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/throwIfParentNotTopLevel.mts`).
- `slug_unique` is global across BOTH levels, not per-parent — two subcategories called "drinks" under two different parents cannot both exist, because `/category/:slug` and `/category/:slug/:subSlug` share one URL namespace.
- Write path exists ONLY in the Admin resource service — verified: no `itemCategoryAdd`/`Update`/`Del` file exists under `marketplace-dev-authenticated-resource` or `marketplace-dev-public-resource` (`phase2/BOUNDED_CONTEXT.md` BC-06). Adding a write path elsewhere silently removes the depth cap with it (`docs/data-model.md`).
- Deleting a category does not cascade to `item` rows filed under it — they stay resolvable pointing at a soft-deleted category, on purpose (BC-06 "Does not own" note). `item.idCategory` is required, so a hard delete of the category would leave items pointing at nothing with no FK to stop it — soft delete is the only safe option here, not a stylistic choice.

**Commands:** `itemCategoryAdd`/`itemCategoryUpdate`/`itemCategoryDel` — Admin tier only.

**Events emitted:** Item Category Created, Deep-Nesting Rejected, Duplicate Slug Rejected, Item Category Updated, Item Category Deleted.

---

### UserAggregate

**Root entity:** `User` — mirrors `shopOwner`'s shape with four deliberate divergences (`docs/data-model.md`). Model `BEs/marketplace-common/src/models/MongoDB/User.mts`, validator `BEs/marketplace-db-setup/lib/schemas/user.js`.
**Bounded context:** primary **BC-07** (Customer Account & Addresses) — governs `personalData`/`addresses`/`defaultAddress`, all mutations in `BEs/dev/marketplace-dev-user-authenticated-resource`. **BC-01** also touches this same document for `login`/`resetPwd`/`emailVerify`, same "Conformist, convention only" relationship as `ShopOwner` above — one document, no schema wall between the two contexts' sub-documents (`BOUNDED_CONTEXT.md` §6).
**Boundary:** one `user` document, always — this is the single most important design fact about this aggregate, and it is why `Address` is modelled as it is below.

**Entities and value objects:**
| Name | Type | Description |
|---|---|---|
| `User` | Root entity | `login`/`resetPwd`/`emailVerify` sub-docs, `registeredAt` — only these two (`login`, `registeredAt`) are required at creation |
| `PersonalData` | Value object | optional at creation, filled in after email confirm; `firstName`/`lastName` required WITHIN it once present; `contacts` requires none of its members (unlike `shopOwner.personalData.contacts`, which requires both) |
| `Address` | **Entity** — has its own identity (`_id`), no lifecycle outside its owner | array element of `user.addresses[]`: `_id` (required), `label` (optional, ≤50 chars), shared `address` block (≤250 chars, `position` optional) |
| `defaultAddress` | Value object (pointer) | top-level `ObjectId` pointing into `addresses[]._id`, or absent — no counterpart on `shopOwner` at all |

**Why `Address` is an entity inside `UserAggregate`, not its own aggregate:** it has identity — Mongoose mints an `_id` per sub-document by default (`user.js:19-22` comment: "`_id` is REQUIRED, which is what makes `defaultAddress` expressible: a pointer needs something to point at") — but it has **no lifecycle independent of its owner**: an address is never queried, referenced, or deleted through any path except the `User` document that contains it, and no other aggregate holds a reference into `addresses[]`. That alone would justify treating it as a child entity rather than a bare value object. What forces it to stay INSIDE the `User` aggregate rather than becoming its own aggregate with its own collection is the at-most-one-default invariant below: it is enforceable ONLY if the whole array and the pointer sit in one document, because MongoDB gives this platform no multi-document transaction to fall back on (§5). Split `Address` into its own collection and "at most one default" degrades from a DB-enforced, structurally-inexpressible-otherwise guarantee (ADR-010) into a resolver convention someone has to remember to keep honest — exactly the situation `itemCategory`'s depth cap is already in (DCON-05), and not one to add a second instance of by choice.

**Invariants:**
- `login.email` unique (`INDEXES_LOGIN_EMAIL`).
- Only `login` and `registeredAt` required at creation — `personalData` optional:
```js
// BEs/marketplace-db-setup/lib/schemas/user.js:38-43
required: [
  'login',
  'registeredAt'
],
```
- `addresses[]._id` required (Mongoose-minted) — the precondition for `defaultAddress` to be expressible at all.
- **DEFAULT_ADDRESS_POINTS_INTO_ADDRESSES** — DB-enforced `$expr`, `defaultAddress` accepted only if missing or present in `$map` over `addresses`:
```js
// BEs/marketplace-db-setup/lib/schemas/user.js:70-82
const DEFAULT_ADDRESS_POINTS_INTO_ADDRESSES = {
  $expr: { $or: [
    { $eq: [{ $type: '$defaultAddress' }, 'missing'] },
    { $in: ['$defaultAddress', { $map: { input: { $ifNull: ['$addresses', []] }, in: '$$this._id' } }] }
  ] }
};
```
The `$ifNull: ['$addresses', []]` is load-bearing: `$map` over a missing field yields `null`, and `$in` against `null` errors rather than returning `false` — without it, "no addresses yet" would be an unwritable document.
- No second default is possible **by construction**, not by a check — a single root pointer instead of a per-element boolean means "second default" has no representation to reject (ADR-010). This is the design pattern this whole document repeats wherever it can: make the invalid state unrepresentable rather than add a guard against it.
- Deleting the default address must `$unset` the pointer in the SAME write, or the `$expr` above rejects the write outright:
```ts
// BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:50-62
const ret = await User.updateOne(
  { _id: _id, 'addresses._id': addressObjectId },
  [
    { $set: { addresses: { $filter: { input: '$addresses',
        cond: { $ne: ['$$this._id', addressObjectId] } } } } },
    { $set: { defaultAddress: { $cond: [
        { $eq: ['$defaultAddress', addressObjectId] }, '$$REMOVE', '$defaultAddress'] } } }
  ],
  { updatePipeline: true }
).exec()
```
Both `$set` stages run inside ONE `updateOne` pipeline against ONE document — this is the aggregate boundary made literal in code: the array filter and the pointer clear are the same write, not two.
- No `waitApprov` — customers self-serve, no operator approval gate (divergence 3 of 4 from `shopOwner`).
- `disabled`/`deleted` gate every authenticated call via `checkUserAuthorizationDisDel`, same as every collection.
- Any `ObjectId` entering the pipeline above must be coerced with `new Types.ObjectId(...)` first — Mongoose casts a query filter against the schema but casts NOTHING inside an aggregation pipeline; an uncoerced `GraphQLID` string compared against a real ObjectId via `$ne` is never equal, silently answering `matchedCount:1, modifiedCount:0` (DCON-06, the bug this exact function shipped with before the fix).

**Commands:** `userPersonalDataUpdate`, `userAddressAdd`, `userAddressUpdate`, `userDefaultAddressSet`, `userAddressDel`, `userUpdatePwd` — all in `BEs/dev/marketplace-dev-user-authenticated-resource`.

**Events emitted:** Personal Data Filled In, Address Added, Address Updated, Address Deleted, Default Address Set, Set Refused - Address Not Owned, Default Address Pointer Cleared, Password Changed, Customer Registered, Customer Logged In, Email Verified.

---

### AdminAggregate

**Root entity:** `Admin` — the platform operator, stands outside the ownership chain entirely: owns nothing, owned by nothing (`docs/data-model.md`). Model `BEs/marketplace-common/src/models/MongoDB/Admin.mts`. **No `lib/schemas/admin.js` builder exists** — unlike the other five collections, this one's `$jsonSchema` is assembled inline in its single migration, `BEs/marketplace-db-setup/migrations/20260301000000-create-admin.js:18-59`, and restated nowhere else. It is not standalone, though: the credential and state sub-shapes still come from the shared `lib/schemas/account.js` (`LOGIN`, `DELETED`, `DISABLED`, `RESET_PWD`, `INDEXES_LOGIN_EMAIL`). Only the `personalData` block is literal, because nothing else on the platform carries that shape — an operator's registry data is two names and no more.
**Bounded context:** **BC-01** (Identity & Access) only. No BC-03-equivalent onboarding context exists for `Admin` — how new `Admin` accounts get provisioned was not found by a repo-wide search for an `adminAdd` mutation in this pass (§10 open question); the one confirmed write path is the seed migration `BEs/marketplace-db-setup/migrations/20260301001800-seed-demo.js`.
**Boundary:** one `admin` document. The smallest aggregate on the platform — verified: the migration's `$jsonSchema` declares `_id`, `login`, `personalData`, `deleted`, `disabled`, `resetPwd` and `__v`, with `additionalProperties: false` at both levels, and `required: ['login', 'personalData']` (`20260301000000-create-admin.js:22-25,31-49`). No `waitApprov`, no `onboardingStep`, no `addresses`, no `emailVerify` — an operator account is provisioned, not self-registered, so there is nothing to approve and no address to confirm.

**Entities and value objects:**
| Name | Type | Description |
|---|---|---|
| `Admin` | Root entity | `login` + `personalData`, both required; `deleted` / `disabled` / `resetPwd` optional |
| `Login` | Value object | credential shape shared with `shopOwner`/`user` via `account.js`'s `LOGIN` |
| `PersonalData` | Value object | the platform's **narrowest** — `firstName` and `lastName` only, both required, both `maxLength: 100`, `additionalProperties: false` (`20260301000000-create-admin.js:31-49`). No `birth`, no `contacts`, no `address`, no `position`: an operator is never geolocated, contacted at a second address, or rendered on a card. |

**Invariants:**
- `login.email` unique, same `INDEXES_LOGIN_EMAIL` pattern as `shopOwner`/`user`.
- `personalData` required at creation, and `firstName`/`lastName` required within it — an operator document without a name is a rejected write, not an incomplete one.
- `disabled`/`deleted` gate every authenticated call via `checkUserAuthorizationDisDel`, same as every collection — even though nothing on disk was found that sets `disabled`/`deleted` on an `Admin` document (no `adminUpdateStatus`-equivalent mutation located in this pass).

**Commands:** none found under any `mutations/` directory that write this collection — login/refresh only, via the authorization services.

**Events emitted:** Admin Logged In, Login Refused, Access Token Rotated.

---

## 4. Aggregate interaction rules

Aggregates never hold a direct reference to another aggregate's internal entities or value objects. Every cross-aggregate relationship on this platform is a bare `ObjectId` FK field (`idShopOwner`, `idCompany`, `idCategory`) with **no MongoDB-level enforcement** — `additionalProperties: false` validators reject an unknown field, but nothing in any `$jsonSchema` checks that a referenced id actually exists in another collection. Communication between aggregates happens exactly one way on this platform: a resolver reads the FK id, issues a SEPARATE query against the referenced aggregate's collection through a named guard function, and only then performs its own aggregate's single-document write. There is no event bus, no saga, no outbox — "communicate through domain events" per the template's aggregate-design rule is aspirational for this codebase: the events named in §3 are documentation vocabulary (`UBIQUITOUS_LANGUAGE.md`, `EVENT_STORMING.md`) for what a mutation produced, not messages any other aggregate subscribes to or reacts to.

Every cross-aggregate (or cross-document-same-collection) guard on the platform, named:

| Guard | Direction | File |
|---|---|---|
| `throwIfShopOwnerDontOwnCompany` | Item/Company write → ShopOwner read (ownership) | `BEs/dev/marketplace-dev-authenticated-resource/src/lib/company/throwIfShopOwnerDontOwnCompany.mts` |
| `throwIfItemCategoryMissing` | Item write → ItemCategory read (existence) | `BEs/dev/marketplace-dev-authenticated-resource/src/lib/item/throwIfItemCategoryMissing.mts` |
| `throwIfParentNotTopLevel` | ItemCategory write → ItemCategory read (same collection, self-FK depth) | `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/throwIfParentNotTopLevel.mts` |
| `throwIfUserDontOwnAddress` | User write → User read (own document, not cross-aggregate — listed for completeness) | `BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/throwIfUserDontOwnAddress.mts` |
| `checkUserAuthorizationDisDel` | every authenticated resolver → its own tier's collection (session validity, not FK) | `BEs/marketplace-common/src/others/checkUserAuthorizationDisDel.mts` |
| `assertTier` | Redis session hash → resource service (cross-BC, not cross-aggregate; rejects a foreign-tier token) | `BEs/marketplace-common/src/others/assertTier.mts:21-23` |

Two aggregates deliberately span two bounded contexts each — `ShopOwnerAggregate` (BC-01 reads auth sub-docs, BC-03 owns the lifecycle) and `UserAggregate` (BC-01 reads auth sub-docs, BC-07 owns the account sub-docs) — because both are one MongoDB document written by resolvers living in different service repos, with `phase2/BOUNDED_CONTEXT.md` itself naming this "Conformist, convention only" (§1, §4, §6) rather than a construction. This document assigns each aggregate to its primary BC (§3) for citation purposes; it does not pretend the split is clean. No other aggregate here has this property — `CompanyAggregate` (BC-04), `ItemAggregate` (BC-05), `ItemCategoryAggregate` (BC-06), and `AdminAggregate` (BC-01) each sit inside exactly one context with no second writer reaching into their document.

---

## 5. Transactional boundaries and cross-aggregate invariants

**This is the most important honest observation in this document.** A MongoDB single-document `updateOne`/`create`/`findOneAndUpdate` call IS the transaction on this platform, for every domain-write resolver examined across all 6 aggregates in §3. `Item.create`, `Company.updateOne`, `ItemCategory.create`, `User.updateOne` (the `funUserAddressDel.mts` pipeline above) — every one of these is a single call against a single collection, and MongoDB guarantees atomicity for exactly that call. There is no wider transaction wrapping an `Item` write together with the `Company`-ownership check that preceded it, or an `ItemCategory` write together with the parent-depth check that preceded it: the guard's read and the aggregate's write are two separate round-trips, and nothing stops a `Company` from being deleted (or an `ItemCategory`'s `idParent` from changing) between the guard's read and the eventual write. No code path examined closes that window, and none was asked to — see §6 for exactly which invariants this leaves unenforced.

**The one place a genuine MongoDB multi-statement transaction exists is `loginAdmin`** (and its `login`/`loginUser` siblings), NOT in any domain-write resolver covered by §3:
```ts
// BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginAdmin.mts:44-47,50,71
const session = await mongoose.startSession()
try {
  await session.withTransaction(async () => {
    const admin = await tryLoginAdmin(email, password, session)
    // ...
    await updateAdminLoginStats(id, lastLogin, rememberMe, session)
```
Verified: `tryLoginAdmin` reads via `Admin.findOne` (`BEs/dev/marketplace-dev-public-authorization/src/lib/db/login/tryLoginAdmin.mts:14`) and `updateAdminLoginStats` writes back to the SAME `admin` collection — this transaction spans two round-trips against ONE aggregate's document, not two different aggregates. It exists to make the read-then-update-login-stats pair atomic against a concurrent login, not to tie `Admin` to any other collection. It does not contradict the rule above: even where Mongoose's session/transaction API is available and used on this platform, no code path was found using it to span two DIFFERENT aggregates in one ACID unit. `Company`, `Item`, `ItemCategory`, and `User` domain-write resolvers use none of `startSession`/`withTransaction` at all — confirmed absent from every mutation file cited in §3.

**Consequence:** every invariant that reads as "spans two collections" in this platform's design is, without exception, enforced by an application-level resolver guard racing a database that offers no cross-aggregate atomicity — never by a database constraint, and never by a saga or compensating action, because none exists. §6 tabulates each one and states plainly which layer (validator, resolver guard, unique index, or nothing) actually holds it.

---

## 6. Invariants table

| Invariant | Aggregate | Enforced where | What breaks if violated |
|---|---|---|---|
| `login.email` unique | ShopOwner, Company (`certifiedEmail`), User, Admin | unique index (`INDEXES_LOGIN_EMAIL`, `account.js`) | Insert rejected by MongoDB with a duplicate-key error |
| `personalData` (+ `contacts.mobile`/`contacts.email`) required at creation | ShopOwner | `$jsonSchema` validator, `shopOwner.js:38-88` | Insert rejected — the Mongoose model alone would NOT catch this (DCON-01: model omits `contacts`) |
| `waitApprov: true` blocks login | ShopOwner | resolver (authorization service reads the field) | **Nothing at the schema level** — a resolver that forgot the check would let a gated account log in; only code review holds this |
| Fresh `ShopOwner` starts gated vs ungated | ShopOwner | **nothing** — `shopOwnerAdd` never sets `waitApprov` | Unresolved on disk; behaviour depends on whatever default MongoDB gives an absent boolean field, which is "absent," not "false" |
| `onboardingStep`/`onboardingDone` advancement | ShopOwner | **nothing found** — read in 3 places, written by no discovered mutation | Fields may be permanently stale; no resolver was found that could ever change them |
| `PUBLISHED_IMPLIES_LINKABLE` | Company | `$expr` validator, `company.js:88-100` | Insert/update rejected by MongoDB |
| `vatNumber`/`certifiedEmail`/`slug` stay occupied after soft delete | Company | unique index, no `partialFilterExpression` | A retired company's vatNumber can never be re-registered by anyone — deliberate, not a bug (ADR-011) |
| `idShopOwner` FK validity | Company | resolver guard, `throwIfShopOwnerDontOwnCompany`, ShopOwner tier only | Admin tier has no ownership guard at all on `companyAdd`/`Update`/`Del` — any `idShopOwner` value can be stamped; unexamined (hotspot 5) |
| `companyDel` on already-retired row | Company | resolver guard (ShopOwner: filters `deleted`, 403; Admin: does not, 200) | Documented divergence, not a bug — see `docs/data-model.md` §`company` |
| `idCompany` ownership before `idCategory` existence, in that order | Item | two sequential resolver guards, `itemAdd.mts:39-46` | Reversed order would let a non-owner enumerate real category ids via the error message |
| `idCategory` FK validity | Item | resolver guard, `throwIfItemCategoryMissing` | An `item` can reference a deleted or nonexistent category if the guard is ever bypassed or the category is deleted in the window between check and write (§5) |
| `idCompany_slug_unique` | Item | unique index | Insert rejected — per-company slug collision |
| No `price` field | Item | `additionalProperties: false` in validator | Any write attempting to add `price` is rejected outright (DCON-02) — this is enforcement of an ABSENCE, deliberately |
| Two writers of `item.published`, no lock | Item | **nothing** — no version/lock field in schema | Last write wins; an owner unpublishing and an admin moderating concurrently can silently overwrite each other (hotspot 4) |
| `itemCategory` depth ≤ 2 | ItemCategory | resolver guard, `throwIfParentNotTopLevel` — **cannot** be a `$jsonSchema` rule (validator sees one document) | A category 3+ levels deep could be created if the write path bypassed this resolver — the write path is deliberately confined to one service to keep this true (BC-06) |
| `slug` unique across both taxonomy levels | ItemCategory | unique index, global (not scoped to `idParent`) | Insert rejected — two same-named subcategories under different parents cannot coexist |
| Deleting a category does not orphan `item.idCategory` | ItemCategory | soft delete only (`deleted` stamped, row never removed) — NOT a validator rule | If a category were ever hard-deleted, every `item` pointing at it would reference a nonexistent id with no FK to catch it |
| `defaultAddress` points into `addresses[]._id` or is absent | User | `$and: [$jsonSchema, $expr]`, `user.js:70-82` | Insert/update rejected by MongoDB — this is ADR-010's central guarantee: a second default is not merely forbidden, it has no representation to write |
| Deleting the default address `$unset`s the pointer in the same write | User | resolver, `funUserAddressDel.mts:50-62`, single aggregation-pipeline `updateOne` with `updatePipeline: true` | If the pointer were cleared in a SEPARATE write, the intermediate state (pointer dangling) would be rejected by the `$expr` above — the atomic pipeline is what makes the two-part change legal at all |
| `ObjectId` coercion before entering an aggregation pipeline | User | resolver discipline, `new Types.ObjectId(...)` before any pipeline stage (DCON-06) | Uncoerced `GraphQLID` string vs real `ObjectId` in `$ne` never matches — silent `matchedCount:1, modifiedCount:0`, the exact bug this function shipped with once |
| `disabled`/`deleted` gates every authenticated call | ShopOwner, Company (read/ownership only), User, Admin | `checkUserAuthorizationDisDel`, `BEs/marketplace-common/src/others/checkUserAuthorizationDisDel.mts` | A disabled/deleted account could keep transacting if a resolver forgot to call this — no schema-level backstop |
| Session `tier` must match the resource service | all 6, indirectly (session-level, not schema-level) | `assertTier`, 403 not 401, fails closed on missing `tier` | Foreign-tier token accepted by the wrong resource service — the real 2026-08-05 hole this closed |
| `Admin` account provisioning | Admin | **nothing found** — no `adminAdd` mutation located; only the seed migration writes this collection | How a second `Admin` account is meant to be created is unexamined (§10) |

---

## 7. DB-enforced vs code-enforced, and the pattern to repeat

| Enforcement layer | Invariants held there |
|---|---|
| `$jsonSchema` (required fields, types, `additionalProperties: false`) | field presence/shape/absence on every collection; e.g. `personalData` required on `shopOwner` but not `user`, no `price` on `item` |
| `$expr` (cross-field, single-document) | `PUBLISHED_IMPLIES_LINKABLE` on `Company`; `DEFAULT_ADDRESS_POINTS_INTO_ADDRESSES` on `User` |
| Unique index | `login.email`, `vatNumber`, `certifiedEmail`, `company.slug`, `itemCategory.slug`, `item.{idCompany,slug}` |
| Resolver guard (cross-document read before write) | `idShopOwner`/`idCompany`/`idCategory` FK existence and ownership; `itemCategory` depth cap; `waitApprov` login gate; `disabled`/`deleted` gate |
| **Nothing** | fresh-`ShopOwner` gated/ungated default; `onboardingStep`/`onboardingDone` advancement; `item.published` concurrent-writer race; Admin `idShopOwner` stamping on Admin-created companies; `Admin` account provisioning |

**ADR-010's pattern is the one to repeat, not merely the one `User.defaultAddress` happens to use.** The `$expr` approach makes a second default **inexpressible**, not merely rejected on write — there is no code path, buggy or otherwise, that can leave two `addresses[]` elements simultaneously "the default," because there is no per-element boolean to set twice. Compare this to `itemCategory`'s depth cap (§3, DCON-05): that invariant is only ever "checked," never "inexpressible" — a `$jsonSchema` genuinely cannot read a sibling document, so the guarantee is exactly as strong as the discipline of confining every write path to one resolver, in one service. Where a future aggregate needs an "at most one X" or "exactly one Y" rule, model it as a single pointer/field whose absence is legal rather than as a flag repeated per element — the DB can hold the first shape and can only ever police the second.

---

## 8. Repositories

**There is no repository layer, anywhere on this platform, and this is the current design — not a gap to silently correct.** Every resolver in every resource service imports a Mongoose model directly from `@axiumine/marketplace-common/models/MongoDB/*` (`BEs/marketplace-common/src/models/MongoDB/{Admin,Company,Item,ItemCategory,ShopOwner,User}.mts`) and calls `.findOne`/`.updateOne`/`.create`/`.aggregate` on it inline, inside the resolver's own `resolve` function. `itemAdd.mts`, `companyAdd.mts`, `funUserAddressDel.mts` — every write cited in §3 goes model → collection with nothing between them.

Cost of this, stated plainly:
- The aggregate boundary is enforced by convention (one resolver, one model, one collection) rather than by a repository type that could refuse to expose a second collection's model to the wrong resolver.
- The FK-validity guards in §4/§6 (`throwIfShopOwnerDontOwnCompany` etc.) are hand-written per call site rather than centralised behind a repository interface that could enforce them once. A new mutation that forgets to call the guard compiles and runs; nothing catches the omission except a test or a reviewer.
- Swapping the persistence layer, adding a cross-cutting audit hook, or centralising the read/ownership-guard pattern from §6 would touch every resolver file individually — there is no seam to insert it at.
- The `loginAdmin` transaction in §5 is a rare counter-example of business logic reaching for `mongoose.startSession()` directly inside a GraphQL resolver rather than behind any persistence abstraction — the same "resolver talks to Mongoose directly" pattern extends even to transaction management.

No new repository abstraction is proposed here — introducing one is an architecture-level decision (would need its own ADR, per `phase3/adr/ADR-INDEX.md` §5 "Gaps"), not a Phase 4 tactical-model concern.

---

## 9. Planned aggregates — named gaps, not designed here

Four commerce concepts are named in `phase2/BOUNDED_CONTEXT.md` BC-11 ("Ordering & Fulfilment [PLANNED - NOT BUILT]") and in `phase2/EVENT_STORMING.md` §2.9, and every one of them is out of scope for this document by `phase4/CONSTRAINTS.md` §6 and by the operator's explicit instruction (task rule 7). Listed here for completeness only — **no root entity, no boundary, no invariant, no event is defined for any of these**, because none has a collection, a migration, a resolver, or an ADR to ground it:

| Planned aggregate | Why it has no shape yet | What would need to exist first |
|---|---|---|
| **Cart** | No collection, no migration, no resolver anywhere on the 15-repo tree | An ADR deciding cart lifecycle (session-bound vs account-bound), and a decision on whether `item` needs a price field at all before a cart line item can mean anything (ADR-009 blocks this) |
| **Order** | No collection, no state machine, no resolver, no ERD node | An ADR for the state machine itself — order status transitions, who can trigger which, is genuinely new design with no existing pattern on this platform to copy (`CLAUDE.md` §Build state: "ask before inventing them") |
| **Delivery** | No collection, no resolver, no design exists for this concept | An ADR on fulfilment ownership — `BOUNDED_CONTEXT.md` §4 names `company` as the eventual fulfilment owner once this exists, but nothing today models a delivery zone, cost, or method |
| **Payment** | No gateway, no integration, no error taxonomy for payment failure modes | An ADR on the payment provider and on how a payment failure surfaces through the (also undesigned) order state machine |

Each of these needs its own ADR before it gets an aggregate boundary — not a subsection of this document. Pre-building an anti-corruption layer or a resolver stub for any of them ahead of that decision is explicitly the risk `phase2/BOUNDED_CONTEXT.md` §6 flags as worth avoiding: "the protection here is refusing to build the boundary until the context itself is designed."

---

## 10. Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Does a freshly created `ShopOwner` start with `waitApprov` true or false/absent? `shopOwnerAdd` was not found setting the field. | Backend (Admin resource service) | Open — `EVENT_STORMING.md` §5 hotspot 1 |
| 2 | What writes `shopOwner.onboardingStep`/`onboardingDone`? Read in 3 places, written by no discovered mutation. | Backend (Admin/ShopOwner resource services) | Open — `EVENT_STORMING.md` §5 hotspot 2 |
| 3 | When an Admin creates a `Company` directly (rather than approving a ShopOwner-created one), what `idShopOwner` value does it get stamped with? | Backend (Admin resource service) | Open — `EVENT_STORMING.md` §5 hotspot 5 |
| 4 | `item.published` has two independent writers (ShopOwner's `itemUpdate`, Admin's `itemUpdatePublished`) with no version/lock field. Is the race acceptable, or does `Item` need an optimistic-concurrency field? | Backend (both resource services) | Open — `EVENT_STORMING.md` §5 hotspot 4 |
| 5 | How is a new `Admin` account provisioned? No `adminAdd` mutation was found in this pass; only the seed migration writes the collection. | Backend / Ops | Open — not previously recorded in any phase 1-3 document found |
| 6 | Should `ShopOwnerAggregate` and `UserAggregate`'s cross-BC sub-document split (BC-01 vs BC-03/BC-07, same document, no schema wall) be closed with an explicit ACL, or is "Conformist, convention only" an accepted permanent state? | Architecture | Open — `BOUNDED_CONTEXT.md` §6 names it a gap, not a protection |
| 7 | Should the `idCompany`/`idCategory`/`idShopOwner` FK-existence pattern (hand-written resolver guard per call site, §4/§8) be centralised behind some reusable check, given `marketplace-common` already carries `checkUserAuthorizationDisDel` and `assertTier` as shared primitives? | Backend / Architecture | Open — this document does not propose a repository layer (§8), but the guard-duplication cost is real |
