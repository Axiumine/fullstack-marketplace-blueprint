# marketplace-docker-DBs — the local databases, and how to run the platform on them

> [!WARNING]
> **Work in progress — this software is not tested yet.** It has never run outside a developer
> workstation: no real deployment, no load test, no security review, no upgrade path. Parts of the
> platform are deliberately unbuilt, and anything here — schemas, endpoints, configuration, file
> layout — can still change without notice. Whatever automated gates this repo runs, treat the result
> as unproven: do not point it at real users or real data.
> Read [`docs/PRODUCTION_HARDENING.md`](../docs/PRODUCTION_HARDENING.md) before taking any of it further.

Part of the **Marketplace** project — <https://github.com/Axiumine/fullstack-marketplace-blueprint>.

Marketplace talks to an **external MongoDB replica set** (`rs0`, members `db1` / `db2` / `db3`) that
lives on the maintainer's network. A clone does not get it, and neither does a clone get
`BEs/marketplace-db-setup/setup/mongodb.js`, the runbook that provisions its users — that file is
gitignored because it carries live credentials.

This directory is the replacement for both: a three-node replica set in Docker, plus a script that
creates every account the nine backend services expect, under names and passwords you choose. The Redis
those nine keep their sessions in lives here too, behind `./up.sh --with-redis`.

**A replica set, not a single `mongod`, and that is not optional.** Transactions, change streams and
`readConcern: majority` all require one, and a standalone server rejects them outright. A single-node
replica set would satisfy MongoDB, but three nodes are what the code is written against, so an
election or a stepdown behaves here the way it behaves on the real cluster.

---

## Prerequisites

| Need | Why |
|---|---|
| Docker Engine 24+ with Compose v2 | `docker compose version` must answer. The scripts fall back to a v1 `docker-compose` if that is all you have. |
| `openssl` | mints the replica-set keyfile and the CSFLE master key |
| three `/etc/hosts` entries | see immediately below — **without them nothing outside Docker can connect** |
| Node v24.18.0 + yarn | to run the platform itself, not this directory |
| **Redis 7.4 or newer** | a platform requirement, not a preference — see [§Redis](#redis). The container in this compose file already is; a Redis of your own has to be. |

### The `/etc/hosts` entries

```
127.0.0.1   mdb1 mdb2 mdb3
```

⚠️ **This is the one manual step, and skipping it produces a confusing failure rather than an
obvious one.** A replica set advertises its members by the `host:port` written into its own config,
and every driver re-dials those addresses — the URI you hand it is only a seed list. The members
here are `mdb1:27017`, `mdb2:27018`, `mdb3:27019`, so a process on your machine has to be able to
resolve those three names or it will connect, discover the topology, and then fail every operation
with `Server selection timed out`.

That is also why the three nodes listen on **three different ports**. One name per node cannot be
distinguished by `127.0.0.1` alone, so all three sharing 27017 would collapse into one reachable
member the moment the traffic came from outside the Docker network.

`up.sh` prints what the three names currently resolve to when it finishes, so a missing entry — or
one pointing somewhere unexpected — is visible without a debugging session:

```sh
getent hosts mdb1 mdb2 mdb3
```

## Quick start

```sh
cd marketplace-docker-DBs
cp env .env          # then fill in the four passwords — MONGO_ROOT_PWD, MONGO_DEV_PWD,
                     # MONGO_TEST_PWDDBOWNER, MONGO_TEST_PWDDBRW
./up.sh              # or: ./up.sh --with-redis
```

`up.sh` is idempotent. It generates the keys once, initiates `rs0` once, and checks every user
before creating it, so re-running it after a reboot is the normal way to bring the cluster back.

```sh
./shell.sh dev       # an authenticated mongosh on dbMarketplaceDev
./down.sh            # stop, keep the data
./down.sh --purge    # stop and delete every database (asks for confirmation)
```

## What `up.sh` creates

| Database | Users | Role |
|---|---|---|
| `admin` | `MONGO_ROOT_USER` | `root` — created through the localhost exception, the only account that can create the rest |
| `dbMarketplaceDev` | `marketplaceOwnerDev` / `marketplaceRwDev` | `dbOwner` / `readWrite` |
| `dbMarketplaceTest` | `marketplaceOwnerTest` / `marketplaceRwTest` | `dbOwner` / `readWrite` — marketplace-db-setup's own suite |
| the nine per-repo test databases | the same test pair, defined separately in each | `dbOwner` / `readWrite` |

⚠️ **Every account is scoped to exactly one database, and its `authSource` is that database — never
`admin`.** That is not a stylistic choice: `vitest.mongo.mts` asserts `MONGO_TEST_AUTH_ADMIN ===
MONGO_TEST_DB` and refuses to build a URL otherwise, and the CSFLE key vault has to sit inside the
same database for the same reason (a vault anywhere else answers `Unauthorized` on its first
`createIndex`).

The nine per-repo databases exist because **every integration suite drops its own database on every
run**. Sharing one would mean two suites deleting each other's fixtures mid-run. Dropping a database
does *not* delete its users — MongoDB keeps them in `admin.system.users` whatever their
authentication database is — so `./up.sh` never has to re-create them.

`marketplace-dev-authenticated-logout` has no test database on purpose: its integration suite never
touches MongoDB.

## One account for nine services — the narrower shape, and how to check it

⚠️ **`marketplaceRwDev` holds the built-in `readWrite` role, and that role is database-scoped.** It is
CRUD on every collection in `dbMarketplaceDev` — the six that exist, and every one anybody creates later —
plus `createCollection`, `createIndex` and `dropCollection`. All eight services that speak to MongoDB
authenticate as it, so a bug in the public storefront reaches the `admin` collection at the datastore
layer with `assertTier` never consulted. Nothing below the application code says no. That is
RISK_REGISTER R24, and it is a real gap rather than a theoretical one.

[`init/roles.js`](./init/roles.js) is the shape that closes it: one role per service, naming the
collections that service actually reaches and nothing else.

| Account | Collections it is granted |
|---|---|
| `marketplaceAdminAuthzDev` | `admin` |
| `marketplaceAdminResDev` | `admin`, `company`, `item`, `itemCategory`, `shopOwner`, `user` |
| `marketplaceOwnerAuthzDev` | `shopOwner` |
| `marketplaceOwnerResDev` | `company`, `item`, `itemCategory`, `shopOwner` |
| `marketplacePublicAuthzDev` | `admin`, `shopOwner`, `user` |
| `marketplacePublicResDev` | `company`, `item`, `itemCategory`, `shopOwner`, `user` |
| `marketplaceUserAuthzDev` | `user` |
| `marketplaceUserResDev` | `user` |

Seven of the eight hold a strict subset of the database and four need exactly one collection, so the
separation is worth having rather than a formality. `marketplace-dev-authenticated-logout` is absent
because it opens no MongoDB connection at all — Redis only — and therefore needs no account.

The table was derived by measurement, not judgement: every service reaches MongoDB through a model
imported from `@axiumine/marketplace-common/models/MongoDB/…` and through nothing else, so the import
list *is* the collection list. Re-derive it with the one-liner written at the top of `init/roles.js`.

Two privileges in that file look like holes and are not. **`createCollection` is granted per
collection**, so it creates the one collection named in the resource and refuses a seventh — which is
what makes it safe to leave Mongoose's `autoCreate` alone instead of setting `autoCreate: false` in
eight places. And **every role gets `find`/`insert`/`createIndex`/`listIndexes` on `__keyVault`**,
because all eight services call `setupFieldEncryption()` at boot and that both creates the unique index
on `keyAltNames` and inserts a data key when one is missing; a role without it takes every service down
at startup rather than at first use. `remove` on the vault is deliberately absent — deleting a data key
makes every field encrypted under it permanently unreadable.

### Checking it

```bash
./rbac-probe.sh
```

⚠️ **This provisions nothing and is not part of `up.sh`.** It creates one throwaway database
(`dbMarketplaceRbacProbe`), one role and one user, asserts the shape in both directions, and drops all
three on the way out whether the assertions passed or failed. It never touches `dbMarketplaceDev`.

Thirteen assertions: seven that the granted operations succeed — insert, find, update, delete,
`createCollection` on the granted collection, the key-vault unique index, a data-key insert — and six
that the ungranted ones come back `Unauthorized`, **by error code and not merely by throwing**: reading,
writing and creating a collection the role was not given, dropping the collection it owns, dropping the
database, and deleting a data key. A green run is what turns "the narrower shape would work" into
something checked, and the probe has been run against two deliberately broken variants of itself — a
role widened to a collection it should not reach, and one with the key-vault block removed — to prove it
still fails when the shape is wrong.

### Why it is a definition and not a deployment

Eight roles need eight accounts, and eight accounts need eight passwords that exist in no template in
this workspace. The moment they share one, a service that reads its own environment can authenticate as
any of the others and the separation is decoration. Who mints those and where they are kept is the
adopter's decision — the same boundary
[`ADR-039`](../docs/devprotocol/phase3/adr/ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md)
draws for the datastore host and
[`ADR-040`](../docs/devprotocol/phase3/adr/ADR-040-the-secrets-manager-vendor-choice-is-the-adopters.md)
for the secrets manager. What this repo owes is a shape that is known to work, next to the script that
proves it — not a guess.

⚠️ **A new resolver that imports a seventh model widens its service's true surface and `init/roles.js`
stays silent about it.** That is the standing cost of a hand-maintained list, and the reason the
derivation is written down rather than described.

## Wiring the repos

Each repo has a committed `env` template and a gitignored `.env` you create from it. The values below
are what this cluster answers to.

**Every backend service** — `MONGODB_URI`, one line, no line break inside it. `<pwd>` is
`MONGO_DEV_PWD` from `marketplace-docker-DBs/.env`, written out in full:

```
mongodb://marketplaceRwDev:<pwd>@mdb1:27017,mdb2:27018,mdb3:27019/dbMarketplaceDev?replicaSet=rs0&authSource=dbMarketplaceDev
```

The placeholder is kept short on purpose: the pre-commit secret guard blocks a staged `mongodb://`
URI carrying a password of ten characters or more, and it cannot tell a documentation example from
a leak.

**`BEs/marketplace-db-setup`** assembles its URL from pieces instead, and injects the credentials
itself (`lib/mongoUrl.js`), so the connection string carries no user:

```
MONGO_DEV_CONN_STRING=mongodb://mdb1:27017,mdb2:27018,mdb3:27019/dbMarketplaceDev?replicaSet=rs0
MONGO_DEV_AUTH_ADMIN=dbMarketplaceDev
MONGO_DEV_DB=dbMarketplaceDev
MONGO_DEV_UDBOWNER=marketplaceOwnerDev
MONGO_DEV_URW=marketplaceRwDev
MONGO_DEV_PWD=<pwd>
```

**The `MONGO_TEST_*` block**, in every repo that runs integration tests. Three variables name the
same database and all three must agree — the suite checks:

```
MONGO_TEST_CONN_STRING=mongodb://mdb1:27017,mdb2:27018,mdb3:27019/<this repo's test db>?replicaSet=rs0
MONGO_TEST_DB=<this repo's test db>
MONGO_TEST_AUTH_ADMIN=<this repo's test db>
MONGO_TEST_UDBOWNER=marketplaceOwnerTest
MONGO_TEST_PWDDBOWNER=<ownerPwd>
MONGO_TEST_UDBRW=marketplaceRwTest
MONGO_TEST_PWDDBRW=<rwPwd>
```

| Repo | its test database |
|---|---|
| `BEs/marketplace-common` | `dbMarketplaceTestCommon` |
| `BEs/marketplace-db-setup` | `dbMarketplaceTest` |
| `marketplace-dev-public-authorization` | `dbMarketplaceTestPublicAuthz` |
| `marketplace-dev-public-resource` | `dbMarketplaceTestPublicRes` |
| `marketplace-dev-authenticated-authorization` | `dbMarketplaceTestOwnerAuthz` |
| `marketplace-dev-authenticated-resource` | `dbMarketplaceTestOwnerRes` |
| `marketplace-dev-admin-authenticated-authorization` | `dbMarketplaceTestAdminAuthz` |
| `marketplace-dev-admin-authenticated-resource` | `dbMarketplaceTestAdminRes` |
| `marketplace-dev-user-authenticated-authorization` | `dbMarketplaceTestUserAuthz` |
| `marketplace-dev-user-authenticated-resource` | `dbMarketplaceTestUserRes` |
| `marketplace-dev-authenticated-logout` | none — no `MONGO_TEST_*` block at all |

⚠️ **One value, one line.** dotenv ends a value at the newline *even inside quotes*, hands back the
truncated prefix and reads the tail as a variable of its own — silently, in both halves. The
connection strings above are long enough for an editor to wrap them, which is exactly how ten
`KEYGRIP_KEY_*` values were found broken. `.githooks/pre-commit` check 0 blocks a commit in a repo
whose `.env` has that shape; the background is [`docs/workflow.md`](../docs/workflow.md) §Environment files.

### CSFLE

`up.sh` mints `secrets/csfle-master-key`, 96 random bytes — the length the `local` KMS provider
needs, since it splits the file into a 32-byte encryption key, a 32-byte MAC key and 32 bytes of
reserve. Point every repo at that one file:

```
CSFLE_MASTER_KEY_PATH=<absolute path>/marketplace-docker-DBs/secrets/csfle-master-key
CSFLE_KEY_VAULT_NAMESPACE=dbMarketplaceDev.__keyVault
```

The namespace is **the database that `.env` points at**, plus `.__keyVault` — the same database, not
a vault database of its own.

⚠️ **The migrations and all nine services must read the SAME file.** The data keys stored in the
vault are encrypted under it, so a migration run against a different master key mints keys the
platform cannot use, and every field it converts becomes an undecryptable blob. `./down.sh --purge`
deliberately leaves `secrets/` alone for that reason. ADR-029 is the rationale.

### Redis

⚠️ **Version floor: Redis 7.4.0. Anything older is not supported, whoever runs it — and Redis proper,
not a fork.** **Valkey is not a supported target** (decided 2026-08-10): it is a fork with its own
release line, and the hash-field TTL commands below are the exact area where fork coverage diverges
by version. "Redis-compatible" on a managed service's product page is not the same claim. The compose
service is `image: redis:${REDIS_TAG:-7.4-alpine}` and `env` pins `REDIS_TAG=7.4-alpine`, so
`./up.sh --with-redis` satisfies the floor without you doing anything — the container currently
reports `v=7.4.10`. The floor is written down because the pin is the *only* thing enforcing it today
and a pin is one edit away from being lowered.

**What needs 7.4 specifically: hash-field TTLs.** `HEXPIRE` / `HPEXPIRE` / `HTTL` / `HPERSIST` — a
TTL on an individual field of a hash rather than on the whole key — were added in Redis 7.4.0 and
exist in no earlier release. The account→sessions index — documented in
[`docs/data-model.md`](../docs/data-model.md) §The account index — is one
hash per account whose fields are that account's live sessions, and fields whose sessions expire
without passing through logout or rotation have to age out on their own. Without per-field TTLs the
index keeps naming sessions that no longer exist, which is both a slow memory leak and a lie told to
the admin screen that reads it.

**Those commands are called on every login and every token rotation** (built 2026-08-13).
Each field's TTL is what remains of the session it names — `originalLogin + sessionCapDays`, not the
session key's own expiry and not the index key's — so a session that ends without passing through
logout or rotation takes its row with it. The lazy-prune alternative was rejected rather than kept as
a toggle, which is what makes the floor load bearing rather than aspirational.

**Downgrading `REDIS_TAG` below `7.4` is a breaking change, not a tag bump.** Redis does not refuse
an unknown command at startup; it refuses it at the first call, inside whichever request happened to
trigger the write. Two things now catch that earlier: `./up.sh --with-redis` reads
`redis-server --version` out of the container and refuses to finish below 7.4.0, and each of the four
authorization services probes the server with an `HTTL` at boot and exits rather than serving a login
it cannot file. The script only ever sees this compose file's container; the boot probe sees whatever
`REDIS_URL` points at, because it runs on the connection the service itself will use.

The nine services keep their sessions in Redis, so the platform does not boot without one. If you
have no Redis either, start the one in this compose file:

```sh
./up.sh --with-redis
```

Then, in every service's `.env`:

```
REDIS_IS_CLUSTER=0
REDIS_URL=redis://default:<pwd>@127.0.0.1:6379
REDIS_KEY=<one prefix, copied verbatim into all nine>
```

`REDIS_IS_CLUSTER=0` picks the single-client branch, which reads `REDIS_URL` and nothing else — the
`REDIS_DB1_HOST` … `REDIS_USERNAME` block below it is only read when the value is `1`. Leave the
block in place and empty.

⚠️ **`REDIS_KEY` must be byte-identical in all nine services.** They share one session keyspace
deliberately: the session document carries a `tier`, and `assertTier` is the only thing separating
one role's session from another's. A service with a different prefix does not fail loudly — it
simply never finds a session.

**Persistence is on.** `appendonly yes` is set in `secrets/redis.conf` — see the next paragraph for
why that file exists. Sessions therefore survive a restart of the container and of the host, which is
what makes `./up.sh --with-redis` the normal way to come back after a reboot without logging every
developer out.

⚠️ **The password is no longer in the container's command line, and `secrets/redis.conf` is where it
went** (2026-08-11). It used to be interpolated into `command:` as
`--requirepass ${REDIS_PASSWORD}`, which put it where `docker inspect marketplace-redis` and
`docker ps --no-trunc` printed it to anyone who could reach the daemon. `up.sh` now writes that value
into `secrets/redis.conf` — regenerated on every run, so `.env` stays the single source of truth —
and mounts it read-only at `/usr/local/etc/redis/redis.conf`. Three things follow:

- **Never commit it.** `secrets/` is git-ignored and the workspace `pre-commit` hook refuses any path
  with that segment as well as any line that looks like a `requirepass` directive.
- **It is mode 444, and that is deliberate.** `redis-server` reads it as uid 999 inside the container,
  through a bind mount the daemon set up as root, so a 400 file owned by your user gives
  `Fatal error, can't open config file`. `up.sh` keeps `secrets/` itself at 700, and the container's
  path never traverses that directory — so the file is world-readable in mode only, not in reach.
- **Run `./up.sh --with-redis`, not `docker compose --profile redis up`, at least once.** Docker
  creates a *directory* where a bind-mount source is missing, and `redis-server` then dies on every
  start until you delete it.

Changing the password is `./up.sh --with-redis` after editing `.env`, plus the same edit in each
service's `REDIS_URL`. Restarting the container alone is not enough — the file is rewritten by the
script, not read from `.env` by compose.

Two consequences worth knowing before you go looking for either:

- **The append-only file is a command log, and it keeps what the keyspace has forgotten.** Every
  `HSET` that ever created a session key stays in it after that key expires, so `redis:/data`
  accumulates a history of session keys rather than a snapshot of the live ones. ⚠️ **A
  session key once *was* the token** — so an append-only file written before that cutover is a list of
  credentials in plain text, which is why the key namespace is hashed and why that cutover carried an
  explicit `BGREWRITEAOF` step of its own. A rewrite is the only thing that removes what is already
  written; hashing new writes does not touch a byte of it.
- ⚠️ **The rate-limiter keys already written are a list of email addresses, and hashing them does not
  remove them.** The per-email counter used to be `rl:<bucket>:email:<the address itself>`,
  so `rl:userRegister:email:mario@example.com` is in the append-only file of every environment that
  ran the old code. New writes hash the address (SHA-256, `sha256Hex` in `marketplace-common`), which
  is a change to what is appended from now on and to nothing else. Removing the history is one
  operational step: wait for the one-hour window to drain — the counters are the only thing that reads
  those keys and they expire on their own — then `BGREWRITEAOF`. ⚠️ **Per node.** The command is not
  cluster-wide: in production `REDIS_IS_CLUSTER=1` and each master keeps its own file, so a rewrite
  run against one of them leaves every other one exactly as it was. On this container there is one
  node, which is the case that hides the trap rather than the case that matters.
- **`./down.sh --purge` removes the `redis` volume along with everything else**, so the file is gone
  with it. Anything you wanted from a session — a reproduction, a stuck key — has to come out before
  the purge, not after.

Use your own Redis instead and none of *that* applies: the platform reads `REDIS_URL` and asks
nothing about how that server persists. **The 7.4 floor still applies** — it is a requirement of the
platform, not of this container. `redis-cli INFO server | grep redis_version` answers it.

## Running the whole platform

Bring things up in this order. Every command runs from the repo it names.

**1 — the cluster**

```sh
cd marketplace-docker-DBs && ./up.sh --with-redis
```

**2 — the shared library.** It is consumed by package name from `registry.npmjs.org`, so `yarn install`
in each consumer is what brings it in — nothing is copied anywhere. Building it here is only for working
*in* the repo; an edit reaches a call site by being published (ADR-047).

```sh
cd BEs/marketplace-common && yarn install && yarn build
```

**3 — the schema.** Collections, `$jsonSchema` validators and indexes; `SEED_DEMO=true` in
`.env` also loads demo data.

```sh
cd BEs/marketplace-db-setup && yarn install && yarn migrate:status && yarn migrate:up
```

**4 — the nine services.** Each is its own repo with its own `.env`; `yarn dev` is `tsx watch`.

| Service | Port | Tier |
|---|---|---|
| `marketplace-dev-admin-authenticated-resource` | 4024 | Admin |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | Admin |
| `marketplace-dev-authenticated-resource` | 4026 | ShopOwner |
| `marketplace-dev-public-resource` | 4027 | public |
| `marketplace-dev-public-authorization` | 4028 | public |
| `marketplace-dev-authenticated-authorization` | 4029 | ShopOwner |
| `marketplace-dev-authenticated-logout` | 4030 | all three |
| `marketplace-dev-user-authenticated-authorization` | 4031 | User |
| `marketplace-dev-user-authenticated-resource` | 4032 | User |

```sh
cd BEs/dev/<service> && yarn install && yarn dev
```

Each service refuses to start with a list of the `REQUIRED_ENV_VARS` its `.env` is missing —
`checkRequiredEnv` treats an empty value exactly like an absent one, which is the fastest way to
find a half-filled `.env`.

**5 — the three frontends.** Each proxies its GraphQL paths to the ports above, so start the
services first.

| App | Port | Audience | Proxies to |
|---|---|---|---|
| `marketplace-admin` | 3043 | `Admin` | 4024, 4025, 4028, 4030 |
| `marketplace-shopowner` | 3044 | `ShopOwner` | 4026, 4028, 4029, 4030 |
| `marketplace-user` | 3045 | end customer | 4027, 4028, 4030, 4031, 4032 |

```sh
cd marketplace-admin && yarn install && yarn dev
```

**Minimum useful subset.** You do not need all nine to work on one surface: the public site is
4027 + 4028, the customer account area adds 4031 + 4032, the shop-owner app is 4026 + 4028 + 4029,
the admin app is 4024 + 4025 + 4028. `4030` (logout) is shared by all three and is the one every
authenticated surface needs.

**Running the suites.** With the `MONGO_TEST_*` block filled in, `yarn test` and `yarn test:cov`
work in every repo. Everything is gated at 100% on all four coverage metrics and mutation score
100 — a failing threshold means a missing test, never a threshold to lower.

## Not for production

Stated plainly so nobody has to guess:

- Both published ports bind **127.0.0.1 only**, and no TLS is configured anywhere in this stack.
- The keyfile authenticates replica-set members to each other; it is not a substitute for TLS
  between them, and here they are all on one Docker network on one machine.
- The passwords come from your environment file. There is no rotation and no vault, and the only
  separation between the account that runs migrations and the account that serves traffic is
  `dbOwner` vs `readWrite` — which the nine services share. §One account for nine services holds the
  per-service shape that replaces it, and the probe that checks it.
- All three nodes share one host, so this survives a container restart and nothing else.
- Only a `Dev` environment exists in this platform at all (`MONGO_DEV_*`) — there is no staging or
  production configuration to be careless with yet.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Server selection timed out` from a host process, containers healthy | the `/etc/hosts` line is missing. The driver resolved the seed and then re-dialled `mdb1` / `mdb2` / `mdb3` as advertised. |
| `MongoServerError: not primary` | an election is in flight; retry. If it never settles, `docker compose logs mdb1` — a node whose clock is far off never wins one. |
| `Authentication failed` on a test suite | `MONGO_TEST_AUTH_ADMIN` is `admin`. It must be the test database itself. |
| `up.sh` stops at `Unauthorized` on the root user | a root user already exists with a different password than `.env` now holds. Either restore the old value or `./down.sh --purge`. |
| `MONGO_TEST_CONN_STRING names database "x" but MONGO_TEST_DB is "y"` | the three test-database names disagree; the table above has the right one for that repo. |
| `rbac-probe: authentication failed as <root user>` | the probe reads the root credentials the same way `up.sh` does; the cluster holds a different password than that file now says. |
| `probe FAILED — N of the expectations in roles.js do not hold` | `init/roles.js` no longer grants what a service needs, or grants something it should not. The report names each one and which direction it failed in. |
| `permission denied` on `/etc/mongo/keyfile` at startup | the image was built before `secrets/mongo-keyfile` existed. `docker compose build --no-cache` then `./up.sh`. |
| the suite drops the wrong database | it refuses to: `buildTestMongoUrl` throws when `MONGO_TEST_DB` equals the database `MONGODB_URI` points at. Fix `.env`. |
| `Redis is older than 7.4.0` at a service's startup, or `up.sh: Redis 7.2.x is below the 7.4.0 floor` | the same cause read at two different moments: the Redis behind `REDIS_URL` — or this compose file's container, if `REDIS_TAG` was lowered — has no hash-field TTLs. See §Redis. |
| `ERR unknown command 'HEXPIRE'` | the two checks above were bypassed, or the server was downgraded under a running service. Check with `redis-cli INFO server \| grep redis_version` and restart the services after raising it — the probe runs at boot only. |
| `Fatal error, can't open config file` from `redis` | `secrets/redis.conf` is missing, or is a directory Docker created for a missing bind mount. `rm -rf secrets/redis.conf && ./up.sh --with-redis`. |
| `NOAUTH Authentication required` after changing the password | `.env` was edited but `./up.sh --with-redis` was not re-run, so the container still holds the old value. Compose does not read that variable any more — the script writes the config file. |
| `docker logs` no longer reaches back far enough | expected: every container is capped at 20 MiB × 5 files. `docker inspect -f '{{json .HostConfig.LogConfig}}' <name>` shows the pair; raise `max-size` in `docker-compose.yml` if you need a longer window. |

## License

GPL-3.0-or-later — see [LICENSE](./LICENSE).
