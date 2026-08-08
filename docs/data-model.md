# Data model

MongoDB, **6 collections** — `admin`, `shopOwner`, `company`, `user`, `item`, `itemCategory` — with
strict `$jsonSchema` validators and `additionalProperties: false`. Ownership chain:

```
shopOwner ──idShopOwner──> company ──idCompany──> item ──idCategory──> itemCategory
                                                                            ▲
                                                                    idParent ┘  (one level only)
```

`admin` and `user` both stand outside it: an operator owns nothing and is owned by nothing, and a
customer owns only the addresses embedded in their own document.

**There is no shop collection, and there will not be — a shop *is* a `company`** (ADR-007). A shop
owner may hold several `company` documents; each company holds its own `item` documents.

**Order, cart, delivery and payment do not exist** — no collection, no resolver, no design. Ask before
inventing them.

## Extension seam — adding a product type

Check first whether it is genuinely a new type or just an `item` with a different `idCategory`; the
generic shape exists precisely so most of them are the latter.

If it is genuinely new, touch in this order:

1. model in `marketplace-common` (start from `ItemModel` as reference)
2. its `exports` entry in `package.json` — there is no barrel, so an unlisted file is unreachable
3. `./deploy-local.sh`
4. migration in `marketplace-db-setup`, with its `$jsonSchema` builder under `lib/schemas/`
5. resolvers in the resource services
6. schema slice + codegen in the frontends that read it

## `user` — mirrors `shopOwner`, four deliberate divergences

Builder `lib/schemas/user.js`, reusing `account.js` (`LOGIN`, `RESET_PWD`, `EMAIL_VERIFY`, `DELETED`,
`DISABLED`, `INDEXES_LOGIN_EMAIL`) and `geo.js`. Required: `login` and `registeredAt` only — **not**
`personalData`, because registration is email + password and nothing else.

The four divergences are intentional and none of them is an accident to "fix":

1. **`personalData` is optional** — filled in after the email is confirmed.
2. **`addresses` is an array** where `shopOwner` has one `personalData.address`. Each element carries a
   required `_id`, an optional `label` and the shared address block with an optional `position`.
3. **No `waitApprov`.** Customers self-serve; there is no manual approval gate.
4. **`defaultAddress`** has no counterpart at all — see below.

### `defaultAddress` — a pointer, enforced by the database (ADR-010)

A single top-level `defaultAddress` ObjectId pointing into `addresses[]._id`. "At most one default" is
a **shape**, not a rule: a second default is inexpressible rather than merely forbidden, and setting
the default is one atomic `$set` instead of a "clear all, then set one" two-step.

The one failure a pointer *can* have is dangling, and that is checkable, so the collection validator is
`$and: [ {$jsonSchema: …}, {$expr: …} ]` where the `$expr` accepts the pointer only if it is missing or
present in `$map` over `addresses`.

- ⚠️ **Deleting the default address must `$unset` the pointer in the same update**, or the database
  rejects the write.
- The `$ifNull: ['$addresses', []]` inside that `$map` is load-bearing: `$map` over a missing field
  yields null, and `$in` against null *errors* instead of returning false — which would turn "no
  addresses yet" into a failed insert.
- Accepted cost: reading "is this address the default?" is a comparison against a sibling field rather
  than a local boolean. Any API that wants a boolean derives it.

## `item` and `itemCategory`

```
item          _id, idCompany (req), idCategory (req), name (req, ≤150), description (req, ≤2000),
              slug (req), published (bool), deleted (date, optional)
itemCategory  _id, name (req, ≤100), slug (req, unique), idParent (optional), position (int)
```

Why each field beyond `_id, idCompany, name, description` is there: `idCategory` because categories
cannot filter anything without the link, `slug` because an SEO URL needs a stable human-readable
segment, `published` so an owner can draft without appearing on an indexed page, `deleted` because
soft-delete is the platform convention.

⚠️ **No `price` field, deliberately** (ADR-009). Orders, cart, delivery and payment are out of scope
and have no model to copy.

⚠️ **`itemCategory` depth is capped at two, and the cap is in the resolver, not the validator**
(ADR-012). A `$jsonSchema` cannot read another document, so `itemCategoryAdd` / `itemCategoryUpdate`
reject a parent that is itself a subcategory — and **writes exist only in
`marketplace-dev-admin-authenticated-resource`**. The ShopOwner and public tiers read the collection
and never write it. Adding a write path elsewhere silently removes the depth cap with it.

## `company` — legal entity and public face

`legalName`, `vatNumber`, `certifiedEmail`, `taxCode` and the `address` block are the legal entity.
The customer-facing half is separate: `publicName` (the trading name shown to customers — the registered
`legalName` on a shop card is wrong), `slug` (unique, for `/shop/:slug`), `description` (page body and
text-search target) and `published`, which defaults to false so nothing is indexable until the owner
says so.

### Soft delete (ADR-011)

`company` carries an optional `deleted` (date), and `companyDel` stamps it instead of removing the document.
`vatNumber_unique` and `certifiedEmail_unique` stay plain global uniques with **no**
`partialFilterExpression`, so a retired company keeps its `vatNumber` occupied — one VAT number is one
company, whoever registered it and whenever they stopped trading.

The two tiers answer differently on an already-retired company, and both are correct: the Admin tier's
`companyDel` says 200 because its guard does not filter `deleted`; the ShopOwner tier says 403 because
`throwIfShopOwnerDontOwnCompany` does. **Liveness filters belong on read paths and on
existence/ownership guards — never on the delete write itself.**

## Indexes the public surface depends on

The catalogue is read by anonymous traffic at scale, so its indexes are design, not tuning:

- `company`: **`address.position_2dsphere`** (the map and "shops near me" are exactly this query),
  `slug_unique`, `published_list`, `published_publicName`, `published_city_publicName`, and a
  `search_text` text index.
- `item`: `idCompany_list`, `idCompany_slug_unique`, `idCompany_published`, `idCategory_published`, the
  `_name` sort variants of both, and `search_text`.
- `itemCategory`: `slug_unique`, `idParent_position`.
- `user`: `login.email_unique`, from the shared `INDEXES_LOGIN_EMAIL`.

Verify a geo query with `.explain()` and expect an `IXSCAN` on the 2dsphere, never a `COLLSCAN`.

## PII at rest — explicit CSFLE (ADR-029)

Every personal field on the four collections that hold one is **`binData` subtype 6** in MongoDB. This
is Community Edition, so there is no automatic encryption and no Queryable Encryption: the services
encrypt and decrypt explicitly, through `fieldEncryptionPlugin` in `marketplace-common`, which hooks
every Mongoose filter, update and result. A resolver sees plaintext and writes plaintext; the driver
never does.

Two algorithms, and the split is the whole design:

| Algorithm | Fields | Why |
|---|---|---|
| `AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic` | `login.email` on `admin`, `shopOwner`, `user`; `emailVerify.newEmailTmp` on `shopOwner`, `user` | the same address always produces the same bytes, so `$eq` / `$in` on the ciphertext is a working lookup — which login, password reset and email verification all need |
| `AEAD_AES_256_CBC_HMAC_SHA_512-Random` | everything else personal: names, birth dates, street/postalCode/province, GeoJSON `position`, phone numbers, contact emails, saved addresses, `shopOwner.notes`, `company.contactPerson` and `company.administrator` | no ciphertext repeats, so nothing leaks by comparison |

⚠️ **Deterministic is the weaker of the two and is used on exactly five fields.** Equal plaintext gives
equal ciphertext, which is an equality oracle for anyone holding a read on the collection. Every field
that does not have to be *found* by its value is random, and moving one the other way is a security
change, not a performance one.

⚠️ **Neither algorithm survives a sort, a range or a `$regex`.** `shopOwner.personalData.firstName`,
`lastName` and `address.city` are therefore **left in the clear**, deliberately: they are the sort keys
of `tbl_active_lastName_firstName`, `tbl_active_firstName` and `tbl_active_city`, and the `/^term/i`
targets of the operator's shop-owner table. Encrypting them would not slow that table down, it would
make it silently wrong. The same three fields on `admin` and `user` *are* encrypted, because nothing
sorts or prefix-searches those. `login.password` is not encrypted either — it is already a hash.

⚠️ **A `$jsonSchema` cannot measure the length of a ciphertext.** Where the validator used to bound a
personal string it now only checks the BSON type, so the application-level validators are the *only*
thing enforcing those lengths. Relaxing one is no longer caught a layer down.

One data encryption key per collection, alt-named `admin`, `shopOwner`, `user`, `company`, all wrapped
by a single 96-byte local master key named by `CSFLE_MASTER_KEY_PATH`. **The same file on every service
and on `marketplace-db-setup`** — a different master key makes every encrypted field on the platform an
undecryptable blob, and there is no escrow and no reset. The key vault is
`<the database MONGODB_URI points at>.__keyVault`, never a database of its own: every user on this
cluster is scoped to one database, so a vault elsewhere answers `Unauthorized` on the first
`createIndex`.

Both variables are in `REQUIRED_ENV_VARS` on all eight Mongo-using services, and
`await setupFieldEncryption()` runs immediately after `MongoDBConnect()`. A service that booted without
them would write plaintext beside ciphertext, and nothing would show that up until someone read the
data back — so it refuses to start.

## Migrations (ADR-014)

**Migrations are immutable — never edit an applied migration, add a new one.** But they are not
self-contained: the `$jsonSchema` shapes live in `marketplace-db-setup/lib/schemas/`, shared by every
migration that restates them. Current builders: `account.js`, `collection.js`, `encrypted.js`,
`geo.js`, `admin.js`, `shopOwner.js`, `company.js`, `user.js`, `item.js`, `itemCategory.js`, plus its
`README.md`.

A new product type gets a builder there rather than an inline validator.

⚠️ **A change under `lib/schemas/` is followed by a full rebuild of every database that has run these
migrations, in the same piece of work.** Each builder carries *every* historical shape of its
collection, so deleting an unused branch breaks some older migration's `down`. Read
`lib/schemas/README.md` before editing it.
