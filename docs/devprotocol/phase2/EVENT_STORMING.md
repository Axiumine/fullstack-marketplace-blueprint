# Event Storming Output
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.3
**Date:** 2026-08-14
**Author:** event-storming-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree. No prior DEVPROTOCOL documents existed.
v1.1 - 2026-08-12: E03-S08 built the self-service registration §2.2 recorded as absent. That flow, its
activation route and the events they produce are added; hotspots 1 and 3 and questions 1 and 3 close.
Hotspot 2 stays open but stops claiming no mutation writes the onboarding fields — `shopOwnerUpdatePreferences`
does, by an operator's hand, which is exactly the gap the hotspot is about.
v1.2 - 2026-08-13: **hotspot 2 and §7 question 2 close on a decision, not on a build** (E03-S04). The
operator's hand is the writer, and it stays the only one until a shop-owner onboarding flow is designed —
which is future work, because the wizard behind it does not exist as a design anywhere on this platform.
The gap outlives the question and is now `phase5/RISK_REGISTER.md` R53, downgraded on a fact this pass
established rather than assumed: **no frontend reads either field**, so nothing is presently stuck.
v1.3 - 2026-08-14: **hotspot 5 and §6 question 6 close, and hotspot 5 was wrong twice over.** Its title said
"public tier" for three mutations that live on `marketplace-dev-admin-authenticated-resource`; there is no
public writer of `company` anywhere. Its finding — that what `idShopOwner` an Admin-created company gets is
unexamined — described a case the tier cannot produce: `companyAdd` takes `idShopOwner: ID!` explicitly and
`funCompanyAdd` resolves it against a live, non-soft-deleted `shopOwner` before the insert, 404ing otherwise.
The rationale the hotspot called undocumented is that guard's own docblock. `phase5/RISK_REGISTER.md` **R30**,
`phase4/DDD_AGGREGATES.md` §10 q3 and `phase5/epics/E03.md` §6 close with it. Nothing survives as a residual.
**Depends on:** PDR.md ✅ · SYSTEM_CONTEXT.md ✅
**Mutability:** living document — refine as domain understanding evolves

---

## 1. Purpose

Maps every domain event, cmd, actor, policy, read model in Marketplace biz flow. Feeds [`UBIQUITOUS_LANGUAGE.md`](./UBIQUITOUS_LANGUAGE.md), next in Phase 2. No `role` field, no permission enum anywhere in this codebase (`CLAUDE.md` §Terminology) — actor identity = which MongoDB collection a session authenticated against. Doc groups flows by aggregate/collection, not by UI screen, for that reason.

Vocab:
- Commands: intentional trigger, imperative present tense — a GraphQL mutation name in almost every case, one REST verb where the router exists (`GET /check/...`).
- Domain events: happened, past tense, always.
- Actors: `Admin`, `ShopOwner`, `User`, Anonymous Visitor. Never "customer"/"admin"/"superadmin" in code.
- Policies: auto reaction, "when X happens do Y" — enforced in resolver code or a MongoDB `$jsonSchema`/`$expr` validator. No workflow engine exists on this platform; every policy below is inline code or a DB constraint.
- Read models: shape of a GraphQL query response an actor reads to decide the next command.

| Business role | Code actor | Collection |
|---|---|---|
| End customer | `User` | `user` |
| Shop owner | `ShopOwner` | `shopOwner` |
| Platform operator | `Admin` | `admin` |
| Anonymous visitor | none | none |

Built vs planned, stated once because every flow below depends on it: identity, tenant, catalogue flows are BUILT, stormed in full below. Order/cart/delivery/payment are PLANNED — zero collection, zero resolver, zero migration, zero design — stormed separately in §2.9 as a naming exercise only, never as implementation fact. `item` deliberately carries no price field for exactly this reason (`BEs/marketplace-db-setup/lib/schemas/item.js`).

---

## 2. The big picture flow

### 2.1 Customer registration, verification, session lifecycle
Aggregate: `user` (`BEs/marketplace-db-setup/lib/schemas/user.js`)

```
CUSTOMER REGISTRATION & LOGIN
────────────────────────────────────────────────────────────────────────────────────────
Actor              Command                                    Domain Event
────────────────────────────────────────────────────────────────────────────────────────
Anon Visitor   →   Register (userRegister)                →   Customer Registration Requested
                                                            →   Verification Email Sent
                                                            →   Duplicate Email Rejected (login.email unique idx)
Customer       →   Confirm Email
                   (GET /check/verify-email-user/:email/:hash) → Email Verified
                                                            →   Verification Hash Rejected
Customer       →   Log In (loginUser)                     →   Customer Logged In
                                                            →   Login Refused — Unverified Email
                                                            →   Login Refused — Disabled/Deleted
Customer       →   Refresh Session (refresh)               →   Access Token Rotated
                                                            →   Refresh Refused — Foreign Tier
Customer       →   Log Out (logout, shared service)        →   Session Destroyed
```

Sources: `userRegister` mutation — `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/mutations/userRegister.mts`. Verify route — `BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts:25`, a **second route**, not a second handler bound to the same path as the shop-owner variant, because the platform docs itself notes email+hash alone cannot say which collection minted the pair. `loginUser` — `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginUser.mts`, backed by `BEs/dev/marketplace-dev-public-authorization/src/lib/db/login/tryLoginUser.mts`. Refresh — `BEs/dev/marketplace-dev-user-authenticated-authorization/src/graphQLApi/schema/mutations/refresh.mts`. Logout — one shared service for all 3 tiers, `BEs/dev/marketplace-dev-authenticated-logout/src/graphQLApi/schema/mutations/logout.mts`, resolving through:

```ts
// BEs/dev/marketplace-dev-authenticated-logout/src/lib/authorizationLogoutHandler.mts:92,106
const redRefreshSession = await readSessionField(redisClient, refreshToken, '_id')
const redAccessSession = await readSessionField(redisClient, accessToken, '_id')
```

Two things in that pair changed after it was first written down. The key is no longer the token — since
E13-S01 a session lives under the digest of it, and `readSessionField` is what tries the digest first and
the raw token second while the pre-cutover sessions drain. And the refresh field was `id` until E15-S01,
which no writer has ever written: **"Session Destroyed" was an event this platform announced and did not
produce**, because the lookup missed, the handler answered `throwAlreadyDone`, and both tokens stayed live
until they expired on their own.

Deletes by token content, tier-blind, on purpose — [`docs/architecture.md`](../../architecture.md) §Services: "one service serves every tier, because its resolver deletes the Redis keys by token content and never asks which collection minted them." `loginUser` refuses an account whose `emailVerify.valid` is false with the same generic error every other failure gets, so login cannot be used as an email-enumeration oracle (`docs/architecture.md` §Auth model).

### 2.2 Shop owner account provisioning, approval, onboarding, session lifecycle
Aggregate: `shopOwner`

~~Finding: no self-service `shopOwnerRegister` mutation exists on this platform — grepped every mutation directory across all 9 backend services, none named it. The only account-creation path is Admin-initiated.~~

**Superseded 2026-08-12 by E03-S08.** There are now two creation paths and they differ in exactly one write: `shopOwnerRegister` on `marketplace-dev-public-resource` raises `waitApprov`, `shopOwnerAdd` on the Admin service does not. A stranger may ask to become a shop owner; only an operator makes them one. The customer's registration (§2.1) has no such gate, which is the difference between opening an account and entering a commercial relationship.

```
SHOP OWNER PROVISIONING & APPROVAL
────────────────────────────────────────────────────────────────────────────────────────
Actor       Command                                     Domain Event
────────────────────────────────────────────────────────────────────────────────────────
Anon    →   Register As Shop Owner (shopOwnerRegister) →  Shop Owner Registration Requested
                                                        →   Verification Email Sent
                                                        →   (waitApprov: true — nobody may log in yet)
ShopOwner → Open Activation Link                       →   Email Verified
              (GET /check/verify-email/:email/:hash)   →   Verification Hash Rejected
Admin   →   Add Shop Owner (shopOwnerAdd)             →   Shop Owner Account Created
                                                        →   Duplicate Login Email Rejected
Admin   →   Set Status (shopOwnerUpdateStatus)        →   Shop Owner Approval Granted (waitApprov→false)
                                                        →   Shop Owner Approval Withheld (waitApprov→true)
                                                        →   Shop Owner Disabled
ShopOwner → Log In (login)                             →   Shop Owner Logged In
                                                        →   Login Refused — Unverified Email
                                                        →   Login Refused — Awaiting Approval
                                                        →   Login Refused — Disabled/Deleted
ShopOwner → Refresh Session (refresh)                  →   Access Token Rotated
ShopOwner → Log Out (logout, shared service)           →   Session Destroyed
```

⚠️ **The two refusals are ordered, and the order is the answer to "why was I refused?"** `tryLoginShopOwner` checks `emailVerify.valid === false` before `waitApprov`, so a self-registered seller who has not opened the activation link is told their address is unconfirmed rather than that they are queued. `=== false`, never `!== true`: an *absent* `emailVerify` is what every Admin-provisioned account has, and treating absent as unverified would lock out every shop owner created before 2026-08-12.

`shopOwnerAdd` mints `_id` itself and stamps `registeredAt`, but sets no `waitApprov` at all:

```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerAdd.mts:35-44
const doc: IShopOwnerSchema = {
  _id: new Types.ObjectId(),
  login: args.login,
  personalData: validateShopOwnerPersonalData(args.personalData, new Date()),
  registeredAt: new Date()
}
```

`shopOwnerUpdateStatus` is the only mutation that ever *clears* `waitApprov` — since E03-S08 `registerNewShopOwner.mts:44` raises it, on the public service, and nothing else writes the field on either side. It always sends both toggles together as non-null booleans — a deliberate full-state save, not a partial patch, "because the one thing a partial update of these two cannot express is turning a flag off":

```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerUpdateStatus.mts:6-10,29-30
interface IArgs { _id: Types.ObjectId; disabled: boolean; waitApprov: boolean }
args: {
  disabled: { type: new GraphQLNonNull(GraphQLBoolean) },
  waitApprov: { type: new GraphQLNonNull(GraphQLBoolean) }
}
```

`onboardingStep` / `onboardingDone` are read, not written, at every auth-middleware site found: `BEs/dev/marketplace-dev-authenticated-authorization/src/lib/auth/tokenInfoShopOwner.mts`, `.../src/lib/auth/authenticatedAuthorizationHandler.mts`, `BEs/dev/marketplace-dev-authenticated-resource/src/lib/auth/makeAuthCtx.mts`. The one writer is `shopOwnerUpdatePreferences` on the Admin service — an operator typing a step in by hand. Nothing advances either field as a side effect of a shop owner doing anything, which is what §5 hotspot 2 was about and what E03-S08 made urgent: an approved self-registered account arrives with a login and nothing else, so onboarding is now the flow between an approval and a shop. ⚠️ **Settled 2026-08-13 (E03-S04): the operator's hand is the writer, deliberately, until that flow is designed** — hotspot 2 and §7 question 2 close on the decision, and the work itself is deferred rather than done.

### 2.3 Admin session, moderation, itemCategory taxonomy
Aggregate: `admin`, `itemCategory`, `shopOwner` (moderation target), `item` (moderation target)

```
ADMIN SESSION & MODERATION
────────────────────────────────────────────────────────────────────────────────────────
Actor    Command                                       Domain Event
────────────────────────────────────────────────────────────────────────────────────────
Admin →  Log In (loginAdmin)                        →   Admin Logged In
Admin →  Refresh Session (refresh)                  →   Access Token Rotated
Admin →  Log Out (logout, shared service)           →   Session Destroyed
Admin →  Add Category (itemCategoryAdd)             →   Item Category Created
                                                      →   Deep-Nesting Rejected (parent not top-level)
                                                      →   Duplicate Slug Rejected
Admin →  Update Category (itemCategoryUpdate)        →   Item Category Updated
Admin →  Delete Category (itemCategoryDel)           →   Item Category Deleted
Admin →  Set Item Published (itemUpdatePublished)    →   Item Published By Admin
                                                      →   Item Unpublished By Admin
Admin →  Delete Item (itemDel, Admin tier)           →   Item Deleted By Admin
Admin →  Update Shop Owner Note/Preferences          →   Shop Owner Note Recorded
         (shopOwnerUpdateNote, shopOwnerUpdatePreferences)
```

`loginAdmin` — `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginAdmin.mts`, backed by `.../src/lib/db/login/tryLoginAdmin.mts`. The depth cap on `itemCategory` lives in the resolver, not the validator — `$jsonSchema` cannot read a sibling document to check whether its parent is itself a subcategory:

```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts:23-33
export async function funItemCategoryAdd(data: IItemCategoryValidated) {
  if (data.idParent !== undefined) await throwIfParentNotTopLevel(data.idParent)
  try {
    await ItemCategory.create({ _id: new Types.ObjectId(), ...data })
  } catch (e) {
    if (duplicateKey(e)) throwAlreadyTakenError('slug already used by another category')
    throw e
  }
}
```

Writes to `itemCategory` exist **only** in `marketplace-dev-admin-authenticated-resource` — verified: no `itemCategoryAdd`/`Update`/`Del` file under `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/` or `marketplace-dev-public-resource`. ShopOwner and public tiers read the tree, never write it (`docs/data-model.md` §`item` and `itemCategory`). `itemUpdatePublished.mts` and `itemDel.mts` under the Admin resource service (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/`) are a second writer of the same `item.published` flag the owning `ShopOwner` also writes via `itemUpdate` — flagged §5.

### 2.4 Company lifecycle
Aggregate: `company` (`BEs/marketplace-db-setup/lib/schemas/company.js`)

Two writers, by design, not overlap: `ShopOwner` on own companies only, `Admin` on any company (moderation power). Both tiers carry `companyAdd`/`companyUpdate`/`companyDel` — verified both dirs list all three: `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts` and `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts`.

```
COMPANY LIFECYCLE
────────────────────────────────────────────────────────────────────────────────────────
Actor      Command                                Domain Event
────────────────────────────────────────────────────────────────────────────────────────
ShopOwner→ Add Company (companyAdd)             → Company Registered
                                                  → Duplicate vatNumber/certifiedEmail/slug Rejected
ShopOwner→ Update Company (companyUpdate)       → Company Updated
ShopOwner→ Publish Company (companyUpdate,      → Company Made Public (published=true,
             published field)                       publicName/slug/description populated)
ShopOwner→ Delete Company (companyDel)          → Company Retired (soft delete, deleted stamped)
                                                  → Delete Refused — Already Retired (403, this tier only)
Admin   →  Add/Update/Delete Company             → Company Registered/Updated/Retired (operator path)
                                                  → Delete Accepted On Already-Retired Company (200, this tier only)
```

`companyAdd` answers `OnlyIdType`, not `Boolean`, on the ShopOwner tier — verified:

```ts
// BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts:1,27
import { OnlyIdType } from '@axiumine/koa-utils/graphQL/schema/types/OnlyIdType'
type: new GraphQLNonNull(OnlyIdType),
```

The two tiers diverge on the geo input's `type` field and on delete semantics for an already-retired company — `throwIfShopOwnerDontOwnCompany` filters `deleted` and answers 403, the Admin guard does not and answers 200 (`docs/data-model.md`, §`company`). `publicName`, `slug`, `description` and `published` live on the same collection as the legal fields, declared together by `20260301000200-create-company` — `published` defaults false, nothing indexable until the owner opts in.

### 2.5 Catalogue writes: item
Aggregate: `item` (`BEs/marketplace-db-setup/lib/schemas/item.js`)

```
CATALOGUE WRITES
────────────────────────────────────────────────────────────────────────────────────────
Actor      Command                        Domain Event
────────────────────────────────────────────────────────────────────────────────────────
ShopOwner→ Add Item (itemAdd)           → Item Added
                                          → Add Refused — Company Not Owned
                                          → Add Refused — Category Missing
ShopOwner→ Update Item (itemUpdate)     → Item Updated
                                          → Item Published / Item Unpublished (published flag)
ShopOwner→ Delete Item (itemDel)        → Item Deleted
```

Two ordered guards, both load-bearing:

```ts
// BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/itemAdd.mts:39-46
async resolve(_: unknown, args: IArgs, ctx: IContextShopOwnerAuthenticatedResource) {
  await throwIfShopOwnerDontOwnCompany(ctx.state.user._id, args.item.idCompany)
  await throwIfItemCategoryMissing(args.item.idCategory)
  const newItem: IItemSchema = { _id: new Types.ObjectId(), ...args.item }
```

Ownership checked before existence, deliberately: "a caller who does not own the shop learns nothing about which category ids are real" (comment at the same site). `itemAdd` answers `OnlyIdType` too, matching `companyAdd` and diverging from the Admin tier's plain `Boolean` returns.

### 2.6 Customer account management: personal data, addresses, default address
Aggregate: `user`

```
CUSTOMER ACCOUNT MANAGEMENT
────────────────────────────────────────────────────────────────────────────────────────
Actor      Command                                    Domain Event
────────────────────────────────────────────────────────────────────────────────────────
Customer → Update Personal Data (userPersonalDataUpdate) → Personal Data Filled In
Customer → Add Address (userAddressAdd)                → Address Added
Customer → Update Address (userAddressUpdate)           → Address Updated
Customer → Set Default Address (userDefaultAddressSet)  → Default Address Set
                                                          → Set Refused — Address Not Owned
Customer → Delete Address (userAddressDel)              → Address Deleted
                                                          → Default Address Pointer Cleared
                                                              (same write, when the deleted one was default)
Customer → Change Password (userUpdatePwd)              → Password Changed
```

`userDefaultAddressSet` is one atomic `$set` of a root-level pointer, never a two-step clear-then-set — "a customer with addresses who wants none of them preferred is not a state the ordering flow has any use for":

```ts
// BEs/dev/marketplace-dev-user-authenticated-resource/src/graphQLApi/schema/mutations/userDefaultAddressSet.mts:34-40
async resolve(_: unknown, args: IArgs, ctx: IContextUserAuthenticatedResource) {
  await throwIfUserDontOwnAddress(ctx.state.user._id, args._id)
  try {
    await funUserDefaultAddressSet(ctx.state.user._id, args._id)
```

Deleting the default address must `$unset` the pointer in the same write, or the collection's `$expr` validator rejects the write outright — `funUserAddressDel.mts` exists at `BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts` (verified on disk) and is an aggregation-pipeline update, not a plain `$pull`:

```ts
// BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:50-62 (per PDR.md, cross-checked file exists)
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

### 2.7 Public discovery — read-only, no domain event
Aggregate: `company`, `item`, `itemCategory` (read side)

Nothing here mutates state, so nothing here fires a domain event in the strict sense — listed for actor completeness (System Context requires every actor to appear at least once) and because §4 Read Models depends on naming these queries.

```
PUBLIC DISCOVERY
────────────────────────────────────────────────────────────────────────────────────────
Actor            Query                                     Read Model Returned
────────────────────────────────────────────────────────────────────────────────────────
Anon Visitor →  companies / companyBySlug                → published-only company list/page
Anon Visitor →  companiesNearby (bbox or near)            → companies sorted by distance, or bbox filter
Anon Visitor →  items / itemBySlug                        → published-only item list/page
Anon Visitor →  itemCategories                            → 2-level category tree
Anon Visitor →  search                                    → text-search hits across company + item
Anon Visitor →  sitemapEntries                             → slugs for SSR sitemap generation
```

`companiesNearby` runs exactly one of two disjoint code paths depending on the argument sent, never both:

```ts
// BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/companiesNearby.mts:1-4,44-48
// No `centerSphereFilter` here, deliberately: the map's radius path wants distances back, so it uses
// `$geoNear` — which sorts and reports `distanceMeters` — while `centerSphereFilter` exists for the
// one caller that cannot sort by distance because it already sorts by relevance. See `search`.
// Both read the `address.position_2dsphere` index, created by `20260301000200-create-company`
```

Every query here answers only `published: true` documents — enforced by a shared pipeline stage, not repeated per query, per the `LIVE_PUBLIC_PIPELINE`/`livePublic` import at `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts` (imported by `companiesNearby.mts:6`).

### 2.8 Cross-cutting policy: foreign-tier token rejection
Aggregate: Redis session hash (`REDIS_KEY` prefix, shared across all 9 services)

Not a flow with its own actor — a guard every authenticated resolver in §2.1–2.6 passes through first. `assertTier(actual, expected)` throws 403, never 401, and treats a session with no `tier` field as invalid rather than a wildcard (`BEs/marketplace-common/src/others/assertTier.mts`, per `docs/architecture.md` §Auth model, pre-verified there). Modelled as a policy, §3, not a flow of its own.

### 2.9 PLANNED — commerce, out of scope, no implementation
Aggregate: none exist. Named here only so [`UBIQUITOUS_LANGUAGE.md`](./UBIQUITOUS_LANGUAGE.md) has vocabulary ready if/when this scope is opened — **never** read the presence of these names as a design decision.

```
PLANNED — NOT BUILT, NO COLLECTION, NO RESOLVER
────────────────────────────────────────────────────────────────────────────────────────
Actor       Command (hypothetical)          Domain Event (hypothetical, unimplemented)
────────────────────────────────────────────────────────────────────────────────────────
Customer →  Add To Cart                  →  Cart Item Added         [NOT BUILT]
Customer →  Place Order                  →  Order Placed            [NOT BUILT]
Customer →  Pay                          →  Payment Authorised      [NOT BUILT]
ShopOwner→  Dispatch                     →  Delivery Dispatched     [NOT BUILT]
```

Verified absence, not assumed: PDR.md's scope section lists all 6 collections that exist by migration filename (`admin`, `shopOwner`, `company`, `user`, `itemCategory`, `item`) and none is `order`/`cart`/`payment`/`delivery`; no `mutations/` directory in any of the 9 services under `BEs/dev/` contains a file matching those names (checked during §2.1–2.6 traversal above). `item` has no price field for exactly this reason — `BEs/marketplace-db-setup/lib/schemas/item.js` states outright a price would be "a guess at a design decision nobody has made." Inventing any part of this requires operator sign-off (`CLAUDE.md` §Build state: "ask before inventing them").

---

## 3. Key policies

| When this event occurs | This policy fires |
|---|---|
| Customer Registration Requested | Verification email sent via SocketLabs; wrong-hash attempts counted toward disposing of the registration (`BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts:18-24`) |
| Email Verified | `emailVerify.valid` flips true, `loginUser` stops refusing login for that account |
| Foreign-Tier Access Token Presented | `assertTier` throws 403, never 401 — caller authenticated correctly, just not for this service (`BEs/marketplace-common/src/others/assertTier.mts`) |
| Session hash carries no `tier` field | Treated as invalid, never as a wildcard — fail closed, forces re-login rather than trusting a pre-2026-08-05 session |
| Address Deleted, and it was the default | `defaultAddress` pointer `$unset` in the **same** update as the address removal (`funUserAddressDel.mts`, `updatePipeline: true`) |
| A write would leave 2 addresses marked default | Structurally impossible — `defaultAddress` is a single root pointer, not a per-element boolean, so "second default" has no representation to reject |
| `itemCategoryAdd`/`itemCategoryUpdate` given an `idParent` that is itself a subcategory | `throwIfParentNotTopLevel` rejects — depth cap enforced in the resolver, `$jsonSchema` cannot read a sibling document |
| `companyDel` called on an already-retired company, ShopOwner tier | `throwIfShopOwnerDontOwnCompany` filters `deleted`, answers 403 |
| `companyDel` called on an already-retired company, Admin tier | Guard does not filter `deleted`, answers 200 — liveness belongs on read/ownership paths, never on the delete write itself (`docs/data-model.md` §`company`) |
| ShopOwner logs in while `waitApprov` is true | Login refused, generic error, same shape as every other login failure |
| Any account (`Admin`/`ShopOwner`/`User`) is `deleted` or `disabled` | `checkUserAuthorizationDisDel` gates every authenticated resource call, all 3 tiers |
| Logout mutation called, any tier's token | Same Redis keys (`REDIS_KEY` + token) deleted regardless of which service minted them — token-content lookup, not tier-scoped (`authorizationLogoutHandler.mts:60,74`) |
| `itemAdd`/`itemUpdate` given an `idCategory` that does not exist | `throwIfItemCategoryMissing` rejects — nothing else enforces the reference |
| `itemAdd` given an `idCompany` the caller does not own | `throwIfShopOwnerDontOwnCompany` rejects, checked **before** the category-existence check so a non-owner learns nothing about real category ids |
| `x-introspectioncode` header present and matching `INTROSPECTION_CODE` | Bearer-token check bypassed — service-to-service call, never a browser client (`docs/architecture.md` §Auth model) |

---

## 4. Read models

| Read model | Used by | Contains |
|---|---|---|
| `me` (`GraphQLUserMe`) | Customer | personal data (optional until filled in), `addresses[]`, `defaultAddress` pointer, login/verify state — `BEs/dev/marketplace-dev-user-authenticated-resource/src/graphQLApi/schema/queries/me.mts` |
| `shopOwnerCompanies` / `companyItems` / `itemCategories` (ShopOwner tier) | ShopOwner | own `company` documents, own `item` documents per company, the admin-curated category tree (read-only on this tier) — `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/queries/` |
| `shopOwnerById` (Admin tier, `GraphQLShopOwnerById`) | Admin | full account incl. `waitApprov`, `disabled`, onboarding fields, note/preferences — the approval-screen read model — `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/queries/shopOwnerById.mts` |
| `companies` / `companiesNearby` / `companyBySlug` / `items` / `itemBySlug` / `itemCategories` / `search` / `sitemapEntries` (public-resource) | Anon Visitor, Customer | published-only projection of `company`/`item`/`itemCategory`, filtered through `livePublic`/`LIVE_PUBLIC_PIPELINE` — `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts` |
| `RefreshType` (`refresh` mutation response) | all 3 authenticated tiers | new access/refresh token pair, expiry — read once per refresh cycle, never persisted client-side beyond the httpOnly cookie |
| `helloRefresh` / `Hello2Type` | every authenticated + authorization service | liveness/introspection probe, not a business read model — listed because it is the only query some of these services expose |

---

## 5. Hotspots (unresolved complexity)

| # | Hotspot | Description |
|---|---|---|
| 1 | ~~`waitApprov` field semantics~~ **Closed 2026-08-12 by E03-S08** | The comment that conflated "awaiting approval" with "deleted" was rewritten to say what the field holds and who writes it. A freshly created ShopOwner starts gated or ungated **depending on who created it**: `shopOwnerRegister` writes `true`, `shopOwnerAdd` writes nothing. Which mutation ran is the whole meaning of the flag. No backfill was needed — every document on disk predates the public form. |
| 2 | ~~`onboardingStep` / `onboardingDone` advancement~~ **Closed 2026-08-13 by E03-S04 — decided, not built** | Read at `tokenInfoShopOwner.mts`, `authenticatedAuthorizationHandler.mts`, `makeAuthCtx.mts`; written by `shopOwnerUpdatePreferences`, an Admin typing a value in. **That is now the answer rather than the finding: the operator's hand is the only writer by decision, and a shop-owner-side write is future work.** What it would take is a wizard nobody has designed — what the ≤4-character steps are, what "done" means, and whether the shop-owner app writes the fields itself or asks for an operator's review — and inventing one here would be inventing product design. The gap does not close with the question: it is `RISK_REGISTER.md` **R53**, which records that no frontend reads either field today, so nothing is stuck waiting for them. |
| 3 | ~~No self-service shop-owner registration~~ **Closed 2026-08-12 by E03-S08** | Built as `shopOwnerRegister` on `marketplace-dev-public-resource`, with `/register/seller` on `marketplace-user` in front of it. Admin-provisioning stayed: it is the route for a shop the platform recruited, and it skips the approval queue for that reason. |
| 4 | Two independent writers of `item.published` | `ShopOwner`'s own `itemUpdate` and Admin's `itemUpdatePublished` both write the same flag on the same document. No version/lock field was seen in the `item.js` schema excerpts examined — a race between an owner unpublishing and an admin moderating is unexamined. |
| 5 | ~~Public tier's~~ **Admin tier's** `companyAdd`/`companyUpdate`/`companyDel` on the Admin resource service ~~— what `idShopOwner` an Admin-created company gets~~ **Closed 2026-08-14** | ⚠️ **Two errors, and the row title carried the first: these three mutations are Admin-tier, not public — they live on `marketplace-dev-admin-authenticated-resource` and there is no public writer of `company`.** The second was the finding itself. [`docs/frontends.md`](../../frontends.md) documents the ShopOwner-vs-Admin `companyAdd` divergence (return type, geo input) and not the operator's own create/update/delete rationale, but that rationale was never absent from disk — it is in the three `fun*` docblocks. **An Admin-created company is stamped with the id of a live `shopOwner` or it is not created**: `companyAdd` takes `idShopOwner: ID!` explicitly (the session names the operator, not the owner), and `funCompanyAdd` resolves it with `ShopOwner.exists({ _id, deleted: { $exists: false } })` before the insert, 404 `shopOwner not found` otherwise (`funCompanyAdd.mts:34-36`) — a soft-deleted owner counts as absent. The guard lives in application code because MongoDB holds no FK and the only read path, `shopOwnerCompanies`, lists by owner: an unresolvable id would insert and yield a company reachable only through the same wrong id. `update` and `del` never touch the field — `idShopOwner` is outside `ICompanyValidated`, so no owner reassignment exists, by decision. |
| 6 | Commerce vocabulary (§2.9) | Named for glossary readiness only. Zero collection, zero resolver, zero migration exists. Do not treat presence in this document as scope. |

---

## 6. Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | ~~Does self-service shop-owner registration ever get built, or does Admin-provisioning stay permanent?~~ | Product | **Closed 2026-08-12 (E03-S08) — built, and the two coexist.** |
| 2 | ~~What advances `onboardingStep`, and where does that write live? Nothing but an operator's hand, today — see hotspot 2~~ | Platform dev | **Closed 2026-08-13 (E03-S04) — an operator's hand, and that is the decision until a shop-owner onboarding flow is designed. Deferred, not built; residual R53.** |
| 3 | ~~Is `waitApprov`'s state at account creation "approved" or "pending" by default?~~ | Platform dev | **Closed 2026-08-12 (E03-S08) — neither is a default: pending when the seller registered themselves, approved when an operator created them.** |
| 4 | When order/cart/payment/delivery design work starts, who signs off the first schema? | Product + platform dev | Open |
| 5 | Should `itemUpdatePublished` (Admin) and `itemUpdate` (ShopOwner) get a version/lock field before two moderators can race on the same item? | Platform dev | Open |
| 6 | ~~What `idShopOwner` does an Admin-created `company` document get, absent an owning ShopOwner having created it first?~~ | Platform dev | **Closed 2026-08-14 — the id of a live `shopOwner`, or the company is not created.** `funCompanyAdd` resolves the explicit `idShopOwner: ID!` argument against `ShopOwner.exists({ _id, deleted: { $exists: false } })` and 404s otherwise (`…/marketplace-dev-admin-authenticated-resource/src/lib/company/funCompanyAdd.mts:34-36`), so the "absent an owning ShopOwner" case cannot occur. See hotspot 5. |
