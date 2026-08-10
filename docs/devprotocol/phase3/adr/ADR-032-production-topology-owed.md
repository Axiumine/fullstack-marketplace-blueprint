# ADR-032 — The production topology is owed, and no control may assume it
# Marketplace

**Status:** accepted
**Date:** 2026-08-10
**Deciders:** platform owner (thedoctorweb)
**Supersedes:** —
**Superseded by:** —

---

## Context

Three findings in [`docs/report/token-handling-security-audit.md`](../../../report/token-handling-security-audit.md) end in the same place, and none of
the three can be argued closed without an answer nobody has written down:

- **`INTROSPECTION_CODE` is reachable wherever a service port is.** A caller holding the code and a
  valid refresh-cookie signature gets a session-less authorized call. E13-S11 gated the bypass on a
  `NODE_ENV` allowlist, so outside `development` and `test` the configured value is never even read —
  but "who can open a TCP connection to 4029" is still the question that sets its blast radius.
- **`refresh` is floodable with distinct garbage tokens.** Each attempt is a Redis read and a signature
  verification before anything rate-limitable happens. E14-S08 puts a limiter in front of the lookup;
  how much traffic can arrive at all is a network fact, not an application one.
- **Redis traffic is unencrypted** (R45). Every request moves a session hash — `_id`, `email`, `tier` —
  across the wire in the clear, and this workspace cannot change it: koa-utils hardcodes `redis://` in
  the cluster rootNodes and every service `env` selects that branch with `REDIS_IS_CLUSTER=1`.

Each of the three has a mitigation that stands on its own, and each of those mitigations was written
next to a sentence someone will eventually want to write: *it is behind a firewall anyway*. **There is
no document that says so.** What exists is:

- **The edge, in full.** `marketplace-nginx/` carries three vhosts — apex, `shopowner.`, `admin.` —
  terminating TLS for all three and proxying eleven loopback upstreams: the nine backend services, the
  SSR renderer and Nominatim. `test/run.sh` exercises the real configuration in a container: `nginx -t`
  plus 168 behavioural assertions. ADR-030 makes that suite the `pre-push` gate.
- **The bind addresses, decided and argued.** ADR-022: the nine services bind the wildcard address
  because they are meant to be reachable from nginx and from each other across the box, and a hardcoded
  loopback bind would break any topology where the proxy is not the same process. `marketplace-user`'s
  SSR server binds `127.0.0.1` precisely so nobody can reach `3045` and skip the edge's TLS, rate limits
  and cache-bypass-on-cookie.

Put together: **the nine services answer on every interface of whatever host they run on, and nothing in
these sixteen repos says which interfaces that host has.** nginx proxying them over loopback describes
how the proxy finds them, not who else can.

The data tier is in the same state, one step worse. `docker-DBs/` is explicitly dev-only — ports bind
`127.0.0.1`, there is no TLS, and its own `CLAUDE.md` says not to add a staging or production profile
there. So the MongoDB replica set and Redis that production runs against are not described anywhere at
all: not which host, not which network, not whether the `redis://` above crosses a switch or a loopback
interface.

The gap is already acknowledged — `ADR-INDEX.md` §5 has carried "Production topology" since the index
was baselined. What it has not had is a number the three findings can point at, an owner, or a rule
about what may be claimed in the meantime. Without those, the register ends up with three risks whose
residual score depends on a shared assumption that no one has stated and therefore no one can be wrong
about.

This ADR does not invent the topology. Guessing it would be worse than the gap: a written topology is
read as a specification, and a specification nobody deployed against is how a control ends up sized for
a network that does not exist.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — leave §5's prose as the record | Costs nothing; the gap is technically already written down | A bullet in a gaps list is not linkable, has no owner and no date, and cannot be cited from a risk row. Three mitigations keep being written against an assumption that stays unstated, which is exactly how "it is behind a firewall" enters a review as a fact |
| B — write the topology now, as intent | Gives every control a boundary to be sized against; unblocks the residual scoring on all three findings | It would be fiction. No production host exists, no deployment has happened, and an invented topology is read as a specification — the next person sizes a control against a network nobody built, and the fiction is discovered by an incident rather than by a review |
| C — record the decision as **owed**, with owner and date, and forbid any control from assuming a boundary until it is written | Honest about what is and is not known; gives the three findings one linkable cause; keeps every mitigation standing on its own merits, which is what makes them correct under *any* topology | The three residual risks stay unscored, and the register visibly carries an open item with no closing date |
| D — treat it as an infrastructure task outside the ADR set | Keeps the ADR set to software architecture | Every one of the three findings is an application-layer control whose sizing depends on it; splitting the cause out of the set that records causes is how the link is lost |

---

## Decision

Option **C**. The production topology is recorded as a decision this platform **owes**, and this ADR is
the place the three findings point at.

- **Owner:** platform owner (thedoctorweb). **Owed since:** 2026-08-10, the date of the audit that made
  three separate findings depend on it.
- **What it must answer, when it is written:** which ports are reachable from where; what sits in front
  of the nine services and whether anything can reach them without passing it; where Redis and MongoDB
  live relative to the services and whether that leg leaves the host; and whether `marketplace-nginx` is
  the outermost hop or has something in front of it.
- **The rule that applies until then:** **no control on this platform may be argued closed by appeal to
  a network boundary.** A mitigation that only works if a port is unreachable is not a mitigation, it is
  a bet on this document being written the way the author hoped. Every mitigation for the three findings
  above is therefore written to hold with the port open — the environment allowlist on the introspection
  bypass, the pre-lookup limiter on `refresh`, the hashed session keys — and stays that way after the
  topology lands.

Recording it as owed is itself the decision, and it is not a placeholder: it converts a silent
assumption into an open item with a name on it, and it makes "we are behind a firewall" a claim that
must be written here before it may be relied on anywhere.

---

## Consequences

### Positive
- The three findings have one cause with one number. A reader of any of them reaches the same page
  instead of concluding independently that someone else has thought about the network.
- Every mitigation is forced to stand alone, which is the property that makes it correct whatever the
  topology turns out to be — and the property that would have been quietly traded away had option B
  supplied a comfortable boundary.
- The risk register can carry R46 with an owner and a revisit trigger rather than an unattributed
  assumption, and R45's "cannot be fixed from this workspace" stops implying "and is fine".

### Negative
- Three residual risks stay unscored until this is superseded, and the register says so. That is
  accurate rather than convenient, and it will look like an unclosed item in every review until the
  topology exists.
- The platform ships controls sized for a hostile network it may not have, which is real work spent on
  a defence that a firewall might have made cheap. That cost is accepted: the reverse mistake is not
  recoverable by review.

### Risks
- **Risk:** the first production deployment happens and this ADR is not written, so the topology becomes
  whatever the deploy did. Revisit condition: any host provisioned to run a service, Redis or MongoDB
  outside `docker-DBs/`, which is dev-only by its own decision.
- **Risk:** a future mitigation is written against an assumed boundary, undoing the rule above. Revisit
  condition: any control whose argument contains "not reachable from outside" without citing a
  superseding ADR that says so.
- **Risk:** the topology is written, and the three findings are not re-scored against it. Revisit
  condition: this ADR being superseded — the superseding one must name R45, R46, E13-S11 and E14-S08.

---

## Compliance

There is nothing here to test, so the check is that the links still resolve in both directions. From the
workspace root:

```bash
grep -rn 'ADR-032' docs/ | sort
```

Must show, at minimum: R45 and R46 in [`RISK_REGISTER.md`](../../phase5/RISK_REGISTER.md), the Redis-transport
subsection of [`architecture.md`](../../../architecture.md), and §5 of [`ADR-INDEX.md`](./ADR-INDEX.md). A finding that depends on the
topology and does not appear in that output is a finding whose reader will not find the cause.

A violation looks like: a mitigation, an ADR or a risk-register row that closes an item by asserting a
port is unreachable, with no superseding ADR describing the network that makes it so.
