#!/usr/bin/env bash
#
# Reconcile every project's real environment file against its committed `env` template.
#
# Prints VARIABLE NAMES ONLY — never a value, never a whole line. That is the whole reason this
# exists as a script you run yourself rather than as something an assistant reads: the committed
# template is safe to open, the real file is not, and the difference between the two is exactly the
# information needed to fix a service that will not boot.
#
#   ./scripts/env-diff.sh            # every project
#   ./scripts/env-diff.sh <path>…    # only the given project directories
#
# Two lists per project:
#
#   MISSING  — named by the template, absent from the real file AND from the shared layer. A service
#              whose REQUIRED_ENV_VARS lists one of these refuses to boot with `Missing required
#              environment variable: X`; a test suite missing a MONGO_TEST_* key aborts in
#              globalSetup before collecting a single test, which is why `yarn test:cov` can fail
#              with 100% coverage.
#   SHARED   — named by the template, absent from the real file, and answered by `.env.shared` at
#              the workspace root (ADR-053). Not a fault: the value exists, once, one directory up.
#              Absent entirely when there is no `.env.shared`, which keeps this report identical to
#              what it printed before the layer existed.
#   EXTRA    — present locally, named by no template. Either a key the template forgot to document
#              (fix the template) or a leftover from a rename (delete it locally). Neither is
#              harmless: an undocumented key is one nobody knows to set on the next machine, and a
#              stale one can still be read by code that outlived the rename.
#
# ⚠️ The shared layer is read for its NAMES only, and a name it leaves empty does not count: `.envrc`
# unsets those, so an empty key there answers nothing and the repo is still the only source. That is
# the same rule the loader applies, restated here — the two must agree or this report lies.
#
# Exit status is 0 whether or not differences are found — this is a report, not a gate.

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

# ⚠️ `tr -d ' \t'`, NEVER `tr -d '[:space:]'`: that class contains the newline, so it returns every
# key concatenated into one word and `comm` then compares two single lines — which reports either
# "in sync" or the entire file as both MISSING and EXTRA, and never one wrong key. This function
# shipped with that bug and the reports it printed before 2026-08-31 were meaningless.
keys() { grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z_0-9]*' "$1" | tr -d ' \t' | sort -u; }

# Names the shared layer actually answers: present, and not left empty.
shared_keys() {
	[ -f "$1" ] || return 0
	grep -E '^[[:space:]]*[A-Za-z_][A-Za-z_0-9]*[[:space:]]*=[[:space:]]*[^[:space:]]' "$1" |
		grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z_0-9]*' | tr -d ' \t' | sort -u
}

shared=$(mktemp) && trap 'rm -f "$shared"' EXIT
shared_keys ".env.shared" > "$shared"

if [ "$#" -gt 0 ]; then
	targets=("$@")
else
	targets=(BEs/dev/*/ BEs/marketplace-common BEs/marketplace-db-setup marketplace-services-status marketplace-admin marketplace-shopowner marketplace-user)
fi

for dir in "${targets[@]}"; do
	dir=${dir%/}
	tpl="$dir/env"
	real="$dir/.env"

	[ -f "$tpl" ] || continue

	if [ ! -f "$real" ]; then
		printf '%s\n  no .env at all — copy the template and fill it in: cp %s %s\n\n' "$dir" "$tpl" "$real"
		continue
	fi

	# What the real file lacks, split in two: answered one directory up, or answered nowhere.
	# With no `.env.shared` the layer file is empty, so SHARED is empty and MISSING is the whole
	# set — byte for byte the report this printed before the layer existed.
	from_shared=$(comm -12 <(comm -23 <(keys "$tpl") <(keys "$real")) "$shared" | tr '\n' ' ')
	missing=$(comm -23 <(comm -23 <(keys "$tpl") <(keys "$real")) "$shared" | tr '\n' ' ')
	extra=$(comm -13 <(keys "$tpl") <(keys "$real") | tr '\n' ' ')

	if [ -z "${missing// /}" ] && [ -z "${extra// /}" ] && [ -z "${from_shared// /}" ]; then
		printf '%s\n  in sync (%s keys)\n\n' "$dir" "$(keys "$tpl" | wc -l)"
		continue
	fi

	printf '%s\n' "$dir"
	[ -n "${missing// /}" ] && printf '  MISSING  %s\n' "$missing"
	[ -n "${from_shared// /}" ] && printf '  SHARED   %s\n' "$from_shared"
	[ -n "${extra// /}" ] && printf '  EXTRA    %s\n' "$extra"
	printf '\n'
done
