# marketplace-docker-DBs

The local MongoDB replica set (`rs0` — `mdb1` 27017 / `mdb2` 27018 / `mdb3` 27019) and the optional
Redis the nine services keep their sessions in. Not a repo of its own — a tracked directory of the
parent workspace, so a change here commits under the parent's rules.

**Read parent first** — [`../CLAUDE.md`](../CLAUDE.md)

| Need | File |
|---|---|
| running the cluster, `/etc/hosts`, `.env` wiring per repo, troubleshooting table, Not-for-production | [`README.md`](./README.md) |
| the order the whole platform boots in | [`README.md`](./README.md) §Running the whole platform |
| the per-service MongoDB roles, RISK_REGISTER R24, and the probe that proves them | [`README.md`](./README.md) §One account for nine services |
| Redis version floor, hash-field TTLs, the `redis.conf` password story | [`README.md`](./README.md) §Redis |
| the CSFLE master-key wiring | [`README.md`](./README.md) §CSFLE |
| why the master key is one file for every repo | [`ADR-029`](../docs/devprotocol/phase3/adr/ADR-029-pii-at-rest-explicit-csfle.md) |
| logging-rotation history and other reference detail this file used to carry | [`REPO.md`](./REPO.md) |

Scripts: `./up.sh [--with-redis]` · `./shell.sh [root\|dev\|owner]` · `./down.sh [--purge]` ·
`./rbac-probe.sh`. `up.sh` is idempotent (README §Quick start) — re-running it is the normal way to
bring the cluster back after a reboot. Do not write a second script that does part of its job.

## What will bite you here

⚠️ **`.env` and `secrets/` are secret-bearing — never read, echo, diff or commit them.** `env`
without the dot is the committed template and is safe. To answer "is X set", print key names only:
`grep -oE '^[A-Za-z_0-9]+' marketplace-docker-DBs/.env`.

⚠️ **Nothing under `secrets/` is edited by hand.** `up.sh` rewrites the Redis conf on every run, at
mode 444 on purpose. The CSFLE master key is minted **once**, not rewritten, and has no escrow
anywhere — re-minting it would orphan every already-encrypted field (README §Redis, §CSFLE, ADR-029).
`./down.sh --purge` leaves `secrets/` alone deliberately; never "tidy" that directory.

⚠️ **`rbac-probe.sh` is not `up.sh`'s little brother and provisions nothing.** It builds a throwaway
database, role and user, asserts the granted/ungranted shape in both directions, and drops all three
on exit. It never touches `dbMarketplaceDev`. README §One account for nine services has the why
(RISK_REGISTER R24) — change `init/roles.js`, then run this before trusting the new shape.

⚠️ **`./down.sh --purge` deletes every database and every user on the cluster.** Destructive and not
reversible from here — ask before running it, and never as a step in a larger fix.

⚠️ **The compose project name is `marketplace-dbs` and it prefixes the volumes and the network.**
Changing it does not migrate them: compose stops seeing the old volumes and the cluster comes back
empty. Rename only with a purge planned, or move the volumes by hand first.

⚠️ **Every container needs the `logging: *logging` anchor (20 MiB × 5 files).** Docker's default
never rotates — see [`REPO.md`](./REPO.md) for the incident that this anchor exists to prevent.
Rotation is not retention: nothing here decides how long the kept logs may live.

- **Three nodes, not a single-node replica set** — transactions, change streams and
  `readConcern: majority` need it; README's intro has why three rather than one.
- **Dev only, by design.** Ports bind `127.0.0.1`, no TLS, only a `Dev` environment exists on this
  platform (README §Not for production). Do not add a staging or production profile here.
- **The three `/etc/hosts` names are a host-side prerequisite, not a container concern.** Without
  `127.0.0.1 mdb1 mdb2 mdb3` a driver connects, reads the advertised topology and then times out on
  every operation — that symptom is almost always this cause (README §Prerequisites, §Troubleshooting).
- **Each account is scoped to one database and authenticates against it — `authSource` is never
  `admin`.** `MONGO_TEST_AUTH_ADMIN` set to `admin` is the bug behind `Authentication failed` on a
  test suite (README §Wiring the repos, §Troubleshooting).
- **One value, one line in any `.env`.** dotenv truncates at the newline even inside quotes and reads
  the tail as its own variable, silently (README §Wiring the repos).
