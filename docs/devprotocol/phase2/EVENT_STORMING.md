# Event Storming Output
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.11
**Date:** 2026-08-27
**Author:** event-storming-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree. No prior DEVPROTOCOL documents existed.
v1.11 - 2026-08-27, later still: `phase5/epics/E11.md` is deleted; the epic id E11 stays in the numbering and in `EPICS_STORIES.md`, per ADR-038 §Consequences, which only the file dies. §6 open question 4's closure row pointed at "all five of `phase5/epics/E11.md` §6" — it now points at [`phase5/EPICS_STORIES.md`](../phase5/EPICS_STORIES.md) §6.1, *"The two recording stories (absorbed from `epics/E11.md`, deleted 2026-08-27)"*, which is where that record now lives; ADR-038 gains a matching §Note of its own. v1.10's citation of the same now-deleted file, below, is annotated in place rather than rewritten. Nothing else in this document — no command, event, actor, aggregate, hotspot or open question's substance — changed; the E11-side detail that question 4 used to carry stays with the ADR, not here.
v1.10 - 2026-08-27, later the same day: §6 question 6 cited `funCompanyAdd.mts:34-36` for a guard that is now at `:39-41` — the lines moved down when a comment block was written above them, and the code is unchanged. The row also records that `BOUNDED_CONTEXT.md` §7 question 6 said `Open` until today, thirteen days after this closure. Five citations pointed at "§5 open question 4" for a row that has always been in §6 — §5 is the hotspot table — and all five are corrected in the same pass: two in `phase3/adr/ADR-038…` (which records the correction in a note of its own), one in `phase5/epics/E11.md` (⚠️ that file was deleted 2026-08-27, see v1.11 below — the correction itself moved with it to `phase5/EPICS_STORIES.md` §6.1), one in `BOUNDED_CONTEXT.md` §7 q4 and one in this changelog's own v1.9 entry. No command, event, actor, aggregate or hotspot changed.
v1.9 - 2026-08-27: **§2.9 stops being PLANNED**, and §2's lead-in stops calling the split "built vs planned" — nothing here is planned. Cart, order, delivery and payment are permanently out of scope (`phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md`), so the board's one hypothetical section is now labelled `WILL NOT BUILD`, §5 hotspot 6 says the presence of the names is a decision rather than a readiness exercise, and §6 open question 4 closes as **moot** — it asked who signs off the first commerce schema, and no first schema is coming. **Not one command, event, actor or aggregate on this board changed**, in §2.9 or anywhere else: the four hypothetical events were never implemented and are still not, and every built flow is untouched.
v1.8 - 2026-08-25: §2.3's `itemCategory` note said the ShopOwner and public tiers never write the tree. The public tier still does not; the ShopOwner tier writes `__v` on one category per item write, deliberately (`holdItemCategory`), and the note now says so. Its code example predated the transaction the depth-cap guard runs in and is replaced. ⚠️ **Renumbered 2026-08-27.** This entry was written as `v1.5`, which the 2026-08-14 entry further down already held — two different edits under one number, and a citation of "EVENT_STORMING.md v1.5" could not be resolved to one of them. It takes the next free number instead, and is placed by version rather than by date so this list stays descending from its header. Nothing in the entry, and nothing in the document, changed with the renumber; no other document cited either number.
v1.7 - 2026-08-26: §2.6 gains "Add Refused — Address Book Full", the one refusal on this aggregate that is
not about ownership, and the policy behind it: the database caps `addresses` at six and the service turns
that into a 400 naming the number.
v1.6 - 2026-08-25: §2.1 showed the customer lifecycle with no admin in it at all — every command on the
`user` aggregate was the customer's own. E19 built `userUpdateStatus`; its command, its two outcomes and
the session revocation that follows a suspension are added to the flow, with the policy pair in §3. Also
records what it does not do: nothing sets `deleted` on a `user`, and restoring revokes nothing.
v1.1 - 2026-08-12: E03-S08 built the self-service registration §2.2 recorded as absent. That flow, its
activation route and the events they produce are added; hotspots 1 and 3 and questions 1 and 3 close.
Hotspot 2 stays open but stops claiming no mutation writes the onboarding fields — `shopOwnerUpdatePreferences`
does, by an admin's hand, which is exactly the gap the hotspot is about.
v1.2 - 2026-08-13: **hotspot 2 and §7 question 2 close on a decision, not on a build** (E03-S04). The
admin's hand is the writer, and it stays the only one until a shop-owner onboarding flow is designed —
which is future work, because the wizard behind it does not exist as a design anywhere on this platform.
The gap outlives the question and is now `phase5/RISK_REGISTER.md` R53, downgraded on a fact this pass
established rather than assumed: **no frontend reads either field**, so nothing is presently stuck.
v1.3 - 2026-08-14: **hotspot 5 and §6 question 6 close, and hotspot 5 was wrong twice over.** Its title said
"public tier" for three mutations that live on `marketplace-dev-admin-authenticated-resource`; there is no
public writer of `company` anywhere. Its finding — that what `idShopOwner` an Admin-created company gets is
unexamined — described a case the tier cannot produce: `companyAdd` takes `idShopOwner: ID!` explicitly and
`funCompanyAdd` resolves it against a live, non-soft-deleted `shopOwner` before the insert, 404ing otherwise.
The rationale the hotspot called undocumented is that guard's own docblock. `phase5/RISK_REGISTER.md` **R30**,
`phase4/DDD_AGGREGATES.md` §10 q3 and `phase5/SHOPOWNER_ONBOARDING_APPROVAL.md` §6 q4 — E03's record, moved
out of `phase5/epics/E03.md` the same day — close with it. Nothing survives as a residual.
v1.4 - 2026-08-14: **hotspot 4 and §6 question 5 close on the platform owner's decision, not on work.** The
`item.published` race is accepted: last writer wins, an admin's unpublish that the owner reverses is a
normal outcome, and no version or lock field is added. Taken together with the same decision for `company`
(`phase5/COMPANY_LEGAL_ENTITY.md` §6) and recorded in `phase5/RISK_REGISTER.md` §5. The rows now also say what the code
says and the finding did not: the two writers are asymmetric — the Admin sets one field, the owner `$set`s
the whole card with `published` in it — so an owner's ordinary save undoes a takedown without touching the
flag. `itemDel` stays the takedown that sticks, `deleted` being outside `IItemUpdate`.
v1.5 - 2026-08-14, later the same day: **the asymmetry v1.4 recorded was removed rather than kept.**
Publishing is now its own command on both tiers and on both aggregates — `itemUpdatePublished` and
`companyUpdatePublished` — `published` is a field of no input object, and every add stamps it false. The
decision v1.4 records stands untouched: the two tiers still race on the flag and last writer still wins.
What is no longer true anywhere is a save of an unrelated field undoing a takedown.
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
| Platform admin | `Admin` | `admin` |
| Anonymous visitor | none | none |

Built vs will-not-build, stated once because every flow below depends on it: identity, tenant, catalogue flows are BUILT, stormed in full below. Order/cart/delivery/payment are `WILL NOT BUILD` — zero collection, zero resolver, zero migration, zero design, permanently (`phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md`) — stormed separately in §2.9 as a naming exercise only, never as implementation fact and never as a plan. `item` deliberately carries no price field for exactly this reason (`BEs/marketplace-db-setup/lib/schemas/item.js`).

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
Admin          →   Set Status (userUpdateStatus)           →   Customer Suspended (disabled→true)
                                                            →   Customer Restored (disabled→false)
                                                            →   Every Session Of That Customer Destroyed
                                                                (on suspension only)
```

`userUpdateStatus` is the admin's lever on a registered customer and the one command on this aggregate
the customer cannot issue — Admin tier, `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/userUpdateStatus.mts` (E19, 2026-08-25). It writes `disabled` and nothing else: **no mutation anywhere sets `deleted` on a `user`**, so "Customer Deleted" is not an event this platform emits. Restoring emits no session event — nobody's credentials changed, and signing a customer out for being re-enabled is not a control.

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

**Superseded 2026-08-12 by E03-S08.** There are now two creation paths and they differ in exactly one write: `shopOwnerRegister` on `marketplace-dev-public-resource` raises `waitApprov`, `shopOwnerAdd` on the Admin service does not. A stranger may ask to become a shop owner; only an admin makes them one. The customer's registration (§2.1) has no such gate, which is the difference between opening an account and entering a commercial relationship.

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

`onboardingStep` / `onboardingDone` are read, not written, at every auth-middleware site found: `BEs/dev/marketplace-dev-authenticated-authorization/src/lib/auth/tokenInfoShopOwner.mts`, `.../src/lib/auth/authenticatedAuthorizationHandler.mts`, `BEs/dev/marketplace-dev-authenticated-resource/src/lib/auth/makeAuthCtx.mts`. The one writer is `shopOwnerUpdatePreferences` on the Admin service — an admin typing a step in by hand. Nothing advances either field as a side effect of a shop owner doing anything, which is what §5 hotspot 2 was about and what E03-S08 made urgent: an approved self-registered account arrives with a login and nothing else, so onboarding is now the flow between an approval and a shop. ⚠️ **Settled 2026-08-13 (E03-S04): the admin's hand is the writer, deliberately, until that flow is designed** — hotspot 2 and §7 question 2 close on the decision, and the work itself is deferred rather than done.

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
Admin →  Set Company Published                       →   Company Made Public By Admin
         (companyUpdatePublished)                     →   Company Taken Down By Admin
                                                      →   Publish Refused — No slug/publicName (DB $expr)
Admin →  Delete Item (itemDel, Admin tier)           →   Item Deleted By Admin
Admin →  Update Shop Owner Note/Preferences          →   Shop Owner Note Recorded
         (shopOwnerUpdateNote, shopOwnerUpdatePreferences)
```

`loginAdmin` — `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginAdmin.mts`, backed by `.../src/lib/db/login/tryLoginAdmin.mts`. The depth cap on `itemCategory` lives in the resolver, not the validator — `$jsonSchema` cannot read a sibling document to check whether its parent is itself a subcategory:

```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts:38-55
export async function funItemCategoryAdd(data: IItemCategoryValidated) {
	const _id = new Types.ObjectId()
	const session = await mongoose.startSession()
	try {
		await session.withTransaction(async () => {
			// reads the parent WITH a write ($inc __v) — see throwIfParentNotTopLevel
			if (data.idParent !== undefined) await throwIfParentNotTopLevel(data.idParent, session)
			await ItemCategory.create([{ _id, ...data }], { session })
		})
	} catch (e) {
		if (duplicateKey(e)) throwAlreadyTakenError('slug already used by another category')
		throw e
	} finally { await session.endSession() }
}
```

Every `itemCategory` **mutation** exists only in `marketplace-dev-admin-authenticated-resource` — no `itemCategoryAdd`/`Update`/`Del` file under `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/` or `marketplace-dev-public-resource`. ⚠️ **One deliberate exception, one field:** `holdItemCategory` on the ShopOwner tier `$inc`s `__v` on a category inside every `itemAdd`/`itemUpdate` transaction, so an item write and a concurrent `itemCategoryDel` collide instead of skewing past each other. It reaches no domain field and no `idParent`, so the depth cap keeps exactly one enforcement point (ADR-012). (`docs/data-model.md` §`itemCategory`). `itemUpdatePublished.mts` and `itemDel.mts` under the Admin resource service (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/`) are a second writer of the same `item.published` flag the owning `ShopOwner` also writes — flagged §5. ⚠️ The owner's writer is that tier's own `itemUpdatePublished` since 2026-08-14, not `itemUpdate`: the flag left `GraphQLInputItem` when publishing became a separate operation.

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
ShopOwner→ Publish Company                      → Company Made Public (published=true)
             (companyUpdatePublished)               → Publish Refused — No slug/publicName (DB $expr)
Admin   →  Publish/Take Down Any Company        → Company Made Public / Company Taken Down
             (companyUpdatePublished)                (admin path, any owner)
ShopOwner→ Delete Company (companyDel)          → Company Retired (soft delete, deleted stamped)
                                                  → Delete Refused — Already Retired (403, this tier only)
Admin   →  Add/Update/Delete Company             → Company Registered/Updated/Retired (admin path)
                                                  → Delete Accepted On Already-Retired Company (200, this tier only)
```

`companyAdd` answers `OnlyIdType`, not `Boolean`, on the ShopOwner tier — verified:

```ts
// BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts:1,27
import { OnlyIdType } from '@axiumine/koa-utils/graphQL/schema/types/OnlyIdType'
type: new GraphQLNonNull(OnlyIdType),
```

The two tiers diverge on the geo input's `type` field and on delete semantics for an already-retired company — `throwIfShopOwnerDontOwnCompany` filters `deleted` and answers 403, the Admin guard does not and answers 200 (`docs/data-model.md`, §`company`). `publicName`, `slug`, `description` and `published` live on the same collection as the legal fields, declared together by `20260301000200-create-company` — `published` defaults false, nothing indexable until the owner opts in. ⚠️ Opting in is `companyUpdatePublished` and nothing else: since 2026-08-14 `published` is not a field of either tier's `GraphQLInputCompany`, `companyAdd` stamps `false`, and the collection's `$expr` refuses `published: true` until `slug` and `publicName` are stored — so the card is saved first and published second, in two calls.

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
ShopOwner→ Update Item (itemUpdate)     → Item Updated (never Published/Unpublished —
                                            the flag is not in GraphQLInputItem)
ShopOwner→ Publish Item                 → Item Published / Item Unpublished
             (itemUpdatePublished)
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
                                                          → Add Refused — Address Book Full
                                                              (six saved already; same write, no second read)
Customer → Update Address (userAddressUpdate)           → Address Updated
Customer → Set Default Address (userDefaultAddressSet)  → Default Address Set
                                                          → Set Refused — Address Not Owned
Customer → Delete Address (userAddressDel)              → Address Deleted
                                                          → Default Address Pointer Cleared
                                                              (same write, when the deleted one was default)
Customer → Change Password (userUpdatePwd)              → Password Changed
```

**Add Refused — Address Book Full** is the one refusal on this aggregate that is not about ownership. The
collection caps `addresses` at six (`maxItems: 6`), and the cap is a clause of the `updateOne` filter that
appends — `'addresses.5': trusted({ $exists: false })` — so the count and the push are one operation and
two adds fired at once cannot both fit through. The policy is deliberate on both halves (ADR-035): the database
refuses the seventh whatever any client does, and the service turns that into a 400 naming the number, so
the account area can say "delete one to add another" instead of showing a customer a 500.

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

### 2.9 WILL NOT BUILD — commerce, permanently out of scope, no implementation
⚠️ **Permanently out of scope as of 2026-08-27** — the platform owner's decision, [`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md). This section read `PLANNED` until then, and the sentence below said the vocabulary was ready "if/when this scope is opened". **It does not open.**
Aggregate: none exist and none will. Named here so [`UBIQUITOUS_LANGUAGE.md`](./UBIQUITOUS_LANGUAGE.md) §18 and this board name the four the same way when they are **refused** — **never** read the presence of these names as a design decision, and never as a plan.

```
WILL NOT BUILD — NO COLLECTION, NO RESOLVER, PERMANENTLY
────────────────────────────────────────────────────────────────────────────────────────
Actor       Command (hypothetical)          Domain Event (hypothetical, unimplemented)
────────────────────────────────────────────────────────────────────────────────────────
Customer →  Add To Cart                  →  Cart Item Added         [NOT BUILT]
Customer →  Place Order                  →  Order Placed            [NOT BUILT]
Customer →  Pay                          →  Payment Authorised      [NOT BUILT]
ShopOwner→  Dispatch                     →  Delivery Dispatched     [NOT BUILT]
```

Verified absence, not assumed: PDR.md's scope section lists all 6 collections that exist by migration filename (`admin`, `shopOwner`, `company`, `user`, `itemCategory`, `item`) and none is `order`/`cart`/`payment`/`delivery`; no `mutations/` directory in any of the 9 services under `BEs/dev/` contains a file matching those names (checked during §2.1–2.6 traversal above). `item` has no price field for exactly this reason, permanently — ADR-009 as made permanent by ADR-038, and `BEs/marketplace-db-setup/lib/schemas/item.js` says so in its own header comment. ⚠️ **That quotation was never a string in `item.js`** and is left here struck in spirit rather than repeated: the file says a price "would be a guess at a currency, a precision, a VAT treatment and a discount model all at once", which `phase2/BOUNDED_CONTEXT.md` corrected to the exact wording on 2026-08-13 and this line did not follow until 2026-08-27. Inventing any part of this is not an admin sign-off question any more (`CLAUDE.md` §Build state no longer says "ask before inventing them") — it is refused, and re-opening needs an ADR superseding ADR-038.

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
| Customer Suspended | `endEveryUserSession` → `revokeAllSessionsForAccount(TIER.user)` retires **both halves** of every session that customer holds, access half first. Without it the flag is a label until the next rotation: the three gates that read it bite at refresh, so a suspended customer would keep browsing for a whole access window (E15-S07's rule, applied to `user` by E19) |
| Customer Restored | No session policy fires, deliberately — nothing was revoked to reinstate, and no credential changed |
| Logout mutation called, any tier's token | Same Redis keys (`REDIS_KEY` + token) deleted regardless of which service minted them — token-content lookup, not tier-scoped (`authorizationLogoutHandler.mts:60,74`) |
| `itemAdd`/`itemUpdate` given an `idCategory` that does not exist | `throwIfItemCategoryMissing` rejects — nothing else enforces the reference |
| `itemAdd` given an `idCompany` the caller does not own | `throwIfShopOwnerDontOwnCompany` rejects, checked **before** the category-existence check so a non-owner learns nothing about real category ids |
| `x-introspectioncode` header present and matching `INTROSPECTION_CODE` | Bearer-token check bypassed — service-to-service call, never a browser client (`docs/architecture.md` §Auth model) |

---

## 4. Read models

| Read model | Used by | Contains |
|---|---|---|
| `me` (`GraphQLUserMe`) | Customer | `login.email`, personal data (optional until filled in), `addresses[]`, `defaultAddress` pointer, `registeredAt` — no `_id` argument, and the `select` is a positive field list, so `login.password`, `resetPwd` and `emailVerify` never leave the service — `BEs/dev/marketplace-dev-user-authenticated-resource/src/graphQLApi/schema/queries/me.mts` |
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
| 2 | ~~`onboardingStep` / `onboardingDone` advancement~~ **Closed 2026-08-13 by E03-S04 — decided, not built** | Read at `tokenInfoShopOwner.mts`, `authenticatedAuthorizationHandler.mts`, `makeAuthCtx.mts`; written by `shopOwnerUpdatePreferences`, an Admin typing a value in. **That is now the answer rather than the finding: the admin's hand is the only writer by decision, and a shop-owner-side write is future work.** What it would take is a wizard nobody has designed — what the ≤4-character steps are, what "done" means, and whether the shop-owner app writes the fields itself or asks for an admin's review — and inventing one here would be inventing product design. The gap does not close with the question: it is `RISK_REGISTER.md` **R53**, which records that no frontend reads either field today, so nothing is stuck waiting for them. |
| 3 | ~~No self-service shop-owner registration~~ **Closed 2026-08-12 by E03-S08** | Built as `shopOwnerRegister` on `marketplace-dev-public-resource`, with `/register/seller` on `marketplace-user` in front of it. Admin-provisioning stayed: it is the route for a shop the platform recruited, and it skips the approval queue for that reason. |
| 4 | ~~Two independent writers of `item.published`~~ **Closed 2026-08-14 — accepted, last writer wins** | ⚠️ **The platform owner's decision, taken with the same race on `company`: an admin unpublishes, the owner publishes it again, and that is fine.** No version or lock field is added to `item.js`. Two things the decision now covers, read off the code rather than assumed. ~~**The two writers are not symmetric:** `funItemUpdatePublished` writes `{ $set: { published } }` and nothing else, while the owner's `funItemUpdate` `$set`s the whole card and `IItemUpdate` keeps `published` — so an owner's ordinary save of an unrelated field restores their own value of the flag, without touching it and without meaning to.~~ ⚠️ **Struck the same day: the asymmetry was removed rather than lived with.** `published` left `GraphQLInputItem` and `IItemUpdate`, `itemAdd` stamps `false`, and the ShopOwner tier got an `itemUpdatePublished` of its own — so both writers now write `{ $set: { published } }` and nothing else. The accepted race is between two publish operations; a save of an unrelated field is no longer one of the writers. **And nothing records that an admin flipped it:** `funItemUpdatePublished`'s docblock called this "a takedown that does not stick", held open on a policy decision nobody had taken. It has now been taken — and half of what made it not stick is gone with the split, since only a deliberate republish reverses it. The takedown that sticks regardless is `itemDel` — `deleted` is outside every input, so no owner save revives a soft-deleted item. |
| 5 | ~~Public tier's~~ **Admin tier's** `companyAdd`/`companyUpdate`/`companyDel` on the Admin resource service ~~— what `idShopOwner` an Admin-created company gets~~ **Closed 2026-08-14** | ⚠️ **Two errors, and the row title carried the first: these three mutations are Admin-tier, not public — they live on `marketplace-dev-admin-authenticated-resource` and there is no public writer of `company`.** The second was the finding itself. [`docs/frontends.md`](../../frontends.md) documents the ShopOwner-vs-Admin `companyAdd` divergence (return type, geo input) and not the admin's own create/update/delete rationale, but that rationale was never absent from disk — it is in the three `fun*` docblocks. **An Admin-created company is stamped with the id of a live `shopOwner` or it is not created**: `companyAdd` takes `idShopOwner: ID!` explicitly (the session names the admin, not the owner), and `funCompanyAdd` resolves it with `ShopOwner.exists({ _id, deleted: { $exists: false } })` before the insert, 404 `shopOwner not found` otherwise (`funCompanyAdd.mts:34-36`) — a soft-deleted owner counts as absent. The guard lives in application code because MongoDB holds no FK and the only read path, `shopOwnerCompanies`, lists by owner: an unresolvable id would insert and yield a company reachable only through the same wrong id. `update` and `del` never touch the field — `idShopOwner` is outside `ICompanyValidated`, so no owner reassignment exists, by decision. |
| 6 | Commerce vocabulary (§2.9) | ⚠️ **No longer a hotspot in the "undecided" sense — decided 2026-08-27.** Named so the four are refused consistently, not for readiness. Zero collection, zero resolver, zero migration exists and none is coming (`phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md`). Do not treat presence in this document as scope, and do not treat it as a plan either. It stays listed because the temptation it names is unchanged — `phase5/RISK_REGISTER.md` R31 still tracks it. |

---

## 6. Open questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | ~~Does self-service shop-owner registration ever get built, or does Admin-provisioning stay permanent?~~ | Product | **Closed 2026-08-12 (E03-S08) — built, and the two coexist.** |
| 2 | ~~What advances `onboardingStep`, and where does that write live? Nothing but an admin's hand, today — see hotspot 2~~ | Platform dev | **Closed 2026-08-13 (E03-S04) — an admin's hand, and that is the decision until a shop-owner onboarding flow is designed. Deferred, not built; residual R53.** |
| 3 | ~~Is `waitApprov`'s state at account creation "approved" or "pending" by default?~~ | Platform dev | **Closed 2026-08-12 (E03-S08) — neither is a default: pending when the seller registered themselves, approved when an admin created them.** |
| 4 | ~~When order/cart/payment/delivery design work starts, who signs off the first schema?~~ | Platform owner | **Closed 2026-08-27 — moot: design work does not start.** The four are permanently out of scope ([`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)), so there is no first schema. ⚠️ The owner cell read **Product + platform dev** for the life of the question and that was the tell — this platform has no product function; it is a blueprint published for the community (ADR-037) and the platform owner decides everything here. Same closure as `BOUNDED_CONTEXT.md` §7 q4, `phase1/PDR.md` open question 3 and all five of [`phase5/EPICS_STORIES.md`](../phase5/EPICS_STORIES.md) §6.1, which now carries what `phase5/epics/E11.md` §6 recorded before that file's deletion 2026-08-27. |
| 5 | ~~Should `itemUpdatePublished` (Admin) and `itemUpdate` (ShopOwner) get a version/lock field before two moderators can race on the same item?~~ | Platform dev | **Closed 2026-08-14 — no.** Last writer wins, and an owner republishing after an admin's unpublish is an accepted outcome rather than a defect. See hotspot 4; recorded as accepted in `phase5/RISK_REGISTER.md` §5 (R29). ⚠️ The ShopOwner writer named here is `itemUpdatePublished` on that tier as of the same day; `itemUpdate` no longer carries the flag. |
| 6 | ~~What `idShopOwner` does an Admin-created `company` document get, absent an owning ShopOwner having created it first?~~ | Platform dev | **Closed 2026-08-14 — the id of a live `shopOwner`, or the company is not created.** `funCompanyAdd` resolves the explicit `idShopOwner: ID!` argument against `ShopOwner.exists({ _id, deleted: { $exists: false } })` and 404s otherwise (`…/marketplace-dev-admin-authenticated-resource/src/lib/company/funCompanyAdd.mts:39-41`), so the "absent an owning ShopOwner" case cannot occur. See hotspot 5. ⚠️ Citation re-pointed 2026-08-27: it read `:34-36`, which is where those two lines sat when this closed. The guard itself is unchanged — the file grew a comment block above it. `BOUNDED_CONTEXT.md` §7 question 6, the same question, carried `Open` until the same day and now carries this closure. |
