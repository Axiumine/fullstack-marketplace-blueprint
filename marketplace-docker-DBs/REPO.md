# marketplace-docker-DBs — reference

The rationale, history and reference detail that [`CLAUDE.md`](./CLAUDE.md) used to carry inline. Nothing
here changes a rule — the rules themselves stay in `CLAUDE.md`; this is the "why" and the worked-out
detail behind them. Most of what used to be here duplicated [`README.md`](./README.md) almost exactly
(the Redis password/mode-444 story, the CSFLE master-key story, why `rbac-probe.sh` exists, why the
cluster is three nodes and not one, why this stack is dev-only) — that content was left where it already
lived instead of being copied a second time; the `/etc/hosts` and `authSource` traps and the "one value,
one line" `.env` trap are named in `CLAUDE.md`'s "What will bite you here" list, which points into
`README.md` itself for the detail.

## Why every container carries the logging anchor

**Every container carries `logging: *logging` — 20 MiB × 5 files.** Docker's default is `json-file` with
an empty options object, which never rotates: `marketplace-mdb1` reached 229 MiB in 52 hours of ordinary
development. A new service added to this compose file gets the anchor too, or it is the one unbounded log
again.

**Rotation is not retention.** The pair bounds how big a log gets; nothing here has decided how long its
content may be kept, and the 14-day answer of 2026-08-11 is the *edge's*, not this stack's.
