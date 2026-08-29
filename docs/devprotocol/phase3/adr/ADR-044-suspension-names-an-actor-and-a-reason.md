# ADR-044 — Suspension names an actor and a reason; the database enforces presence, the service enforces length
# Marketplace

**Status:** accepted
**Date:** 2026-08-29
**Deciders:** platform owner
**Supersedes:** —
**Superseded by:** —

---

## Context

`disabled` is a bare boolean today, on `user` and on `shopOwner` alike —
`BEs/marketplace-db-setup/lib/schemas/account.js:147-150`, *"present and true: disabled, absent: login
allowed"*. `funUserUpdateStatus.mts:32` and `funShopOwnerUpdateStatus.mts:28-32` set and unset it, and
`checkUserAuthorizationDisDel.mts:5-16` refuses a login when it is true. Nothing records who set it or why.

An operator opening a suspended account therefore learns that somebody suspended it, and nothing else. There
is no second place to look: no audit collection, no event log, no admin note. The information does not exist.

The platform owner closed this on 2026-08-29, in the same ruling that made suspension the operator's only
lever against an account:

> *"admin must be able to soft deactivate/suspend an user, not hard delete. so use a structure like
> disabled=true. […] and we need to track the actor, user or admin ID who set disabled=true. and for
> shopOwner too !! and add for both kind of users, user and shopOwner, a string field, 1000 characters max
> lenght for reason, mandatory when disabled=true"*

Two things about the existing shape matter for how that is built.

**`disabled` and `deleted` are fully independent, and no code path sets both.** `checkUserAuthorizationDisDel`
tests them in two separate blocks; `funUserDel.mts:71` writes only `deleted`; `funShopOwnerDelete.mts:16-22`
writes only `deleted` and unsets `waitApprov`; the two `*UpdateStatus` functions write only `disabled`. The
common case — a customer closing their own account — leaves `disabled` absent, not true. This is by decision
rather than by accident: [ADR-036](./ADR-036-erasure-is-not-something-the-platform-suspends.md) rules that
erasure is not something the platform suspends, so a suspended customer can still close their account. A
mandatory reason attached to `disabled` therefore does **not** reach an ordinary self-closure, and must not
be built as though it did.

**A reason is free text an operator writes about a person**, which puts it under ADR-029 rather than beside
it. That is the whole difficulty of this ADR, because of a property of the encryption: an encrypted path
declares `bsonType: 'binData'` and nothing else. No `pattern`, no `minLength`, **no `maxLength`**. The
validator cannot count characters it cannot read.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| A — `disabledReason` as a cleartext string with `maxLength: 1000` in the validator | the cap is enforced where ADR-035 says a cap belongs — in the schema, with the service's copy existing only to make the refusal a 400 that names the limit | it is operator prose about a customer, and it will contain personal data the moment anybody writes *"suspended after the call on the 3rd, see the complaint from …"*. Storing it in clear puts PII outside CSFLE in the collection ADR-029 was written about, to buy a length check |
| B — `disabledReason` encrypted with `ALGORITHM_RANDOM`; the database enforces **presence**, the service enforces **length** | the field is covered by ADR-029 like every other personal field; presence is still a database rule, because `dependencies` needs no access to the value | the 1000 is enforced in one place instead of two, so a direct database write can exceed it. It reads as a regression from ADR-035 and has to be explained every time somebody notices |
| C — no field: an audit collection recording every status change | a real history rather than a latest-value; would also cover un-suspension, which a single field cannot | a seventh collection, its own validator, migration, indexes and data key, for a surface with one writer; and the owner asked for a field on the account. Nothing prevents this later — a field is not in its way |
| D — one `reason` shared by suspension and closure | one field, one name, fewer paths | the two are independent (above), so a shared field would be ambiguous exactly when it is populated and one of the two stamps is set. And it would make a reason mandatory on a customer's own closure, which ADR-036's reasoning refuses |

---

## Decision

**Option B, on `user` and `shopOwner` alike. Three fields, and the enforcement is split on what the database
can see.**

| Field | Type | Encrypted | Written when |
|---|---|---|---|
| `disabledBy` | `objectId` — an `admin._id` | no | alongside `disabled: true`, always |
| `disabledReason` | `string`, at most 1000 characters | **yes**, `ALGORITHM_RANDOM` | alongside `disabled: true`, always |
| `deletedBy` | `objectId` — an `admin._id` | no | alongside `deleted`, **only** when an operator closed the account |

**`disabledReason` is mandatory whenever `disabled` is true, and the database says so** —
`dependencies: { disabled: ['disabledReason'] }` in the `$jsonSchema`. A dependency asserts that a path
exists; it does not read it, so encryption does not stand in its way. The 1000-character cap lives in the
service, alone, because `binData` admits no `maxLength`.

⚠️ **This is not ADR-035 being reversed.** ADR-035 put `maxItems` in the validator and called the service's
copy a nicety, and that ordering is right whenever the validator *can* apply the rule. Here it cannot see the
value at all, and the choice is not *"validator or service"* but *"encrypt the operator's prose about a
customer, or count its characters"*. Encryption wins, and the cost is stated rather than hidden: the
1000 is a service rule, and a write that bypasses the service can exceed it.

**The actor is one field per stamp, not a polymorphic pair.** `disabledBy` is always an `admin._id` — there
is no self-suspension, and no tier but `Admin` can reach the mutation. `deletedBy` is an `admin._id` too, and
**its absence beside a `deleted` stamp is the record that the account holder closed it themselves.** Storing
a collection name alongside the id would be a `role` field arriving by the back door, which ADR-002 refuses:
role is which collection you authenticate against, and each of these two fields has exactly one possible
actor collection, so the field's name already carries it.

`deletedBy` goes beyond the literal ruling, which named `disabled` only. It is included because
[ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md) makes a closed document permanent
specifically so that it records what became of the account, and a permanent record that cannot say whether
the person left or was removed answers half the question it was kept for. It is one field and one write; if
the owner would rather not have it, dropping it changes nothing else.

**The three fields are the account's latest status, not its history.** Un-suspending clears all three of the
`disabled*` fields together — a stale reason beside `disabled: false` is worse than none — and no record of
the previous suspension survives. Option C is the answer if that is ever wanted, and this decision does not
foreclose it.

⚠️ **Only the Admin tier writes any `disabled*` field, and lifting a suspension is an operator act.**
Confirmed by the platform owner on 2026-08-29 — *"if admin suspend an account, admin must remove the
suspension for allow the shopowner to log in again"* — and already true of the code this ADR extends, in
three independent places worth naming so a later self-service feature cannot quietly undo it:

- `checkUserAuthorizationDisDel` refuses `disabled: true` on the login path of all three tiers, so a
  suspended account never obtains a session and cannot reach a resolver that might clear its own flag.
- `findAccountForSession` re-runs that same guard on **every refresh**, so suspending somebody already
  logged in ends their session within one access-token lifetime.
- `funShopOwnerUpdateStatus` — Admin tier — is the only writer of `shopOwner.disabled` on the platform, and
  self-closure writes `deleted` alone (`funUserDel`, customer tier, is the built precedent).

**A self-service closure therefore never touches `disabled`, `disabledBy`, `disabledReason` or `disabledAt`**
— it stamps `deleted` and stops. The two fields carry different meanings: `deleted` is the subject giving the
account up, `disabled` is the platform taking it away, and a path that could write the second could lift a
sanction against itself. That is the same argument `APPROVAL_GATE_FIELD_SHOP_OWNER` makes for `waitApprov`,
and it earns the same mechanical lock: the `disabled*` names belong in a **write-position** `no-restricted-syntax`
ban in the ShopOwner-tier and User-tier services, beside the `waitApprov` one, with the reads left alone
because the authorization gates above are reads.

⚠️ **The consequence nobody should discover later: a suspended account cannot be closed by its owner.** They
cannot log in, so they cannot reach the closure mutation, so the retention clock — which starts at `deleted`
— never starts. A suspension is therefore indefinite storage of a live account's personal data, and the only
hand that ends it is an operator's. This does not contradict
[ADR-036](./ADR-036-erasure-is-not-something-the-platform-suspends.md): that decision keeps `disabled` out of
the closure resolver's *own* guard, so a suspended caller still holding a valid access token may close their
account. It does not, and cannot, give them a session once the token expires.

**Scrub interaction.** ADR-041's retention scrub **overwrites** `disabledReason` with a fixed string and never
removes it: removing it while `disabled` is true would violate the dependency this ADR adds, and the write
that violates it is the scrub's own. `disabledBy` and `deletedBy` are operator identifiers rather than the
data subject's data, so they survive the scrub unchanged — they are the attribution the kept document exists
to carry.

---

## Consequences

### Positive
- **A suspension becomes answerable.** Who, and why, in the record itself rather than in somebody's memory —
  which is what makes suspension usable as the platform's only lever now that ADR-041 has removed deletion
  as an alternative.
- **The reason is covered by ADR-029 from the first line it is written**, rather than being a cleartext
  personal-data field somebody notices two years later.
- **Presence is still a database rule.** The most likely defect — a mutation shipping that lets an operator
  suspend without saying why — fails at the write, not in review.
- **Attribution survives erasure.** A scrubbed document still names the operator who acted on it, so the
  thirty-day retention does not erase the platform's own accountability along with the person's data.

### Negative
- **The 1000 is enforced once.** A direct database write, a migration, or a second service reaching the
  collection can exceed it, and nothing will complain. The cap has to be tested at the service boundary
  because there is nowhere else to test it.
- **The admin frontend grows a required field.** Suspending is now a form with a mandatory textarea rather
  than a toggle, on both the customers table and the shop-owners table.
- **`disabledReason` is not readable in the database.** An operator investigating with a shell sees
  `binData`; the reason is legible only through the admin surface that decrypts it.
- **No history.** The fields answer *why is this account suspended now*, never *what has happened to this
  account*. Repeated suspensions overwrite one another silently.

### Risks
- ⚠️ **`collMod` never revalidates stored documents.** `migrations/20260826000000-user-cap-addresses.js`
  records this in its own header, and it is the trap here: every document already carrying `disabled: true`
  has no `disabledReason` and cannot have one, so adding the dependency makes each of them **unwritable on
  its next unrelated update** — with no error at migration time and no warning. The migration must backfill a
  placeholder reason onto every already-disabled document **before** the `collMod` that adds the dependency,
  in that order, in one migration.
- **The reason becoming a dumping ground.** A free-text field on an account with no length feedback from the
  database is where notes, tickets and unrelated history end up. The service's 1000 is the only brake, and it
  is a weak one; revisit with Option C if the field starts being used as a log.
- **An operator putting third-party personal data in it** — a complainant's name, another customer's order.
  It is encrypted, which bounds the exposure, but it is also displayed in the admin UI and it survives to the
  scrub as a placeholder rather than as content. Nothing technical prevents this; the admin form's label is
  the control.
- **`disabledBy` pointing at a deleted operator.** `admin` documents are outside the retention design
  entirely, and nothing stops an `admin._id` from becoming unresolvable. The field is an attribution, not a
  foreign key, and no read should join on it expecting a hit.

---

## Compliance

```bash
# 1. The dependency exists on both collections, and only on these.
grep -n "dependencies" BEs/marketplace-db-setup/lib/schemas/*.js

# 2. The reason is encrypted on both — it must appear in both encrypted-field lists.
grep -rn "disabledReason" BEs/marketplace-db-setup/lib/

# 3. The cap is a service constant, written once per service that can set it.
grep -rn "1000" BEs/dev/marketplace-dev-admin-authenticated-resource/src/lib/

# 4. The backfill runs before the collMod, in the same migration.
grep -n "disabled" BEs/marketplace-db-setup/migrations/*disabled*.js
```

Verify against a real database that an already-suspended document survives the migration and remains
writable — a unit test on the schema object cannot see this, because the defect is in the ordering of two
statements against existing data:

```js
db.user.updateOne({ disabled: true }, { $set: { dateLastReq: new Date() } })   // must succeed
```

A violation on disk looks like: `disabled` being set anywhere without `disabledBy` and `disabledReason` in
the same update; `disabledReason` declared as a `string` in the validator rather than `binData`, or absent
from an `ENCRYPTED_FIELDS_*` list; a `maxLength` appearing beside it, which would mean it stopped being
encrypted; a `collMod` adding the dependency with no backfill above it; a `role`, `actorType` or
`actorCollection` field appearing beside either actor id; or a reason being demanded on a customer's own
account closure, which ADR-036's reasoning refuses.
