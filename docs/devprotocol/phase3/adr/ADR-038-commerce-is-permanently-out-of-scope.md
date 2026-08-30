# ADR-038 — Cart, order, delivery and payment are permanently out of scope
# Marketplace

**Status:** accepted
**Date:** 2026-08-27
**Deciders:** platform owner, stating directly an intent that had never been written down. Asked what to do
with epic E11's §6 question 1 — absorbed into the note at the foot of this file — who signs off the first
commerce schema — the answer was that no first schema is coming.
**Supersedes:** —
**Superseded by:** — (**not** superseded; the note at the foot of this file is a citation fix, dated 2026-08-27)

---

## Context

Four concepts have been carried as **planned** since the retrofit: Cart, Order, Delivery, Payment. They are
BC-11 "Ordering & Fulfilment" in [`phase2/BOUNDED_CONTEXT.md`](../../phase2/BOUNDED_CONTEXT.md), §18 of
[`phase2/UBIQUITOUS_LANGUAGE.md`](../../phase2/UBIQUITOUS_LANGUAGE.md), §2.9 of
[`phase2/EVENT_STORMING.md`](../../phase2/EVENT_STORMING.md), and epic E11 — see the note at the foot of
this file — an epic whose single story ships a record and nothing else, because
[`phase5/CONSTRAINTS.md`](../../phase5/CONSTRAINTS.md) §6 forbids any story that designs them.

**Nothing about that absence is in doubt, and no claim anywhere in the corpus is wrong.** Zero collection in
`BEs/marketplace-db-setup/lib/schemas/`, zero migration, zero model in `marketplace-common`, zero mutation
across the nine services under `BEs/dev/`, zero resolver, zero state machine, no gateway. `item` carries no
`price` field, deliberately — [ADR-009](./ADR-009-no-price-on-item.md), and `price` on `item` is a **banned
term** in `UBIQUITOUS_LANGUAGE.md` §19.

What was wrong is the one thing a document can get wrong while every sentence in it stays true: the frame.
**Planned** said these four were pending, and they were not pending — nobody intended to build them. The
cost of that word is measurable, and it compounded:

- **Six live open-question rows, none with a real owner.** Epic E11 §6 questions 1–5, `BOUNDED_CONTEXT.md`
  §7 q4, `EVENT_STORMING.md` §6 open question 4, [`phase1/PDR.md`](../../phase1/PDR.md) §open question 3,
  and [`phase5/RISK_REGISTER.md`](../../phase5/RISK_REGISTER.md) R31. Most are owned by "Product + platform
  dev" — a product function this platform does not have.
- **Three passes that narrowed questions rather than answering them.** Epic E11's own record — revised
  across v1.2, v1.3 and v1.4 — each re-derived that an upstream closure did not reach the BC-11 half, and
  each re-verified the same absence against the working tree. That is an audit loop with no exit, because
  the exit was a design decision nobody was going to take.
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
2. **Every open question waiting on a commerce design closes as moot.** Epic E11 §6 q1–q5,
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
  narrowed-not-answered passes on epic E11's record has an exit.
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
- E11 is now an epic that exists to record a closed decision — an epic that permanently ships nothing.
  Its record was distributed rather than replaced; see the note at the foot of this file.

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
Both pointers now read §6. The same wrong number was corrected in `BOUNDED_CONTEXT.md` §7 q4 in the same
pass, and, while it still existed, in E11's own record as well.

**Nothing decided here changed.** This is the pointer, not the decision: the row it names is the same row,
already struck through and already citing this ADR. Nothing else in the body above is amended — a wrong
section number in a citation is corrected in place and recorded here rather than left to send the next
reader to the wrong table.

---

## Note — 2026-08-27: E11's epic record deleted, its content absorbed here

Epic E11's own record was deleted on 2026-08-27. **The epic id E11 survives** — exactly as §Consequences
above already said it would — and its record now lives here: the remainder of this note is what that
record held. A reader who goes looking for the file and finds it gone should find this paragraph, not
silence.

**This is not the "Delete" option §Options above rejected.** That option would have erased BC-11,
`UBIQUITOUS_LANGUAGE.md` §18, `EVENT_STORMING.md` §2.9 and E11 itself, on the reasoning that a reader
wondering where the cart is would then find nothing explaining the wondering — which is exactly the outcome
this corpus's rule against erasing closed questions exists to prevent. None of that happened here: the
vocabulary, the reasoning and every closed question E11.md carried survive, relocated rather than removed.
Only the file — one address among several that once carried a live fragment of this decision — is gone,
and what it held is recorded below in this ADR's own voice rather than left to be inferred from a title
that no longer resolves.

**The absence E11.md recorded was verified empirically, and that verification is what its §3 held.**
`find BEs/dev -path "*/mutations/*" -iregex '.*\(cart\|order\|payment\|delivery\).*'` returned zero matches
across all nine services under `BEs/dev/`, and `BEs/marketplace-db-setup/lib/schemas/` listed eleven
entries — `account.js`, `admin.js`, `collection.js`, `company.js`, `encrypted.js`, `geo.js`, `item.js`,
`itemCategory.js`, `shopOwner.js`, `user.js`, `README.md` — none of them commerce. ⚠️ **Correction,
2026-08-13 (E11-S01):** that bullet had named only eight entries; `admin.js` and `encrypted.js` were the
two missing. The claim the bullet made was unchanged throughout — only its evidence had gone stale.

⚠️ **Correction, 2026-08-27:** the pre-ADR-038 wording of `item.js`'s header comment ended "…and no design
decision behind them yet". The word `yet` was removed that day from that comment **and from thirteen other
source and doc files across five repos** — `marketplace-db-setup`, `marketplace-common`, `marketplace-user`,
`marketplace-shopowner` and `marketplace-dev-user-authenticated-resource`. This is the concrete form of the
sweep §Options' negative column and §Risks both refer to without naming a count.

⚠️ **Correction, 2026-08-27:** E11.md's Delivery bullet had cited **ADR-008** since the retrofit, which was
wrong — ADR-008 is the domain-neutral-catalogue decision and contains the word "delivery" zero times. The
citation was replaced; the claim itself — Delivery has no collection, no resolver and no design anywhere on
this platform — never depended on it and is unchanged.

**What E12 did not settle.** E11.md recorded §6 question 5 as *narrowed, not answered*, because E12 gave
this platform a log-retention decision and a privacy notice, **neither of which reaches what an order would
store**. That distinction is preserved here so a future reader does not treat E12's retention work as having
answered the BC-11 data question — it answered a question about data this platform actually holds, which an
order is not among.

**The five questions' closure detail that their upstream twins do not carry.** Their twins —
`BOUNDED_CONTEXT.md` §7 q4 and q5, `EVENT_STORMING.md` §6 open question 4, `PDR.md` open question 3,
`NFR.md` open question 1 — are already closed and stay exactly as they are; nothing below reopens or
amends any of them. What only E11.md held, and what would otherwise have left with it:

- **Question 1's owner cell was wrong.** It read "Product + platform dev", a function this platform does
  not have (ADR-037: a blueprint published for the community, in which the platform owner decides
  everything). The *who* half of the question was answerable at any point in the last year; the *what
  shape* half never had a decider waiting on it at all. ⚠️ **This bullet is the exception to the
  paragraph above it.** The finding is not E11.md's alone any more: the twins were closed on 2026-08-27
  with the owner-cell tell written into them — `BOUNDED_CONTEXT.md` §7 q4 and `EVENT_STORMING.md` §6
  open question 4 both carry it, in E11-S02's voice, as the story's finding rather than a question's
  closure reason: an owner cell naming a function this platform does not have should be met wherever a
  reader enters.
- **Question 3 survived the publish split.** When `itemUpdatePublished` was split out on both tiers
  (2026-08-14), a dedicated writer made the flip **deliberate, not slower** — an order holding a live
  reference would still see whatever the last deliberate publisher left. That is recorded here so the split
  is not later mistaken for having answered the question. `item.published` itself is unaffected by any of
  this: last-writer-wins stands, both publish operations stand, and the catalogue is unchanged.
- **Question 4 had no upstream at all**, and was kept deliberately rather than deleted for failing the
  traceability criterion, because deleting it would have hidden a real blocker. It is a **tier-topology**
  question — ADR-002, `UBIQUITOUS_LANGUAGE.md` §Service pair — not a commerce design decision, which is why
  it closes moot with the rest rather than needing its own resolution. The topology it worried about is
  unchanged: three tiers, four service pairs, `role` still not a field.
- **Question 5's order-specific half** was lawful basis for payment-adjacent data, a retention period, and
  the conflict between erasure and an accounting rule that wants the record kept. None of it arises, because
  no order stores anything. ⚠️ **GDPR's obligations are not closed by this** — `phase1/NFR.md` open question
  6 stays open on its own terms for the data the platform does hold, and nothing about ADR-036,
  `user.deleted_ttl` or the privacy notice changes. ⚠️ **Two of those three moved two days later, for
  reasons that have nothing to do with commerce**: `user.deleted_ttl` is dropped and retention becomes a
  day-30 overwrite in place ([ADR-041](./ADR-041-retention-overwrites-in-place-nothing-is-destroyed.md)),
  and the privacy notice gained the undo window ([ADR-046](./ADR-046-the-retention-window-is-an-undo-window.md)).
  The claim this bullet actually makes — that closing commerce moves none of them — still holds.

**The display-only price.** [ADR-009](./ADR-009-no-price-on-item.md) §Risks had named a marketing price
("starting from €X"), argued in its own ADR, as a legitimate revisit trigger — the one route to a `price`
field this ADR would not otherwise have blocked. It was offered on 2026-08-27 and refused, closing that
trigger (ADR-009 §Note 2026-08-27, above). This matters here because without it, a reader could satisfy
ADR-009's own escape hatch and believe the result consistent with this ADR; it is not, and the hatch is
shut.

**What BC-11 would have consumed, and the warning attached.** `item` (BC-05 Catalogue), `user.addresses`
(BC-07 Customer Account) and `company` (BC-04 Legal Entity). ⚠️ **None of the three is waiting on
anything.** `addresses` is a customer-facing record in its own right, `item` is a complete catalogue entry,
`company` is a complete tenant, and reading any of them as half a commerce model is the specific mistake
this record exists to prevent. Had BC-11 been built, it would also have needed a seventh Mongoose model in
`marketplace-common` and either a new `TIER`-scoped service pair or a new concern folded into an existing
tier — which of the two was exactly question 4, above, and is now moot along with it.

This note closes on the rule E11.md closed on, which survives it verbatim in substance: **a future question
about cart, order, delivery or payment is not an open question on anything — it is a request to supersede
this ADR, and it goes to the platform owner as an ADR.**
