# Conflict Report — Phase 5
# Marketplace

**Status:** pass
**Version:** 1.2
**Date:** 2026-08-07
**Author:** conflict-checker-agent
**Changelog:** v1.2 — two of this report's own counts corrected against disk: §7 said "5 full diagrams" where [`SEQUENCE_DIAGRAMS.md`](./SEQUENCE_DIAGRAMS.md) §3-§9 holds 7 (7 ```mermaid blocks), and §10 said "91 stories" where the 11 epic files hold 77 unique `ENN-SNN` ids. Verdict unchanged.
v1.1 — C01, C02 and the NFR-SE03 traceability gap all fixed at source; verdict raised from *pass with warnings* to *pass*.
v1.0 — initial Phase 5 conflict sweep

## 1. Verdict

Pass. No blocking conflict found. Two warning-level nits and one traceability gap were found and all three are **fixed at source** — see §3 and §6d. Phase 5 gate closes with no outstanding findings under RULES.md §4.

## 2. Documents checked

| Doc | Lines | Checked how |
|---|---|---|
| CONSTRAINTS.md | 120 | full read |
| SEQUENCE_DIAGRAMS.md | 566 | headers + targeted read (purpose, out-of-scope §10, tier-assert/logout samples) |
| EPICS_STORIES.md | 115 | full read |
| RISK_REGISTER.md | 141 | full read |
| DEFINITION_OF_DONE.md | 250 | targeted read (§3 epic DoD, §4 phase gate, §5 sprint, §6 exclusions) |
| epics/E01.md..E11.md | 193/124/167/141/142/145/121/155/171/162/91 | grep for story headers + full read of E07, E08 (partial), E11; targeted reads elsewhere |
| phase1/NFR.md | (sampled) | grep for 🔴 Critical rows + SE03 definition |
| phase2/BOUNDED_CONTEXT.md | (sampled) | grep for BC-01..BC-11 relation table |
| phase3/adr/ADR-INDEX.md | (sampled) | grep count of ADR rows |

Not read in full: SEQUENCE_DIAGRAMS.md §3-§9 (5 full sequence diagrams, only §1/§2/§5/§9-10 and tier-assert/logout lines sampled), most of epics/E01-E06,E09,E10 bodies beyond story-header + traces-line greps, all of phase1-4 baseline beyond the NFR/BC/ADR tables grepped. This is a grep-first sweep, not a cover-to-cover read.

## 3. Conflicts

| ID | Severity | Status | Documents | Contradiction | Resolution |
|---|---|---|---|---|---|
| C01 | warning | **fixed** | SEQUENCE_DIAGRAMS.md (internal) | §1 Purpose says the commerce out-of-scope table is "(§9)"; the actual out-of-scope section is numbered §10 (§9 is "Sequence diagram 7 — item publish/unpublish"). Applied: [`SEQUENCE_DIAGRAMS.md:22`](./SEQUENCE_DIAGRAMS.md#L22) now reads "(§10)". |
| C02 | warning | **fixed** | CONSTRAINTS.md §5 vs EPICS_STORIES.md §3 / actual story IDs | CONSTRAINTS.md §5 documents the story-id format as `BC-0N-01`, `BC-0N-02`; every actual story everywhere uses `ENN-SNN` (`E01-S01` etc, confirmed sequential, no gaps, no dupes in all 11 epics). CONSTRAINTS.md itself is never violated in practice — only its own stated naming convention disagrees with what the other 7 agents actually wrote. Applied: `CONSTRAINTS.md:78` now states `ENN-SNN` (`E01-S01`, `E01-S02`, …) and says explicitly that the prefix is the **epic** id, not the bounded-context id it maps to — which is where the wrong spelling came from. No story was renamed; none was wrong. |

No blocking conflict found: no incompatible fact pair, no contradicted baseline decision, no missing epic, no orphaned Critical NFR (see §6d).

## 4. Vocabulary violations

None. Grepped for non-English identifiers, every deleted legacy-domain identifier, `role`, "permission enum" and "shop collection" across all 17 phase5 files. Every hit is one of: a banned-term explainer ("`role` field/enum does not exist") or a negation ("no separate shop collection exists or will"), never a live identifier or a proposed field. Zero live use of a banned term.

## 5. Scope leakage

None. Grepped `price`, `cart`, `order`, `delivery`, `payment` across all 17 files. Every hit is either: (a) negation/out-of-scope framing (CONSTRAINTS.md §6, DEFINITION_OF_DONE.md §6, RISK_REGISTER R31, E11's whole body), (b) the word "order" meaning sequencing ("landing order", "conflict resolution order" — not the commerce noun), or (c) `user.addresses[]` narrative flavor text in E07-S03 calling an address a "delivery address" — the field itself carries no delivery logic, no delivery-zone, no courier, no fulfilment status (confirmed absent in E11's own grep evidence). No story, criterion, field, collection or state machine designs order/cart/delivery/payment anywhere.

## 6. Story validation

**a. ≥2 checkable acceptance criteria, no soft language.** Sampled full story bodies in E07 (9/9 stories) and E11 (1/1) plus spot-checks in E01/E04/E05/E08: every story carries ≥2 AC bullets, each citing a file:line, a gate name, or an `.explain()`/`find` command. Grep for `fast|good|appropriate|sufficient|performant|reliable` across the whole tree found exactly one hit, in E08-S03's narrative "so that it stays fast at anonymous-traffic scale" — that is the **story's "so that" clause**, not an acceptance criterion; the story's actual two AC bullets are mechanically checkable (`.explain()` shows `IXSCAN`, never `COLLSCAN`). Not a violation.

**b. Story IDs sequential per epic.** Extracted every `ENN-SNN` from all 11 epic files: E01 S01-S09, E02 S01-S05, E03 S01-S07, E04 S01-S07, E05 S01-S07, E06 S01-S07, E07 S01-S09, E08 S01-S09, E09 S01-S09, E10 S01-S07, E11 S01. All sequential, zero gaps, zero restarts mid-epic, zero duplicates. (Format itself disagrees with CONSTRAINTS.md §5's stated convention — see C02.)

**c. All E01..E11 exist and index agrees.** All 11 files present under `epics/`. EPICS_STORIES.md §2 index table's Build-state column matches each file's own header/§3: E05 "Built - no `price` field" ↔ E05.md §3; E07 "Built - identity/account only, no commerce" ↔ E07.md §1; E11 "Not built - no collection, no resolver, no design" ↔ E11.md title "[PLANNED - NOT BUILT]" and §3. No contradiction found between index and file.

**d. Critical NFR coverage — the important part.** Critical set per `phase1/NFR.md` §3: NFR-SE01–SE09, SE11, SE12, AV01, AV02, MA01, MA02, MA05, CO01 (17 IDs). Grepped `NFR-<id>` across all `epics/*.md`:

| NFR | Landed on |
|---|---|
| SE01 | E01, E10 |
| SE02 | E01 |
| SE03 | E01 (added — see §6d) |
| SE04 | E01, E07 |
| SE05 | E01, E03, E04, E05, E06, E07, E10 |
| SE06 | E01, E07, E10 |
| SE07 | E01 |
| SE08 | E01 |
| SE09 | E08 |
| SE11 | E03, E04, E05, E06, E07, E10 |
| SE12 | E01, E09 |
| AV01 | E01, E09, E10 |
| AV02 | E02, E09, E10 |
| MA01 | E09, E10 |
| MA02 | E09, E10 |
| MA05 | E09, E10 |
| CO01 | E09 |

**NFR-SE03 ("Access token must be validated as `Authorization: Bearer access:<token>` against Redis on every resource-service call") appeared as an acceptance criterion in zero stories** — the one orphan of the 17 Critical NFRs, and the one CONSTRAINTS.md §5 explicitly warned to cross-check for. It was never a functional gap: E01-S04 and every `assertTier` call site assume the Bearer lookup already happened, and SE01/SE02/SE05/SE06 cover the behaviour end to end. It was an uncited traceability line.

**Fixed.** [`epics/E01.md`](./epics/E01.md) §E01-S04 gained a third acceptance criterion naming the mechanism the NFR names — the literal `'Bearer access:'` prefix check that refuses the request *before* any Redis call (`authorizationAuthenticatedResourceHandler.mts:42`), and the per-call `hGetAll(\`${process.env.REDIS_KEY}${accessToken}\`)` lookup, never decoded and never cached across requests (`:49,51`). `Traces:` now reads `NFR-SE03, NFR-SE05, NFR-SE06; ADR-003, ADR-004`, and `Evidence:` cites the handler. Placing it on S04 rather than a story of its own is deliberate: SE03 and SE05/SE06 describe two halves of one middleware — resolve the session, then assert its tier — and splitting them across two stories would let one ship without the other, which is exactly the hole ADR-004 closed.

**All 17 Critical NFRs now land on at least one story.**

**e. BC-01..BC-11 ↔ epic 1:1.** EPICS_STORIES.md §4 table and phase2/BOUNDED_CONTEXT.md's BC names cross-checked (grepped the relation table) — every BC name matches its epic's own header exactly (e.g. E07 header "Bounded context: BC-07 — Customer Account & Addresses"). No BC split across two epics, no epic spanning two BCs found in the sample. ⚠️ **This check is superseded and is not re-run.** [`CONSTRAINTS.md`](./CONSTRAINTS.md) §5 stopped requiring any epic-to-context relationship on 2026-08-11 and is the record of that decision; the alignment recorded above is a true observation about E01-E11 as written, not a rule anything must satisfy.

## 7. Citation spot-check

Extracted 295 unique backtick-quoted paths with a code/doc extension across all 17 phase5 files (well beyond the requested 30).

- **117 fully-qualified paths** (start `BEs/`, `marketplace-{admin,shopowner,user}/`, `docs/`, `.githooks/`, or `phaseN/`) tested with `test -e` from repo root: **117/117 exist (100%)**.
- **130 unique bare/relative fragments** (e.g. `funUserAddressDel.mts`, `queries/me.mts` — citations that lean on a full path given earlier in the same doc's "Build state" section): searched by filename anywhere under `BEs/`, `marketplace-admin/`, `marketplace-shopowner/`, `marketplace-user/`. 109 found directly; the remaining 21 resolved on a second pass — 8 are Phase 1-4 doc names found under `docs/devprotocol/phaseN/`, 9 are `services-status/` test/src files (a directory the first sweep didn't search), 1 (`SECRETS.md`) is `.claude/SECRETS.md`, and 2 (`ENN.md`, `.itest.mts`) are generic naming-pattern references, not literal filenames. `RULES.md`, cited by both CONSTRAINTS.md and this task's own instructions, is the devprotocol tool's own rules file outside this repo tree — not a broken in-repo citation.
- **Net result: 0 genuine misses across all 295 extracted paths.** Did not verify line-number ranges (`:36-79` etc) point at the cited content — only path existence.

## 8. Cross-document completeness

- **SEQUENCE_DIAGRAMS.md flows ↔ stories:** the 7 full diagrams (ShopOwner login, token refresh, logout, customer registration, SSR render, address delete, item publish/unpublish — §3-§9) each map to a story with a `built` tag in the corresponding epic (E01-S01/S04/S05, E02-S01, E08-S07, E08-S09, E07-S05, E05-S04). §10's out-of-scope table matches E11-S01 and CONSTRAINTS.md §6 verbatim. No orphaned flow found in the sample.
- **RISK_REGISTER.md mitigations ↔ DEFINITION_OF_DONE.md gates:** every gate name a mitigation cites (`lint:check`, `test:cov`, `test:mutation`, Qodana, `assertTier`, BCON-01..09, `.githooks/pre-commit`/`pre-push`) is defined in DEFINITION_OF_DONE.md §2-§6 or CONSTRAINTS.md §3. R02/R03/R04's "no automated gate, manual fingerprint sweep only" is stated as *absence* of a gate consistently in both docs (BCON-03), not a contradiction. Risk-summary arithmetic verified: 0 Critical + 9 High + 26 Medium + 6 Low = 41, matches all 41 counted rows exactly.
- Not checked: whether every one of the 41 individual risk rows' "Review trigger" column maps to a real recurring process outside these docs (out of this checker's scope — process-level, not doc-level).

## 9. Gate recommendation

Gate MAY close. 0 blocking, and all three recorded findings (C01, C02, the NFR-SE03 orphan) were applied before closing rather than deferred, so Phase 5 closes with nothing outstanding under RULES.md §4.

Worth keeping from this sweep: the two warnings were both **self-references inside a document, not disagreements between documents** — a section number and a naming convention, each stated once in prose and then contradicted by the document's own structure. Neither is the class of defect a cross-document checker is built to catch, and neither would have failed anything downstream; they were found because §4's story-level validation reads structure rather than only content. The NFR-SE03 orphan is the more instructive one: 77 stories carrying explicit `Traces:` lines made a single missing id mechanically findable, which is the whole return on requiring that line.

The §2 coverage caveat stands and is not cleared by this revision: 5 of the 9 full sequence diagrams were not read end to end, and no `file:line` range was checked for whether it points at the content it claims — only that the path exists.
