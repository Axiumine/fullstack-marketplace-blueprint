# ADR-057 — an unpatched, dev-only advisory is accepted in a dated `osv-scanner.toml`, not skipped and not hidden
# Marketplace

**Status:** accepted
**Date:** 2026-10-17
**Deciders:** Giovanni Manzoni, platform owner, in the working session of 2026-10-17, in the instruction *"do An osv-scanner.toml with
ignoreUntil plus an ADR"*. That instruction chose the mechanism and asked for this record; the owner also approved the one
`SKIP_SCORECARD=1` push per repository that landing the first file needs (§Decision 6). The ninety-day expiry and the review it forces
are this ADR's reading of the instruction, set out below so the owner can overrule them.
**Supersedes:** — (nothing. [`ADR-054`](./ADR-054-the-supply-chain-score-is-a-gate-with-a-floor.md) §Compliance gains a dated note
that names this ADR as the documented exception route; its ratchet is not touched.)
**Superseded by:** —

---

## Context

Scorecard's `Vulnerabilities` check runs OSV over the lockfiles of the repository as GitHub holds it, and every open advisory costs it
a point: with one advisory it reads **9**. `.scorecard-floor` in the twelve repositories named below says `Vulnerabilities=10`, and
ADR-054 makes the floor a ratchet that `pre-push` enforces. So when an advisory appears that no upgrade clears, the platform's own gate
turns against its own repositories: a fresh scan reads 9 against a floor of 10, and every push is refused.

That advisory is **GHSA-vfj7-8cjw-p6xm** (CVE-2026-93687), published 2026-09-18, CVSS 8.7: `braces` up to and including **3.0.3**
exhausts the stack on deeply nested patterns. **There is no patched release.** npm's `latest` is 3.0.3 and the advisory's
`last_affected` is 3.0.3, so there is nothing to upgrade to, and ADR-054's remark that every advisory has a patch-level fix — true
when it was written — no longer holds for this one.

Where it lives, measured per repository rather than assumed:

- `braces` is locked at **3.0.3** in twelve repositories: the nine services under `BEs/dev/`, `marketplace-admin`,
  `marketplace-shopowner` and `marketplace-user`. Each `yarn.lock` has exactly one `braces@` entry.
- It is reachable **only through `devDependencies`**. A dependency-path check in each repository walked `yarn.lock` from the
  `package.json` roots to `braces` and found no production and no optional trail. In the services the trails are
  `tsc-alias > chokidar > braces` and `tsc-alias > globby > fast-glob > micromatch > braces`; in `marketplace-shopowner` and
  `marketplace-user` they run through `@graphql-codegen/cli` and `patch-package`. It is a glob-matching library of the lint, build,
  codegen and test toolchain, and it never ships.
- Elsewhere it is absent: `marketplace-common`, `marketplace-db-setup` and `marketplace-services-status` lock no `braces`,
  `marketplace-nginx` ships no JavaScript, and the parent has no lockfile. The file this ADR creates is therefore not wanted there.
- The independent control that keeps that true is the trivy gate (ADR-054 §Context): it scans the **production** tree at HIGH and
  CRITICAL and has been clean everywhere, and a CVSS of 8.7 is HIGH. Trivy does not read `osv-scanner.toml`, so a production trail
  to `braces` would still fail it.

The exposure, stated plainly: a deeply nested pattern handed to a build-time tool can crash that tool's process. It needs
attacker-controlled input to a development or CI process, and no request path reaches it. It is a nuisance, and it is not nothing.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Do nothing and live with the blocked floor gate | No exception, no new file | Twelve repositories cannot push without bypassing the gate, for as long as the advisory has no patch — an unbounded time. ADR-054's own words apply: a gate that is routinely bypassed is worse than none, because it is quoted as if it ran |
| `SKIP_SCORECARD=1` on every push | Nothing to write | **Refused.** ADR-054 reserves it for a Docker, network or GitHub outage and for nothing else. Skipping the gate also skips every other check it grades, so a Branch-Protection drop or a second advisory would pass unseen |
| Lower `Vulnerabilities=10` to 9 in the twelve floors | Unblocks the push | **Refused.** A floor is a ratchet and is never lowered (ADR-054; the workspace rule). It would also hide the next, unrelated advisory, which would sit at 9 as well |
| A `resolutions` override pointing `braces` at a fork or a patched copy | Clears the advisory in the lockfile | **Refused.** No trusted patched source exists: npm has none, and a fork pinned in twelve lockfiles is an unreviewed supply-chain input adopted to defend a development tool against a pattern, in a platform whose Scorecard posture is built on pinned, vetted inputs |
| Remove `micromatch`/`braces` from the toolchain | Removes the exposure | **Not possible.** `braces` is transitive of `fast-glob`, `micromatch` and `chokidar`, which `tsc-alias`, `@graphql-codegen/cli` and `patch-package` pull in; removing it means removing the tools |
| **A root `osv-scanner.toml` with `ignoreUntil`, plus this ADR** | The gate keeps working and stays a ratchet; every other advisory and every other check still counts; the acceptance is a committed file with a reason and a date, and it expires on its own | The score rises without the vulnerability being fixed (§Consequences says how this is kept honest); the expiry needs a review that nothing but a failing gate will prompt |

## Decision

**The last option.** This is an **accepted risk**: the advisory stays in the lockfile, `braces` 3.0.3 stays installed on every
developer machine and CI runner that installs these repositories, and nothing about the code changes. It is not a fix, and it is not
a way of making the number look better — the acceptance is written down, dated and visible.

**1. One `osv-scanner.toml` at the root of each of the twelve repositories**, with one entry and nothing else:

```toml
[[IgnoredVulns]]
id = "GHSA-vfj7-8cjw-p6xm"
ignoreUntil = 2027-01-15
reason = "braces <= 3.0.3 stack exhaustion (CVE-2026-93687); no patched release exists; dev toolchain only, absent from the production tree. ADR-057."
```

A comment block above the entry says why, points at this ADR, and says the entry expires. Every field is required: an entry with no
`ignoreUntil` never expires, and an entry with no `reason` explains nothing.

**2. The expiry is deliberate, and it is ninety days.** 2027-01-15 is 2026-10-17 plus 90 days. No entry may reach further than ninety
days from the day it is written or renewed. An ignore that has no end is not an acceptance, it is a deletion nobody voted for.

**3. What Scorecard does with the file.** `osv-scanner` honours a root `osv-scanner.toml`, and Scorecard v5.5.0's `Vulnerabilities`
check runs `osv-scanner`. Verified locally with the pinned image (`ghcr.io/ossf/scorecard:v5.5.0`, the one `pre-push` runs) in each
of the twelve repositories: `Vulnerabilities` **10** with the file, **9** on a control copy of the same tree without it, and
`osv-scanner scan source -L yarn.lock` printing that the advisory and its alias "have been filtered out". So the published number
moves from 9 to 10 **because the advisory is filtered, not because it is fixed**. The move is visible by design: the file is in the
repository root with its reason, `osv-scanner` says out loud what it dropped, and this ADR and the index list it.

**4. After 2027-01-15 the exception lapses, and the failure is the review.** `osv-scanner` stops ignoring the entry, `Vulnerabilities`
reads 9 on the next scan, and `pre-push`'s floor gate refuses every push in the twelve repositories until someone has looked. Nothing
reminds anyone before that, on purpose: the gate that already exists is the reminder, and `SKIP_SCORECARD=1` is not the answer to it.

**5. What the review consists of**, in order:

1. Is there a patched release? Check `npm view braces version` and the advisory's `last_affected`. If yes, move each lockfile to it —
   by upgrading the chain, or by a `resolutions` pin to the patched release itself, never to a fork — and **delete the file** in the
   same commit. `Vulnerabilities=10` stays in the floor either way.
2. If not, repeat the dependency-path check in each of the twelve. Every trail from a root to `braces` must start at
   `devDependencies`. A trail that starts anywhere else ends the exception for that repository: it needs a fix, not an extension.
3. Confirm the file still names this one advisory and nothing else was added to it.
4. The owner decides, and the decision is written down: renew once more for at most ninety days — a new `ignoreUntil` in the twelve
   files, a dated review note in this ADR's §Compliance and an entry in the index changelog — or let the gate stay red until the
   advisory is fixed. A date moved without that note is a violation.

**6. Landing the first file takes `SKIP_SCORECARD=1`, once per repository: twelve pushes.** The floor gate grades the repository as
GitHub holds it now, and GitHub does not hold the file until it has been pushed, so the push that carries the control is the push the
finding blocks. This is a use of the bypass for a finding, which ADR-054 says it is never for, and it is recorded here as the one
exception for that reason, with the owner's approval. It does not recur: once the file is on `main` the next scan reads 10, which the
floor already says, and ordinary pushes pass the gate without a bypass.

**7. ADR-054 §Compliance gets a dated note** that this is the documented exception route for an unpatched, dev-only transitive
advisory: a file in the repository, a reason, a date within ninety days, and an ADR. The ratchet is unchanged — no number in any
`.scorecard-floor` is lowered by this change.

**Scope.** The route is for **this advisory** and for advisories that meet the same four conditions: no patched release, dev-only
trails, a recorded reason, a date within ninety days. Covering any advisory but this one needs a new ADR that states it; this ADR is
not a general licence.

## Consequences

### Positive
- The floor gate keeps working as a ratchet in the twelve repositories. The floor is not lowered, the bypass does not become routine,
  and a push that fails the gate again will mean something.
- Everything else is still counted. A new advisory on any other package, or on `braces` at a new version, scores as before and
  blocks as before; every other Scorecard check is still graded. Only this identifier is ignored, and only until the date.
- The acceptance is greppable and in the repository: `osv-scanner.toml`, its reason, its date, and a pointer to this ADR from the file.
- The exception cleans up after itself. If nobody acts, the date passes and the gate fails; if a patched release arrives, Dependabot
  security updates are on (ADR-054) and are the likely prompt, and step 1 of the review deletes the file.

### Negative
- **The risk is accepted, not removed.** `braces` 3.0.3 stays installed on developer machines and on the GitHub runners that run
  `gates.yml`. A crafted deeply nested pattern given to one of those processes could crash it.
- **The score rises without a fix.** A reader who sees `Vulnerabilities` 10 on the badge and does not open the repository root sees a
  cleaner posture than exists. The file, the `osv-scanner` message and the index are the mitigation; none of them is on the badge.
- **Twelve bypassed pushes**, one per repository, to land the first file. They are the only ones this ADR authorises.
- **Twelve files to keep in step**, and a calendar date on a one-maintainer project with nothing to remind him but a failing gate.
- A file left behind after `braces` has left a lockfile is harmless but stale; the review deletes it.

### Risks
- ⚠️ **`osv-scanner` owns the file's semantics.** Scorecard's pinned image fixes the `osv-scanner` it ships; a bump of that pin can change
  how `ignoreUntil` is read. Any bump of the pin re-runs the local check (10 with the file, 9 without) before it is committed.
- ⚠️ **A production trail appears later.** A dependency change could make `braces` reachable from shipped code while the file still
  ignores it for Scorecard. The trivy gate on the production tree is the independent control, and it does not read the file; do not
  weaken it on the grounds that `Vulnerabilities` is 10.
- ⚠️ **Copying the pattern.** The next unpatched advisory will be tempting to ignore the same way. The conditions in §Decision are the
  filter, and a second advisory is a new ADR, not a second `[[IgnoredVulns]]` block in the same file.
- The review lands on 2027-01-15 whether or not the maintainer is available. A blocked push on the first working day after the date
  is the expected, intended outcome, not an incident.

## Compliance

```bash
# the file is where braces is locked and nowhere else: braces=1 toml=yes in twelve repositories, braces=0 or empty toml=no in the rest
git submodule foreach -q 'printf "%s braces=%s toml=%s\n" "$sm_path" "$(grep -cE "^\"?braces@" yarn.lock 2>/dev/null)" "$(test -f osv-scanner.toml
&& echo yes || echo no)"'

# each file holds this one advisory with a date: one id line, one ignoreUntil line, a reason line
git submodule foreach -q 'test ! -f osv-scanner.toml || grep -H -E "^(id|ignoreUntil|reason) =" osv-scanner.toml'

# the scanner honours it (run in any of the twelve)
osv-scanner scan source -L yarn.lock        # "GHSA-vfj7-8cjw-p6xm and 1 alias have been filtered out"

# the floor was not lowered
grep '^Vulnerabilities=' .scorecard-floor   # Vulnerabilities=10
```

A violation looks like:

- an `osv-scanner.toml` entry **without `ignoreUntil`**, or **without a `reason`**;
- an `ignoreUntil` **more than ninety days** after the day the entry was written or renewed (2027-01-15 for the original), or one moved
  without a dated review note in this section and an index changelog entry;
- an entry covering an advisory whose trail from a root to the package **starts outside `devDependencies`**;
- an entry covering **any advisory but GHSA-vfj7-8cjw-p6xm** without a new ADR that names it;
- `SKIP_SCORECARD=1` on any push after the twelve that landed the first file, or any number in a `.scorecard-floor` lowered;
- a `resolutions` entry sending `braces`, `micromatch` or `fast-glob` to a fork or a git URL.
