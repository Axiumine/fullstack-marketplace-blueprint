# ADR-040 — The secrets-manager vendor choice is the adopter's, not this blueprint's
# Marketplace

**Status:** accepted, amended 2026-08-28
**Date:** 2026-08-28
**Amended:** 2026-08-28, hours after acceptance, **in place at the platform owner's instruction** rather than
by the `## Note` foot this file would otherwise carry. What changed is one *Negative* bullet and one
*Compliance* greps, which described a duplication the same day's work removed: `readKek` is now the
single decode of `KEYGRIP_KEK` in TypeScript. The decision itself — the vendor choice is the adopter's — is
untouched, and so is every option, consequence and risk that turns on it. `ADR-INDEX.md` §1 says ADRs are
immutable once accepted; this is the second exception in the tree, after
[ADR-011](./ADR-011-soft-delete-and-global-uniques.md), and it is an exception on the same grounds: the owner
authorised it, and the alternative was an accepted ADR that misdescribes the code it greps for.
**Deciders:** platform owner, ruling directly on ADR-034's last open question — *does the wrapping key
have a custody story of its own* — for a repository that is
**published as a blueprint rather than operated as a deployment**, the same standing the
[ADR-037](./ADR-037-marketplace-common-is-published-to-npm.md) *Deciders* line already records. The ruling,
verbatim:

> **"A blueprint cannot make the vendor decision — Vault vs SOPS vs AWS KMS vs GCP depends on where the
> adopter deploys."**

**Supersedes:** —
**Superseded by:** —

---

## Context

[ADR-034](./ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md) put the cookie-signing keys in one
AES-256-GCM-wrapped Redis record and left exactly one secret in `env` to open it: `KEYGRIP_KEK`. That ADR
listed five options and rejected the fifth, in these words:

> | **E** — a secrets manager (Vault, SOPS, cloud KMS) distributes the pair | the industry answer; solves
> this and `REDIS_PASSWORD` and `MONGODB_URI` in one move | needs the production topology ADR-032
> says is owed, an admin story nobody has, and a vendor decision that has not been made. Not available
> to take today |

and, in its Decision:

> E is the destination, not a decision that can be taken in August 2026; when ADR-032 is answered and a
> manager exists, the KEK moves into it and this record's Redis half may become redundant. That is this
> ADR's revisit condition.

[`ADR-INDEX.md`](./ADR-INDEX.md) §5 carries the matching gap, and on **2026-08-28** it recorded that half of
the revisit condition had just been met:

> ⚠️ **That block is gone since 2026-08-28**: [`ADR-039`](./ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md)
> answers it — one application host behind Cloudflare, datastores on their own host — so option E is
> choosable now. The bullet stays open because nobody has chosen it: the nine files are still nine.

⚠️ **Read those three quotations for what they say, and not for what a reader closing a ticket wants them to
say.** Each one describes a decision **that has not been made**. Not one of them says the decision belongs to
somebody other than this platform, and until this ADR nothing in the corpus did. That distinction is the whole
of why this file exists: ADR-034 wrote a revisit condition assuming this platform would one day stand up a
manager, ADR-039 satisfied the blocking half of it, and the question that then landed on the platform owner
was the plain one — *ADR-032 is answered, so choose*.

The answer was that the premise of the revisit condition is wrong for this repository. This is not a
deployment that will one day acquire a manager. It is sixteen repos published for other developers to clone,
and the four candidate answers are not interchangeable: **Vault** is a service an adopter must run and seal,
**SOPS** is a file convention with a KMS or age key behind it, **AWS KMS** and **GCP Secret Manager** each
bind the deployment to one cloud's IAM. Picking one here does not give an adopter a working custody story;
it gives them a wiring harness for somebody else's infrastructure, which they must then rip out.

The house already draws this line twice, in the two most recent decisions of the same kind:

- [**ADR-037**](./ADR-037-marketplace-common-is-published-to-npm.md) decided publication *"directly, on the
  ground that this platform is a blueprint published for the community rather than a private deployment."*
- [**ADR-038**](./ADR-038-commerce-is-permanently-out-of-scope.md) declined cart, order, delivery and payment
  outright rather than deferring them, so the corpus stopped describing them as pending.

This ADR does for one secret-custody question what ADR-038 did for commerce: it converts *not decided yet*
into **decided, and decided not to** — which is a materially different state, and one a reader can act on.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **A** — leave the gap open, exactly as it stands | zero work; no claim can go stale | it is the state that has held since 2026-08-13 and it has now outlived its only stated blocker. A gap that nothing is waiting on is not a gap, it is an unanswered question with no owner. ADR-034's KEK-custody question and `R50` both stay open forever with no reason on file, and every future reader re-derives this same analysis |
| **B** — choose a vendor now and wire it in | closes the question with running code; matches the industry answer ADR-034 already named | this workspace has never run against any of the four. The choice would be made by whoever typed it rather than by anyone who had operated it, and it forces one cloud's IAM or one sealing story onto every adopter — most of whom run something else. ⚠️ It also cannot be tested here: there is no production deployment, so the integration would ship at 100% coverage against a mock and 0% against reality |
| **C** — ship a vendor-neutral provider seam (`IKeygripKekProvider` or similar) with an `env` reference adapter, choose no vendor | keeps the blueprint neutral while giving adopters a typed swap point; `marketplace-common` already carries interfaces of exactly this shape — `IKeygripReadStore` and its neighbours in `readKeygrip.mts` exist so the library never names a concrete driver's types | a seam is a guess about a shape, and this one would be guessed against **zero** real integrations. The three interfaces cited as precedent were extracted from a driver already in use; this one has nothing to extract from. It also enlarges the surface the ruling is about rather than settling it: a provider that resolves independently at each call site reintroduces exactly the split-brain ADR-034 exists to refuse. *(Amended 2026-08-28: this cell originally cited the two call sites in `marketplace-dev-admin-authenticated-resource` that decoded the KEK themselves. They now call `readKek`, so the objection no longer has that example behind it — but it does not weaken, it sharpens: the seam would put a resolver behind the one decode site the platform has, which is the whole surface, not part of it.)* |
| **D — chosen** — decline the vendor choice permanently, delegate it to the adopter, and document every swap point precisely | honest about what this repository can and cannot know; costs no code, so it cannot rot, cannot drift from an untested integration, and cannot be wrong about a vendor nobody here runs; gives an adopter the one thing a blueprint can actually give — the exact file, line and invariant to change | the platform ships with a documented hand-provisioning story and no automation, and a page nothing enforces. An adopter who does not read it deploys with a hand-copied KEK on every host, which is precisely `R50`'s residual, unchanged |

---

## Decision

**Option D.** This blueprint does not choose a secrets-manager vendor, and will not — the decision belongs to
whoever deploys it, because it is determined by where they deploy. `KEYGRIP_KEK` stays a per-machine `env`
value here; [`docs/PRODUCTION_HARDENING.md`](../../../PRODUCTION_HARDENING.md) records the exact swap points
and the invariants that must survive a swap, for that secret and for the other three shared values.

Three things follow. They are **consequences of the ruling, not part of it** — the owner ruled on the vendor
choice, and the rest is what that choice being absent forces:

1. **ADR-034's revisit condition cannot be satisfied inside this repository.** It reads *"when ADR-032 is
   answered and a manager exists, the KEK moves into it"*. ADR-032 is answered (ADR-039). A manager will not
   exist here. ⚠️ ADR-034 is **not** superseded and its decision is untouched — Option D of ADR-034 remains
   what this platform does, and it was always the right call for a machine that has no manager. What changes
   is that its revisit condition now names an event that happens in an **adopter's** tree rather than in this
   one.
2. **Escrow and automated cross-machine KEK rotation are not built here.** Both are properties of a manager:
   escrow is the manager holding a recoverable copy, and cross-machine rotation is the manager distributing a
   new value atomically. Building either without a manager means building a small one, against no vendor —
   which is Option B's untestability with Option C's guesswork. They are delegated with the vendor, to the
   adopter, and the swap-point page says where they attach.
3. **This decides nothing about the cross-file agreement check.** A vendor-neutral fingerprint sweep — proving
   nine `env` files hold the same `REDIS_KEY` before a deploy — needs no vendor and is not declined here. It
   remains open under **R39** and [`INFRA.md`](../INFRA.md) §14 q8, exactly as open as it was this morning.
   ⚠️ Do not cite this ADR as having closed it.

What the platform keeps as its own control is what ADR-034 already built and what this ADR deliberately does
not weaken: a service whose KEK cannot open the record logs `KEYGRIP_KEK_MISMATCH` and exits 1 at boot
instead of signing cookies its siblings cannot verify. That gate is a **boot-time** check, never a pre-deploy
one, and calling it anything else is the misreading this ADR most wants to prevent.

---

## Consequences

### Positive

- **A long-standing open question gets an answer instead of a fourth restatement.** ADR-034's KEK-custody
  question has been open since it was written, was retargeted once from the CSFLE master key to the KEK,
  and outlived R02's closure (2026-08-13, the keygrip rotation-propagation measurement) by being split out into `R50` rather than solved. It closes here — not because the operational problem went away, but because the question it
  asks is *does a custody story exist and is it this platform's to build*, and the answer is now on file.
- **An adopter gets something a chosen vendor would not have given them.** The swap points, the invariants,
  and the reason each one is where it is — which is portable to Vault, SOPS, KMS or a shell script, and
  survives all four.
- **The corpus stops describing a destination it will never reach.** ADR-034's *"E is the destination"* has
  read as a roadmap item since it was written. It now reads as a roadmap item for somebody else's repository,
  which is accurate.
- **Nothing ships that cannot be tested.** No code changes, so the four coverage metrics stay at 100 and
  mutation stays at 100 in all fifteen code-shipping repos, by construction rather than by effort.

### Negative

- **The platform's own secret handling is unchanged and unimproved.** `KEYGRIP_KEK` is still copied by hand
  onto every machine that needs it — six of the nine services plus `marketplace-db-setup` — and there is
  still no escrow. `R50` is **accepted**, not closed, and its residual text does not move.
- **A documentation control is the weakest kind.** No gate reads `docs/PRODUCTION_HARDENING.md`, no test
  asserts it is current, and an adopter who skips it is in exactly the position `R50` describes.
- **The KEK is decoded in one place in TypeScript, and that place is not free.** `funKeygripRotate.mts` and
  `funKeygripRetire.mts` each used to decode the KEK themselves; both now call `readKek`
  (`marketplace-common` 2.0.3), which `readKeygrip` calls too, so `src/` across the fifteen repos holds
  exactly one `process.env.KEYGRIP_KEK`. That gives an adopter one line to change instead of three — but it
  buys **one swap point, not one value**. Two reads of `process.env` in one process always agreed; three
  *processes* resolving a manager independently still need not, and the rule that covers that is the
  hardening page's (resolve once per process, before start), not this refactor's. Anyone reading
  "centralised" as "the split-brain is handled" has read it wrong.
- **`BEs/marketplace-db-setup/lib/keygrip.js:88` stays a fourth, separate decode, permanently.** That repo is
  plain JavaScript, depends on `dotenv`, `migrate-mongo`, `mongodb`, `mongodb-client-encryption` and `redis`,
  and has no dependency path to `marketplace-common` — deliberately, because it seeds the record before any
  service exists. It carries its own `readKek(env)` helper and its own copy of the 32-byte rule. Two
  definitions of one invariant is the price of that separation, and the hardening page names both.

### Risks

- **A reader treats this ADR as having solved KEK custody.** It has not: it decided who owns the problem.
  Mitigated by `R50` staying a scored row with its residual intact, by this ADR's Decision §3, and by
  `ADR-INDEX` §5's bullet staying **open** rather than struck.
- **A future contributor "finishes the job" by adding a Vault client.** That contradicts an accepted ADR and
  needs a superseding one, which is the platform owner's call alone. The Compliance greps below are what
  catches it.
- **`docs/PRODUCTION_HARDENING.md` goes stale against the code it cites.** Every file:line in it is a real
  path today; none is enforced by a gate. Mitigated only by the page citing invariants (`KEK_BYTES === 32`,
  the two `KEYGRIP_KEK_MISMATCH` messages) alongside the line numbers, so a moved line is still findable.
- **Reopening trigger:** this platform is operated as a real production deployment by the platform owner, or
  an adopter reports the documented swap recipe insufficient in practice. Either takes a superseding ADR.

---

## Compliance

No secrets-vendor SDK, in any of the sixteen repos:

```bash
# Zero hits. A dependency named for one of the four is this ADR being reversed without a superseding ADR.
grep -rE '"(node-vault|@hashicorp/|@aws-sdk/client-kms|@google-cloud/secret-manager|sops)' \
  --include='package.json' BEs FEs marketplace-* | grep -v node_modules
```

No provider abstraction over the KEK — the swap point stays the `env` read itself, and there is one of it:

```bash
# Zero output. Every hit belongs in readKek.mts — the decode itself and the doc comment that says it is the
# only one — so anything this prints is a call site that grew a private Buffer.from back.
grep -rn 'process\.env\.KEYGRIP_KEK' --include='*.mts' BEs/*/src BEs/dev/*/src | grep -v '/readKek\.mts:'
```

And the decode it is excluding must still be there — zero hits here means the single decode moved and both
this ADR and the hardening page now lie about where it is:

```bash
# Exactly one hit: BEs/marketplace-common/src/others/readKek.mts:25.
grep -rn "process\.env\.KEYGRIP_KEK ??" --include='*.mts' BEs/*/src BEs/dev/*/src
```

The hardening page exists and still names all three shared values:

```bash
# Three, one per value. A missing one means the page drifted from what SETUP.md §5 provisions.
# ⚠️ `grep -c` counts LINES, not values, and returns a number in the teens that looks like a failure and is
# not — this form was `-c` when the ADR was accepted, and that was a defect in the check, corrected in place.
grep -oE 'KEYGRIP_KEK|REDIS_PASSWORD|REDIS_KEY' docs/PRODUCTION_HARDENING.md | sort -u | wc -l
```

The framing must stay *declined*, never *pending*:

```bash
# Any hit pairing a vendor name with deferral language is a regression to the pre-ADR-040 corpus.
grep -rniE '(vault|sops|secrets manager|secret manager|kms)' --include='*.md' docs/ *.md \
  | grep -iE '\byet\b|not yet|when we|once we|planned|owed|to be chosen'
```

A violation on disk looks like: a vendor SDK in any `package.json`, an `IKeygripKekProvider` or equivalent
interface in `marketplace-common/src`, `ADR-INDEX` §5's shared-secret bullet struck through, `R50` marked
`Closed`, or any document describing a secrets manager for this platform as forthcoming.

---

## Related

- [ADR-034](./ADR-034-keygrip-keys-live-in-redis-wrapped-under-a-kek.md) — the decision this one bounds; its
  Option D is unchanged, its revisit condition is now an adopter's event.
- [ADR-039](./ADR-039-production-topology-cloudflare-app-host-trusted-datastore-segment.md) — removed the
  blocker on 2026-08-28, which is what made this decision due the same day.
- [ADR-037](./ADR-037-marketplace-common-is-published-to-npm.md) and
  [ADR-038](./ADR-038-commerce-is-permanently-out-of-scope.md) — the blueprint-standing precedent, and the
  *declined rather than deferred* precedent.
- [`docs/PRODUCTION_HARDENING.md`](../../../PRODUCTION_HARDENING.md) — the deliverable this ADR ships instead
  of an integration.
- [`phase5/RISK_REGISTER.md`](../../phase5/RISK_REGISTER.md) **R50** (accepted, §5) and **R39** (open,
  unchanged in scope).
- ADR-034's KEK-custody question — closed on this decision, the last of the four custody-and-rotation
  questions this platform has been carrying, all closed by 2026-08-28.
