# ADR-054 — the supply-chain score is published by a workflow and floored in `pre-push`
# Marketplace

**Status:** accepted
**Date:** 2026-09-20
**Deciders:** platform owner, in the instruction that opened the work — *"we need to integrate this in all
our repositories: https://scorecard.dev/"* — and in four scoping answers given the same day: the mechanism
is *"Action + local gate"*, the scope is *"wire + full remediation"*, the GitHub settings are to be
*"applied"* rather than handed over as a plan, and the threshold is *"floor at achieved score"*.
**Supersedes:** —
**Superseded by:** —

---

## Context

OpenSSF Scorecard grades a repository's supply-chain posture from the outside: it reads the GitHub API and
the tree, runs eighteen checks, and returns each as a score from 0 to 10 or as `-1` for *did not apply*.
The aggregate is the weighted mean over the checks that scored zero or better — `-1` drops out of both the
numerator and the denominator, so a repository with no releases is not punished for Signed-Releases, it is
simply not asked. Weights are four tiers: critical 10, high 7.5, medium 5, low 2.5.

Nothing on this platform had ever been measured that way. Before deciding anything, every one of the
sixteen repositories was scanned:

| Repos | Aggregate | What carried it |
|---|---|---|
| 13 — the parent, `marketplace-common`, `marketplace-admin`, `marketplace-shopowner`, and all nine `marketplace-dev-*` | **1.4** | Binary-Artifacts 10, License 9, Vulnerabilities 0 |
| `marketplace-db-setup`, `marketplace-user` | **1.6** | the same, with Vulnerabilities above 0 |
| `marketplace-nginx` | **2.6** | the same, plus no JavaScript to find advisories in |

The failure pattern was identical everywhere and is worth stating plainly, because it is not a story about
sloppiness: Branch-Protection, CII-Best-Practices, Code-Review, Contributors, Dependency-Update-Tool,
Fuzzing, Maintained, SAST and Security-Policy all scored **0**, and CI-Tests, Dangerous-Workflow,
Packaging, Pinned-Dependencies, Signed-Releases and Token-Permissions all scored **-1**. Six checks were
unscored because there were no workflows, no pull requests and no releases to look at. The nine zeros were
not regressions — they were the shape of a platform whose entire gate layer is local git hooks on one
workstation, with no CI, no branch protection, no pull request ever opened and no release ever cut. ⚠️ All
sixteen repositories **are** public on GitHub under `Axiumine`, with `main` as the default branch, and all
sixteen were pushed the same morning this measurement was taken — which is the only reason the measurement
was possible at all, and which retires the asymmetry the ADR index had recorded on 2026-09-06, when
`git ls-remote origin` still returned no refs in fifteen of the sixteen (`RISK_REGISTER` R36).

Two findings from the measurement changed the design, and both would have been invisible from the
documentation alone:

1. **The CLI never fails on a low score.** `ghcr.io/ossf/scorecard` exits 0 whatever it measures. There is
   no `--threshold`, no `--fail-on`, no `--min-score` in any version. A non-zero exit means the scan could
   not run. Any gate built on `$?` would therefore be a gate that passes always.
2. **Scorecard's SAST check matches tool *names*, not evidence.** Its detector looks for
   `github/codeql-action/analyze`, `snyk/actions/*`, `facebook/pysa-action`, `JetBrains/qodana-action`,
   `hadolint/hadolint-action`, a `sonar-project.properties`, or one of a handful of app slugs on a check
   run. **There is no semgrep entry and no generic "a SARIF file was uploaded" path.** The semgrep gate in
   `pre-push` — vendored rules, pinned image, offline, blocking — earns exactly zero.

Also measured, because the Vulnerabilities check reads worse than it is: the **production** dependency tree
is clean at HIGH and CRITICAL in every repository, which is what the trivy gate has been asserting all
along. Every advisory Scorecard reports is in the development toolchain, and Scorecard's OSV check has
neither a dev/prod split nor a severity floor. All sixteen affected packages have patch-level fixes.

## Options considered

| Option | Why not |
|---|---|
| The Action alone — publish the score, show the badge | A number nobody has to keep is a dashboard, not a gate. The platform's own rule is that coverage and mutation may never be lowered; a posture score with no floor is weaker than everything around it |
| A local gate alone | The badge and the public API are the point of `publish_results`, and a posture that is never published cannot be compared with anyone else's. It also leaves Scorecard's own checks — pinned actions, token permissions, dangerous workflows — with no workflow file to grade |
| A local gate with a fixed target, say 7.0 | It fails sixteen repositories on the day it lands and teaches everyone to pass `SKIP_SCORECARD=1`. A gate that is routinely bypassed is worse than no gate, because it is quoted as if it ran |
| A CI pipeline reproducing every local gate, with required status checks | Honest and the right long-term answer, and far past the scope of this work. It would duplicate seven gates, need self-hosted Docker and a Qodana token in the cloud, and the platform's doctrine is that the hooks *are* the gate layer. Deliberately not built — and §Risks records the hole that leaves |
| Give semgrep a workflow so SAST scores | Zero credit for the reason above, a duplicate of a gate that already blocks, and the offline rule-provenance guarantee would have to be rebuilt in a `run:` step. CodeQL is added instead, because it is one of the names the matcher knows |

## Decision

**1. Every repository carries `.github/workflows/scorecard.yml`, byte-identical in all sixteen.** Triggers
are `push` on `main` and a weekly `schedule`, which is the whole supported trigger set for
`publish_results`. `permissions: read-all` at workflow level with only `security-events: write` and
`id-token: write` on the job, because `publish_results` refuses a workflow-level write. Every `uses:` is
pinned to a full commit SHA with the tag in a trailing comment: Scorecard's own Pinned-Dependencies check
reads this file. `publish_results: true` mints the public badge and the `api.scorecard.dev` entry through
OIDC.

**2. The score is floored in `pre-push`, in all sixteen repositories.** The floor lives in a committed
`.scorecard-floor`: one `aggregate=` line and one `Name=value` line per check. Per-check lines and not
just the aggregate, because a repository can hold its aggregate while Branch-Protection silently falls to
0 — some other check having risen by as much. The gate runs the pinned image
`ghcr.io/ossf/scorecard:v5.5.0@sha256:3f24714e9366917adb7a05635382c97dfecb14b21eaef3dfa2ea48c8e23e0795`,
parses the JSON itself, and never consults the exit status for a verdict. Its own comparison exits 3 for
*below the floor* so that a crash in the comparison can never be reported as a finding in the repository.

**3. The floor is set to what each repository actually scored, and may only ratchet upwards.** Raising a
number is a normal commit; lowering one is the thing the gate exists to prevent. This mirrors the coverage
and mutation rule exactly — a push that needs a threshold lowered needs a control restored instead.

**4. The gate is third, or second, never last, and it says out loud what it is not.** Every other gate
reads the working tree. This one asks the GitHub API about the repository *as GitHub holds it right now*
and cannot see the commits being pushed — there is no mode that makes it. It therefore sits directly after
the other supply-chain gates (semgrep and trivy — trivy alone in `marketplace-db-setup` until its semgrep
step landed on 2026-09-20; the configuration suite in `marketplace-nginx`) and ahead of the expensive honest gates, so that a posture regression costs
six seconds rather than ten minutes of mutation testing. Its banner and its block message both state the
limit rather than implying a diff was graded.

**5. A missing prerequisite blocks.** No docker, no daemon, no image, no token, no interpreter, no floor
file, an origin that is not GitHub: each is a block with a fix line, never a warning that steps aside. The
token comes from `GITHUB_AUTH_TOKEN`, then `SCORECARD_TOKEN`, then `gh auth token`, and is passed to the
container through the environment — never printed, never written to a file. Unauthenticated is refused
outright: the API allows 60 requests an hour and the scan cannot finish. `SKIP_SCORECARD=1` exists for a
Docker, network or GitHub outage and for nothing else. `marketplace-nginx` gains its first bypass variable
this way, and its header says why.

**6. The companion work Scorecard grades is done in the same change**, because wiring a measurement
without moving what it measures is theatre: `SECURITY.md` in all sixteen (private vulnerability reporting
preferred, a published contact address, response times, scope); `.github/dependabot.yml` in all sixteen
(npm and github-actions, weekly, grouped dev toolchain, `@axiumine/marketplace-common` never auto-bumped
because moving a consumer's range is step 9 of the nine-step release in ADR-037 and ADR-047);
`.github/workflows/codeql.yml` in the fifteen repositories that ship JavaScript; and the Scorecard badge
at the top of all sixteen READMEs — the first badge this platform has ever carried.

**7. `marketplace-nginx` and the two parent-repo directories are treated as what they are.** nginx gets no
CodeQL workflow (it ships no JavaScript, so SAST and Fuzzing are structurally 0 there) and a
github-actions-only Dependabot file. `marketplace-services-status` and `marketplace-docker-DBs` get no
badge of their own: they are directories of the parent repository (ADR-025, ADR-031), they have no
independent score, and a badge implying otherwise would be a false claim. The parent's Dependabot file
covers them by directory.

**8. The GitHub settings the fourth decision asked for are applied, in all sixteen, on the day of this
ADR.** Branch protection on `main`: force pushes blocked, deletions blocked, `enforce_admins` false, no
required reviews and no required status checks — there are none to require. Dependabot alerts and
Dependabot security fixes on. Secret scanning and its push protection on. **Private vulnerability
reporting on**, because `SECURITY.md` names it as the preferred channel and a document that points at a
disabled feature is a false instruction. Deliberately **not** enabled: CodeQL *default setup*, which would
fight the `codeql.yml` this change ships.

## Consequences

### Positive

- A number that was never measured is now measured, published, and defended. The aggregate cannot fall
  and no individual check can fall, in any of the sixteen repositories, without a push being refused.
- The engineering-only ceiling was computed against the real weights and validated by reproducing the
  `marketplace-nginx` baseline exactly: **~7.4** for a typical repository once this change lands, **~8.2**
  once each repository has ninety days of history for Maintained. `marketplace-nginx` reaches 6.3 and then
  7.1, and cannot go higher without JavaScript to analyse.
- Dependabot closes Dependency-Update-Tool and, more usefully, surfaces the sixteen dev-tree advisories
  the trivy gate deliberately ignores as out of the production tree.
- Pinned-Dependencies, Token-Permissions and Dangerous-Workflow stop being `-1` and start being scored,
  which is the difference between "not asked" and "answered well".

### Negative

- The only gate on the platform that needs the network, and the only one whose subject is not the working
  tree. A GitHub outage becomes a blocked push, recoverable only by `SKIP_SCORECARD=1`.
- Three gate counts changed in sixteen hook files — seven gates became eight, six became seven, four
  became five, one became two — which meant renumbering every `[N/M]` marker and every prose reference to
  a gate by number. Several of those references were already stale before this change and are corrected
  here; the risk of a stale number is now higher, not lower, because there are more of them.
- The floor files committed with this change are the **pre-merge** baselines: 1.4, 1.6 and 2.6. They defend
  today's posture and nothing more. The real floors can only be measured after these workflows exist on
  `main`, which is the platform owner's decision to merge — the sequencing is in §Compliance.
- Six of the eighteen checks cannot be moved by engineering at all. They need rulings, not commits, and
  they are listed in §Compliance rather than silently left at 0.

### Risks

- ⚠️ **A Dependabot pull request merged in the browser has passed nothing.** Every gate this platform has
  lives in `.githooks/`, wired by `core.hooksPath`, which is git config local to a real clone. Dependabot
  never clones locally and never runs `prepare`; merging from the GitHub UI is a server-side operation
  with no local git process anywhere in the path. With no CI and no required status checks, nothing stops
  that merge. **No `dependabot.yml` field can fix this** — only branch protection with required checks
  backed by a real pipeline, which this change does not build. Until it exists the procedure is mandatory
  and is written at the top of every `dependabot.yml`: fetch the branch, check it out, `yarn install`, let
  `pre-commit` and `pre-push` run for real, and merge only then.
- The gate grades remote state, so it can block a push for something no commit caused: a protection rule
  switched off, an action tag that moved, an advisory published overnight. That is a true finding about
  the repository and a confusing one about the push. The block message opens by saying so.
- Branch protection is applied at a deliberately conservative tier — force pushes and deletions blocked,
  `enforce_admins` false, no required reviews — because a solo maintainer with required reviews on a repo
  with no second maintainer is locked out of his own `main`. Scorecard scores that tier well below the
  maximum, and that is the accepted trade.
- CodeQL is now the thing that earns the SAST score while semgrep is the thing that actually blocks. The
  two must not be confused: deleting the semgrep gate because "SAST is green" would remove the only SAST
  that has ever stopped a push. The CodeQL workflow's header says this in the file.

## Compliance

- The gate is in `.githooks/pre-push` in all sixteen repositories, and `.scorecard-floor` beside it.
  ⚠️ **Never lower a value in a floor file**, exactly as with a coverage or mutation threshold.
- ⚠️ **Sequencing.** Scorecard grades the default branch on GitHub. Until this branch is merged to `main`
  by the platform owner and pushed, the workflows do not exist as far as the API is concerned and the
  floors cannot be raised past the baselines committed here. The order is: merge, push, wait for the first
  workflow run, re-measure all sixteen, raise every floor to the measured value in one commit per repo.
- ⚠️ **Six checks are owner decisions, not engineering work, and are recorded here so that nobody
  implements one silently.** Packaging and Signed-Releases would replace the manual nine-step `yarn upload`
  release of ADR-037 and ADR-047 with a workflow — a reversal of two accepted ADRs, not a chore.
  License 9→10 needs relicensing to an OSI/FSF-recognised text, and note that the README already claims
  GPL-3.0-or-later while GitHub classifies the repository as *Other*. Branch-Protection above the applied
  tier and any real Code-Review credit need a genuine second maintainer. Contributors needs contributors
  from outside organisations and is the reason the true ceiling is ~9.7 rather than 10.
  CII-Best-Practices needs a `bestpractices.dev` registration. Fuzzing credit for JavaScript exists only
  for `fast-check` — Jazzer.js and ClusterFuzzLite earn nothing — so it is a real property-testing effort,
  estimated at two to four weeks fleet-wide, or a stub that games the detector.
- ⚠️ **`gcr.io/openssf/scorecard` is dead** — the project's billing is disabled and it answers 403 — and
  most published examples still name it. The live image is `ghcr.io/ossf/scorecard`. Note that
  `ghcr.io/ossf/scorecard-cli` and the `:stable` tag do not exist either.
- ⚠️ **Never run `--local` mode as the gate.** Seven of the eighteen checks are structurally absent
  without the API, and it needs `-u "$(id -u):$(id -g)"` to avoid failing on `.gitnexus/gitnexus.json`. A
  scan that cannot see two thirds of the subject is not a cheaper scan.
- ⚠️ **The badge and the local gate may disagree about Branch-Protection, legitimately.** The workflow
  authenticates with the repository-scoped `GITHUB_TOKEN`, which cannot read every branch-protection
  setting; the local gate authenticates with `gh auth token`, an admin credential that can. A lower
  Branch-Protection score on `scorecard.dev` than in `.scorecard-floor` is that difference and not a
  regression. The floor is measured and enforced locally; `publish_results` publishes what CI can see. Do
  not "fix" the disagreement by putting a personal access token in a repository secret — that trades a
  cosmetic number for a long-lived credential in sixteen public repositories.
- YAML forbids tabs, so the workflow and Dependabot files are indented with spaces. This is the one
  documented exception to ADR-024, which is about eslint and prettier over JavaScript and TypeScript; the
  same prettier run still formats these files, and `yarn lint:check` passes in all thirteen linted repos.
