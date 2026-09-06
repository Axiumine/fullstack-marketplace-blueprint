#!/usr/bin/env bash
#
# Every object in all sixteen object databases, read once, looking for a live secret.
#
#   ./scripts/history-scan.sh
#
# `pre-commit` scans the *staged diff*. That is the right place to stop a secret going in, and it says
# nothing at all about the ones already in — a value committed before the rule existed, or committed
# past it with `--no-verify`, is in the history for good and no working-tree scan will ever see it.
# RISK_REGISTER R14 is that gap, and its own mitigation cell describes this script: *scan every blob,
# not the working tree, before the first push*. It had never been run as an explicit step, which is
# the difference between a mitigation and an intention.
#
# What it reads: `git cat-file --batch-all-objects`, which is every object git holds — reachable or
# not, packed or loose, blobs and commit messages alike. A history rewrite that leaves the old blobs
# dangling is exactly the case a `git log`-based search misses, and it is the case this platform has
# actually been in: `marketplace-db-setup`'s twenty pre-2026-08-08 commits were squashed away because
# they carried real database credentials.
#
# What it blocks on: a match in an object **reachable from a branch or a tag**, because that is what a
# `git push` and a `git clone` carry. A match in a dangling object is printed and does not fail the
# run — it travels with nothing, and the next `git gc` removes it.
#
# The patterns are not written here. They are read out of this workspace's own `.githooks/pre-commit`,
# so there is one list on this platform and not two, and a rule added there is scanned for here on the
# next run without anybody remembering to copy it. The parent's list is the superset of all sixteen —
# `./scripts/audit-check.sh` §8 is what keeps it that way.
#
# It reads. It never writes, never installs, never starts a container, and needs no service running.
#
# Exit 0 = nothing reachable matched. Exit 1 = something did, or the allowlist has gone stale.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

ALLOW_FILE='scripts/history-scan-allow.txt'

FAILED=0

pass() { printf '  ✓ %s\n' "$1"; }
fail() { printf '  ✗ %s\n' "$1"; FAILED=1; }
note() { printf '  · %s\n' "$1"; }

# ---------------------------------------------------------------------------
# The patterns, taken from the hook rather than restated.
#
# `eval` of two `grep`-selected lines out of a tracked file in this repo: the same file git already
# executes on every commit, so this is not a new trust boundary. The floor below is what turns a
# silently-empty pattern — a renamed variable, a reformatted hook — into a loud failure instead of a
# scan that matches nothing and reports success.
# ---------------------------------------------------------------------------
HOOK='.githooks/pre-commit'

if [ ! -f "$HOOK" ]; then
	echo "history-scan: $HOOK is missing — there is no pattern list to scan with." >&2
	exit 1
fi

eval "$(grep '^SECRET_VALUE' "$HOOK")"
eval "$(grep '^PLACEHOLDER' "$HOOK")"

RULE_COUNT="$(grep -c '^SECRET_VALUE' "$HOOK")"

if [ "${RULE_COUNT:-0}" -lt 8 ] || [ -z "${SECRET_VALUE:-}" ] || [ -z "${PLACEHOLDER:-}" ]; then
	echo "history-scan: read $RULE_COUNT secret rules out of $HOOK, which is fewer than this platform has" >&2
	echo '              ever had. Refusing to scan with a list that is probably truncated.' >&2
	exit 1
fi

# Vendored secret-scanner rulesets legitimately contain example secret patterns — the same exemption
# `pre-commit` applies by path, applied here by the path the blob is stored under.
SKIP_PATH='(^|/)(semgrep/vendor|gitleaks|trufflehog|\.gitnexus)/'

REPOS=(.)

while IFS= read -r path; do
	[ -n "$path" ] || continue
	REPOS+=("$path")
done < <(git submodule --quiet foreach 'echo "$displaypath"' 2> /dev/null)

# ---------------------------------------------------------------------------
# The allowlist: one blob per line, `<40-hex sha>  <reason>`.
#
# Keyed on the object name and not on a path or a substring, because an object name *is* its content:
# an entry can never wave through a value other than the exact one somebody read and cleared. Change
# the file and the sha changes with it, so the new blob is scanned again rather than inheriting the
# old blob's exemption.
#
# Checked in both directions, the `coverage-exempt.txt` rule: an entry that matches nothing is a
# failure, not a comment, or the file fills up with names of blobs that were collected years ago.
# ---------------------------------------------------------------------------
declare -A ALLOW=()
declare -A ALLOW_USED=()

if [ -f "$ALLOW_FILE" ]; then
	while IFS= read -r line; do
		line="${line%%#*}"
		sha="${line%%[[:space:]]*}"
		[ -n "$sha" ] || continue

		if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then
			fail "$ALLOW_FILE: '$sha' is not a 40-character object name"
			continue
		fi

		ALLOW["$sha"]=1
	done < "$ALLOW_FILE"
fi

echo
echo "Scanning ${#REPOS[@]} object databases with $RULE_COUNT secret rules"
echo

REACHABLE_HITS=0
DANGLING_HITS=0

for repo in "${REPOS[@]}"; do
	# One pass. The header lines git writes between objects — `<sha> <type> <size>` — are what
	# attributes a matching line to the object it came out of. A line *inside* an object that looks
	# exactly like one of those headers would mislabel the finding; it cannot hide one, which is the
	# only property that matters here.
	#
	# `tr -d '\000'` because the stream carries binary blobs too, and awk stops at a NUL byte.
	HITS="$(
		git -C "$repo" cat-file --batch-all-objects --batch 2> /dev/null \
			| tr -d '\000' \
			| LC_ALL=C awk -v sv="$SECRET_VALUE" -v ph="$PLACEHOLDER" '
				/^[0-9a-f]{40} (blob|commit|tag|tree) [0-9]+$/ { cur = $1; next }
				tolower($0) ~ ph { next }
				$0 ~ sv { print cur "\t" substr($0, 1, 120) }
			' 2> /dev/null \
			| sort -u
	)"

	[ -n "$HITS" ] || continue

	# Only now, and only for a repo that matched, is it worth listing what a push would carry.
	# Branches and tags rather than `--all`: a stash is a ref too, and a stash is pushed by nothing.
	NAMES="$(git -C "$repo" rev-list --branches --tags --objects 2> /dev/null)"

	while IFS=$'\t' read -r sha line; do
		[ -n "$sha" ] || continue

		paths="$(printf '%s\n' "$NAMES" | awk -v s="$sha" '$1 == s { $1 = ""; sub(/^ /, ""); print }')"

		if [ -z "$paths" ]; then
			DANGLING_HITS=$((DANGLING_HITS + 1))
			note "$repo ${sha:0:12} — matches, reachable from no branch or tag, so no push carries it: ${line:0:80}"
			continue
		fi

		# Every path this blob is stored under has to be an exempt one. A ruleset that is also
		# committed somewhere real is not exempt for the copy that is.
		if [ -z "$(printf '%s\n' "$paths" | grep -Ev "$SKIP_PATH" || true)" ]; then
			continue
		fi

		if [ -n "${ALLOW[$sha]:-}" ]; then
			ALLOW_USED["$sha"]=1
			continue
		fi

		REACHABLE_HITS=$((REACHABLE_HITS + 1))
		fail "$repo ${sha:0:12} $(printf '%s' "$paths" | head -n 1) — reachable, and a push carries it"
		printf '        %s\n' "${line:0:100}"
	done <<< "$HITS"
done

for sha in "${!ALLOW[@]}"; do
	[ -n "${ALLOW_USED[$sha]:-}" ] && continue
	fail "$ALLOW_FILE: ${sha:0:12} matches no object in any of the sixteen — delete the line"
done

echo

if [ "$REACHABLE_HITS" -eq 0 ] && [ "$FAILED" -eq 0 ]; then
	pass "no reachable object in any of the ${#REPOS[@]} repos carries a secret this platform knows how to recognise"
	[ "$DANGLING_HITS" -gt 0 ] && note "$DANGLING_HITS dangling match(es) above — informational, nothing pushes them"
	echo
	echo 'history-scan: clean.'
else
	echo 'history-scan: BLOCKED — a secret is in a history that a push would publish.' >&2
	echo '              A rule change cannot remove it. `git filter-repo` can, and is cheap only while' >&2
	echo '              the repo is unpushed; after a push the value is out and rotation is the answer.' >&2
fi

exit "$FAILED"
