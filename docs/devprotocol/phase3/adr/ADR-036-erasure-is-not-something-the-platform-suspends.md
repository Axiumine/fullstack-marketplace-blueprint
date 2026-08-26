# ADR-036 — Erasure is not something the platform suspends: `userDel` does not gate on `disabled`
# Marketplace

**Status:** accepted
**Date:** 2026-08-26
**Deciders:** platform owner, on the implementer's recommendation the same day `userDel` landed. The guard
was written this way first and flagged as an implementer's call; the owner ratified it and asked for it to
be recorded here rather than left in a source comment.
**Supersedes:** —
**Superseded by:** —

---

## Context

`userDel` (2026-08-26, `marketplace-dev-user-authenticated-resource`) is the first write on the customer
tier whose subject is **the account relationship itself** rather than a field inside it. Every other write
there edits data belonging to an account that continues to exist; this one ends it.

`disabled` is the operator's suspension flag, and it is enforced **at the edges of a session, not on each
write**:

- **at login** — `checkUserAuthorization` → `checkUserAuthorizationDisDel`
  (`BEs/marketplace-common/src/others/checkUserAuthorizationDisDel.mts:7-16`) throws 401 on `deleted` and
  then on `disabled`, so a suspended customer cannot obtain a new session at all;
- **on every refresh** — `findAccountForSession` re-reads the account and runs the same guard, which is
  what makes a suspension take effect within one *access*-token lifetime rather than one refresh-token
  lifetime.

⚠️ **On the customer resource service itself the guard is the exception, not the rule.** Exactly one lib
function calls it — `funUserUpdatePwd`, and its own comment says why: an access token is a bearer
credential, and a suspended customer must not be able to re-key the account on the way out. The five
address and personal-data writes call nothing; they rely entirely on the two edges above. So the tier
already accepts that a suspended customer holding a live token can edit their own data for up to one
access-token lifetime.

Three further facts fix the shape of the question:

- **`disabled` has a writer.** `funUserUpdateStatus` / `userUpdateStatus` on the Admin resource service
  (E19-S03, built 2026-08-25) is the operator lever that did not exist when the customer account model was
  written. Before it, this question could not arise.
- **The window is real but short.** `accessTokenExpiry()` in `@axiumine/koa-utils` randomises the access
  token between 30 and ~91 minutes. That is how long after a suspension a customer can still reach
  `userDel`, and there is no route to it afterwards.
- **GDPR Art. 17 applies as a matter of fact, not of scope** — NFR-CO02, open question 1 closed
  2026-08-26. Art. 17 carries no exception for an account the controller has suspended.

So the decision is not "may a suspended customer act" — the tier already answers mostly yes, briefly. It is
whether erasure belongs with `funUserUpdatePwd` in the small set of writes a suspension additionally
withholds.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Gate `userDel` on `disabled`, as `funUserUpdatePwd` does | One rule for the two writes that change an account's standing rather than its contents; an operator holding an account for fraud keeps it exactly as it was | Hands an operator a way to deny a data subject an Art. 17 right by flipping one boolean — no review, no recorded refusal, no expiry. It is also the wrong analogy: the password gate exists to stop a suspended account being *permanently re-keyed*, and closing an account takes nothing over, it gives it up |
| Gate on `disabled`, but let it expire — refuse for N days, then allow | Preserves a short investigative hold without making the denial permanent | Invents a duration nobody decided, needs a second timestamp to measure it from, and still refuses a right during the window with no way for the customer to hear why. A hold with legal weight is a legal hold, and that is not what this flag is |
| **No `disabled` gate; `deleted` still guarded (adopted)** | The right cannot be withheld by an operator action. The operator's record survives intact because the delete is soft — the document stays, `disabled: true` stays. Consistent with the five writes that already run no guard | The tier's one in-resolver guard now has to be understood as *specific to credential writes* rather than as a rule `userDel` is exempt from. That reading is correct but has to be written down, which is what this ADR is for |
| Refuse with a reason instead of silently — 403 naming the suspension | Honest to the customer, auditable | There is nothing to be honest *about*: no legal-hold concept exists here, so the reason would be "an operator suspended you", which is not a lawful ground to refuse erasure. Building the refusal before the ground exists is building the wrong half first |

---

## Decision

**`funUserDel` checks that the document exists and is not already stamped. It does not call
`checkUserAuthorizationDisDel`, and a suspended customer can close their own account.**

```ts
const user = await User.findById(_id).select('_id deleted').lean()

if (user === null) {
	throwUnauthorizedError()
}

if (user.deleted) {
	throwGoneError('account already closed')
}
```

Three properties make that safe rather than merely permissive:

1. **The delete is soft (ADR-011).** `deleted` gains a `Date` and nothing is removed. The document, the
   personal data, the addresses and `disabled: true` itself all survive the close — so whatever an operator
   suspended the account to preserve is still there afterwards. A hard delete would make this a genuinely
   hard call; a stamp does not.
2. **`deleted` is still a guard, and it answers 410, not 401.** 401 on this tier keeps its single meaning —
   *a resolver read your account and refused it*. An account already closed is a different fact, and
   `throwGoneError('account already closed')` says so; `userDel` is its first caller anywhere in the sixteen
   repos.
3. **The ordinary second call never reaches either branch.** `userDel` revokes every session in the same
   request, so the next one is refused **498** by the token layer before any resolver runs. The 410 is
   reachable only through a session that outlived the close.

The absence of the guard is pinned, not merely present: `test/userLib.test.mts` asserts a suspended seed
still writes the stamp and that the projection stays `'_id deleted'` — no flag is even read —
and `test/integration/account.itest.mts` closes a `disabled: true` account through the real HTTP mutation
against the real collection and asserts the flag is still `true` afterwards. Restoring the gate fails the
suite rather than passing quietly.

---

## Consequences

### Positive
- An Art. 17 right cannot be withheld by an operator action. That is the whole point, and it is the one
  property that would have been lost by reasoning from `funUserUpdatePwd` without asking what its guard is
  for.
- The operator loses nothing. Soft delete means the suspension, the record and the personal data are all
  still on disk after the customer closes — available to whatever the hold was for.
- It settles the shape of the tier's one in-resolver guard: it is a **credential-write** rule, not a
  general authorization rule with exceptions. Anyone adding a write here now has a stated test for whether
  it needs the guard — *does this let a suspended holder of a live token take the account over?*

### Negative
- Someone auditing the tier for "who checks `disabled`" finds one caller out of seven lib functions and has
  to come here to learn that the number is correct. The count looks like rot and is not.
- The exception is invisible from the resolver — `userDel.mts` calls `funUserDel`, and the guard's absence
  is a level down. The unit test is what makes it visible to a change, not the reading.

### Risks
- **`disabled` acquiring a second meaning.** The flag today means *an operator suspended this account*. If
  it ever also means a legal hold, a chargeback freeze or a retention duty, this decision is wrong and must
  be revisited — but the fix is a **new field with its own semantics**, not a gate re-added to this one.
  Revisit trigger: any story that makes `userUpdateStatus` mean more than "suspended".
- ~~**Erasure is built and not yet effective, for an unrelated reason.**~~ **Closed the same day, later:
  the purge shipped.** It is `user.deleted_ttl`, a TTL index over `deleted` rather than the scheduled job
  this bullet assumed — so the stamp `funUserDel` writes *is* the erasure order and MongoDB carries it out
  30 days later with no code involved. `login.email_unique` still carries no `partialFilterExpression`, so
  the address is freed by the document going rather than by the index ignoring it; re-registering the same
  address destroys the closed document outright and ends the wait early (ADR-011 §Amendment 2026-08-26).
  Struck rather than deleted because the reasoning above depends on it: property 1 of §Decision says the
  delete is soft and *nothing is removed*, and that is now true for 30 days rather than indefinitely. It
  does not weaken the decision — an operator's hold survives a close for the whole retention window, and
  a hold that needs to outlive it was never this flag's job (see the `disabled` risk above).
- **The Admin counterpart is still missing.** An operator can suspend a customer and cannot close one —
  there is no Admin-tier equivalent of `shopOwnerDel` for `user` (`phase5/epics/E19.md` §Open questions 3).
  Whoever builds it inherits this question from the other side and should not assume the answer is
  symmetric: an operator closing somebody else's account is not the exercise of a data-subject right.

---

## Compliance

Verify the guard's only in-resolver caller on the customer tier is still the password write:

```bash
# One hit, in funUserUpdatePwd.mts. funUserDel.mts appears only in prose explaining its absence.
grep -rn 'checkUserAuthorizationDisDel(' BEs/dev/marketplace-dev-user-authenticated-resource/src/lib/user/
```

Verify the absence is pinned rather than incidental:
`grep -n 'suspended' BEs/dev/marketplace-dev-user-authenticated-resource/test/userLib.test.mts` — the
`funUserDel` block must close a `disabled: true` account and assert the write still happened.

Verify the real path still closes a suspended account:
`test/integration/account.itest.mts` must seed `disabled: true`, close through the real mutation, and assert
both that `deleted` is a `Date` and that `disabled` is still `true`.

Verify the 410 keeps its own meaning:
`grep -rn 'throwGoneError' BEs/dev/` — every hit must be an *already in the requested end state* case, never
an authorization refusal.

A violation on disk looks like: `checkUserAuthorizationDisDel` called from `funUserDel.mts`, the
already-closed branch answering 401 instead of 410, or a test that asserts a suspended customer is refused.
