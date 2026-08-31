# ADR-042 — A registration lives in Redis until the link is clicked; no account document exists before then
# Marketplace

**Status:** accepted, **superseded in part 2026-08-29**
**Date:** 2026-08-29
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** [ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md), **in part** — everything
about the pending record stands; what changes is what the confirmation does when a *closed* account still
holds the address. It no longer scrubs that account to make room for a new one: it restores it.

---

## Context

[ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) commits the platform to a window
it cannot currently honour. The owner's requirement:

> *"days 1-30 the user must be able to register again !! if an user in that window tried to register again,
> actual account email will be changed to something like userid@invalid.local when he will click the link to
> confirm the email, not before that."*

Two clauses, and the second is the hard one. The address must be *usable* from day 1, but the closed
account must not be touched until the person **proves control of the address by clicking the link**. Between
the submit and the click there is a period — up to three days — in which one address has two claimants and
only one of them has proved anything.

Today that period is spent with both claimants in MongoDB, because
`BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/mutations/userRegister.mts:86-115` creates
the account document at **submit** time, unverified, and lets `login.email_unique` arbitrate. That works only
because the mutation reaches for a hard delete first: `purgeClosedUser` destroys the closed document inside
the same transaction, so there is never a second claimant. ADR-041 removes that delete, and with it the only
thing holding the design together.

Everything else in the flow is built on the same load-bearing assumption that a half-finished registration is
a real document, and all of it is defective in a way that has nothing to do with retention:

- **`deleted` means two different things.** It is the closure stamp, and it is also what koa-utils'
  `abandonUser` writes when somebody fails the confirmation five times. `restartUserRegistration.mts` and
  `restartShopOwnerRegistration.mts` exist only to tell those two apart, and one of them gets it wrong.
- **`shopOwnerRegister.mts:90-112` never reads `existing.deleted` at all.** It has two branches where
  `userRegister` has four, so an admin-closed but unverified shop owner falls into the *"unfinished attempt"*
  branch, and `restartShopOwnerRegistration.mts:30-38` unconditionally `$unset`s `deleted` — reviving an
  account an admin closed, through an unauthenticated public mutation, with a caller-supplied password,
  and without restoring the `waitApprov` gate that `funShopOwnerDelete.mts:20` removed. The repository's own
  suite names the case: `test/shopOwnerRegisterMutation.test.mts:236-248`, *'a tombstoned unverified
  document'*, asserting the revival.
- **An address a nobody-ever-clicked registration is holding is held forever.** The abandon guard is lazy —
  `assertVerifyEmailAllowed.mts:68-98` runs on a visit to the link — so a registration that is never visited
  is never abandoned, and no sweep exists. `shopOwnerRegister` then answers the real owner of that address
  *"you are already registered"*, permanently.
- **The confirmation is not transactional.** koa-utils' `router/verifyEmail.mts:22-46` performs three
  independent database calls and none of them accepts a session.

Asked whether to keep the two tiers on different flows, the owner uniformed them:

> *"yes I like to uniform, all registration live in redis a spending"*

Redis is already a dependency of the very service that would hold the record — `index.mts:202` boots
`Promise.all([MongoDBConnect(), RedisConnect()])` — and the registration path already uses it:
`assertUnderRateLimit.mts:53-72` keys a counter at `${REDIS_KEY}rl:<bucket>:sha256(email)`, so keying by a
value *derived* from an address rather than by the address itself is established practice here rather than
an invention.

⚠️ **Redis runs clustered**, and `revokeAllSessionsForAccount.mts:9-22` records what that costs: a multi-key
operation throws `CROSSSLOT`. Anything holding one pending registration has to be **one key**.

`Admin` is out of scope throughout: administrators are seeded, never publicly registered, so only `user` and
`shopOwner` have a registration to move.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — keep creating the document at submit, and let the second claimant tombstone the first there and then | no new store, no new shape; the smallest possible change to the four branches | the owner refused it in as many words — *"when he will click the link to confirm the email, **not before that**"*. Anyone who can type an address into a public form could scrub a live closed account's record, unauthenticated, by never clicking anything |
| B — keep creating the document at submit, and let two documents hold one address until the click resolves it | preserves the existing flow shape entirely | needs `partialFilterExpression`, refused by ADR-011 and again by ADR-041: `tryLoginUser.mts`, `userForRegistration.mts` and the verify-email flow all read by email with no liveness filter, so `findOne` picks an arbitrary one and login becomes a coin toss |
| C — a seventh MongoDB collection, `pendingRegistration`, with its own unique index and a TTL | durable, in the system of record, transactional with the insert that consumes it | a TTL index is a hard delete, which is the exact mechanism ADR-041 retires one ADR earlier — it would be reintroduced on the very next page. It also costs a validator, a migration, its own CSFLE data key and a second store of truth for *is this address taken*, all for state whose entire purpose is to expire |
| D — the pending registration is one Redis key, with the key's TTL as the confirmation window | expiry **is** abandonment, so the lazy guard, its five-attempt counter on the document and the forever-held address all disappear rather than being fixed; the collision cannot occur, because until the click there is only ever one document; single-key, so cluster-safe; the store is already connected in the service that needs it | Redis becomes load-bearing for a flow that used to survive in MongoDB — a flush loses every in-flight registration; the confirm step now spans two stores and has to be idempotent across a crash between them |

---

## Decision

**Option D, on both tiers. A registration is a pending record in Redis. No `user` or `shopOwner` document
exists until the confirmation link is clicked.**

### The record

One key, one hash, cluster-safe by construction:

```
key    ${REDIS_KEY}pending:<tier>:<deterministic ciphertext of login.email, hex>
type   hash
ttl    the confirmation window, set with EXPIRE on the key
```

The key is derived from the **deterministic ciphertext** of the address, not from the address — the same
value MongoDB will index, stable because deterministic encryption derives its IV from the plaintext, and it
keeps cleartext addresses out of Redis entirely ([ADR-043](./ADR-043-pending-registration-carries-csfle-ciphertext.md)
covers the record's fields). The tier is in the key because `user` and `shopOwner` are different accounts
that may legitimately share an address.

The hash carries what the account document used to carry before confirmation: the encrypted field values,
the bcrypt password hash, the confirmation hash, `dateLastReq` and `requestTimes` — **the five-attempt
counter moves off the document and into the record**, where it expires with everything else — and one thing
the document could not carry, the `_id` the account will be created with, **minted at submit**.

### Submit

`userRegister` and `shopOwnerRegister` write nothing to MongoDB. They read it, to decide which of three
answers to give, and the branch order is the one `userRegister.mts:97` already gets right:

| What MongoDB holds for that address | Answer |
|---|---|
| a document with `deleted` stamped | proceed — write the pending record, send the link. The closed document is **not touched** |
| a live document | send the *"you are already registered"* mail. Nothing is written, and the response does not distinguish this case from the one above |
| nothing | proceed — write the pending record, send the link |

A pending record already existing for that address is not a fourth case: the submit overwrites the same key
and refreshes its TTL, which is idempotent because it is one key. `assertUnderRateLimit` still stands in
front of all of it at three per hour.

### Confirm

The click is the only writer of an account document, and it is one MongoDB transaction:

1. read the pending record; absent or expired → the link is dead, and the answer is the same one a wrong
   hash gets;
2. inside `session.withTransaction`:
   **a.** if a closed document still holds the address, scrub it — ADR-041's overwrite, brought forward from
   day 30 to the moment the address is genuinely reclaimed, which frees the address by changing its value
   rather than by removing anything;
   **b.** insert the new document with the `_id` from the record, `emailVerify.valid` true, and — on
   `shopOwner` — `waitApprov` true, written here so the approval gate cannot be skipped by a path that
   forgets to restore it;
3. delete the Redis key.

**Idempotency across a crash between steps 2 and 3** is what the minted `_id` buys: a replayed confirm finds
the key still present, re-runs the transaction, and the insert fails on the duplicate `_id` with `E11000`.
That is the signal that the work already committed — the key is deleted and the caller is told the address is
verified. Without the pre-minted `_id` the replay would insert a second account.

⚠️ **The confirmation handler moves out of koa-utils and into `marketplace-dev-public-resource`.** It has to:
it reads Redis, opens a MongoDB session and writes two collections, and `router/verifyEmail.mts:22-46` takes
no session while `assertVerifyEmailAllowed.mts:68-98` guards a document that no longer exists at that point in
the flow. ADR-028 is unaffected — three REST endpoints, email verification only — only their implementation
changes address. `abandonUser`, `assertVerifyEmailAllowed` and the `onAbandon: 'soft-delete'` wiring stop
being called by this platform.

### What this deletes

`restartUserRegistration.mts` and `restartShopOwnerRegistration.mts` go, both of them, along with the
question they existed to answer. **The shop-owner revival is fixed by deletion rather than by a branch** —
there is no unverified document to revive, because an unverified registration is not a document. `deleted`
stops meaning two things and means only *this account was closed*.

---

## Consequences

### Positive
- **The window ADR-041 promises is honoured exactly as specified**, including *not before that*: the closed
  account is untouched until somebody proves control of the address.
- **A live security defect is removed rather than patched.** An admin's closure of a shop owner can no longer
  be undone by an anonymous form post, and `waitApprov` can no longer be skipped, because the path that did
  both no longer exists. `test/shopOwnerRegisterMutation.test.mts:236-248` inverts from asserting the revival
  to asserting there is nothing to revive.
- **Abandonment stops being a state and becomes an expiry.** The address a never-clicked registration used to
  hold forever is free the moment the key dies. No sweep, no lazy guard, no `deleted` stamp that a later
  reader has to disambiguate.
- **The two tiers finally run one flow.** Four branches on one side and two on the other was how the
  shop-owner defect survived review; there is now one path, and a defect in it is a defect in both.
- **Confirmation becomes atomic and gated.** Three untransacted calls become one transaction, and the handler
  moves into a repository ADR-016 governs — koa-utils is not one of the sixteen.
- **An unconfirmed registration leaves no personal data in MongoDB at all**, which is a retention improvement
  ADR-041 did not ask for: the data of somebody who started an account and never finished expires on its own.

### Negative
- **Redis is now load-bearing for registration.** It was already load-bearing for sessions, but a lost
  session is a re-login and a lost pending record is a registration the person has to start again. Nothing
  *confirmed* is at risk, which is the line that matters, and it is the price of Option D over Option C.
- **The confirm path spans two stores**, so it can only be idempotent rather than atomic end to end. The
  minted `_id` makes the replay safe; it does not make the two writes one.
- **Two places now answer *is this address taken*** — MongoDB for accounts, Redis for attempts — and a
  reader has to know that the second one is not authoritative and never blocks a submit.
- **The five-attempt counter is per-address, not per-account, and it resets when the key expires.** That is
  the same practical behaviour as today's document-borne counter, arrived at differently, but it is
  now bounded by the TTL rather than by a stamp somebody has to clear.

### Risks
- **A Redis flush during a deploy silently drops in-flight registrations.** The failure is invisible — the
  link simply reports itself dead, exactly as an expired one does. Revisit if the confirmation window is ever
  lengthened to a point where the loss stops being a minor annoyance.
- **The key must stay one key.** A future field that tempts a second key — an index of pending registrations,
  a per-tier set, a counter beside the hash — reintroduces `CROSSSLOT` on a cluster, and it will pass every
  test on a single-node development Redis. `revokeAllSessionsForAccount.mts:91-130` is the precedent for how
  to want a multi-key operation and not take one.
- **A pending record outliving its usefulness because the TTL was never set.** `EXPIRE` is a second call
  after the write; a path that writes the hash and returns without it holds the address's attempt slot with
  no expiry. The write and the expiry belong in one function.
- **The deterministic key derivation depends on the DEK.** Rotating the data key changes every pending
  record's key, orphaning in-flight registrations. They expire on their own, so the blast radius is one
  confirmation window, but a rotation should not be run alongside a mail outage.

### Build record

- **Built, as part of the account-state model (ADR-044).** A submitted registration writes Redis and nothing else: a three-day TTL record
  carrying the pre-minted `_id` and the bcrypt hash, replay-safe across a lost commit acknowledgement, and
  every outcome — free, taken, pending or closed — answering the same check-your-mail page, so the form is no
  enumeration oracle.

---

## Compliance

```bash
# 1. The two restart paths are gone, not merely unreferenced.
ls BEs/dev/marketplace-dev-public-resource/src/lib/db/restart*Registration.mts 2>/dev/null && echo VIOLATION

# 2. Neither register mutation writes an account document. Expect zero hits.
grep -n 'User.create\|ShopOwner.create' BEs/dev/marketplace-dev-public-resource/src/graphQLPublic/schema/mutations/

# 3. Exactly one writer of each account document, and it is the confirmation handler.
grep -rn '\.create(\|insertOne' BEs/dev/marketplace-dev-public-resource/src/

# 4. The pending record is one key. Expect no MSET/MGET/DEL-with-two-keys and no pipeline over
#    two pending keys anywhere in the registration path.
grep -rn 'pending:' BEs/dev/marketplace-dev-public-resource/src/
```

The confirmation must be proved against a real replica set, not a mock: `test/integration/` has to show that
a closed account's address is reclaimed and the new document inserted **in one transaction** — a mid-flight
abort must leave the closed document holding its original address — and that replaying a confirmation after
the key was deleted, and after it was not, both end in one account.

A violation on disk looks like: an account document created anywhere but the confirmation handler; a
`deleted` stamp written by anything other than a closure; `abandonUser` or `assertVerifyEmailAllowed` being
called again; a pending record written without an `EXPIRE`; the `_id` being minted at confirm rather than
read from the record; or a second Redis key participating in one registration.
