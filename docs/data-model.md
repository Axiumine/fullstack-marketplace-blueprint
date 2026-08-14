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

## `user` — mirrors `shopOwner`, three deliberate divergences

Builder `lib/schemas/user.js`, reusing `account.js` (`LOGIN`, `RESET_PWD`, `EMAIL_VERIFY`, `DELETED`,
`DISABLED`, `INDEXES_LOGIN_EMAIL`) and `geo.js`. Required: `login` and `registeredAt` only — **not**
`personalData`, because registration is email + password and nothing else.

⚠️ **`shopOwner` now requires the same two and no more.** `personalData` left its `required` list on
2026-08-12, when `shopOwnerRegister` gave the public site a seller registration shaped like the
customer's — so "optional `personalData`, filled in after the address is confirmed" stopped being a
divergence and became the rule on both collections. What is still true of `shopOwner` and not of `user`
is the *shape*: one embedded `personalData.address`, and `contacts` requiring both members.

The three divergences are intentional and none of them is an accident to "fix":

1. **`addresses` is an array** where `shopOwner` has one `personalData.address`. Each element carries a
   required `_id`, an optional `label` and the shared address block with an optional `position`.
2. **No `waitApprov`.** Customers self-serve with nothing to approve; a shop owner who self-serves is
   parked until an operator clears the flag, and one an Admin created is not parked at all.
3. **`defaultAddress`** has no counterpart at all — see below.

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
              slug (req), published (bool), image (file name, optional), deleted (date, optional)
itemCategory  _id, name (req, ≤100), slug (req, unique), idParent (optional), position (int)
```

Why each field beyond `_id, idCompany, name, description` is there: `idCategory` because categories
cannot filter anything without the link, `slug` because an SEO URL needs a stable human-readable
segment, `published` so an owner can draft without appearing on an indexed page, `deleted` because
soft-delete is the platform convention.

⚠️ **`published` is written by `itemUpdatePublished` alone, on either tier** — never by `itemUpdate`,
which is not given the field at all. Both update paths `$set` the whole enumerated object, so while the
flag sat in `GraphQLInputItem` every save wrote it and a card reopened after a takedown republished the
item on Save. `itemAdd` stamps `false`. Same split on `company`, below.

⚠️ **`image` holds a file name, never a path and never a URL** — `^[a-f0-9]{24}\.[a-z0-9]{3,4}$`,
anchored at both ends, and the 24 hex are the item's own `_id`, not what the client called the file. The
directory is `STATIC_FOLDER/item/<idCompany>/` and both segments are already on the document, so a stored
path would be three ways of saying the same thing and one way of escaping it. Not in `required`: an item
without a picture is ordinary, and that absence is what a card reads before choosing a placeholder.

⚠️ **`itemAdd` is the only writer of `image`, and there is no way to replace or remove one.** The picture
travels as an `Upload` inside `GraphQLInputItem` on the ShopOwner tier, so creating an item and giving it a
picture are one call; `itemUpdate` is not given the field and drops the key at the `$set` even when a save
arrives carrying one. The three steps straddle the insert in this order — store the upload in the temp
directory, write the document, publish the file — so nothing reaches the static domain before the document
exists. **A failed publish after a successful insert is not repaired**: the item exists, the client got a
500, and a retry collides with its own slug and comes back 409. The upload is re-encoded on the way in
(koa-utils `uploadTempImage` checks extension and MIME, scans with ClamAV, then rebuilds the file as webp
from decoded pixels), which is what stops a payload smuggled inside a valid image — and why the pattern
leaves the extension at 3-4 characters instead of pinning it to `webp`: a second format later is then a
resolver change and not a rebuild of every database. Read-side exposure is that
tier alone: the shared `GraphQLItemFrag` does not carry the field, so the Admin and public tiers cannot
read it and no frontend renders one
(`docs/devprotocol/phase5/CATALOGUE.md` E05-S09).

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

⚠️ **Saying so is `companyUpdatePublished`, on either tier — not a field of `GraphQLInputCompany`.**
`companyUpdate` `$set`s the whole document, so the flag is kept off its input for the same reason as on
`item`, and `companyAdd` stamps `false`. The `PUBLISHED_IMPLIES_LINKABLE` `$expr` refuses `published:
true` unless `slug` and `publicName` are both stored, which makes the order compulsory rather than
conventional: the card is saved first and published second, and the refusal arrives from the database
naming a field the owner may never have been shown.

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

## Redis — the session keyspace, and what is on disk

MongoDB is not the only store holding credentials. Redis holds every live session, and all nine services
read it under **one** `REDIS_KEY` prefix — deliberately (CON-04, CON-05, ADR-005): the single logout
service on 4030 finds a session by token content alone, so a per-service prefix would leave it unable to
revoke anything it did not mint. The tier lives *inside* the hash, as a field, and is asserted at every
call site.

### Key shapes

Everything below is built by `marketplace-common/src/others/sessionKeys.mts`, by `assertUnderRateLimit.mts`
or by `assertHashFieldTTLSupport.mts`. **Nothing anywhere else may build a session key out of a template
literal**, and nothing does: `marketplace-common/test/redisKeyspace.test.mts` counts the interpolations in
that package and `./scripts/audit-check.sh` greps the other fifteen repos, since no test here spans two.

⚠️ **This table is the whole keyspace, and both checks above compare against it.** A shape added to the
code and not to this table fails `audit-check.sh` §2 by name — which is how the six rows below the rate
limiter were found, live and documented nowhere, on the day E18-S08 first ran it.

| Shape | Holds | Written by | Status |
|---|---|---|---|
| `<prefix><sha256('access:'+token)>` | the access session hash — `_id`, `email`, `tier`, never the refresh token | login, rotation | live (E13-S01) |
| `<prefix><sha256('refresh:'+token)>` | the refresh session hash — `_id`, `tier`, the lineage, and `accessKey`: the *key* of the access session minted beside it, never a token | login, rotation | live (E13-S01; `accessKey` 2026-08-13) |
| `<prefix>access:<token>` / `<prefix>refresh:<token>` | the same two hashes, pre-cutover | nothing, and now read by nothing either | **gone — E13-S10, 2026-08-14**; a key of this shape resolves to nothing |
| `<prefix>dual-read-hits` | an integer, and nothing else | the fallback read | **gone — E13-S10, 2026-08-14**; never non-zero, the cutover was never deployed |
| `<prefix>rl:<bucket>:<sha256(identity)>` | a rate-limit counter | `assertUnderRateLimit` | live |
| `<prefix>used:<sha256(token)>` | `{ familyId }` — the reuse tombstone | rotation | live (E14-S02) |
| `<prefix>family:<familyId>` | a set of that family's session keys | rotation | live (E14-S03) |
| `<prefix>idx:<tier>:<accountId>` | one field per live session — field name `sha256('refresh:'+token)`, value `{ tier, mintedAt }`, each field `HEXPIRE`d at its own session's cap | login, rotation | live (E15-S02, S03) |
| `<prefix>grace-hits` | an integer — how often a refresh lost a race and was told to retry | the grace-window branch of rotation | live (E14-S04), read by E14-S09 |
| `<prefix>reuse:<tier>:<accountId>` | that account's reuse trail, a list trimmed to 50 on every append — `{ familyId, tier, accountId, action, at }`, no token and nothing network-derived | rotation, on a replay | live (E17-S05) |
| `<prefix>keygrip` | the cookie-signing keys: `version`, `wrapped` (AES-256-GCM under `KEYGRIP_KEK`), `fp` | `marketplace-db-setup`, rotation | live (ADR-034) |
| `<prefix>keygrip:holders` | one field per service — `<fingerprint>@<ISO-8601>`, the detection that five `.env` copies never had | every service at boot, and on each live swap | live (E01-S14) |
| `<prefix>keygrip:rotated` | **a pub/sub channel, not a key** — the payload is the new version number, a nudge to re-read | a rotation | live (ADR-034) |
| `<prefix>hash-field-ttl-probe` | nothing — it is never written; `hTTL` on a missing key answers instead of throwing | nobody, by design | live (E15-S03) |

⚠️ **The digest is of the *prefixed* token.** `access:` and `refresh:` are what tell the two hashes of one
login apart; hashing the bare uuid would mint a key no reader on the platform can find, and the failure
would look like "Redis lost the sessions" rather than like a bug.

### The account index, in detail

`<prefix>idx:<tier>:<accountId>` is what lets an account enumerate its own sessions without `SCAN` or
`KEYS` — neither of which this platform may use (BCON-08). Four properties of it are load-bearing, and
each is a silent failure on its own:

- **The field name is the refresh session's key body**, so a reader rebuilds the key to act on as
  `${REDIS_KEY}${field}` and never holds a token. A field digested from anything else is still 64 hex
  characters, still passes a shape check, and names a key that does not exist.
- **Only the refresh session is filed**, because a session *is* its refresh lineage — and filing one is no
  longer the same as revoking one half of it (**R54**, closed 2026-08-13). The refresh hash names its own
  access session in `accessKey`, so rotation, logout *and* revocation all end the access token without the
  client presenting anything; a revocation reads that field before it deletes the hash holding it, since
  afterwards there is nothing to read. What the index does not carry, it reaches through the session it
  names.
- **The tier is in the key name**, not only in the value: three collections mint `_id`s independently, so
  an index keyed by id alone would let one account's revocation log out a stranger.
- **The key's TTL is always 30 days** — `SESSION_CAP_DAYS_REMEMBERED`, the *longer* cap — reissued on
  every write whatever cap the session carries. The shorter one would let a single 1-day login pull the
  whole key down and orphan a remembered session: live, listed nowhere, missed by any revocation.
- **Each field carries a TTL of its own, and it is a different number from the key's** (E15-S03). Every
  `hSet` into the index is followed by an `HEXPIRE` on that one field for what remains of
  `originalLogin + sessionCapDays` — not the refresh session key's own expiry, which is shorter and
  would delist a live session, and not the key's 30 days, which would outlive a 1-day login by 29.

`mintedAt` is the lineage's `originalLogin`, carried forward unchanged by rotation, so a session that
refreshes every fifteen minutes does not read as fifteen minutes old. It carries no token material, and
nothing else may be added to it without a decision — see E15's §6.

### How a field leaves the index

Three ways, and between them the upper bound on stale fields per account is **zero by design** rather
than "small" — there is no sweeper, no lazy prune on read, and nothing a reader has to tolerate:

- **Rotation** — `refreshSessionTokens` `hDel`s the superseded field in the same routine that files the
  successor, *after* the session keys themselves are deleted. The successor is written with the cap the
  predecessor carried: **rotation does not reset the field TTL**, so a session that refreshes forever
  still leaves the index on the day its lineage was capped.
- **Logout** — `unindexSession`, again after `deleteSession`.
- **Anything else** — the field's `HEXPIRE` above. A crashed client, a dropped browser, a session that
  simply ran out its cap: nobody has to come back and tidy up.

`revokeAllSessionsForAccount` (E15-S04) takes the whole key instead: `hKeys`, one single-key `del` per
session it names, and **the index key last** — the index is the only record of what is left to delete, so
an interrupted revocation that removed it first would leave live refresh tokens nothing can name. Reversed,
a retry finishes the job. An account with nothing open issues no command at all, unlike the family set of
E14-S03, which is always deleted: that one has no per-field TTL to fall back on.

⚠️ **This is what puts a floor of Redis 7.4.0 under the whole platform** — `HEXPIRE`/`HTTL` do not exist
before it, and Redis refuses an unknown command at the first call rather than at startup. `up.sh
--with-redis` checks the container's version, and each of the four authorization services probes its own
connection with an `HTTL` at boot and exits rather than serving a login it cannot file. Both are
single-key commands, so BCON-08 holds. `docker-DBs/README.md` §Redis is the operational half.

### Persistence — AOF is on in both environments

Both environments run Redis with the append-only file **enabled**, and they are configured separately, so
each is cited on its own — one is not evidence for the other:

- **Dev**: `docker-DBs/docker-compose.yml:62` — `command: [redis-server, --appendonly, 'yes', …]`.
- **Production**: `appendonly yes` in that host's `redis.conf`, per the platform owner, 2026-08-10. That
  file is not in this workspace and cannot be verified from it.

The consequence belongs next to the fact. **The AOF is a command log of the session keyspace**: every
`hSet` that ever wrote a session is in it, with its key, in the order it happened. Before E13-S01 those
keys were the tokens themselves, so the file was a list of live credentials in plain text. After E13-S01
new writes carry digests — but **the existing file still holds the old commands until it is rewritten**
(`BGREWRITEAOF`, or the automatic rewrite when the file grows past its threshold). The rewrite is a step
of the E13-S02 cutover deploy and again of E13-S10, not something E13-S01 achieves by itself.

⚠️ **Three things are still unknown, and a backup outlives every rewrite.** Each needs an answer from the
platform owner before this section can claim the keyspace is clean:

| Unknown | Why it matters | Owner |
|---|---|---|
| Is RDB snapshotting also on in production? | a `.rdb` written before the cutover holds the raw keys, and no AOF rewrite touches it | platform owner (thedoctorweb) |
| Where do the AOF and any `.rdb` live on disk? | they cannot be rewritten, moved or destroyed until they are located | platform owner |
| Is either backed up off-host? | **a backup copy survives every rewrite this epic performs** — it is the one place raw tokens can outlive the whole of E13 | platform owner |

## Migrations (ADR-014)

**Migrations are immutable — never edit an applied migration, add a new one.** But they are not
self-contained: the `$jsonSchema` shapes live in `marketplace-db-setup/lib/schemas/`, and each migration
is a call rather than a copy. Current builders: `account.js`, `collection.js`, `encrypted.js`,
`geo.js`, `admin.js`, `shopOwner.js`, `company.js`, `user.js`, `item.js`, `itemCategory.js`, plus its
[`README.md`](../README.md).

Seven migrations, six of which create a collection in its final shape and one of which seeds demo data.
There is no `collMod` and no `<ts>-alter-<coll>.js`: a collection is declared once, so `migrations/` reads
as the schema rather than as its diff history. A new collection gets a builder under `lib/schemas/` and one
`<ts>-create-<coll>.js` that calls it — never an inline validator.

⚠️ **A change under `lib/schemas/` is followed by a full rebuild of every database that has run these
migrations, in the same piece of work.** A builder carries one shape per collection, so editing it changes
what the migration that calls it *would* create — which the databases already created from the old shape
do not know about. There is no database on this platform that cannot be dropped and replayed, and that
licence is what buys the single-shape rule. Read `lib/schemas/README.md` before editing it.
