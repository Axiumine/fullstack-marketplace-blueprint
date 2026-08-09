# GitNexus — code intelligence

**Polyrepo setup: 14 independent indexes, not one.** Each sub-repo that ships code is indexed on its own
and tied together by the group **`marketplace-platform`**. `marketplace-nginx` — nginx config and shell
tests, no code — has no index and is not in the group.

⚠️ **`repo:` is mandatory on every MCP call.** Use the registry name, not the group path:
`impact({target: 'loginAdmin', repo: 'marketplace-dev-public-authorization'})`.

| Group path | Registry name (`repo:` param) |
|---|---|
| `lib/common` | `marketplace-common` |
| `lib/db-setup` | `marketplace-db-setup` |
| `be/public/authorization` | `marketplace-dev-public-authorization` |
| `be/public/resource` | `marketplace-dev-public-resource` |
| `be/shopOwner/authorization` | `marketplace-dev-authenticated-authorization` |
| `be/shopOwner/resource` | `marketplace-dev-authenticated-resource` |
| `be/shopOwner/logout` | `marketplace-dev-authenticated-logout` |
| `be/admin/authorization` | `marketplace-dev-admin-authenticated-authorization` |
| `be/admin/resource` | `marketplace-dev-admin-authenticated-resource` |
| `be/user/authorization` | `marketplace-dev-user-authenticated-authorization` |
| `be/user/resource` | `marketplace-dev-user-authenticated-resource` |
| `fe/admin` | `marketplace-admin` |
| `fe/shopOwner` | `marketplace-shopowner` |
| `fe/user` | `marketplace-user` |

## Two registry names that will mislead you

⚠️ **`fullstack-marketplace-blueprint` is this parent dir only** — its docs and skill files, no
application code. It is not the platform index and never will be. GitNexus names an index after the
directory, which is why the entry follows the folder rather than the product. Keep it current so the
staleness hook stays quiet; never query it expecting application code.

⚠️ **What kept application code out of that index was the parent's `.gitignore`, and since ADR-031 it no
longer lists the sub-repo paths** — they are submodules, and an ignored path is one `git submodule add`
refuses. The fifteen sub-repos' files are physically present under this directory, so whether the next
`gitnexus analyze` here still produces a docs-only index depends entirely on whether it skips gitlinked
directories, which is **unverified**. Check the symbol count after the first `analyze` run following the
conversion: a parent index that suddenly holds resolvers or React components has swallowed the sub-repos
and must be rebuilt with them excluded. Do not guess an exclude key into `.gitnexusrc` — the loader fails
closed, so an unknown key aborts the analysis rather than no-opping.

⚠️ **The registry also holds indexes from other workspaces on this machine.** `list_repos` returns
entries rooted outside this tree, some of them near-identical in shape to the fourteen above — they
will happily answer a query about a codebase that is not this one. **Always pass a `marketplace*`
name.**

## Always do

- **MUST run `impact({target, direction: "upstream"})` before editing any symbol**, and report the blast
  radius (direct callers, affected processes, risk level) to the user.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding.
- **MUST run `detect_changes()` before committing.** For regression review against the default branch:
  `detect_changes({scope: "compare", base_ref: "main"})`.
- Exploring unfamiliar code: `query({search_query: "concept"})` instead of grepping — it returns
  process-grouped results ranked by relevance.
- Full context on a symbol (callers, callees, flows it participates in): `context({name})`.
- Security review: `explain({target})` lists taint findings (source→sink; needs `analyze --pdg`).

## Never do

- NEVER edit a function, class or method without running `impact` on it first.
- NEVER ignore HIGH or CRITICAL risk warnings.
- NEVER rename symbols with find-and-replace — use `rename`, which understands the call graph.
- NEVER commit without running `detect_changes()`.

## ⚠️ HTTP contract extraction does not work on this platform

`group sync` yields **0 cross-links** — verified empirically across all 14 repos: 6 contracts, 0
cross-links, three providers and three consumers that are disjoint sets.

Why: the nine services mount Apollo via `if (ctx.path === ENDPOINT)` inline dispatch, and GitNexus's
extractor only recognises `router.get(...)` / `app.post(...)` / NestJS decorators. Compounding, `.mts`
and `.mjs` are absent from its extension registry, and the tool has no GraphQL model at all.

The registry's providers are the three `@koa/router` routes in `be/public/resource`; its consumers are
each frontend's `searchAddresses` in `src/lib/nominatim.ts` calling the external geocoding API, which can
never match a provider in this group.

**Consequence: do not reach for `route_map`, contract cross-links, or `group impact` across the HTTP
boundary — they return nothing.** A detector gap, not a config problem; manual `links:` entries in
`group.yaml` cannot help, because no contract object exists to link. Symbol-level tools (`query`,
`context`, `impact`, `detect_changes`) work normally within each repo and are where the value is.

## Cross-repo work is CLI only

```bash
gitnexus group impact marketplace-platform --target <sym> --repo be/admin/resource --direction downstream
gitnexus group query  marketplace-platform "onboarding shopOwner"
```

Here `--repo` takes the **group path**, unlike the MCP tools.

## Maintenance

```bash
cd <changed-repo> && gitnexus analyze          # incremental; re-run per repo after commits
gitnexus group sync marketplace-platform       # after a marketplace-common deploy or resolver/schema change
gitnexus group status marketplace-platform     # staleness across all 14
```

Adding a repo to the group is `gitnexus group add marketplace-platform <groupPath> <registryName>` — not
automatic. A repo indexed but not added answers single-repo queries while being invisible to every
`group` command.

### `.gitnexusrc` — committed per repo, no flags to remember

`analyze` rewrites `AGENTS.md` / `CLAUDE.md` on every run, and the generated header carries live symbol
counts that change whenever anything is edited — so the files came back dirty after every index. Every
repo commits a `.gitnexusrc` at its root (JSON only, read from the repo root — **not** from
`.gitnexus/`, which is gitignored index storage):

| Where | `.gitnexusrc` | Effect |
|---|---|---|
| the 14 indexed sub-repos | `{"analyze": {"noStats": true}}` | generated block keeps its guidance, drops the volatile counts — byte-identical across runs |
| this parent dir | `{"analyze": {"skipContextFiles": true}}` | no block written at all, so the hand-written `AGENTS.md` block is never appended over |

`skipContextFiles` suppresses only the `AGENTS.md` / `CLAUDE.md` block — the index is still built and the
skill files are still written. CLI flags override the file (`--no-stats`, `--skip-agents-md`), and the
loader fails closed: an unknown key or wrong value type aborts before analysis rather than silently
no-opping. Both settings are verified idempotent.

## Resources

`{name}` = a registry name from the table above — **never `fullstack-marketplace-blueprint`**, and never
an index belonging to another workspace.

| Resource | Use for |
|---|---|
| `gitnexus://repo/{name}/context` | Codebase overview, check index freshness |
| `gitnexus://repo/{name}/clusters` | All functional areas |
| `gitnexus://repo/{name}/processes` | All execution flows |
| `gitnexus://repo/{name}/process/{process}` | Step-by-step execution trace |
| `gitnexus://group/marketplace-platform/status` | Staleness across all 14 repos |
| `gitnexus://group/marketplace-platform/contracts` | Contract registry (near-empty — see above) |

## Skill files

| Task | Read |
|---|---|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |
