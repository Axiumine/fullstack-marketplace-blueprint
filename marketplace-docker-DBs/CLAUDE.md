# marketplace-docker-DBs

The local MongoDB replica set (`rs0` — `mdb1` 27017 / `mdb2` 27018 / `mdb3` 27019) and the optional
Redis the nine services keep their sessions in. Not a repo of its own — a tracked directory of the
parent workspace, so a change here commits under the parent's rules.

**Read parent first** — [`../CLAUDE.md`](../CLAUDE.md)

| Need | File |
|---|---|
| running the cluster, `.env` wiring per repo, troubleshooting table | [`README.md`](./README.md) |
| the order the whole platform boots in | [`README.md`](./README.md) §Running the whole platform |
| why the master key is one file for every repo | [`docs/devprotocol/phase3/adr/ADR-029-pii-at-rest-explicit-csfle.md`](../docs/devprotocol/phase3/adr/ADR-029-pii-at-rest-explicit-csfle.md) |

Scripts: `./up.sh [--with-redis]` · `./shell.sh [root\|dev\|owner]` · `./down.sh [--purge]`.
`up.sh` is idempotent — it mints the keys once, initiates `rs0` once and checks every user before
creating it, so re-running it is the normal way to bring the cluster back after a reboot. Do not
write a second script that does part of its job.

## What will bite you here

⚠️ **`.env` and `secrets/` are secret-bearing — never read, echo, diff or commit them.** `env`
without the dot is the committed template and is safe. To answer "is X set", print key names only:
`grep -oE '^[A-Za-z_0-9]+' marketplace-docker-DBs/.env`.

⚠️ **The Redis password lives in `secrets/redis.conf`, which `up.sh` rewrites on every run**.
It is not in `command:` any more — interpolating it there put it in the container's argv, where
`docker inspect` and `docker ps --no-trunc` printed it. Three consequences for anyone editing here:
`.env` stays the single source of truth and a password change needs `./up.sh --with-redis`, not a
container restart; the file is mode **444 on purpose**, because `redis-server` reads it as uid 999
through a root-owned bind mount and a 400 host-owned file is `can't open config file` there, with the
700 on `secrets/` as the real host-side control; and `docker compose --profile redis up` run by hand
before the script has written the file makes Docker create a *directory* in its place, which then
kills the container on every start until it is removed.

⚠️ **`secrets/csfle-master-key` has no escrow.** Every encrypted field on the cluster is unreadable
the moment it is lost, and every repo must point at that same file — a migration run against a
different key mints data keys the platform cannot use. `./down.sh --purge` leaves `secrets/` alone
deliberately; never "tidy" that directory.

⚠️ **`./down.sh --purge` deletes every database and every user on the cluster.** Destructive and
not reversible from here — ask before running it, and never as a step in a larger fix.

⚠️ **The compose project name is `marketplace-dbs` and it prefixes the volumes and the network.**
Changing it does not migrate them: compose stops seeing the old volumes and the cluster comes back
empty. Rename only with a purge planned, or move the volumes by hand first.

- **Three nodes, not one `mongod`, and not a single-node set.** Transactions, change streams and
  `readConcern: majority` need a replica set; the code is written against three, so elections and
  stepdowns behave here the way they do on the real cluster.
- **The three `/etc/hosts` names are a host-side prerequisite, not a container concern.** Without
  `127.0.0.1 mdb1 mdb2 mdb3` a driver connects, reads the advertised topology and then times out on
  every operation. That symptom is almost always this cause.
- **Each account is scoped to one database and authenticates against it** — `authSource` is never
  `admin`. `MONGO_TEST_AUTH_ADMIN` equal to `admin` is the bug behind `Authentication failed` in a
  suite, and the per-repo test database names are the table in [`README.md`](./README.md) §Wiring the repos.
- **One value, one line in any `.env`.** dotenv truncates at the newline even inside quotes and
  reads the tail as its own variable; the parent `.githooks/pre-commit` check 0 blocks that shape.
- **Every container carries `logging: *logging` — 20 MiB × 5 files**. Docker's default is
  `json-file` with an empty options object, which never rotates: `marketplace-mdb1` reached 229 MiB in
  52 hours of ordinary development. A new service added to this compose file gets the anchor too, or
  it is the one unbounded log again. ⚠️ **Rotation is not retention.** The pair bounds how big a log
  gets; nothing here has decided how long its content may be kept, and the 14-day answer of
  2026-08-11 is the *edge's*, not this stack's.
- **Dev only, by design.** Ports bind `127.0.0.1`, there is no TLS and only a `Dev` environment
  exists on this platform. Do not add a staging or production profile here.
