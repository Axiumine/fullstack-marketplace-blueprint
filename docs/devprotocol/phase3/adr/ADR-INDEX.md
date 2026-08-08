# ADR Index
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.0
**Date:** 2026-08-07
**Author:** adr-agent
**Changelog:** v1.0 - initial retrofit; 28 decisions backfilled from the working tree

## 1. How to use this index

ADRs are immutable once accepted. Never edit one. To change a decision, write a new ADR and set its
`Supersedes` field, then flip the old one's `Superseded by`. All 28 below are `accepted` with no
supersession yet — this is the first pass.

New ADR: copy `ADR-000-template.md`, next free number, fill in `Status`, `Date`, `Deciders`.

Enterprise fields (Security Review, Privacy Review, Cost Estimate, Compliance Impact) are **not**
required in this repo's ADRs — there is no `agents.config.yaml`, so `compliance.profile` is `none`.

## 2. Index

| ADR | Title | Status | Date | Supersedes | Superseded by | Area |
|---|---|---|---|---|---|---|
| ADR-001 | Polyrepo over monorepo | accepted | 2026-08-04 | — | — | Infrastructure and delivery |
| ADR-002 | Role is the authentication collection | accepted | 2026-08-04 | — | — | Identity and access |
| ADR-003 | Opaque tokens, Redis sessions, not JWT | accepted | 2026-08-04 | — | — | Identity and access |
| ADR-004 | Per-tier session assertion (fail closed, 403, shared REDIS_KEY) | accepted | 2026-08-05 | — | — | Identity and access |
| ADR-005 | Single logout service, all tiers | accepted | 2026-08-05 | — | — | Identity and access |
| ADR-006 | Authorization services share body, keep three deployables | accepted | 2026-08-07 | — | — | Identity and access |
| ADR-007 | Company is the shop | accepted | 2026-08-03 | — | — | Data model |
| ADR-008 | Domain-neutral catalogue (item + itemCategory) | accepted | 2026-08-05 | — | — | Catalogue |
| ADR-009 | No price on item | accepted | 2026-08-05 | — | — | Catalogue |
| ADR-010 | Default-address pointer, not a per-address boolean | accepted | 2026-08-05 | — | — | Data model |
| ADR-011 | Soft delete via `deleted` date, global uniques stay occupied | accepted | 2026-08-04 | — | — | Data model |
| ADR-012 | itemCategory depth capped at two, in the resolver, admin-only writes | accepted | 2026-08-05 | — | — | Catalogue |
| ADR-013 | English-only naming, applied migrations rewritten in place | accepted | 2026-08-04 | — | — | Data model |
| ADR-014 | Migrations immutable, `$jsonSchema` shapes shared in lib/schemas/ | accepted | 2026-08-04 | — | — | Data model |
| ADR-015 | marketplace-common: package-name consumption, unpublished, deploy-local.sh bridges | accepted, amended 2026-08-08 | 2026-08-04 | — | — | Build and quality gates |
| ADR-016 | 100% coverage on all four metrics + 100 mutation score, everywhere | accepted | 2026-08-06 | — | — | Build and quality gates |
| ADR-017 | Hooks via core.hooksPath + prepare script, Qodana in pre-commit and pre-push | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-018 | SSR public routes, CSR-only /account/*, cache bypasses on session cookie | accepted | 2026-08-05 | — | — | Frontend |
| ADR-019 | New urql client per SSR request, un-prefixed PUBLIC_RESOURCE_URL | accepted | 2026-08-05 | — | — | Frontend |
| ADR-020 | Route files as one-line createFileRoute, behaviour in routeOptions | accepted | 2026-08-05 | — | — | Frontend |
| ADR-021 | preferGetMethod stays false (csrfPrevention everywhere) | accepted | 2026-08-05 | — | — | Frontend |
| ADR-022 | Nine services bind wildcard; SSR server binds loopback | accepted | 2026-08-07 | — | — | Infrastructure and delivery |
| ADR-023 | Per-repo integration database, named identically in three variables | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-024 | Tabs everywhere, eslint + prettier together, tree-wide | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-025 | services-status has no repo of its own, gated by parent hooks | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-026 | engines.node = ^24.18.0 everywhere, caret included | accepted | 2026-08-07 | — | — | Build and quality gates |
| ADR-027 | One frontend app per tier, not one app that switches on role | accepted | 2026-08-05 | — | — | Frontend |
| ADR-028 | GraphQL is the whole API; three REST endpoints serve email verify only | accepted | 2026-08-05 | — | — | Infrastructure and delivery |

## 3. By area

**Identity and access** — ADR-002, ADR-003, ADR-004, ADR-005, ADR-006

**Data model** — ADR-007, ADR-010, ADR-011, ADR-013, ADR-014

**Catalogue** — ADR-008, ADR-009, ADR-012

**Frontend** — ADR-018, ADR-019, ADR-020, ADR-021, ADR-027

**Build and quality gates** — ADR-015, ADR-016, ADR-017, ADR-023, ADR-024, ADR-025, ADR-026

**Infrastructure and delivery** — ADR-001, ADR-022, ADR-028

## 4. Decisions deliberately NOT re-opened

| Temptation | Settled by | Why not |
|---|---|---|
| Merge the three authorization services into one | ADR-006 | dispatching on a tier read from the session is the pattern ADR-002 rejects; one `process.exit(1)` for three tiers is an availability cost paid by customers |
| Per-tier `REDIS_KEY` prefixes | ADR-004 | breaks the single logout service (ADR-005), which finds a session by token content alone; the tier assertion is the layer that holds even if a prefix is reused by mistake |
| Add a `role` field / permission enum | ADR-002 | role = which collection you authenticate against, by design; a role field duplicates that |
| Add a shop collection | ADR-007 | a shop is a company; a shop collection reintroduces the cardinality bug the extraction fixed |
| Add a `price` field to `item` | ADR-009 | order/cart/delivery/payment have no design yet; a price with nothing to buy is a guess at a decision nobody has made |
| Lower a coverage or mutation threshold | ADR-016 | the rule that outlived every other instruction here; a commit that needs a threshold lowered needs a test instead |
| Add `ignoreStatic` to a Stryker config | ADR-016 | masks real gaps; the survivor it appears to fix is usually a load-time mutant needing a dynamic import instead |
| Reintroduce vocabulary that presumes what is sold | ADR-008 | catalogue is domain-neutral on purpose; nothing in item/itemCategory presumes a product type and nothing should |

## 5. Gaps

Decisions this platform still owes an ADR, once taken:

- **Ordering.** Cart, order state machine, delivery, payment — no collection, no resolver, no design. ADR-009 records only that item has no price *because* of this gap. Needs its own ADR when the design starts.
- **Where the fifteen repos get published**, and under which org. No ADR yet — it is explicitly the user's undecided call (see `docs/workflow.md`, *Repo layout*).
- **Production topology.** Still owed, but narrower than it was. The edge itself is now written down: `nginx/` at the workspace root carries a vhost per hostname — apex, `shopowner.`, `admin.` — terminating TLS for all three and proxying eleven loopback upstreams — the nine backend services, the SSR renderer and Nominatim — while serving both SPAs and the SSR app's static output off disk. `nginx/test/run.sh` exercises it in a container: `nginx -t` plus 150 behavioural assertions, including that both session cookies come back `Secure` from every endpoint that mints one. What no ADR records is where that instance *runs*: which host, whether anything sits in front of it, and how the service ports are closed to everything but it (`INTROSPECTION_CODE` is reachable wherever a service port is). ✅ The Phase 1, 3 and 5 documents that cited the retired `marketplace-user/docs/nginx/*.conf` by path and line have been repointed at the current tree; where a citation recorded a finding rather than a fact — the two audit reports and `CONFLICT_REPORT.md` — the finding is kept and annotated with what has since changed, rather than rewritten.
