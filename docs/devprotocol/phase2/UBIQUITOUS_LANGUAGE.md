# Ubiquitous Language Glossary
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.0
**Date:** 2026-08-07
**Author:** ubiquitous-language-agent
**Changelog:** v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree. No prior DEVPROTOCOL documents existed.
**Depends on:** PDR.md ✅ · EVENT_STORMING.md ✅
**Mutability:** living document — every new term used in code, config, or docs must be defined here first

---

## 1. Purpose

Single authoritative vocabulary for Marketplace, a 15-repo polyrepo. Every term here is canonical — code, config, docs, conversation must match it. A term not here does not yet exist in the domain; propose an addition before using one. **The vocabulary is English, everywhere and without exception** — collections, fields, identifiers, function names, UI strings, routes, comments, test fixtures, migrations. A term in any other language is not a style nit here, it is a term that does not exist. Platform has no `role` field, no permission enum anywhere (`CLAUDE.md` §Terminology) — role IS which MongoDB collection a session authenticated against. That single fact drives half this glossary: three near-identical account shapes (`admin`, `shopOwner`, `user`), one per tier, never merged into one "account" concept with a role flag. Built brownfield — reverse-engineered from the working tree, not from a spec that predates the code. Prescriptive throughout: states what the platform requires, not merely what the code happens to do today.

---

## 2. How to read this glossary

Each term carries: **Definition** (1-2 sentences, precise, no circular refs — never defines a term using another undefined term), **Used in** (real on-disk path in backticks, `file:line` where it sharpens the claim), optional **Not to be confused with** (a similar-sounding term in the same domain), optional **Example** (a real code excerpt, ≤8 lines, or a concrete instance). Grouped by domain area, never alphabetical. §19 Banned Terms is the section to read before writing any code or doc for this platform — it catches the most common mistake (a non-English identifier, vocabulary that presumes what the catalogue sells, a `role` flag).

---

## 3. Actors — business role to code name

The single most important mapping on the platform. Get this wrong and every downstream document is wrong.

| Business role | Code name | Collection | Service pair prefix |
|---|---|---|---|
| Platform vendor / operator | `Admin` | `admin` | `admin-authenticated-*` |
| Shop owner | `ShopOwner` | `shopOwner` | `authenticated-*` |
| End customer | `User` | `user` | `user-authenticated-*` |
| Legal entity a shop owner registers, ALSO the shop itself | `Company` | `company` | not an auth tier |
| Unauthenticated caller | Anonymous Visitor | none | `public-*` |

### ShopOwner
**Definition:** Business owner who runs one or more shops on the platform. Authenticates against the `shopOwner` collection. Each `ShopOwner` document owns N `company` documents via `company.idShopOwner`.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/shopOwner.js`, `BEs/dev/marketplace-dev-authenticated-resource`, `BEs/dev/marketplace-dev-authenticated-authorization`, `marketplace-shopowner`.
**Not to be confused with:** `Admin` (platform operator, different collection, different service pair). Old business talk called this role "the admin" — that phrase is banned, see §19.
**Example:** No self-service registration exists — every `ShopOwner` account is Admin-provisioned via `shopOwnerAdd` (`BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerAdd.mts`). Verified: grepped every `mutations/` dir across all 9 services, no `shopOwnerRegister` exists anywhere.

### Admin
**Definition:** Platform operator, thedoctorweb staff. Authenticates against the `admin` collection. Owns nothing, is owned by nothing. Sole writer of the `itemCategory` taxonomy; can moderate any `company`/`item`/`shopOwner` document regardless of ownership.
**Used in:** `BEs/marketplace-db-setup/migrations/20260301000000-create-admin.js:1-61`, `BEs/dev/marketplace-dev-admin-authenticated-resource`, `BEs/dev/marketplace-dev-admin-authenticated-authorization`, `marketplace-admin`.
**Not to be confused with:** "superadmin" — never used in code. `ShopOwner` owns companies; `Admin` owns nothing.

### User
**Definition:** End customer. Authenticates against the `user` collection. Self-service registration + email verify + optional personal data + addresses. Cannot place orders yet — no cart/order model exists on the platform.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/user.js`, `BEs/dev/marketplace-dev-user-authenticated-resource`, `BEs/dev/marketplace-dev-user-authenticated-authorization`, `marketplace-user`.
**Not to be confused with:** "customer" — fine in prose, never in code/identifiers, code always says `User`.

### Anonymous Visitor
**Definition:** Unauthenticated caller hitting public SSR pages or public GraphQL reads. No collection, no session, no `tier` value.
**Used in:** `BEs/dev/marketplace-dev-public-resource`, `marketplace-user` SSR routes (every route except `/account/*`).

### Company
**Definition:** The legal entity a `ShopOwner` registers, AND the shop itself — there is no separate shop collection and there will not be one. `company.idShopOwner` (required) is the ownership FK. Since `20260804010000-alter-company-public`, also carries the public storefront face: `publicName`, `slug`, `description`, `published`.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/company.js`, `Company` model in `BEs/marketplace-common`.
**Not to be confused with:** `legalName` (the registered name, never shown to customers) vs `publicName` (the trading name, shown to customers). A shop owner may hold several `company` documents, each with its own `item` documents.
**Example:**
```js
// BEs/marketplace-db-setup/lib/schemas/company.js:111-125
function validatorCompany({ publicFields = false, publishedRequired = publicFields } = {}) {
  const schema = {
    bsonType: 'object', title: 'company',
    required: ['idShopOwner','legalName','vatNumber','contactPerson','administrator',
      'certifiedEmail','registryExtract','address', ...(publicFields && publishedRequired ? ['published'] : [])],
```

---

## 4. Tier, session, auth vocabulary

### Tier
**Definition:** TypeScript union `'admin' | 'shopOwner' | 'user'` naming which collection a session authenticated against. Not a permission model — three values, one per collection, grows only when a fourth collection is added.
**Used in:** `BEs/marketplace-common/src/others/Tier.mts:12-18`.
**Not to be confused with:** `role` — banned term, §19. A `role` field/enum never existed and never should.
**Example:**
```ts
// BEs/marketplace-common/src/others/Tier.mts:12-18
export const TIER = {
	admin: 'admin',
	shopOwner: 'shopOwner',
	user: 'user'
} as const
export type Tier = (typeof TIER)[keyof typeof TIER]
```

### assertTier
**Definition:** Function that throws 403 (never 401) when a session's actual tier does not equal the expected tier for the service being called. A missing `tier` on a session is invalid, never treated as a wildcard.
**Used in:** `BEs/marketplace-common/src/others/assertTier.mts:21-23`.
**Example:**
```ts
// BEs/marketplace-common/src/others/assertTier.mts:21-23
export function assertTier(actual: string | undefined, expected: Tier): void {
	if (actual !== expected) throw throwForbiddenError()
}
```

### Session
**Definition:** Redis hash keyed `${REDIS_KEY}${token}`, minted at login, carries `tier` since 2026-08-05, carries account id, refreshed on each `refresh` mutation, deleted on logout by token content.
**Used in:** shared `REDIS_KEY=marketplaceDev:` prefix across all 9 services, per `docs/architecture.md` §Auth model.
**Not to be confused with:** JWT — platform uses opaque tokens + Redis lookup, NOT JWT, despite a stale `JWT` type name surviving in some `schema.graphql` files. See §19.

### Access token
**Definition:** Opaque token sent as `Authorization: Bearer access:<token>` header, validated against Redis by every resource service.
**Used in:** every `*-authenticated-resource` service's auth middleware.

### Refresh token
**Definition:** Opaque token in a Koa signed httpOnly cookie (Keygrip SHA-512, `KEYGRIP_KEY_1`/`KEYGRIP_KEY_2`), used by the `refresh` mutation to rotate the access token.
**Used in:** every `*-authenticated-authorization` service.

### Introspection code
**Definition:** `x-introspectioncode` header value, checked against `INTROSPECTION_CODE` env var, bypasses the bearer-token check for service-to-service calls. Treat as secret — never logged, never exposed to a browser client.
**Used in:** `resolveAuthorizationSession` in `BEs/marketplace-common/src/others/` — returns `null` for the introspection bypass rather than throwing or inventing a session.

### REDIS_KEY
**Definition:** Shared Redis key prefix (`marketplaceDev:`), identical across all 9 services on purpose — the single shared `marketplace-dev-authenticated-logout` service deletes a session by token content alone and needs no per-tier prefix to find it.
**Used in:** `BEs/dev/marketplace-dev-authenticated-logout/src/lib/authorizationLogoutHandler.mts:60,74`.
**Not to be confused with:** a per-tier prefix — rejected design, would break the shared logout service.

### Service pair
**Definition:** Two Koa+Apollo services per authenticated tier — one `*-authenticated-authorization` (token lifecycle only) and one `*-authenticated-resource` (domain GraphQL, bearer-token gated). A fifth tier means a fifth service pair, not a role check bolted onto the existing ones.
**Used in:** `docs/architecture.md` §Services table.

### Resource service
**Definition:** Serves domain GraphQL behind bearer-token auth. Only resource services carry `sharp`, `clamscan`, `file-type`, `graphql-upload`.
**Used in:** `marketplace-dev-authenticated-resource`, `marketplace-dev-admin-authenticated-resource`, `marketplace-dev-user-authenticated-resource`, `marketplace-dev-public-resource`.

### Authorization service
**Definition:** Refresh-token cookie → Redis session → mints/rotates access+refresh token pair. No business queries.
**Used in:** `marketplace-dev-public-authorization`, `marketplace-dev-authenticated-authorization`, `marketplace-dev-admin-authenticated-authorization`, `marketplace-dev-user-authenticated-authorization`. Three of the four (excludes public) share one body via `resolveAuthorizationSession` / `findAccountForSession` / `refreshSessionTokens` in `marketplace-common@1.0.0`, decision recorded in `docs/decisions/authorization-service-consolidation.md`.

### checkUserAuthorizationDisDel
**Definition:** Shared guard function, gates every authenticated resource call on `deleted`/`disabled` flags, all 3 tiers.
**Used in:** `BEs/marketplace-common`, called from every resource service's auth middleware.

---

## 5. Collection: `admin`

**Definition:** Platform operator account. No approval gate, no email verify (created by hand), no `registeredAt`. Owns nothing, owned by nothing.
**Used in:** `BEs/marketplace-db-setup/migrations/20260301000000-create-admin.js:1-61`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | objectId | auto | |
| `login.email` | string ≤250 | yes | unique index `login.email_unique` |
| `login.password` | string, 60 chars exactly | yes | bcrypt hash |
| `login.firstLogin` / `login.lastLogin` | date | no | |
| `login.onboardingStep` / `login.onboardingDone` | string ≤4 / bool | no | present for shape uniformity with `shopOwner`; meaningless for `admin` |
| `login.rememberMe` | bool | no | |
| `personalData.firstName` / `lastName` | string ≤100 | yes | |
| `deleted` | date | no | soft delete |
| `disabled` | bool | no | |
| `resetPwd.resetDateReq` / `resetHash` | date / string(50) | yes if `resetPwd` present | |
| `__v` | int | no | Mongoose versionKey |

**Example:**
```js
// BEs/marketplace-db-setup/migrations/20260301000000-create-admin.js:6-11
// an admin and an shopOwner are the same thing seen from the auth side — role here is which
// collection you authenticate against, not a field. What is left below is the whole difference
// between the two: an admin has a name and nothing else. No waitApprov, no emailVerify, no registeredAt.
```

---

## 6. Collection: `shopOwner`

**Definition:** Business owner account. Mirrors `admin`'s login shape, adds full `personalData` (name, birth, address, contacts), `waitApprov` (manual approval gate), `onboardingStep`/`onboardingDone`, operator-only `notes`.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/shopOwner.js`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `login.*` | shared LOGIN shape | yes | see §11 |
| `personalData.firstName` / `lastName` | string ≤100 | yes | |
| `personalData.birth.date` | date | yes | |
| `personalData.address.*` | shared address block, maxLength 250 | yes | `position` allowed, never required — see §11 |
| `personalData.contacts.mobile` | string ≤12 | yes | |
| `personalData.contacts.landline` | string ≤12 | no | |
| `personalData.contacts.email` | string ≤250 | yes | |
| `registeredAt` | date | yes | sign-up instant |
| `deleted` | date | no | |
| `disabled` | bool | no | |
| `waitApprov` | bool | no | see below, hotspot |
| `notes` | string ≤2000 | no | operator-only, never loaded by ShopOwner tier |
| `resetPwd.*` | shared | yes if present | |
| `emailVerify.*` | shared | no | |
| `__v` | int | no | |

### waitApprov
**Definition:** Manual approval gate. Present and `true` blocks login. `shopOwnerAdd` never sets it at creation; `shopOwnerUpdateStatus` is the ONLY mutation that ever writes it, always sending both `disabled` and `waitApprov` together as non-null booleans — full-state save, not a partial patch.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/shopOwner.js:117-120`, `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerUpdateStatus.mts:6-10,29-30`.
**Not to be confused with:** `disabled` — independent flag, also written by `shopOwnerUpdateStatus` in the same call, never alone.
**Example:**
```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/.../shopOwnerUpdateStatus.mts:6-10,29-30
interface IArgs { _id: Types.ObjectId; disabled: boolean; waitApprov: boolean }
args: { disabled: { type: new GraphQLNonNull(GraphQLBoolean) },
         waitApprov: { type: new GraphQLNonNull(GraphQLBoolean) } }
```
Hotspot, unresolved: schema comment conflates "awaiting approval" with "deleted" in one boolean's doc comment (`shopOwner.js:117-120`, description reads "present and true: awaiting admin approval … or deleted"). Whether a freshly created ShopOwner starts gated or ungated is not evidenced by any resolver found on disk — open question, see `EVENT_STORMING.md` §5 hotspot 1 and §6 open question 3.

### onboardingStep / onboardingDone
**Definition:** Fields read at 3 auth-middleware sites, written by NO mutation found under any `mutations/` dir on the platform.
**Used in:** read at `BEs/dev/marketplace-dev-authenticated-authorization/src/lib/auth/tokenInfoShopOwner.mts`, `.../src/lib/auth/authenticatedAuthorizationHandler.mts`, `BEs/dev/marketplace-dev-authenticated-resource/src/lib/auth/makeAuthCtx.mts`.
Hotspot, unresolved: no confirmed write path exists on disk. Do not assume derivation logic — open question, `EVENT_STORMING.md` §6 open question 2.

---

## 7. Collection: `company`

**Definition:** The legal entity (and the shop) a `ShopOwner` registers. Two states this builder produces: the `20260803000000-create-company` shape (legal fields only) and the `publicFields: true` shape `20260804010000-alter-company-public` installs (adds storefront fields). Two independent writers by design — `ShopOwner` on own companies only, `Admin` on any company.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/company.js`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | objectId | auto | |
| `idShopOwner` | objectId | yes | ownership FK, unenforced |
| `legalName` | string ≤100 | yes | registered name including legal form — never shown to customers, see §12 |
| `vatNumber` | string, exactly 11 | yes | VAT registration number, globally unique index `vatNumber_unique`, no `partialFilterExpression` |
| `taxCode` | string, exactly 11 | no | tax code of the legal entity, not the 16-char personal form |
| `contactPerson` | string ≤50 | yes | |
| `administrator` | string ≤50 | yes | |
| `uniqueCode` | string, exactly 7 | no | |
| `certifiedEmail` | string ≤250 | yes | legally-binding certified mailbox, globally unique index `certifiedEmail_unique` |
| `address.*` | shared address block, maxLength 100, `position` REQUIRED | yes | 2dsphere index `address.position_2dsphere` |
| `registryExtract` | string ≤1000 | yes | business-register extract — a file path, not the file |
| `publicName` | string ≤100 | required once `publicFields`+`publishedRequired` on | trading name shown to customers |
| `slug` | string 2-120, pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` | optional field, required in practice by `$expr` when publishing | `/shop/:slug`, partial-unique index `slug_unique` on `{$type:'string'}` |
| `description` | string ≤2000 | no | shop page body + text-search target |
| `published` | bool | required once `publicFields` on | false = invisible to every public read |
| `deleted` | date | no | soft delete, `companyDel` stamps rather than removes |
| `__v` | int | no | |

**Not to be confused with:** `legalName` vs `publicName` — never render `legalName` on a customer-facing shop card.
**Example — the publish invariant, a second validator clause the `$jsonSchema` half cannot express:**
```js
// BEs/marketplace-db-setup/lib/schemas/company.js:88-100
const PUBLISHED_IMPLIES_LINKABLE = {
  $expr: { $or: [
    { $ne: ['$published', true] },
    { $and: [ { $eq: [{ $type: '$slug' }, 'string'] }, { $eq: [{ $type: '$publicName' }, 'string'] } ] }
  ] }
};
```
Two tiers diverge on delete semantics for an already-retired company: ShopOwner tier's `throwIfShopOwnerDontOwnCompany` filters `deleted` and answers 403; Admin tier's guard does not and answers 200 — liveness belongs on read/ownership paths, never on the delete write itself.

---

## 8. Collection: `user`

**Definition:** End customer account. Mirrors `shopOwner`'s login shape with 4 deliberate divergences: `personalData` optional, `addresses` an array (not a single embedded address), no `waitApprov`, `defaultAddress` pointer with no counterpart on `shopOwner`.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/user.js`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `login.*` | shared LOGIN shape | yes | see §11 |
| `personalData.firstName` / `lastName` | string ≤100 | required only if `personalData` present | filled in after email confirm |
| `personalData.birth.date` | date | no | |
| `personalData.contacts.mobile` / `landline` / `email` | string ≤12 / ≤12 / ≤250 | none required | `login.email` is already the credential |
| `addresses` | array of address items | no | see below |
| `defaultAddress` | objectId | no | see below |
| `registeredAt` | date | yes | |
| `deleted` | date | no | |
| `disabled` | bool | no | |
| `resetPwd.*` | shared | yes if present | |
| `emailVerify.*` | shared | no | |
| `__v` | int | no | |

### personalData
**Definition:** Optional sub-document — registration is email + password only, name/contacts filled in after email confirmed. `shopOwner`'s equivalent is required at creation.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/user.js:104-171`.

### addresses
**Definition:** Array of address elements, each carrying required `_id` (Mongoose auto-mints it), optional `label`, the shared street-address block, optional `position`.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/user.js:27-49` (`addressItem()`).
**Example:**
```js
// BEs/marketplace-db-setup/lib/schemas/user.js:34-49
return {
  ...base,
  required: ['_id', ...base.required],
  properties: { _id: { bsonType: 'objectId' },
    label: { bsonType: 'string', maxLength: 50, description: 'what the customer calls this address' },
    ...base.properties }
};
```

### label
**Definition:** Optional free-text name a customer gives an address — "home", "office". Max 50 chars.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/user.js:41-45`.

### defaultAddress
**Definition:** Single top-level ObjectId pointer into `addresses[]._id`. NOT a per-element boolean — "at most one default" is a shape, made structurally impossible to violate, rather than a rule checked at write time. Enforced by the collection's `$expr` clause: pointer must be absent OR present in `addresses[]._id`.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/user.js:70-82` (`DEFAULT_ADDRESS_POINTS_INTO_ADDRESSES`).
**Not to be confused with:** a `default: true` boolean per address element — original design, rejected, would allow two defaults simultaneously and need a clear-then-set two-step write.
**Example:**
```js
// BEs/marketplace-db-setup/lib/schemas/user.js:70-82
const DEFAULT_ADDRESS_POINTS_INTO_ADDRESSES = {
  $expr: { $or: [
    { $eq: [{ $type: '$defaultAddress' }, 'missing'] },
    { $in: ['$defaultAddress', { $map: { input: { $ifNull: ['$addresses', []] }, in: '$$this._id' } }] }
  ] }
};
```
Deleting the default address MUST `$unset` the pointer in the same update, via aggregation-pipeline `updateOne`, or the write is rejected:
```ts
// BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts:50-62
const ret = await User.updateOne(
  { _id: _id, 'addresses._id': addressObjectId },
  [ { $set: { addresses: { $filter: { input: '$addresses',
        cond: { $ne: ['$$this._id', addressObjectId] } } } } },
    { $set: { defaultAddress: { $cond: [
        { $eq: ['$defaultAddress', addressObjectId] }, '$$REMOVE', '$defaultAddress'] } } } ],
  { updatePipeline: true }
).exec()
```

### position (GeoJSON, on `user.addresses[]`)
**Definition:** Optional GeoJSON Point, tuple form `[longitude, latitude]`, filled in when the address is picked from the geocoder autocomplete. Never required — an address typed by hand has no map until re-picked.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/geo.js:30-48` (`COORDINATE_TUPLE`), `:51-69` (`position()`).
**Not to be confused with:** `itemCategory.position` — a SORT ORDINAL integer, unrelated shape, same field name, see §10.

---

## 9. Collection: `item`

**Definition:** One thing a company sells — the catalogue entry, bottom of the chain `shopOwner ──idShopOwner──> company ──idCompany──> item`. Domain-neutral by design — presumes nothing about what is sold. Deliberately carries no price field.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/item.js`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | objectId | auto | |
| `idCompany` | objectId | yes | FK, unenforced, checked in resolver |
| `idCategory` | objectId | yes | FK into `itemCategory`, either level |
| `name` | string ≤150 | yes | |
| `description` | string ≤2000 | yes | |
| `slug` | string 2-160, pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` | yes | `/shop/:slug/item/:itemSlug` — unique PER COMPANY, not globally |
| `published` | bool | yes | public visibility also requires the parent `company.published` true |
| `deleted` | date | no | soft delete |
| `__v` | int | no | |

**Not to be confused with:** a priced product — `item` deliberately carries no `price` field; see §Banned Terms rationale, §19.
**Example:**
```js
// BEs/marketplace-db-setup/lib/schemas/item.js:12-17
// ⚠️ There is no `price`. Cart, order, delivery and payment have no model anywhere on this
// platform and no design decision behind them yet, so a price would be a guess at a currency, a
// precision, a VAT treatment and a discount model all at once
```
Ownership checked before category existence, deliberately — "a caller who does not own the shop learns nothing about which category ids are real":
```ts
// BEs/dev/marketplace-dev-authenticated-resource/.../itemAdd.mts:39-46
async resolve(_: unknown, args: IArgs, ctx: IContextShopOwnerAuthenticatedResource) {
  await throwIfShopOwnerDontOwnCompany(ctx.state.user._id, args.item.idCompany)
  await throwIfItemCategoryMissing(args.item.idCategory)
  const newItem: IItemSchema = { _id: new Types.ObjectId(), ...args.item }
```
`itemAdd`/`itemUpdate` answer `OnlyIdType` on the ShopOwner tier — matches `companyAdd`, diverges from the Admin tier's plain `Boolean` returns.

---

## 10. Collection: `itemCategory`

**Definition:** Platform-wide taxonomy `item` documents are filed under. Two levels only — a document with no `idParent` is a category, one whose `idParent` names a category is a subcategory, one whose `idParent` names a subcategory is disallowed. Admin-only writes; ShopOwner and public tiers read only.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/itemCategory.js`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | objectId | auto | |
| `name` | string ≤100 | yes | |
| `slug` | string 2-120, pattern `^[a-z0-9]+(?:-[a-z0-9]+)*$` | yes | unique GLOBALLY across both levels, not per-parent |
| `idParent` | objectId | no | absent = top-level, present = subcategory |
| `position` | int, min 0 | yes | SORT ORDINAL — NOT the GeoJSON position, see §8 |
| `deleted` | date | no | items filed under a deleted category stay resolvable |
| `__v` | int | no | |

### idParent
**Definition:** Self-referencing FK. Depth cap (max 2 levels) is enforced in the resolver, NOT the validator — a `$jsonSchema` reads one document only and cannot check whether its parent is itself a subcategory.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/itemCategory.js:62-65`; enforced by `throwIfParentNotTopLevel` in `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts:23-33`.
**Example:**
```ts
// BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts:23-33
export async function funItemCategoryAdd(data: IItemCategoryValidated) {
  if (data.idParent !== undefined) await throwIfParentNotTopLevel(data.idParent)
  try { await ItemCategory.create({ _id: new Types.ObjectId(), ...data }) }
  catch (e) { if (duplicateKey(e)) throwAlreadyTakenError('slug already used by another category'); throw e }
}
```
Writes to `itemCategory` exist ONLY in `marketplace-dev-admin-authenticated-resource` — verified, no `itemCategoryAdd`/`Update`/`Del` file exists under either `marketplace-dev-authenticated-resource` or `marketplace-dev-public-resource`.

### position (sort ordinal, on `itemCategory`)
**Definition:** Integer sort order within a level, operator-set.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/itemCategory.js:66-69`.
**Not to be confused with:** GeoJSON `position` on `company.address` / `user.addresses[]` — same field name, unrelated shape, no coordinates stored here at all.

### slug (itemCategory)
**Definition:** URL segment for `/category/:slug` and `/category/:slug/:subSlug`, globally unique across both levels — two subcategories called "drinks" under two different parents would be two URLs that cannot both exist.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/itemCategory.js:55-60`.

---

## 11. Shared schema building blocks

Not collections — reusable `$jsonSchema` fragments every collection composes from. Defined once in `lib/schemas/account.js`, `lib/schemas/geo.js`, `lib/schemas/collection.js`.

### LOGIN
**Definition:** Shared login sub-document — `email` (string ≤250), `password` (bcrypt hash, string exactly 60 chars), `firstLogin`/`lastLogin` (date), `onboardingStep` (string ≤4)/`onboardingDone` (bool, ShopOwner tier reads only), `rememberMe` (bool). One shape across `admin`, `shopOwner`, `user` — the three collections you authenticate against.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/account.js:18-53`.

### RESET_PWD
**Definition:** Password-reset slot — `resetDateReq` (date), `resetHash` (string, exactly 50 chars). Kept strictly disjoint from `EMAIL_VERIFY` — a shared slot let a reset-flow hash authenticate the activation flow and vice versa.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/account.js:60-80`.

### EMAIL_VERIFY
**Definition:** Verify-email slot bound to the `@axiumine/koa-utils` flow — `valid` (bool), `hash` (string, exactly 50 chars), `dateLastReq` (date, sets a 3-day window), `requestTimes` (int, wrong-hash attempts — the fifth deletes the account), `newEmailTmp` (string ≤250). No `required` array — the flow writes the sub-document piecemeal across three distinct writers.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/account.js:96-125`. On `user`: `loginUser` refuses login when `emailVerify.valid` is false, same generic error every other login failure gets.

### DELETED / DISABLED
**Definition:** `DELETED` = optional date, soft-delete stamp — never a boolean, and the document is never actually removed. `DISABLED` = optional bool, present+true blocks login.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/account.js:127-135`. `companyDel`, and every tier's equivalent, stamp `deleted` rather than deleting the document.

### address (shared street-address block)
**Definition:** `street`, `postalCode` (exactly 5 chars), `city` (≤100), `province` (exactly 2 chars) always required; `position` allowed or required depending on caller. `maxLength` on `street` varies: 100 on `company`, 250 on `shopOwner`/`user`.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/geo.js:89-123` (`address()` builder).

### position (GeoJSON builder)
**Definition:** `{ type: 'Point', coordinates: [lng, lat] }`, tuple form, longitude first. Backing `COORDINATE_TUPLE` bounds each axis separately (±180 longitude, ±90 latitude) and accepts `['double','int','long']` — an integer-valued coordinate like `9` is stored as int32 by `bson`, so a `'double'`-only validator would wrongly reject it.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/geo.js:16-48` (`COORDINATE_TUPLE`), `:51-69` (`position()`).
**Not to be confused with:** `itemCategory.position` — same field name, sort ordinal, no coordinates.

### COORDINATE_TUPLE
**Definition:** The array-form coordinate schema — 2 items, longitude then latitude, each independently bounded. GeoJSON order (`[lng, lat]`), not `[lat, lng]` — the original mongosh scripts had this backwards, which put a demo company 5000 km off before anyone fixed it.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/geo.js:30-48`.

### migrationCreation / setValidator
**Definition:** `migrationCreation(collection, validator, indexes)` builds the `up`/`down` pair of a `<ts>-create-<coll>.js` migration. `setValidator(db, collection, validator)` wraps a `collMod` — replaces a validator WHOLESALE, never merges, so every `collMod` caller must restate the complete shape.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/collection.js:26-53`.

---

## 12. The five registration fields, and what each one actually means

These five fields on `company` all look like "some official string about the business", and getting two of them confused is the most expensive mistake in this document. Each row states the exact thing the field holds.

| Field on `company` | What it holds | The confusion it invites |
|---|---|---|
| `vatNumber` | the business's VAT registration number, exactly 11 characters | not a general company id — it is globally unique across the platform, index `vatNumber_unique`, no `partialFilterExpression` |
| `taxCode` | the tax identification code **of the legal entity**, exactly 11 characters here | not the 16-character personal form an individual carries; a company's usually equals its `vatNumber` but is stored separately because it may not |
| `certifiedEmail` | a legally-binding certified mailbox, not an ordinary inbox | delivery to it counts as legal service — never treat it as a contact address to write marketing to |
| `registryExtract` | the reference of an official extract from the business register | "extract" alone would be ambiguous about which registry; this is the company-registry one |
| `legalName` | the formal registered company name, including its legal form | **never** the same thing as `publicName` — see the example below |

**Used in:** `BEs/marketplace-db-setup/lib/schemas/company.js`, `CLAUDE.md` §Two naming rules.
**Example — the distinction that matters most, `legalName` vs `publicName`:**
```
// BEs/marketplace-db-setup/lib/schemas/company.js:18-21
// `legalName` is the registered name — "Northwind Trading Ltd" — and putting it on a customer-facing card is
// wrong twice over: it is not what the shop is called, and it carries a corporate form nobody
// searches for. `publicName` is the trading name over the door.
```

---

## 13. Platform / infra vocabulary

### Polyrepo
**Definition:** 14 independent git repos + 1 parent workspace repo tracking only workspace files. NOT a monorepo — no shared tooling spans repos, one logical change = N separate commits, N separate pushes.
**Used in:** `docs/workflow.md` §This directory is the parent workspace.

### Parent workspace
**Definition:** `/media/nvme/websites/fullstack-marketplace-blueprint` on the dev machine, <https://github.com/Axiumine/fullstack-marketplace-blueprint> when read online — a 15th git repo, father of all Marketplace repos, exists so the whole platform can be seen and changed in one session. `.gitignore` excludes `/BEs/`, `/marketplace-admin/`, `/marketplace-shopowner/`, `/marketplace-user/` so sub-repos nest without conflict.
**Used in:** `docs/workflow.md` §This directory is the parent workspace.

### deploy-local.sh
**Definition:** Script in `marketplace-common` that builds the package and syncs `dist/` + `package.json` into every consumer's `node_modules/@axiumine/marketplace-common/` by globbing the workspace. Bridges the gap between "consumed as a published package name" and "not actually on any registry" — `@axiumine/marketplace-common` 404s on `registry.npmjs.org`. Must be re-run after every edit to common or consumers keep resolving the previous build.
**Used in:** `BEs/marketplace-common/deploy-local.sh`.

### Migration
**Definition:** One `migrate-mongo`-managed file under `BEs/marketplace-db-setup/migrations/`, timestamp-prefixed, immutable once applied — never edit an applied migration, add a new one. `<ts>-create-<coll>.js` creates a collection + validator + indexes; `<ts>-alter-<coll>.js` does a `collMod`.
**Used in:** `BEs/marketplace-db-setup/migrations/`, `BEs/marketplace-db-setup/CLAUDE.md` §Authoring migrations.

### Validator
**Definition:** MongoDB `$jsonSchema` (or `$and: [{$jsonSchema}, {$expr}]` when a cross-field rule is needed, as on `user` and `company`), `strict` + `additionalProperties: false`. Built from `lib/schemas/*.js`, one builder per collection, each carrying EVERY historical shape its collection has had.
**Used in:** `BEs/marketplace-db-setup/lib/schemas/README.md`, all six `lib/schemas/*.js` files.

### Coverage gate
**Definition:** 100% required on all four v8 metrics (statements/branches/functions/lines) in every package that ships code — 9 backend services, `marketplace-common`, `marketplace-db-setup`, 3 frontends, `services-status`. Gated four times over: `thresholds` in vitest config, `testCoverageThresholds` in `qodana.yaml`, and a `yarn test:cov` step in both `.githooks/pre-commit` and `.githooks/pre-push`.
**Used in:** `README.md` §Test quality gates and `docs/testing.md`.

### Mutation score
**Definition:** Stryker-measured percentage of mutants a test suite kills, gated at 100 in every package that has a coverage gate. Measures whether a test would FAIL if the code were wrong — coverage only measures whether a line RAN. The two diverge badly: `marketplace-common` scored 45.95% coverage-100%, `marketplace-db-setup` scored 52.92%.
**Used in:** `stryker.config.mjs` in each repo, `thresholds.break: 100`.
**Not to be confused with:** coverage — a survivor can exist at 100% coverage.

### Hook
**Definition:** Git hook under each repo's `.githooks/` dir, wired via `core.hooksPath` (local config, must be set by hand after clone — `git config core.hooksPath .githooks`). `pre-commit` and `pre-push`, both blocking. Every repo except `marketplace-db-setup` also gates lint.
**Used in:** `docs/workflow.md` §Git hooks, last bullet.

---

## 14. Commands — GraphQL mutations (and the one REST verb group)

A command is an intentional trigger, imperative present tense — almost always a GraphQL mutation name; three REST verbs exist (`GET /check/...`) where a real `@koa/router` is mounted, only in `marketplace-dev-public-resource`.

| Command | Actor | Aggregate | Produces | Source |
|---|---|---|---|---|
| `userRegister` | Anon Visitor | `user` | Customer Registration Requested, Verification Email Sent, Duplicate Email Rejected | `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/mutations/userRegister.mts` |
| `GET /check/verify-email-user/:email/:hash` | Customer | `user` | Email Verified, Verification Hash Rejected | `BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts:25` |
| `loginUser` | Customer | `user` | Customer Logged In, Login Refused (unverified/disabled/deleted) | `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginUser.mts`, backed by `tryLoginUser.mts` |
| `refresh` | any authenticated tier | Redis session | Access Token Rotated, Refresh Refused — Foreign Tier | `BEs/dev/marketplace-dev-user-authenticated-authorization/src/graphQLApi/schema/mutations/refresh.mts` (and its per-tier siblings) |
| `logout` | any authenticated tier | Redis session | Session Destroyed | `BEs/dev/marketplace-dev-authenticated-logout/src/graphQLApi/schema/mutations/logout.mts` — ONE service, all 3 tiers |
| `shopOwnerAdd` | Admin | `shopOwner` | Shop Owner Account Created, Duplicate Login Email Rejected | `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/shopOwnerAdd.mts` |
| `shopOwnerUpdateStatus` | Admin | `shopOwner` | Approval Granted/Withheld, Shop Owner Disabled | same dir, `shopOwnerUpdateStatus.mts` |
| `login` | ShopOwner | `shopOwner` | Shop Owner Logged In, Login Refused (awaiting approval / disabled / deleted) | `BEs/dev/marketplace-dev-public-authorization` |
| `loginAdmin` | Admin | `admin` | Admin Logged In | `BEs/dev/marketplace-dev-public-authorization/src/graphQLPublic/schema/mutations/loginAdmin.mts`, backed by `tryLoginAdmin.mts` |
| `itemCategoryAdd` | Admin | `itemCategory` | Item Category Created, Deep-Nesting Rejected, Duplicate Slug Rejected | `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/itemCategory/funItemCategoryAdd.mts` |
| `itemCategoryUpdate` | Admin | `itemCategory` | Item Category Updated | same service |
| `itemCategoryDel` | Admin | `itemCategory` | Item Category Deleted | same service |
| `itemUpdatePublished` | Admin | `item` | Item Published/Unpublished By Admin | `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/itemUpdatePublished.mts` |
| `itemDel` (Admin tier) | Admin | `item` | Item Deleted By Admin | same dir |
| `shopOwnerUpdateNote` / `shopOwnerUpdatePreferences` | Admin | `shopOwner` | Shop Owner Note Recorded | `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/` |
| `companyAdd` / `companyUpdate` / `companyDel` (ShopOwner tier) | ShopOwner | `company` | Company Registered/Updated/Retired, Delete Refused — Already Retired (403) | `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts` — answers `OnlyIdType`, not `Boolean` |
| `companyAdd` / `companyUpdate` / `companyDel` (Admin tier) | Admin | `company` | same events, plus Delete Accepted On Already-Retired Company (200) | `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/mutations/companyAdd.mts` |
| `itemAdd` / `itemUpdate` / `itemDel` (ShopOwner tier) | ShopOwner | `item` | Item Added/Updated/Deleted, Add Refused — Company Not Owned / Category Missing | `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/mutations/itemAdd.mts` |
| `userPersonalDataUpdate` | Customer | `user` | Personal Data Filled In | `BEs/dev/marketplace-dev-user-authenticated-resource/src/graphQLApi/schema/mutations/` |
| `userAddressAdd` / `userAddressUpdate` | Customer | `user.addresses` | Address Added/Updated | same dir |
| `userDefaultAddressSet` | Customer | `user` | Default Address Set, Set Refused — Address Not Owned | `.../userDefaultAddressSet.mts` |
| `userAddressDel` | Customer | `user` | Address Deleted, Default Address Pointer Cleared (same write, when deleted was default) | `BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/funUserAddressDel.mts` |
| `userUpdatePwd` | Customer | `user` | Password Changed | `BEs/dev/marketplace-dev-user-authenticated-resource/src/graphQLApi/schema/mutations/` |

**Not to be confused with:** a read/query — the platform's public discovery surface (`companies`, `items`, `search`, etc, §17) is read-only and produces no domain event.

---

## 15. Domain events

A domain event is something that happened, always past tense. Grouped by aggregate.

| Aggregate | Events |
|---|---|
| `user` | Customer Registration Requested · Verification Email Sent · Duplicate Email Rejected · Email Verified · Verification Hash Rejected · Customer Logged In · Login Refused — Unverified Email · Login Refused — Disabled/Deleted · Access Token Rotated · Refresh Refused — Foreign Tier · Session Destroyed · Personal Data Filled In · Address Added · Address Updated · Default Address Set · Set Refused — Address Not Owned · Address Deleted · Default Address Pointer Cleared · Password Changed |
| `shopOwner` | Shop Owner Account Created · Duplicate Login Email Rejected · Shop Owner Approval Granted · Shop Owner Approval Withheld · Shop Owner Disabled · Shop Owner Logged In · Login Refused — Awaiting Approval · Login Refused — Disabled/Deleted · Shop Owner Note Recorded |
| `admin` | Admin Logged In |
| `itemCategory` | Item Category Created · Deep-Nesting Rejected · Duplicate Slug Rejected · Item Category Updated · Item Category Deleted |
| `item` | Item Added · Add Refused — Company Not Owned · Add Refused — Category Missing · Item Updated · Item Published / Item Unpublished · Item Deleted · Item Published By Admin · Item Unpublished By Admin · Item Deleted By Admin |
| `company` | Company Registered · Duplicate vatNumber/certifiedEmail/slug Rejected · Company Updated · Company Made Public · Company Retired · Delete Refused — Already Retired (ShopOwner, 403) · Delete Accepted On Already-Retired Company (Admin, 200) |

**Used in:** `docs/devprotocol/phase2/EVENT_STORMING.md` §2.1-§2.6.
**Not to be confused with:** the command that triggers it — e.g. `companyDel` (command, imperative) vs Company Retired (event, past tense).

---

## 16. Key policies

A policy is an automatic reaction, "when X happens do Y" — enforced in resolver code or a MongoDB `$jsonSchema`/`$expr` validator. No workflow engine exists on this platform; every policy is inline code or a DB constraint.

| When this happens | This policy fires | Source |
|---|---|---|
| Customer Registration Requested | Verification email sent via SocketLabs, wrong-hash attempts counted toward disposing of the registration | `BEs/dev/marketplace-dev-public-resource/src/middleware/router/index.mts:18-24` |
| Foreign-Tier Access Token Presented | `assertTier` throws 403, never 401 | `BEs/marketplace-common/src/others/assertTier.mts` |
| Session hash carries no `tier` field | Treated as invalid, never a wildcard — fail closed | same |
| Address Deleted, and it was the default | `defaultAddress` `$unset` in the SAME update as the address removal | `funUserAddressDel.mts`, `updatePipeline: true` |
| A write would leave 2 addresses marked default | Structurally impossible — pointer is a single root field, not a per-element boolean | `lib/schemas/user.js` `$expr` clause |
| `itemCategoryAdd`/`Update` given an `idParent` that is itself a subcategory | `throwIfParentNotTopLevel` rejects | `funItemCategoryAdd.mts` |
| `companyDel` on an already-retired company, ShopOwner tier | 403 — guard filters `deleted` | `throwIfShopOwnerDontOwnCompany` |
| `companyDel` on an already-retired company, Admin tier | 200 — guard does not filter `deleted` | Admin resource service |
| ShopOwner logs in while `waitApprov` true | Login refused, generic error shape | login flow |
| Any account `deleted` or `disabled` | `checkUserAuthorizationDisDel` gates every authenticated call, all 3 tiers | `BEs/marketplace-common` |
| Logout, any tier's token | Same Redis keys deleted regardless of which service minted them | `authorizationLogoutHandler.mts:60,74` |
| `itemAdd`/`itemUpdate` given a nonexistent `idCategory` | `throwIfItemCategoryMissing` rejects — the substitute for a reference nothing enforces | Admin/ShopOwner resource services |
| `itemAdd` given an `idCompany` the caller does not own | `throwIfShopOwnerDontOwnCompany` rejects BEFORE the category check, so a non-owner learns nothing about real category ids | `itemAdd.mts:39-46` |
| `x-introspectioncode` header present and matching | Bearer-token check bypassed | Introspection code, §4 |

---

## 17. Read models

A read model is the shape of a GraphQL query response an actor reads to decide the next command.

| Read model | Used by | Contains | Source |
|---|---|---|---|
| `me` (`GraphQLUserMe`) | Customer | personal data (optional until filled in), `addresses[]`, `defaultAddress` pointer, login/verify state | `BEs/dev/marketplace-dev-user-authenticated-resource/src/graphQLApi/schema/queries/me.mts` |
| `shopOwnerCompanies` / `companyItems` / `itemCategories` | ShopOwner | own `company` documents, own `item` documents per company, admin-curated category tree (read-only this tier) | `BEs/dev/marketplace-dev-authenticated-resource/src/graphQLApi/schema/queries/` |
| `shopOwnerById` (`GraphQLShopOwnerById`) | Admin | full account incl. `waitApprov`, `disabled`, onboarding fields, note/preferences — the approval-screen read model | `BEs/dev/marketplace-dev-admin-authenticated-resource/src/graphQLApi/schema/queries/shopOwnerById.mts` |
| `companies` / `companiesNearby` / `companyBySlug` / `items` / `itemBySlug` / `itemCategories` / `search` / `sitemapEntries` | Anon Visitor, Customer | published-only projection of `company`/`item`/`itemCategory`, filtered through `livePublic`/`LIVE_PUBLIC_PIPELINE` | `BEs/dev/marketplace-dev-public-resource/src/lib/catalogue/publicRead.mts` |
| `RefreshType` | all 3 authenticated tiers | new access/refresh token pair + expiry | `refresh` mutation response |
| `helloRefresh` / `Hello2Type` | every authenticated + authorization service | liveness/introspection probe, not a business read model | — |

`companiesNearby` runs exactly one of two disjoint code paths depending on argument — `$geoNear` (reports distance, sorts by it) or a `centerSphereFilter` (no distance, sorts by relevance instead, used by `search`). Both read `address.position_2dsphere`.
**Used in:** `BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/queries/companiesNearby.mts:1-4,44-48`.

---

## 18. Planned commerce vocabulary — NOT BUILT

Named here for glossary readiness only. No collection, no migration, no resolver, no model, no schema builder exists for any of these four. `item` has no `price` field on purpose (§9). **Ask before inventing any of these** — none has a design yet.

| Term | Status |
|---|---|
| Cart | NOT BUILT. No collection. |
| Order | NOT BUILT. No collection, no state machine. |
| Delivery | NOT BUILT. No collection, no resolver, no design. |
| Payment | NOT BUILT. No integration, no gateway chosen. |

**Used in:** `CLAUDE.md` §Build state, ⚠️ callout under Customer area row; `EVENT_STORMING.md` §2.9.
**Not to be confused with:** treating any of the four as designed because a term exists for it here — the entry exists so a future agent names it consistently, not so it can be assumed built.

---

## 19. BANNED TERMS

Every term below is forbidden platform-wide. Reintroducing one — even as a comment or variable name — is a regression to a deleted domain or a deleted design.

| Banned term | Why | Replacement |
|---|---|---|
| any domain or brand word that presumes what the catalogue sells | Catalogue is domain-neutral by design (§9) — a new product type must not reintroduce vocabulary that presumes one. | `item` (generic catalogue entry) |
| "shop" as a separate collection | Never existed, never will. | `company` IS the shop |
| `role` field / permission enum | Never existed anywhere in code, by design. | which collection a session authenticated against — see §2 |
| `price` on `item` | Deliberately absent — no order/cart/payment to attach it to. | none — do not add without a commerce design |
| `JWT` (as a real mechanism) | Stale type name in some `schema.graphql` slices only. Auth is opaque token + Redis session, not JWT. | "access token" / "refresh token" |
| any identifier, comment, UI string or route that is not English | The platform is English-only, everywhere, with no exception (§1). A second language in one file is a second language in the database the day that file is read. | the English name — this document is the list |
| "customer" / "admin" / "superadmin" as code identifiers | Business-role words never appear in code — see §2. | `User` / `ShopOwner` / `Admin` |

**Used in:** `CLAUDE.md` §Two naming rules and `docs/data-model.md`.

---
