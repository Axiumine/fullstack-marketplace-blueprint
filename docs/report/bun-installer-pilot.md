# Bun as the package manager: a pilot on marketplace-db-setup

# Marketplace

**Status:** investigation finding, nothing adopted, nothing pushed. Not baselined, not a requirement.
**Date:** 2026-10-18
**Asked by:** the platform owner ("yes run one pilot", after asking whether Bun could replace npm/yarn and still use the Verdaccio mirror).
**Method:** four investigators and one synthesizer worked in scratch clones of `marketplace-db-setup` and scratch copies of three other repos' manifests and lockfiles; the figures were measured on a shared host, the dependency and scanner behaviour was run, and the Dependabot and dependency-graph rows come from GitHub's documentation and were not observed.
**Scratch artefacts** are session-local and do not outlive the session; the pilot branch commit named at the end is not in any repository.

---

## Verdict

**Do not adopt Bun now, for any repo. Bun works technically, but it is not worth the cost yet.**

- **What works:** the migration is lossless on the four repos measured. The Node-run toolchain and the scanners I could test behave the same as under yarn.
- **Gains:** install is seconds faster (cold frozen install 0.5 to 1.3 s against 3.9 to 14.9 s) and disk use is about 4 to 5 times lower. Bun also adds `minimumReleaseAge` and an explicit trust list for dependency install scripts. None of that is a security or correctness gain the platform lacks today.
- **Costs and open risks:**
  - **Trivy blind spot (confirmed):** Trivy silently skips non-hoisted packages in `bun.lock`. A CRITICAL in a nested copy exits 0 on every Trivy version tried (0.70.0, 0.71.0, 0.74.0, 0.75.0). A pass would mean nothing, so the Trivy gate must be replaced or supplemented.
  - **GitHub alerts (documentation only):** the docs table says Dependabot security updates are not supported for Bun, and the dependency-graph page lists no Bun. Nothing was pushed, so this is unobserved.
  - **Bun does not enforce `engines.node`**, and it silently runs tools under its own Node look-alike when no `node` is on PATH.
  - **`bun.lock` still absorbs a LAN mirror host.** The smudge/clean filter is still needed, and it must be rewritten.
  - **Hooks:** `hooks:install` and the filter's `install` subcommand break, because Bun does not export `npm_config_registry`.
  - **Hardlinked cache:** a hardlinked shared cache lets `patch-package` contaminate the cache in `marketplace-admin`.
- **Not tested:**
  - the pre-push chain end to end;
  - the 100% coverage verdict (no MongoDB in the scratch clone);
  - the mutation gate and Qodana;
  - the GitHub workflow, Dependabot and the remote-mode Scorecard;
  - private-package auth for the nine services;
  - the three apps, `marketplace-services-status` and 12 of 16 repos beyond reading their `package.json`.

The pilot repo is clean and technically viable, so the answer can change (see the last section).

## What was run

- Scratch clones only. Bun 1.4.3, installed outside PATH and invoked by absolute path, against the LAN Verdaccio mirror (`http://yarnproxy.gio.lan:4873/`) and against registry.npmjs.org. Caches were isolated per run.
- Pilot branch `pilot/bun-installer`, local commit `b20c599`, origin removed, in a scratch clone of `marketplace-db-setup`. Benchmarks used copies of four repos: db-setup, common, public-resource and admin.
- Nothing was pushed, committed in the real checkouts, or modified under `/media/nvme/websites/fullstack-marketplace-blueprint`. The `.yarnrc` and `.npmrc` files were not read.
- Pinned Docker images (semgrep 1.172.0, trivy 0.70.0) were not on the machine. Semgrep 1.178.0 and Trivy 0.75.0 were used for the gate runs. Trivy 0.70.0 was run on the scanner fixtures with a copy of the DB cache.
- The mutation gate and Qodana were not started, per the rules.
- Host load: load1 was 116 at the start and about 17 to 27 for the quoted timings.

## Results by area

| Area | Result | Evidence |
|---|---|---|
| Lockfile migration yarn.lock to bun.lock | works | db-setup: 301 name@version entries on both sides, 0 integrity mismatches, `resolutions` became `overrides` and qs 6.16.0 was honoured. Installed name@version sets identical in all 4 repos. Re-migration is byte-identical |
| Registry host written into bun.lock | breaks (needs a filter) | Bun writes `""` for registry.npmjs.org and the full tarball URL for any other registry. Via Verdaccio, 303/303 entries carry the LAN host. A smudged yarn.lock migrates to 303 LAN URLs. `bun add` through the mirror rewrote 304/304 entries. A lock that has URLs is installed from those URLs; an empty slot follows the configured registry |
| Smudge/clean filter extended to bun.lock | works with changes | Bun variant (clean blanks the mirror, smudge is `cat`) round-tripped in real git: staged blob 0 URLs, staged diff only the 3 new lines, integrity 304 = 304. A fresh clone passed frozen install via npmjs and via Verdaccio |
| packageManager, engines, Corepack | works with changes | `engines.node >=999`: bun exits 0, yarn exits 1. Corepack cannot provision bun. With `packageManager: bun@1.4.3` the yarn shim refuses, so a stray `yarn install` cannot recreate yarn.lock. setup-bun reads `packageManager` |
| Node stays the runtime | works with changes | With node on PATH, vitest ran on node v24.18.0. With no node on PATH, bun posed as node v26.3.0 and the test passed. A `pretest` guard on `process.versions.bun` fired under the shim. Nested `bun run` needs bun on PATH (exit 127 otherwise) |
| Environment of root scripts | breaks (hooks:install, filter install) | `npm_config_registry` is empty under bun but exported by yarn. Bun rewrites `yarn run X` to `bun run X`. Script shell is bash, not `/bin/sh`. `bun run` does not inject `.env` into child processes |
| `--frozen-lockfile` drift | works with changes | Bun fails on add, remove, narrowed range, edited `resolutions` and dropped `resolutions` (5 of 6 cases); yarn fails 3. A relaxed range the locked version still satisfies: bun exits 0, yarn exits 1. Error text is "lockfile had changes, but lockfile is frozen" |
| Integrity (sha512) | works with changes | 303/303 entries carry sha512. Tampered hash, cold cache: both exit 1. Tampered hash, warm cache: bun exits 0, yarn exits 1. An empty-string integrity is accepted by bun; a stripped hash is accepted by yarn. `--no-verify` exists |
| Dependency install scripts, trustedDependencies | works with changes | Bun's default-trusted list (367 to 368 names) includes mongodb-client-encryption, esbuild and @apollo/protobufjs. unrs-resolver and postinstall-postinstall are blocked. A non-empty `trustedDependencies` replaces the default. A missing trust is silent. `[]` ran the script in 3 of 3 runs with an existing lock, contradicting the docs. With scripts on, bun and yarn trees were identical (13417 files, same hashes) |
| minimumReleaseAge | works with changes | Present in 1.4.3. A 30 day gate cannot resolve the pilot's own ranges (dotenv 4 d, redis 18 d, mongodb 20 d old). It applies at resolution time only, not on frozen installs, and is not recorded in the lock |
| `resolutions` vs `overrides` | works | Native `resolutions` support. With both keys present, `overrides` wins. Dropping the entry fails frozen install (yarn exits 0) |
| node_modules layout | works | Same 13417 files at the same paths. 23 vs 51 symlinks. Other repos: 5 (common) and 12 (public-resource, admin) root packages resolve to a different version than under yarn. Grep of the four checkouts found no import of them |
| Hardlink backend and patch-package | works with changes | In admin, patch-package wrote through a hardlink into the shared cache (same inode, md5 changed in both places). A later wipe and warm install returned the patched file silently. `--backend=copyfile` avoids it (warm 0.35 s) |
| Unit tests and coverage gate | works | `test:unit`: 5 files, 57 tests, identical under yarn. `test:cov` identical numbers (92.88/91.07/89.28/94.07) and exit 1 on both, because the 86-test migration replay needs MongoDB. `coverage-audit.mjs` passes |
| Node-run toolchain | works | vitest, tsc, eslint, prettier, vite, patch-package, migrate-mongo give identical `--version` output in four trees. Smoke runs passed (vitest with v8 coverage, tsc strict, eslint, prettier) |
| Semgrep gate | works | 105 rules, 34 targets, 0 findings, exit 0 with `bun run semgrep:ci` |
| Trivy on hoisted packages | works | Parses bun.lock as type `bun`. Fixtures: 8 production findings (14 with dev) identical to yarn.lock. Real tree: 0 findings. Same on 0.70.0 and 0.75.0 |
| Trivy on nested packages | breaks | Fixture with nested minimist 0.0.8 (CRITICAL): yarn.lock exits 1, bun.lock exits 0. Nested entries are named like `mkdirp/minimist`. Upstream issue #11239 is closed not_planned and PR #11071 is open. Real db-setup has 7 of 303 nested entries, none vulnerable today. Against the production tree, Trivy saw 64 of 65 packages |
| osv-scanner | works | v2.0.3 and v2.6.0 give identical results for yarn.lock and bun.lock on fixtures, including the nested minimist and `[[IgnoredVulns]]`. No severity filter and no dev/prod flag |
| OpenSSF Scorecard (local mode) | works | Vulnerabilities, Dependency-Update-Tool and Packaging identical to yarn. Pinned-Dependencies stays 10 with a SHA-pinned setup-bun and drops to 7 with a tag pin, `curl \| bash`, or `npm install -g bun`. Remote mode not run |
| CI gates.yml | works with changes | `oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0` with `no-cache: true`, then `bun install --frozen-lockfile`. Not executed on GitHub |
| Dependabot version updates | unknown | Docs: ecosystem `bun` (>=1.1.39), text `bun.lock` supported, cooldown supported, `dependency-type` grouping not supported. Not run |
| Dependabot security updates, dependency graph | breaks (per docs) | Docs table: Bun security updates "Not supported". The dependency-graph page lists no Bun. One investigator treated this as unverified, so confirm on a throwaway repo |
| Registry auth and tokens | unknown | Dummy tests: `.npmrc` and bunfig tokens went only to the scoped host. An unset variable gives a confusing 401. The `@axiumine` packages install anonymously. Real token and `.yarnrc` reading not tested |
| bun publish | breaks | No provenance and no documented trusted publishing. Keep `upload` on `npm publish` with the registry pin |
| Qodana | unknown | Not run. JetBrains docs name npm and Yarn for the license audit and do not mention bun.lock |
| CodeQL | unknown | `codeql.yml` has no install step, so no change is expected. Not run |
| Pre-push chain, mutation, MongoDB suites | not run | Hooks only syntax-checked (`bash -n`). The lock backstop snippet was run alone and behaved correctly |

## Numbers

Cold install means empty manager cache and empty node_modules. All runs used `--frozen-lockfile --ignore-scripts` through the same Verdaccio, on a shared 32-core host. Wall seconds, median of 3, load1 17 to 25.

| Repo | Cold yarn | Cold bun | Warm yarn | Warm bun |
|---|---|---|---|---|
| db-setup | 3.92 | 0.53 | 3.79 | 0.18 |
| common | 14.91 | 1.09 | 5.40 | 0.92 |
| public-resource | 8.28 | 1.03 | 2.67 | 0.19 |
| admin | 7.75 | 1.25 | 2.70 | 0.14 |

- **Second db-setup run** (load1 about 26): cold bun 0.54 s vs yarn 4.91 s, warm bun 0.14 s vs yarn 2.11 s.
- **Tests:** `test:unit` takes 0.712 s under bun vs 0.897 s under yarn. Scanner times are about equal (osv-scanner 0.62 vs 0.65 s, Trivy 0.58 vs 0.55 s).
- **CPU time** (user plus system) is the stable figure: cold yarn 7.2 to 16.0 s vs bun 0.45 to 1.15 s (12 to 17 times less), warm 26 to 36 times less.
- **Part of the gap is data volume.** Yarn 1 fetched every lock entry, including wrong-platform optionals. Bun fetched only what installs on linux-x64.

| Repo | Tarballs yarn | Tarballs bun | MB yarn | MB bun |
|---|---|---|---|---|
| db-setup | 301 | 278 | 167.1 | 36.1 |
| admin | 660 | 613 | 256.8 | 75.6 |

Disk, MiB (`du`). "Combined" is cache plus node_modules.

| Repo | node_modules yarn / bun | Cache yarn | Cache bun | Combined yarn | Combined bun |
|---|---|---|---|---|---|
| db-setup | 158 / 157 | 621 | 159 | 779 | 164 |
| common | 306 / 305 | 864 | 308 | 1170 | 318 |
| public-resource | 357 / 357 | 1308 | 361 | 1665 | 373 |
| admin | 366 / 365 | 1048 | 369 | 1414 | 380 |

- **Disk totals:** the four repos with per-repo caches total 5028 MiB under yarn vs 1236 MiB under bun (4.1 times). On one shared cache: yarn 3251 MiB, bun 618 MiB.
- **Load caveat:**
  - At load1 43 to 81, yarn cold took 6.8 to 31.9 s and bun 0.65 to 1.15 s. At load1 17 to 25 the ratio was 6 to 29 times. Do not quote a single wall ratio.
  - An earlier cold set at load1 about 65 is not quoted, because its cache wipe missed hidden entries.
  - Verdaccio was warm, so these are LAN numbers, not internet numbers. Direct from registry.npmjs.org, db-setup cold took 1.1 to 1.4 s.
- **Pilot repo change size:** lines mentioning yarn went from 202 in 26 files to 12 in 7 files (all deliberate leftovers). Other sampled repos have 150 to 200 yarn-mentioning lines each.

## Changes adoption would require across the 16 repos

Counts are as the investigators reported them: 15 `package.json`, 14 `gates.yml`, 15 copies of the filter script. `marketplace-services-status` is a plain parent directory with no hooks or workflows of its own (it rides the parent's), and `marketplace-nginx` ships no JavaScript.

- [ ] **Lockfile and filter**
  - Migrate each repo once from a yarn.lock with public URLs (never re-resolve) and run the name@version and integrity comparison script before deleting yarn.lock.
  - Replace the 15 byte-identical filter script copies with the bun variant; whether a parent test or doc asserts they are identical is unknown.
  - `.gitattributes`: `bun.lock filter=lockfile-registry`. Point the pre-commit backstop at `:bun.lock`.
  - Never commit a `bunfig.toml` naming the LAN host. Keep the mirror in `~/.bunfig.toml` or `BUN_CONFIG_REGISTRY`.
- [ ] **package.json**
  - `packageManager: bun@<exact>`.
  - Keep `resolutions` or use `overrides`, not both.
  - Rewrite `prepare` and `hooks:install` so they do not depend on `npm_config_registry` or the word yarn.
  - `engines` stays but is no longer enforced by the package manager (see hooks).
- [ ] **trustedDependencies**
  - Declare an explicit non-empty list in every repo. Never use `[]`, and never rely on the default list.
  - Today: mongodb-client-encryption (db-setup, common, services); esbuild and @apollo/protobufjs in the services; decide on unrs-resolver and postinstall-postinstall. Measure services, apps and tooling per repo.
  - Verify the artefact exists (`node -e "require(...)"`), because a missing trust is silent. Do not use `bun pm untrusted` as the audit.
- [ ] **Scripts**
  - Codemod `yarn <script>` to `bun run <script>`, `yarn upgrade-interactive` to `bun update --interactive`, and `yarn clean`.
  - Survey: 4 yarn hits per service `package.json`, 10 in common, 5 in services-status.
  - `upload` stays on `npm publish` with the registry pin, in marketplace-common. Make sure `npm` stays on PATH.
  - `qodana.sh`: `yarn test:cov` becomes `bun run test:cov`.
- [ ] **Hooks** (`.githooks/pre-commit` and `pre-push`, 64 to 87 yarn lines each)
  - `RELEVANT_PATHS`, the Trivy precondition and the lock backstop move to `bun.lock`. Use `command -v bun`, `bun run`, `bun why`, `bun update`.
  - Keep the nvm `node_satisfies` block as the only engine gate. Add a `pretest`, `pretest:cov` and `pretest:unit` guard against the Bun shim.
  - Add `bunfig.toml` to `SECRET_PATH`, to `.claude/SECRETS.md`, and to the `permissions.deny` and no-secret-leak hook lists (they list `.yarnrc` and `.npmrc`).
  - Replace or supplement the Trivy gate with osv-scanner (pinned `ghcr.io/google/osv-scanner:v2.6.0`), with a nested-package fixture as a regression check. Run the pinned Trivy 0.70.0 once on bun.lock before trusting it.
  - Optional hardening: assert every `bun.lock` tuple ends in a non-empty `sha512-`; run `bun install --lockfile-only` plus `git diff --exit-code bun.lock` to catch relaxed ranges.
- [ ] **Workflows** (`gates.yml`, byte-identical in 14 packages, change once and replicate)
  - Remove `corepack enable`. Add the SHA-pinned `oven-sh/setup-bun` (`no-cache: true`, exact `bun-version`) after `actions/setup-node`.
  - `bun install --frozen-lockfile`; `yarn x` becomes `bun run x`; add an osv-scanner step.
  - Confirm `codeql.yml` stays green on the first PR.
- [ ] **Dependabot** (15 files)
  - `npm` becomes `bun`; keep `github-actions`.
  - Redesign the `dev-toolchain` group: `dependency-type: development` is documented as unsupported for Bun, so group by patterns or update-types.
  - Keep the `@axiumine/marketplace-common` ignore and verify it on the first real PR.
  - Keep the rule that a Dependabot PR is fetched, installed and gated locally before merge.
  - Plan for no GitHub security alerts on bun.lock until confirmed.
- [ ] **Scorecard floors** (ADR-054)
  - Never lower a `.scorecard-floor`. Pinned-Dependencies must stay 10, so setup-bun is SHA-pinned and never installed through curl or `npm install -g`.
  - Re-run the real (remote) Scorecard before touching any floor.
  - Packaging stays -1 (equal to the floor) while `npm publish` is the publisher.
- [ ] **Docs and ADRs**
  - Docs: parent `CLAUDE.md`, `REPO.md`, `SETUP.md`, `docs/workflow.md`, `docs/conventions.md`, `docs/testing.md`, `.claude/SECRETS.md`, `BEs/marketplace-common/REPO.md` (nine-step release with `yarn upload`), `semgrep/README.md`, each repo's `CLAUDE.md`.
  - ADRs that mention yarn: 015, 024, 031, 054, 055, plus 037 and 047 (`yarn install` authoritative, `yarn upload`). This pilot did not re-read ADR text, so each needs a read to decide amend versus supersede. A new ADR should record the Trivy limit and the Dependabot security-update gap.
- [ ] **Corepack, packageManager, engines**
  - Corepack cannot provision bun, so developers and CI install a pinned bun themselves.
  - Bun was not on PATH on this workstation, and nested `bun run` and `prepare` fail without it.
  - `engines.node` is documentation only under bun; the hook and a `pretest` guard are the real gates.
- [ ] **Process:** one logical change is N+1 commits (one per sub-repo plus the parent pointer bump, ADR-031), each on a branch, nothing pushed without a request. `marketplace-services-status` changes ride in the parent commit.

## Risks and unknowns

- **Security-gate blind spot:** Trivy on `bun.lock` passes a CRITICAL in a non-hoisted copy. The other 14 repos' lockfiles were not read and may hold more nested entries. Upstream fix PR #11071 is unmerged. Trivy 0.76.0 (released 2026-10-14) was not tested.
- **GitHub-side signal:** security updates and the dependency graph for `bun.lock` rest on documentation. The Bun support row in the docs was not observed on a real push.
- **Silent behaviours:** missing `trustedDependencies` entries, a warm cache hiding a bad lock integrity, an empty-string integrity, and the Bun shim running tools when no `node` is on PATH. Each needs an explicit gate, not trust.
- **Hardlinked cache:** patch-package contaminates the shared cache. Only `marketplace-admin` carries a patch today, but the stryker util package is shared by the other 13 stryker repos. Cross-filesystem behaviour (copy fallback) was not tested.
- **Private packages:** `@axiumine/marketplace-common` is untested for scanners and Dependabot. The nine services' token-bearing scope config and `$NPM_TOKEN` interpolation were not tested, and a token in a repo-level `bunfig.toml` becomes a secret file to the existing guards.
- **Untested toolchain:** patch-package under bun, Vite builds of the three apps, `marketplace-services-status`, and the real suites for 12 repos. Stryker, Qodana, the Scorecard floor in remote mode, Dependabot and GitHub Actions were not run.
- **Conflicts between investigators:** none found on measured facts. The one divergence is the Dependabot security-update claim (documentation table versus "unverified"). Tarball tampering at the registry and a fresh re-resolution (not a migration) were not tested.
- **Mirror hygiene:** a non-frozen `bun add` or `bun update` through Verdaccio rewrites every URL in the lock. Without the filter, the LAN host would be committed.
- **Gain size:** seconds per install and about 4 to 5 times less disk. Do not justify the migration on speed alone.

## Recommendation and next step

**Do not adopt now.** The pilot shows Bun is workable, but the platform's gates are its main asset, and moving to `bun.lock` currently weakens two of them (Trivy and GitHub alerts) while saving seconds. Keep yarn 1.22.22.

What would change the answer:

1. osv-scanner accepted as the blocking vulnerability gate (or Trivy fixed for nested entries), with the nested fixture as a regression test that must fail on the known-bad lock.
2. The owner accepts losing GitHub security alerts on `bun.lock`, or a throwaway repo shows they work.
3. One end-to-end `pre-push` chain on db-setup with the pilot branch, on the workstation that has MongoDB. This covers semgrep, the pinned Trivy 0.70.0, the Scorecard floor, `test:cov` at 100%, and Qodana run by the owner with the license audit confirmed to still list dependencies.
4. The first Dependabot PR on a bun repo behaves as expected, including the `@axiumine/marketplace-common` ignore and the group redesign.
5. A reason beyond speed, such as disk or CI cost, that the owner wants to pay for.

If the owner decides to proceed anyway, a staged order that fits the evidence is below. Each stage exits only when all gates pass and the lock diff is reviewed.

1. **Stage 0, prerequisites:** the shared bun filter script, the osv-scanner gate with its nested fixture, a pinned bun on the workstation, and a decision on `trustedDependencies` policy and ADRs.
2. **Stage 1, db-setup only:** merge the pilot branch after items 3 above. Exit when the pre-push chain is green, Scorecard floors are unchanged, and one Dependabot PR has been handled.
3. **Stage 2, two or three repos without patch-package:** for example marketplace-common (keeping `npm publish`) and one service. Exit when the token-bearing scope config works with the real read-only token and a published release still reaches a consumer.
4. **Stage 3, the remaining services and tooling:** exit when the shared `gates.yml` and filter are byte-identical again across all repos.
5. **Stage 4, separate pilots:** the three apps (patch-package, vite, `--backend=copyfile` for admin) and `marketplace-services-status`. They are not covered by this pilot.

Scratch artefacts (not deliverables): `/tmp/claude-1000/-media-nvme-websites-fullstack-marketplace-blueprint/f4e169d4-3244-4501-b225-361ee27a20d4/scratchpad/bun-pilot/` (`build/repo` holds the pilot commit `b20c599`).
