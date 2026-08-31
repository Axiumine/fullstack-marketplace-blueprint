# ADR-039 — The production topology, decided: Cloudflare at the edge, one app host, datastores on a trusted LAN segment
# Marketplace

**Status:** accepted
**Date:** 2026-08-28
**Deciders:** platform owner, answering the four questions [`ADR-032`](./ADR-032-production-topology-owed.md)
listed as owed, and declaring the LAN segment between the application host and the datastore host trusted
**Supersedes:** [`ADR-032`](./ADR-032-production-topology-owed.md) — which recorded the topology as owed and
forbade any control from assuming a boundary. The prohibition is narrowed here, not lifted; see §Decision
**Superseded by:** —

---

## Context

[`ADR-032`](./ADR-032-production-topology-owed.md) recorded the production topology as a decision this
platform **owed**, gave it an owner, and made one rule while it stayed unwritten: *no control may be argued
closed by appeal to a network boundary*. It also named what the answer would have to contain — which ports
are reachable from where, what sits in front of the nine services, where Redis and MongoDB live relative to
them and whether that leg leaves the host, and whether `marketplace-nginx` is the outermost hop.

Those four are answered here. The platform owner stated the placement and the enforcement on 2026-08-28,
and — asked what makes the unencrypted Redis leg acceptable — declared the segment carrying it **trusted**.
That sentence is the one ADR-032 exists to make writable: *"it is behind a firewall anyway"* was forbidden
as an unwritten assumption, and is permitted here as a written decision with a name and a date on it.

What was already recorded, and is unchanged:

- **The edge, in full.** `marketplace-nginx/sites-available/` carries three vhosts — apex,
  `shopowner.`, `admin.` — terminating TLS and proxying **eleven loopback upstreams**
  (`conf.d/10-upstreams.conf`): the nine backend services, the SSR renderer on `3045`, and Nominatim on
  `8080`. `snippets/origin-pull.conf` already sets `ssl_verify_client on` against
  `/etc/nginx/certs/origin-pull-ca.pem`, and `conf.d/06-real-ip.conf` is the only place a client address is
  taken from `CF-Connecting-IP`. Both presume something in front; this ADR says what.
- **The bind addresses** ([`ADR-022`](./ADR-022-wildcard-bind-services-loopback-ssr.md)): the nine services bind the
  wildcard address deliberately, and `marketplace-user`'s SSR server binds `127.0.0.1` so nobody reaches
  `3045` without passing the edge. Nothing here changes either.
- **`marketplace-docker-DBs/` is dev-only by its own decision** — ports on `127.0.0.1`, no TLS, and an
  explicit instruction not to add a staging or production profile. It describes this workstation, never a
  deployed platform, and this ADR does not turn it into one.

Two facts about the wire matter to what follows, and both are measured rather than assumed:

- **Redis is cleartext on every leg this ADR describes** (**R45**, open). `@axiumine/koa-utils@7.1.0`
  (2026-08-28) reads the cluster scheme from a `REDIS_TLS` flag and the ten dependent repos are on
  `^7.1.0`, so the package no longer hardcodes it — but **the flag is set nowhere, and the dev Redis
  serves no TLS listener**, which is why nothing in the decision below moves. What was measured on the day
  this ADR was accepted, under `@axiumine/koa-utils@7.0.0`: `dist/dataSources/Redis.mjs:9-11` builds the
  cluster rootNodes as `redis://${REDIS_DB{1,2,3}_HOST}:${…_PORT}`, and every service `env` selects that
  branch with `REDIS_IS_CLUSTER=1`. The session hash — `_id`, `email`, `tier` — the session keys, and the
  `AUTH` that carries `REDIS_PASSWORD` all cross that leg in the clear.
- **MongoDB is cleartext today by configuration, not by constraint.** The dev `MONGODB_URI` ends
  `?ssl=false`. Unlike Redis, nothing upstream prevents `ssl=true` — the driver supports it and no
  published package hardcodes the scheme. CSFLE keeps 30 field paths encrypted end to end regardless
  ([`ADR-029`](./ADR-029-pii-at-rest-explicit-csfle.md)); everything outside those paths, including
  every query predicate, is plaintext on that leg.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — keep ADR-032's *owed* state | Costs nothing today; keeps every control sized for a hostile network | The topology now exists as an intention the owner can state. Leaving it unwritten means the first deploy defines it by accident — the exact revisit condition ADR-032 names |
| **B — record the topology as stated, and the segment's trust as a decision** | Answers all four questions ADR-032 listed; closes **R46**; gives **R45** a real boundary and an honest residual; unblocks ADR-034's option E, which could not be chosen before *where any of this runs* had an answer | The trust is declared, not proven: no probe verifies segment membership, so the claim is exactly as good as the security-group rules behind it. That is written into the decision rather than left implied |
| C — decide the topology, but block deployment on encrypting the Redis leg first | Removes the platform's largest cleartext exposure before it can ever exist in production | The fix is not in this workspace: it needs a `@axiumine/koa-utils` release that allows `rediss://`, plus TLS on the cluster itself. Gating a topology decision on an upstream release leaves the topology undescribed in the meantime, which is the state ADR-032 already judged worse. ⚠️ **The upstream half arrived hours after this ADR was accepted** — `@axiumine/koa-utils@7.1.0` (2026-08-28) reads the cluster scheme from a `REDIS_TLS` flag and the ten dependent repos are on `^7.1.0` — **and the option stays rejected**: the listener and its certificates did not arrive with it, so gating on the leg would leave the topology undescribed today for the same reason it would have then (**R45**) |
| D — zero trust: mTLS on every leg, no trusted segment at all | The strongest posture, and it never has to be revisited when a host moves | Same upstream blocker for Redis, plus certificate lifecycle for legs nobody has deployed yet. It would be a specification written ahead of an admin — the failure mode ADR-032's option B was rejected for |

---

## Decision

Option **B**. The production topology is as follows, and it supersedes ADR-032's *owed* state.

### 1. Cloudflare is the outermost hop

Public DNS resolves to Cloudflare; the origin accepts Cloudflare and nothing else. Authenticated Origin
Pulls are already configured — `ssl_verify_client on` against the Cloudflare CA — so a request that reaches
the origin without Cloudflare's client certificate is refused at the TLS handshake. `marketplace-nginx` is
the second hop, and the only one that terminates a connection from outside the platform.

This makes **R44**'s premise correct as written: when the origin-pull client certificate expires, all four
443 blocks stop accepting Cloudflare and every hostname becomes unreachable. That row keeps its score.

### 2. One application host

nginx, the nine backend services (`4024`–`4032`), the SSR renderer (`3045`, loopback-bound) and the two SPAs
(`marketplace-admin`, `marketplace-shopowner` — static files served by nginx, which is why they are not
upstreams) run on a single host. The eleven upstreams are reached over loopback.

**ADR-022's wildcard bind stays.** The services still answer on every interface of that host; what closes
them is not the process.

### 3. Closure is a cloud security group

Inbound to the application host is default-deny at the provider. Open: `443` (and `80` for the redirect)
from Cloudflare's ranges. Closed: every service port and every frontend port. There is no host-level
firewall in this decision and none is required by it; the security group is the mechanism, and it is the
thing to inspect when the question "who can open a TCP connection to 4029" is asked again.

### 4. Datastores live on a separate host, on a private LAN segment — and that segment is trusted

The Redis cluster and the MongoDB replica set run on their own host, reachable only across a private LAN
segment. Inbound to `6379` and `27017`–`27019` is permitted from the application host's security group and
from nowhere else.

**The segment is declared trusted by the platform owner, 2026-08-28.** In plain terms: traffic between the
application host and the datastore host is treated as not requiring transport encryption, and that is what
the unencrypted Redis leg now rests on.

The trust is a **decision, not a measurement**, and three consequences follow from saying so out loud:

- It is exactly as strong as the security-group rules and the segment's membership list. Nothing in these
  sixteen repos tests either, and nothing can.
- Anything that gets a foothold inside the segment — a third host added to it, a compromised process on
  either box, a security-group rule widened by someone in a hurry — reads every session hash and the Redis
  password off the wire. That is the residual **R45** keeps.
- MongoDB's leg is covered by the same declaration, but by choice rather than necessity: `ssl=true` costs
  nothing upstream. Turning it on is a follow-on the owner may take at any time and this ADR does not
  require it.

### 5. What ADR-032's rule becomes

ADR-032 forbade closing any control by appeal to a network boundary. That prohibition is **narrowed, not
lifted**:

- **Every mitigation written to hold with the port open stays exactly as it is.** Specifically, the
  `NODE_ENV` allowlist on the introspection bypass
  (`BEs/marketplace-common/src/others/isIntrospectionBypassAllowed.mts`, a re-export of the koa-utils
  implementation since `marketplace-common@2.0.0`, and described in `phase3/SECURITY_AUTH.md` §3.6) and
  the pre-lookup limiter on `refresh` (`BEs/marketplace-common/src/others/refreshRateLimit.mts`, scored as
  `phase5/RISK_REGISTER.md` R52) are not weakened, relaxed or made configurable by this ADR. The hashed
  session keys likewise.
- **A boundary may now be cited — as a second layer, for the legs described above, and never alone.** A
  control whose entire argument is "the port is closed" is still not a control. What changed is that a
  residual score may now account for the boundary, because the boundary is written down and attributable.
- **Anything outside the two hosts and the one segment described here is still unwritten**, and ADR-032's
  rule applies to it unchanged.

### 6. The four findings ADR-032 required this ADR to name

| Finding | State after this ADR |
|---|---|
| **R46** — production topology undescribed (3 × 4 = 12, 🟠 High) | **Closed.** This is the document it was waiting for |
| **R45** — Redis traffic unencrypted (2 × 4 = 8, 🟡 Medium) | **Open, re-scored to 1 × 4 = 4 (🟢 Low).** Impact is unchanged — session material in the clear is session material in the clear. Likelihood drops because reaching that leg now requires a foothold inside a trusted segment or a mis-scoped security group, rather than any position on a network nobody had described. It closes only when the leg is encrypted: a `@axiumine/koa-utils` release that allows `rediss://`, plus TLS on the cluster. ⚠️ **The first arrived on 2026-08-28** — `7.1.0`, hours after this table was written — **and the row still does not close**, because the second did not: no listener, no certificates, and `REDIS_TLS` set nowhere |
| **The introspection bypass** — refused outside development | `built`, unchanged. The gate is the control; the boundary bounds its blast radius and does not replace it |
| **R52** — `refresh` floodable with distinct garbage tokens | `built`, unchanged. The limiter is the control; Cloudflare in front bounds arrival volume and does not replace it |

### 7. What this ADR does **not** answer

Still open, and still owned by the platform owner — `INFRA.md` §14 keeps the rows:

- Node counts, instance sizing and the failover story for both datastores (§14 q5, q6). Placement is
  decided here; capacity is not.
- Process supervision for the twelve processes — systemd, pm2, containers (§14 q9).
- Secrets provisioning outside a developer's `.env` (§14 q8). **ADR-034's option E — a secrets manager —
  is unblocked by this ADR**, which was explicitly waiting on "where any of this runs", but choosing it is
  a separate decision.
- Where the sixteen repos are hosted, and whether CI/CD exists (§14 q1, q2).
- Backups, restore drills and retention for either datastore.

**R39** (production topology entirely undesigned) therefore shrinks to those five and stays open.

---

## Consequences

### Positive
- The three findings ADR-032 bound together stop sharing an unstated assumption. Two of them
  (**R45**, **R46**) get a residual a reviewer can check, and the check is a security-group rule set
  rather than a belief.
- ADR-034's option E becomes choosable, which is the one thing standing between `KEYGRIP_KEK`,
  `INTROSPECTION_CODE` and `REDIS_PASSWORD` and a provisioning story that is not "copy it by hand into
  nine files".
- The edge configuration that already exists — origin pull, real-IP from Cloudflare — stops being
  configuration whose premise is undocumented.

### Negative
- The platform now has a written boundary, and written boundaries get leaned on. The narrowing in §5 is
  the only thing keeping the next mitigation honest, and it is prose, not a gate.
- **R45 stays open at a lower score rather than closing**, which will read as an unclosed item in every
  review until an upstream release makes `rediss://` reachable. That is accurate: the traffic really is in
  the clear. ⚠️ **The upstream release landed the same day (`7.1.0`) and the item is still unclosed** —
  the reason moved from a package that forbade TLS to a deployment that has to serve it, which is a
  cheaper problem and not a solved one.
- The topology is now a specification, with the failure mode ADR-032 named for option B — a control sized
  against a network nobody has deployed yet. The difference is that the owner stated this one rather than
  an author inventing it, and the revisit conditions below say when it must be re-checked against reality.

### Risks
- **Risk:** the first deployment does not match this document — the datastores land on the app host, or the
  segment carries a third tenant. Revisit condition: any host provisioned for production; this ADR is
  re-read against what was built, and amended by a superseding ADR if it disagrees.
- **Risk:** "trusted segment" is quoted later as though it were verified. Revisit condition: any risk row,
  ADR or story that cites the trust without also citing the security group that implements it.
- **Risk:** a koa-utils release adds `rediss://` and nobody notices, leaving R45 open when it could close.
  Revisit condition: any `@axiumine/koa-utils` major or minor bump — the dependency-bump assertion on the
  connection scheme is the tripwire that already exists for this. ⚠️ **Fired 2026-08-28 on the `7.0.0` → `7.1.0`
  minor bump**, which is the condition written here, and the revisit happened: R45 rewritten (register
  v1.37), `docs/architecture.md` corrected, the assertion retargeted. R45 could not close on it — the
  release supplies the client half only.
- **Risk:** the security group is widened for an operational reason and the trust declaration silently stops
  describing the network. Revisit condition: any change to the datastore host's inbound rules.

---

## Compliance

Nothing here is executable, so the checks are link integrity and the absence of the weakening this ADR
makes possible. From the workspace root:

```bash
grep -rn 'ADR-032\|ADR-039' docs/ | sort
```

`ADR-032` must still resolve — it is superseded, not deleted, and the reasoning for the rule that survives
in §5 lives there. `ADR-039` must appear in **R39**, **R45** and **R46** in
[`RISK_REGISTER.md`](../../phase5/RISK_REGISTER.md), in §5 and the table of
[`ADR-INDEX.md`](./ADR-INDEX.md), and in the Redis-transport section of
[`architecture.md`](../../../architecture.md).

The second check is that the two controls named in §6 still exist and are still unconditional:

```bash
grep -n "export" BEs/marketplace-common/src/others/isIntrospectionBypassAllowed.mts
grep -n "guardRefreshAttempt\|REFRESH_ATTEMPT_WINDOW_SECONDS" BEs/marketplace-common/src/others/refreshRateLimit.mts
```

The first must stay a single bare re-export of `@axiumine/koa-utils/lib/isIntrospectionBypassAllowed` — the
allowlist is the library's since `marketplace-common@2.0.0`, and a local condition reappearing above that
line is the weakening. The second must still show `guardRefreshAttempt` keyed on `hashSessionToken` with
`REFRESH_ATTEMPT_WINDOW_SECONDS = 60`.

A violation looks like: either control gaining an environment flag, a topology check or a `skipIf` whose
justification is this ADR; a risk row closed by citing the trusted segment with no security group named; or
a control outside the two hosts and one segment described here arguing from a boundary at all.
