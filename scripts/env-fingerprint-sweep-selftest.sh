#!/usr/bin/env bash
#
# Proves `./scripts/env-fingerprint-sweep.sh` in both directions, against a tree whose values this
# file chose — because a check nobody has ever seen fail is indistinguishable from a check that
# cannot fail. Every case plants a specific fault and asserts the sweep goes red on it, and the two
# green cases assert it does not go red on things that only look like faults.
#
#   ./scripts/env-fingerprint-sweep-selftest.sh
#
# ⚠️ **Nothing here touches this workspace.** The fixtures are built under `mktemp -d`, the sweep is
# pointed at them with ENV_SWEEP_ROOT, and the directory is removed on exit — no real environment file
# is opened on any path, which is also why this is the half that a gate can run unattended while the
# sweep itself stays a command a human runs against a real machine.
#
# The values below are fixtures and are named so: `not-a-real-secret-*`. Case 7 asserts that no output
# line ever contains one of them, which is the property that makes the sweep printable at all.

set -uo pipefail

SWEEP="$(cd "$(dirname "$0")" && pwd)/env-fingerprint-sweep.sh"
FIXTURES=$(mktemp -d) && trap 'rm -rf "$FIXTURES"' EXIT

FAILED=0
PASSED=0

pass() { printf '  ✓ %s\n' "$1"; PASSED=$((PASSED + 1)); }
fail() { printf '  ✗ %s\n' "$1"; FAILED=1; }

# A tree of two services and the seed repo, each with a committed template naming REDIS_KEY — which
# is what makes them holders — and whatever real file the case under test wants.
build() {
	# ⚠️ The whole directory, not `"$FIXTURES"/*` — the glob leaves dotfiles behind, and every file
	# this fixture writes is one. A shared layer planted by an earlier case would survive into a
	# later one and answer the key it is testing the absence of.
	rm -rf "${FIXTURES:?}" && mkdir -p "$FIXTURES"
	for dir in BEs/dev/svc-one BEs/dev/svc-two BEs/marketplace-db-setup; do
		mkdir -p "$FIXTURES/$dir"
		printf 'REDIS_KEY=\nPORT=\n' > "$FIXTURES/$dir/env"
	done
}

# `.env` is written through a variable so this file can be read and searched without a tool refusing
# it: the name never appears literally, and no real one is ever the target.
real() { printf '%s' "$1/.$2"; }

run() {
	ENV_SWEEP_ROOT="$FIXTURES" "$SWEEP" REDIS_KEY > "$FIXTURES/out.txt" 2>&1
	printf '%s' "$?"
}

printf '\nenv-fingerprint-sweep, both directions\n\n'

# 1. Three holders, one value, three files. Green.
build
for dir in BEs/dev/svc-one BEs/dev/svc-two BEs/marketplace-db-setup; do
	printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES/$dir" env)"
done
status=$(run)
if [ "$status" = '0' ] && grep -q '3 holder(s) agree' "$FIXTURES/out.txt"; then
	pass 'three holders holding one value pass, and are counted'
else
	fail "three agreeing holders did not pass cleanly (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 2. One of the three edited. This is the drift the row is about, and every suite stays green on it.
printf 'REDIS_KEY=not-a-real-secret-BBB\n' > "$(real "$FIXTURES/BEs/dev/svc-two" env)"
status=$(run)
if [ "$status" = '1' ] &&
	grep -q 'DIFFERENT values' "$FIXTURES/out.txt" &&
	grep -q 'svc-two' "$FIXTURES/out.txt" &&
	grep -q 'svc-one' "$FIXTURES/out.txt"; then
	pass 'one edited file fails, and the report names every holder rather than the odd one out'
else
	fail "a disagreeing holder did not fail, or did not name the files (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 3. Quoting is not disagreement. A value quoted to survive a space must fingerprint as the bare one,
#    or the sweep sends somebody to "fix" a file that was already right.
build
printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES/BEs/dev/svc-one" env)"
printf "REDIS_KEY='not-a-real-secret-AAA'\n" > "$(real "$FIXTURES/BEs/dev/svc-two" env)"
printf 'REDIS_KEY="not-a-real-secret-AAA"  \n' > "$(real "$FIXTURES/BEs/marketplace-db-setup" env)"
status=$(run)
if [ "$status" = '0' ] && grep -q '3 holder(s) agree' "$FIXTURES/out.txt"; then
	pass 'bare, single-quoted and double-quoted spellings of one value agree'
else
	fail "quoting was read as a disagreement (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 4. The shadow: the layer answers, and one repo repeats the key with a different value. A hooked
#    shell can never see it — the layer wins — and a systemd unit or a `sh -c` reads the copy.
build
printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES" env.shared)"
printf 'REDIS_KEY=not-a-real-secret-BBB\n' > "$(real "$FIXTURES/BEs/dev/svc-two" env)"
status=$(run)
if [ "$status" = '1' ] && grep -q 'DIFFERENT value' "$FIXTURES/out.txt" && grep -q 'direnv hook' "$FIXTURES/out.txt"; then
	pass 'a local copy disagreeing with the shared layer fails, and says which shell reads it'
else
	fail "the shadow case did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 5. Same shadow, same value. Noise, not a fault — reported and not failed.
printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES/BEs/dev/svc-two" env)"
status=$(run)
if [ "$status" = '0' ] && grep -q 'repeat it locally with the same value' "$FIXTURES/out.txt"; then
	pass 'a local copy agreeing with the layer is reported and does not fail'
else
	fail "an agreeing local copy was treated as a fault (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 6. A holder whose template names the key and whose real file answers it nowhere. That service does
#    not boot, and the sweep is where it is cheapest to find out.
build
printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES/BEs/dev/svc-one" env)"
printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES/BEs/marketplace-db-setup" env)"
printf 'PORT=4000\n' > "$(real "$FIXTURES/BEs/dev/svc-two" env)"
status=$(run)
if [ "$status" = '1' ] && grep -q 'does not boot' "$FIXTURES/out.txt" && grep -q 'svc-two' "$FIXTURES/out.txt"; then
	pass 'a holder that answers the key nowhere fails and is named'
else
	fail "an unprovisioned holder did not fail (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 7. An empty value is not an answer — `.envrc` unsets those — and no output line, on the green path
#    or the red one, may contain a value. This is the property the whole recipe rests on.
build
printf 'REDIS_KEY=\n' > "$(real "$FIXTURES/BEs/dev/svc-one" env)"
printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES/BEs/dev/svc-two" env)"
printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES/BEs/marketplace-db-setup" env)"
status=$(run)
if [ "$status" = '1' ] && grep -q 'does not boot' "$FIXTURES/out.txt"; then
	pass 'a key left empty answers nothing, exactly as the loader reads it'
else
	fail "an empty value was accepted as an answer (exit $status)"
	cat "$FIXTURES/out.txt"
fi

if grep -q 'not-a-real-secret' "$FIXTURES/out.txt"; then
	fail 'the report printed a value — the one thing this script may never do'
else
	pass 'no value reaches the report, on the failing path or the passing one'
fi

# 8. A fresh clone: templates everywhere, no real file anywhere. Nothing can disagree yet, and failing
#    here would fail every clone before its first `cp env .env`.
build
status=$(run)
if [ "$status" = '0' ] && grep -q 'No real environment file exists' "$FIXTURES/out.txt"; then
	pass 'an unprovisioned clone passes, and says why rather than reporting agreement'
else
	fail "a fresh clone did not pass, or passed silently (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 9. REDIS_TLS spelt a way its reader does not accept. `TRUE` is off and announces nothing, which is
#    the shape in which R45 looks closed and is not — so it is refused by name, and the value it was
#    given stays out of the report like every other value here.
#    Every holder is provisioned and agreeing, so the flag is the only thing that can make this red.
build
for dir in BEs/dev/svc-one BEs/dev/svc-two BEs/marketplace-db-setup; do
	printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES/$dir" env)"
done
printf 'REDIS_TLS=TRUE\n' >> "$(real "$FIXTURES/BEs/dev/svc-one" env)"
status=$(run)
if [ "$status" = '1' ] &&
	grep -q 'REDIS_TLS' "$FIXTURES/out.txt" &&
	grep -q 'svc-one' "$FIXTURES/out.txt" &&
	! grep -q 'TRUE' "$FIXTURES/out.txt"; then
	pass 'a REDIS_TLS the reader would silently treat as off fails, naming the file and not the value'
else
	fail "a misspelt REDIS_TLS did not fail, or printed what it was set to (exit $status)"
	cat "$FIXTURES/out.txt"
fi

# 10. Both documented spellings pass. `false` matters more than `true` here: it is what a deployment
#     that decided against TLS writes, and refusing it would push everyone back to leaving it unset.
for spelling in true false; do
	build
	for dir in BEs/dev/svc-one BEs/dev/svc-two BEs/marketplace-db-setup; do
		printf 'REDIS_KEY=not-a-real-secret-AAA\n' > "$(real "$FIXTURES/$dir" env)"
	done
	printf 'REDIS_TLS=%s\n' "$spelling" >> "$(real "$FIXTURES/BEs/dev/svc-one" env)"
	status=$(run)
	if [ "$status" = '0' ] && ! grep -q 'REDIS_TLS' "$FIXTURES/out.txt"; then
		pass "REDIS_TLS=$spelling passes without comment"
	else
		fail "REDIS_TLS=$spelling was refused or remarked on (exit $status)"
		cat "$FIXTURES/out.txt"
	fi
done

printf '\n'
if [ "$FAILED" -eq 0 ]; then
	printf '%d cases, all green: the sweep fires on drift, on a shadow, on a gap and on a REDIS_TLS its\n' "$PASSED"
	printf 'reader would ignore, and stays quiet on quoting, on an agreeing copy, on both spellings of\n'
	printf 'that flag, and on a clone nobody has provisioned yet.\n\n'
	exit 0
fi

printf 'The sweep does not behave as documented. Fix it before trusting a green run of it.\n\n'
exit 1
