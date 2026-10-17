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

## Why the mongod base image is pinned by digest

**The `Dockerfile` reads `FROM mongo:${MONGO_TAG}@sha256:…`.** A tag is mutable — `mongo:8.0` is re-pointed at
each patch release, and again whenever the same patch is rebuilt on a newer base image, with no patch change
at all — and OpenSSF Scorecard's Pinned-Dependencies check penalises an unpinned `FROM` for exactly that
(the gate on that score is ADR-054). The digest is the multi-arch **index** of `mongo:8.0`, not one platform's manifest, so an arm64
host still builds. Pin `8.0`, not `8.0-noble`: the two indexes differ.

**The tag stays in the reference, but only the digest selects the image.** Docker resolves a reference
carrying both by the digest alone: `mongo:no-such-tag@sha256:…` pulls fine. So a `MONGO_TAG` that disagrees
with the digest would build the pinned image under the wrong name (`marketplace-mongod:8.2` holding 8.0.x).
The `RUN` after `FROM` compares `mongod --version` with `MONGO_TAG` (a `-noble`-style suffix is stripped) and
fails the build on a mismatch. The series is therefore changed by editing `MONGO_TAG` and the digest together.
The check is of the **series** only, so it is a tripwire and not proof: `MONGO_TAG=8` and an exact patch with
a suffix such as `8.0.34-noble` both pass without selecting a different image. Only the digest does that.

**Refreshing the digest is a hand-edit.** Dependabot's Dockerfile parser does not resolve an `ARG` inside a
tag, so the docker entry in `.github/dependabot.yml` finds nothing on this line. Read the new digest, check
that `mongo:8.0` and the exact-patch tag you expect (for example `mongo:8.0.34`) agree on it, confirm the
index lists `linux/amd64` and `linux/arm64` (the same command without `--format` prints the platforms), and
replace the one in the `Dockerfile`:

```sh
docker buildx imagetools inspect mongo:8.0 --format '{{.Manifest.Digest}}'
```

Always read the digest yourself with the command above. A digest copied from a Scorecard result is the one the
viewer showed as of its last scan, which can already be behind the tag.

**What the next `./up.sh` does after a bump.** It runs `docker compose up -d --build`. The build produces a new
`marketplace-mongod` image, and compose recreates a container whose image no longer matches the one it was
created from. `docker-compose.yml` declares no `depends_on` among `mdb1`–`mdb3` and nothing else sequences them,
so this is not a rolling restart that keeps a majority up: until the recreated nodes are back the replica set
can be without a primary. `up.sh` then waits for the three nodes and for a primary (that last wait gives up
after two minutes). The named volumes persist, so the data and the users survive. Do a bump while the cluster
is idle.
