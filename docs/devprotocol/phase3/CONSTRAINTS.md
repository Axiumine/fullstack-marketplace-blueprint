# Phase 3 — Shared constraints
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.5
**Date:** 2026-08-26
**Author:** brainy-agent
**Changelog:** v1.0 - initial retrofit.
v1.4 - 2026-08-25: CON-12's "No `user` counterpart until `user` has such a field" read as a matter of
timing. It is not — the platform owner closed `phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` §6 that day: `user` gets no approval
gate, permanently. The clause now says so, and the row's trigger list keeps refusing an empty `user` list
added for symmetry.
v1.1 - 2026-08-11: the CON-08 row's quote of `phase1/NFR.md` §4 follows that document to v1.1 — a 🔴 Critical
change needs a written owner decision, not team sign-off. Single developer; the gate itself is untouched.
v1.3 - 2026-08-12: E03-S08. CON-12 records that `marketplace-dev-public-resource` is the one repo the
`waitApprov` write-ban must never reach — `shopOwnerRegister` raises the flag there. The §4 row on the
BC-01/BC-03 and BC-01/BC-07 boundaries drops its "for now": q7 closed with CON-12 itself.
v1.2 - 2026-08-12: CON-12 added — operator-only fields are listed and linted, not translated. Records the
closed answer to a question three phase documents had open: no anti-corruption layer across `shopOwner` or
`user`, now or later.
v1.5 - 2026-08-26: §5's GDPR line annotated — applicability was decided by the platform owner on 2026-08-26, out of phase, exactly as this constraint required. The constraint itself is unchanged and still applies to the obligations that follow from the decision.

## 1. Purpose

Doc feed every Phase 3 agent same rules. Stop agent A contradict agent B. Stop Phase 3 contradict Phase 1 (`PDR.md`, `NFR.md`) or Phase 2 (`UBIQUITOUS_LANGUAGE.md`, `BOUNDED_CONTEXT.md`).

Read this: 4 Phase 3 document agents + 28 ADR agents. RULES.md §11 mandate inject this file into all of them.

If task collide with rule here — rule here win, unless §6 say otherwise.

## 2. Binding constraints

Numbered CON-xx. Each: rule, source, what break look like.

| ID | Constraint | Source | Violation looks like |
|---|---|---|---|
| CON-01 | Role = which collection you auth against. No `role` field, no permission enum, ever. | [`CLAUDE.md`](../../../CLAUDE.md) §Terminology; banned-term row in `phase2/UBIQUITOUS_LANGUAGE.md` §19 | ADR proposes `role: string` field, or `enum Role`, on any collection or session |
| CON-02 | A shop IS a `company`. No shop collection, now or later. | [`CLAUDE.md`](../../../CLAUDE.md) §Terminology, stated twice on purpose; `phase1/PDR.md` §Out of scope | ADR or doc introduces `Shop` model/collection/type |
| CON-03 | Tokens opaque + Redis-backed. Not JWT. Stale `JWT` type in some `schema.graphql` slices is dead name only. | [`docs/architecture.md`](../../architecture.md) §Auth model; banned-term row `phase2/UBIQUITOUS_LANGUAGE.md` §19 | ADR designs JWT claims, JWT expiry, JWT signing key |
| CON-04 | Every session hash carries `tier`. Every service asserts own tier via `assertTier`. Missing `tier` = invalid, not wildcard. Mismatch = 403, never 401. `REDIS_KEY` stays one shared prefix across all 9 services on purpose (logout needs it). | [`docs/architecture.md`](../../architecture.md) §Auth model; `BEs/marketplace-common/src/others/assertTier.mts:21-25`; `phase2/BOUNDED_CONTEXT.md` §6 Anti-corruption layers | ADR proposes per-tier `REDIS_KEY` prefix, or treats missing-tier session as trusted, or returns 401 on tier mismatch |
| CON-05 | One logout service (`marketplace-dev-authenticated-logout`, port 4030) serves all 3 tiers. Deletes Redis key by token content, never asks which collection minted it. | `docs/architecture.md` §Services; `phase2/BOUNDED_CONTEXT.md` BC-02, §4 Context relationships | ADR proposes tier-named logout mutations, or a 4th/per-tier logout service |
| CON-06 | 3 `*-authenticated-authorization` services share body via `marketplace-common@1.0.0` (`resolveAuthorizationSession`, `findAccountForSession`, `refreshSessionTokens`) but stay 3 deployables, 3 ports (4025/4029/4031). Merge into 1 process decided AGAINST 2026-08-07. | `docs/architecture.md` §Auth model; `docs/decisions/authorization-service-consolidation.md`; `phase1/PDR.md` §Out of scope, `phase1/NFR.md` NFR-AV01/AV02 | ADR re-opens "merge the 3 authz services into 1", cites dedup as reason |
| CON-07 | Migrations immutable, never edit applied one. `$jsonSchema` builders live `BEs/marketplace-db-setup/lib/schemas/`. Change there = full rebuild of every DB that ran the migrations, same piece of work. | [`docs/data-model.md`](../../data-model.md) §Migrations; `phase1/PDR.md` §Key outcomes | ADR edits an already-applied migration file directly, or changes a schema builder without a rebuild step |
| CON-08 | 100% coverage all 4 metrics + 100 mutation score, every package that ships code (9 BE services, `marketplace-common`, `marketplace-db-setup`, 3 frontends, `services-status`). Never lower threshold, never remove gate. | `CLAUDE.md` §Rules that apply to every task, `README.md` §Test quality gates; `phase1/PDR.md` §Key outcomes, §6; `phase1/NFR.md` §3 NFR-MA01/MA02/MA05 | ADR proposes lowering a threshold, skipping a gate, or `ignoreStatic` to silence a Stryker survivor |
| CON-09 | `marketplace-common` consumed by package name (`@axiumine/marketplace-common`), not on any registry (404s npmjs). `deploy-local.sh` is what make edit visible to 9 consumers. | `docs/workflow.md` §Repo layout; `phase2/BOUNDED_CONTEXT.md` §6 Anti-corruption layers, BC-10 row | ADR assumes `yarn install` alone picks up a common change, or proposes real npm publish as in-scope for Phase 3 |
| CON-10 | Public routes SSR. `/account/*` is `ssr: false`. Pairs with `proxy_cache` bypass on session cookie. Security boundary, not perf choice — weaken either half, leak. | [`docs/frontends.md`](../../frontends.md) §marketplace-user; `phase1/PDR.md` §In scope "Public SSR surface"; `phase2/BOUNDED_CONTEXT.md` §6 last row | ADR proposes SSR for `/account/*`, or removes/weakens the cache-bypass-on-cookie rule |
| CON-11 | English only — domain names, UI text, routes, comments. Tabs not spaces. Node `^24.18.0`. yarn everywhere. | [`CLAUDE.md`](../../../CLAUDE.md) header banner and §Two naming rules, [`docs/conventions.md`](../../conventions.md); `phase1/PDR.md` §6 Constraints | Doc/ADR use a non-English identifier for a new thing, or propose spaces-indent, or pin different Node range |
| CON-12 | Operator-only fields are named in one list and refused in lint, not translated by a layer. `OPERATOR_ONLY_FIELDS_SHOP_OWNER` (`notes`) lives in `marketplace-common`, a test there holds every name to a real `ShopOwnerSchema` path, and `no-restricted-syntax` in the 3 ShopOwner-tier repos refuses the property, the type signature, the member read and the projection string of it. **`waitApprov` is a second constant, `APPROVAL_GATE_FIELD_SHOP_OWNER`, and a narrower ban: the write only, scoped to `src/**` of the 2 authorization repos** — closing `BOUNDED_CONTEXT.md` §7 q8 made those two services legitimate readers of the flag (`checkShopOwnerApproval` at login and at every refresh), and a rule refusing the read is a rule refusing the gate. `marketplace-dev-authenticated-resource` keeps all four shapes banned: a session that reaches it is approved by construction. ⚠️ **`marketplace-dev-public-resource` carries neither rule and must not be given one** — since 2026-08-12 it holds the only *write* of the flag outside the Admin service, `registerNewShopOwner.mts:44` raising it on every `shopOwnerRegister`, which is the whole mechanism E03-S08 is made of. The ban is on the tiers that must not touch the gate, not on the field. Cross-BC boundaries on one collection are **Conformist by design, permanent** — one `$jsonSchema` builder, one model, nothing to translate. No `user` counterpart, and not "not yet" — `user` gets no approval gate at all, permanently (platform owner, 2026-08-25 — `phase5/CUSTOMER_ACCOUNT_ADDRESSES.md` §6, `adr/ADR-INDEX.md` §4), so there is no second constant coming and no list to fill in later. | `BEs/marketplace-common/src/others/operatorOnlyFields.mts`, `.../checkShopOwnerApproval.mts`; `phase5/IDENTITY_ACCESS.md` E01-S10; `phase2/BOUNDED_CONTEXT.md` §6 + §7 q7 and q8 (all closed 2026-08-12); `phase4/DDD_AGGREGATES.md` §10 q6 | ADR proposes an anti-corruption layer / per-context mapper across `shopOwner` or `user`; a projection in a ShopOwner-tier service grows `notes`; a ShopOwner-tier service *writes* `waitApprov`, or an authorization service stops projecting it; the ban is widened to `marketplace-dev-public-resource`, which would take self-registration with it; the eslint block is deleted rather than the list amended; an empty `user` list is added to look symmetric |

## 3. Vocabulary lock

Term meaning fixed by `phase2/UBIQUITOUS_LANGUAGE.md`. Do not redefine, do not rename, do not "improve."

Actor names: `ShopOwner` / `Admin` / `User` / `Company` / `Item` / `ItemCategory` — table in UBIQUITOUS_LANGUAGE.md §3.

Auth/session vocab: `Tier`, `assertTier`, session, access token, refresh token, `REDIS_KEY`, service pair, resource service, authorization service — UBIQUITOUS_LANGUAGE.md §4.

Per-collection field vocab (`waitApprov`, `onboardingStep`/`onboardingDone`, `personalData`, `addresses`, `defaultAddress`, `idParent`, `slug`, etc) — UBIQUITOUS_LANGUAGE.md §5–10.

Banned terms — full list is UBIQUITOUS_LANGUAGE.md §19, do not copy here, point at it. Short version for fast recall: no `role` field, no `price` on `item`, no `JWT` as real mechanism, no non-English identifier or string anywhere, no "customer"/"admin"/"superadmin" as code identifier, no product-type vocabulary that presumes what the catalogue sells.

Registration fields whose meaning is not obvious from the name — `vatNumber`, `taxCode`, `certifiedEmail`, `registryExtract`, `legalName` vs `publicName` — are defined once, in UBIQUITOUS_LANGUAGE.md §12. Use those definitions rather than restating them.

Planned-but-not-built commerce vocab (`Cart`, `Order`, `Delivery`, `Payment`) — named for glossary readiness only, UBIQUITOUS_LANGUAGE.md §18. Using the name is fine in prose marking something unbuilt; designing it is not (see §5 below).

## 4. Architectural invariants Phase 3 may NOT redesign

| Invariant | Why settled |
|---|---|
| 6 collections total: `admin`, `shopOwner`, `company`, `user`, `item`, `itemCategory` | `phase1/PDR.md` §In scope — verified against actual migration filenames, this is the built system, not a proposal |
| Ownership chain `shopOwner → company → item → itemCategory`, `itemCategory` self-FK depth capped at 2 | `phase2/BOUNDED_CONTEXT.md` BC-04/05/06; cap enforced in resolver (`funItemCategoryAdd.mts`) on purpose — `$jsonSchema` cannot see a parent's parent |
| `defaultAddress` is single top-level ObjectId pointer, not per-element boolean | [`docs/data-model.md`](../../data-model.md) `user` divergence #3 — pointer makes "2 defaults" inexpressible, DB `$expr` enforces validity; already paid for, not up for re-litigation |
| One shared `REDIS_KEY` prefix across all 9 services | CON-04/CON-05 above — logout depends on it structurally |
| 3 authorization services stay 3 deployables | CON-06 above — availability decision already made, argued in [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md) |
| No barrel export in `marketplace-common`, per-subpath `exports` map | [`docs/workflow.md`](../../workflow.md) §Repo layout — `yarn test:contract` gates it; Phase 3 doc/ADR is not the place to propose a barrel |
| Quality gate regime (100/100, lint, tsc, Qodana, hook wiring via `core.hooksPath`) | CON-08 above; `phase1/NFR.md` §3 marks NFR-MA01/MA02/MA05 🔴 Critical, "a written owner decision + new PDR version" to touch |
| SSR/CSR split on `marketplace-user` (public SSR, `/account/*` CSR) | CON-10 above — security mechanism, both halves load-bearing |
| Migration immutability + `lib/schemas/` as single source of `$jsonSchema` shape | CON-07 above |
| Conformist boundaries BC-01/BC-03 (`shopOwner.waitApprov`) and BC-01/BC-07 (`user.personalData`/`addresses`) stay convention-only, no ACL — **settled, not "for now"** | `phase2/BOUNDED_CONTEXT.md` §6 and q7, closed 2026-08-12 by CON-12: the protection is a named list plus lint, and there is nothing to translate across a boundary that shares one `$jsonSchema` builder and one model. Building the ACL is now a reversal, not a default |

Phase 3 CAN: document these, diagram these, write ADR that records WHY they exist or evaluates option AGAINST them (and loses, per CON-06 precedent). Phase 3 CANNOT: propose replacing any row above as if greenfield.

## 5. Out of scope for Phase 3

No design, no diagram, no ADR that presumes these exist or invents their shape:

- **Order** — no collection, no state machine, no resolver.
- **Cart** — no collection.
- **Delivery** — no collection, no resolver, no design.
- **Payment** — no gateway chosen, no integration.
- **Price on `item`** — deliberately absent, comment at `BEs/marketplace-db-setup/lib/schemas/item.js` says why. Do not add "just a field" — a price with nothing to buy is a guess at an undesigned decision.

These 4 are BC-11 "Ordering & Fulfilment [PLANNED - NOT BUILT]" in `phase2/BOUNDED_CONTEXT.md`. Its own §6 row says explicit: do not pre-build an ACL for a context with no shape yet. Same logic bind Phase 3 — naming the term in a glossary-reference way (already done, UBIQUITOUS_LANGUAGE.md §18) is fine; drawing its schema, its resolver, its state machine is not. **Ask before inventing them** — [`CLAUDE.md`](../../../CLAUDE.md) §Build state, said twice in that file already.

Also out of scope for Phase 3 doc work (not new domain gaps, just not this phase's job):

- Installing nginx config (written and container-tested at `marketplace-nginx/` in the workspace root, no nginx binary on this machine).
- Publishing any repo to a forge / choosing an org — user's undecided call.
- Publishing `marketplace-common` to a real npm registry.
- Deciding GDPR applicability (NFR-CO02). ⚠️ **Decided 2026-08-26, out of phase as this line intended** — GDPR is in scope (`phase1/NFR.md` §2.7, open question 1 closed). The line stays because it still describes correctly what Phase 3 may not do: the six unimplemented obligations behind it (`phase1/NFR.md` open question 6) are not Phase 3's to scope either.

## 6. Conflict resolution order

When two docs disagree, higher row wins:

| Rank | Document |
|---|---|
| 1 (highest) | `phase1/PDR.md` |
| 2 | `phase1/NFR.md` |
| 3 | `phase2/UBIQUITOUS_LANGUAGE.md` |
| 4 | `phase2/BOUNDED_CONTEXT.md` |
| 5 (lowest) | Phase 3 docs (this file, the 4 document agents' output, the 29 ADRs) |

Phase 3 docs never outrank Phase 1/2. A Phase 3 ADR that contradicts PDR/NFR is wrong, not a superseding decision — fix the ADR, don't reinterpret the PDR. If a genuine Phase 1/2 error is found, that goes back through `RULES.md` change-control (PDR §9, NFR §4), not silently overridden in a Phase 3 doc.

Within Phase 3 itself: this CONSTRAINTS.md wins over any single document-agent or ADR-agent output — that is the whole reason it exists (RULES.md §11).
