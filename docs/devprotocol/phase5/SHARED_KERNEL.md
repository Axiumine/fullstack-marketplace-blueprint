# E10 — Shared Kernel (marketplace-common)
# Marketplace

**Status:** baselined - brownfield retrofit
**Version:** 1.12
**Date:** 2026-08-30
**Author:** epics-agent
**Bounded context:** BC-10 — Shared Kernel (marketplace-common)
**Changelog:** v1.12 - 2026-08-30: §0 loses its range entirely — the `E19` and `E20` epic records were the last two, both
deleted and **distributed, not moved**, and the running *Epics + Stories* index went with them. Both §6s were
closed first: E20's question 6 by [`ADR-051`](../phase3/adr/ADR-051-a-session-exit-is-a-page-load.md) and its
question 7 by [`ADR-052`](../phase3/adr/ADR-052-a-session-entrance-is-a-page-load-too.md), and the one half
still undecided — whether an admin may be suspended — moved to
[`ADR-044`](../phase3/adr/ADR-044-suspension-names-an-actor-and-a-reason.md) §Still undecided rather than
dying with the file. No twelfth record was written, so the count stays eleven, and every `E19-Snn` and
`E20-Snn` id survives in ADR-041..ADR-046 and ADR-049. Nothing about this record's own content or build state
changed.
v1.11 - 2026-08-28, later the same day: §0's range narrows from "E16..E19" to **E19** —
the `E17` and `E18` epic records were **both** deleted and **distributed, not
moved**, the E11/E13/E14/E15/E16 way. E17's nine stories and E18's thirteen are `built`; E17's five open
questions and E18's three are all closed. What the audit found held nowhere else went to `docs/testing.md`,
and `PLATFORM_OPERATIONS_QUALITY_GATES.md` §6.
The count in §0 stays eleven — no new record joined it, and every story id survives. Nothing about this
record's own content or build state changed.
v1.10 - 2026-08-28, later the same day: §0's range narrows from "E15..E19" to **E16..E19** —
the `E15` epic record was deleted and **distributed rather than moved**, the E11 / E13 / E14 way
and not E12's: all ten of its stories are `built`, so no twelfth record was written.
⚠️ Unlike E14's, **E15's §6 was not empty**: one Product question — whether a confirm-first email-change
flow should exist — moved to `IDENTITY_ACCESS.md` §6 as an **open** question 5 rather than dying with the
file. The other nine facts went to `ADR-INDEX.md` §4 (three refused
designs), `SESSION_TERMINATION.md` §3.1, `IDENTITY_ACCESS.md` §3.1, `SHOPOWNER_ONBOARDING_APPROVAL.md`
E03-S02, `PLATFORM_OPERATIONS_QUALITY_GATES.md` §3.1, `SECURITY_AUTH.md` §3 and `docs/data-model.md`. E15
keeps its id and all ten story ids. Nothing about this record's own content or build state changed.
v1.9 - 2026-08-28, later still: §0's range narrows from **E14..E19** to **E15..E19**
— the `E14` epic record was deleted and its content distributed rather than moved, the E11/E13 way and not
E12's: no twelfth record was written, so the count of eleven records is unchanged. The
nine facts it held that were not already recorded elsewhere went to `ADR-INDEX.md` §4, `docs/architecture.md`, `RISK_REGISTER.md` R52,
`TELEMETRY_EGRESS_HARDENING.md`, the `E17` epic record §5 and `token-handling-security-audit.md` §3.4. E14 keeps
its epic id and all nine story ids, `E14-S01`..`E14-S09`.
v1.8 - 2026-08-28, later the same day: §0's range narrows from **E13..E19** to **E14..E19**
— the `E13` epic record was deleted and its content distributed rather than moved, the E11 way and not
E12's: no twelfth record was written, so the count of eleven records is unchanged. The
seven facts it held that were not already recorded elsewhere went to
`SECURITY_AUTH.md` §3.6 and `dependency-tree-advisory-scan.md` §6.1. E13 keeps its epic id and all eleven
story ids, `E13-S01`..`E13-S11`.
v1.8 - 2026-08-30: **E10-S03 is rewritten around the decision that replaced its subject.**
[`ADR-047`](../phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md) deletes
`deploy-local.sh`, so the story's obligation moves from *sync the build* to *publish the release*: same id,
same domain, same place in the landing order, and an acceptance criterion that can now be checked by
`npm view` rather than by a directory listing. §2's ownership table and §3's build state lose the bridge
row with it, and §5's landing order says "publish a release" where it said "run the script". The 1.6 and
1.7 entries below are left as written — they were true on their dates.
v1.7 - 2026-08-28: E10-S03's Evidence line carries `marketplace-common` `2.0.1`, the JSDoc-only
patch released that day. The criterion and the consumers' `^2.0.0` are untouched — the point of the range is
that a patch needs neither.
v1.4 - 2026-08-27: the `E11` epic record is deleted, its content distributed rather than
v1.6 - 2026-08-27, later still: E10-S03's acceptance criterion and Evidence line carry `marketplace-common`
`2.0.0` / `^2.0.0` after that release. The story's obligation is unaffected — `deploy-local.sh` bridges the gap
between releases whatever the released version is. **(That bridge is gone since 2026-08-30 — see v1.8.)**
replaced. §5 absorbs what its own §5 held — the 7th model and the `TIER`-scoped service pair BC-11 would
have needed, and the tier-vs-concern question that went with them, closed as moot by ADR-038. Every
citation of the `E11` epic record in this file is repointed to
[`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md), which now carries what the
deleted file carried; the E11..E19 ranges in §0 are corrected to
E12..E19, since E11 no longer has a record of its own. Nothing about BC-10's own build state changed.
v1.5 - 2026-08-27, later still: §0's range narrows from "E12..E19" to **E13..E19** — the `E12` epic record was deleted and moved into [`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md), the eleventh to move and the first from the E12-E18 remediation block. Moved intact, the E01..E10 way, not distributed like E11: all twenty-six of its stories are `built`. The count in §0 is corrected with it — eleven records are now documents of their own, not ten. E12 keeps every story id. Nothing about this record's own content or build state changed.
v1.3 - 2026-08-27: The "not in the kernel" row said no BC-11 shape exists to import. ADR-038 (2026-08-27) makes cart, order, delivery and payment permanently out of scope, so no shape will ever exist to import either.
v1.2 - 2026-08-27: the record moved out of the epic file `E10` to this path in the same pass that
closed its last open question — §0 says why. Question 2's answer was upgraded from inference to proof at the
same time: the Cloud project is named on disk, so the four repos `phase1/NFR.md` open question 4 called
project-less are provisioned too, and that question, `PDR.md` §8 item 8, `SYSTEM_CONTEXT.md` §7 question 4,
`RISK_REGISTER.md` R38 and `README.md` were all corrected in the same commit rather than flagged. The epic ID
`E10` and the story IDs `E10-S01`..`E10-S07` are unchanged.
v1.1 - 2026-08-27: both §6 open questions closed, §6 now reads "None open".
Question 1 — the platform owner stated no further backend service is planned, so the "does a 4th tier share
the authz body or copy it first" fork has no premise; recorded with its re-open trigger rather than deleted,
since the answer is "moot", not "shared". Question 2 — `marketplace-common`'s Qodana Cloud project is
provisioned: a repo-unique `QODANA_TOKEN`, a `qodana.sh` that fails closed without it, and no repo-level
`SKIP_QODANA`; the same check found `phase1/NFR.md` open question 4's 4-repo gap list stale, flagged there
rather than edited here. No story, criterion, scope row or status changed.
v1.0 - initial retrofit; reverse-engineered from the 15-repo working tree.

## 0. Why this record is not an epic file

It was the epic file `E10` until 2026-08-27. The file was deleted and its record moved here in one pass,
for the reason the nine before it moved: nothing in it is a story still ahead. All seven are `built`, both
open questions closed the same day, and what is left is the *record* of a shipped surface rather than a
backlog entry. Stories for E14..E19 lived in their own epic files at the time — E01's and E02's records moved into documents of their own on 2026-08-13
([`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md), [`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md)), E03's,
E04's and E05's on 2026-08-14 ([`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md),
[`COMPANY_LEGAL_ENTITY.md`](./COMPANY_LEGAL_ENTITY.md), [`CATALOGUE.md`](./CATALOGUE.md)), E06's on
2026-08-25 ([`CATEGORY_TAXONOMY.md`](./CATEGORY_TAXONOMY.md)), E07's, E08's and E09's on 2026-08-26
([`CUSTOMER_ACCOUNT_ADDRESSES.md`](./CUSTOMER_ACCOUNT_ADDRESSES.md),
[`PUBLIC_DISCOVERY_STOREFRONT.md`](./PUBLIC_DISCOVERY_STOREFRONT.md),
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md)), and this one on
2026-08-27. E14..E19 were their own epic files then, the unbuilt half. **E11 is not among them**: unlike the
ten records above, the epic file `E11` was deleted outright on 2026-08-27 rather than moved, and gets no
replacement file — it named a gap that closed as a permanent refusal rather than as a shipped surface, so there was nothing left to keep as a document of its own. Its record is distributed into
[`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note, and this file's own §5 below absorbs the one paragraph of it that named a BC-10 dependency.

**The IDs did not change.** `E10` and `E10-S01`..`E10-S07` are still the names:
[`ADR-038`](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note, which now carries what
the `E11` epic record §5 used to cite them from, and
`CONFLICT_REPORT.md`'s traceability tables all cite them, and every one resolves to a section of this file.
Renumbering was not considered — moving a file is not a reason to change a name.

**Why this file is not `PLATFORM_OPERATIONS_QUALITY_GATES.md`.** BC-09 and BC-10 both look like
"cross-cutting platform plumbing" and are not the same context: BC-09 owns the *gates* — hooks, thresholds,
scans, the `marketplace-services-status` surface — while BC-10 owns the *code every service compiles
against*. E10's gate criteria (100/100 on this package) are BC-09's rules applied to BC-10's artefact, not
BC-09 scope leaking in. Merging the two records would lose which of them a future change belongs to.

⚠️ **Narrowed again 2026-08-27, later the same day.** The range above reads **E13..E19** because
the `E12` epic record was deleted and moved beside this one to
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) — the **eleventh** record to make that move, and
the first from the E12-E18 remediation block, so the pattern is no longer about the ten bounded-context
epics alone. E12 lost its file, not its id: `E12-S01` … `E12-S26` are cited from 87 source files across
all fifteen sub-repos and resolve to sections of that record.

⚠️ **Narrowed again 2026-08-28.** The range above reads **E14..E19** because the `E13` epic record was
deleted this same day and **distributed rather than moved** — the **E11** way, not E12's: all
eleven of E13's stories were `built`, its §6 read "None open.", and an audit of the file found only seven
facts held nowhere else. No twelfth record was written, so the count stays
**eleven** — E01..E10 and E12, unchanged by this pass. The seven facts went to: the landing order, its
two `BGREWRITEAOF` passes, and the "step four is the clock, not step one" rule; to
[`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md)
§3.6 (the six `INTROSPECTION_CODE` comparison sites named with file and line); and to
[`dependency-tree-advisory-scan.md`](../../report/dependency-tree-advisory-scan.md) §6.1 (the seventh
comparison site, upstream in `@axiumine/koa-utils`). E13 lost its file, not its id: `E13-S01`..`E13-S11`
are unchanged and every build state with them.

⚠️ **Narrowed again 2026-08-28, later still.** The range above reads **E15..E19** because
the `E14` epic record was deleted this same day and **distributed rather than moved** — the
**E11/E13** way, not E12's: all nine of E14's stories were `built`, its §6 read "None open.", and an
audit of the file found only nine facts held nowhere else. No twelfth record was written, so the count stays **eleven** — E01..E10 and E12, unchanged by this pass. The nine facts went to:
the seven-step landing order and "land **E13-S01 and E13-S02** first"; to
[`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (two rejected
alternatives — the tier-keyed privilege gradient for the session cap, and the cached-successor-pair grace
design), to [`docs/architecture.md`](../../architecture.md) (the abandoned `// if remember me, generate ?`
cookie-side comment in koa-utils' `setLoginCookies`, which E14-S07 does not revive), to
[`RISK_REGISTER.md`](./RISK_REGISTER.md) R52 ("two windows, not one"), to
[`TELEMETRY_EGRESS_HARDENING.md`](./TELEMETRY_EGRESS_HARDENING.md) (the Cloudflare rate-limiting-rules
alternative to `limit_req_zone`), and to the `E17` epic record §5 (why E17 depends on E14 for
`familyId` and can never key a session by a token value). The ninth, the cross-service-harness residual,
went to [`token-handling-security-audit.md`](../../report/token-handling-security-audit.md) §3.4. The two
defects E14-S09 found stay live in
[`multi-tab-refresh-behaviour.md`](../../report/multi-tab-refresh-behaviour.md) §4, §5 and §9, which is
not deleted. E14 lost its file, not its id: `E14-S01`..`E14-S09` are cited from source files across the
workspace and now resolve to the destinations above.

⚠️ **Narrowed again 2026-08-28, later the same day.** The range above now reads **E16..E19** because
the `E15` epic record was deleted and **distributed, not moved** — the E11 / E13 / E14 way and
not E12's: all ten of its stories are `built`, and no twelfth record was written, so the count above
stays **eleven** (E01..E10 and E12). ⚠️ **One thing differs from the last three deletions: E15's §6 was not
empty.** One row survived — a **Product** question, whether a confirm-first email-change flow should exist
at all — and it was relocated to [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md) §6 as its question 5, open,
rather than deleted with the file. E15's other nine facts went to: the seven-step landing order, and why the
E13-S01 dependency is hard; [`ADR-INDEX.md`](../phase3/adr/ADR-INDEX.md) §4 (three refused designs — the
lazy prune, "revoke all but me", and `familyId`/the cap in the index value),
[`SESSION_TERMINATION.md`](./SESSION_TERMINATION.md) §3.1, [`IDENTITY_ACCESS.md`](./IDENTITY_ACCESS.md)
§3.1, [`SHOPOWNER_ONBOARDING_APPROVAL.md`](./SHOPOWNER_ONBOARDING_APPROVAL.md) E03-S02,
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) §3.1,
[`SECURITY_AUTH.md`](../phase3/SECURITY_AUTH.md) §3 and [`data-model.md`](../../data-model.md). E15 lost
its file, not its id: `E15-S01` … `E15-S10` keep their names and their `built` state.

⚠️ **Narrowed again 2026-08-28, later the same day.** The range above now reads **E19** — one file, no
longer a range — because the `E17` and `E18` epic records were **both** deleted and
**distributed, not moved**, the E11 / E13 / E14 / E15 / E16 way. Both qualified on the same test,
*what a record still has to do*: E17's nine stories and E18's thirteen are all `built`, and both §6s are
fully closed — E18's three on 2026-08-13, E17's fifth and last earlier the same day as this deletion, in the
record before the code. An audit of the two files, 1 255 lines together, found almost everything already
verbatim in the source docblocks the epics themselves caused to be written and in the reports they produced.
What survived — the
story ids written one by one, E17's five-step landing order, its two permanent scope refusals, and the reason
it keys a session by `familyId` and can never key one by a token value — went to
[`docs/testing.md`](../../testing.md) (E18-S09's generalised lesson — a file-and-line citation proves the
line exists, not that the path reaches it — and the `REQUIRED_ENV_VARS` trap E18-S13 walked into), and to
[`PLATFORM_OPERATIONS_QUALITY_GATES.md`](./PLATFORM_OPERATIONS_QUALITY_GATES.md) §6, which gains the one live open question either file still carried: nobody owns a newly-red advisory
under a pinned `trivy` image whose advisory database is not pinned, and nobody owns the first `.trivyignore`
line. **No twelfth record was written — that count stays eleven** (E01..E10 and E12).
E17 and E18 kept their epic ids and every story id, `E17-S01` … `E17-S09` and `E18-S01` … `E18-S13`; only the
two files are gone.

⚠️ **Narrowed a last time 2026-08-30, and there is no range left.** The `E19` and `E20` epic records were
the last two, and both were deleted and **distributed, not moved** — the E11 / E13 / E14 / E15 / E16 / E17 /
E18 way — with the running *Epics + Stories* index deleted beside them, an index over nothing having nothing
to index. Both qualified on the usual test, *what a record still has to do*: E19's five stories and E20's
thirteen are `built`, the sixth and the fourteenth are anti-stories that are deliberately not built, and both
§6s were closed before the pass — E20's question 6 by
[`ADR-051`](../phase3/adr/ADR-051-a-session-exit-is-a-page-load.md) and its question 7 by
[`ADR-052`](../phase3/adr/ADR-052-a-session-entrance-is-a-page-load-too.md), both on 2026-08-30. ⚠️ **One
thing was still undecided and moved rather than died**: whether an admin may be **suspended**, the half of
E20's question 2 that the *an admin account cannot be closed* ruling did not touch, is now
[`ADR-044`](../phase3/adr/ADR-044-suspension-names-an-actor-and-a-reason.md) §Still undecided. **No twelfth
record was written, so the count stays eleven** (E01..E10 and E12). Both epics kept every id: `E19-S01` …
`E19-S06` and `E20-S01` … `E20-S14` resolve to ADR-041..ADR-046 and ADR-049, each of which records what the
stories under it built, and to the sources those stories touched.

## 1. Epic goal

Keep the code every backend service compiles against directly — Mongoose models, tier assertion,
session resolution, the disabled/deleted guard — correct, deployed, and gated at 100/100. This epic
ships no resolver and no schema of its own (`phase2/BOUNDED_CONTEXT.md:181` "Does not own: any
resolver, any GraphQL schema slice, any route"); it ships the substrate 8 of the 9 services (7 of 9
minus `marketplace-dev-authenticated-logout`, which touches Redis only) import at compile time.

## 2. Scope

| In scope | Out of scope | Why |
|---|---|---|
| `Tier`, `assertTier`, `checkUserAuthorizationDisDel` | A `role` field/enum | Banned term, `phase2/UBIQUITOUS_LANGUAGE.md:79` — role = which collection you authenticate against |
| `resolveAuthorizationSession`, `findAccountForSession`, `refreshSessionTokens` (shared authz body) | Merging the 3 `*-authenticated-authorization` deployables into 1 process | Decided against 2026-08-07, [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md); NFR-AV01 |
| The 6 Mongoose models (`Admin`, `ShopOwner`, `Company`, `User`, `Item`, `ItemCategory`) | A shop/collection model | Never existed, never will — a shop IS a `company` |
| `package.json` `exports` map (216 entries, no barrel) | Who runs the publish, and on what cadence | ⚠️ **Corrected 2026-08-26 by [`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md)** — this row read *"Publishing to a real npm registry / 404s by design"* until then. The package is on `registry.npmjs.org` at `1.0.1`, published by the platform owner personally. ⚠️ **Corrected again 2026-08-30 by [`ADR-047`](../phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md)**: `deploy-local.sh` is deleted, so there is no between-releases bridge and BC-10 owns the `exports` map only — a change reaches a consumer as a published version or not at all |
| The published release (`yarn upload`) the nine consumers install | Any resolver, any GraphQL schema, any route | BC-10 owns compile-time surface only — a published version is the whole delivery mechanism (ADR-047) |
| `assertTurnstile` (fail-closed anti-bot gate) | Cart/Order/Delivery/Payment models | BC-11 `WILL NOT BUILD` — no shape exists to import and none ever will ([ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md) §Note 2026-08-27) |

## 3. Build state

**Built.** This context has shipped since before the customer tier existed and grew a
Koa/GraphQL-shaped surface on 2026-08-07.

- Tier constant: `BEs/marketplace-common/src/others/Tier.mts` — `TIER = { admin, shopOwner, user }`.
- Tier assertion: `BEs/marketplace-common/src/others/assertTier.mts:21-23` — `if (actual !== expected)
  throw throwForbiddenError()`.
- Disabled/deleted guard: `BEs/marketplace-common/src/others/checkUserAuthorizationDisDel.mts`.
- Shared authz body (since `@4.4.0`): `BEs/marketplace-common/src/others/resolveAuthorizationSession.mts`,
  `findAccountForSession.mts`, `refreshSessionTokens.mts`.
- Fail-closed anti-bot: `BEs/marketplace-common/src/others/assertTurnstile.mts:26,29-32`.
- Models: `BEs/marketplace-common/src/models/MongoDB/{Admin,ShopOwner,Company,User,Item,ItemCategory}.mts`.
- Exports map: `BEs/marketplace-common/package.json` — 216 `"key":` entries (`grep -c '":'`), no barrel.
- Release: `BEs/marketplace-common/package.json` `scripts.upload` — `npm publish --registry=https://registry.npmjs.org/`,
  the only channel into a consumer since ADR-047. There is no local deploy script and there must not be one.
- Gates: `BEs/marketplace-common/vitest.config.mts`, `stryker.config.mjs`, `test/` (unit + `test:contract`
  + `test:int` + `test:types`), `test:contract` script at `package.json:24`.
- Consolidation record: [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md).

## 4. Stories

### E10-S01 — Tier constant and assertion stay the single trust boundary   `built`
Technical story. Every resource/authorization service (except logout) must call `assertTier(actual,
expected)` before trusting `ctx.state.user`, and a missing `tier` on a session must reject, never
wildcard.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/marketplace-common/src/others/assertTier.mts` throws `throwForbiddenError()` (HTTP 403, not 401)
  on `actual !== expected`, including `actual === undefined`.
- `BEs/marketplace-common` sits at 100% coverage on all 4 metrics and a 100 Stryker mutation score
  (`vitest.config.mts` thresholds, `stryker.config.mjs` `thresholds.break: 100`) — NFR-MA01, NFR-MA02.
**Traces:** NFR-SE01, NFR-SE05, NFR-SE06, ADR referenced at [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md).
**Evidence:** `BEs/marketplace-common/src/others/assertTier.mts:21-23`, `BEs/marketplace-common/src/others/Tier.mts:12-18`.

### E10-S02 — Shared authorization body serves 3 tiers, deployables stay 3   `built`
Technical story. `resolveAuthorizationSession`, `findAccountForSession`, `refreshSessionTokens` are
the one body every `*-authenticated-authorization` service (except public) calls into; each service
still supplies only its own `TIER.*`, model and projection, and each remains its own `process.exit(1)`
crash domain.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/dev/marketplace-dev-authenticated-authorization/src/graphQLApi/schema/mutations/refresh.mts`
  calls `refreshSessionTokens` from `@axiumine/marketplace-common`, not a local copy.
- 3 `*-authenticated-authorization` services remain 3 separate deployables — no shared `process.exit`
  domain — per NFR-AV01, not re-opened as a refactor (`docs/decisions/authorization-service-consolidation.md`).
**Traces:** NFR-AV01, NFR-AV02, ADR-006 (per `phase4/API_CONTRACTS.md:341`).
**Evidence:** [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md), `BEs/marketplace-common/src/others/resolveAuthorizationSession.mts`.

### E10-S03 — a published release is the only way an edit reaches a consumer   `built`
Technical story. `marketplace-common` is consumed by package name (`@axiumine/marketplace-common`) from
`registry.npmjs.org`, so an edit under `src/` reaches the nine services when it is **published** — bump,
changelog, merge, tag, gated push, `yarn upload`, then move each consumer's range — and at no other moment.
⚠️ **This story's subject has been replaced twice, and the id is deliberately kept.** It was written on
2026-08-07 as *"`deploy-local.sh` is the only publish channel"*, when nothing was on any registry and the
second criterion proved the script mandatory by proving the package 404s.
[`ADR-037`](../phase3/adr/ADR-037-marketplace-common-is-published-to-npm.md) (2026-08-26) put the package on
the registry and kept the script as a between-releases bridge; four days later
[`ADR-047`](../phase3/adr/ADR-047-a-common-change-ships-as-a-published-release.md) **deleted the script** on
the platform owner's ruling. What that reverses is a mechanism, not this story's obligation: the kernel's
edits must reach its consumers by a route both can name. The route is now a version number.
**domains:** backend, infra
**Acceptance criteria:**
- `BEs/marketplace-common/deploy-local.sh` **does not exist**, and nothing — script, hook, `dev.sh` step,
  `yarn link`, `file:` path — writes a locally built copy of this package into a consumer's `node_modules`
  (ADR-047 §Compliance).
- An edit under `BEs/marketplace-common/src/` is invisible to all 9 services until a release carrying it is
  published *and* that consumer's range and `yarn.lock` reach it. `npm view @axiumine/marketplace-common
  version` is the check, and it answers for every machine rather than for this one (NFR-PO04, ADR-047).
**Traces:** NFR-PO04, BCON-07 (`phase5/CONSTRAINTS.md` §3), ADR-037 (supersedes ADR-015 in part), ADR-047
(supersedes ADR-015 and ADR-037, each in part).
**Evidence:** `BEs/marketplace-common/package.json` `version` `3.0.0` + `publishConfig.registry` +
`scripts.upload`; `^3.0.0` in the twelve consumers' `package.json`; `BEs/marketplace-common/CLAUDE.md`
§The release flow.

### E10-S04 — Every file reachable only via the `exports` map   `built`
Technical story. No barrel export exists; an unlisted file is unreachable by any consumer. Adding a
file to `marketplace-common` requires a matching `exports` entry.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/marketplace-common/package.json` `exports` block carries 216 keys (`grep -c '":' package.json`
  inside the `exports` object), one per reachable subpath.
- `yarn test:contract` (`vitest.contract.config.mts`) fails when a source file has no corresponding
  `exports` entry.
**Traces:** NFR-PO04.
**Evidence:** `BEs/marketplace-common/package.json:44` (`"exports"` key), `test:contract` script at `package.json:24`.

### E10-S05 — Koa/GraphQL-shaped surface still needs both mocks inlined in mutation testing   `built`
Technical story. `vitest.mutation.config.mts` in every consumer of the shared authz body must inline
both `@axiumine/marketplace-common` and `@axiumine/koa-utils`, or a `vi.mock` of a koa-utils
subpath silently stops intercepting mid-mutation-run.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/dev/marketplace-dev-authenticated-authorization/vitest.mutation.config.mts` lists both packages
  under its inline/deps config.
- `yarn test:mutation` in that service reaches a 100 Stryker score with no survivor traceable to a
  koa-utils mock miss (NFR-MA02).
**Traces:** NFR-MA02, NFR-MA05.
**Evidence:** `BEs/dev/marketplace-dev-authenticated-authorization/vitest.mutation.config.mts`.

### E10-S06 — Anti-bot gate fails closed, only in production   `built`
Technical story. `assertTurnstile` must throw when no Turnstile secret is configured and
`NODE_ENV === 'production'`; outside production a missing secret is a no-op, never a silent bypass in
prod.
**domains:** backend, testing
**Acceptance criteria:**
- `BEs/marketplace-common/src/others/assertTurnstile.mts:26,29-32` throws `throwForbiddenError()` when
  `!secret && process.env.NODE_ENV === 'production'`.
- A unit test in `BEs/marketplace-common/test/` exercises both the production-missing-secret branch and
  the non-production branch.
**Traces:** NFR-AV03.
**Evidence:** `BEs/marketplace-common/src/others/assertTurnstile.mts:26,29-32`.

### E10-S07 — 6 Mongoose models are the only schema source 7 consumers import   `built`
Technical story. `Admin`, `ShopOwner`, `Company`, `User`, `Item`, `ItemCategory` models live once, in
`marketplace-common`, imported directly (compile-time, not network) by every service that touches Mongo.
**domains:** backend, database
**Acceptance criteria:**
- `BEs/marketplace-common/src/models/MongoDB/` contains exactly `Admin.mts`, `Company.mts`,
  `Item.mts`, `ItemCategory.mts`, `ShopOwner.mts`, `User.mts` plus a `sub/` directory — no 7th model,
  no shop/collection model.
- Every resource service under `BEs/dev/*-resource` imports its models from
  `@axiumine/marketplace-common/models/...`, never redeclares a schema locally.
**Traces:** NFR-SE11 (validator lives in `marketplace-db-setup`, model shape here must match it).
**Evidence:** `BEs/marketplace-common/src/models/MongoDB/` listing (`Admin.mts`, `Company.mts`, `ItemCategory.mts`, `Item.mts`, `ShopOwner.mts`, `User.mts`, `sub/`).

## 5. Dependencies

- **Upstream of everything.** BC-01, BC-02, BC-03, BC-04, BC-05, BC-06, BC-07, BC-08 all import this
  context at compile time (`phase2/BOUNDED_CONTEXT.md` §4 relationship table). No epic in this phase can
  land ahead of E10's build state — it already exists, so this is a standing constraint, not a landing
  order: any story elsewhere that edits a model or an `others/` helper is really an E10 change, followed
  by a **published release** of `marketplace-common`, followed by a separate per-consumer commit that moves
  the range (BCON-05, BCON-07, ADR-047).
- **Downstream of nothing** inside this platform — BC-10 consumes no other context
  (`phase2/BOUNDED_CONTEXT.md:181` "Consumes: nothing from the other contexts").
- **E11 (Ordering & Fulfilment) never designed, so it never added anything here, and now never will.** Had
  BC-11 been built, it would have needed a 7th Mongoose model in this kernel alongside the six in §3
  above, and a new `TIER`-scoped service pair to go with it — `phase2/UBIQUITOUS_LANGUAGE.md` "Service
  pair": "A fifth tier means a fifth service pair, not a role check bolted onto the existing ones." Which
  of the two it would have been — a genuinely new tier with its own service pair, or a new *concern*
  folded into one of the three tiers that already exist — was never settled, because it was never asked
  as a design question: it was the `E11` epic record §6 question 4, and it closed as **moot**, not
  answered, the same day as the other four — [ADR-038](../phase3/adr/ADR-038-commerce-is-permanently-out-of-scope.md).
  E10 ships nothing for it, permanently, not provisionally: see ADR-038 §Note,
  where the `E11` epic record now lives.

## 6. Open questions

**None open.** Both questions this retrofit raised were closed on 2026-08-27; they stay listed with their
answers rather than deleted, because one carries a re-open trigger and the other bounds how far it was
verified.

- Should the shared authz body (`resolveAuthorizationSession`/`findAccountForSession`/
  `refreshSessionTokens`) grow a 4th caller if a 4th tier is ever added, or does a 4th tier get its own
  body copy first and consolidate later the way the first 3 did? **Closed 2026-08-27 — moot, no 4th
  tier is coming.** The platform owner stated no further backend service is planned, so the premise the
  question rests on does not occur. This does not overturn anything: it aligns E10 with the constraint
  the rest of the corpus already carries — `phase4/CONSTRAINTS.md` §"No new tier" (`admin`/`shopOwner`/`user`
  stays 3, and no `role` field as a shortcut around a 4th), `phase4/ERD.md` §"A fourth tier". The shared
  body therefore stays a 3-caller body, [`docs/decisions/authorization-service-consolidation.md`](../../decisions/authorization-service-consolidation.md)
  stays scoped to the 3-tier case it actually argues, and no generalisation of it is owed. ⚠️ **Re-open
  trigger, not a re-litigation:** if a 4th tier is ever added despite this, the copy-first-consolidate-later
  order the first 3 followed is the untested question again — the shared body was extracted *after* three
  callers had proven identical, and nothing here claims it generalises to a caller nobody has written.
  What stays closed either way is option (a), one dispatching service: rejected on doctrine (ADR-002,
  "not a role check bolted onto the existing ones") and on NFR-AV01 crash-domain isolation.
- `marketplace-common` has no Qodana Cloud project gap noted anywhere for itself (unlike
  `marketplace-services-status`/`marketplace-user`/the 2 user-tier services, `phase1/NFR.md` open question 4) — is
  that confirmed provisioned, or simply unchecked? **Closed 2026-08-27 — provisioned, and the silence was
  accurate.** The Cloud project is **`MP common`, id `b892b`** — named on disk by this repo's own last scan,
  in `.qodana/results/open-in-ide.json`, alongside the origin URL `Axiumine/marketplace-common`. Around it:
  `qodana.yaml`, a `qodana.sh` that fails closed on a missing `QODANA_TOKEN` (`"QODANA_TOKEN missing or
  empty"`, `exit 1`) rather than degrading to an unauthenticated scan, and a token distinct from all 14
  others — every repo shipping a `qodana.sh` holds a different value, compared by hash without any value
  being read out. Neither hook carries a repo-level skip: `SKIP_QODANA` appears in `.githooks/pre-commit` and
  `.githooks/pre-push` only as the documented one-shot bypass an admin types, never as a default this repo
  sets. E10 was absent from the NFR-MA03/MA04 gap list because it does not belong in it. ⚠️ **The same
  artefact closed a gap this epic did not own.** All 15 repos that ship a `qodana.sh` name a distinct project
  — including the four `phase1/NFR.md` open question 4 called project-less: `MP Service Status` (`xPKXD`),
  `MP User` (`dXO5E`), `MP User Authenticated Authorization` (`B5NEV`) and `MP User Authenticated Resources`
  (`eobk1`). So the `SKIP_QODANA=1` workaround those documents describe is provisioned away, and `NFR.md`
  question 4, `PDR.md` §8 item 8, `SYSTEM_CONTEXT.md` §7 question 4, `RISK_REGISTER.md` R38 and `README.md`
  §Linter version were corrected in the same commit as this closure rather than left disagreeing with it.
  ⚠️ **What the artefact does not prove** is that a project is still reachable *now* — it records where the
  last scan landed, not the state of the account today. A scan is what would prove that, and running one
  spends the token.
