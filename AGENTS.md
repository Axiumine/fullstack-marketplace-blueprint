<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **`fullstack-marketplace-blueprint`** — this parent directory only. Its `.gitignore` hides `/BEs/` and the three frontend directories, so the index holds the workspace docs and no application code. The platform's code lives in **fourteen** separate sub-repo indexes tied together by the group `marketplace-platform`; see **`docs/gitnexus.md`** for the registry-name table, the `repo:` parameter rules and the contract-extraction gap. Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> ⚠️ **The parent registry name follows the folder, not the product.** It is `fullstack-marketplace-blueprint`, *not* `marketplace` — GitNexus names an index after the directory, and this directory was renamed. Nothing named `marketplace` exists in the registry.

> ⚠️ **The registry also holds indexes from other workspaces on this machine.** `list_repos` returns entries rooted outside this tree; some are near-identical in shape to the fourteen here and will answer a query without complaint while describing another codebase entirely. Always pass a `marketplace*` registry name.

> `gitnexus group status marketplace-platform` reports staleness across the fourteen. Re-run `gitnexus analyze` in a repo after committing to it.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

> This block does **not** self-heal: the parent `.gitnexusrc` sets `{"analyze": {"skipContextFiles": true}}`, so `gitnexus analyze` never rewrites it — the flag suppresses only this block, the index is still built. Every fact above is hand-maintained; correct it by hand when it drifts.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/{name}/context` | Codebase overview, check index freshness |
| `gitnexus://repo/{name}/clusters` | All functional areas |
| `gitnexus://repo/{name}/processes` | All execution flows |
| `gitnexus://repo/{name}/process/{process}` | Step-by-step execution trace |
| `gitnexus://group/marketplace-platform/status` | Staleness across all 14 |
| `gitnexus://group/marketplace-platform/contracts` | Contract registry (6 entries, 0 cross-links — see `docs/gitnexus.md`) |

`fullstack-marketplace-blueprint` is this parent workspace and holds docs only. For application code use a sub-repo registry name — `marketplace-common`, `marketplace-db-setup`, `marketplace-admin`, `marketplace-dev-*` — per the table in `docs/gitnexus.md`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->