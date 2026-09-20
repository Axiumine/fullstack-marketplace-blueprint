# ADR-055 — the gates run on GitHub too, and `main` requires them
# Marketplace

**Status:** accepted
**Date:** 2026-09-20
**Deciders:** platform owner, in the instruction *"do 1+2+3"* given the same day ADR-054 landed, whose third
item was *"close R63"* — the hole ADR-054 opened deliberately and recorded in its own §Risks.
**Supersedes:** — (it reverses one option ADR-054 rejected; see §Context)
**Superseded by:** —

---

## Context

ADR-054 weighed *"a CI pipeline reproducing every local gate, with required status checks"* and rejected it
in one line: *"honest and the right long-term answer, and far past the scope of this work"*. The same ADR
then wrote down what the rejection cost, as `RISK_REGISTER` **R63**: ⚠️ **a pull request merged in the
browser passes no gate at all.** Every gate on this platform is a local git hook wired by `core.hooksPath`;
a merge performed on github.com is a server-side operation with no local git process anywhere in the path.
Dependabot, which the same change switched on in all sixteen repositories, never clones locally and never
runs `prepare`. The mitigation ADR-054 could offer was a procedure written at the top of every
`dependabot.yml` — fetch the branch, check it out, `yarn install`, let the hooks run, merge only then — and
a procedure is not a gate.

It stopped being hypothetical within the hour. The first push of `scorecard.yml` to `main` in
`marketplace-common` was followed immediately by two Dependabot runs opening update branches. The green
merge button on those pull requests was, at that moment, a way into `main` past eight blocking gates.

Two things also became measurable that were not before, and they matter to the design:

1. **A run costs about ninety seconds.** The same eight gates that guard a push locally — semgrep, trivy,
   scorecard, lint, types, coverage, mutation, Qodana — take 90 to 135 seconds per repository on this
   workstation. Mutation, the gate everyone assumes is the expensive one, is seconds on packages of this
   size: 38 mutants in `marketplace-dev-admin-authenticated-authorization`. A pipeline reproducing the
   gates is therefore not a ten-minute tax per pull request, which was the tacit assumption behind
   *"far past the scope"*.
2. **Two of the eight gates genuinely cannot move to CI, and half of a third.** Qodana needs a JetBrains
   Cloud token, and putting a long-lived credential into sixteen public repositories to raise a number is
   the trade ADR-054 already refused for a personal access token. Scorecard already has its own workflow
   and grades the repository rather than a diff, so a second copy per pull request would answer a question
   nobody asked.

   The third is the coverage gate in the nine backend services, and it was the one finding that changed
   the shape of this ADR. Their `yarn test:cov` evaluates **two** vitest projects, and the `integration`
   one is not hermetic. `vitest.mongo.mts` requires a seven-variable `MONGO_TEST_*` block that is read
   from a file which is never committed; `test/integration/globalSetup.mts` connects as the database
   owner, drops a throwaway database and **replays every marketplace-db-setup migration read from the
   sibling checkout** at `../../../../marketplace-db-setup/migrations`, so the collections carry the real
   `$jsonSchema` validators rather than a hand-written copy; the suite's Redis namespace
   `marketplaceDev:itest:<service>:` exists because the Redis ACL grants exactly that pattern to a
   provisioned test user. A per-repository CI checkout has none of it: not the replica set, not the
   provisioned users, not the sibling repo, not the ACL. Reproducing it is a multi-repository CI topology
   with generated credentials and a datastore bring-up — the item `RISK_REGISTER` R39 carries as CI/CD, and
   a project rather than a step. ⚠️ **The mutation gate, by contrast, is already hermetic by its own
   design**: `vitest.mutation.config.mts` mirrors the `unit` project and excludes `integration` on purpose,
   because Stryker re-runs the suite once per mutant and would otherwise hammer the real replica set
   hundreds of times. The gate everyone assumes is the hard one to move is the one that moves untouched.

## Options considered

| Option | Why not |
|---|---|
| Keep the written procedure, close nothing | It is the status quo R63 describes. The procedure protects a merge only when the person merging remembers it, and the merge button is one click from a phone |
| Forbid Dependabot from opening pull requests, patch by hand | Throws away Dependency-Update-Tool, the advisory surfacing that ADR-054 wanted, and the only automated notice this platform gets that a dependency moved. It also does not close the hole: any pull request, from anyone, merges the same way |
| A GitHub App or bot that runs the hooks on a self-hosted runner on this workstation | The faithful reproduction — the same Docker daemon, the same Qodana, the same everything. It also exposes a workstation to pull-request-triggered execution from any fork, which is the classic self-hosted-runner compromise. Not for a public repository |
| Reproduce every gate including Qodana, with the token in a repository secret | A long-lived JetBrains credential in sixteen public repositories, for the one gate whose findings are already covered by eslint, semgrep and CodeQL between them. ADR-054 refused the same trade for a PAT and the reasoning has not changed |
| One reusable workflow in a shared repository, called by all sixteen | Fewer files, and a new single point of failure that every repository trusts by reference. The platform's own doctrine is byte-identical files that each repository owns — the same argument that keeps sixteen copies of `scorecard.yml` |

## Decision

**1. Every repository carries `.github/workflows/gates.yml`, with one job whose id and name are `gates`.**
⚠️ **The job id is load-bearing**: the branch protection rule on all sixteen repositories names `gates` as
a required status check, by that exact string. Renaming the job disables the gate silently — the check
simply never reports, and on a rule with `strict` off a pull request with no report is not blocked by a
missing one.

**2. Triggers are `pull_request` and `push` on `main`.** The pull request run is the one that answers R63.
The `main` run exists because a direct push by a repository admin still bypasses required checks — see
§Risks — so the gates report on the merge commit as well, and a regression that arrived that way is at
least visible in the Actions tab rather than nowhere.

**3. Six of the eight gates run in the fourteen packages, in the hook's own order** — semgrep, trivy,
lint, types, coverage, mutation — with `permissions: contents: read` and nothing else. The two that do not
are named in the file's header with the reason: **Qodana** stays local-only because it needs a credential
this repository will not hold, and **scorecard** has its own workflow. The file is byte-identical in all
fourteen sub-repo packages. `marketplace-db-setup` declares neither `lint:check` nor `typecheck` (ADR-024
— it has no eslint, no prettier and no TypeScript, because its content is applied migrations), so the
workflow reads `package.json` and skips what a package does not declare rather than forking the file per
repository.

**3a. In the nine services the coverage gate runs as `yarn test:unit`, and that is stated in the file
rather than hidden by it.** ⚠️ **This is not a lowered threshold — it is a different gate with a different
name.** The 100%-on-four-metrics threshold is untouched, `pre-push` still enforces it, and no number
anywhere moved; what CI runs is the same suite minus the one project it cannot host, with both datasources
mocked. The workflow decides by grepping `vitest.config.mts` for `name: 'integration'` — the exact property
that makes a coverage run need datastores — rather than carrying a list of nine service names that would
then have to be kept in step with the fleet. Everywhere else, `yarn test:cov` runs in full: in
`marketplace-common`, whose integration suite is a separate script with its own config and therefore not in
the default run, in `marketplace-db-setup`, in the three apps and in `marketplace-services-status`.

**4. The mutation gate runs here, and this amends the hook-only rule rather than breaking it.** ⚠️ The rule
is, and remains, that **nobody starts `yarn test:mutation` by hand** — not to check a change, not on one
file, not to confirm a survivor is fixed. `pre-push` was its only caller; this job is its second, and it is
a gate, not a hand. The reason for the rule — that a hand-run mutation pass is slow, easy to misread and
leaves `.stryker-tmp` sandboxes behind that the trivy gate then has to skip — applies to a person at a
terminal, not to a throwaway runner. To reproduce a survivor, the answer is unchanged: apply the mutant by
hand in the source and run `yarn test`.

**5. `yarn install --frozen-lockfile`, and no dependency cache.** An install that may rewrite `yarn.lock`
proves nothing about the lockfile under review. ⚠️ **`cache: yarn` is deliberately absent**: a dependency
cache is state one pull request writes and the next reads, which is the one input to a security gate a
contributor could choose. A cold install costs well under a minute against the public registry — the
committed lockfiles carry `registry.npmjs.org` URLs, because `scripts/lockfile-registry-filter.sh` rewrites
the local proxy out on the way into git, so no runner configuration is needed.

**6. `marketplace-nginx` runs its one gate and the parent runs the gates of
`marketplace-services-status`.** nginx carries no `package.json`, so `test/run.sh` — `nginx -t` against the
real files, then a live nginx with stand-in backends — is the whole job, and it needs nothing but the
container engine the runner already has. The parent's workflow sets
`defaults.run.working-directory: marketplace-services-status` and runs five of that directory's seven
gates, because `marketplace-services-status` is a directory of the parent repository and not a sub-repo
(ADR-025): its gates have always lived in the parent's hooks, and they live in the parent's workflow for
the same reason. The workspace documentation the parent also tracks is markdown, gated by review, exactly
as before.

**7. `main` requires the `gates` check, in all sixteen repositories.** `required_status_checks` with
`contexts: ["gates"]` and `strict: false`. Strict is off on purpose: it would demand every pull request be
rebased onto the tip before merging, which on a fleet of sixteen repositories that receive grouped weekly
Dependabot updates is a rebase treadmill with no security value — the check has already run against the
merge result, which is what `pull_request` builds. Everything else about the protection tier is unchanged
from ADR-054: force pushes and deletions blocked, `enforce_admins` false, no required reviews.

## Consequences

### Positive

- **R63 closes**, and it closes at the score it was opened with: the register scores a risk once and a
  disposition is not a level, so 3×4=12 🟠 High stays counted and §4 does not move. The merge button on a
  pull request is disabled until the gates report success, so a Dependabot update can no longer reach `main`
  without semgrep, trivy, lint, types, the test suite and **mutation** having run on it — and mutation is the
  gate that row named as the one a browser merge was most certain to skip and most likely to need, a dev-tree
  bump being the common case. What the row keeps is a residual rather than an open question: Qodana, the
  scorecard floor and the integration half of the nine services' coverage run stay local **by decision**, and
  each of them still fires in `pre-push`, so nothing about them is ungated — only undoubled.
- The platform gains the thing ADR-054 called the right long-term answer, at a cost of one file per
  repository and about two minutes of runner time per pull request.
- Scorecard's Branch-Protection check rises: required status checks are one of the criteria of the tier
  above the one ADR-054 could reach. CI-Tests stops being `-1` — it is the check that looks for exactly
  this, a status check reporting on pull requests. Both floors can be ratcheted again once a run exists,
  which is the sequencing note in §Compliance.
- The gates become reproducible by someone who is not at this workstation. Until now the only way to know
  whether the fleet was green was to have the clone, the Docker daemon, the images and the Qodana token.

### Negative

- Two gates are now in one place and six are in two, so "the gates" is no longer one list. The hook remains
  authoritative — it is the only layer that runs Qodana and the scorecard floor — and the workflow header
  of every repository says which two it does not run and why.
- Sixteen more workflow files to keep pinned. Every `uses:` is a SHA with the tag in a comment, and
  Dependabot's `github-actions` ecosystem now has twice as much to open pull requests about, each of which
  is itself gated by this change.
- A gate that runs twice on the same commits — once locally before the push, once on `main` after it — and
  a green Actions tab is not evidence a push was gated, only that the merge commit was. The opposite
  mistake is also available: a red `main` run on a commit a hook had already passed means the runner and
  the workstation disagree, which is worth knowing and is not the same as a regression.
- Runner minutes are free for public repositories today. Sixteen repositories × grouped weekly Dependabot
  updates is a real, if small, dependency on that continuing to be true.

### Risks

- ⚠️ **A direct push to `main` by a repository admin still runs no server-side gate.** `enforce_admins` is
  false — ADR-054's reason stands: a solo maintainer who locks himself out of his own `main` has bought
  nothing — and required status checks do not apply to an admin push. The local hooks are still the only
  thing standing between this workstation and `main`, and `--no-verify` still removes them. What this
  change gates is the *browser* path, which was the path nothing could gate at all.
- ⚠️ **A required check that never reports blocks every pull request.** If `gates.yml` is renamed, its job
  id changed, or the workflow removed while the protection rule still names `gates`, the rule cannot be
  satisfied and the repository's pull requests are unmergeable until the rule is edited on GitHub. This is
  the intended failure direction — closed, not open — but it is a foot-gun with a non-obvious fix, and it
  is the reason the job id is called out in the file's header and in decision 1.
- Qodana remains local-only, so a pull request merged in the browser has still not been seen by it. Between
  eslint, semgrep and CodeQL, its unique contribution is inspections and the license audit, and the licence
  audit is the part with no substitute.
- ⚠️ **In the nine services, a browser-merged pull request has not run a single integration test, and its
  coverage has not been measured at all.** A change that only an integration test would catch — a validator,
  an index, an encrypted field, a session record in Redis — merges green. So does a change that leaves a new
  line uncovered, because the metric that would notice is the one that needs the datastores. `pre-push`
  catches both on the next push from a clone, which for a repository in maintenance may be weeks later. This
  is the residue R63 keeps, and it is bounded by the same work R39 carries as CI/CD: a datastore bring-up
  with generated credentials and the sibling checkout the migrations are replayed from.
- The runner is Ubuntu with a Docker daemon and the workstation is Debian with the same images pinned by
  digest, so semgrep and trivy are genuinely the same scan. The rest — node from `.nvmrc`, yarn from
  `packageManager` via corepack — is the same version but not the same machine, and a test that depends on
  anything about the host will now fail in exactly one of the two places. That is a feature worth naming:
  it is the first time this platform has had a second opinion about its own suite.

## Compliance

- ⚠️ **The check is named `gates` and nothing may rename it.** The job id, the job name and the
  `required_status_checks.contexts` entry on sixteen repositories are the same string. Changing it is a
  three-place change, and getting it wrong fails closed on every pull request.
- ⚠️ **`yarn test:mutation` is still hook-only for a person.** Its second caller is `gates.yml`. Nobody
  starts it by hand; to reproduce a survivor, apply the mutant in the source and run `yarn test`.
- ⚠️ **Sequencing, and why the floors here are deliberately conservative.** Adding required status checks
  changes what Scorecard measures — `Branch-Protection` rises the moment the rule is applied, and `CI-Tests`
  stops being `-1` once a check has reported on a merged pull request. Both of those happen *after* this
  lands, and the floor gate blocks a push whose measured score is **below** the committed floor: a floor
  raised in the same commit as this workflow would block the very push that carries it. So the floors landed
  alongside this change are the ones measured against the state ADR-054's merge left behind, and they are
  already conservative by the time the protection rule exists. A second raise is owed, not optional, and its
  order is: this landed, a run reported on `main`, the protection rule applied — then re-measure all sixteen
  and raise every floor to the measured value. Never lower one.
- ⚠️ **Do not add `cache: yarn`, and do not add a Qodana token as a repository secret.** Both are recorded
  decisions with a stated reason, and both look like obvious improvements from a distance.
- ⚠️ **Do not move this workflow to a self-hosted runner on this workstation.** A `pull_request` trigger
  plus a self-hosted runner plus a public repository is arbitrary code execution from any fork, and it is
  the reason the faithful reproduction — Qodana included — was refused.
- YAML forbids tabs, so this workflow is indented with spaces, under the same documented exception to
  ADR-024 that ADR-054 recorded for `scorecard.yml`.
- The procedure at the top of every `.github/dependabot.yml` — fetch, check out, install, let the hooks run
  — is **no longer the only thing between a Dependabot pull request and `main`**, but it is still the only
  way Qodana and the scorecard floor see that branch. It stays, with its reason narrowed to those two.
