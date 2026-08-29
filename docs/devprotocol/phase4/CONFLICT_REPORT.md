# Conflict Report — Phase 4
# Marketplace
**Status:** pass
**Version:** 1.1
**Date:** 2026-08-07
**Author:** conflict-checker-agent
**Changelog:** v1.1 — C-01 and C-02 both fixed at source; verdict raised from *fail* to *pass*.
v1.0 — initial Phase 4 conflict sweep

## 1. Verdict

Pass. Both recorded findings are **fixed at source** — see §3. The one that blocked (C-01, ERD.md and DDD_AGGREGATES.md disagreeing on whether the `admin` collection carries `personalData`) was independently re-verified against the migration before the fix was applied, not taken on the checker's word, and the checker was right. Zero remaining contradictions. Zero vocabulary violations. Zero scope leakage. Gate may close under RULES.md §4.

## 2. Documents checked

| Document | Lines | Checked how |
|---|---|---|
| phase4/ERD.md | 456 | full read of §3 entity tables + §7 indexes + §8, grepped rest |
| phase4/DDD_AGGREGATES.md | 404 | full read of §3 aggregate defs, grepped rest |
| phase4/API_CONTRACTS.md | 509 | full read of §3-9, grepped §1-2 |
| phase4/ERROR_HANDLING.md | 521 | grep sweep on 401/403, scope terms, citation code-fences; spot-read hits |
| phase4/CONSTRAINTS.md | 127 | full read (it is the phase's own shared-rules doc, DCON-01..09) |
| phase1/PDR.md, phase1/NFR.md | 195, 164 | grep sweep only (401/403, NFR-SE) |
| phase2/UBIQUITOUS_LANGUAGE.md | 632 | not read directly — banned-term list applied via grep on phase4 tree instead |
| phase2/BOUNDED_CONTEXT.md | 332 | grep for BC-01..11 titles, cross-checked against DDD_AGGREGATES citations |
| phase3/C4_CONTAINER.md | 320 | grep for ports only |
| phase3/SECURITY_AUTH.md | 392 | grep for 401/403/REDIS_KEY, spot-read hits |
| phase3/CONSTRAINTS.md | 102 | not read directly — referenced only via phase4/CONSTRAINTS.md's citations |
| phase3/adr/ADR-INDEX.md | 87 | grepped for ADR id list, diffed against ADR ids cited in phase4 |

Not fully read: phase1/PDR.md, phase1/NFR.md, phase2/UBIQUITOUS_LANGUAGE.md, phase2/BOUNDED_CONTEXT.md, phase3/C4_CONTAINER.md, phase3/SECURITY_AUTH.md, phase3/CONSTRAINTS.md, and all 28 ADR bodies — grep-only per task budget. A contradiction that requires reading full prose in one of these (not a name/number/term) could be missed.

## 3. Conflicts

| ID | Severity | Status | Documents | Contradiction | Resolution |
|---|---|---|---|---|---|
| C-01 | HIGH | **fixed** | ERD.md §3.1 vs DDD_AGGREGATES.md AdminAggregate | ERD.md says `admin` doc-level `required` is `login, personalData`, with `personalData.firstName`/`.lastName` both required strings — matches the actual migration (`BEs/marketplace-db-setup/migrations/20260301000000-create-admin.js`, verified). DDD_AGGREGATES.md says the opposite in two places: the Boundary line claims the migration's `$jsonSchema` "declares only `_id`, a `login` sub-object (2 required string properties), and `__v`... No `personalData`," and the Entities table lists `Admin` root entity as `login` sub-doc only. Checked the mongoose model too (`BEs/marketplace-common/src/models/MongoDB/Admin.mts:17-23`) — it also has `personalData.firstName`/`.lastName`. So DDD_AGGREGATES.md is wrong against BOTH the validator and the model, not a DCON-01 validator-vs-model split. Applied: DDD_AGGREGATES.md §AdminAggregate now states `required: ['login', 'personalData']` with `personalData.firstName`/`.lastName` both required `maxLength: 100` strings, carries `PersonalData` as a value object in the Entities table (described as the platform's narrowest — no `birth`, no `contacts`, no `address`), and adds the invariant that an admin document without a name is a rejected write. One further inaccuracy the checker did not report was corrected in the same edit: the section claimed the `admin` `$jsonSchema` is wholly inline with nothing shared, when it in fact reuses `LOGIN`, `DELETED`, `DISABLED`, `RESET_PWD` and `INDEXES_LOGIN_EMAIL` from `BEs/marketplace-db-setup/lib/schemas/account.js` — only the `personalData` block is literal, and there is no `lib/schemas/admin.js`. |
| C-02 | LOW | **fixed** | API_CONTRACTS.md §4-5 vs §6-9 (seam) | Table column conventions differ across the two agents' halves. §4.1/§4.2/§5.1 use `\| Op \| Type \| Args \| Answer \| Effect \| Source \|`. §6.1 onward switches to `\|Root\|Op\|Args\|Returns\|File\|` (no leading/trailing space, "Type" folded into "Root", "Answer"→"Returns", "Source"→"File", "Effect" column dropped). No factual disagreement found — same op documented once — but the document is not internally consistent as a single artifact. Applied: every §6-§8 table re-cut to the §4-§5 convention — `\| Op \| Args \| Answer \| Effect \| Source \|`, plus a leading `Type` column only where a table mixes queries and mutations. The rule is now written down in §3 of the document itself ("How to read the per-service tables in §4-§8"), including that `Source` is repo-relative to the service named in the sub-heading, so the seam cannot silently reopen. Filling the newly-added `Answer`/`Effect` columns meant reading the resolvers rather than reformatting prose: §6.2's 8 queries and 16 mutations gained their real declared `args` and return types (previously 11 of the 16 mutations carried `—` for args), and the doc's "all answer `Boolean!` unless noted" hedge was replaced with a verified statement — all 16 declare `new GraphQLNonNull(GraphQLBoolean)`, this tier's `companyAdd` included. |

None else found. Empty beyond the two rows above.

## 4. Vocabulary violations

None found. Grepped for non-English identifiers, `role` (word-boundary), `permission enum`, `price` and "shop collection" across all five phase4 documents. Every hit is one of: a DCON-09 rule statement ("no `role` field, ever") or an unrelated English word ("in that order", "delivery address" as a `defaultAddress` gloss, not the domain concept). No live schema/field/type named with a banned term.

## 5. Citation spot-check

29 paths sampled across ERD.md, DDD_AGGREGATES.md, API_CONTRACTS.md and ERROR_HANDLING.md (code-fence file references plus a few inline `` `path:line` `` citations) — 22 backend/common source files, 1 koa-utils file (outside the workspace root, at the location CLAUDE.md documents), 6 ERROR_HANDLING code-fence sources. **29/29 resolved with `test -e`.** No missing-path citations found in the sample. Specifically checked and confirmed correct: every `marketplace-dev-public-resource` citation in API_CONTRACTS.md spells the root `src/graphQLPublic/`, never `src/graphQLApi/` — the trap the task called out by name did not fire. This is a sample, not exhaustive — API_CONTRACTS.md alone carries ~60 file citations; the other ~30 were not individually verified.

## 6. Scope leakage

None found. Grepped `price`, `cart`, `order`, `delivery`, `payment` across all five documents and inspected every hit outside an obvious negative frame. All surviving hits are: named GAPs in ERD.md §8, DDD_AGGREGATES.md §9 and API_CONTRACTS.md §9 (explicitly "no collection, no resolver, no ADR"), phase4/CONSTRAINTS.md §6's out-of-scope list, `defaultAddress`'s gloss "pointer to the chosen delivery address" (a `user` field name, not a delivery-domain design), and "in that order" (English idiom, not the `Order` entity). No schema, field, resolver, or mutation was found designed for any of the four.

## 7. Cross-document completeness

Both directions checked.

ERD → DDD_AGGREGATES: ERD.md declares 6 collections (`admin`, `shopOwner`, `company`, `user`, `item`, `itemCategory`, §3.1-3.6). DDD_AGGREGATES.md declares exactly 6 aggregate roots with matching names (§3). 1:1, no orphan either side.

API_CONTRACTS mutations → ERD collections: every mutation name in API_CONTRACTS.md (`adminUpdatePwd`, `companyAdd/Update/Del`, `itemAdd/Update/Del/UpdatePublished`, `itemCategoryAdd/Update/Del`, `shopOwnerAdd/Update/UpdateEmail/UpdateNote/UpdatePreferences/UpdateStatus/Del`, `userAddressAdd/Update/Del`, `userDefaultAddressSet`, `userPersonalDataUpdate`, `userUpdatePwd`, `userVerifyEmailResend`, `userRegister`) maps to one of the 6 ERD collections by name prefix. No orphan mutation touching an undeclared collection.

## 8. Gate recommendation

Gate MAY close. Both findings were applied before closing, so Phase 4 closes with no outstanding findings under RULES.md §4.

C-01 was the blocking one and is the one worth remembering: it was not a style disagreement but two design documents disagreeing on whether a field exists, and the wrong one (DDD_AGGREGATES.md) was wrong against **both** the `$jsonSchema` validator and the mongoose model, which rules out the DCON-01 validator-vs-model split as an excuse. The correction went to DDD_AGGREGATES.md, never to ERD.md — ERD.md matched `BEs/marketplace-db-setup/migrations/20260301000000-create-admin.js` and had nothing to fix.

C-02 was non-blocking and is now closed at the level of the rule rather than the instance: the table convention it flagged is documented inside API_CONTRACTS.md, so a future appending agent has something to conform to instead of a majority style to infer.

The §2 caveat still stands and is not cleared by this revision: phase1/PDR.md, phase1/NFR.md, phase2/UBIQUITOUS_LANGUAGE.md, phase2/BOUNDED_CONTEXT.md, phase3/C4_CONTAINER.md, phase3/SECURITY_AUTH.md, phase3/CONSTRAINTS.md and all 28 ADR bodies were swept by grep, not read. A contradiction living in full prose in one of those, expressible in neither a name nor a number nor a term, would not have been caught by this pass.
