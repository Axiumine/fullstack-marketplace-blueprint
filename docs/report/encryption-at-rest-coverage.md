# What Encryption at Rest Actually Covers

# Marketplace

**Status:** investigation finding — closes E18-S05. Not baselined, not a requirement document
**Version:** 1.0
**Date:** 2026-08-13
**Scope:** two questions that are routinely answered as one. **Which fields does ADR-029's explicit CSFLE
encrypt, and which personal data does it leave in the clear** — and, separately, **is the storage under
MongoDB and Redis encrypted at all**. It answers both for Dev on this machine, says "unknown" where the
answer is not knowable from this workspace, and covers Redis, whose keyspace and whose values need
different answers.
**Method:** the field lists were read from source — `encryptedFields.mts` against the six collection
validators in `marketplace-db-setup/lib/schemas/` — because those two files are the whole of the decision
and nothing else restates it. The storage answers were **measured on the running Dev stack**: the block
devices, the Docker root, the two named volumes, the mongod build flags and the two Redis persistence
files. No `.env`, no file under `docker-DBs/secrets/`, and no stored value of any kind was read: the
Redis observation is file sizes and modification times, and the MongoDB observation is the presence of
option names in `mongod --help`.
**Reads against:** [`ADR-029`](../devprotocol/phase3/adr/ADR-029-pii-at-rest-explicit-csfle.md) ·
[`E18`](../devprotocol/phase5/epics/E18.md) E18-S05 ·
[`token-handling-security-audit.md`](./token-handling-security-audit.md) §5 ·
`BEs/marketplace-common/src/encryption/{encryptedFields,setupFieldEncryption,fieldEncryption}.mts` ·
`BEs/marketplace-common/src/others/sessionKeys.mts` ·
`BEs/marketplace-db-setup/lib/schemas/{account,admin,shopOwner,user,company,geo,item,itemCategory}.js` ·
`docker-DBs/{docker-compose.yml,Dockerfile,up.sh}`

---

## 1. Verdict

**Two different things are called "encryption at rest" and this platform has exactly one of them.**

- **Field-level, yes.** Explicit CSFLE (ADR-029) encrypts **30 field paths across 4 of the 6 collections**,
  under **4 data encryption keys**, of which **5 paths** are deterministic and the remaining 25 random.
  Because it is *client-side*, the protection reaches everything the server writes: documents, indexes,
  the oplog, the journal and any `mongodump` taken of them all hold `binData` for those 30 paths.
- **Storage-level, no — and not anywhere on this machine.** MongoDB runs **Community 8.0.28**
  (`"modules": []`), whose `mongod` binary carries **no encryption option at all** — `mongod --help`
  matches the string `encrypt` zero times. Redis has no such feature to begin with. Both containers write
  to Docker named volumes under `/media/ai/docker/docker_data_dir/volumes/`, on a plain XFS filesystem,
  on a machine with **zero dm-crypt devices**. Nothing under either volume is encrypted by the storage
  layer, and nothing can be without a decision that has not been taken.

The gap between those two sentences is the finding. **What CSFLE does not cover is readable in the clear
by anyone who reaches the volume**, and §4 lists it field by field. Two items in that list were decided
deliberately and are documented (§4.1); the rest were never decided at all, and §4.2 is the first place
they are written down with a reason each.

Three things are worth stating before the tables, because each contradicts something a reader may be
carrying:

- 🟠 **The `user` collection is not the exposed one — `shopOwner` is.** Every personal field on `user` is
  encrypted. `shopOwner` leaves a **first name, a last name and a city** in the clear, permanently and on
  purpose, because the operator table sorts and prefix-searches all three. A volume reader gets a list of
  named shop owners and the towns they live in.
- 🟠 **E18-S05's own premise about Redis is wrong: session values *are* personal data.** The access-token
  session hash holds `email` in plaintext (`IRedisDataAdminCommon`, `IRedisDataShopOwnerCommon`,
  `IRedisDataUserCommon` — one field each, and it is the address). R45 already records this for traffic
  in transit; **at rest it lands in the AOF and the RDB on an unencrypted volume**, and nothing has said so
  until now. The *refresh* hash is clean — `_id`, `tier`, `familyId`, `originalLogin`, `sessionCapDays`.
- 🟢 **The Redis keyspace is no longer credentials.** E13-S01 has landed: session and tombstone keys are
  SHA-256 digests, and the remaining key shapes (`family:`, `idx:`, `reuse:`, the two counters, `keygrip`,
  `keygrip:holders`) name no credential by construction. Pre-cutover raw-token keys are still *readable*
  until E13-S10 removes the fallback, but nothing writes one any more.

**The audit §5 item is closed by this finding.** One residual is opened as a risk row rather than a story:
§7.

## 2. What CSFLE is, on this platform, in three lines

MongoDB Community has neither automatic CSFLE nor Queryable Encryption — both are gated on Enterprise or
Atlas. What is available is **explicit** CSFLE: `ClientEncryption.encrypt()` / `.decrypt()` called by the
service, against a key vault that is an ordinary collection. The server never sees a key and never knows a
field is encrypted; it stores `binData` subtype 6.

Two consequences that decide everything below:

1. **The protection is client-side, so it survives the storage layer.** An index over an encrypted field
   indexes the ciphertext. The oplog carries the ciphertext. A `mongodump` carries the ciphertext. There
   is no "encrypted in the file but plaintext in the log" seam, which is precisely the seam a
   storage-level answer would have.
2. **The protection is field-by-field, so anything not on the list is plaintext everywhere.** There is no
   default-deny. A field added to a collection and not added to `encryptedFields.mts` is written in the
   clear, and the only thing that catches it is the `binData` declaration in the *other* repo refusing the
   write — loud, but only at write time, and only if someone remembered the other half.

The keys: **one DEK per collection**, named by `KEY_ALT_NAMES` = `['admin', 'shopOwner', 'user',
'company']`, stored in the key vault `dbMarketplaceDev.__keyVault` — **the same database, and therefore
the same volume, as the data**. Each DEK is wrapped under a 96-byte **local KMS master key read from a
file** whose path is `CSFLE_MASTER_KEY_PATH`, per-machine, git-ignored, outside the repo.

⚠️ **This is what makes the volume answer bearable and it is worth being exact about.** Whoever takes the
volume takes the ciphertext *and* the wrapped DEKs, and gets neither without the master key file, which
is not in the volume. Whoever takes **the host** takes both. On this machine every filesystem is
unencrypted, so the master key file is at rest in the clear too — wherever it is. That is not a defect of
ADR-029; it is the boundary ADR-029 stops at, and §6 is where it is picked up.

## 3. The encrypted set — 30 paths, 4 keys, 5 deterministic

Read straight from `encryptedFields.mts`. **D** = deterministic (equality lookup only), **R** = random.

### `admin` — DEK `admin`, 3 paths

| Path | Alg | What it holds |
|---|---|---|
| `login.email` | **D** | login address — `findOne` + unique index |
| `personalData.firstName` | R | given name |
| `personalData.lastName` | R | family name |

### `shopOwner` — DEK `shopOwner`, 11 paths

| Path | Alg | What it holds |
|---|---|---|
| `login.email` | **D** | login address — `findOne` + unique index |
| `emailVerify.newEmailTmp` | **D** | pending new address — koa-utils looks the account up by it |
| `personalData.birth.date` | R | date of birth |
| `personalData.address.street` | R | home street and number |
| `personalData.address.postalCode` | R | home postal code |
| `personalData.address.province` | R | home province |
| `personalData.address.position` | R | home coordinate, encrypted whole |
| `personalData.contacts.mobile` | R | mobile number |
| `personalData.contacts.landline` | R | landline number |
| `personalData.contacts.email` | R | contact address (not the credential) |
| `notes` | R | what an operator wrote *about* this person |

### `user` — DEK `user`, 14 paths

| Path | Alg | What it holds |
|---|---|---|
| `login.email` | **D** | login address — `findOne` + unique index |
| `emailVerify.newEmailTmp` | **D** | pending new address |
| `personalData.firstName` | R | given name |
| `personalData.lastName` | R | family name |
| `personalData.birth.date` | R | date of birth |
| `personalData.contacts.mobile` | R | mobile number |
| `personalData.contacts.landline` | R | landline number |
| `personalData.contacts.email` | R | second address to be reached on |
| `addresses.[].label` | R | what the customer calls this address |
| `addresses.[].street` | R | street and number |
| `addresses.[].postalCode` | R | postal code |
| `addresses.[].city` | R | city |
| `addresses.[].province` | R | province |
| `addresses.[].position` | R | coordinate, encrypted whole |

### `company` — DEK `company`, 2 paths

| Path | Alg | What it holds |
|---|---|---|
| `contactPerson` | R | a natural person inside a legal record |
| `administrator` | R | a natural person inside a legal record |

### `item`, `itemCategory` — no DEK, no encrypted path

Neither collection carries a field that names or describes a person. `item` holds `idCompany`,
`idCategory`, `name`, `description`, `slug`, `published`, `deleted`; `itemCategory` holds a name, a slug,
`idParent`, a sort ordinal and `deleted`. See §4.3 for the one caveat that applies to any free-text field.

**Deterministic is exactly five paths and the count is load-bearing** — three login addresses and the two
pending-change slots. Deterministic ciphertext leaks equality, which is what the unique index on
`login.email` has to be able to see. Extending the set to make a new query work buys nothing: `$eq` and
`$in` are all it answers, so a sort, a range or a `$regex` still fails and the equality has been given
away for free.

## 4. Personal data that is NOT encrypted, with a reason each

This is the half of the question that had no written answer. Everything below is plaintext in the volume,
in the indexes, in the oplog and in any dump.

### 4.1 Decided deliberately, documented, and permanent until an index is dropped

| Field | Collection | Why it is in the clear |
|---|---|---|
| `personalData.firstName` | `shopOwner` | `shopOwnersActiveTbl` sorts it (`tbl_active_lastName_firstName`, `tbl_active_firstName`) and prefix-searches it with `/^term/i`. Neither CSFLE algorithm survives either operation — the table would keep rendering, ordered by ciphertext, and every search would return nothing |
| `personalData.lastName` | `shopOwner` | same three indexes, same failure |
| `personalData.address.city` | `shopOwner` | `tbl_active_city` sorts it and `SEARCHABLE_PATHS` prefix-searches it |

⚠️ **This is the platform's single largest plaintext personal-data exposure and it is on the operator's
own collection, not the customer's.** The same three fields on `admin` and on `user` *are* encrypted,
because nothing sorts or searches those. Closing it means dropping the three `tbl_active_*` indexes and
paging the operator table another way — the condition ADR-029 records for revisiting the trade. Adding the
fields to `encryptedFields.mts` without doing that in the same change does not make the table slow, it
makes it **silently wrong**.

### 4.2 Not personal data, or unencryptable by construction — reason per field

| Field(s) | Collection(s) | Why it is in the clear |
|---|---|---|
| `login.password` | `admin`, `shopOwner`, `user` | A bcrypt hash is a one-way digest of a secret nobody stores — not personal data. `bcrypt.compare` reads it raw, so encrypting it would break the comparison and protect nothing |
| `resetPwd.resetHash`, `emailVerify.hash` | `admin`, `shopOwner`, `user` | Comparison hashes of one-time tokens, matched by value on every attempt. Random ciphertext cannot answer the match; deterministic would only make them guessable by equality |
| `resetPwd.resetDateReq`, `emailVerify.dateLastReq`, `emailVerify.requestTimes`, `emailVerify.valid` | same | Timestamps and counters describing a *flow*, not a person. None identifies anyone on its own |
| `login.firstLogin`, `login.lastLogin`, `login.rememberMe`, `login.onboardingStep`, `login.onboardingDone`, `registeredAt`, `disabled`, `deleted`, `waitApprov` | same | Account-lifecycle metadata. It **is** personal data in the GDPR sense — it relates to an identified person — but it identifies nobody without the encrypted fields beside it, and every one of them is read as a gate on a path that has already resolved the account by `_id`. **No reason for these was recorded anywhere before this document; this row is it.** They are cheap to encrypt only in the sense that nothing queries them by value — but encrypting a boolean gate buys a volume reader nothing except the knowledge that an account exists, which the document's existence already gave them |
| `_id` | all six | Server-minted ObjectId. Not personal data on its own, and the primary key |
| `addresses.[]._id`, `defaultAddress` | `user` | ⚠️ **Unencryptable, not merely unencrypted.** The collection validator's `$expr` clause `$map`s the `_id` of every address element and checks `defaultAddress` is one of them. Random ciphertext differs on every encryption, so `$in` would never match and **every write to the collection would be refused** |
| `idShopOwner`, `idCompany`, `idCategory`, `idParent` | `company`, `item`, `itemCategory` | Foreign keys, server-minted, no personal content |
| `__v` | all six | Mongoose version counter |

### 4.3 `company` — an entity, with two caveats worth naming

`legalName`, `vatNumber`, `taxCode`, `uniqueCode`, `certifiedEmail` and `registryExtract` describe the
**entity**, which is a matter of public record, not personal data. This platform's `taxCode` is explicitly
the 11-character company form and not the 16-character personal one. `publicName`, `slug`, `description`,
`published` and the whole of `address` are what the storefront **hands to anonymous visitors**, and they
are read by `search_text`, `published_city_publicName` and `address.position_2dsphere`. Encrypting any of
those would encrypt data the platform publishes, and pay for it with the map, the city listing and the
search.

Two caveats, both real and neither currently handled:

- ⚠️ **A sole trader is an entity that is a person.** Where the registered entity is one natural person,
  `legalName` *is* that person's name and `address` may be their home — published, indexed, in the clear,
  and correctly so given that the shop is what the storefront exists to show. This is a **product**
  question (what a sole trader is told they are publishing) rather than an encryption one, and it is
  named here because a reader of the encrypted-fields list would otherwise conclude `company` holds no
  personal data at all.
- ⚠️ **Free text can contain anything.** `company.description`, `company.registryExtract` and
  `item.description` are operator- or owner-authored prose. Nothing stops one holding a phone number or a
  person's name, and no encryption decision can be made per-occurrence. `shopOwner.notes` is the one
  free-text field on the platform that *is* encrypted, precisely because it is guaranteed to be about a
  named person.

## 5. MongoDB storage: not encrypted in Dev, and the binary cannot do it

Measured on the running stack.

| | |
|---|---|
| Image | `marketplace-mongod:8.0`, built `FROM mongo:8.0` |
| Build | **v8.0.28, `"modules": []` — Community** |
| Encryption options in `mongod --help` | **zero** — `grep -ci encrypt` answers `0` |
| Data path | `/data/db`, 247 MiB on `marketplace-mdb1` |
| Host volume | `/media/ai/docker/docker_data_dir/volumes/marketplace-dbs_mdb1/_data` |
| Filesystem | XFS on `nvme0n1p1`, mounted `/media/ai` |
| dm-crypt / LUKS devices on the host | **0** (`/dev/mapper` holds only `control`) |

WiredTiger's `--enableEncryption` is an Enterprise feature; it is not merely unconfigured here, it is
**absent from the binary**. Three nodes, three volumes, `mdb1`/`mdb2`/`mdb3` — the same answer for each,
since a replica set replicates the data to all three.

**Other environments: unknown, and unknowable from this workspace.** No production host exists
(`phase3/SECURITY_AUTH.md` §5), the production topology is owed (ADR-032, R46), and there is no staging.
Whether a future host encrypts its filesystem is a decision nobody has taken. This document does not
guess at one.

**Backups: there are none.** `docker-DBs` contains no backup script, no `mongodump` step and no scheduled
job; `up.sh`, `down.sh` and `shell.sh` are the whole of the operational surface. So "are the backups
encrypted" has no answer yet rather than a bad one — and when a backup does exist, the CSFLE ciphertext
travels into it unchanged, which is the one part of this that is already solved.

## 6. Redis: the keyspace is clean, the values are not, and both are on an unencrypted volume

### 6.1 The keyspace — no credential in a key name

| Key shape | Built by | Credential in the name? |
|---|---|---|
| `<prefix><sha256>` | `sessionKey` | no — digest of the prefixed token |
| `<prefix>used:<sha256>` | `tombstoneKey` | no — same digest |
| `<prefix>family:<uuid>` | `familyKey` | no — `familyId` is a `randomUUID()`, presenting one grants nothing |
| `<prefix>idx:<tier>:<accountId>` | `sessionIndexKey` | no — a tier constant and an id every query already carries |
| `<prefix>reuse:<tier>:<accountId>` | `reuseEventsKey` | no — same two segments |
| `<prefix>grace-hits` | counter | no — a word and an integer |
| `<prefix>keygrip`, `<prefix>keygrip:holders` | keygrip record | no — and the record's `wrapped` field is AES-256-GCM under `KEYGRIP_KEK`, which lives in env and is never written to Redis |
**Amended 2026-08-14 (E13-S10).** This table had one more row when it was written: `<prefix><raw token>`,
built by `legacySessionKey`, the one key shape on the platform whose *name* was a credential. It was a
read path only — writes have been hashed-only since E13-S01 — and E13-S10 deleted the builder, the read
and the `dual-read-hits` counter beside it. **No key shape on this platform carries a credential in its
name any more**, which is what the table above now says without a qualifier.

What that does not reach: an AOF written before the cutover still holds the old key names, and rewriting
the file is the only thing that drops them. `BGREWRITEAOF` was run on every node as part of E13-S10 — see
§6.3 below for what an append-only file retains and for how long.

### 6.2 The values — one plaintext email per access-token session

| Key | Fields | Personal data? |
|---|---|---|
| access-token session hash | `_id`, `tier`, **`email`**, `onboardingStep` (ShopOwner only) | ⚠️ **yes — the address, in the clear** |
| refresh-token session hash | `_id`, `tier`, `familyId`, `originalLogin`, `sessionCapDays` | no |
| session index (`idx:`) field value | `{ tier, mintedAt }` | no — E15-S02 decided the field carries no token and describes the session only |
| reuse events (`reuse:`) | `familyId`, action, timestamp | no |
| `keygrip` | `version`, `wrapped`, `fp` | no — wrapped |
| `keygrip:holders` | `<service> -> <fingerprint>@<ISO-8601>` | no |

**E18-S05's criterion says Redis session values "are not personal data". They are.** The email is written
by `setRedisLoginSession` on every login and re-written on every rotation, and it is read back on every
authenticated request. R45 already names it — "*every session hash — `_id`, `email`, `tier`*" — but scores
it as a **transport** risk, because `@axiumine/koa-utils` hardcodes `redis://`. The at-rest half was
missing until this document.

### 6.3 Persistence — where those emails land

`up.sh` generates `secrets/redis.conf` with exactly two directives: `appendonly yes` and `requirepass`.
It sets **no `save` directive**, so Redis's compiled-in RDB save points apply as well. Both files are on
the `marketplace-dbs_redis` volume, alongside the MongoDB volumes, on the same unencrypted XFS:

| File | Size, observed | Modified |
|---|---|---|
| `/data/appendonlydir/appendonly.aof.1.base.rdb` | 89 B | 2026-08-09 |
| `/data/appendonlydir/appendonly.aof.1.incr.aof` | **0 B** | 2026-08-09 |
| `/data/dump.rdb` | 89 B | 2026-08-12 |

⚠️ **Read that table as "the mechanism, observed empty", not as "there is no exposure".** 89 bytes is an
empty dataset and the incremental AOF has never been written to, because the nine services are not running
against this instance right now — only the four database containers are up. When they run, every login
appends an `HSET` carrying an email address to `appendonly.aof.1.incr.aof`.

⚠️ **And an AOF outlives the TTL of what it records.** A session key expiring removes it from memory and
appends a `DEL`; the earlier `HSET`, email included, stays in the file until an AOF rewrite compacts it —
triggered by size growth, not by expiry. So the retention of a session email on disk is governed by
Redis's rewrite thresholds and by nothing anyone on this platform has decided. It is a small volume and a
short list of fields; it is not zero, and no retention decision covers it (E12-S19 decided **the edge's**
logs, and `docker-DBs/docker-compose.yml` is explicit that its own rotation caps size and decides nothing
about retention).

## 7. What this closes, and the one thing it opens

**Closes:** the audit's §5 blind spot — *"Encryption at rest for the MongoDB collections holding PII and
legal-identity fields (`taxCode`, `vatNumber`, `certifiedEmail`) is out of scope for a token audit but is
the adjacent question this review did not touch."* Answered: those three fields are **not** encrypted and
should not be — they identify a company, which is public record (§4.3) — while thirty personal-data paths
**are** (§3), and the storage beneath all of them is **not** (§5, §6.3).

**Opens one row rather than one story.** There is no code change here to own: MongoDB Community cannot
encrypt its storage, Redis has no such feature, and the host filesystem is an operations decision that
belongs to whoever provisions the production host that does not exist yet. That is a risk to carry, not a
backlog item to build — **R48**, owned by the platform owner, and explicitly coupled to ADR-032 for the
same reason R45 and R46 are: no control here may be argued closed by appeal to a boundary nobody has
written down.

**Not opened, deliberately:**

- §4.1's three plaintext `shopOwner` fields. ADR-029 decided them with the trade stated, the condition for
  revisiting recorded, and a ⚠️ in both repos that exists to stop the wrong fix. Re-opening it as a
  finding would be re-litigating a decision, not reporting a gap.
- §4.2's lifecycle metadata. Encrypting a boolean gate protects nothing a volume reader does not already
  have from the document's existence.
- §4.3's sole-trader caveat. It is a product question about what a shop is told it publishes, and it
  belongs to whoever owns the storefront's copy — not to an encryption story.
