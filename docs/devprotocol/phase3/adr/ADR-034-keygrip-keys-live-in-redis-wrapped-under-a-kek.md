# ADR-034 — Keygrip keys live in Redis, wrapped under a KEK, and a service refuses to boot on disagreement
# Marketplace

**Status:** accepted
**Date:** 2026-08-12
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

`KEYGRIP_KEY_1` and `KEYGRIP_KEY_2` are the HMAC keys that sign `refresh_token.sig`. Five of the nine
backend services hold the pair in their own git-ignored `.env` — the four `*-authorization` services and
`marketplace-dev-authenticated-logout`, i.e. exactly the ones that mint, verify or clear the refresh
cookie (`docs/devprotocol/phase3/INFRA.md` §7). Each builds its own Keygrip at boot from its own two
values: `marketplace-dev-public-authorization/src/index.mts:135` and `index.mts:141-142` in the other
four.

**Nothing checks that the five agree, and nothing can.** No test on this platform spans two services
(BCON-03), so each repo signs and verifies with itself and passes. Two incidents came out of that, both
found by hand and neither by a suite:

- **2026-08-07** — `marketplace-dev-public-authorization` (which signs the customer refresh cookie at
  `loginUser`) and `marketplace-dev-user-authenticated-authorization` (which verifies it at `refresh`)
  held different pairs. Every customer refresh returned 401. Both repos were green. Recorded as R02,
  still `Open`, High, score 12.
- **2026-08-09** — all five files held **broken** values: an 88-character key hard-wrapped after 76,
  the orphan tail parsed by dotenv as a variable of its own, and in one file duplicated a second time.
  That class is now gated by `.githooks/pre-commit` check 0 in all sixteen repos (R05b, `Mitigated`) —
  but the gate proves each *file* is well-formed, never that two files hold the *same* value.

The second problem is larger and is what forces a decision now rather than a sweep script.

**A Keygrip key cannot be rotated on this platform.** Rotation today means hand-editing five git-ignored
files on every machine that runs the stack and restarting five services, with no ordering guarantee, no
way to see which service picked up which value, and a window in the middle where a cookie signed by one
half of the fleet is rejected by the other. There is no procedure written anywhere, no mutation, no
screen, and no ADR. A key that expensive to rotate is a key that is never rotated, which makes the
2026-08-07 failure mode permanent rather than incidental: the platform's only cookie-signing secret is
whatever was pasted into five files when the machine was provisioned.

Four constraints bound the answer.

**Keygrip already implements rotation; only the transport is missing.** A `Keygrip` verifies against
every key in its array and signs with index 0, and the `cookies` package re-signs when the match came
from an index greater than 0 — a cookie signed under the previous key is migrated to the current one the
next time it is read. The two env slots are a two-entry rotation array that nothing ever rotates.

**The retirement window is thirty days and is not negotiable downward.**
`SESSION_CAP_DAYS_REMEMBERED = 30` (`marketplace-common/src/others/sessionLifetime.mts`) — a remembered
session may sit untouched for thirty days and must still be recognised. Retire a key sooner than that
and every remembered session signed under it is logged out. Two env slots make this brittle: two
rotations inside a month and the oldest still-needed key is gone.

**A Redis read must not become a session forge.** Today an attacker who reads Redis obtains opaque
session tokens and cannot do anything with them at the cookie layer, because the signing key is in env
and nowhere else. That gap is the reason the signature is worth anything at all, and no design that
closes it is acceptable — including the obvious one of parking the keys in Redis in the clear.

**There is no secrets manager and there is no production topology.** `INFRA.md` §8 open question 8 says
no vault, no provisioning script, nothing but per-machine `.env` files; ADR-032 records production
topology as *owed* and rules that no control may be argued closed by appeal to a network boundary. So
the decision may not assume a KMS, and may not assume Redis is unreachable by anyone but the nine.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **A** — leave env as the source of truth, add a workspace script that fingerprints the five files | ~30 lines, no runtime risk, no new failure mode, closes the *detection* half of R02 | detects nothing until a human runs it; rotation stays five hand edits and five restarts, which is the problem that actually matters; the sweep already exists as a shell one-liner and was not run between 2026-08-07 and 2026-08-09 |
| **B** — Redis holds only a fingerprint; keys stay in env | boot gate is real and no key material moves; smallest diff of the four that gate anything | rotation still manual, so the expensive half is untouched; two sources of truth for one secret, and the fingerprint can disagree with the key it claims to describe |
| **C** — raw keys in Redis, env holds nothing | simplest possible implementation; nothing left in env to disagree; rotation trivial | a Redis read becomes a full cookie forge — the one property the current design has, deleted. Rejected on that line alone |
| **D** — keys in Redis, AES-256-GCM-wrapped under a `KEYGRIP_KEK` that stays in env | one source of truth; a wrong KEK cannot decrypt, so disagreement is refused at boot instead of surfacing as a 401 six hours later; rotation needs no env edit and no restart; the array can hold more than two keys, so the thirty-day window stops being a squeeze | Redis becomes a boot dependency for five services; `createServer()` changes signature in five repos; a new seed step exists before a virgin stack can boot; an admin with an admin session can mint a signing key |
| **E** — a secrets manager (Vault, SOPS, cloud KMS) distributes the pair | the industry answer; solves this and `REDIS_PASSWORD` and `MONGODB_URI` in one move | needs the production topology ADR-032 says is owed, an admin story nobody has, and a vendor decision that has not been made. Not available to take today |

---

## Decision

**Option D.** Redis holds the key array, wrapped; env holds one `KEYGRIP_KEK` per service; a service
that cannot unwrap the record refuses to boot; rotation is an admin mutation that running services
apply without restarting.

Option C was rejected for the threat delta and nothing else — it is otherwise the nicest of the five.
Option A and Option B were rejected for the same reason as each other: both close R02 and neither makes
rotation any cheaper than it is today, so both leave the platform with a secret it will never change. E
is the destination, not a decision that can be taken in August 2026; when ADR-032 is answered and a
manager exists, the KEK moves into it and this record's Redis half may become redundant. That is this
ADR's revisit condition.

### The record

Three keys, all under the `REDIS_KEY` prefix every service already shares by decision (ADR-004, CON-04),
built by helpers alongside the existing ones in `marketplace-common/src/others/sessionKeys.mts`:

```
<REDIS_KEY>keygrip           hash    version  monotonic int, bumped by every rotation
                                     wrapped  base64 of iv(12) ‖ tag(16) ‖ ciphertext
                                     fp       first 12 hex of sha256 over the ordered key *ids*
<REDIS_KEY>keygrip:holders   hash    <service name> -> <fp>@<ISO-8601>
<REDIS_KEY>keygrip:rotated   channel payload is the new version, nothing else
```

The plaintext under `wrapped` is the array Keygrip is built from, newest first:

```json
[{ "id": "k7", "material": "<64 random bytes, base64>", "createdAt": "2026-08-12T09:14:22.581Z" }]
```

`fp` covers the **ids**, never the material — it exists so an admin screen and a holders heartbeat can
compare fleet state without any part of the system handling a key to do it.

AES-256-GCM, key = 32 bytes decoded from `KEYGRIP_KEK`, a fresh 12-byte IV per wrap, and **the version as
AAD** so a captured older blob cannot be replayed back under a higher version number. Node's `crypto`,
not CSFLE: the existing helpers in `marketplace-common/src/encryption/` are MongoDB client-side field
encryption, they need a `ClientEncryption` bound to a Mongo connection and a key vault, and reusing them
would tie the cookie-signing secret to the PII master key so that rotating either forces the other
(ADR-029). Two mechanisms, two blast radii, on purpose.

### Boot

`start()` in each of the five already runs `checkRequiredEnv()`, then
`Promise.all([MongoDBConnect(), RedisConnect()])`, then `createServer()`
(`marketplace-dev-public-authorization/src/index.mts:196-215`). The load goes between the last two, and
`createServer()` takes the keys as an argument instead of reading `process.env`:

- record absent → throw `KEYGRIP_RECORD_MISSING`, naming the seed command in the message;
- unwrap fails the GCM tag → throw `KEYGRIP_KEK_MISMATCH`, which is R02's failure made loud and local;
- otherwise `app.keys = new Keygrip(keys.map((k) => k.material), 'sha512')`, and the service writes its
  own row into `keygrip:holders`.

Both throws land in the existing `start()` catch — Sentry, then `process.exit(1)` — so a service that
disagrees with the fleet never binds a port. That is the whole gate, and it is stronger than comparing
five env pairs: after this there is one value to be right about, and being wrong about it is unbootable
rather than silent.

### Rotation

`keygripRotate` on `marketplace-dev-admin-authenticated-resource` — a domain mutation belongs in a
resource service, and minting a signing key is an admin act, so it must sit behind the Admin tier.
**Not** the logout service: logout is the one service all three tiers reach (ADR-005), and giving it the
mint would put key material behind a route customers hit.

⚠️ **This makes `marketplace-dev-admin-authenticated-resource` a sixth KEK holder** — the only one that
signs no cookie. It needs the KEK to open the record it is about to add a key to and to seal what it
writes back, so `KEYGRIP_KEK` belongs in its `REQUIRED_ENV_VARS` like the other five, and it refuses to
boot without it. It does **not** call the loader the signing services use, and so never appears in the
holders table: a row for a service that adopts nothing would read as permanently stale.

It unwraps, mints 64 random bytes, unshifts, drops entries **demoted** more than
`SESSION_CAP_DAYS_REMEMBERED` days ago while never leaving fewer than two, rewraps under the bumped
version, writes it back under a compare-and-set, and publishes. ⚠️ *Demoted*, not *minted* — see the
2026-08-28 amendment, which corrects this paragraph and the one below it.

**The write is a Lua script, not `WATCH` + `MULTI`.** Two admins rotating at the same moment must not
both win: the loser's blob would land under a version that already describes different bytes, and every
service that unwrapped the winner's record would then fail the AAD check on the next re-read. `WATCH`
does prevent that, but it watches a key on *one* connection, and the record lives on a Redis cluster
where the client that holds the watch is not guaranteed to be the client the retry runs on. `EVAL`
compares `version` and swaps all three fields inside a single server-side execution, on the node that
owns the slot — no connection affinity to get wrong. A rotation whose compare fails is refused outright
rather than retried, because the admin's next click reads the record the winner wrote.

**Rotation prepends; only retirement is age-gated.** A new signer is harmless at any cadence — what
would log a remembered customer out is dropping a key that is still verifying cookies, and that is
governed by **how long ago the key stopped signing** rather than by `createdAt` (amendment 2026-08-28). The
array is capped at five, and a rotate that would exceed the cap while every entry is still inside its
thirty-day window is refused rather than served by an early retirement.

Each of the five subscribes on a duplicated connection (node-redis v6 forbids commands on a subscriber),
re-reads on the message and reassigns `app.keys` — a plain assignment Koa reads per request, so no
restart and no dropped connection. A service that was down when the message fired reads the record at
boot anyway; a service whose subscription silently died re-reads on a five-minute `HGET` of `version`.
Both paths converge on the same load function.

### The admin surface

`keygripStatus` returns the version, one entry per key — `id`, `createdAt`, age in days, **never
material** — and the holders rows with a flag for whether each service's fingerprint matches the current
one. The admin screen is a rotate button plus that table, and the table is the point: it is what turns
"the mutation returned true" into "all five services are signing with the new key", which is precisely
what nobody could see on 2026-08-07.

### Seeding

A one-shot script in `marketplace-db-setup`, run once per environment before first boot and listed in
`SETUP.md` ahead of the services. It mints a fresh array, or adopts an existing `KEYGRIP_KEY_1`/`_2` pair
when one is present so a running machine migrates without logging anyone out, wraps it, and refuses to
overwrite an existing record unless forced. Seeding is not a boot-time race between five services:
whichever booted first would win, and the other four would then fail to unwrap a record they should have
written.

---

## Consequences

### Positive

- Disagreement between two services stops being possible: there is one record, and a service that cannot
  read it does not run. R02 closes on the boot gate alone; R04 shrinks from ~15 shared values to the
  handful that remain.
- Rotation becomes a button. The platform gains the ability to respond to a suspected key compromise in
  the time it takes to click it, which today it does not have at any price.
- The thirty-day retirement window stops fighting the two env slots — five entries, aged out by how long
  ago each stopped signing (amendment 2026-08-28), is room for a monthly rotation and an emergency one in
  the same window.
- Env shrinks from two shared secrets to one, and the one that remains fails **loudly**: a wrong
  `KEYGRIP_KEK` is a GCM tag mismatch at boot, not a 401 storm in the customer's browser.
- **No fifth DEK, and no prose correction owed.** Signing keys in Redis are not a CSFLE field on a Mongo
  document, so the four data encryption keys `fieldEncryption.mts:78` and `:105-109` describe stayed four
  and that prose stayed right. The superseded CSFLE-based design required a fifth DEK *and* a sweep
  correcting every "four data encryption keys" in the tree; neither ever
  became owed, and that absence is the clearest single marker of the mechanism swap. ⚠️ Do not "correct"
  that prose to five.
- The holders heartbeat gives the first fleet-wide view of a shared secret this platform has ever had.

### Negative

- **Redis becomes a boot dependency for five services.** It is already a runtime one — none of the five
  can serve a login or a refresh without it — so this converts a fast failure into an earlier one rather
  than adding an outage class, but a `docker compose up` with Redis unhealthy now fails five services at
  boot instead of at first request.
- `createServer()` changes signature in five repos, and each has integration tests that call it.
- A virgin environment has a new mandatory step before the services will start. Forgetting it is a clear
  message rather than a mystery, but it is one more thing in `SETUP.md`.
- An admin with an admin session can mint signing keys. It buys no session — a signature over a token
  Redis does not know is still refused — but it is a new capability behind that session, and the mutation
  must therefore be logged like the other admin-only writes.
- The wrap/unwrap helper, the load path, the seed script, the mutation, the subscription and the screen
  are all new code in eight repos, every line of it at 100% coverage and mutation score 100.

### Risks

- **Redis flushed or restored from an old dump** → five services refuse to boot until reseeded. Fail
  closed is the correct direction (a fleet booting on mismatched keys is what this ADR exists to
  prevent), and a flushed Redis has already destroyed every session, so nothing is lost that survived
  anyway. Revisit if the seed is ever run automatically at boot — it must not be.
- **A missed pub/sub message** leaves one service signing with an older key. Every other service still
  verifies it, because retirement is thirty days behind the key's *demotion*, so the effect is invisible
  until the key ages out. The five-minute version poll bounds it; the holders table makes it visible.
- **KEK leak** = today's key leak, no worse and no better. The KEK is the one value that still has to be
  identical in five files, and it is the one thing here that a secrets manager would fix (option E).
- **Two rotations inside thirty days plus three emergency ones** hits the cap and refuses. Deliberate:
  the alternative is silently logging out every remembered customer.
- `KEYGRIP_KEK` must be added to the secret-name lists — `.claude/SECRETS.md`, the `sentryBeforeSend`
  scrub set, `docs/workflow.md` §Environment files — in the same story that introduces it. A new secret
  that is not in those lists is a secret that reaches a log.

---

## Compliance

**Verify the decision was followed:**

- `grep -rn 'process.env.KEYGRIP_KEY_' BEs/*/src BEs/dev/*/src` returns nothing. The only reference to
  the old names outside documentation is the seed script's adoption path.
- Six services list `KEYGRIP_KEK` in `REQUIRED_ENV_VARS`, and none of them lists `KEYGRIP_KEY_1` or
  `KEYGRIP_KEY_2`: the five that sign cookies, plus `marketplace-dev-admin-authenticated-resource`,
  which signs nothing and holds the KEK **only** to reseal the record `keygripRotate` writes — it cannot
  mint a key it cannot wrap. The remaining three `*-resource` services list none of the three
  (`INFRA.md` §7 keeps its table, with the column renamed).
- `new Keygrip(` appears in each service exactly once, fed from the loaded record, and never from
  `process.env`.
- `HGETALL <REDIS_KEY>keygrip:holders` returns five rows carrying one fingerprint.

**Signals a violation:** a service constructing Keygrip from env; a `keygripRotate` path that can leave
fewer than two keys or retire one **demoted** less than `SESSION_CAP_DAYS_REMEMBERED` ago — measuring
that window from `createdAt` is the defect the 2026-08-28 amendment fixes; a resolver, log line or
GraphQL field that returns `material`; a seed script wired into a service's boot; `KEYGRIP_KEY_1/_2`
reappearing in any `env` template.

---

## Amendment — 2026-08-28: the retirement clock runs from demotion, not from minting

**Status:** accepted
**Deciders:** platform owner
**Scope:** the age rule inside `rotateKeygripKeys` only. The store, the wrap, the compare-and-set, the
propagation mechanism and the thirty-day figure itself are all unchanged.

### What this ADR said, and what the code did

Two sentences above read *"drops entries older than `SESSION_CAP_DAYS_REMEMBERED` days"* (§Rotation) and
*"that is governed by `createdAt` alone"* (§Rotation), and `rotateKeygripKeys` implemented exactly that:
`now - key.createdAt > 30 days`. Both are wrong by one signing lifetime.

A key signs for as long as it sits at index 0 — from its own `createdAt` until the rotation that pushes
it down. The last cookie it ever signed was therefore signed at its **demotion**, not at its minting, and
that cookie carries a remembered session for thirty days from there. The window a key must survive is
`demotedAt + SESSION_CAP_DAYS_REMEMBERED`, and `createdAt + 30` is shorter than it by the whole time the
key spent as the signer.

### What it cost

Nothing observed, and it was reachable on the cadence this ADR itself recommends. A key minted on day 0
and demoted on day 7 signed cookies that live until day 37; its own age passed the cap on day 30, so the
next rotation after that dropped it. The customer logged out is one holding a **remembered** session that
was idle across the whole window — an active session re-signs itself on any request, because `cookies`
re-signs on a later-index match, so only the idle ones were exposed. Rotating less often than once every
thirty days hid the defect entirely, and this platform had performed exactly one rotation, against an
isolated namespace.

### The rule now

`isTailRetirable` compares `now` against the `createdAt` of the key **in front of** the tail, because
minting that key is the event that demoted this one. The demotion instant was always in the record; it
never needed storing, and `IKeygripKeyMaterial` keeps its three fields.

`retireKeygripKey` — the `keygripRetire` mutation's half in `marketplace-common` — can remove an entry from
the middle, which leaves the tail's neighbour newer than the key that actually demoted it — so the derived instant can only ever read **late**. Late keeps a key nobody
needs; early logs a customer out. The error is on the side that costs a byte.

### Why thirty, and not the ninety `REFRESH_TOKEN_EXPIRY` allows

The figure is `SESSION_CAP_DAYS_REMEMBERED`, decided 2026-08-10 alongside the one-day default
(`docs/architecture.md`'s auth model, `SESSION_CAP_DAYS_DEFAULT`), because this window must cover the
longest session anyone can hold rather than the common one. The question
that produced it asked how long a demoted key stays `verifiable`; **`verifiable` is not a state** — the
shipped lifecycle is a position in an ordered array — so it reads as *how long does a key stay in the array
after it stops being index 0*.

⚠️ **The justification first written for the figure was inverted, and the correction matters more than the
number.** It said the 90-day `REFRESH_TOKEN_EXPIRY` is not the bound *"since a session past its cap is
refused before the key is read"*. The order is the other way round:
`authenticatedAuthorizationHandler.mts:28` verifies the cookie's signature against the whole key array
**before** `resolveAuthorizationSession` ever compares `sessionCapDeadline`. A key dropped too early
therefore fails the request at the signature — the generic 401 — and not at the cap, which is the branch
that knows why. Thirty still beats ninety, for the neighbouring reason rather than the stated one: a
past-cap session is refused anyway one line later, so a key kept past the cap protects nobody.

**The honest window is at least thirty days after demotion, and in practice until the next rotation after
that.** Removal is rotation-driven — `rotateKeygripKeys` pops the tail, and nothing runs on a timer — so a
fleet that stops rotating keeps every key it ever had, indefinitely, and at no cost: a key nobody signs with
can only verify cookies that are already alive, and those expire on their own.

### What moves with it

- `KEYGRIP_ROTATE_CAP`'s message: *"none is older than 30 days"* → *"none of them stopped signing more
  than 30 days ago"*. `marketplace-dev-admin-authenticated-resource` asserts it verbatim.
- §Compliance's **Signals a violation** now reads: a `keygripRotate` path that can leave fewer than two
  keys, or retire one **demoted** less than `SESSION_CAP_DAYS_REMEMBERED` ago.
- `keygripStatus` still reports `ageDays` from `createdAt`, which is what an admin asked for and is
  still true — it is simply no longer the retirement predicate. Rendering the demotion age is
  the admin session console's call, not this amendment's.

---

## Amendment — 2026-08-31: a retirement ends every session on the platform

**Status:** accepted
**Deciders:** platform owner
**Scope:** what `keygripRetire` does *after* its compare-and-set write lands. The record, the wrap, the
CAS, the propagation mechanism, the age rule and the 2026-08-28 amendment are all unchanged, and
**rotation still logs nobody out** — that property is what separates the two mutations and this amendment
sharpens it rather than touching it.

### What this ADR left open

§Risks reads *"a missed pub/sub message leaves one service signing with an older key … invisible until the
key ages out"*. That is true of a **rotation**, which removes nothing anybody still verifies. For a
**retirement** the same lag runs the other way and is fail-**open**: the key is gone from the record and
the lagging holder keeps verifying cookies signed with it, because nothing on the request path re-reads
the record. Measured at **8 ms** across all five signers on the live Dev stack, bounded at
`KEYGRIP_POLL_MS` = 5 minutes if the nudge is never delivered
([`report/keygrip-rotation-propagation.md`](../../../report/keygrip-rotation-propagation.md) §4). That
residual was opened as **R47**.

It was not removable at the transport. Shortening the poll shortens only the tail of a delivery failure —
the normal path is already inside one interval end to end. Checking the key version per request reverses
`watchKeygrip`'s deliberate fail-open stance and taxes every request the platform will ever serve, to
close a window that only matters on the day of an incident.

### The rule now

**A retirement ends every live session on the platform.** After the CAS write succeeds — and only after,
so a failed compare leaves both the key set and the sessions untouched — `funKeygripRetire` walks `admin`,
`shopOwner` and `user`, takes the `_id` of every account, and calls the existing
`revokeAllSessionsForAccount` on each. No `SCAN` and no `KEYS`: BCON-08 holds, because the per-account
session index is the only enumeration path there has ever been and Mongo is what holds the account ids.

The lagging holder still verifies the signature it should now refuse. It then reads the session that
signature names, finds nothing, and answers **498**. The window is zero and the request path pays nothing
for it.

### What it costs

- ⚠️ **Every session on the platform ends, the retiring admin's own included, and there is no exemption
  worth building.** Nothing anywhere records which key signed which cookie, so "end only the sessions the
  suspect key touched" is not a thing this platform can compute — the choice is every session or none.
  Exempting the caller would leave the one session most likely to be the attacker's if the admin account
  is what leaked. The admin's own browser lands on the login screen on its own: `marketplace-admin`'s
  urql `authExchange` turns the 498 into a refresh attempt and then clears the token.
- One Redis round trip per account, tiers walked in sequence — the retention sweep's reasoning, on a
  mutation an admin calls during an incident rather than on a schedule.
- A sweep that fails part way answers **500** naming the key as already gone, because it is: the key set
  is written first on purpose. Sweeping first would log the whole platform out while leaving the suspect
  key in the keyring, which is the worst of both. A second retirement of that id answers 404, and the
  remaining sessions come off the admin session console.

### What moves with it

- **Retirement is the emergency lever and nothing else.** Rotation is what retires keys safely, on age,
  without ending a single session; retirement is the answer to a key believed leaked. The confirm dialog
  in `marketplace-admin` says exactly that, and says the admin goes too.
- `keygripRetire` still answers `Boolean!`, not the session count: it answers *the key is gone*, and an
  admin who wants the number reads the audit trail — `Sentry.captureMessage` records it alongside the key
  id, the version, the fingerprint and the hashed admin id.
- **R47 closes** (`RISK_REGISTER` v1.44). §Risks' missed-message bullet keeps its meaning for rotation,
  which is the case it was written about.
