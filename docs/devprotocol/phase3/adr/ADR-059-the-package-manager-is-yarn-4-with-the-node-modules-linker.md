# ADR-059 — the package manager is Yarn 4.18.1 with the `node-modules` linker, and `.yarnrc.yml` is committed and refused by content
# Marketplace

**Status:** accepted — it takes effect repository by repository as the owner merges the `chore/yarn-4` work into `main`; the two supersessions
below take effect with it
**Date:** 2026-11-16
**Deciders:** Giovanni Manzoni, platform owner, in the working session of 2026-11-16. The owner decided that all fifteen packages leave Yarn 1.22.22
for Yarn 4.18.1 in one sweep and, on how a committed `.yarnrc.yml` should meet the secret guard, chose to *allow it by path and refuse it by
content*. This ADR records the decision and what it costs, and does not argue a motive for leaving Yarn 1.
**Supersedes:** [`ADR-017`](./ADR-017-hooks-via-hookspath-and-prepare.md) **in part** — the mechanism: the root `prepare` script as the thing that
restores `core.hooksPath` on `yarn install`. The hook wiring itself, `hooks:install`, Qodana in both hooks, the executable-bit check and the parent's
manual step are not touched. [`ADR-026`](./ADR-026-node-engines-unified-with-caret.md) **in part** — the clause that `engines.node` is a hard exit 1
enforced by the package manager, which was its reason for choosing `engines` over `.nvmrc`, and its description of `packageManager` as a
`yarn@1.22.22` string. The caret, the one-spelling rule and `engines.node` as the single source the hooks read are not touched; the value itself
moved to `^26.13.1` the same day, by an order of the owner's that is a dated note in ADR-026 and not part of this supersession.
**Superseded by:** —

---

## Context

Fifteen packages — nine services, `marketplace-common`, `marketplace-db-setup`, three frontends and `marketplace-services-status` — carried one
`packageManager` string, `yarn@1.22.22+sha512.…`, handed out by Corepack (ADR-026 §Context, `docs/conventions.md` §Node and package manager).
Yarn 1 did five things on this platform that nobody ever decided and several ADRs lean on. Yarn 4.18.1 does none of them the same way:

| What Yarn 1 did | What on this platform relies on it | Yarn 4.18.1 |
|---|---|---|
| ran the root `prepare` script on every `yarn install` | ADR-017's hook wiring: `yarn install` restores `core.hooksPath` | never runs `prepare` on install; runs the root `postinstall` on a fresh install and when the dependencies changed, **not** on an unchanged one |
| exited 1 when `engines.node` did not match | ADR-026: a wrong Node fails at the first command, not under whichever gate runs first | does not read `engines` at all; install and scripts run under any Node |
| wrote a registry URL into every `yarn.lock` entry | `scripts/lockfile-registry-filter.sh` rewrites a LAN mirror out of them (ADR-037, ADR-055 §5) | lockfile format 10 carries no registry URL; there is nothing to rewrite |
| ran every dependency's install script | `mongodb-client-encryption` fetches its native binding in one | 4.18 does not, unless `enableScripts` is true |
| read `.yarnrc` | the v1 mirror and registry settings | ignores `.yarnrc`; reads `.yarnrc.yml`, in the project and in `~` |

The command line moved too: `yarn install --frozen-lockfile` is `yarn install --immutable`, `yarn upgrade` no longer exists, and `yarn audit` is
`yarn npm audit`.

The secret guard met the change head on. The `pre-commit` rule `SECRET_PATH`, byte-identical in all sixteen hooks, refused `.yarnrc` and
`.yarnrc.yml` by path, in the class of `.npmrc`, because a registry credential lives in them. A Yarn 4 project keeps its settings in a **committed**
`.yarnrc.yml`, and a file the hook refuses cannot be committed — so `nodeLinker` would have had to live in an untracked file per clone.

Three things were measured on a scratch project under Yarn 4.18.1 on 2026-11-16 and are what the table's first, second and last claims rest on: a
`prepare` script never ran and a `postinstall` ran on a fresh install and after a dependency was added but not on a repeat install of an unchanged
tree; `engines.node: ">=99.0.0"` installed with exit 0 under Node 24.18.0; and `yarn up -R '**'` moved a lockfile pinned at `debug` 4.3.4 and
`ms` 2.1.2, under the ranges `^4.0.0` and `^2.0.0`, to 4.4.3 and 2.1.3 while leaving `package.json` byte-identical.

On the same day the owner ordered **Node 26.13.1 everywhere and Node 24 removed from the project**; the value is a dated note in ADR-026. It reaches this ADR
for one reason: **Node 25 and later no longer bundle Corepack**, and every decision below reaches a machine through Corepack.

---

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Stay on Yarn 1.22.22 | nothing to migrate; `engines` stays a hard gate, `prepare` keeps self-healing and the registry filter keeps working | the classic line is maintenance-only, and it is the option the owner decided against |
| Bun, as piloted in `docs/report/bun-installer-pilot.md` | fast cold installs | that pilot's own verdict was *do not adopt*: `bun.lock` weakens Trivy and GitHub's dependency alerts, and Bun does not enforce `engines` either |
| Yarn 4 with Plug'n'Play, Yarn 4's default linker | no `node_modules` tree | vitest, Stryker, `tsc` with `paths` and the production start scripts all expect `node_modules`; every one of them would need a PnP integration |
| **Yarn 4 with `nodeLinker: node-modules`** | the tree every tool already reads is unchanged; only the manager moves | the table above is five things to replace on purpose |

How the secret guard meets a committed `.yarnrc.yml`:

| Option | Pros | Cons |
|---|---|---|
| Keep refusing `.yarnrc.yml` by path | no guard change | the file cannot be committed, so the linker is chosen per clone by a file nobody tracks, and a clone without it installs under PnP and breaks the suites |
| Allow it by path, add no content rule | smallest change | `.yarnrc.yml` is where Yarn 4 reads `npmAuthToken`; a token committed there would pass untouched |
| **Allow it by path and refuse it by content** | the settings travel with the clone; the one thing that must not be in the file is what the hook looks for | it matches key names, not values (see Risks) |

---

## Decision

**Yarn 4.18.1 with the `node-modules` linker, everywhere, in one sweep.**

**1. One string in all fifteen.** `"packageManager": "yarn@4.18.1+sha512.b2e1e752…"`, identical in the nine services, `marketplace-common`,
`marketplace-db-setup`, the three frontends and `marketplace-services-status`, through Corepack. `docs/conventions.md`'s rule that a yarn bump changes
all fifteen in one sweep is honoured, not amended.

**2. Each package commits a `.yarnrc.yml` holding three settings and a comment, and nothing else.**

- `nodeLinker: node-modules` — PnP is refused for the reason in the options table.
- `enableScripts: true` — Yarn 4.18 does not run dependencies' install scripts by default and `mongodb-client-encryption` fetches its native
  binding in one; `true` keeps what Yarn 1 did. A per-package allow-list is a possible follow-up (§5 of the ADR index).
- `enableTelemetry: false`.
- **Not set: `npmRegistryServer`, and any credential.** A project-level registry would override a LAN mirror configured in `~/.yarnrc.yml`. Credentials
  and the mirror — `npmRegistryServer`, plus `unsafeHttpWhitelist` for an `http` host — belong in `~/.yarnrc.yml`, and nowhere in a repository.
- Each `.gitignore` gains `.yarn/` and `.pnp.*`, and `!.yarnrc.yml`, because the owner's global git ignore matches `.yarnrc.yml`.

**3. The secret guard allows `.yarnrc.yml` by path and refuses it by content.** In all sixteen `pre-commit` hooks, byte-identically:

- `SECRET_PATH` says `\.yarnrc`, where it said `\.yarnrc(\.yml)?`: a bare `.yarnrc` — the Yarn 1 file, at the root or nested — is still refused, and
  `.yarnrc.yml` is not.
- A new rule, `YARNRC_CREDENTIAL`, refuses a staged `.yarnrc.yml` whose **staged blob** carries any of `npmAuthToken`, `npmAuthIdent`, `npmPassword`,
  `_auth`, `_authToken` or `_password` as a key, at any indent and in either quoting. It reads the index, not the working tree.
- `scripts/audit-check.sh` §8 (MC-16) compares `^YARNRC_CREDENTIAL` across the sixteen hooks with the same equality it applies to `SECRET_PATH`, and
  **runs** it: five lines it must refuse, three it must not, and `.yarnrc`, a nested `.yarnrc`, `.yarnrc.yml` and
  `marketplace-services-status/.yarnrc.yml` added to the path rule's refuse and pass lists.
- The owner's Claude `permissions.deny` still denies `Read` on `**/.yarnrc.yml`, so an agent does not read the file: it is placed and staged by the
  owner. `.claude/SECRETS.md` says so.

**4. The hook wiring moves from `prepare` to `postinstall`.** Yarn 4 does not run `prepare` on install, so in every package but one
`"prepare": "yarn run hooks:install"` is now `"postinstall": "yarn run hooks:install"`; in the three frontends it is
`"postinstall": "patch-package && yarn run hooks:install"`. `marketplace-common` keeps `prepare`, because `npm publish` still runs it to build
`dist/` (ADR-037), and gains a guarded `postinstall`, `[ ! -d .githooks ] || yarn run hooks:install`, which is a no-op inside a consumer's
`node_modules`, where there is no `.githooks`. `hooks:install` itself is unchanged.

**5. `engines` stays and stops being enforced by the manager.** `engines.node` is still one caret range in all fifteen — `^26.13.1` since the same day's order — and it is still the one place the
hooks read the required Node from: each `pre-push` reads it, switches via nvm and blocks with the `nvm install` line when the version is missing. That
check, and not `yarn install`, is now the enforcement; CI pins the version through `.nvmrc`.

**6. The lockfiles were migrated in place.** Every Yarn 1 `name@version` was verified present in the Yarn 4 lockfile, package by package. Yarn 4 adds
entries of its own: `node-gyp@latest`, for the `binding.gyp` of `mongodb-client-encryption`, and the builtin patch entries for `typescript` and
`fsevents`. `scripts/lockfile-registry-filter.sh` stays wired and unchanged in the fifteen repositories, and is inert; retiring it is a follow-up.

**7. Commands.**

- `gates.yml` runs `yarn install --immutable`, where it ran `--frozen-lockfile`; ADR-055 §5's reasoning is unchanged.
- **The refresh that re-resolves without widening is `yarn up -R '**'`**, run in each package: it re-resolves every range to the newest version it
  already allows, rewrites `yarn.lock`, and does not touch `package.json`. The quotes are required; a shell expands a bare `**`. ⚠️ **`yarn up '**'`
  without `-R` is the opposite**: it ignores the declared ranges and rewrites the manifest to the latest release — Yarn 1's `yarn upgrade --latest`.
  `yarn upgrade` itself is not a Yarn 4 command.
- The `update` script is `yarn upgrade-interactive`; `yarn audit` is `yarn npm audit`, and Trivy remains the gate (`README.md`, *Test quality gates*).

**8. Corepack is installed, not bundled, and pinned wherever it is installed.** Node 26 ships without it.

- **On a machine:** `npm install -g corepack@0.36.0 && corepack enable`, once per Node install (`SETUP.md` §1). It is the fix line every hook prints
  when Corepack is missing.
- **In CI:** the parent and every package repository carry `.github/tools/package.json` and `package-lock.json`, naming `corepack` 0.36.0 and nothing
  else. `gates.yml` copies the two files to the runner's temp directory, runs `npm ci --ignore-scripts` there, and puts the `corepack enable` shims on
  `PATH`. The parent's copy serves `marketplace-services-status`, which has no repository of its own; `marketplace-nginx` has no `package.json` and
  no copy.
- **Why `npm ci` of a lockfile and not `npm install -g corepack` in the workflow.** Scorecard's `Pinned-Dependencies` check reads a workflow's install
  commands, and a global install is a download nothing pins by integrity: it would take the check below the floor of 10 that ADR-054's ratchet holds,
  and the `pre-push` floor gate would refuse the push. `npm ci` installs from `package-lock.json`, where every byte carries an integrity hash, so the
  score holds.
- **Dependabot watches the directory.** The `npm` entry of each `dependabot.yml` lists `/.github/tools` beside `/`, so a new Corepack release arrives as a
  pull request that someone reads and the gates run on, which is the only way the pin moves.

---

## Consequences

### Positive
- One package manager string, one lockfile format and no registry URL in any lockfile: the thing the filter existed to keep out of git is not in them.
- The settings that make the suites work, `nodeLinker` first, travel with every clone instead of living in a file nobody tracks.
- The secret guard stays path-and-content: a committed `.yarnrc.yml` is allowed and a credential in one is not, with the same equality check across
  the sixteen hooks that protects `SECRET_PATH`.
- `yarn install --immutable` fails on any lockfile drift, as `--frozen-lockfile` did.

### Negative
- **`engines` is no longer a package-manager gate.** A developer running `yarn dev` or `yarn test` under the wrong Node gets no engine error; the
  wrong version shows up later, under whatever fails first, which is the failure ADR-026 was written to stop. The `pre-push` check catches it at
  push, not before.
- **The self-heal is weaker than it was.** `prepare` ran on every `yarn install`; `postinstall` runs on a fresh install and a changed one, and an
  unchanged `yarn install` does not re-arm `core.hooksPath`. `./scripts/bootstrap.sh` and `./scripts/audit-check.sh` §7 are now the dependable way, and
  the accidental self-heal through `marketplace-services-status` (it shares the parent's `.git`) is weaker by the same measure.
- **`enableScripts: true` keeps every dependency's install script running**, which is Yarn 1's posture and not an improvement on it.
- **Corepack is a dependency this platform now owns.** Two files per repository, 0.36.0 in each, and a local global install that is nobody's lockfile —
  a machine can sit on a different Corepack than CI until someone reinstalls it.
- **A dead mechanism stays in fifteen repositories**: the clean/smudge filter, its `git config` lines and the `pre-commit` wording about it do
  nothing under Yarn 4, and a reader has to be told so.
- **`node-gyp@latest` is a floating tag in a lockfile.** Resolved once and pinned by the lockfile, but `yarn up -R '**'` re-resolves it, so a refresh
  can move a build tool no `package.json` names.
- **Every branch open before the change conflicts on `yarn.lock`**, which was rewritten whole. Take the new file and run `yarn install`.
- **Yarn 4 ignores `.yarnrc`, so a v1 mirror setting stops applying** until the equivalent is in `~/.yarnrc.yml`. That file is per machine and not
  versioned.
- The `.yarnrc.yml` files are read-denied to Claude and placed by the owner; an agent cannot show what one says.

### Risks
- **`YARNRC_CREDENTIAL` is a list of key names, not a detector of secrets.** A token under a key the list does not know, or inside a URL's userinfo,
  passes it; the value scans of added lines that every staged file already gets (an `npm_` token, a UUID or JWT `_authToken`) still apply. Trigger to
  revisit: a registry credential reaching a committed `.yarnrc.yml` under a key not in the list.
- **`enableScripts: true`** is a supply-chain surface. Trigger to revisit: an advisory about an install script in a dependency of any of the fifteen.
- **Trivy reads the lockfile, and its parse of format 10 was not run for this ADR.** The first `pre-push` of each repository under Yarn 4 is the check;
  a gate that scans nothing looks like a gate that found nothing. Trigger to revisit: a `pre-push` that reports no packages for a lockfile that lists some.
- **`Pinned-Dependencies` reads the workflow's install commands.** Whether `--immutable` scores as `--frozen-lockfile` did is not measured here; the
  Scorecard floor gate at the first push is what will show it. A bare `npm install -g` added to any workflow later is the same fall that decision 8 avoids.
- **A new package copies a Yarn 1 shape** — a `prepare` hook, an `engines` expectation, a missing `.yarnrc.yml`. Trigger to revisit: a sixteenth package
  with a `package.json` that is not on this ADR's list.

---

## Compliance

```bash
# one identical packageManager string in the fifteen packages: one line of output, count 15
grep -ho '"packageManager": "[^"]*"' BEs/marketplace-common/package.json BEs/marketplace-db-setup/package.json BEs/dev/*/package.json \
  marketplace-admin/package.json marketplace-shopowner/package.json marketplace-user/package.json \
  marketplace-services-status/package.json | sort | uniq -c

# a .yarnrc.yml in all fifteen: count 15 (marketplace-nginx has none), and none swallowed by a git ignore: no output
ls BEs/marketplace-common/.yarnrc.yml BEs/marketplace-db-setup/.yarnrc.yml BEs/dev/*/.yarnrc.yml marketplace-*/.yarnrc.yml | wc -l
for r in BEs/marketplace-common BEs/marketplace-db-setup BEs/dev/marketplace-dev-* marketplace-admin marketplace-shopowner marketplace-user; do
  git -C "$r" check-ignore -q .yarnrc.yml && echo "$r: ignored"
done
git check-ignore -q marketplace-services-status/.yarnrc.yml && echo "marketplace-services-status: ignored"

# key names only: nodeLinker, enableScripts and enableTelemetry, and no other name
grep -oE '^[A-Za-z]+' BEs/marketplace-common/.yarnrc.yml

# the hook wiring is on postinstall: 15 files; and "prepare" is left in marketplace-common alone
grep -l '"postinstall"' BEs/marketplace-common/package.json BEs/marketplace-db-setup/package.json BEs/dev/*/package.json \
  marketplace-admin/package.json marketplace-shopowner/package.json marketplace-user/package.json marketplace-services-status/package.json
grep -l '"prepare"' BEs/marketplace-common/package.json BEs/marketplace-db-setup/package.json BEs/dev/*/package.json \
  marketplace-admin/package.json marketplace-shopowner/package.json marketplace-user/package.json marketplace-services-status/package.json

# Corepack is pinned by a lockfile in the parent and every package repository: count 15, one version
ls .github/tools/package-lock.json BEs/marketplace-common/.github/tools/package-lock.json BEs/marketplace-db-setup/.github/tools/package-lock.json \
  BEs/dev/*/.github/tools/package-lock.json marketplace-admin/.github/tools/package-lock.json marketplace-shopowner/.github/tools/package-lock.json \
  marketplace-user/.github/tools/package-lock.json | wc -l
grep -ho '"corepack": "[^"]*"' .github/tools/package.json BEs/marketplace-common/.github/tools/package.json BEs/marketplace-db-setup/.github/tools/package.json \
  BEs/dev/*/.github/tools/package.json marketplace-admin/.github/tools/package.json marketplace-shopowner/.github/tools/package.json \
  marketplace-user/.github/tools/package.json | sort | uniq -c

# no workflow command installs corepack any other way (comments are skipped): no output
grep -nE '^[^#]*install -g corepack' .github/workflows/*.yml BEs/*/.github/workflows/*.yml BEs/dev/*/.github/workflows/*.yml marketplace-*/.github/workflows/*.yml

# no Yarn 1 lockfile left: no output
grep -l 'yarn lockfile v1' BEs/marketplace-common/yarn.lock BEs/marketplace-db-setup/yarn.lock BEs/dev/*/yarn.lock \
  marketplace-admin/yarn.lock marketplace-shopowner/yarn.lock marketplace-user/yarn.lock marketplace-services-status/yarn.lock

# nothing in a workflow says --frozen-lockfile any more: no output
grep -n 'frozen-lockfile' .github/workflows/gates.yml BEs/*/.github/workflows/gates.yml BEs/dev/*/.github/workflows/gates.yml \
  marketplace-*/.github/workflows/gates.yml

# the content rule is the same in all sixteen hooks, and it refuses what it must
./scripts/audit-check.sh        # §8
```

A violation looks like:

- a `packageManager` that is not the one string, or a package with a `yarn.lock` that opens with `# yarn lockfile v1`;
- a `.yarnrc.yml` with a key beyond the three, above all `npmRegistryServer` or any credential key, or one missing from a package;
- `\.yarnrc(\.yml)?` back in a `SECRET_PATH`, a `.yarnrc.yml` named in no hook, or a hook whose `^YARNRC_CREDENTIAL` differs from the parent's;
- `"prepare": "yarn run hooks:install"` back in a package other than `marketplace-common` — a hook wiring Yarn 4 never runs;
- `yarn install --frozen-lockfile` in a workflow, or `yarn upgrade` or `yarn up '**'` without `-R` in a document as the refresh;
- `nodeLinker` removed or changed, or a `.pnp.cjs` appearing in a working tree;
- `npm install -g corepack` in a workflow, a `.github/tools` that `dependabot.yml` does not list, or a Corepack version that differs between two repositories.
