# Keygrip Rotation and Retirement — Measured Propagation

# Marketplace

**Status:** investigation finding — closes E16-S09. Not baselined, not a requirement document
**Version:** 1.0
**Date:** 2026-08-13
**Scope:** what a full rotate-and-retire cycle does to the five cookie-touching services while they are
serving. It answers three questions and nothing else: how long a rotation takes to reach every signer, how
long a retirement takes to be refused by every verifier, and whether any in-flight refresh can straddle
either change badly enough to log a user out.
**Method:** measurement against the running Dev stack on this machine, not a reading of the code. Six
services were started — the five that touch the signed refresh cookie plus
`marketplace-dev-admin-authenticated-resource`, which serves the two mutations — against an **isolated
Redis namespace** (`REDIS_KEY=e16s09:`) under an **ephemeral KEK generated for the run and never printed**,
so that nothing this investigation wrote could reach the platform's own keyspace or adopt real key
material. One process held the clock: it took `t0`, issued the mutation over HTTP, and polled the holders
hash every 25 ms until every row carried the new fingerprint. The namespace was deleted afterwards. Static
reading was used only to explain results already observed.
**Reads against:** [`ADR-034`](../devprotocol/phase3/adr/ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md) ·
[`E16`](../devprotocol/phase5/EPICS_STORIES.md) E16-S02, E16-S04, E16-S08 ·
`BEs/marketplace-common/src/others/{watchKeygrip,loadKeygrip,recordKeygripHolder,sessionKeys}.mts` ·
`BEs/dev/marketplace-dev-public-authorization/src/index.mts:134-160,248-300` ·
`BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/keygrip/{funKeygripRotate,funKeygripRetire}.mts`

---

## 1. Verdict

**Propagation is not the risk. It is two orders of magnitude faster than the design's own bound.** The
first rotation ever performed on this platform reached all five signers **37 ms** after the mutation was
issued — 2 ms after it returned — and the retirement that followed reached all five **8 ms** after it was
issued. `KEYGRIP_POLL_MS = 300_000` is the ceiling for a *lost pub/sub message*, not the mechanism, and the
mechanism was never observed to miss.

**No in-flight refresh can be straddled by a rotation.** Not at 37 ms and not at the five-minute ceiling
either — §5 shows this is structural, not lucky. A **retirement** does invalidate cookies, which is its
entire purpose; §6 sizes the one case where it invalidates more than the admin intended and concludes
that it does **not** warrant a story before E16 is called done.

One defect was found, and it has nothing to do with keys — it was found because the missing
`KEYGRIP_KEK` triggered it:

- **🔴 A service that fails its required-env check exits `0`, silently.** No console output, no non-zero
  status, nothing in the log. `checkRequiredEnv()` throws outside the `try` in `start()`, and the
  bottom-of-file `.catch` hands the error to `Sentry.captureException(e)` — which, with no `DSN`
  configured, discards it. An admin running a service with a missing variable sees a process that
  started and stopped, and cannot tell it from a clean shutdown. This belongs to **E18-S03**, which is
  already the story about `REQUIRED_ENV_VARS` and failing to start; it is recorded here because this is
  where it was observed.
  **Fixed 2026-08-13 by E18-S03**, in all nine services: the entrypoint's `.catch` now writes the failure
  to stderr and calls `process.exit(1)`, so a boot that never bound its port stops reporting a clean
  shutdown to Docker, to systemd and to anything else reading the exit code. Sentry still gets the event,
  and still discards it while no DSN is configured — which is why the exit code, not the report, is what
  was made to carry the failure.

## 2. What was measured

Six processes, each launched with `REDIS_KEY=e16s09:` and the ephemeral `KEYGRIP_KEK`, nothing else
changed:

| Service | Port | Role in the cycle |
|---|---|---|
| `marketplace-dev-public-authorization` | 4028 | mints the signed refresh cookie at login |
| `marketplace-dev-authenticated-authorization` | 4029 | verifies and re-mints it at refresh (ShopOwner) |
| `marketplace-dev-admin-authenticated-authorization` | 4025 | verifies and re-mints it at refresh (Admin) |
| `marketplace-dev-user-authenticated-authorization` | 4031 | verifies and re-mints it at refresh (User) |
| `marketplace-dev-authenticated-logout` | 4030 | verifies it, all three tiers |
| `marketplace-dev-admin-authenticated-resource` | 4024 | serves `keygripRotate` / `keygripRetire` / `keygripStatus` |

**The holders hash held exactly five rows.** `marketplace-dev-admin-authenticated-resource` writes the
record and never signs a cookie, so it registers no holder — the table lists signers, not readers, and the
count is the first thing that would have been wrong if a service had been miswired. All five rows carried
one fingerprint at rest.

## 3. Rotation

| | |
|---|---|
| Record before | version 1, fp `6ab9f1eb8f7d` |
| Mutation | `keygripRotate` → HTTP 200 in **35 ms** |
| Record after | version 2, fp `c77808de4139` |
| **All five rows carrying the new fingerprint** | **37 ms from `t0`** |

The poll that first saw the new fingerprint saw it on all five rows at once. With a 25 ms polling
granularity, 37 ms is an **upper bound** on every service's adoption, not a resolved per-service figure:
the true convergence is somewhere in the 2 ms between the mutation returning and that poll. What the
measurement establishes is that adoption is driven by the pub/sub nudge, not by the timer — a timer-driven
adoption could not have landed inside one poll interval.

## 4. Retirement

The rotation left two keys, newest first. The demoted one — the key that had been signing until 37 ms
earlier — is the retirable one.

| | |
|---|---|
| Keys before, in order | `["k2", "k1"]` |
| Target | `k1` |
| Mutation | `keygripRetire(id: "k1")` → HTTP 200 in **8 ms** |
| Record after | version 3, fp `015f7e6bc5ae` |
| **All five rows carrying the new fingerprint** | **8 ms from `t0`** |

Adoption was observed on the first poll taken after the mutation returned. The retired material was gone
from the record and `fp` had been recomputed over what remained.

## 5. A rotation cannot log anyone out

This is structural, and holds at the five-minute ceiling as well as at 37 ms. Three properties compose:

1. **Rotation prepends; it never removes.** `loadKeygrip` answers newest-first and the previous keys stay
   in the list. `Keygrip` signs with `keys[0]` and verifies against every entry, so a cookie signed before
   the rotation still verifies after it.
2. **The `cookies` package re-signs a cookie whose match came from a later index.** Sessions migrate onto
   the new key on their next request, with no explicit migration step and no window in which a session is
   between keys.
3. **`app.keys` is reassigned, never mutated** (`index.mts:294`). `cookies` reads `app.keys` per request,
   so a request already in flight finishes against the array it started with, and the next one picks up the
   new array whole. **There is no moment at which any request sees a half-swapped keyring** — the failure
   mode a mutated array would have introduced.

The lagging case is therefore benign by construction: a service that has not yet heard about a rotation
keeps signing with the previous key, and every sibling still verifies that key, because a rotation removed
nothing. The cost of a lost pub/sub message is a delay, not a wrong key — which is what
`watchKeygrip`'s own comment claims, and what the measurement is consistent with.

## 6. A retirement invalidates cookies — that is the point, and here is the edge

Retirement removes a key, so every cookie signed under it stops verifying. That is the operation's entire
purpose: it is the response to a suspected compromise, and the sessions it logs out are the sessions an
attacker holding that key could have used.

Beyond that intended blast radius there is exactly one case where a retirement logs out a session the
admin did not mean to reach. It requires **both** of:

- a holder that has not yet adopted the rotation which demoted the target key — meaning its pub/sub
  delivery failed, since delivery was measured at ≤2 ms — **and**
- the admin retiring that key inside that holder's remaining poll window.

Cookies that lagging holder signs in the gap are signed with a key that no longer exists anywhere, so its
owners are logged out on their next request.

**This does not become a story before E16 is called done**, for three reasons:

- `keygripRetire` already refuses to retire the key at index 0 — 409, `KEYGRIP_RETIRE_CURRENT`, tested over
  HTTP — so the ordinary path cannot strand a signer at all. The edge needs a *second* key still in active
  use by a lagging process, which needs a delivery failure first.
- The holders hash makes the precondition **visible before the admin acts**: a lagging service is a row
  whose fingerprint disagrees with the record's, and E01-S14 already surfaces exactly that table.
- The blast radius is bounded by the same five minutes as everything else, and the population is the
  sessions one lagging service happened to sign inside it.

**What it does earn is a console affordance in E17-S08**, not a domain change: the retire control should
warn — or refuse — while any holders row disagrees with the current fingerprint. The mutation deliberately
does not consult the holders hash, and should not start: a break-glass response to a compromised key must
not be blockable by a service that is merely unreachable. The judgement belongs to the admin, with the
disagreement shown.

## 7. Residual: a retired key is honoured until every holder adopts

The fail-**open** direction is the one worth recording. Between a retirement landing and a lagging holder
adopting it, that holder still *verifies* the retired key. Measured at 8 ms; bounded at `KEYGRIP_POLL_MS`
= 5 minutes if the nudge is lost. This is the residual the ADR names and it is opened as **R47** in
`RISK_REGISTER` by E16-S08.

It is not removable by tuning: shortening the poll shortens the tail of a delivery failure and does
nothing to the normal path, which is already inside one poll interval end to end.

## 8. Operational note — the local `.env` files are behind the code

Checked in-process, as booleans, with no value read or printed: **none of the six local `.env` files
defines `KEYGRIP_KEK`, and all of them still define `KEYGRIP_KEY_1`.** The code no longer reads the second
— E01-S15 removed it and added the eslint ban — and requires the first, which is why every service exited
before serving until the run supplied a KEK of its own.

These files are developer-owned and untracked; nothing in this investigation modified them. The remedy is
the seeding step in `SETUP.md`, not a code change, but an admin following the current documents on this
machine would hit §1's silent exit and have nothing to read.

## 9. What this replaces

The measured figures replace the estimates in:

- **E16-S02** — worst-case propagation delay: **≤5 minutes** is the bound on a lost nudge; **37 ms** is the
  observed figure for the mechanism.
- **E16-S04** — worst-case window between retiring a key and the last process dropping it: same two
  numbers, **8 ms** observed.
- **E16-S08** — the residual row, opened at **R47** rather than the R42 the epic named. R42 through R46
  were all taken between the epic being written and this measurement.
