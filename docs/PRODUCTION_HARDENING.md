# Production hardening
# Marketplace

**For adopters.** You cloned this blueprint and you want to run it somewhere that is not your workstation.
This page is the list of things that are hand-provisioned here on purpose, where each one is read in the
code, and what must still be true after you replace it with whatever your infrastructure uses.

⚠️ **This page names no vendor, and that is a decision rather than an omission.**
[`ADR-040`](./devprotocol/phase3/adr/ADR-040-the-secrets-manager-vendor-choice-is-the-adopters.md) records
the platform owner's ruling: *"A blueprint cannot make the vendor decision — Vault vs SOPS vs AWS KMS vs GCP
depends on where the adopter deploys."* Vault, SOPS, AWS KMS, GCP Secret Manager, a systemd credential, or a
shell script on a locked-down bastion are all valid answers to what follows. The blueprint's job is to tell
you exactly where to attach one; choosing it is yours.

**Nothing on this page is enforced by a gate.** No test asserts it, no hook reads it, and the platform boots
fine without you having read a word of it. That is the honest cost of Option D in ADR-040 and it is written
down in that ADR's *Negative* section rather than hidden here.

---

## 0. Before you start

| You need | Read |
|---|---|
| the topology this platform is designed to run in | [`ADR-039`](./devprotocol/phase3/adr/ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md) — Cloudflare at the edge, one application host, datastores on their own host on a private LAN segment |
| why no vendor is named here | [`ADR-040`](./devprotocol/phase3/adr/ADR-040-the-secrets-manager-vendor-choice-is-the-adopters.md) |
| how the four values get generated and where they go in development | [`SETUP.md`](../SETUP.md) §5 |
| what is still undesigned at the operations layer | [`RISK_REGISTER.md`](./devprotocol/phase5/RISK_REGISTER.md) **R39** — sizing, supervision, CI/CD, backups. This page does not close any of them |
| the residual you are accepting if you change nothing | `RISK_REGISTER.md` **R50** |

⚠️ **`SETUP.md` is a development recipe and stays one.** It tells you to run `openssl rand`, paste the output
into per-repo environment files, and start nine services on one machine. Every step of that is correct for a
workstation and none of it is a provisioning story. This page is the delta.

⚠️ **What this page is not:** it is not a deployment guide, a Terraform module, or a secrets-management
tutorial. It is the list of *swap points* — the exact lines that read a shared secret, and the invariants
around them that a swap must not break.

---

## 1. `KEYGRIP_KEK` — the wrapping key for the cookie-signing keys

**What it is.** The cookie-signing keys are **not** in any environment file. They live as one
AES-256-GCM-wrapped record in Redis at `<REDIS_KEY>keygrip`, and `KEYGRIP_KEK` is the only thing that opens
it ([`ADR-034`](./devprotocol/phase3/adr/ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md)). It is
a **wrapping** key, never a signing key.

**Who needs it — seven places, not nine.** Six of the nine backend services, plus the seeding repo:

```
marketplace-dev-public-authorization            marketplace-dev-authenticated-logout
marketplace-dev-authenticated-authorization     marketplace-dev-admin-authenticated-resource
marketplace-dev-admin-authenticated-authorization   BEs/marketplace-db-setup   (yarn seed:keygrip)
marketplace-dev-user-authenticated-authorization
```

`admin-authenticated-resource` is the one that looks wrong and is not: it signs no cookie, and it hosts the
rotation and retirement mutations, which mint and reseal the record. The other three `*-resource` services
sign nothing, rotate nothing and **must not** carry the value. `SETUP.md` §5 explains why the count of
holders in `<REDIS_KEY>keygrip:holders` is five while the count of services carrying a KEK is six.

### Swap points

| File | Line | What it does |
|---|---|---|
| `BEs/marketplace-common/src/others/readKeygrip.mts` | 57 | `Buffer.from(process.env.KEYGRIP_KEK ?? '', 'base64')` — the boot-path read, shared by all six services |
| `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/keygrip/funKeygripRotate.mts` | 54 | decodes the KEK again, independently, to reseal the record on rotation |
| `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/keygrip/funKeygripRetire.mts` | 47 | decodes it again, independently, to reseal on retirement |
| `BEs/marketplace-db-setup/lib/keygrip.js` | 88 | `env.KEYGRIP_KEK` — the seed path, which writes the record in the first place |

⚠️ **Four reads, not one — and this is the single most important line on this page.** If you resolve the KEK
from a manager, resolve it in **one** place per process and pass the result down. Three independent lookups
in one process can return three different values the moment your manager has more than one version live, and
a rotation mutation that reseals the record under a KEK the boot path cannot open is the exact split-brain
`ADR-034` exists to prevent. The cheapest correct swap is to keep `process.env.KEYGRIP_KEK` as the single
interface and populate it from your manager **before the process starts** — a systemd `LoadCredential`, an
entrypoint that execs after fetching, `sops exec-env`, or your platform's equivalent.

### Invariants a swap must not break

```
readKeygrip.mts:24   const KEK_BYTES = 32
readKeygrip.mts:59   if (kek.length !== KEK_BYTES) throw
readKeygrip.mts:60   KEYGRIP_KEK_MISMATCH: KEYGRIP_KEK must be base64 of 32 bytes, this one decodes to N.
readKeygrip.mts:70   KEYGRIP_KEK_MISMATCH: this service cannot unwrap keygrip record version V (fp).
```

- **32 bytes, base64-encoded.** AES-256 takes a 256-bit key and nothing else. `openssl rand -base64 32`
  produces the right shape; anything your manager hands back must decode to exactly 32 bytes.
- **A wrong KEK must stay a boot failure.** Both messages above end in `process.exit(1)` before the service
  binds a port. Do not wrap the read in a fallback, a retry against a second source, or a `catch` that
  continues — a service that starts with the wrong KEK signs cookies its siblings cannot verify, which is a
  401 storm hours later instead of a service that visibly did not start.
- **⚠️ That gate is a boot-time check, never a pre-deploy one.** Nothing compares the value across machines
  before you ship. If you want a pre-deploy check, that is yours to build (see §5).

### What this platform does not give you

There is **no escrow** for the KEK and **no automated cross-machine rotation**. Rotating the KEK means
re-wrapping the record under a new one on every machine at once, and nothing in this workspace does that —
`ADR-034` gives the KEK no in-platform rotation path of its own. Your manager's own secret-versioning is the
only lever until you build one. `ADR-040` §Decision explains why this blueprint declines to build it: both
are properties of a manager, and a manager built against no vendor is a guess.

⚠️ **Losing the KEK is recoverable, unlike the CSFLE key.** Re-seed with `yarn seed:keygrip --force` and
every user signs in again. Do not confuse it with `CSFLE_MASTER_KEY_PATH` — losing *that* one destroys every
encrypted personal field permanently (`SETUP.md` §4, ADR-029).

---

## 2. `INTROSPECTION_CODE` — the schema-introspection bypass header

**What it is.** The value compared against the `x-introspectioncode` request header to let GraphQL
introspection through without a session.

**Who needs it.** All **nine** services carry it in their environment template. ⚠️ Seven of the nine also
list it in `REQUIRED_ENV_VARS` and refuse to boot without it; `public-authorization` and `public-resource`
do not, so an unset value there fails at the comparison rather than at boot.

### Swap points — six comparisons across five files

| File | Line |
|---|---|
| `BEs/marketplace-common/src/others/resolveAuthorizationSession.mts` | 189 |
| `BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts` | 42 |
| `BEs/dev/marketplace-dev-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts` | 43 |
| `BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts` | 40 |
| `BEs/dev/marketplace-dev-authenticated-logout/src/lib/authorizationLogoutHandler.mts` | 46, 70 |

### Invariants a swap must not break

- **`isIntrospectionBypassAllowed()` is evaluated first, every time.** It gates the bypass on `NODE_ENV`, so
  outside development and test the header admits nothing regardless of its value (E13-S11). Keep the
  short-circuit order; moving the comparison in front of it turns a development convenience into a
  production bypass.
- **The comparison is `constantTimeEquals`, never `===`.** String equality stops at the first differing
  byte and leaks the prefix through timing.
- **The value is read through a template literal**, `` `${process.env.INTROSPECTION_CODE}` ``, so an
  **unset** variable compares as the four-character string `"undefined"` rather than throwing. That is why
  the variable stays in `REQUIRED_ENV_VARS` in the seven services that list it — removing it there is the
  regression, not removing the template literal.
- ⚠️ **This value is reachable wherever a service port is.** `ADR-039` closes those ports with a cloud
  security group; that is the control, and it is the only one.

---

## 3. `REDIS_PASSWORD` — the datastore credential

**Who needs it.** All **nine** services list it in `REQUIRED_ENV_VARS`, plus `BEs/marketplace-db-setup`
(`scripts/seedKeygrip.js:37`, alongside `REDIS_USERNAME`). Eleven files must agree and nothing compares them.

### Swap point — and the one that is not a file read

The nine services and the seed each read `process.env.REDIS_PASSWORD` and hand it to the client. The
development Redis gets the same value written into its own config by
`marketplace-docker-DBs/up.sh` (lines 59, 109, 113 — it generates `secrets/redis.conf` with a `requirepass`
line on every run).

⚠️ **`marketplace-docker-DBs/` is development-only by its own decision.** In production you are pointing at
a real Redis cluster on the datastore host `ADR-039` describes, and `up.sh` is not in the picture — the
server-side half of this credential is configured by whatever provisions that cluster. The ten client-side
reads are the swap points; the eleventh is your Redis configuration.

### Invariant a swap must not break

- ⚠️ **The Redis leg is cleartext by deployment, not by constraint.** `@axiumine/koa-utils@7.1.0` reads the
  cluster scheme from a `REDIS_TLS` flag instead of hardcoding `redis://`, and all ten dependent repos are
  on `^7.1.0` — but no environment here sets the flag and no Redis here serves TLS, so session hashes,
  session keys and the `AUTH` itself cross the wire in the clear. `ADR-039` puts that wire on a private LAN
  segment the platform owner declares trusted; **R45** stays open at 🟢 Low because a declared boundary is
  not encryption. If your segment is not one you can declare trusted, set `REDIS_TLS` and serve TLS — the
  capability is already there.

---

## 4. `REDIS_KEY` — the shared session keyspace prefix

**Who needs it.** All nine services **and** `BEs/marketplace-db-setup`, byte-identical — ten files. Consumed
inside `marketplace-common` by `sessionKeys.mts`, `assertTier.mts`, `resolveAuthorizationSession.mts`,
`assertUnderRateLimit.mts` and `assertHashFieldTTLSupport.mts`, and by
`BEs/marketplace-db-setup/lib/keygrip.js` when it writes the keygrip record.

### Invariant a swap must not break

- ⚠️ **A mismatch here is the quietest failure on this page.** It is not a credential and getting it wrong
  raises nothing: the service simply never finds a session, and the seed writes the keygrip record where
  nobody looks for it. One shared keyspace is deliberate — the session carries a `tier` and `assertTier` is
  what separates the three roles ([`ADR-002`](./devprotocol/phase3/adr/ADR-002-role-is-authentication-collection.md)); a per-service prefix
  is not a hardening measure, it is a broken platform.
- Treat it as configuration rather than as a secret — but provision it through the same mechanism as the
  other three, because the failure mode of it drifting is worse than the failure mode of a wrong password.

---

## 5. What none of this gives you

Everything below is genuinely open. This page documents swap points; it builds no control.

- **No cross-file agreement check.** Nothing on this platform proves that nine environment files hold the
  same `REDIS_KEY`, or that six hold the same `KEYGRIP_KEK`, before a deploy. A vendor-neutral fingerprint
  sweep would need no vendor and is **not** declined by `ADR-040` — it is open under **R39** and
  [`INFRA.md`](./devprotocol/phase3/INFRA.md) §14 q8. Until then, the recipe is
  `docs/workflow.md` §Environment files: `sha256(key + ' ' + value)`, first six hex, compared between two
  machines. **Fingerprint, never print.**
- **No escrow, no automated rotation** for any of the four. See §1.
- **No process supervision, no CI/CD, no backup or restore drill, no sizing for the Redis cluster or the
  MongoDB replica set.** All of it is **R39**, all of it is still open, and `ADR-039` explicitly did not
  answer any of it.
- **No secret rotation runbook.** The platform has one rotation mechanism, and it is for the *signing keys*
  inside the wrapped record — an operator mutation in `admin-authenticated-resource` that running services
  adopt without restarting. The four values on this page have no equivalent.

---

## 6. Minimum checklist

Not a substitute for reading the sections above; a way to confirm you did.

- [ ] All four values come from your provisioning mechanism, not from a file a human edited on each host.
- [ ] `KEYGRIP_KEK` decodes to exactly 32 bytes, and is resolved **once per process** — the four reads in §1
      see the same value.
- [ ] Both `KEYGRIP_KEK_MISMATCH` paths still `exit 1`. No fallback, no retry, no second source.
- [ ] `isIntrospectionBypassAllowed()` still runs before every `INTROSPECTION_CODE` comparison, and every
      comparison is still `constantTimeEquals`.
- [ ] Every service port is closed to everything but the edge (`ADR-039`), because §2's control is that and
      nothing else.
- [ ] You have decided, explicitly, whether `REDIS_TLS` is set — and written down why, if it is not.
- [ ] You have read **R50** and **R39** and know which residuals you are carrying.

---

## Related

- [`ADR-034`](./devprotocol/phase3/adr/ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md) — where the
  signing keys live and why the KEK exists.
- [`ADR-039`](./devprotocol/phase3/adr/ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md)
  — the topology every claim on this page assumes.
- [`ADR-040`](./devprotocol/phase3/adr/ADR-040-the-secrets-manager-vendor-choice-is-the-adopters.md) — why
  this page exists instead of an integration.
- [`SETUP.md`](../SETUP.md) §5 — the development provisioning this page is the delta from.
- [`docs/workflow.md`](./workflow.md) §Environment files — the fingerprint sweep, and the rules for values
  containing whitespace or line breaks.
- [`RISK_REGISTER.md`](./devprotocol/phase5/RISK_REGISTER.md) — **R50** (accepted), **R39** and **R45**
  (open).
