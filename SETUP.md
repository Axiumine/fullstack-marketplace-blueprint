# Setting this up for the first time

From an empty machine to a browsable marketplace with demo data. Follow the steps in order — each one
depends on the one before it.

Everything here is **development only**. There is no staging or production configuration anywhere in
these sixteen repos: only a `Dev` environment exists, every port binds `127.0.0.1`, and nothing carries
TLS except the nginx configuration in step 10, which is not needed to run the platform locally.

**Read [`README.md`](./README.md) first if you want to know what this is.** This file assumes you already do and only
tells you how to start it.

## What you will and will not get

⚠️ **This platform has no commerce.** A customer can register, confirm their email, log in and keep
addresses. There is no cart, no order, no delivery and no payment — no collection, no resolver, no UI,
and `item` carries no price for that reason. When the storefront shows no "buy" button, nothing is
broken. Full state of each surface: [`CLAUDE.md`](./CLAUDE.md) §Build state.

At the end of this you have a three-node MongoDB replica set, a Redis, six collections with their
validators and indexes, one demo admin, one demo shop owner, one demo company, nine backend services
and three frontends.

---

## 1. Prerequisites

| Need | Version | Why |
|---|---|---|
| Node | **v24.18.0** exactly | pinned in `.nvmrc` and in every `package.json`'s `engines`. Yarn's engines check is a hard exit 1, so a different node fails the first command rather than the tenth |
| nvm | any | the git hooks select the pinned node through it, and block with the `nvm install` line if it is missing |
| yarn | classic or berry | `npm` is not used anywhere here |
| Docker Engine | 24+ with Compose v2 | the database cluster, and the Qodana scan the commit gate runs |
| `openssl` | any | mints the replica-set keyfile, the CSFLE master key and the cookie signing keys |
| a Qodana Cloud token | — | **only if you intend to commit.** Qodana is a pre-commit gate in fourteen repos and blocks when the token is missing rather than skipping |

```bash
nvm install 24.18.0 && nvm use 24.18.0
node -v          # must print v24.18.0
docker compose version
```

Not required to run the platform: nginx (step 10 is for putting it on a host), a SocketLabs account
(without one, registration works and the confirmation email is not delivered), a Nominatim instance (the
address autocomplete stays empty), Cloudflare Turnstile (the widget disables itself when no key is set).

### The `/etc/hosts` entries

```
127.0.0.1   mdb1 mdb2 mdb3
```

⚠️ **This is the one manual step, and skipping it produces a confusing failure rather than an obvious
one.** A replica set advertises its members by the `host:port` in its own config and every driver
re-dials those addresses — the URI you hand it is only a seed list. Without these three names a process
connects, reads the topology, and then fails every operation with `Server selection timed out`. Check
with `getent hosts mdb1 mdb2 mdb3`.

---

## 2. Get the code

```bash
git clone --recurse-submodules https://github.com/Axiumine/fullstack-marketplace-blueprint.git
cd fullstack-marketplace-blueprint
```

⚠️ **This does not work yet.** All sixteen repositories exist on GitHub and every one of them is empty —
nothing has ever been pushed, so every SHA `.gitmodules` pins exists on no remote and
`--recurse-submodules` fails on the first one. Until the first push, the workspace has to be handed to
you as a directory. The recipe below is what makes an existing checkout usable.

```bash
git submodule update --init --recursive
git submodule foreach 'git switch main'                      # ⚠️ not optional
git config core.hooksPath .githooks                          # parent: no package.json, no prepare hook
git -C marketplace-nginx config core.hooksPath .githooks     # same reason
git config push.recurseSubmodules check
```

⚠️ **`git submodule update` leaves every sub-repo on a detached HEAD.** A commit made there is reachable
from nothing and disappears at the next checkout, looking entirely normal until it does. Run the
`foreach` line before touching anything.

None of those three `git config` lines can be committed — local config is per-worktree — so they survive
exactly as long as the checkout does. Without them the parent runs no gate at all and says nothing about
it. The other fourteen repos re-arm themselves from `package.json`'s `prepare` script on `yarn install`.

---

## 3. Start the databases

```bash
cd marketplace-docker-DBs
cp env .env
```

Fill in four passwords in `.env` — `MONGO_ROOT_PWD`, `MONGO_DEV_PWD`, `MONGO_TEST_PWDDBOWNER`,
`MONGO_TEST_PWDDBRW`. Any values you like; you will copy them into other `.env` files later, so pick
them once.

```bash
./up.sh --with-redis
```

`up.sh` is idempotent: it mints the keys once, initiates `rs0` once and checks every user before
creating it, so re-running it after a reboot is the normal way to bring the cluster back. It prints what
`mdb1` / `mdb2` / `mdb3` currently resolve to when it finishes.

What it creates:

| Database | Users | Role |
|---|---|---|
| `admin` | `MONGO_ROOT_USER` | `root` — through the localhost exception, the only account that can create the rest |
| `dbMarketplaceDev` | `marketplaceOwnerDev` / `marketplaceRwDev` | `dbOwner` / `readWrite` |
| `dbMarketplaceTest` | `marketplaceOwnerTest` / `marketplaceRwTest` | `dbOwner` / `readWrite` |
| nine per-repo test databases | the same test pair | one per repo that runs integration tests, so two suites cannot drop each other's data |

Every account is scoped to exactly one database and its `authSource` is that database, **never
`admin`** — `MONGO_TEST_AUTH_ADMIN=admin` is the bug behind `Authentication failed` in a suite.

Other commands: `./shell.sh dev` for an authenticated `mongosh`, `./down.sh` to stop and keep the data,
`./down.sh --purge` to stop and delete every database. ⚠️ `--purge` is destructive and not reversible.

**Three nodes, not one `mongod`, and not a single-node set.** Transactions, change streams and
`readConcern: majority` all need a replica set, and the code is written against three.

---

## 4. The CSFLE master key

`up.sh` already minted it: `marketplace-docker-DBs/secrets/csfle-master-key`, 96 random bytes — the length the
`local` KMS provider needs, since it splits the file into a 32-byte encryption key, a 32-byte MAC key
and 32 bytes of reserve. There is nothing to generate by hand.

Every repo that touches encrypted fields points at **that one file**:

```
CSFLE_MASTER_KEY_PATH=/absolute/path/to/marketplace-docker-DBs/secrets/csfle-master-key
CSFLE_KEY_VAULT_NAMESPACE=dbMarketplaceDev.__keyVault
```

The namespace is **the database that `.env` points at**, plus `.__keyVault` — the same database, not a
vault database of its own. Every user on this cluster is scoped to one database, so a vault anywhere
else answers `Unauthorized` on its first `createIndex`.

⚠️ **The migrations and all nine services must read the same file, and there is no escrow.** The data
keys in the vault are encrypted under it, so a migration run against a different master key mints keys
the platform cannot use and every field it converts becomes an undecryptable blob. Losing the file loses
every personal field, permanently — it is not a credential you can rotate by replacing it.
`./down.sh --purge` deliberately leaves `secrets/` alone for that reason; never tidy that directory.
Rationale: ADR-029.

---

## 5. Generate the shared secrets

Two values are shared **across repos**, and nothing on the platform checks that they agree — no test
spans two services, so a mismatch returns 401 at runtime while every suite stays green. Generate each
one **once**, now, and paste the same value everywhere it is needed.

```bash
openssl rand -base64 32                # KEYGRIP_KEK   → 44 chars, one '=' of padding
```

| Value | Goes in | Why it must match |
|---|---|---|
| `KEYGRIP_KEK` | the four `*-authorization` services, `marketplace-dev-authenticated-logout`, `marketplace-dev-admin-authenticated-resource` and `marketplace-db-setup` — 6 of 9, plus the seed | it unwraps the one Redis record the cookie-signing keys live in (ADR-034). `public-authorization` signs the refresh cookie at login and the tier's own authorization service verifies it, so a service that cannot open the record **refuses to boot** rather than signing cookies its siblings cannot verify |
| `REDIS_KEY` | all nine services **and `marketplace-db-setup`**, byte-identical | one shared session keyspace, deliberately: the session carries a `tier` and `assertTier` is what separates the roles. A prefix that names a namespace the seed never wrote into now fails at boot in all nine — §8's record is the thing each of them looks for first. What it still cannot catch is the whole fleet, seed included, agreeing on the *same* wrong prefix: every service then finds the record exactly where it expects it (`RISK_REGISTER` R04) |

⚠️ **Six services, not five, and the sixth is a `*-resource` one.**
`marketplace-dev-admin-authenticated-resource` signs no cookie and still requires the KEK: it hosts the
rotation and retirement mutations, which mint and reseal the record (the admin session console; `src/index.mts:65-71` says why
it is required at boot rather than at first use). The other three `*-resource` services —
`authenticated-resource`, `public-resource`, `user-authenticated-resource` — sign nothing, rotate nothing
and **must not** carry it. They still refuse to boot without the *record* §8 seeds, which is a different
question from holding the key that opens it: they check that it is there and never unwrap it. This line read "five" until 2026-08-13, when starting the whole stack for the
first time found the sixth by refusing to boot — see
[`docs/report/live-auth-path-observation.md`](./docs/report/live-auth-path-observation.md) §6.

**Six is not the number of rows in `<REDIS_KEY>keygrip:holders`, which is five.** A holder row is filed
by a service that *signs*; `admin-authenticated-resource` opens the record without signing with it. The
two counts answer different questions and both are correct.

⚠️ **Running this somewhere that is not your workstation?** Everything in this section is a *development*
recipe by design — generate locally, paste by hand, nine services on one machine — and it stays one. The
swap points for all three values that page covers — these two plus `REDIS_PASSWORD`, which is a
datastore credential rather than a cross-repo agreement — and the invariants a swap must not break, are in
[`docs/PRODUCTION_HARDENING.md`](./docs/PRODUCTION_HARDENING.md). No vendor is named there, deliberately:
[`ADR-040`](./docs/devprotocol/phase3/adr/ADR-040-the-secrets-manager-vendor-choice-is-the-adopters.md).

⚠️ **`KEYGRIP_KEK` is not a signing key**, and the difference matters when something goes wrong. The
signing keys themselves are never in an `.env` file: they are minted into Redis by `yarn seed:keygrip` in
§8 and read from there at boot. This value only opens that record. Losing it is recoverable — re-seed
with `--force` and everyone signs in again; losing it is *not* the CSFLE situation in §4.

⚠️ **One value, one line.** dotenv ends a value at the newline *even inside quotes*, hands back the
truncated prefix and reads the tail as a variable of its own — silently, in both halves. An 88-character
key is exactly long enough for an editor to wrap it, which is how all five `.env` files holding the old
`KEYGRIP_KEY_1`/`_2` pair were once found broken. `.githooks/pre-commit` check 0 blocks a commit in a
repo whose `.env` has that shape. To check by hand, list key names only — anything in the output that is
not `SCREAMING_SNAKE_CASE` is the tail of a wrapped value on the line above:

```bash
grep -oE '^[A-Za-z_0-9]+' .env
```

Also quote any value containing whitespace, with **single** quotes — dotenv expands `\n` and `\r` inside
double quotes.

---

## 6. Build the shared library

```bash
cd BEs/marketplace-common
cp env .env            # MONGODB_URI + the MONGO_TEST_* block (test db: dbMarketplaceTestCommon)
yarn install
yarn build
```

⚠️ **Nothing here has to reach the other repos, and nothing may be copied into them.**
`marketplace-common` is consumed by name from `registry.npmjs.org`, so every consumer gets it from its own
`yarn install` — this step builds the library for its own tests and gates, not for anybody else. An edit
made here reaches a consumer only when it is **published**: the nine-step release flow in
[`BEs/marketplace-common/CLAUDE.md`](./BEs/marketplace-common/CLAUDE.md). ⚠️ **`deploy-local.sh` is
deleted** — it used to copy `dist/` into every consumer's `node_modules`, which produced a build no
lockfile named and no other machine could reproduce. Rationale: ADR-015 for the consumption pattern,
[`ADR-037`](./docs/devprotocol/phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md) for the
publication,
[`ADR-047`](./docs/devprotocol/phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md) for why
the local copy is gone.

`yarn build` is ESM only. `build:all` / `prepare:all` are broken (missing `tsconfig.cjs.json`) — do not
reach for them.

---

## 7. Fill in the environment: one shared file, then sixteen `.env` files

Every repo ships a committed `env` template and reads a gitignored `.env` you create from it:

```bash
cp env .env
```

Sixteen of them: `marketplace-docker-DBs` (done in step 3), `BEs/marketplace-common` (step 6),
`BEs/marketplace-db-setup`, the nine services, the three frontends, and `marketplace-services-status`.

The templates are heavily commented and the comments are the real documentation for each variable —
read them rather than guessing. What follows is only what has to agree across files.

### 7a. The shared layer — do this first

Twenty of those variables name the *same* resource for every repo that reads them: one Redis cluster,
one MongoDB, one CSFLE master key, one cookie-signing KEK, one pair of test-cluster accounts. Written
sixteen times they are sixteen places to rotate a secret and sixteen chances for one repo to disagree with
the other fifteen — which is a platform that boots, connects to a real server, and is wrong
(`RISK_REGISTER` **R04**). They live once instead, in `.env.shared` at the workspace root, exported by one
`.envrc` that [direnv](https://direnv.net) loads ([`ADR-053`](./docs/devprotocol/phase3/adr/ADR-053-the-shared-half-of-the-environment-is-one-file.md)):

```bash
sudo apt install direnv                      # or: brew install direnv
# then add the hook to your shell rc, once, and open a new shell:
#   bash:  eval "$(direnv hook bash)"
#   zsh:   eval "$(direnv hook zsh)"
#   fish:  direnv hook fish | source

cp envrc .envrc && direnv allow              # from the workspace root
./scripts/env-shared-migrate.sh seed         # builds .env.shared from the repos, names only in its report
```

`seed` is safe to run before the sixteen `.env` files exist — it simply finds nothing and writes a
skeleton you fill in from the commented `env.shared` template. Run it *after* them and it collects what
they already hold, refusing by name any key the repos disagree on. Either way, read `env.shared`: it is the
documentation for every key in the layer, and its §What stays behind says why `PORT`, `DOMAIN`, `NODE_ENV`,
`QODANA_TOKEN`, `DSN` and the three keys naming each suite's test database are **not** in it.

⚠️ **A key every repo holds its own value for is reported PER-REPO, and the answer is never to unify it.**
`DSN` is the one that got through: it names one Sentry/Bugsink project, there is one per service, and the
nine committed templates all carry the same placeholder, which is what put it in the layer until
2026-09-02. Take such a key out of `env.shared` — each repo then keeps what it already had.

Then, once `.env.shared` is filled in:

```bash
./scripts/env-shared-migrate.sh strip        # dry run — shows which lines would go
./scripts/env-shared-migrate.sh strip --apply
./scripts/env-diff.sh                        # every migrated key should read SHARED, none MISSING
```

Four things to know before you rely on it:

- ⚠️ **One `.envrc`, at the workspace root, and never one inside a sub-repo.** direnv loads the *nearest*
  one walking up the filesystem and does not stop at a git boundary, so the root file is already in force
  in all sixteen repos. A second one would **replace** it for that subtree, silently.
- ⚠️ **The layer wins.** `dotenv` never overwrites an exported variable, so a key in `.env.shared` is
  answered there and that repo's own copy of it is dead text. Do not add a key that legitimately differs
  anywhere — it would not be a default, it would be a value that repo can no longer change.
- ⚠️ **An empty key in the layer is inert.** `.envrc` unsets every name `.env.shared` leaves blank, so a
  key you have no value for falls through to each repo's own `.env`. That is why `env.shared` is safe to
  copy verbatim, blanks and all.
- ⚠️ **Only a hooked interactive shell sees it.** A systemd unit, a cron job, an IDE run configuration or
  a container inherits nothing from `.envrc`. If you start the services any of those ways, either export
  the same names by that launcher's own mechanism or skip 7a entirely and keep a complete `.env` in every
  repo — the layer is additive, and the platform runs identically without it.

### 7b. The rest, per repo

The committed `env` templates keep **every** key, including the ones the layer now supplies: they answer
what a service reads, which is not the same question as where the value comes from. So the sections below
are written as though there were no layer, and each still tells you what a variable must be — if you did
7a, the ones marked "identical everywhere" are already answered and you can leave them out of the repo
files. `./scripts/env-diff.sh` tells you which is which at any point.

**Every backend service** — `MONGODB_URI`, one line, `<pwd>` being `MONGO_DEV_PWD` written out in full:

```
mongodb://marketplaceRwDev:<pwd>@mdb1:27017,mdb2:27018,mdb3:27019/dbMarketplaceDev?replicaSet=rs0&authSource=dbMarketplaceDev
```

**Redis**, in all nine, with `REDIS_KEY` identical everywhere:

```
REDIS_IS_CLUSTER=0
REDIS_URL=redis://default:<pwd>@127.0.0.1:6379
REDIS_KEY=marketplaceDev:
```

`REDIS_IS_CLUSTER=0` picks the single-client branch, which reads `REDIS_URL` and nothing else. Leave the
`REDIS_DB1_HOST` … `REDIS_USERNAME` block below it in place and empty. ⚠️ The templates ship
`REDIS_IS_CLUSTER=1` — the maintainer's cluster — so this is an edit, not a default.

⚠️ **On this branch `REDIS_URL` must have a value**, and `checkRequiredEnv()` refuses the boot without one.
It is not in any `REQUIRED_ENV_VARS` list because the cluster branch never reads it and the templates ship
it empty; the guard is therefore conditional, `REDIS_IS_CLUSTER !== '1'`, and lives just below the loop in
each service's `src/index.mts`. Left empty here, node-redis would answer with its own default of
`redis://localhost:6379` — so the service would connect to whatever happens to listen on this machine,
write every session into it and report itself healthy (`RISK_REGISTER` R04).

⚠️ **Do not set `REDIS_TLS` for a local setup.** `@axiumine/koa-utils@7.1.0` added it: set to exactly
the string `true` it builds cluster nodes as `rediss://`, carries TLS to the nodes discovered behind
them, and **refuses to boot** if `REDIS_URL` is not `rediss://`. The Redis this guide brings up serves
no TLS listener, so the flag would turn a working platform into nine services that fail at module load.
Unset — which is what every template ships, the variable appearing in none of them — is the off state,
and it is not in any `REQUIRED_ENV_VARS` because `checkRequiredEnv` rejects an empty value. It exists
for a deployment that terminates TLS on its Redis; the leg being cleartext here is **R45**.

**`BEs/marketplace-db-setup`** assembles its URL from pieces and injects the credentials itself, so its
connection string carries no user:

```
MONGO_DEV_CONN_STRING=mongodb://mdb1:27017,mdb2:27018,mdb3:27019/dbMarketplaceDev?replicaSet=rs0
MONGO_DEV_AUTH_ADMIN=dbMarketplaceDev
MONGO_DEV_DB=dbMarketplaceDev
MONGO_DEV_UDBOWNER=marketplaceOwnerDev
MONGO_DEV_URW=marketplaceRwDev
MONGO_DEV_PWD=<pwd>
SEED_DEMO=true
```

**The `MONGO_TEST_*` block**, in every repo that runs integration tests. Three variables name the same
database and all three must agree — the suite refuses to build a URL otherwise. Each repo's own test
database name is already filled into its template, and the full table is in
[`marketplace-docker-DBs/README.md`](./marketplace-docker-DBs/README.md) §Wiring the repos. `marketplace-dev-authenticated-logout` has no such block on
purpose: its integration suite never touches MongoDB.

**Email**, in `marketplace-dev-public-resource` only — it is the one service that sends mail:

```
APP_DOMAIN=http://127.0.0.1:3044          # shop-owner origin — where a ShopOwner's links point
APP_DOMAIN_USER=http://127.0.0.1:3045     # storefront origin — where a customer's links point
EMAIL_FROM=…  PLATFORM_NAME=…  DEV_TEAM_EMAIL=…
SOCKETLABS_SERVER_ID=…  SOCKETLABS_SERVER_APIKEY=…
```

⚠️ **`APP_DOMAIN_USER` unset falls back to `APP_DOMAIN`.** One process serves both audiences, and the
fallback is a working link to the wrong panel rather than a broken one — set both.

Five of those six are in `REQUIRED_ENV_VARS` and stop the boot when unset. `DEV_TEAM_EMAIL` is the
exception: its only readers are `SocketLabsLib`'s `alertDevTeam()` and `sendEmailPostReported()`, which
nothing calls today, so it is the one name here that can be missing without a single mail changing.
No other service takes any of the six — the same change removed them from the eight templates that
carried them for no reader.

Without SocketLabs credentials, registration still succeeds and the confirmation mail is not sent — see
step 12 for how to confirm an account without one.

**Error reporting** is opt-in and has three supported shapes. Every backend service reads `DSN`, every
frontend reads `VITE_SENTRY_DSN`, and nothing leaves the machine while those are empty.

**A — no error reporting. This is the default, and the right choice unless you want a collector.** Leave
`DSN` empty in the nine backend `.env` files and `VITE_SENTRY_DSN` empty in the three frontends. The SDK is
never initialised, no event is sent, and there is no certificate for anything to verify.

**B — the online Sentry service.** [`sentry.io`](https://sentry.io) run by Sentry themselves, nothing
installed on your side: create a project there, paste the DSN it hands you into `DSN`, done. Its certificate
chains to a public CA that Node already trusts, so there is nothing further to configure. ⚠️ Your exception
events leave your machine and land with a third party — read the scrubbing configuration in each `instrument`
file before pointing a real deployment at it, and treat the choice as a data-protection decision rather than
a setup step.

**C — a collector you run yourself.** [Bugsink](https://www.bugsink.com/) speaks the Sentry protocol and
runs locally; put the project DSN it gives you in `DSN`. Nothing leaves your machine. If you front it with
TLS using a certificate your system does not already trust, trust that certificate's CA — do not switch
verification off:

```bash
NODE_EXTRA_CA_CERTS=/path/to/dev-ca.pem yarn dev
```

⚠️ `NODE_EXTRA_CA_CERTS` appends to Node's **root** store, so it wants a CA certificate. A bare
`openssl req -x509` leaf is rejected by OpenSSL 3 as self-signed unless it carries
`basicConstraints=critical,CA:TRUE`. `mkcert` mints a proper local CA and is the shorter road.

> **Never disable certificate verification to make a collector reachable** — not with
> `NODE_TLS_REJECT_UNAUTHORIZED=0`, not with a `rejectUnauthorized: false` patch, not behind an
> `INSECURE=true` flag of your own. A boolean toggle travels inside a copied `.env` and downgrades a real
> deployment silently, with nothing failing to warn you; a path-valued variable either names a certificate
> that exists or the process refuses to start. The nine services shipped exactly such a patch once —
> `src/instrument.mts` forced `rejectUnauthorized = false` on the Sentry transport — and the
> shapes that would bring one back are now refused by the `no-restricted-syntax` block in each service's
> `eslint.config.js` rather than by review.

⚠️ **`NODE_ENV` is what labels the events, and an unset one is not neutral**. Each
`instrument.mts` passes `environment: process.env.NODE_ENV ?? 'unknown'`; without that option the SDK
falls back to `production`, so a Dev machine's events land in the bucket a real deployment's alerts are
built on. Nothing in `yarn dev` or `yarn start` sets it: the value comes from the `.env` you copied, where
the template already carries `NODE_ENV=development`. Leave that line in place, and set it deliberately on
anything deployed. The same variable already decides whether a service answers an introspection query
at all, so the two gates agree on what the box is.

Either way, this is the only outbound HTTPS these repos own besides SocketLabs mail, which verifies
certificates normally and is unaffected by both choices.

**The frontends** need almost nothing changed: the `VITE_GRAPHQL_ENDPOINT_*` paths in their templates
are already the `ENDPOINT` constants each service exports, and the vite proxy table maps them to the
right port. Leave `VITE_TURNSTILE_SITE_KEY` empty — with no server-side secret configured,
`guardPublicLogin` passes a missing token through outside production, so the two halves agree on "off".

---

## 8. Create the schema, the demo data and the cookie-signing keys

```bash
cd BEs/marketplace-db-setup
yarn install
yarn migrate:status      # every migration should read PENDING on a fresh database
yarn migrate:up
yarn seed:keygrip        # once per machine, BEFORE any service starts
```

This creates six collections with `$jsonSchema` validators and `additionalProperties: false`, all their
indexes, and — because `SEED_DEMO=true` is in `.env` — the demo dataset:

| Seeded | Value |
|---|---|
| admin (`admin`) | `info@example.com` |
| shop owner (`shopOwner`) | `shopOwner@example.com` |
| password for both | `1234567890` |
| company (the shop) | Northwind Trading Ltd |

⚠️ **Those are committed development fixtures, not credentials.** The bcrypt hash is in a public
migration file. Never seed anything reachable from outside your machine.

No customer is seeded and no items are — register a customer through the storefront, and add items from
the shop-owner panel.

**Migrations are immutable.** Never edit one that may already be applied; change a schema by adding a
new one. `yarn migrate:down` reverts exactly one migration, the last applied.

### `yarn seed:keygrip` — the record all nine services refuse to boot without

`yarn seed:keygrip` touches no collection. It writes **one Redis hash**, `<REDIS_KEY>keygrip`, holding
the cookie-signing key array sealed under `KEYGRIP_KEK` (ADR-034), and it prints the record's version and
fingerprint — never a key. Every service **exits 1 if it is missing**, naming this command, so running §9
first simply tells you to come back here. They do it for two different reasons, and both are on purpose:

- the four `*-authorization` services and `marketplace-dev-authenticated-logout` **open** it — `loadKeygrip`
  unwraps the keys under their `KEYGRIP_KEK` and files their row in `keygrip:holders`. No keys, no cookies;
- the four `*-resource` services **only look for it** — `assertRedisNamespace` reads one field and unwraps
  nothing, because three of the four hold no KEK and must not. This is a `REDIS_KEY` check wearing the
  record as its landmark: a prefix is a string Redis accepts whatever it says, so before this probe a
  resource service pointed at an unseeded namespace booted clean and then answered 401 to every request,
  for ever, reporting itself healthy.

It is deliberately not part of any service's start-up: a service that minted its own keys against an
empty Redis would re-key the whole fleet on every restart, which is the split-brain ADR-034 removes.

- **Run it once**, on a machine whose Redis has no such record. A second run reports what is already
  there and writes nothing.
- **`--force` replaces the record wholesale**, and every session cookie signed under the old keys stops
  verifying. Rotating a *live* key set is `keygripRotate` in the admin panel, not this script.
- **Upgrading a machine that already ran the old `KEYGRIP_KEY_1`/`_2` pair:** copy the two values into
  `marketplace-db-setup/.env`, run the seed once — it adopts them in order, so nobody is logged out —
  then delete them from that file and from all five service `.env` files. Nothing reads them afterwards.

Check the fleet agrees once the services are up (§9), one row per service, all carrying the same
fingerprint the seed printed:

```bash
redis-cli HGETALL "<REDIS_KEY>keygrip:holders"
```

---

## 9. Start the services and the frontends

Each is its own repo with its own `.env`. `yarn dev` is `tsc && tsx watch`.

```bash
cd BEs/dev/<service> && yarn install && yarn dev
```

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

A service refuses to start with a list of the `REQUIRED_ENV_VARS` its `.env` is missing.
`checkRequiredEnv` is `if (!env[envVar])`, so an **empty** value fails exactly like an absent one — which
is the fastest way to find a half-filled `.env`.

Then the frontends, which proxy their GraphQL paths to those ports:

```bash
cd marketplace-admin && yarn install && yarn dev
```

| App | Port | Audience | Proxies to |
|---|---|---|---|
| `marketplace-admin` | 3043 | `Admin` | 4024, 4025, 4028, 4030 |
| `marketplace-shopowner` | 3044 | `ShopOwner` | 4026, 4028, 4029, 4030 |
| `marketplace-user` | 3045 | anonymous + customer | 4027, 4028, 4030, 4031, 4032 |

**You do not need all nine.** The public site is 4027 + 4028; the customer account area adds 4031 +
4032; the shop-owner app is 4026 + 4028 + 4029; the admin app is 4024 + 4025 + 4028. `4030` is shared
and every authenticated surface needs it.

`marketplace-user` is SSR: `yarn dev` runs vite, and `yarn build && yarn start` runs `serve.mjs`, which
requires `PORT` and has no default.

⚠️ `./dev.sh` in the backend repos bind-mounts `node_modules` onto a tmpfs ramdisk, needs a sudoers
entry, and **wipes `node_modules` first**. Use plain `yarn dev` unless you know you want it.

---

## 10. nginx — only when you put this on a host

**You do not need nginx for local development.** Each frontend's vite proxy already puts the app and its
services on one origin, which is the only thing the session cookie requires.

You need it the moment this is served over a network, for one reason above the others:

⚠️ **`proxy_cookie_flags ~ secure httponly samesite=strict;` in `snippets/proxy-backend.conf` is the
only thing on the entire platform that sets `Secure` on the session cookie.** `koa-utils` ships
`secure: false` with a comment saying to rewrite it at the edge. Nothing else sets the flag, nothing
fails without it, and no test in any of the sixteen repos covers it — so a deployment without nginx in
front sends the session cookie marked as safe to replay over plain HTTP.

There is no nginx on the maintainer's machine either. The one way to execute any of this configuration
is the throwaway container in `test/`:

```bash
cd marketplace-nginx
./test/run.sh                                    # nginx -t, then the whole assertion suite
CONTAINER_ENGINE=podman ./test/run.sh            # podman instead of docker
NGINX_TEST_IMAGE=nginx:1.29-alpine ./test/run.sh # check a version bump before rollout
```

Read the **first** failure: `nginx -t` is a hard gate, and the behavioural sections keep going after a
failure, so one bad directive prints dozens of downstream ones.

To install on a real host — three vhosts, TLS terminating here and nowhere else, requires nginx ≥ 1.25.1:

```bash
sudo cp conf.d/*.conf          /etc/nginx/conf.d/
sudo cp snippets/*.conf        /etc/nginx/snippets/
sudo cp sites-available/*.conf /etc/nginx/sites-available/

for h in marketplace-domain.com shopowner.marketplace-domain.com admin.marketplace-domain.com; do
	sudo ln -sf /etc/nginx/sites-available/$h.conf /etc/nginx/sites-enabled/$h.conf
done

sudo mkdir -p /var/cache/nginx/marketplace-user /var/www/acme
sudo chown -R www-data:www-data /var/cache/nginx/marketplace-user
sudo nginx -t && sudo systemctl reload nginx
```

Certificates, one per host (the apex's covers `www` too):

```bash
sudo certbot certonly --webroot -w /var/www/acme -d marketplace-domain.com -d www.marketplace-domain.com
sudo certbot certonly --webroot -w /var/www/acme -d shopowner.marketplace-domain.com
sudo certbot certonly --webroot -w /var/www/acme -d admin.marketplace-domain.com
```

| Host | App | Root |
|---|---|---|
| `marketplace-domain.com` | public site + customer area | `/srv/marketplace-user/dist/client` + SSR on 3045 |
| `shopowner.marketplace-domain.com` | shop-owner panel | `/srv/marketplace-shopowner/dist` |
| `admin.marketplace-domain.com` | admin panel | `/srv/marketplace-admin/dist` |

Three hosts and not one, because the session cookie has no `Domain` attribute and is therefore
host-only — one host for all three tiers would put every tier's cookie in one jar. The full path →
service → port matrix, the seven nginx traps and the live-deployment verification commands are in
[`marketplace-nginx/README.md`](https://github.com/Axiumine/marketplace-nginx/blob/main/README.md).

---

## 11. Optional — the marketplace-services-status dashboard

Twelve processes started by hand is tedious. `marketplace-services-status` is a local control panel on port 2901
that starts, stops and restarts them as systemd **user** units and tails their journal.

```bash
cd marketplace-services-status
cp env .env
yarn install
yarn build
yarn systemd:install
```

`systemd:install` generates the units, copies them into `~/.config/systemd/user/`, reloads the daemon
and preflights every service — warning on a missing `.env` or `node_modules`. It refuses to run as root.
`yarn systemd:uninstall` reverses it and supports `--dry-run`.

**None of the twelve monitored processes may start at boot** — only from this page. That is a hard
requirement of its design, not a default you can flip.

---

## 12. Smoke test

1. **Admin** — <http://127.0.0.1:3043>, `info@example.com` / `1234567890`. You should see the
   seeded shop owner and be able to open Northwind Trading Ltd. Create a category here: category writes
   are Admin-only and the shop-owner app can only read them.
2. **Shop owner** — <http://127.0.0.1:3044>, `shopOwner@example.com` / `1234567890`. The company is
   already there; add an item to it, set a category, publish it.
3. **Storefront** — <http://127.0.0.1:3045>. The published shop and item should appear. Register a
   customer.

⚠️ **Step 3 needs a hand-published company, and always did.** The demo shop is seeded `published: false`
with no `slug`, `publicName` or `description` — the honest value, since the collection's
`PUBLISHED_IMPLIES_LINKABLE` `$expr` refuses `published: true` without the first two. Publishing a company
is `companyUpdatePublished` on either tier since 2026-08-14, and **no frontend calls it**: neither company
screen has ever carried a publish control, and neither has a box for the three public fields the `$expr`
wants. Both services accept them, so the gap is UI-only — but until those screens exist the whole step is a
shell one, and it must set the three fields **before or with** the flag, or MongoDB refuses the write:

```bash
cd marketplace-docker-DBs && ./shell.sh dev
# db.company.updateOne({_id:ObjectId('5c9a013fcf1448b9d885a000')},
#   {$set:{publicName:'Northwind Trading',slug:'northwind-trading',published:true}})
```

Publishing an **item** needs no such workaround — step 2's publish control calls `itemUpdatePublished`.

⚠️ **A customer cannot log in until `emailVerify.valid` is true**, and every login failure returns the
same generic error — an unconfirmed account is indistinguishable from a wrong password on purpose, so
nobody can use the login form to discover which addresses are registered. That is also why the login
screen offers "resend confirmation" unconditionally: it cannot say which accounts need it. With no
SocketLabs credentials the mail never arrives, so flip the flag by hand:

```bash
cd marketplace-docker-DBs && ./shell.sh dev
# db.user.updateOne({'login.email':'you@example.com'},{$set:{'emailVerify.valid':true}})
```

A shop owner awaiting approval, by contrast, **can** log in — `waitApprov` is set by an admin but no
login path reads it, and the integration suite asserts that. It is not a lockout.

---

## 13. Running the test suites

With the `MONGO_TEST_*` block filled in, `yarn test` and `yarn test:cov` work in every repo.

⚠️ **A reachable MongoDB is a prerequisite for *committing*, not only for testing** — coverage is a
pre-commit gate in fourteen repos. Everything is at 100% on all four coverage metrics and mutation score
100. A failing threshold means a missing test, never a threshold to lower.

Which gate runs when: [`README.md`](./README.md) §Test quality gates. Bypasses exist (`SKIP_QODANA=1`, `--no-verify`)
and are gate removals — use them only when you have decided to.

---

## 14. When it does not work

| Symptom | Cause |
|---|---|
| `Server selection timed out`, containers healthy | the `/etc/hosts` line is missing. The driver resolved the seed, then re-dialled `mdb1` / `mdb2` / `mdb3` as advertised |
| `MongoServerError: not primary` | an election is in flight; retry. If it never settles, `docker compose logs mdb1` — a node whose clock is far off never wins one |
| `Authentication failed` in a suite | `MONGO_TEST_AUTH_ADMIN` is `admin`. It must be the test database itself |
| `up.sh` stops at `Unauthorized` on the root user | a root user already exists with a different password than `.env` now holds. Restore the old value or `./down.sh --purge` |
| `permission denied` on `/etc/mongo/keyfile` at startup | the image was built before `secrets/mongo-keyfile` existed. `docker compose build --no-cache` then `./up.sh` |
| a service exits at boot naming one missing variable | that `.env` is incomplete. `checkRequiredEnv()` throws on the *first* one it finds, so fixing it can uncover a second — and an empty value counts as missing |
| a service behaves as though an edit to `marketplace-common` never happened, and nothing errors | that edit was never published. A consumer runs the version its `yarn.lock` names and nothing else (ADR-047) — cut a release, then move that consumer's range and re-install |
| `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@axiumine/marketplace-common' imported from …` | the package is genuinely absent from that consumer's `node_modules` — run `yarn install` there. It resolves from `registry.npmjs.org` since `ADR-037`, and that install is the only thing that puts it back |
| a service exits with `KEYGRIP_RECORD_MISSING` | §8's `yarn seed:keygrip` has not run against this Redis, or `REDIS_KEY` points somewhere else. Both halves of §8 raise it: the five that open the record and the four that only check it is there |
| a service exits with `KEYGRIP_KEK_MISMATCH` | its `KEYGRIP_KEK` is not the one the record was written under. The keys are fine; this one `.env` is wrong |
| every login returns 401 after a refresh | the five cookie services are not on the same keygrip record. `HGETALL "<REDIS_KEY>keygrip:holders"` — every row must carry the same fingerprint. A stale row means that service has not been restarted since a rotation |
| a session is never found although login succeeded | `REDIS_KEY` differs between two services. It must be byte-identical in all nine |
| a bogus key name in `grep -oE '^[A-Za-z_0-9]+' .env` | a wrapped value on the line above it |
| the migration suite drops the wrong database | it refuses to — `buildTestMongoUrl` throws when `MONGO_TEST_DB` equals the database `MONGODB_URI` points at. Fix `.env` |
| a git hook does nothing at all | `core.hooksPath` is unset (parent and `marketplace-nginx` have no `prepare` script), or the hook is not executable — git skips a non-executable hook with only a hint |

---

## Where to read next

| Topic | File |
|---|---|
| services, ports, auth model, resolver layout | [`docs/architecture.md`](./docs/architecture.md) |
| the cluster, per-repo `.env` wiring, the full test-database table | [`marketplace-docker-DBs/README.md`](./marketplace-docker-DBs/README.md) |
| collections, validators, indexes, migrations, PII encryption | [`docs/data-model.md`](./docs/data-model.md) |
| git rules, secrets, hooks, the full command list | [`docs/workflow.md`](./docs/workflow.md) |
| the edge — three vhosts, TLS, the `Secure` rewrite | [`marketplace-nginx/README.md`](https://github.com/Axiumine/marketplace-nginx/blob/main/README.md) |
| **why** any of this is the way it is | [`docs/devprotocol/phase3/adr/ADR-INDEX.md`](./docs/devprotocol/phase3/adr/ADR-INDEX.md) |

## License

GPL-3.0-or-later — see [LICENSE](./LICENSE).
