# Proposed Amendments to Baselined Documents
# Marketplace

**Status:** proposed - awaiting sign-off. **Nothing in this file has been applied.**
**Version:** 1.1
**Date:** 2026-08-10
**Author:** epics-agent
**Raised by:** the E12-E18 remediation backlog for [`docs/report/token-handling-security-audit.md`](../../report/token-handling-security-audit.md) v1.1
**Mutability:** this file is a proposal; the documents it targets are baselined and are not edited by it

---

## 1. Why this file exists

Writing E12-E18 required two changes to documents that are marked as requiring sign-off; implementing them
has since raised a third, in an epic rather than a baselined input (Amendment D, §5):

- [`phase5/CONSTRAINTS.md`](./CONSTRAINTS.md) §5 states there are eleven epics, one per bounded context.
  There are now eighteen, and seven of them harden contexts rather than owning one.
- [`phase2/BOUNDED_CONTEXT.md`](../phase2/BOUNDED_CONTEXT.md) has no context covering signing-key custody or
  operator session administration, and E16 and E17 need one.

Both were written into a proposal instead of applied, because
[`BOUNDED_CONTEXT.md:10`](../phase2/BOUNDED_CONTEXT.md) reads:

> **Mutability:** requires team sign-off to modify - splitting or merging contexts is a major refactor

That line covers splitting and merging. It does not describe **adding** a context, and no procedure for doing
so exists anywhere in the protocol — which is itself worth resolving, and is Amendment C below.

**If the amendments are rejected**, E12-E18 remain valid as written. E16 and E17 fold their context line into
BC-01, and [`EPICS_STORIES.md`](./EPICS_STORIES.md) §4 records the fallback. No story changes.

---

## 2. Amendment A — `phase5/CONSTRAINTS.md` §5, epic-to-context rule

**File:** [`phase5/CONSTRAINTS.md`](./CONSTRAINTS.md), line 77 (and the dependent counts at lines 33 and 80).

**Current text, line 77:**

> \| Epic = one bounded context \| 11 epic, one per `BC-01`..`BC-11` in `phase2/BOUNDED_CONTEXT.md` §2. No epic spans 2 BC, no BC split across 2 epic. \|

**Proposed replacement:**

> \| Epic = one bounded context, or names the contexts it hardens \| A **describing** epic owns exactly one BC: `E01`..`E11` for `BC-01`..`BC-11`, plus `E16`+`E17` for `BC-12`. No describing epic spans 2 BC, no BC gets 2 describing epics — except BC-12, whose custody (E16) and operator surface (E17) are separable deliverables in different repos. A **hardening** epic (`E12`, `E13`, `E14`, `E15`, `E18`) owns no context; it names in its header which contexts it changes code inside, and may name more than one. A hardening epic exists only to remediate a finding in a dated audit or incident report, and cites it. \|

**Current text, line 33 (§2 inherited inputs table):**

> \| Bounded contexts, one epic per context \| `phase2/BOUNDED_CONTEXT.md` §2, BC-01..BC-11 \|

**Proposed replacement:**

> \| Bounded contexts, one describing epic per context \| `phase2/BOUNDED_CONTEXT.md` §2, BC-01..BC-12 \|

**Current text, line 80, final clause:**

> Each must land on ≥1 story across the 11 epics — risk register + DoD writer cross-check this, do not leave one orphaned.

**Proposed replacement:**

> Each must land on ≥1 story across the describing epics (`E01`..`E11`, `E16`, `E17`) — risk register + DoD writer cross-check this, do not leave one orphaned. A hardening epic may also carry a critical NFR, but never as the *only* place it lands: a critical NFR whose sole home is a remediation backlog is orphaned the moment the backlog closes.

**Why.** A security finding does not respect context boundaries. Audit §3.5 touches all nine services;
§3.6a changes a Redis key shape that BC-01, BC-02 and BC-10 all read. The alternative — appending hardening
stories to E01, E02, E09 and E10 — would make four epics that currently read as accurate descriptions of
shipped code into mixed documents where "built" and "must be built" sit in the same list. That is the more
damaging option, and it is the reason for the split.

**Risk if accepted.** The rule becomes weaker and a future author could label an ordinary feature epic
"hardening" to escape the 1:1 constraint. The mitigation is in the proposed text: a hardening epic must cite
a dated audit or incident report. No report, no hardening epic.

---

## 3. Amendment B — `phase2/BOUNDED_CONTEXT.md` §2, new BC-12

**File:** [`phase2/BOUNDED_CONTEXT.md`](../phase2/BOUNDED_CONTEXT.md), §2, inserted after BC-11 (line 194).

**Proposed new text, in the format the existing eleven use:**

> ### BC-12 - Session Administration & Key Custody
> **Responsibility:** Owns the signing keys that authenticate the refresh cookie, their lifecycle, and the operator-facing view of live sessions. Answers two questions no context answers today: *which key is signing right now, and can I retire it without a deploy?* and *which sessions does this account have open, and can I end them?*
> **Owns:** the `signingKey` collection and its migration, the keyring provider and its snapshot refresh in `marketplace-common`, the `rotate` / `forceRetire` operations, the session and key-custody resolvers in `BEs/dev/marketplace-dev-admin-authenticated-resource`, and the console routes in `marketplace-admin`.
> **Produces:** a keyring snapshot every cookie-signing service reads; reuse events describing what was revoked and why.
> **Consumes:** BC-01's session shape and its `familyId` (it addresses a session by a non-secret identifier, never by a token); BC-10's `hashSessionToken` for every key it touches; ADR-029's CSFLE for the key material at rest.
> **Does not own:** the authentication decision itself - BC-01 keeps that. Detection of token reuse - that fires in BC-01's hot path (E14), and this context only *displays* what it did. Deciding a ShopOwner's status - BC-03.
>
> ⚠️ **No resolver, log line, error message, test fixture or console component in this context may contain a token, a signing key, or any prefix or substring of either.** That is a defining property of the context, not a coding guideline: it is what makes an operator surface over credentials safe to build at all. Every epic under it carries a mechanical check for it (`E16-S07`, `E17-S07`).
>
> ⚠️ **Nothing here is a detection mechanism.** An operator clicking a button is never how this platform notices an attack; the automatic controls live in BC-01's request path. This context is the lever and the window, not the alarm.

**Also proposed**, in the same document:

- §3 context-map mermaid diagram: a `SKC["BC-12\nSession Administration & Key Custody"]` node, upstream of the
  five cookie-signing services and downstream of BC-01 and BC-10.
- §4 integration table: a row `| BC-12 | BC-10 Shared Kernel | Keyring provider assigned to app.keys; hashSessionToken | Shared Kernel |`
  and a row `| BC-12 | BC-01 Identity & Access | Reads the session index and family sets; calls the revocation routine | Customer/Supplier - BC-01 upstream |`.
- §6 open-questions table: the BC-12 rows from [`E16.md`](./epics/E16.md) §6 and [`E17.md`](./epics/E17.md) §6.

**Why a new context rather than extending BC-01.** BC-01 is the authentication decision — it runs on every
request, it is consumed by nine services, and it is deliberately small. Key custody has a different lifecycle
(a database collection, an admin-triggered write, a snapshot refresh loop), a different audience (one operator
rather than every user), and a different failure mode (a bad rotation logs out everyone; a bad session check
logs out one person). Folding them together would make BC-01's "Owns" list roughly twice its current length
and would put an admin console inside the context that every request passes through.

**Why not extend BC-09.** BC-09 is Platform Operations & Quality Gates — build-time and deploy-time concerns,
"Separate Ways at runtime" per that document's own §4. BC-12 is a runtime domain with a collection and
resolvers. It does not fit.

**Risk if accepted.** Twelve contexts instead of eleven, and one of them owning two epics. The 1:1 rule
survives everywhere else.

---

## 4. Amendment C — a procedure for adding a bounded context

**File:** [`phase2/BOUNDED_CONTEXT.md`](../phase2/BOUNDED_CONTEXT.md), line 10.

**Current text:**

> **Mutability:** requires team sign-off to modify - splitting or merging contexts is a major refactor

**Proposed replacement:**

> **Mutability:** requires team sign-off to modify - splitting or merging contexts is a major refactor. **Adding** a context also requires sign-off and follows the same route: a proposal in `phase5/AMENDMENTS.md` giving the full §2 entry, the §3 diagram node, the §4 integration rows and the reason it is not an extension of an existing context; on sign-off the proposal is applied here and the amendment file records the date. Removing a context is a split or a merge and is covered by the first sentence.

**Why.** This gap is what produced this file. Without a stated route, an agent or a developer adding a context
either edits a sign-off-required document silently, or stalls. Neither is a good default, and the second one
is what happened here.

---

## 5. Amendment D — `E13.md` §3, the introspection-bypass site inventory is one short

**File:** [`phase5/epics/E13.md`](./epics/E13.md), §3, and the acceptance criteria of `E13-S03` and `E13-S11`
that count from it.

**Current text:** §3 enumerates **six** places where `x-introspectioncode` is compared against
`INTROSPECTION_CODE`, all six inside this workspace: the three
`*-authenticated-resource` services' `authorizationAuthenticatedResourceHandler`, the two comparisons in
`marketplace-dev-authenticated-logout`'s `authorizationLogoutHandler`, and
`resolveAuthorizationSession` in `marketplace-common`.

**Raised by:** implementing `E13-S11`. There is a **seventh** comparison site, and it is outside all sixteen
repos: `verifyIntrospectionCode` in `@axiumine/koa-utils` (5.9.0,
`dist/private/lib/verifyIntrospectionCode.mjs`), reached from that package's own
`authenticatedResourceHandler`, `authenticatedLogoutHandler` and `authenticatedAuthorizationHandler`. It is
not dead code: those middlewares are the published ones this platform's handlers are modelled on, and any
service that mounts them — here or in another product built on the same package — gets that comparison.

**What the seventh site already satisfies, and what it does not:**

| Story | Status at the koa-utils site |
|---|---|
| `E13-S03` constant-time comparison | **already done** — `timingSafeEqual` over byte buffers, with a length pre-check |
| the `'undefined'` template-literal hole | **already closed** — it reads `process.env.INTROSPECTION_CODE` directly and returns `false` for an unset or empty value, which is *stricter* than the six workspace sites, and its docstring names the hole by name |
| `E13-S11` environment allowlist | **not done** — the bypass is live under every `NODE_ENV`, `production` included |

**Proposed:** add the seventh site to §3 as an explicitly **out-of-scope** row, with the table above, and add
one story to E13 — *"gate `verifyIntrospectionCode` on the same allowlist and cut the workspace over to the
new version"* — marked as landing in `@axiumine/koa-utils`, not here. Do not silently widen `E13-S03`'s or
`E13-S11`'s acceptance criteria to cover it: those two are verified by `yarn test:cov` and
`yarn test:mutation` in repos that cannot test another package's internals.

**Why this is not merely bookkeeping.** `E13-S11`'s stated goal is that the bypass "does not exist outside
`development` and `test`". After the six workspace sites are gated that sentence is true of this platform's
own handlers and false of the package underneath them — so a service that swaps its handler for the
published one, in this workspace or in a sibling product, silently reopens what E13 closed. The gap is worth
one line in the epic rather than a discovery during the next audit.

**Risk if rejected.** E13 closes with an accurate six-of-six claim and an inaccurate implied "all of them".
The workspace itself is not exposed today: none of the nine services mounts the koa-utils middlewares for
this check — each has its own handler, and all of those are now gated.

---

## 6. What sign-off means in practice

| Amendment | If accepted | If rejected |
|---|---|---|
| A — `CONSTRAINTS.md` §5 | Apply the three replacements; E12-E18's headers are already consistent with it | E12-E18 stay as an out-of-protocol backlog; `EPICS_STORIES.md` §2.2 already says so |
| B — BC-12 | Apply the §2 entry, the diagram node and the two §4 rows; E16 and E17 drop the "(proposed)" marker from their headers | E16 and E17 change one header line each to `hardens BC-01`; every story stands unchanged |
| C — add-a-context procedure | Apply the line 10 replacement | The gap stays open and the next context addition repeats this |
| D — the seventh bypass site | Add the out-of-scope row to `E13.md` §3 and one koa-utils story | E13's six-site inventory stays as written and the koa-utils site is tracked nowhere |

A, B and C change no acceptance criterion in any epic — they are about where the work is filed. D adds one
story and changes none of the existing ones.

---

## 7. Change log for this file

| Date | Change |
|---|---|
| 2026-08-10 | v1.0 - Amendments A, B and C raised by the E12-E18 backlog. **None applied.** |
| 2026-08-10 | v1.1 - Amendment D raised while implementing `E13-S11`: a seventh introspection-comparison site in `@axiumine/koa-utils`. **Not applied.** |
