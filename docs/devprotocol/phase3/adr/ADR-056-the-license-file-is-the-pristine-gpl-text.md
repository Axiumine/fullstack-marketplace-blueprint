# ADR-056 — the `LICENSE` file is the pristine GPL-3.0 text, and the copyright notice lives in the README
# Marketplace

**Status:** accepted — 2026-10-17, by the merge of this change into `main`, the act this ADR named as its
acceptance; the two supersessions below take effect with it
**Date:** 2026-10-17
**Deciders:** Giovanni Manzoni, platform owner. Proposed in answer to the request to fix the findings of the
OpenSSF Scorecard scan that a change inside the repositories can fix — `License` was the one of them that needed
no GitHub setting and no outside party. The owner then instructed, in the same session, that the change be
committed and merged, that all fifteen sub-repo copies be landed and their pointers bumped in the same parent
commit, and that this ADR and ADR-015 be updated to eighteen of eighteen once they had landed.
**Supersedes:** [`ADR-015`](./ADR-015-common-consumed-by-package-name-unpublished.md) **in part** — one
clause of its §Decision, that the eighteen `LICENSE` copies are identical below their first line, which named
what each copy sits in. The licence (GPL-3.0-or-later), the eighteen locations and the reason the two plain
directories carry a copy are not touched. [`ADR-054`](./ADR-054-the-supply-chain-score-is-a-gate-with-a-floor.md)
**in part** — one clause of its §Compliance, which listed `License` among the owner decisions as a check that
needs a relicensing. It is not one: no relicensing is needed, and the diagnosis behind the clause was wrong.
**Superseded by:** —

---

## Context

Scorecard's `License` check scores **9** for this repository: the published scan of 2026-10-17T05:45:32Z
(Scorecard v5.5.0, commit `a6de025`) shows 9, as the earlier scan of 2026-10-10 did, with the reason
*license file detected* and a Warn detail, *project license file does not contain an FSF or OSI license*. The
check does not read the file. It asks GitHub's `GET /repos/{owner}/{repo}/license` for one answer and scores 9
for any licence file plus 1 when the answer's SPDX id is in its FSF/OSI-approved map, where `GPL-3.0`,
`GPL-3.0-only` and `GPL-3.0-or-later` all are.
GitHub's answer was `NOASSERTION` — key `other`, file `LICENSE` — for this repository and for each of the
fifteen sub-repos, so the one point was never awarded anywhere.

ADR-054's earlier wording of §Compliance saw the symptom and named the wrong cause: it put `License` on the
list of owner decisions as a check that needs a relicensing to an OSI/FSF-recognised text, while observing,
correctly, that the README already claimed GPL-3.0-or-later and GitHub classified the repository as *Other*.
Those two observations are the whole diagnosis: **the licence was always a recognised one, and GitHub could
not recognise the file.** ADR-054's header names this ADR as the correction, and the index's v1.35 entry
records it.

The cause is the file's first nine lines. Every `LICENSE` copy carried a preamble — line 1 naming what the
copy sits in, line 2 the copyright, then the three paragraphs of the GPL's own "how to apply" notice — above
the licence text, and ADR-015 recorded the copies as identical below that first line. GitHub identifies a licence
file with `licensee`, which compares the file with the canonical text and accepts a match only at **98%**
similarity or better. Measured against `licensee` 9.15.3, 9.20.0 and 10.1.0:

| File | Result |
|---|---|
| the `LICENSE` this repository carried (212 lines, 32,724 bytes) | `NOASSERTION` — GPL-3.0 similarity 88.81%, the preamble adding a length delta of 881 characters |
| the same file with the preamble removed (the body GPL text, reflowed, with curly quotes) | `GPL-3.0`, `Exact`, 100% |
| `https://www.gnu.org/licenses/gpl-3.0.txt` untouched (674 lines, 35,149 bytes) | `GPL-3.0`, `Exact`, 100% |
| the canonical text under a single copyright line | `GPL-3.0` at 98.49% (9.15.3) and 98.89% (9.20.0, 10.1.0) |
| the canonical text under only the three notice paragraphs | 90.83%, fails |

The body was never the problem: apart from `(C)` against the copyright sign, `https` against `http` in one
URL, and straight against curly quotes — all of which `licensee` normalises away — it is word-for-word the
FSF's text. Nine lines of identification
are what turned a recognisable file into *Other*.

Two forces keep this from being a one-line fix:

- **The identity line and the notice carry real information.** The line names the directory a copy belongs
  to, which is the point of ADR-015's two plain-directory copies — a directory lifted out of the workspace
  must still say whose it is and under what terms. That information has to land somewhere readers of a
  lifted directory look.
- **The fix has to hold under a matcher this workspace does not control.** GitHub's deployed `licensee`
  version is not published, and its rules differ between releases — in every version tested the length
  delta is a penalty inside the similarity score, and a bigram-confidence floor appears from 9.20.0.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| Keep the preamble, accept `License` 9 | No change; identity and notice stay where ADR-015 put them | `NOASSERTION` on GitHub for sixteen public repos; the licence reads *Other* on every repository page and in every tool that asks the API; the finding never clears |
| Pristine text under **one** copyright line | Keeps a copyright in the file | 98.49% and 98.89% against a threshold of 98 — it passes by tenths of a percent, and one `licensee` release from failing silently |
| **Pristine text, nothing else; the identity line, copyright and notice move to the README's `## License`** | 100% `Exact` in all three `licensee` versions, with no margin to lose; the README is where a reader of a lifted directory already looks, and already held the line `GPL-3.0-or-later — see LICENSE`; no new file | The file no longer says what it sits in; a copy detached from its directory carries the GPL and nothing else |
| Pristine `LICENSE` plus a second file — `NOTICE`, `COPYING`, `COPYRIGHT`, `LICENSE-*` | Keeps the notice beside the licence | `licensee` scores `COPYING`, `COPYRIGHT` and `LICENSE-*` as licence-file candidates, and several candidates can turn GitHub's answer back into *Other*. `NOTICE` is not a candidate, but it duplicates what the README already does |
| Relicense to a different OSI/FSF text | Answers the earlier ADR-054 reading literally | Changes the licence of a public codebase to move a score by one point, when the licence was never the defect |

## Decision

**The third option.** `LICENSE` is the canonical text of the GNU General Public License, version 3, exactly
as published at `https://www.gnu.org/licenses/gpl-3.0.txt` — 674 lines, 35,149 bytes, ASCII, sha256
`3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`. No header, no copyright line, no SPDX
line, no trailing notice. The same bytes in every location ADR-015 names — identical outright, not identical
below a line.

The identity line, the copyright and the three-paragraph notice move into the `## License` section of the
README next to each copy, as prose: `GPL-3.0-or-later — see LICENSE`, then what the directory is, then
`Copyright (c) 2026 Giovanni Manzoni`, then the notice. **"Or later" lives there and in the manifests**
(`"license": "GPL-3.0-or-later"`, the fifteen `qodana.yaml` key lists), because `licensee` identifies a text
and the text has no "or later" — it reports `GPL-3.0`, which Scorecard's map accepts.

Why this and not the single copyright line: 98.89% is a pass today and a bet on a threshold nobody here
owns. The pristine file is not a bet — it is the reference `licensee` compares against.

**What this change lands.** All eighteen copies. Three are replaced in the parent's one commit: `LICENSE`,
`marketplace-docker-DBs/LICENSE` and `marketplace-services-status/LICENSE`, with their three READMEs. The fifteen
sub-repo copies are replaced in one commit each, which also moves the notice into that repo's README; each is
merged into the sub-repo's `main` and pushed, and the same parent commit carries the fifteen pointer bumps
(ADR-031's N+1). `sha256sum` reports the value above for all eighteen, and
`gh api repos/Axiumine/<repo>/license --jq .license.spdx_id` answers `GPL-3.0` for all fifteen sub-repos. The
parent's own answer follows once this commit reaches `main` and GitHub re-detects.

⚠️ **`.scorecard-floor` is not touched by this change.** `License=9` rises to `10` in a separate commit,
after GitHub reports `GPL-3.0` for `main` and a fresh measurement shows 10 — ADR-054's own sequencing. A floor
raised in the same commit would block the push that carries it.

## Consequences

### Positive
- GitHub is expected to recognise the licence: `GET /repos/Axiumine/fullstack-marketplace-blueprint/license`
  is expected to return `GPL-3.0` instead of `NOASSERTION`, and the licence sidebar to stop reading *Other*.
  The parent's `License` is expected to become 10 once the commit is on `main`, GitHub has re-detected and the
  Scorecard workflow has re-run; the published scan reads 9 until then. The fifteen sub-repos already answer
  `GPL-3.0`. The owner decision ADR-054 listed for the check disappears because it was never one.
- The eighteen copies can be compared with one `sha256sum`, which a file identical only below its first line
  never allowed.
- Nothing reads `LICENSE`'s first line. In the parent no hook, script, test or manifest reads the file's content
  (the `licenseRules` key off `package.json`); in the sub-repos only comments in `qodana.yaml` and the link in
  each README's `## License` mention it, and `marketplace-common` ships it in its package. None of them parses
  it — so nothing else changes.

### Negative
- **A `LICENSE` copied out of its directory no longer says where it came from.** The README carries the
  identity, and a lifted directory still brings its README; the file alone does not. ADR-015's reason for the
  two plain-directory copies — a directory must not travel unlicensed — is intact, since the licence text
  travels with it; only the identification moved.
- **The sub-repo fleet cost fifteen commits, fifteen pointer bumps and fifteen `pre-push` runs**, each of them
  the full gate chain for a one-file change (ADR-031, ADR-017). A later change to the licence text would cost
  the same again.
- The README now holds a legal notice and must be kept as the one place it lives.

### Risks
- ⚠️ **`licensee` also reads a README.** Its CLI, and possibly GitHub's matcher, treats a README's License
  section as a second licence file and reduces both to one answer; two different licences become *Other*.
  Measured with 10.1.0 on this README: `LICENSE` is `GPL-3.0` at 100% `Exact`, `README.md` is `GPL-3.0` by
  `Reference` at 90%, and the project is `GPL-3.0` — in the old README as well as the new one. Whether a
  given version looks at the README at all depends on how it is invoked (`detect_readme`), so nothing here
  relies on it either way. The rule that
  follows is that **a `## License` section names the GNU General Public License v3 and no other licence**;
  a sentence there that mentions the LGPL, the AGPL or a permissive licence by name can turn the answer back
  into *Other*.
- GitHub's deployed `licensee` is unknown. Three versions agree on every variant and GitHub's own
  `licenses/gpl-3.0` body equals the gnu.org text, so the risk is low, and the only confirmation is the
  API's answer after the push — it cannot be asked about a draft.
- The effect is invisible until the commit is merged to `main` and pushed, GitHub re-detects (it caches for
  minutes), and the next Scorecard workflow runs; Scorecard grades the repository on GitHub, not a branch.
- A new file named `COPYING`, `COPYRIGHT`, `PATENTS` or `LICENSE-*` in any of the sixteen repos can undo this
  without touching `LICENSE`. Revisit if one is ever wanted.

## Compliance

```bash
# the three copies in this workspace are the canonical text, byte for byte
sha256sum LICENSE marketplace-docker-DBs/LICENSE marketplace-services-status/LICENSE
# 3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986 on all three

# the fifteen sub-repos: the same value fifteen times
git submodule foreach 'sha256sum LICENSE'

# the answer GitHub gives, for each of the sixteen repositories (the check ADR-054's badge reads)
gh api repos/Axiumine/<repo>/license --jq .license.spdx_id    # GPL-3.0
```

A violation looks like:

- a `LICENSE` in any of the eighteen places that is not the canonical bytes — a header, a reflow, a
  copyright line added "to be safe", a trailing "how to apply" notice, a curly quote;
- the copyright, the identity line or the notice written back **into** `LICENSE` rather than the README;
- a second licence-looking file next to a `LICENSE` — `COPYING`, `COPYRIGHT`, `LICENSE-*`;
- a README `## License` section that names a licence other than GPL-3.0-or-later;
- `GET /repos/…/license` answering `NOASSERTION` or `other` for a repository whose `LICENSE` hashes to the
  value above — which means `licensee` changed, and this ADR should be revisited rather than the file
  adjusted by hand;
- `.scorecard-floor` raised to `License=10` before GitHub reports `GPL-3.0` on `main` — or `License` lowered
  at any time.
