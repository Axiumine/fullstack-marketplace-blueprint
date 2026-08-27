# ADR-038 — Cart, order, delivery and payment are permanently out of scope
# Marketplace

**Status:** accepted
**Date:** 2026-08-27
**Deciders:** platform owner, stating directly an intent that had never been written down. Asked what to do
with `phase5/epics/E11.md` §6 question 1 — who signs off the first commerce schema — the answer was that
no first schema is coming.
**Supersedes:** —
**Superseded by:** — (**not** superseded; the note at the foot of this file is a citation fix, dated 2026-08-27)

---

## Context

Four concepts have been carried as **planned** since the retrofit: Cart, Order, Delivery, Payment. They are
BC-11 "Ordering & Fulfilment" in [`phase2/BOUNDED_CONTEXT.md`](../../phase2/BOUNDED_CONTEXT.md), §18 of
[`phase2/UBIQUITOUS_LANGUAGE.md`](../../phase2/UBIQUITOUS_LANGUAGE.md), §2.9 of
[`phase2/EVENT_STORMING.md`](../../phase2/EVENT_STORMING.md), and [`phase5/epics/E11.md`](../../phase5/epics/E11.md) —
an epic whose single story ships a record and nothing else, because
[`phase5/CONSTRAINTS.md`](../../phase5/CONSTRAINTS.md) §6 forbids any story that designs them.

**Nothing about that absence is in doubt, and no claim anywhere in the corpus is wrong.** Zero collection in
`BEs/marketplace-db-setup/lib/schemas/`, zero migration, zero model in `marketplace-common`, zero mutation
across the nine services under `BEs/dev/`, zero resolver, zero state machine, no gateway. `item` carries no
`price` field, deliberately — [ADR-009](./ADR-009-no-price-on-item.md), and `price` on `item` is a **banned
term** in `UBIQUITOUS_LANGUAGE.md` §19.

What was wrong is the one thing a document can get wrong while every sentence in it stays true: the frame.
**Planned** said these four were pending, and they were not pending — nobody intended to build them. The
cost of that word is measurable, and it compounded:

- **Six live open-question rows, none with a real owner.** `E11.md` §6 questions 1–5, `BOUNDED_CONTEXT.md`
  §7 q4, `EVENT_STORMING.md` §6 open question 4, [`phase1/PDR.md`](../../phase1/PDR.md) §open question 3,
  and [`phase5/RISK_REGISTER.md`](../../phase5/RISK_REGISTER.md) R31. Most are owned by "Product + platform
  dev" — a product function this platform does not have.
- **Three passes that narrowed questions rather than answering them.** `E11.md` v1.2, v1.3 and v1.4 each
  re-derived that an upstream closure did not reach the BC-11 half, and each re-verified the same absence
  against the working tree. That is an audit loop with no exit, because the exit was a design decision
  nobody was going to take.
- **`ADR-INDEX.md` §5 recorded the gap as owed**: "Ordering. Cart, order state machine, delivery, payment —
  no collection, no resolver, no design. … **Needs its own ADR when the design starts.**" This is that ADR,
  arriving from the other direction.
- **"Ask before inventing them"** ([`CLAUDE.md`](../../../../CLAUDE.md) §Build state) is an invitation to ask. Answering the
  same question repeatedly is the cost of leaving it open.

The fact that settles it was already on record and had never been applied here: **this platform is a
blueprint published for the community** ([ADR-037](./ADR-037-marketplace-common-is-published-to-npm.md),
[`phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md`](../../phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md) §0). What it demonstrates is a
multi-tenant identity, tenancy and catalogue stack — three auth tiers against three collections with no
`role` field (ADR-002), a domain-neutral catalogue (ADR-008), sixteen repos wired as submodules (ADR-031),
100% coverage and mutation score 100 on all of it. A checkout demonstrates none of that a second time.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Keep BC-11 **PLANNED** indefinitely | Costs nothing today; leaves the door visibly open; no document changes | Six unowned question rows stay live, and every audit pass re-verifies the same absence to close none of them. The word *planned* keeps promising a design to every reader and every agent, and the promise has no date, no owner and no intent behind it. It is the status quo, and the status quo is what produced three narrowed-not-answered passes |
| **Delete** the commerce vocabulary — BC-11, UL §18, ES §2.9, E11 | The smallest corpus; nothing left to re-audit | Erases the reason `item` has no price, which is the single most-asked question about this data model. This corpus annotates and never erases — every closed question above is struck through in place, not removed — and a reader who wonders where the cart is would find silence, which reads as an oversight rather than a decision. UL §18 exists precisely so the four are named consistently; naming them to **refuse** them needs the entry more, not less |
| **Build** a minimal commerce tier so the blueprint has a checkout | A marketplace blueprint with no way to buy is an odd blueprint on first read | Four genuinely new designs at once, plus a `price` that drags a currency, a precision, a VAT treatment and a discount model behind it (ADR-009), plus `Decimal128` — a **rejected write** everywhere on this platform because it cannot survive `.lean()` into GraphQL — plus a gateway integration and its error taxonomy, plus 100% coverage and mutation 100 on all of it under the gates in `phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md`. It would be the largest single piece of work on the platform and would demonstrate no architectural property the four built surfaces do not already demonstrate |
| **Permanently out of scope; vocabulary kept and annotated (adopted)** | Turns six open questions into one decision with an owner. The catalogue's shape stops being provisional: `item` is priceless *by design*, not *pending a design*. Readers and agents get a real answer instead of a standing invitation to ask. The blueprint's boundary becomes a stated property rather than a gap | The word "marketplace" now carries an asterisk that has to be visible on first read, or the blueprint mis-sells itself. Roughly twenty-five documents and six source comments phrase the absence as temporary — "yet", "until", "when that tier is built" — and every one of them becomes false the day this is accepted, so the decision is only real once they are all rewritten |

---

## Decision

**Cart, order, delivery and payment will never be built on this platform. BC-11 is `WILL NOT BUILD`, not
`PLANNED - NOT BUILT`.**

Three consequences follow directly and are part of the decision, not inferences from it:

1. **`item` gets no `price` field, ever.** ADR-009's decision is unchanged and its reasoning still holds;
   what changes is that its title's condition — *until ordering is designed* — never arrives. That ADR stays
   `accepted` and gains a pointer here. `price` stays a banned term in `UBIQUITOUS_LANGUAGE.md` §19, with
   the replacement column now reading *none, permanently*.
2. **Every open question waiting on a commerce design closes as moot.** `E11.md` §6 q1–q5,
   `BOUNDED_CONTEXT.md` §7 q4, `EVENT_STORMING.md` §6 open question 4, `PDR.md` §open question 3. None was
   answered; each asked what to do when design work starts, and design work does not start. They are struck
   through in place with this ADR cited, in the same form as every other closure in those tables.
3. **The commerce vocabulary stays where it is, with its framing inverted.** UL §18, ES §2.9, BC-11 and E11
   all remain. Their job is no longer *readiness* — it is to name the four precisely enough that a reader
   or an agent recognises them and stops. E11 keeps its story: the epic that recorded the gap now records
   the gap **and** the decision that closed it.

**What does not change: anything on disk.** No collection was removed, because none existed. No code, no
migration, no test and no schema is touched by this ADR. It changes only what the corpus claims about the
future, which is the only thing that was ever wrong.

**Re-opening this is an ADR that supersedes this one**, taken by the platform owner — the ordinary route.
It is not a story, not a "small first step", and not a `price` field added on the grounds that it is only
one field.

---

## Consequences

### Positive
- The catalogue's most conspicuous omission becomes a stated property. `item` has no price **because this
  platform does not sell**, which is a complete answer; *because ordering is not designed yet* never was.
- Six question rows collapse into one decision with a named decider. The audit loop that produced three
  narrowed-not-answered passes on `E11.md` has an exit.
- Agents get an unambiguous refusal. "Ask before inventing them" became "do not invent them"; the ask is
  answered in advance, and `phase5/CONSTRAINTS.md` §6's ban on designing them is now backed by intent rather
  than by the absence of a decision.
- The blueprint's boundary is legible on first read: identity, tenancy and catalogue, at full depth, with
  the commerce half deliberately absent.

### Negative
- **A "marketplace" that cannot take an order needs the asterisk visible early**, or a first-time reader
  feels misled. `CLAUDE.md` §Build state and `PDR.md` §Out of scope both carry it, and both had to be
  rewritten from "not yet" to "not ever" for this to be true.
- The four are still named in five phase-2 documents, an event-storming board, an epic and a glossary
  section — a reader may still read *presence* as *plan* on a fast skim. The `WILL NOT BUILD` marker is
  doing a lot of work, and it has to survive every future edit to those files.
- E11 is now an epic that exists to record a closed decision. It stays in the epic numbering and in
  `EPICS_STORIES.md`, which means the epic index permanently contains one entry that ships nothing.

### Risks
- **The absence re-reads as an oversight to anyone who skips the ADR.** Someone adding "just a price field"
  is the concrete failure, and it is exactly the temptation `RISK_REGISTER.md` R31 already tracks. R31 does
  not close with this ADR — its mitigation gets stronger, its likelihood does not reach zero, and the
  banned-term entry plus the `item.js` header comment are what actually bite.
- **A future contributor treats the blueprint's completeness as a goal in itself.** The revisit trigger is
  explicit and narrow: a decision by the platform owner that this platform should trade, recorded as an ADR
  superseding this one. Nothing about the *shape* of the code is a reason — not that `user.addresses` looks
  like it wants a delivery target, not that `company` looks like it wants a payout account.
- **The corpus can drift back.** Twenty-five documents and six source comments were rewritten in one pass
  to remove "yet"/"until"/"when that tier is built". A single new sentence in that old register re-opens the
  question in a reader's mind without re-opening it in fact. The Compliance greps below are the check.

---

## Compliance

The four collections must stay absent — unchanged from ADR-009, and now permanent:

```bash
# Zero hits, all four names, all nine services and the migrations repo.
grep -rilE '(cart|order|delivery|payment)' BEs/marketplace-db-setup/migrations/ BEs/marketplace-db-setup/lib/schemas/
find BEs/dev -path '*/mutations/*' -iregex '.*\(cart\|order\|payment\|delivery\).*'
```

No `price`, and no synonym of one, on `item`:

```bash
# Hits must be prose explaining the absence, never a field in a builder, a model or a GraphQL type.
grep -rniE '\b(price|cost|amount|currency|vat)\b' BEs/marketplace-db-setup/lib/schemas/item.js \
  BEs/marketplace-common/src/models/MongoDB/Item.mts BEs/marketplace-common/src/models/MongoDBInterfaces/IItemSchema.mts
```

The framing must stay permanent rather than pending — this is the grep that catches drift:

```bash
# Any hit pairing a commerce term with deferral language is a regression to the pre-ADR-038 register.
grep -rniE '(cart|checkout|payment|fulfilment|ordering)' --include='*.md' --include='*.mts' --include='*.ts' --include='*.js' . \
  | grep -v node_modules | grep -viE 'git checkout|sibling checkout|relocated checkout' \
  | grep -iE '\byet\b|\buntil\b|not yet|when that tier|when the design|planned|tomorrow|future migration'
```

A violation on disk looks like: `BC-11 [PLANNED]` anywhere, a `price` field in any builder or model, a story
in any epic with acceptance criteria that presume an order exists, a sequence diagram of a checkout flow, or
a re-opened question row asking who signs off the first commerce schema.

---

## Note — 2026-08-27, later the same day: two section pointers corrected

§Context and §Consequences both cited `EVENT_STORMING.md` **§5** open question 4. That question is in
**§6**; §5 is the hotspot table, and that document's hotspot 6 is cited correctly elsewhere in this ADR.
Both pointers now read §6. The same wrong number was corrected in `phase5/epics/E11.md` and in
`BOUNDED_CONTEXT.md` §7 q4 in the same pass.

**Nothing decided here changed.** This is the pointer, not the decision: the row it names is the same row,
already struck through and already citing this ADR. Nothing else in the body above is amended — a wrong
section number in a citation is corrected in place and recorded here rather than left to send the next
reader to the wrong table.
