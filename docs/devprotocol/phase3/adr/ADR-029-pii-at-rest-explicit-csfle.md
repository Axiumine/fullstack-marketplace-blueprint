# ADR-029 — PII at rest: explicit CSFLE, deterministic on the five lookup keys, random on the rest
# Marketplace

**Status:** accepted
**Date:** 2026-08-08
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Four of the six collections hold personal data. `admin` and `shopOwner` hold the operator's and the shop
owner's names, home address, birth date and phone numbers; `user` holds the customer's; `company` holds two
named natural persons (`contactPerson`, `administrator`) inside what is otherwise a registry record.
`item` and `itemCategory` hold none.

All of it is stored in the clear. A `mongodump`, a stolen disk image, a backup dropped in the wrong bucket
or an operator with read access to the cluster reads every one of those fields as plaintext. The
application-level protections that exist — per-tier sessions (ADR-004), the ShopOwner tier never loading
the `shopOwner` model at all — all sit *above* the database and none of them survives direct access to it.

**The platform runs MongoDB Community.** That decides the shape of any answer before anything else does:

- **Automatic CSFLE is not available.** The driver's `schemaMap` / `encryptedFieldsMap` auto-encryption
  path requires MongoDB Enterprise or Atlas plus the `crypt_shared` library (or the retired `mongocryptd`
  daemon). On Community the driver will connect and then refuse to auto-encrypt.
- **Queryable Encryption is not available either** — same licensing gate, and it additionally wants a
  server-side `__safeContent__` and state collections Community will not manage.
- **Explicit CSFLE is available and is the whole of what is available.** `ClientEncryption.encrypt()` and
  `.decrypt()` from `mongodb-client-encryption` run entirely client-side against a key vault collection
  that is an ordinary collection in an ordinary database. The server never sees a key and never knows a
  field is encrypted — it stores `binData` subtype 6 and nothing more.

The consequence is not a licensing footnote, it is the cost of this ADR: **every read path and every write
path has to encrypt and decrypt by hand.** There is no interception layer that does it for you.

Two further facts constrain which fields can be touched at all, and both were verified against the code
rather than assumed:

1. **The operator table sorts and searches on three PII fields.** `shopOwnersActiveTblDb.mts` exposes
   `sortBy` ∈ {`REGISTERED_AT`, `FIRST_NAME`, `LAST_NAME`, `CITY`}, backed by four dedicated compound
   indexes from `20260801000100-index-shopOwner-tbl.js`, and a `search` argument that builds
   `new RegExp('^' + escaped, 'i')` over `SEARCHABLE_PATHS = ['personalData.firstName',
   'personalData.lastName', 'personalData.address.city']`.
2. **`emailVerify.newEmailTmp` is a query filter, not just a stored value.** `@axiumine/koa-utils`'
   `emailChangeHashVerify` runs `.findOne({ [paths.newEmailTmp]: uEmail })`.

Neither ciphertext preserves ordering. Deterministic encryption preserves **equality only**: the same
plaintext under the same key produces the same ciphertext, which is exactly enough for `findOne`, for a
unique index and for `$in`, and not remotely enough for `$lt`, for `sort`, for a range or for a prefix
regex. Random encryption preserves nothing at all — the same plaintext encrypts differently every time,
so it cannot even be matched.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Explicit CSFLE — deterministic on the 5 fields queried by equality, random on every other PII field, non-PII untouched (chosen) | Works on Community; `login.email` keeps its unique index and every login path; the sensitive bulk (addresses, birth dates, phone numbers, operator notes, the two named persons on `company`) becomes unreadable in a dump; blast radius scoped by one DEK per collection | Every read and write path changes; encrypted fields become `binData` so `$jsonSchema` loses `maxLength`/`pattern` on them; three operator-table sort options and its search cannot cover encrypted fields; deterministic ciphertext leaks equality |
| Encrypt every PII field including the three the operator table sorts and searches on | Strictly the most data protected; no field-by-field argument to defend later | Deletes a built, tested, indexed feature: `sortBy: FIRST_NAME / LAST_NAME / CITY` would order by ciphertext (i.e. arbitrarily) and `search` would match nothing. Three of the four indexes in `20260801000100` become dead weight. The failure is silent — the table still renders, in a meaningless order |
| Encrypt nothing; rely on disk encryption (LUKS/dm-crypt) and cluster ACLs | Zero application change; no query-shape loss at all | Protects only against a stolen disk. A `mongodump`, a compromised application credential, a backup copied off the host and any read-capable operator all still see plaintext — which is most of the threat model this ADR exists for |
| Encrypt in the application with a hand-rolled AES layer instead of CSFLE | No native addon, no key vault collection, full freedom over the wire format | Reinvents key rotation, key versioning, the AEAD construction and the envelope format, all of which CSFLE already ships and none of which is interesting to get wrong. Also gives up the driver's `binData` subtype 6 convention, so nothing downstream can tell an encrypted value from a blob |
| Queryable Encryption (range-capable) | Would keep sort and range on encrypted fields | Not available on Community. Non-option, recorded so it is not re-proposed |

---

## Decision

Row 1. Explicit CSFLE via `mongodb-client-encryption`, with the field split below.

### Algorithm per field

`AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic` on the five fields that are looked up by equality, and
`AEAD_AES_256_CBC_HMAC_SHA_512-Random` on everything else that is protected.

**Deterministic — five fields, and only these five:**

| Field | Why it must be deterministic |
|---|---|
| `admin.login.email` | `tryLoginAdmin` filters on it; `login.email_unique` |
| `shopOwner.login.email` | `tryLoginShopOwner`, the reset-password and verify-email flows; `login.email_unique` |
| `user.login.email` | `tryLoginUser`, `userForRegistration`, both flows; `login.email_unique` |
| `shopOwner.emailVerify.newEmailTmp` | `emailChangeHashVerify` filters `{ [paths.newEmailTmp]: uEmail }` |
| `user.emailVerify.newEmailTmp` | same flow, user tier |

Deterministic encryption keeps the unique index working exactly as it does today, including the property
that a soft-deleted account keeps its address occupied — same plaintext, same ciphertext, same index key.

**Random — every other protected field:**

| Collection | Fields |
|---|---|
| `admin` | `personalData.firstName`, `personalData.lastName` |
| `shopOwner` | `personalData.birth.date`, `personalData.address.street`, `personalData.address.postalCode`, `personalData.address.province`, `personalData.address.position`, `personalData.contacts.mobile`, `personalData.contacts.landline`, `personalData.contacts.email`, `notes` |
| `user` | `personalData.firstName`, `personalData.lastName`, `personalData.birth.date`, `personalData.contacts.mobile`, `personalData.contacts.landline`, `personalData.contacts.email`, `addresses[].label`, `addresses[].street`, `addresses[].postalCode`, `addresses[].city`, `addresses[].province`, `addresses[].position` |
| `company` | `contactPerson`, `administrator` |

`position` is encrypted as a whole sub-document rather than per-axis: deterministic is not defined for
`object`, `array` or `double`, and there is no index or query on either point (`user.addresses` has no
`2dsphere` and nothing queries customers by distance; `shopOwner.personalData.address.position` has none
either — see `20260802000300`).

### Deliberately left in the clear

**Not personal data.** `login.password` is a bcrypt hash — already irreversible, and encrypting a hash
protects nothing while making every login decrypt one more value. `resetPwd.resetHash`,
`emailVerify.hash`, `emailVerify.dateLastReq`, `emailVerify.requestTimes`, `emailVerify.valid`,
`login.firstLogin` / `lastLogin` / `onboardingStep` / `onboardingDone` / `rememberMe`, `registeredAt`,
`deleted`, `disabled`, `waitApprov`, `__v` are tokens, timestamps and state flags. `company.legalName`,
`vatNumber`, `taxCode`, `certifiedEmail`, `uniqueCode`, `registryExtract` and `idShopOwner` describe a
**legal entity**, not a natural person — the platform's `taxCode` is explicitly the 11-character
entity form and not the 16-character personal one. `item` and `itemCategory` carry no personal data of
any kind and are not touched.

**Public by construction.** `company.address` (street, postalCode, city, province, position) is the shop's
registered seat, rendered on the storefront, geo-indexed by `address.position_2dsphere`, and the sort key
of `published_city_publicName`. `company.publicName`, `slug`, `description` and `published` are the shop
listing itself and the target of `search_text`. Encrypting any of them would be encrypting data the
platform publishes anyway, at the cost of the map, the city listing and the search.

**Structural.** `user.addresses[]._id` and `user.defaultAddress` stay clear because the collection's
`$expr` clause compares them (`$map` over `addresses` for `_id`, `$in` against `defaultAddress`). An
ObjectId is not personal data on its own, and encrypting either would make the validator unsatisfiable.

### The one place protection loses to a working feature

⚠️ **`shopOwner.personalData.firstName`, `personalData.lastName` and `personalData.address.city` are
left in the clear, and that is the weakest point of this decision.** They are personal data and they
would otherwise be random-encrypted along with the rest of `personalData`.

They are the three keys `shopOwnersActiveTblDb.mts` sorts and prefix-searches on, backed by
`tbl_active_lastName_firstName`, `tbl_active_firstName` and `tbl_active_city`. Encrypting them does not
degrade those paths, it silently falsifies them: the sort orders by ciphertext, which is arbitrary and
stable, so the operator table keeps rendering a page of shop owners in an order that means nothing, and
`search` returns empty for every term. There is no client-side rescue at pagination — the whole point of
those indexes (`20260801000100`'s header) is that a non-indexed sort is a blocking in-memory sort capped
at 32 MB, i.e. a latent outage rather than a slow page.

What is bought by leaving them clear: a dump exposes a shop owner's name and city. What is kept private:
their street, postcode, province, home coordinates, date of birth, both phone numbers, their private
contact address and everything an operator ever wrote about them. A shop owner's name and town are also
the business-facing identity of a shop that the storefront publishes under `company.publicName` and
`company.address.city` anyway, which is why this is the field group where the trade is least bad.

**The corresponding fields on `user` and `admin` are encrypted**, because nothing sorts or searches them:
the customer reads their own document by `_id` (`me.mts`), and there is no operator table over `admin`.

This is the one line in this ADR to revisit if the operator table's sort and search can be given up, or
if the collection ever moves behind a search engine that holds its own index.

### Keys

- **Key vault**: `dbMarketplaceKeyVault.__keyVault`, a database of its own, with the driver's required
  unique partial index on `keyAltNames`. Separate database so it can be excluded from an application
  `mongodump` and given its own user.
- **Three data encryption keys**, `keyAltNames: ['admin' | 'shopOwner' | 'user' | 'company']` — one per
  collection, so a compromised DEK is scoped to one collection rather than to all personal data on the
  platform.
- **Customer master key**: the `local` KMS provider in `Dev`, a 96-byte key read from
  `CSFLE_MASTER_KEY_PATH`. The file is gitignored and lives outside the repo, exactly as `.env` does.
  Production takes a real KMS provider; only `Dev` is wired up, per the rest of this platform.
- ⚠️ **Losing the master key loses every encrypted field permanently.** There is no recovery path and no
  escrow. This is the single operational fact that has to survive this document.

### Where the code lives

The encryption layer goes in **`marketplace-common`**, beside the models it serves, for the same reason
the three authorization-session helpers did (ADR-006): it is identical in all nine services, and a second
copy is a second thing to get wrong. Services get a client handle and a `encryptFields` / `decryptFields`
pair driven by one declarative per-collection field map, so the algorithm choice for a field is written
once and every call site reads it from there rather than restating it.

---

## Consequences

### Positive

- A `mongodump`, a stolen backup or a read-capable operator sees `binData` for every customer address,
  every date of birth, every phone number, every private contact address, the operator's notes on a shop
  owner, and the two named persons on a company record.
- Every login, every password reset, every email verification and every email change keeps working
  unchanged, including the unique index and its soft-delete behaviour, because the five fields those paths
  filter on are deterministic.
- Key blast radius is one collection, not the platform.
- The field map is one file, so "is this field encrypted, and how" is answerable without reading nine
  services.

### Negative

- **`$jsonSchema` stops validating the encrypted fields.** A `binData` value cannot carry `maxLength: 250`,
  `minLength: 5` or the postcode/province length rules. Those constraints move into the application's
  validators, which already exist (`src/lib/validate/`) but were previously backed up by the database.
  The validators must be restated as `bsonType: 'binData'` in a new migration, which is a full restatement
  of four collection validators — including both `$and` clauses on `user` and on `company`.
- **A full database rebuild.** `lib/schemas/` changes, and this workspace's rule is that a change there is
  followed by rebuilding every database that has run these migrations, in the same piece of work.
- **Every read path decrypts and every write path encrypts, by hand.** Missing one is not a crash: a
  forgotten encrypt writes plaintext into a field everything else reads as ciphertext, and a forgotten
  decrypt hands a `Buffer` to GraphQL.
- **Deterministic ciphertext leaks equality.** Two accounts with the same address produce the same
  ciphertext. For `login.email` this leaks nothing new — the unique index already asserts distinctness —
  but it is a real property of the algorithm and the reason it is used on five fields and not on twenty.
- **Three sort options and one search on the operator table cover unencrypted fields only**, as argued
  above.
- A native addon (`mongodb-client-encryption`) joins the dependency set, and with it a build requirement
  on every machine and container that runs a service.

### Risks

- **A future migration adds a PII field and nobody encrypts it.** Nothing gates this. The field map in
  `marketplace-common` and the validator in `marketplace-db-setup` can disagree silently, because a
  `string` field is perfectly valid in a collection whose other fields are `binData`. Revisit as a
  contract test that walks the field map against the live validators.
- **A future query filters on a random-encrypted field.** It will match nothing, silently — random
  ciphertext never equals itself. The symptom is an empty result set, not an error.
- **Key rotation is unimplemented.** `ClientEncryption.rewrapManyDataKey` exists and nothing here calls it.
  Rotating the master key today means a bespoke script.
- **The `Dev` master key is a file on one machine.** Same exposure the cluster credentials already have
  (`marketplace-db-setup/setup/mongodb.js`), and accepted on the same grounds — but unlike a password,
  losing this one destroys data rather than requiring a reset.

---

## Compliance

Verify a field is actually encrypted by reading it with a driver that has **no** `ClientEncryption`
configured — the raw value must come back as `Binary` with `sub_type: 6`, never as a string:

```js
// against dbMarketplaceDev, plain driver, no encryption configured
db.user.findOne({}, { 'personalData.firstName': 1, 'login.email': 1 })
// both must print BinData(6, …); a string means the write path skipped encryption
```

Verify deterministic actually is deterministic — two accounts written with the same address must produce
the same ciphertext, which is what makes the unique index work:

```js
db.user.createIndex({ 'login.email': 1 }, { unique: true })  // already exists; must not error on rebuild
```

Verify the split holds by count rather than by reading the map: every field listed under *Random* above
must be absent from any `find` filter, any `sort` and any index key across all nine services. A violation
on disk looks like a `$regex`, a `$gt`/`$lt`, a `sort` or an `createIndex` naming one of them — grep the
service `src/` trees for the field path and confirm each hit is a projection or an assignment, never a
filter key.

Verify the three deliberately-clear `shopOwner` fields stay clear: `personalData.firstName`,
`personalData.lastName` and `personalData.address.city` must remain `bsonType: 'string'` in
`lib/schemas/shopOwner.js`, and `tbl_active_lastName_firstName`, `tbl_active_firstName` and
`tbl_active_city` must remain in `db.shopOwner.getIndexes()`. If those three fields are ever encrypted,
those three indexes must be dropped in the same migration — leaving them is worse than not having them,
because a sort that silently orders by ciphertext looks like it works.
