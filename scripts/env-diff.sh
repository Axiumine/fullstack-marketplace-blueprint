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
#   MISSING  — named by the template, absent from the real file. A service whose REQUIRED_ENV_VARS
#              lists one of these refuses to boot with `Missing required environment variable: X`;
#              a test suite missing a MONGO_TEST_* key aborts in globalSetup before collecting a
#              single test, which is why `yarn test:cov` can fail with 100% coverage.
#   EXTRA    — present locally, named by no template. Either a key the template forgot to document
#              (fix the template) or a leftover from a rename (delete it locally). Neither is
#              harmless: an undocumented key is one nobody knows to set on the next machine, and a
#              stale one can still be read by code that outlived the rename.
#
# Exit status is 0 whether or not differences are found — this is a report, not a gate.

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

keys() { grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z_0-9]*' "$1" | tr -d '[:space:]' | sort -u; }

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

	missing=$(comm -23 <(keys "$tpl") <(keys "$real") | tr '\n' ' ')
	extra=$(comm -13 <(keys "$tpl") <(keys "$real") | tr '\n' ' ')

	if [ -z "${missing// /}" ] && [ -z "${extra// /}" ]; then
		printf '%s\n  in sync (%s keys)\n\n' "$dir" "$(keys "$tpl" | wc -l)"
		continue
	fi

	printf '%s\n' "$dir"
	[ -n "${missing// /}" ] && printf '  MISSING  %s\n' "$missing"
	[ -n "${extra// /}" ] && printf '  EXTRA    %s\n' "$extra"
	printf '\n'
done
