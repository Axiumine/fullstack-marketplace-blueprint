# Where the session and key-custody resolvers live

**Status: decided and implemented.** Decided 2026-08-13 while building E17; the resolvers ship in
`marketplace-dev-admin-authenticated-resource` (port 4024). E17-S09 is the story that required this to be
written down rather than left as the shape the code happens to have.

## The question

E16 and E17 add seven Admin-tier operations that are not domain data:

| Operation | What it touches |
|---|---|
| `sessions(tier, accountId)` | E15's session index, in Redis, for a **different** tier |
| `reuseEvents(tier, accountId)` | E14's revocation trail, in Redis |
| `revokeSession(tier, accountId, id)` | another tier's live session keys |
| `revokeAllSessions(tier, accountId)` | all of one account's session keys, and its index |
| `keygripStatus` | the wrapped cookie-signing record at `<REDIS_KEY>keygrip` |
| `keygripRotate` | mints a signing key for the whole platform |
| `keygripRetire(id)` | removes one, signing out everyone still holding a cookie it signed |

None of them is `itemCategory` CRUD or moderation, which is what that service was for. So: do they belong
in a tenth deployable — an Admin-tier *operations* service — or in the existing Admin resource service?

## Decision

**The existing service.** No tenth deployable.

## Why — and it is operational cost, not an architectural prohibition

Nothing on this platform forbids a tenth service. The tier × concern split (`docs/architecture.md`) would
accommodate one, `ADR-002`'s rule about roles is untouched by it — this is not a fifth tier, it is a second
concern for an existing one — and the four surfaces the platform already has each got their own service pair
without argument. If the reason were doctrinal it would be short, and this note would be one line.

The reason is that **a deployable is a per-machine environment file, and this platform's three highest-scoring
open risks are all about per-machine environment files being wrong**:

- **R02** — cookie-signing key mismatch between the service that signs a refresh cookie and the one that
  verifies it. `Mitigated` since ADR-034, not closed: `KEYGRIP_KEK` is still a per-machine value provisioned
  by hand, and a tenth service that reads the keygrip record is a tenth KEK to provision. The failure is loud
  now — `KEYGRIP_KEK_MISMATCH` and `process.exit(1)` rather than a port — but a service that will not start is
  still an incident, and this one would be the console an operator reaches for *during* an incident.
- **R03** — `INTROSPECTION_CODE` disagreement across the nine backend `env` files, which breaks the
  service-to-service bypass in both directions. Detection is a manual sweep. Nine copies is the number that
  makes the sweep worth writing down; ten is not better.
- **R04** — the enabling condition under both: a per-machine `env` that is **wrong but populated**, which
  `checkRequiredEnv` cannot see, because `if (!env[envVar])` only catches empty and absent. It has already
  fired for real — both user-tier services were provisioned from an unrelated project's file, and one of the
  three keys that were wrong rather than missing was exactly the Keygrip pair from R02. Every new deployable
  is another draw from that same deck, on every machine, forever.

`marketplace-dev-admin-authenticated-resource` already holds every value these resolvers need — the Redis
connection, `REDIS_KEY`, `KEYGRIP_KEK`, `INTROSPECTION_CODE` — because it already authenticates Admin sessions
against the same Redis. A tenth service would duplicate that set to gain nothing but a process boundary, and
would pay for the boundary in exactly the currency R02, R03 and R04 are denominated in.

The secondary costs are the ordinary ones and are listed only so nobody has to rediscover them: a port, an
nginx upstream and location block on the admin vhost, a `services-status` entry, a systemd unit, a
`codegen.ts` project and a `schema/` slice in `marketplace-admin`, a vite proxy entry, a GitNexus group
member, and a repo with its own coverage, mutation and Qodana gates to keep at 100.

## What the decision does not claim

- **Not** that a tenth service is architecturally wrong. It is not, and this note should not be cited as
  though it were.
- **Not** that these operations are domain data. They are not, which is why `docs/architecture.md`'s service
  table now names them separately in that row rather than folding them into "domain data".
- **Not** that co-locating them is free. It puts the platform's most dangerous mutation — `keygripRetire`,
  which signs customers out on purpose — in the same crash domain as `itemCategory` CRUD. That is accepted
  because the alternative moves the risk rather than removing it: a separate process is a separate crash
  domain *and* a separate environment file, and the second is the one that has actually broken this platform.

## The condition that reopens it

Revisit if **either** of these becomes true:

1. **The environment-file risk is closed rather than mitigated** — that is, R04 is `Closed`: a wrong-but-
   populated value is refused at boot the way a wrong `KEYGRIP_KEK` already is, for every shared key rather
   than for that one. At that point a tenth deployable costs a port and a systemd unit, and the argument
   above evaporates. E18's environment work is where that would come from.
2. **Session administration stops being operator tooling** — if any of these operations is ever needed by an
   automated caller, on a schedule, or at a request rate that makes it worth isolating from the Admin panel's
   ordinary traffic. Today all seven are driven by one human on one screen during an incident, which is the
   traffic profile that makes a shared process obviously right.

A third condition is *not* on this list on purpose: "the service is getting large". Size is not a reason to
split a deployable here, and treating it as one is how a tenth environment file gets provisioned for a
reason nobody can point at later.

## Traceability

`docs/devprotocol/phase5/epics/E17.md` E17-S09 · `docs/devprotocol/phase5/RISK_REGISTER.md` R02, R03, R04 ·
`docs/architecture.md` service table.

⚠️ Deliberately **not** cited: `ADR-006` and `NFR-AV01`. Neither forbids a tenth service, and citing either
would make this decision look mandatory when it is a cost judgement that the conditions above can overturn.
