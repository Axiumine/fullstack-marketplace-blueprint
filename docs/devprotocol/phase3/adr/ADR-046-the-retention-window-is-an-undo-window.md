# ADR-046 — The retention window is an undo window: re-registering at the same address restores the account
# Marketplace

**Status:** accepted
**Date:** 2026-08-29
**Deciders:** platform owner
**Supersedes:** [ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md), **in part** —
closure stays a stamp and nothing is ever destroyed, but it is no longer irreversible for the first thirty
days. [ADR-042](./ADR-042-registration-is-a-pending-redis-record.md), **in part** — the confirmation no
longer scrubs a closed holder to free its address. [ADR-045](./ADR-045-an-inactive-shop-owner-takes-the-storefront-off-air.md),
**in part** — the closing paragraph that reads *"a `deleted` stamp is never lifted, and re-registering
inside the window mints a new `_id` — which owns no company, so there is nothing for it to re-enable."*
**Superseded by:** —

---

## Context

ADR-041 gave a closed account a thirty-day retention window and made closure permanent: the document stays
for ever, its personal data is overwritten on day 30, and nothing ever clears `deleted`. ADR-042 then had
the registration confirmation reclaim the address early — a closed holder was scrubbed at the click, so
somebody re-registering on day 3 got a brand-new document and the old one was erased twenty-seven days
ahead of schedule.

The platform owner asked the question that undoes both:

> *"but, in the 1-30 days window, what the purpose to keep the user data if he register in that window and
> new document will be created ?!?!?"*

It is the right question and it had no good answer. With commerce permanently out of scope
([ADR-038](./ADR-038-commerce-is-permanently-out-of-scope.md)) there are no disputes, chargebacks or
refunds to retain for, and closure was irreversible, so the window's only remaining consumer was an
admin wanting to recognise a closed account for thirty days. Against that, the early scrub made
*close, then re-register an hour later* an instant self-erasure — the one thing the window was still for,
defeated by the flow that ran inside it.

The answer came as a correction of the premise:

> *"the 30 days windows is for undo too !"*

and, once the two doors were put to him:

> *"yes, Inside 1–30 days, signing up again at the same address restores the old account"*

with two riders that decide the mechanism:

> *"and the state of waitApprove is true, so admin can not approve the user if it is a problem"*

> *"re-registration is the undo, not a login"*

**Undo and re-registration cannot both exist in one window.** An undo needs the closed document intact and
still holding its address; re-registration as ADR-042 built it scrubs precisely that document to free
precisely that address. Whichever happens first destroys the other, and they cannot share `login.email`,
which is unique with no partial filter (ADR-011) and is the *only* unique index on `user` and `shopOwner` —
so nothing but the address ever forced the old document to move at all. The window needed one door.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — keep ADR-041 as it stood: closure permanent, confirm scrubs early | nothing to build; the code as committed this morning | the platform owner's question stands unanswered — thirty days of retention that the returning person destroys on day 1, protecting nobody. And it silently makes closure a data-laundering tool: close, re-register, and the record of who you were is gone the same hour |
| B — a "restore my account" login: log in, get offered an undo | familiar shape; proves the *password*, which is a stronger claim than mailbox control | it cannot exist. `checkUserAuthorizationDisDel` refuses a `deleted` account at the login gate on all three tiers, so there is no session to make the request from, and the only way to build it is to weaken that gate — the same gate that stops a suspended account logging in. Ruled out directly: *"re-registration is the undo, not a login"* |
| C — an undo link mailed at closure, valid thirty days | explicit, self-documenting, and does not touch registration | a second door into the same window. A person who ignores the mail and signs up again instead still hits the scrub, so C only works if re-registration *also* restores — at which point C is a redundant second mechanism whose only distinct behaviour is the failure mode where the two race |
| D — re-registration restores the account | one door, no new mechanism, and no collision by construction. The confirmation click already proves the person can read mail at the address, which is exactly what an undo has to establish and exactly what a password reset accepts. It answers the platform owner's question literally: the data is kept **so it can be handed back** | mailbox control alone recovers an account with all its history, so an address reassigned to somebody else within thirty days hands them the previous holder's data. Mitigated on the seller tier by `waitApprov`, not mitigated on the customer tier |

---

## Decision

**Option D. Inside the retention window, a confirmed registration at an address a closed account still
holds restores that account. Outside it, the address has already moved and the registration is an ordinary
new one.**

The scrub is unchanged and still runs at day 30 — it is now what *ends* the undo window rather than
something that races with it. `buildAccountScrub` loses its second caller and keeps one.

**What a restore writes**, in the same transaction the confirmation already opened:

| Path | What happens | Why |
|---|---|---|
| `deleted`, `deletedBy` | `$unset` | this is the undo; the closure did not happen |
| `login.password` | set to the hash just submitted | they proved mailbox control and chose a password doing it — a reset proves no more. Nothing that could log in as the account before this moment survives |
| `emailVerify` | `{ valid: true }` | they just clicked a link at that address |
| `waitApprov` | **raised again, seller tier only** | the ruling: *"admin can not approve the user if it is a problem"* |
| `_id`, `registeredAt` | **untouched** | the point of an undo is that it is the same account — the id every `company.idShopOwner` points at, and the date the person actually joined |
| `disabled`, `disabledBy`, `disabledReason` | **untouched** | only the Admin tier lifts a suspension (ADR-044). An undo performed by the subject must not be a way around one: a suspended-then-closed account comes back suspended and still cannot log in |
| `personalData`, `addresses`, `notes` | **untouched** | they are the account, and the account is being handed back |
| `company`, `item` | **untouched — still `published: false`** | ADR-045 unchanged: the owner republishes by hand. Now it is one rule for both ways back, suspension-lift and closure-undo |

**`waitApprov` is the human checkpoint and the only one.** A closure is the platform's last look at an
account, so coming back is re-entry through the door a first registration uses. An admin who closed a
seller for cause simply never approves them again, and the restored account sits inert. **The customer tier
has no equivalent, because it has no approval gate** — a restored `user` is usable immediately.

**Replays stay knowable, by the credential rather than the id.** The confirm step spans Redis and MongoDB
and is idempotent, not atomic: a crash between the commit and the `DEL` replays the transaction, and a
commit whose acknowledgement was lost reports an error over work that landed. One discriminator answers
both writes: `login.password` on the live holder of the address is byte-identical to the pending record's
hash only if this very registration put it there, two registrations at one address hashing to different
values. The pre-minted `_id` could not have served — a restore mints no id, so an `_id` check answers *no*
over a restore that committed, and the person would be shown a failure over their own recovered account.
A live holder that is *not* this registration's doing throws: it is the two-people-one-address race, both
submitted before either clicked, and the loser must not be told which of the two they are nor handed the
other's account. The refusal is the same check-your-mail page every other refusal on the route answers
with, and the pending record survives it.

**A scrubbed document can never be found by this path**, because scrubbing is what moves the address off it.
There is no scrubbed-account branch in the confirm flow and there must not be one.

---

## Consequences

### Positive
- **The retention window finally means something to the person it is about.** Closing an account by mistake
  — or on a bad day — is recoverable for thirty days by doing the obvious thing, with no support ticket and
  no admin involved.
- **Closure stops being a laundering tool.** Under ADR-042 as built, close-then-re-register erased the
  record the same hour. Now the record is handed back instead, and the only thing that erases it is thirty
  days of not coming back.
- **One door, so no race.** There is no undo link, no restore login and no second mechanism to keep
  consistent with this one.
- **A shop owner's shops survive the round trip.** `company.idShopOwner` points at the `_id` this decision
  keeps, so an owner who closes and returns still owns their catalogue — dark, and theirs to republish.
- **Less code, not more.** The confirm path loses its scrub call; `buildAccountScrub` loses a caller and a
  reason to stay in sync across two flows.

### Negative
- **Mailbox control alone recovers an account with all of its history.** A work address reassigned inside
  thirty days hands the new holder the previous one's identity data. This is the platform's existing trust
  model — password reset makes the same assumption — but it is being applied to an account nobody is
  watching any more, which is materially weaker than applying it to a live one.
- **The customer tier has no checkpoint on that.** `waitApprov` protects the seller tier only.
- **Closure is no longer a clean promise.** "Your data is gone when you close" became "your data is gone
  thirty days after you close, and you can have it back until then" — which is honest, and is a privacy
  statement `marketplace-user`'s `privacy.tsx` now has to make.
- **An admin cannot prevent a customer from returning.** For sellers, withholding approval is the answer;
  for customers, the answer is to suspend the restored account afterwards, which requires noticing it.

### Risks
- **A future "restore my account" login.** Option B is the shape everybody reaches for, and building it
  means weakening the gate that also stops suspended accounts logging in. Recorded in §4 of the ADR index.
- **A scrub creeping back into the confirm path.** It was there this morning. Re-adding it — to "free the
  address", which is what it looks like it does — silently deletes accounts that people are in the middle of
  recovering.
- **`waitApprov` being skipped on restore** because the account was approved once already. That is exactly
  the ruling reversed: approval is not a property the account keeps through a closure.
- **A restore lifting `disabled`.** `$unset`ting the suspension flags alongside `deleted` looks tidy and
  hands a sanctioned account back to its holder.

---

## Compliance

```bash
# 1. The confirm path restores and never scrubs. Expect zero hits.
grep -rn "buildAccountScrub" BEs/dev/marketplace-dev-public-resource/src/

# 2. The scrub has exactly one caller, and it is the day-30 sweep.
grep -rn "buildAccountScrub" BEs/dev/*/src/

# 3. The restore raises the approval gate on the seller tier and clears only the closure stamps.
grep -n "waitApprov\|deletedBy\|disabled" BEs/dev/marketplace-dev-public-resource/src/lib/registration/confirmRegistration.mts

# 4. No login-side undo. Expect zero hits — a closed account has no session.
grep -rn "deleted" BEs/dev/marketplace-dev-public-authorization/src/lib/db/login/
```

The suite must prove the three things a happy path misses: a closed customer account restored at the click
keeps its `_id`, its `registeredAt` and its personal data while its `deleted` stamp is gone; a closed shop
owner comes back with `waitApprov: true` and with every company and item still `published: false`; and a
closed account that was *also* suspended comes back still carrying `disabled`, `disabledBy` and
`disabledReason`.

A violation on disk looks like: a scrub in the confirm path; a new `_id` minted for an address a closed
account still holds; `waitApprov` absent from the seller restore; `deleted` cleared anywhere outside this
flow; or `disabled` cleared by anything but the Admin tier's status mutation.
