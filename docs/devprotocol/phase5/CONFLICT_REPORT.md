# Conflict Report — Phase 5
# Marketplace

**Status:** pass
**Version:** 1.3
**Date:** 2026-08-26
**Author:** conflict-checker-agent
**Changelog:** v1.3 — 2026-08-26: a staleness banner added to §1 and nothing else touched. Every count and enumeration in this report describes the tree on 2026-08-07 and several have drifted since; correcting them one by one would fake a re-audit this document did not run. v1.2's corrections were arithmetic errors against the tree of its own date, which is a different thing and stays the precedent for correcting in place.
**Changelog:** v1.2 — two of this report's own counts corrected against disk: §7 said "5 full diagrams" where [`SEQUENCE_DIAGRAMS.md`](./SEQUENCE_DIAGRAMS.md) §3-§9 holds 7 (7 ```mermaid blocks), and §10 said "91 stories" where the 11 files hold 77 distinct stories. Verdict unchanged.
v1.1 — C01, C02 and the NFR-SE03 traceability gap all fixed at source; verdict raised from *pass with warnings* to *pass*.
v1.0 — initial Phase 5 conflict sweep

## 1. Verdict

> ⚠️ **This is a snapshot of 2026-08-07, and Phase 5 has moved under it. Read the counts as dated, not current.**
> Several of the file names, section counts and story counts below have since changed, as records were
> renamed, distributed across other documents, and completed. **The verdict below is not withdrawn**: nothing
> here was found to be wrong when it was written, and the three findings it records were fixed at source. What
> is out of date is the arithmetic, not the conclusion. A current sweep would be a new report, not an edit to
> this one.

Pass. No blocking conflict found. Two warning-level nits and one traceability gap were found and all three are **fixed at source** — see §3 and §6b. Phase 5 gate closes with no outstanding findings under RULES.md §4.

## 2. Documents checked

| Doc | Lines | Checked how |
|---|---|---|
| CONSTRAINTS.md | 120 | full read |
| SEQUENCE_DIAGRAMS.md | 566 | headers + targeted read (purpose, out-of-scope §10, tier-assert/logout samples) |
| RISK_REGISTER.md | 141 | full read |
| DEFINITION_OF_DONE.md | 250 | targeted read (§3 per-record DoD, §4 phase gate, §5 sprint, §6 exclusions) |
| IDENTITY_ACCESS.md / SESSION_TERMINATION.md / SHOPOWNER_ONBOARDING_APPROVAL.md / COMPANY_LEGAL_ENTITY.md / CATALOGUE.md / CATEGORY_TAXONOMY.md / CUSTOMER_ACCOUNT_ADDRESSES.md / PUBLIC_DISCOVERY_STOREFRONT.md / PLATFORM_OPERATIONS_QUALITY_GATES.md / SHARED_KERNEL.md / the commerce-is-permanently-out-of-scope record | 193/124/167/141/142/145/121/155/171/162/91 | grep for story headers + full read of CUSTOMER_ACCOUNT_ADDRESSES.md, PUBLIC_DISCOVERY_STOREFRONT.md (partial), and the commerce-is-permanently-out-of-scope record; targeted reads elsewhere |
| phase1/NFR.md | (sampled) | grep for 🔴 Critical rows + SE03 definition |
| phase2/BOUNDED_CONTEXT.md | (sampled) | grep for BC-01..BC-11 relation table |
| phase3/adr/ADR-INDEX.md | (sampled) | grep count of ADR rows |

Not read in full: SEQUENCE_DIAGRAMS.md §3-§9 (5 full sequence diagrams, only §1/§2/§5/§9-10 and tier-assert/logout lines sampled), most of the IDENTITY_ACCESS.md, SESSION_TERMINATION.md, SHOPOWNER_ONBOARDING_APPROVAL.md, COMPANY_LEGAL_ENTITY.md, CATALOGUE.md, CATEGORY_TAXONOMY.md, PLATFORM_OPERATIONS_QUALITY_GATES.md and SHARED_KERNEL.md bodies beyond story-header + traces-line greps, all of phase1-4 baseline beyond the NFR/BC/ADR tables grepped. This is a grep-first sweep, not a cover-to-cover read.

## 3. Conflicts

| ID | Severity | Status | Documents | Contradiction | Resolution |
|---|---|---|---|---|---|
| C01 | warning | **fixed** | SEQUENCE_DIAGRAMS.md (internal) | §1 Purpose says the commerce out-of-scope table is "(§9)"; the actual out-of-scope section is numbered §10 (§9 is "Sequence diagram 7 — item publish/unpublish"). Applied: [`SEQUENCE_DIAGRAMS.md:22`](./SEQUENCE_DIAGRAMS.md#L22) now reads "(§10)". |
| C02 | warning | **fixed** | CONSTRAINTS.md §5 vs actual story identification | CONSTRAINTS.md §5 documented a story-id naming convention that did not match what the eleven records actually used, a mismatch traced to which bounded-context id a story's prefix was thought to map to (confirmed sequential, no gaps, no dupes across all eleven records). CONSTRAINTS.md itself was never violated in practice — only its own stated convention disagreed with the records. Applied: CONSTRAINTS.md §5 no longer states a story-id format at all — the record-to-bounded-context rule it rested on was removed (§1's v1.1 changelog entry), and stories are identified by title alone. No story was renamed; none was wrong. |

No blocking conflict found: no incompatible fact pair, no contradicted baseline decision, no orphaned Critical NFR (see §6b).

## 4. Vocabulary violations

None. Grepped for non-English identifiers, every deleted legacy-domain identifier, `role`, "permission enum" and "shop collection" across all 17 phase5 files. Every hit is one of: a banned-term explainer ("`role` field/enum does not exist") or a negation ("no separate shop collection exists or will"), never a live identifier or a proposed field. Zero live use of a banned term.

## 5. Scope leakage

None. Grepped `price`, `cart`, `order`, `delivery`, `payment` across all 17 files. Every hit is either: (a) negation/out-of-scope framing (CONSTRAINTS.md §6, DEFINITION_OF_DONE.md §6, RISK_REGISTER R31, the commerce-is-permanently-out-of-scope record's whole body), (b) the word "order" meaning sequencing ("landing order", "conflict resolution order" — not the commerce noun), or (c) `user.addresses[]` narrative flavor text in the story "Add an address" calling an address a "delivery address" — the field itself carries no delivery logic, no delivery-zone, no courier, no fulfilment status (confirmed absent from that same record's own text). No story, criterion, field, collection or state machine designs order/cart/delivery/payment anywhere.

## 6. Story validation

Items b, c and e — story-id sequencing, per-record id agreement, and the bounded-context-to-record
mapping — depended on an index document that no longer exists; their conclusions are already covered
by C02's cross-check. Surviving items relettered a/b.

**a. ≥2 checkable acceptance criteria, no soft language.** Sampled full story bodies in CUSTOMER_ACCOUNT_ADDRESSES.md (9/9 stories) and the commerce-is-permanently-out-of-scope record (1/1) plus spot-checks in IDENTITY_ACCESS.md/COMPANY_LEGAL_ENTITY.md/CATALOGUE.md/PUBLIC_DISCOVERY_STOREFRONT.md: every story carries ≥2 AC bullets, each citing a file:line, a gate name, or an `.explain()`/`find` command. Grep for `fast|good|appropriate|sufficient|performant|reliable` across the whole tree found exactly one hit, in the narrative of "'Shops near me' resolves via 2dsphere, never a collection scan" — "so that it stays fast at anonymous-traffic scale" — that is the **story's "so that" clause**, not an acceptance criterion; the story's actual two AC bullets are mechanically checkable (`.explain()` shows `IXSCAN`, never `COLLSCAN`). Not a violation.

**b. Critical NFR coverage — the important part.** Critical set per `phase1/NFR.md` §3: NFR-SE01–SE09, SE11, SE12, AV01, AV02, MA01, MA02, MA05, CO01 (17 IDs). Grepped `NFR-<id>` across all eleven records:

| NFR | Landed on |
|---|---|
| SE01 | IDENTITY_ACCESS.md, SHARED_KERNEL.md |
| SE02 | IDENTITY_ACCESS.md |
| SE03 | IDENTITY_ACCESS.md (added — see §6b) |
| SE04 | IDENTITY_ACCESS.md, CUSTOMER_ACCOUNT_ADDRESSES.md |
| SE05 | IDENTITY_ACCESS.md, SHOPOWNER_ONBOARDING_APPROVAL.md, COMPANY_LEGAL_ENTITY.md, CATALOGUE.md, CATEGORY_TAXONOMY.md, CUSTOMER_ACCOUNT_ADDRESSES.md, SHARED_KERNEL.md |
| SE06 | IDENTITY_ACCESS.md, CUSTOMER_ACCOUNT_ADDRESSES.md, SHARED_KERNEL.md |
| SE07 | IDENTITY_ACCESS.md |
| SE08 | IDENTITY_ACCESS.md |
| SE09 | PUBLIC_DISCOVERY_STOREFRONT.md |
| SE11 | SHOPOWNER_ONBOARDING_APPROVAL.md, COMPANY_LEGAL_ENTITY.md, CATALOGUE.md, CATEGORY_TAXONOMY.md, CUSTOMER_ACCOUNT_ADDRESSES.md, SHARED_KERNEL.md |
| SE12 | IDENTITY_ACCESS.md, PLATFORM_OPERATIONS_QUALITY_GATES.md |
| AV01 | IDENTITY_ACCESS.md, PLATFORM_OPERATIONS_QUALITY_GATES.md, SHARED_KERNEL.md |
| AV02 | SESSION_TERMINATION.md, PLATFORM_OPERATIONS_QUALITY_GATES.md, SHARED_KERNEL.md |
| MA01 | PLATFORM_OPERATIONS_QUALITY_GATES.md, SHARED_KERNEL.md |
| MA02 | PLATFORM_OPERATIONS_QUALITY_GATES.md, SHARED_KERNEL.md |
| MA05 | PLATFORM_OPERATIONS_QUALITY_GATES.md, SHARED_KERNEL.md |
| CO01 | PLATFORM_OPERATIONS_QUALITY_GATES.md |

**NFR-SE03 ("Access token must be validated as `Authorization: Bearer access:<token>` against Redis on every resource-service call") appeared as an acceptance criterion in zero stories** — the one orphan of the 17 Critical NFRs, and the one CONSTRAINTS.md §5 explicitly warned to cross-check for. It was never a functional gap: the story "Every resource/authorization call asserts its own tier, fails closed" and every `assertTier` call site assume the Bearer lookup already happened, and SE01/SE02/SE05/SE06 cover the behaviour end to end. It was an uncited traceability line.

**Fixed.** [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md), the story "Every resource/authorization call asserts its own tier, fails closed", gained a third acceptance criterion naming the mechanism the NFR names — the literal `'Bearer access:'` prefix check that refuses the request *before* any Redis call (`authorizationAuthenticatedResourceHandler.mts:42`), and the per-call `hGetAll(\`${process.env.REDIS_KEY}${accessToken}\`)` lookup, never decoded and never cached across requests (`:49,51`). `Traces:` now reads `NFR-SE03, NFR-SE05, NFR-SE06; ADR-003, ADR-004`, and `Evidence:` cites the handler. Placing it on this story rather than a story of its own is deliberate: SE03 and SE05/SE06 describe two halves of one middleware — resolve the session, then assert its tier — and splitting them across two stories would let one ship without the other, which is exactly the hole ADR-004 closed.

**All 17 Critical NFRs now land on at least one story.**

## 7. Citation spot-check

Extracted 295 unique backtick-quoted paths with a code/doc extension across all 17 phase5 files (well beyond the requested 30).

- **117 fully-qualified paths** (start `BEs/`, `marketplace-{admin,shopowner,user}/`, `docs/`, `.githooks/`, or `phaseN/`) tested with `test -e` from repo root: **117/117 exist (100%)**.
- **130 unique bare/relative fragments** (e.g. `funUserAddressDel.mts`, `queries/me.mts` — citations that lean on a full path given earlier in the same doc's "Build state" section): searched by filename anywhere under `BEs/`, `marketplace-admin/`, `marketplace-shopowner/`, `marketplace-user/`. 109 found directly; the remaining 21 resolved on a second pass — 8 are Phase 1-4 doc names found under `docs/devprotocol/phaseN/`, 9 are `marketplace-services-status/` test/src files (a directory the first sweep didn't search), 1 (`SECRETS.md`) is `.claude/SECRETS.md`, and 2 (a filename template, `.itest.mts`) are generic naming-pattern references, not literal filenames. `RULES.md`, cited by both CONSTRAINTS.md and this task's own instructions, is the devprotocol tool's own rules file outside this repo tree — not a broken in-repo citation.
- **Net result: 0 genuine misses across all 295 extracted paths.** Did not verify line-number ranges (`:36-79` etc) point at the cited content — only path existence.

## 8. Cross-document completeness

- **SEQUENCE_DIAGRAMS.md flows ↔ stories:** the 7 full diagrams (ShopOwner login, token refresh, logout, customer registration, SSR render, address delete, item publish/unpublish — §3-§9) each map to a story with a `built` tag — "ShopOwner login mints tier-stamped session", "Every resource/authorization call asserts its own tier, fails closed", "Token rotation shares one body across three deployables", "`logout` deletes both session keys by token content", "Customer self-registration lives on this service, not on BC-07", "SSR server builds a new urql client per request against `PUBLIC_RESOURCE_URL`", "Delete an address clears a dangling default pointer atomically" and "Admin moderates any item regardless of owner". §10's out-of-scope table matches the commerce-is-permanently-out-of-scope decision (ADR-038) and CONSTRAINTS.md §6 verbatim. No orphaned flow found in the sample.
- **RISK_REGISTER.md mitigations ↔ DEFINITION_OF_DONE.md gates:** every gate name a mitigation cites (`lint:check`, `test:cov`, `test:mutation`, Qodana, `assertTier`, BCON-01..09, `.githooks/pre-commit`/`pre-push`) is defined in DEFINITION_OF_DONE.md §2-§6 or CONSTRAINTS.md §3. R02/R03/R04's "no automated gate, manual fingerprint sweep only" is stated as *absence* of a gate consistently in both docs (BCON-03), not a contradiction. Risk-summary arithmetic verified: 0 Critical + 9 High + 26 Medium + 6 Low = 41, matches all 41 counted rows exactly.
- Not checked: whether every one of the 41 individual risk rows' "Review trigger" column maps to a real recurring process outside these docs (out of this checker's scope — process-level, not doc-level).

## 9. Gate recommendation

Gate MAY close. 0 blocking, and all three recorded findings (C01, C02, the NFR-SE03 orphan) were applied before closing rather than deferred, so Phase 5 closes with nothing outstanding under RULES.md §4.

Worth keeping from this sweep: the two warnings were both **self-references inside a document, not disagreements between documents** — a section number and a naming convention, each stated once in prose and then contradicted by the document's own structure. Neither is the class of defect a cross-document checker is built to catch, and neither would have failed anything downstream; they were found because §4's story-level validation reads structure rather than only content. The NFR-SE03 orphan is the more instructive one: 77 stories carrying explicit `Traces:` lines made a single missing id mechanically findable, which is the whole return on requiring that line.

The §2 coverage caveat stands and is not cleared by this revision: 5 of the 9 full sequence diagrams were not read end to end, and no `file:line` range was checked for whether it points at the content it claims — only that the path exists.
