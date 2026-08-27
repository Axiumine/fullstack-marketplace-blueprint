# DEVPROTOCOL — Phase Status Dashboard
# Marketplace
**Status:** Phases 1-5 complete — all five gates closed `pass`
**Version:** 1.4
**Date:** 2026-08-27
**Author:** retrofit-run
**Changelog:** v1.3 — 2026-08-27: `phase5/epics/E11.md` is **deleted with no replacement file** — the first epic record this corpus has distributed rather than relocated, unlike `E01`..`E10`, each of which moved intact to one dedicated `phase5/*.md` document. Its correction ledger and closure detail are absorbed into [`ADR-038`](./phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27, its two story records (E11-S01, E11-S02) into [`phase5/EPICS_STORIES.md`](./phase5/EPICS_STORIES.md) §6.1, and its domain nuance into `phase2/BOUNDED_CONTEXT.md`, `phase5/SHARED_KERNEL.md`, `phase2/UBIQUITOUS_LANGUAGE.md` and `phase4/API_CONTRACTS.md`. **The epic id `E11` survives in the numbering and stays `WILL NOT BUILD`; only its file is gone.** §1's Phase 5 artefact row now reads `phase5/epics/E12..E19.md`, §4 notes where the E11 record went the same way it already does for E01 and E02, and §5's epics row says `E11` has no record file of any kind. Three counts in §5 were recounted rather than adjusted, against the tree with `epics/E11.md` excluded: documents 84→83, lines 23 041→23 218 (measured at the end of the pass, not mid-way), and the `epics/`-only share of stories 103→99 while the corpus-wide total of 183 is unchanged — E11-S01 and E11-S02 already appeared in `EPICS_STORIES.md` before this pass and continue to after it.
v1.2 — 2026-08-27: ADR-038 lands — cart, order, delivery and payment are permanently out of scope, so §5 counts 38 ADRs and marks `E11` `WILL NOT BUILD`, §6's "first commerce collection" trigger is struck through because it can no longer fire, and §7's closing paragraph stops routing the four into Phase 6 behind an ADR they were never going to get. Two counts in §5 were recounted rather than adjusted: documents 83→84 and lines, both moved by this pass, and **stories 88→183**, which had matched neither the corpus-wide count nor the `epics/`-only one for some time.
v1.1 — 2026-08-27: §5's inventory was still the count taken the day the retrofit closed and every row of it had gone stale — the corpus has roughly doubled since. Re-measured against the tree: documents, ADRs, bounded contexts, epics, stories and risks. The NFR row was re-checked and is correct as written (the five §Critical rows expand to 17 ids). §6's *"as of"* sentence now points a reader at each document's own header rather than at one frozen date. Nothing about the phases or the gates changed.
v1.0 — initial dashboard, written after the Phase 5 gate closed. Brownfield retrofit: every phase artefact was reverse-engineered from the 15-repo working tree, not written ahead of code.
v1.4 — 2026-08-27, later still: `phase5/epics/E12.md` is **deleted and its record moved intact** to [`phase5/TELEMETRY_EGRESS_HARDENING.md`](./phase5/TELEMETRY_EGRESS_HARDENING.md) — the eleventh epic record to sit beside the index and the first that is not a bounded-context epic, being the head of the E12-E18 remediation block. This is the E01..E10 pattern, not E11's: nothing was distributed, because all twenty-six stories are `built`. The Documents row keeps 83 files and is recounted to 23 356 lines; the Epics row names E12 among the named records and narrows `epics/` to `E13`..`E19`; the Stories row moves 99→**84** under `epics/`, fifteen of E12's ids leaving with the file and eleven staying because four epics still cite them, with the `phase5/` total unchanged at 183. Ten sibling records and `EPICS_STORIES.md` narrow their own ranges. ⚠️ No story id changed and no build state moved.

*Updated: 2026-08-27*

Read this file first (RULES.md §12), then [`phase1/PDR.md`](./phase1/PDR.md), then [`phase2/UBIQUITOUS_LANGUAGE.md`](./phase2/UBIQUITOUS_LANGUAGE.md). Nothing else until you need it.

---

## 1. Phase status

| Phase | Status | Gate | Conflict report | Artefacts |
|---|---|---|---|---|
| Phase 1 — Discovery | ✅ Complete | closed, no checker run | none — see §7 | [`phase1/PDR.md`](./phase1/PDR.md), [`phase1/SYSTEM_CONTEXT.md`](./phase1/SYSTEM_CONTEXT.md), [`phase1/NFR.md`](./phase1/NFR.md) |
| Phase 2 — Domain Modelling | ✅ Complete | closed, no checker run | none — see §7 | [`phase2/EVENT_STORMING.md`](./phase2/EVENT_STORMING.md), [`phase2/UBIQUITOUS_LANGUAGE.md`](./phase2/UBIQUITOUS_LANGUAGE.md), [`phase2/BOUNDED_CONTEXT.md`](./phase2/BOUNDED_CONTEXT.md) |
| Phase 3 — Architecture | ✅ Complete | **pass** | [`phase3/CONFLICT_REPORT.md`](./phase3/CONFLICT_REPORT.md) v1.1 | [`phase3/C4_CONTEXT.md`](./phase3/C4_CONTEXT.md), [`phase3/C4_CONTAINER.md`](./phase3/C4_CONTAINER.md), `phase3/adr/` (29 ADRs + index + template), [`phase3/SECURITY_AUTH.md`](./phase3/SECURITY_AUTH.md), [`phase3/INFRA.md`](./phase3/INFRA.md) |
| Phase 4 — Design | ✅ Complete | **pass** | [`phase4/CONFLICT_REPORT.md`](./phase4/CONFLICT_REPORT.md) v1.1 | [`phase4/DDD_AGGREGATES.md`](./phase4/DDD_AGGREGATES.md), [`phase4/ERD.md`](./phase4/ERD.md), [`phase4/API_CONTRACTS.md`](./phase4/API_CONTRACTS.md), [`phase4/ERROR_HANDLING.md`](./phase4/ERROR_HANDLING.md) |
| Phase 5 — Behaviour | ✅ Complete | **pass** | [`phase5/CONFLICT_REPORT.md`](./phase5/CONFLICT_REPORT.md) v1.2 | [`phase5/SEQUENCE_DIAGRAMS.md`](./phase5/SEQUENCE_DIAGRAMS.md), [`phase5/EPICS_STORIES.md`](./phase5/EPICS_STORIES.md), [`phase5/IDENTITY_ACCESS.md`](./phase5/IDENTITY_ACCESS.md), [`phase5/SESSION_TERMINATION.md`](./phase5/SESSION_TERMINATION.md) [`phase5/SHOPOWNER_ONBOARDING_APPROVAL.md`](./phase5/SHOPOWNER_ONBOARDING_APPROVAL.md), [`phase5/COMPANY_LEGAL_ENTITY.md`](./phase5/COMPANY_LEGAL_ENTITY.md) , [`phase5/CATALOGUE.md`](./phase5/CATALOGUE.md) , [`phase5/CATEGORY_TAXONOMY.md`](./phase5/CATEGORY_TAXONOMY.md) , [`phase5/CUSTOMER_ACCOUNT_ADDRESSES.md`](./phase5/CUSTOMER_ACCOUNT_ADDRESSES.md) [`phase5/PUBLIC_DISCOVERY_STOREFRONT.md`](./phase5/PUBLIC_DISCOVERY_STOREFRONT.md) [`phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md`](./phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md) and [`phase5/SHARED_KERNEL.md`](./phase5/SHARED_KERNEL.md) (the E01..E10 records — the first two moved out of `epics/` on 2026-08-13, the next three on 2026-08-14, E06 on 2026-08-25, E07, E08 and E09 on 2026-08-26, E10 on 2026-08-27), `phase5/epics/E12..E19.md`, [`phase5/RISK_REGISTER.md`](./phase5/RISK_REGISTER.md), [`phase5/DEFINITION_OF_DONE.md`](./phase5/DEFINITION_OF_DONE.md) |
| Phase 6 — Code | ⬜ Open | — | — | pre-code phases are the gate; see §9 |

**Pre-flight:** not run — no `PREFLIGHT_REPORT.md` exists, and that is deliberate. See §7.

---

## 2. Gate log

RULES.md §4: a gate cannot close while its Conflict Checker Report is not `pass`. Three checkers ran. **Every finding was applied at source before its gate closed** — none deferred, none waived, no threshold moved.

| Gate | Initial verdict | Findings | Applied | Final |
|---|---|---|---|---|
| Phase 3 | pass with warnings | CF-01 (warning) — `SECURITY_AUTH.md:257` opened "8 of 9 backend services bind the unspecified address" then contradicted its own count two lines later; ADR-022 and the tree say all 9. §5 nit — `ADR-019:51` cited `docs/nginx/cache.conf` without its `marketplace-user/` prefix. | `SECURITY_AUTH.md:257` → "All 9 backend services bind the **unspecified address**". ADR-019 path prefixed — and since superseded: `marketplace-user/docs/nginx/` is deleted and every nginx citation in phase1/phase3/phase5 now points at `marketplace-nginx/` at the workspace root. | **pass** (v1.1) |
| Phase 4 | **fail** | C-01 (HIGH, blocking) — `ERD.md` and `DDD_AGGREGATES.md` disagreed on whether `admin` carries `personalData`. C-02 (LOW) — `API_CONTRACTS.md` table columns drifted at the two-agent seam (§4-5 vs §6-9). | C-01 re-verified against `BEs/marketplace-db-setup/migrations/20260301000000-create-admin.js` **and** `BEs/marketplace-common/src/models/MongoDB/Admin.mts:17-23` before touching anything — the checker was right, and `DDD_AGGREGATES.md` was wrong against both validator and model, so the fix went there and `ERD.md` was left alone. C-02 closed at the level of the rule: every §6-§8 table re-cut, and the convention written into §3 so the seam cannot silently reopen. | **pass** (v1.1) |
| Phase 5 | pass with warnings | C01 (warning) — §1 cross-referenced "(§9)" for the out-of-scope table, which is §10. C02 (warning) — `CONSTRAINTS.md` §5 documented story ids as `BC-0N-01` while all 77 real stories use `ENN-SNN`. Traceability gap — **NFR-SE03 landed on zero stories**, the one orphan of 17 Critical NFRs. | §9→§10. `CONSTRAINTS.md:78` restated as `ENN-SNN`, naming the epic id as the prefix — no story renamed, none was wrong. NFR-SE03 given a third acceptance criterion on `E01-S04` after verifying the mechanism at `…admin-authenticated-resource/src/lib/db/authorizationAuthenticatedResourceHandler.mts:42,49,51`; placed on S04 rather than its own story because SE03 and SE05/SE06 are two halves of one middleware and splitting them would let one ship without the other. | **pass** (v1.2) |

Each report keeps its own "what I did **not** read" caveat after the re-verdict rather than deleting it — a `pass` here means no conflict was found by a grep-first sweep, not that every ADR body was read cover to cover.

---

## 3. Shared constraints

Injected into every parallel agent of the phase that owns them.

| Phase | Document | Ids |
|---|---|---|
| Phase 3 | [`phase3/CONSTRAINTS.md`](./phase3/CONSTRAINTS.md) | CON-01..CON-12 |
| Phase 4 | [`phase4/CONSTRAINTS.md`](./phase4/CONSTRAINTS.md) | DCON-01..DCON-09 |
| Phase 5 | [`phase5/CONSTRAINTS.md`](./phase5/CONSTRAINTS.md) | BCON-01..BCON-09 |

Phases 1 and 2 carry none — see §7.

---

## 4. Agent output

All attempts `1`. **0 retries, 0 errors, 0 empty results across every phase.**

| Agent | Phase | Artefact | Lines | Attempt |
|---|---|---|---|---|
| `pdr-agent` | 1 | [`phase1/PDR.md`](./phase1/PDR.md) | 195 | 1 |
| `system-context-agent` | 1 | [`phase1/SYSTEM_CONTEXT.md`](./phase1/SYSTEM_CONTEXT.md) | 468 | 1 |
| `nfr-agent` | 1 | [`phase1/NFR.md`](./phase1/NFR.md) | 164 | 1 |
| `event-storming-agent` | 2 | [`phase2/EVENT_STORMING.md`](./phase2/EVENT_STORMING.md) | 371 | 1 |
| `ubiquitous-language-agent` | 2 | [`phase2/UBIQUITOUS_LANGUAGE.md`](./phase2/UBIQUITOUS_LANGUAGE.md) | 673 | 1 |
| `bounded-context-agent` | 2 | [`phase2/BOUNDED_CONTEXT.md`](./phase2/BOUNDED_CONTEXT.md) | 332 | 1 |
| `brainy-agent` | 3 | [`phase3/CONSTRAINTS.md`](./phase3/CONSTRAINTS.md) | 102 | 1 |
| `c4-agent` | 3 | [`phase3/C4_CONTEXT.md`](./phase3/C4_CONTEXT.md) | 136 | 1 |
| `c4-agent` | 3 | [`phase3/C4_CONTAINER.md`](./phase3/C4_CONTAINER.md) | 320 | 1 |
| `adr-agent` ×28 | 3 | `phase3/adr/ADR-001..028` | 3120 | 1 |
| `adr-agent` | 3 | [`phase3/adr/ADR-INDEX.md`](./phase3/adr/ADR-INDEX.md) | 87 | 1 |
| `security-agent` | 3 | [`phase3/SECURITY_AUTH.md`](./phase3/SECURITY_AUTH.md) | 392 | 1 |
| `infra-agent` | 3 | [`phase3/INFRA.md`](./phase3/INFRA.md) | 571 | 1 |
| `conflict-checker-agent` | 3 | [`phase3/CONFLICT_REPORT.md`](./phase3/CONFLICT_REPORT.md) | 62 | 1 |
| `brainy-agent` | 4 | [`phase4/CONSTRAINTS.md`](./phase4/CONSTRAINTS.md) | 127 | 1 |
| `ddd-agent` | 4 | [`phase4/DDD_AGGREGATES.md`](./phase4/DDD_AGGREGATES.md) | 407 | 1 |
| `erd-agent` | 4 | [`phase4/ERD.md`](./phase4/ERD.md) | 456 | 1 |
| `api-contracts-agent` | 4 | [`phase4/API_CONTRACTS.md`](./phase4/API_CONTRACTS.md) | 519 | 1 |
| `error-handling-agent` | 4 | [`phase4/ERROR_HANDLING.md`](./phase4/ERROR_HANDLING.md) | 521 | 1 |
| `conflict-checker-agent` | 4 | [`phase4/CONFLICT_REPORT.md`](./phase4/CONFLICT_REPORT.md) | 70 | 1 |
| `brainy-agent` | 5 | [`phase5/CONSTRAINTS.md`](./phase5/CONSTRAINTS.md) | 120 | 1 |
| `sequence-agent` | 5 | [`phase5/SEQUENCE_DIAGRAMS.md`](./phase5/SEQUENCE_DIAGRAMS.md) | 566 | 1 |
| `epics-agent` | 5 | [`phase5/EPICS_STORIES.md`](./phase5/EPICS_STORIES.md) | 115 | 1 |
| `epics-agent` ×4 | 5 | `phase5/epics/E01..E11.md` — E01's record is now [`phase5/IDENTITY_ACCESS.md`](./phase5/IDENTITY_ACCESS.md), E02's [`phase5/SESSION_TERMINATION.md`](./phase5/SESSION_TERMINATION.md), E11's absorbed with no file of its own into [`ADR-038`](./phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27 and [`phase5/EPICS_STORIES.md`](./phase5/EPICS_STORIES.md) §6.1, and E12's is now [`phase5/TELEMETRY_EGRESS_HARDENING.md`](./phase5/TELEMETRY_EGRESS_HARDENING.md) | 1618 | 1 |
| `risk-agent` | 5 | [`phase5/RISK_REGISTER.md`](./phase5/RISK_REGISTER.md) | 141 | 1 |
| `dod-agent` | 5 | [`phase5/DEFINITION_OF_DONE.md`](./phase5/DEFINITION_OF_DONE.md) | 250 | 1 |
| `conflict-checker-agent` | 5 | [`phase5/CONFLICT_REPORT.md`](./phase5/CONFLICT_REPORT.md) | 107 | 1 |

Epic ids were **hard-coded in the Phase 5 run script** (`E01`↔`BC-01` … `E11`↔`BC-11`), so the index agent and the four file agents could not disagree on a mapping. That is the fix for a class of drift, not a convenience.

---

## 5. Inventory

| Thing | Count |
|---|---|
| Documents | 83 markdown files, 23 356 lines — recounted at the end of the 2026-08-27 pass, with every file it rewrote already saved, this row included. ⚠️ The file count is **unchanged across E12's move** and that is not a stale figure: `phase5/epics/E12.md` left and `phase5/TELEMETRY_EGRESS_HARDENING.md` arrived in the same pass, one for one — unlike E11's deletion, which removed a file outright |
| ADRs | 38 accepted, `ADR-001`..`ADR-038` (+ index + `ADR-000-template.md`) |
| Bounded contexts | 12 (`BC-01`..`BC-12`) |
| Epics | 19 (`E01`..`E19`) — 18 **built**, `E11` Ordering & Fulfilment **`WILL NOT BUILD`** (ADR-038, 2026-08-27; its two stories are both recording stories and both built). `E01`..`E10` **and `E12`** are named records at `phase5/*.md` rather than files under `phase5/epics/` — E12's is [`phase5/TELEMETRY_EGRESS_HARDENING.md`](./phase5/TELEMETRY_EGRESS_HARDENING.md), moved intact on 2026-08-27 and the first exception that is not a bounded-context epic, being the head of the E12-E18 remediation block; **`E11` has no record file at all**, deleted 2026-08-27 and absorbed into [`ADR-038`](./phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27, [`phase5/EPICS_STORIES.md`](./phase5/EPICS_STORIES.md) §6.1, `phase2/BOUNDED_CONTEXT.md`, `phase5/SHARED_KERNEL.md`, `phase2/UBIQUITOUS_LANGUAGE.md` and `phase4/API_CONTRACTS.md`. `phase5/epics/` now holds `E13`..`E19` only |
| Stories | 183 unique `ENN-SNN` ids across `phase5/`, 84 of them under `phase5/epics/`. ⚠️ This row read **88** until 2026-08-27 and matched neither count; it was recounted, not adjusted. The `epics/`-only figure moved again the same day, 103→99, when `E11.md` was deleted — four ids, not two: `E11-S01` and `E11-S02` as records, now carried in `EPICS_STORIES.md` §6.1, and `E04-S08` and `E05-S08`, which no other file under `epics/` cited. It moved once more later that day, 99→**84**, when `E12.md` was deleted and its record moved beside the index: fifteen of E12's twenty-six ids left `epics/` with it, and eleven stayed because `E13.md`, `E14.md`, `E18.md` and `E19.md` cite them — `E12-S04`, `S05`, `S07`, `S09`, `S10`, `S11`, `S12`, `S14`, `S15`, `S22`, `S25`. The `phase5/` total is unchanged at 183: the record moved within `phase5/`, it did not leave |
| NFR ids | 48, of which 17 Critical — **all 17 now land on ≥1 story** |
| Risks | 54 (`R01`..`R54`) |
| Sequence diagrams | 7 full mermaid flows (§3-§9) + simple flows (§2) |

---

## 6. Stale artefacts / failures

**Stale artefacts:** none recorded.
**Failures:** none. No `retry_exhausted` event fired in any phase.

These documents described the working tree **as of 2026-08-07** and have been maintained against it since; each one carries its own **Version**, **Date** and changelog, and that header is the authority on how current it is, not this page. They go stale on their own — nothing here watches them. What invalidates what:

| Change on disk | Stales |
|---|---|
| New collection, or a `$jsonSchema` edit under `BEs/marketplace-db-setup/lib/schemas/` | [`phase4/ERD.md`](./phase4/ERD.md), [`phase4/DDD_AGGREGATES.md`](./phase4/DDD_AGGREGATES.md), the migration section of [`phase3/INFRA.md`](./phase3/INFRA.md) |
| New or changed resolver | [`phase4/API_CONTRACTS.md`](./phase4/API_CONTRACTS.md), [`phase5/SEQUENCE_DIAGRAMS.md`](./phase5/SEQUENCE_DIAGRAMS.md) |
| New service, or a port change | [`phase3/C4_CONTAINER.md`](./phase3/C4_CONTAINER.md), [`phase3/INFRA.md`](./phase3/INFRA.md), [`phase4/API_CONTRACTS.md`](./phase4/API_CONTRACTS.md) |
| Any auth-middleware edit | [`phase3/SECURITY_AUTH.md`](./phase3/SECURITY_AUTH.md), [`phase5/RISK_REGISTER.md`](./phase5/RISK_REGISTER.md) R01-R04, `E01` |
| A decision reversed | a **superseding** ADR — never an edit to an accepted one (RULES.md §10) |
| ~~The first commerce collection (cart/order)~~ | **This trigger cannot fire.** Cart, order, delivery and payment are permanently out of scope ([ADR-038](./phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md), 2026-08-27), so no first commerce collection arrives to stale anything. A collection appearing anyway is an ADR violation to revert, not a doc refresh to schedule |

---

## 7. What this retrofit did not produce, and why

Honest gaps, so nobody hunts for a file that was never meant to exist here.

- **`PREFLIGHT_REPORT.md`** — pre-flight validates a PDR against a Papa Agent preset at startup. This run *wrote* the PDR from the tree rather than consuming one, so there was nothing to validate before Phase 1 and nothing to report. Absent by design, not skipped.
- **`phase1/CONSTRAINTS.md`, `phase2/CONSTRAINTS.md`, and conflict reports for Phases 1-2** — the shared-constraint document is written by `brainy-agent` for a *parallel* phase, and the conflict checker runs *after* one. Phases 1 and 2 ran sequentially (PDR→SYSTEM_CONTEXT→NFR, then EVENT_STORMING→UBIQUITOUS_LANGUAGE→BOUNDED_CONTEXT) because each artefact is the next one's input. No parallel phase, no injected constraints, no cross-agent seam to check. Phases 3, 4 and 5 all ran parallel and all three carry both.
- **Postgres manifest store** — not provisioned. `devprotocol status` has nothing to read. Phase and artefact state live in this file and on disk, which is why this file is item 1 of the session-restore order.
- **`work/`, `papaAgents/`, `agents.config.yaml`, `.env`** — DEVPROTOCOL's own runtime namespace. This retrofit produced the *documents*, not an installation of the framework into this workspace.

---

## 8. Working state

Branch `docs/devprotocol-retrofit`. **Nothing is committed and nothing is pushed** — the whole tree above is uncommitted work. Pushing any repo here is the user's call, always (`docs/workflow.md` → *Git rules*), and no such call has been made.

---

## 9. Phase 6 entry condition

Phases 1-5 are the pre-code protocol; Phase 6 is code. The entry condition is met — five gates closed `pass`, zero outstanding findings.

Two things bind any code written from here:

1. **[`phase5/DEFINITION_OF_DONE.md`](./phase5/DEFINITION_OF_DONE.md) is the exit criterion for every story**, not a suggestion. It restates the platform's real gates — 100% coverage on all four metrics and a 100 mutation score, `lint:check`, `tsc --noEmit` and Qodana, in `.githooks/pre-commit` and `.githooks/pre-push`. Never lower a threshold; add the test.
2. **[`phase2/UBIQUITOUS_LANGUAGE.md`](./phase2/UBIQUITOUS_LANGUAGE.md) §19 is the banned-term list.** Any non-English identifier or string, every product-type term the domain-neutral catalogue must not reintroduce, and the four commerce concepts that will never have a design (ADR-038). Check a name against it before writing it.

~~Ordering, cart, delivery and payment (`E11`) are **genuinely new design with no existing model to copy**. They do not enter Phase 6 by inference from these documents — they need their own ADRs first.~~ ⚠️ **They do not enter Phase 6 at all.** On 2026-08-27 the platform owner decided the four are **permanently out of scope** ([ADR-038](./phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md)). The ADR this paragraph said they needed first is the one that closed them; re-opening any of the four takes a superseding ADR, which is the owner's call alone.
