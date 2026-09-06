#!/usr/bin/env bash
#
# Proves `./scripts/runnable-source-check.mjs` in both directions, against a two-package tree this
# file writes — because a check that has only ever been run on a workspace where everything is
# already declared is indistinguishable from one that prints "declared" unconditionally.
#
#   ./scripts/runnable-source-check-selftest.sh
#
# ⚠️ **Nothing here touches this workspace.** The fixture is a `mktemp -d` tree holding two packages
# and an exemption list, the check is pointed at it with RUNNABLE_SOURCE_CHECK_ROOT, and the tree is
# removed on exit. That is what lets a gate run this half unattended while the check itself reads the
# real fifteen packages.
#
# ⚠️ **The fixture is a git repository, and has to be.** "A source file" means a file git tracks:
# that is what keeps `node dist/out.mjs` out of the count while `node tools/build.mjs` is in it, and
# a fixture where everything is untracked would pass every case by checking nothing. Nothing is ever
# committed — `git add` fills the index, and `git ls-files` reads the index.

set -uo pipefail

CHECK="$(cd "$(dirname "$0")" && pwd)/runnable-source-check.mjs"
FIXTURES=$(mktemp -d) && trap 'rm -rf "$FIXTURES"' EXIT

FAILED=0
PASSED=0

pass() {
	printf '  ✓ %s\n' "$1"
	PASSED=$((PASSED + 1))
}
fail() {
	printf '  ✗ %s\n' "$1"
	FAILED=1
}

# The green tree: two packages, seven runnable files between them, three of them gated by a
# coverage.include glob and four declared by name — one of those four in the package's own
# coverage-exempt.txt and three in the workspace list.
#
# One package sits at `BEs/dev/`, the other at the root, so two of the three places a package may
# live are exercised and `BEs/` exists as the third. ⚠️ All three have to exist: the check exits 2
# when one is missing rather than checking the packages it can still see, because a `BEs/dev` that
# vanished would take nine of the fifteen packages out of the count in silence.
build() {
	rm -rf "${FIXTURES:?}" && mkdir -p "$FIXTURES/scripts"
	mkdir -p "$FIXTURES/BEs/dev/alpha"/{scripts,src,lib,tools,bin} "$FIXTURES/beta"/{scripts,src}

	# The file whose presence is what makes a directory a gated package.
	printf '// the file-count gate, fixture copy\n' > "$FIXTURES/BEs/dev/alpha/scripts/coverage-audit.mjs"
	printf '// the file-count gate, fixture copy\n' > "$FIXTURES/beta/scripts/coverage-audit.mjs"

	printf 'export const one = 1\n' > "$FIXTURES/BEs/dev/alpha/src/index.mjs"
	printf 'export const two = 2\n' > "$FIXTURES/BEs/dev/alpha/lib/entry.mjs"
	printf 'process.exit(0)\n' > "$FIXTURES/BEs/dev/alpha/tools/build.mjs"
	printf 'process.exit(0)\n' > "$FIXTURES/BEs/dev/alpha/bin/cli.mjs"
	printf 'export const three = 3\n' > "$FIXTURES/beta/src/app.ts"

	cat > "$FIXTURES/BEs/dev/alpha/package.json" <<-'JSON'
		{
		  "name": "alpha",
		  "main": "lib/entry.mjs",
		  "bin": { "alpha": "./bin/cli.mjs" },
		  "scripts": {
		    "dev": "ts-node-dev --respawn --transpile-only src/index.mjs",
		    "start": "node dist/out.mjs",
		    "tool": "node tools/build.mjs",
		    "test:cov": "vitest run --coverage && node scripts/coverage-audit.mjs"
		  }
		}
	JSON

	cat > "$FIXTURES/beta/package.json" <<-'JSON'
		{
		  "name": "beta",
		  "scripts": {
		    "start": "node src/app.ts",
		    "probe": "npx tsx src/app.ts",
		    "test:cov": "vitest run --coverage && node scripts/coverage-audit.mjs"
		  }
		}
	JSON

	cat > "$FIXTURES/BEs/dev/alpha/vitest.config.ts" <<-'TS'
		export default { test: { include: ['test/**/*.test.mjs'], coverage: { include: ['src/**/*.mjs', 'lib/**/*.mjs'] } } }
	TS

	cat > "$FIXTURES/beta/vitest.config.ts" <<-'TS'
		export default { test: { coverage: { include: ['src/**/*.ts'] } } }
	TS

	# beta declares its gate script the way marketplace-db-setup does: in its own list, because its
	# source roots reach `scripts/`. alpha's roots do not, so alpha's copy is declared in the
	# workspace list below — the two spellings of one decision, and the check accepts either.
	printf 'scripts/coverage-audit.mjs\n' > "$FIXTURES/beta/coverage-exempt.txt"

	cat > "$FIXTURES/scripts/runnable-exempt.txt" <<-'TXT'
		# fixture
		BEs/dev/alpha/scripts/coverage-audit.mjs
		BEs/dev/alpha/tools/build.mjs
		BEs/dev/alpha/bin/cli.mjs
	TXT

	git -C "$FIXTURES" init -q 2> /dev/null
	git -C "$FIXTURES" add -A 2> /dev/null

	# Written after the index is filled, so it is a build product rather than a source file — the
	# distinction the whole "tracked" rule exists to draw.
	mkdir -p "$FIXTURES/BEs/dev/alpha/dist" && printf 'built\n' > "$FIXTURES/BEs/dev/alpha/dist/out.mjs"
}

run() {
	RUNNABLE_SOURCE_CHECK_ROOT="$FIXTURES" node "$CHECK" > "$FIXTURES/out.txt" 2>&1
	printf '%s' "$?"
}

printf '\nrunnable-source-check, both directions\n\n'

# 1. Everything gated or declared, and `node dist/out.mjs` counted as neither — it is not tracked,
#    so it is a build product of a file that is gated already rather than a source file of its own.
build
status=$(run)
if [ "$status" = '0' ] &&
	grep -q '7 runnable source files across 2 gated packages — 3 gated by coverage.include, 4 declared by name' "$FIXTURES/out.txt"; then
	pass 'a fully declared workspace passes, and untracked build output is not counted'
else
	fail "the green tree did not pass, or was miscounted (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 2. The failure this check exists for: a file package.json runs, gated by nothing, named nowhere.
#    Green in its own repo's suite and in its own coverage audit, for as long as it exists.
build
sed -i '/tools\/build.mjs/d' "$FIXTURES/scripts/runnable-exempt.txt"
status=$(run)
if [ "$status" = '1' ] &&
	grep -q 'BEs/dev/alpha/tools/build.mjs is run by package.json and no coverage.include glob reaches it' "$FIXTURES/out.txt"; then
	pass 'a runnable file no glob reaches and no list names fails, and is named'
else
	fail "an ungated runnable file did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 3. The quiet direction: a line for a file that is gated now. Left in place it holds the hole open
#    for whatever lands at that path next, which is exactly how the first hole survived.
build
printf 'beta/src/app.ts\n' >> "$FIXTURES/scripts/runnable-exempt.txt"
status=$(run)
if [ "$status" = '1' ] &&
	grep -q 'beta/src/app.ts is gated by coverage.include now' "$FIXTURES/out.txt"; then
	pass 'a line naming a file that is gated now fails as stale'
else
	fail "a stale exemption for a gated file did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 4. One decision in two places drifts: change the reason in one and the other still says the old one.
build
printf 'beta/scripts/coverage-audit.mjs\n' >> "$FIXTURES/scripts/runnable-exempt.txt"
status=$(run)
if [ "$status" = '1' ] &&
	grep -q 'is declared in beta/coverage-exempt.txt already' "$FIXTURES/out.txt"; then
	pass 'a file declared in both lists fails rather than counting twice'
else
	fail "a doubly declared file did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 5. A line for a file nothing runs any more — the script was deleted or the command was rewritten.
build
printf 'BEs/dev/alpha/tools/ghost.mjs\n' >> "$FIXTURES/scripts/runnable-exempt.txt"
status=$(run)
if [ "$status" = '1' ] &&
	grep -q 'BEs/dev/alpha/tools/ghost.mjs is not a runnable tracked file of a gated package any more' "$FIXTURES/out.txt"; then
	pass 'a line for a file nothing runs fails as stale'
else
	fail "a stale exemption for a vanished file did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 6. A glob would exempt whatever lands beside the file next, in silence — the failure the exact-path
#    rule exists to close, and a mistake in the list itself rather than in the workspace.
build
printf 'BEs/dev/alpha/tools/*.mjs\n' >> "$FIXTURES/scripts/runnable-exempt.txt"
status=$(run)
if [ "$status" = '2' ] && grep -q 'is a glob' "$FIXTURES/out.txt"; then
	pass 'a glob in the exemption list is refused outright'
else
	fail "a glob was accepted (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 7 and 8. The unread halves. A package whose config cannot be found, and a config that gates
#    nothing, are both "this check could not answer" rather than "everything is fine" — the whole
#    point of exit 2 being a separate status.
build
rm "$FIXTURES/beta/vitest.config.ts"
status=$(run)
if [ "$status" = '2' ] && grep -q 'beta has no vitest config' "$FIXTURES/out.txt"; then
	pass 'a package with no vitest config is an unread half, not a pass'
else
	fail "a missing vitest config did not exit 2 (exit $status)"
	cat "$FIXTURES/out.txt"
fi

build
printf 'export default { test: { coverage: { reporter: [] } } }\n' > "$FIXTURES/beta/vitest.config.ts"
status=$(run)
if [ "$status" = '2' ] && grep -q 'beta sets no coverage.include' "$FIXTURES/out.txt"; then
	pass 'a config that gates nothing is an unread half, not a pass'
else
	fail "a missing coverage.include did not exit 2 (exit $status)"
	cat "$FIXTURES/out.txt"
fi

build
rm "$FIXTURES/scripts/runnable-exempt.txt"
status=$(run)
if [ "$status" = '2' ] && grep -q 'runnable-exempt.txt is missing' "$FIXTURES/out.txt"; then
	pass 'a missing exemption list is an unread half, not an empty one'
else
	fail "a missing exemption list did not exit 2 (exit $status)"
	cat "$FIXTURES/out.txt"
fi

printf '\n%s passed, %s\n\n' "$PASSED" "$([ "$FAILED" -eq 0 ] && printf 'none failed' || printf 'AT LEAST ONE FAILED')"
exit "$FAILED"
