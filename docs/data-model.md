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
owner may hold several `company` rows; each company holds its own `item` rows.

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

`company` carries an optional `deleted` (date), and `companyDel` stamps it instead of removing the row.
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

## Migrations (ADR-014)

**Migrations are immutable — never edit an applied migration, add a new one.** But they are not
self-contained: the `$jsonSchema` shapes live in `marketplace-db-setup/lib/schemas/`, shared by every
migration that restates them. Current builders: `account.js`, `collection.js`, `geo.js`,
`shopOwner.js`, `company.js`, `user.js`, `item.js`, `itemCategory.js`, plus its `README.md`.

A new product type gets a builder there rather than an inline validator.

⚠️ **A change under `lib/schemas/` is followed by a full rebuild of every database that has run these
migrations, in the same piece of work.** Each builder carries *every* historical shape of its
collection, so deleting an unused branch breaks some older migration's `down`. Read
`lib/schemas/README.md` before editing it.
