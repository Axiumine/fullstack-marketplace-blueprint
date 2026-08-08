# Conflict Report — Phase 3
# Marketplace
**Status:** pass
**Version:** 1.1
**Date:** 2026-08-07
**Author:** conflict-checker-agent
**Changelog:** v1.1 — CF-01 and the §5 citation nit fixed at source; verdict raised from *pass with warnings* to *pass*.
v1.0 — initial Phase 3 conflict sweep

## 1. Verdict

Pass. RULES.md §4 close gate needs no blocking conflict. One warning found (CF-01, count contradiction self-corrected two sentences later in same doc), **fixed at source** — see §3. Zero blocking. Zero vocab violation. Zero scope leakage. Gate may close.

## 2. Documents checked

| Document | Lines | Checked how |
|---|---|---|
| C4_CONTEXT.md | 7225B | grep sweep, targeted read |
| C4_CONTAINER.md | 26999B | grep sweep, targeted read |
| SECURITY_AUTH.md | 40872B | grep sweep, 3 targeted reads |
| INFRA.md | 33238B | grep sweep, targeted read |
| CONSTRAINTS.md | 10956B | grep sweep, full-ish (short doc) |
| adr/ADR-001..028 + ADR-INDEX + ADR-000-template | 4728 lines total | title/date/CON-ref grep sweep across all 28, 6 files opened for context around hits |
| phase1/PDR.md | 195 | grep sweep for scope/count claims |
| phase1/NFR.md | 164 | grep sweep for NFR-AV IDs |
| phase1/SYSTEM_CONTEXT.md | — | spot-checked §7 citation only |
| phase2/UBIQUITOUS_LANGUAGE.md | 632 | read §19 Banned Terms in full |
| phase2/BOUNDED_CONTEXT.md | 332 | grep sweep for BC-xx IDs |

Method was grep-first per instructions — did not read all 28 ADRs cover to cover, only titles, headers, and lines around each grep hit.

## 3. Conflicts

| ID | Severity | Status | Documents | Contradiction | Resolution |
|---|---|---|---|---|---|
| CF-01 | warning | **fixed** | SECURITY_AUTH.md (self), ADR-022, C4_CONTAINER.md, CLAUDE.md baseline | SECURITY_AUTH.md:257 open "8 of 9 backend services bind the unspecified address" then same sentence-group says "binding a LAN address... would break all nine" — self-contradicts its own count. ADR-022 title and body say all NINE Koa services bind wildcard; the one loopback exception (`marketplace-user/serve.mjs`) is the SSR frontend, not one of the nine backend services, so it is not a "1 of 9" carve-out at all. Applied: `SECURITY_AUTH.md:257` now reads "All 9 backend services bind the **unspecified address**". |

No other factual contradiction found between Phase 3 docs, or between Phase 3 and Phase 1/2 baseline, in what was checked (see §2 method — grep-driven, not exhaustive).

Checked and clean: all port numbers (4024-4032, 3043-3045) agree across C4_CONTAINER, CONSTRAINTS, SECURITY_AUTH, INFRA, and match CLAUDE.md. 6-collection count agrees everywhere it appears. 28-ADR count agrees (CONSTRAINTS.md says "28 ADR agents", 28 files ADR-001..028 exist on disk, ADR-INDEX table has 28 rows). Repo counts (15 total / 14 sub-repos / 9 backend services) agree everywhere sampled. CON-01..CON-11 all referenced by ADRs actually exist in CONSTRAINTS.md, none dangling. BC-02 cross-refs (logout) agree between CONSTRAINTS.md and BOUNDED_CONTEXT.md. ADR header dates agree with ADR-INDEX table dates in the 5-file sample checked (ADR-001, 002, 007, 016, 028). No duplicate/overlapping ADR pair found — 28 titles scanned, each covers a distinct decision, no two deciding the same question.

## 4. Vocabulary violations

None found. Grepped the banned-term list in `phase2/UBIQUITOUS_LANGUAGE.md` §19 — non-English identifiers and strings, `role`/permission-enum, `price`, "shop collection", and product-type vocabulary that would presume what the catalogue sells — across all of phase3/ + phase3/adr/. Every hit is a correct statement that the field/collection does NOT exist. None reintroduce a banned term as a live identifier or a proposed field. ADR-008 even embeds the exact verification grep from CLAUDE.md as its own closure check.

## 5. Citation spot-check

Extracted 97 unique backtick-quoted repo-relative paths cited across phase3/ + phase3/adr/. Sampled 62 of them (two batches, ~64%) with `test -e`.

Result: 61/62 resolved. 1 near-miss, **since fixed**: ADR-019-urql-client-per-ssr-request.md:51 cited `docs/nginx/cache.conf` with no `marketplace-user/` prefix — every other citation of the same file (9+ other places, including 2 in ADR-019's own sibling ADRs) correctly writes `marketplace-user/docs/nginx/cache.conf`. Not a broken path, an incomplete one — unambiguous from context but technically doesn't resolve as written from repo root. Not counted as blocking.

⚠️ **Overtaken by events, and the fix went the other way.** `marketplace-user/docs/nginx/` no longer exists: the edge was rewritten as three vhosts under `nginx/` at the workspace root and the customer-only copy was deleted. Every citation this section validated — the prefixed ones included — has since been repointed at `nginx/conf.d/`, `nginx/snippets/` and `nginx/sites-available/`. The audit's finding was correct when made; the file it was about is gone.

Two `file:line-line` citations were verified against actual file content, not just existence: `marketplace-user/docs/nginx/cache.conf:21-30` and `:36-42`, both quoted verbatim in SECURITY_AUTH.md and INFRA.md — content matches the real file, line numbers are off by 1-3 (the map block starts at line 21 in the doc's citation vs line 21 in the actual file — confirmed exact; the upstream block citation is off by ~2 lines against the real file's line 34, not 36). Not flagged as a conflict — too fine-grained to be a factual contradiction, more a citation-precision nit.

⚠️ Both now point elsewhere. The cache map is `nginx/conf.d/30-cache.conf:32-35` and is **one** map, not the pair quoted here — `$mkt_user_has_session` was collapsed into `$mkt_user_no_cache`. The upstream block is `nginx/conf.d/10-upstreams.conf:24-56` and has eleven entries, not seven: the two panel tiers were never in the customer-only file.

Did NOT check: the other 35 of 97 paths, and did not verify any other `file:line` citation's line-number accuracy beyond the two above. Say so rather than implying full coverage.

## 6. Scope leakage

None found. Grepped `cart`, `order`, `delivery`, `payment` across all of phase3/. Every hit is one of: (a) a statement that the collection/model/resolver does not exist and is out of scope, (b) the English word "order" meaning sequence (hook execution order, conflict-resolution order — CONSTRAINTS.md §6), or (c) "delivery" in the generic sense "infrastructure and delivery" (an ADR category tag) or "quality-gate mechanism... delivery" (CI/CD delivery, not the commerce concept). ADR-009 is the fullest treatment and explicitly rejects adding `price` until Cart/Order/Payment get a real ADR. ADR-010 has one borderline phrase ("mark one as the delivery default") describing why `user.addresses[]` needs a default pointer — read closely, it explains the address-shape decision does NOT model a checkout flow ("decision is about data-integrity shape, not about a checkout flow that does not exist"), so not a design of delivery, just a shared English word. No document proposes a schema, resolver, or field for order/cart/delivery/payment.

## 7. Gate recommendation

Gate MAY close, and both recorded defects are already fixed. Zero blocking conflicts, zero vocabulary violations, zero scope leakage. The one warning (CF-01) — a self-contradicting sentence count in SECURITY_AUTH.md §5 — did not describe an incompatible technology, a contradictory data model, or a conflicting security requirement (the correct fact — all nine wildcard, SSR loopback is a separate 10th process — was stated in full two lines later in the same file, and correctly everywhere else it appears). Per the severity rubric that is "warning," not "blocking." CF-01 and the ADR-019 path prefix (§5) were both applied before the gate closed, so Phase 3 closes with no outstanding findings under RULES.md §4.
