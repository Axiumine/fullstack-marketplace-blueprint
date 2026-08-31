# ADR-043 — The pending registration carries the destination collection's own field encryption
# Marketplace

**Status:** accepted
**Date:** 2026-08-29
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

[ADR-042](./ADR-042-registration-is-a-pending-redis-record.md) moves a registration out of MongoDB and into
Redis for up to the whole confirmation window. What moves with it is a person's name and email address and,
on `shopOwner`, everything else the form collects — which is to say the record is nothing *but* personal
data.

Redis has never held any before. What it holds today is identifiers and derived values: sessions keyed by
opaque token carrying an account `_id` and a tier (ADR-003, ADR-004), the wrapped Keygrip pair (ADR-034), and
rate-limit counters keyed at `${REDIS_KEY}rl:<bucket>:sha256(email)` — a digest, chosen so the counter can be
found without the address being stored. ADR-029 governs the other store: PII at rest is encrypted with
explicit CSFLE, deterministic on the five lookup keys and random everywhere else, and it says so of MongoDB
because MongoDB was the only place the question arose.

Two facts make the answer non-optional rather than a matter of taste.

**The Redis leg is cleartext.** ADR-039 put the datastores on a private segment the platform owner declared
trusted, which dropped **R45** to 🟢 Low — but the connection is still `redis://`, and the risk stayed open
for that reason. Sending registration PII across it in clear would raise a risk the topology decision
deliberately left standing, and would do it one ADR after the topology was written.

**Redis persists.** A pending record is transient by intent, not by mechanism: an RDB snapshot or an AOF
writes it to the Redis host's disk, where nothing about a three-day TTL applies to a file that already
exists, and a memory dump does not respect it either.

The owner ruled before the question was put in that much detail:

> *"yes keep in Redis same encription on filds that we planned for mongodb"*

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — cleartext in the pending record, relying on the TTL and the trusted segment | simplest; the record is a plain hash a human can read while debugging | puts PII on the cleartext leg R45 covers and on the Redis host's persistence files; makes the *"trusted segment"* declaration carry personal data it was not made about; and an unfinished registration would leave more exposure than a finished one, which is backwards |
| B — a scheme of Redis's own: AES-GCM under a new key | free choice of algorithm and format; no dependency on the CSFLE client during registration | a **fifth** shared secret and a second key lifecycle, against a §5 gap that already says nine files hold values nothing compares. And the ciphertext would be re-encrypted at confirm — decrypt under one key, re-encrypt under another, so the plaintext exists in process memory at the exact moment it did not have to |
| C — the same CSFLE call the destination path uses, with the same data key and the same algorithm | the bytes in Redis are the bytes MongoDB will store, so confirm is a copy and there is no decrypt/re-encrypt step at all; no new secret; the encryption rule stays in one list rather than two; deterministic ciphertext doubles as ADR-042's key material | registration now depends on the encryption client being up before it can so much as look a record up; a data-key rotation orphans in-flight records |
| D — keep the PII in MongoDB and put only a token in Redis | Redis holds nothing personal at all | this is ADR-042 option A or B again, and both were refused there: it means an account document exists before the click, which is the thing the owner ruled out |

---

## Decision

**Option C. Every field in the pending record is encrypted exactly when — and exactly how — its destination
path in MongoDB is encrypted.**

`encryptValue` in `BEs/marketplace-common/src/encryption/fieldEncryption.mts:130-132` calls the driver's
`ClientEncryption.encrypt(value, { algorithm, keyAltName })`. That is a driver API and not a storage API: it
takes a value and returns a BSON Binary, with no collection, no namespace and no write attached. It is used
unchanged here, with the algorithm and key the field would get on insert — `ALGORITHM_DETERMINISTIC` for
`login.email`, one of the five lookup keys ADR-029 names, and `ALGORITHM_RANDOM` for everything else.

**The rule is derived, not restated.** The record encrypts a field if and only if that field appears in
`ENCRYPTED_FIELDS_USER` or `ENCRYPTED_FIELDS_SHOPOWNER`, read from the same list the collection reads. A
second hand-maintained list would be a place for the two stores to disagree, and disagreement here is silent:
a field added to the encrypted list but forgotten in the record would sit in Redis in clear and arrive in
MongoDB as a plaintext string in a `binData` path, which the validator rejects at confirm rather than at
submit — three days after the mistake, to the person who did nothing wrong.

Everything else in the record stays as it is, because its destination is cleartext too: the bcrypt hash,
which is already one-way and lands in `login.password` unencrypted at exactly 60 characters; the confirmation
hash; `requestTimes` and `dateLastReq`; and the minted `_id`.

**Confirm therefore performs no cryptography.** It reads the hash, and writes the values it read. The
plaintext address it needs for nothing else arrives in the confirmation URL, from the person clicking it —
so no path in this design decrypts a pending record, and none should be added for convenience. A resend, if
one is ever built, is the one case that would need `decryptValue`, and it is not built.

**ADR-029 is extended, not amended.** None of its decisions change: the same five fields are deterministic,
the same algorithm choices apply, the same data keys are used. What changes is the reach of the sentence —
the rule was written about a collection and now travels with the value.

---

## Consequences

### Positive
- **R45's residual does not move.** The cleartext Redis leg carries ciphertext, so ADR-042 adds no personal
  data to the connection ADR-039 left plaintext, and the trusted-segment declaration is not asked to cover
  something it was not made about.
- **Confirm is a copy.** The bytes written to MongoDB are byte-identical to the bytes Redis held, which
  removes a whole class of round-trip defect — no re-encryption, no format conversion, no moment where the
  plaintext exists in memory because the storage formats differed.
- **The deterministic ciphertext is reused rather than recomputed.** ADR-042's key needs a stable value
  derived from the address; the encrypted `login.email` already is one, so the record's key and its content
  come from the same call.
- **No fifth shared secret.** The §5 gap on secrets provisioning does not grow, and ADR-040's delegation of
  the vendor choice to the adopter keeps the same four values to swap.
- **An abandoned registration leaves encrypted bytes that expire.** Compared with today, where an abandoned
  registration leaves a permanent MongoDB document, this is strictly less exposure and less of it.

### Negative
- **Registration depends on the encryption client at lookup time, not just at write time.** The pending
  record cannot even be *found* without `encryptValue`, because the key is derived from it. A KMS or data-key
  failure takes registration down completely — though it equally takes every encrypted read down, so this
  widens an existing dependency rather than creating one.
- **The record is opaque in `redis-cli`.** Debugging a stuck registration means reading `requestTimes` and a
  TTL and inferring the rest. That is the intended trade and it should be said out loud, because the
  temptation it creates is to add one cleartext field *"just for support"*.
- **Deterministic encryption leaks equality, in the key as well as in the index.** Anybody who can list keys
  can tell that two pending registrations are for the same address without learning the address. ADR-029
  accepts that leak on `login.email` in MongoDB's index for the same reason it is accepted here: the field
  has to be findable by value, and a random ciphertext is not.

### Risks
- **A data-key rotation orphans every in-flight record**, because the derived key changes. They expire
  within one confirmation window and nothing confirmed is affected, but a rotation run during a mail outage
  compounds two silent failures. Revisit if key rotation is ever automated.
- **A field added to a collection's encrypted list and forgotten in the record.** The failure lands at
  confirm, on somebody else's registration, days later. The derived rule is what prevents it, so the risk is
  really *someone reintroducing a hand-written list*, and §Compliance greps for exactly that.
- **The plaintext still exists at submit, in the request and in the outbound mail.** This ADR is about
  storage; it makes no claim about the mail leg, which carries the address in the clear by necessity and is
  covered by whatever the adopter's SMTP transport does (`docs/PRODUCTION_HARDENING.md`).

### Build record

- **Built.** The pending record carries the address as the same deterministic ciphertext the
  collection indexes, so the confirmation click copies it rather than re-encrypting it, and the uniqueness
  check before the click is the index's own answer. [ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md)
  later moved the replay discriminator off the pre-minted `_id` for a reason that starts here: a restore
  mints no id, so an `_id` check would answer *no* over a registration that committed.

---

## Compliance

```bash
# 1. The record's encryption is derived from the collection's list — one list, not two.
grep -rn "ENCRYPTED_FIELDS_USER\|ENCRYPTED_FIELDS_SHOPOWNER" BEs/dev/marketplace-dev-public-resource/src/

# 2. No plaintext personal field is written into a pending record. Expect no hit that puts a raw
#    args.email / args.name into the hash.
grep -rn "pending" BEs/dev/marketplace-dev-public-resource/src/lib/

# 3. Nothing decrypts a pending record. Expect zero hits in the registration path.
grep -rn "decryptValue" BEs/dev/marketplace-dev-public-resource/src/
```

The integration suite must show the two halves agree: a value encrypted into a pending record and then
written to MongoDB by the confirmation handler has to satisfy the collection's `$jsonSchema` — which is the
only check that actually proves the algorithm and data key matched, since a wrong-but-well-formed ciphertext
is indistinguishable from a right one until the validator or a decrypt says otherwise. A test that asserts
"the value is a `Binary`" proves nothing.

A violation on disk looks like: a second enumeration of encrypted field names anywhere in the registration
path; a cleartext address, name or any `ENCRYPTED_FIELDS_*` member written into a pending record; a
`decryptValue` in the registration path; a Redis-only encryption key or algorithm appearing in the committed
`env` templates or in `marketplace-common`; or `sha256` being used to key a pending record, which would work
and would quietly cost the reuse the deterministic ciphertext exists to provide.
