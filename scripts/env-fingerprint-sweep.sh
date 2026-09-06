#!/usr/bin/env bash
#
# Prove that every file which needs a shared value holds the SAME shared value — without putting one
# of them on a terminal.
#
#   ./scripts/env-fingerprint-sweep.sh              # KEYGRIP_KEK, REDIS_PASSWORD, REDIS_KEY
#   ./scripts/env-fingerprint-sweep.sh REDIS_KEY…   # only the keys named
#
# ⚠️ **This is the one failure on the platform that nothing else is looking at.** No test spans two
# repos, so each suite agrees with itself while nine services disagree with each other, and the
# symptoms are quiet by nature: a wrong `REDIS_KEY` finds no session and raises nothing, a wrong
# `KEYGRIP_KEK` signs cookies its siblings cannot verify. `docs/PRODUCTION_HARDENING.md` §4 named the
# gap and prescribed the recipe — `sha256(key + ' ' + value)`, first six hex — and until this script
# there was no implementation of it. ADR-040 declines to choose a secrets manager and says in as many
# words that this sweep is **not** what it declines: it needs no vendor.
#
# **Fingerprint, never print.** Six hex of a digest salted by the key's own name is enough to say
# "these two files agree" and is not the value. Nothing here echoes a line, a value, or a file's
# contents, on any path including the failure paths — the whole point is that it can be run and read
# by anyone, an assistant included, which `./scripts/env-shared-migrate.sh` deliberately cannot be.
#
# Four things are checked per key, and the third is the one that is not obvious:
#
#   HOLDERS    Who needs the key is read from the committed `env` templates, never from a list in this
#              script. The templates keep every key a repo reads, shared ones included, so a new
#              service or a renamed key is picked up here the day its template is.
#   AGREEMENT  Every holder that answers the key from its own environment file must fingerprint
#              identically. This is the classic drift: two machines, one file edited, both suites
#              green.
#   SHADOWS    ⚠️ A holder that repeats a key the shared layer also answers is compared against the
#              layer, and a disagreement there is an error even though a hooked shell can never see
#              it. `dotenv` does not overwrite an exported variable, so the layer wins in a terminal —
#              and a shell without the direnv hook (a systemd unit, a CI step, `sh -c`, an editor task)
#              never loaded the layer and reads the repo copy instead. Same command, two values,
#              decided by which shell started it (ADR-053, `docs/workflow.md` §Environment files).
#   MISSING    A holder that neither the layer nor its own file answers. That service does not boot.
#
# One value is then checked for its spelling rather than its agreement, and it is the only one on the
# platform whose spelling decides anything: `REDIS_TLS` is read as `=== 'true'`, so `TRUE` is off and
# says nothing about it (**R45**). Neither `true` nor `false` is refused by name.
#
# ⚠️ **Quoting is stripped before hashing, and it has to be.** `'abc'` and `abc` are one value to
# dotenv and to direnv, so a sweep that hashed the raw text would report a disagreement between two
# files that agree, and the next person would "fix" the file that was right. An empty value counts as
# no answer, exactly as `.envrc` treats it — it unsets those names, so a blank in the layer falls
# through to the repo rather than blanking it there.
#
# Exit status: 0 when every key is unanimous, 1 when any key disagrees or any holder is unprovisioned.
# ⚠️ **0 is also what a machine holding no real environment file at all prints**, loudly and by name:
# nothing can disagree yet on a fresh clone, and failing there would fail every clone before its first
# `cp env .env`.
#
# ENV_SWEEP_ROOT points the sweep at another tree. It exists for `env-fingerprint-sweep-selftest.sh`,
# which needs a tree whose values it knows; there is no reason to set it by hand.

set -uo pipefail

cd "${ENV_SWEEP_ROOT:-$(dirname "$0")/..}" || exit 1

SHARED_KEYS=(KEYGRIP_KEK REDIS_PASSWORD REDIS_KEY)
[ "$#" -gt 0 ] && SHARED_KEYS=("$@")

PROJECTS=(BEs/dev/*/ BEs/marketplace-common BEs/marketplace-db-setup marketplace-services-status
	marketplace-admin marketplace-shopowner marketplace-user)

LAYER='.env.shared'
FAILED=0
FILES_SEEN=0
TLS_MISSPELT=0

# The value a file answers for one key, quotes stripped, or nothing at all when the file is absent,
# the key unnamed, or the value empty. Last assignment wins, which is what both readers do.
value_of() {
	local file=$1 key=$2 line
	[ -f "$file" ] || return 1

	line=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" | tail -n 1) || return 1
	[ -n "$line" ] || return 1

	line=${line#*=}
	line=${line%$'\r'}
	# Whitespace, then one matching pair of quotes, then whitespace again: a value quoted to protect
	# a space has to fingerprint the same as the same value written bare.
	line=$(printf '%s' "$line" | sed -E "s/^[[:space:]]+//; s/[[:space:]]+$//; s/^'(.*)'$/\1/; s/^\"(.*)\"$/\1/")
	[ -n "$line" ] || return 1

	printf '%s' "$line"
}

# sha256(key + ' ' + value), first six hex — docs/workflow.md §Environment files. The key is inside
# the digest, so the same value under two names fingerprints differently; that is what makes six hex
# safe to print, since it is not a hash of the secret on its own.
fingerprint() {
	printf '%s %s' "$1" "$2" | sha256sum | cut -c1-6
}

printf '\n'

for key in "${SHARED_KEYS[@]}"; do
	holders=()
	prints=()
	labels=()
	missing=()
	shadows_ok=()
	shadows_bad=()

	shared_value=$(value_of "$LAYER" "$key") && shared_print=$(fingerprint "$key" "$shared_value") || shared_print=''

	for dir in "${PROJECTS[@]}"; do
		dir=${dir%/}
		[ -f "$dir/env" ] || continue
		grep -qE "^[[:space:]]*${key}[[:space:]]*=" "$dir/env" || continue

		holders+=("$dir")
		[ -f "$dir/.env" ] && FILES_SEEN=1

		own=$(value_of "$dir/.env" "$key") && own_print=$(fingerprint "$key" "$own") || own_print=''

		if [ -n "$shared_print" ]; then
			# The layer answers. The repo's own copy is dead text on a hooked shell and live on one
			# without the hook, so it is an error when it disagrees and noise when it does not.
			if [ -n "$own_print" ] && [ "$own_print" != "$shared_print" ]; then
				shadows_bad+=("$dir")
			elif [ -n "$own_print" ]; then
				shadows_ok+=("$dir")
			fi
			continue
		fi

		if [ -z "$own_print" ]; then
			missing+=("$dir")
			continue
		fi

		prints+=("$own_print")
		labels+=("$dir")
	done

	if [ "${#holders[@]}" -eq 0 ]; then
		printf '  %-16s no template names it — not a shared key in this workspace\n' "$key"
		continue
	fi

	if [ -n "$shared_print" ]; then
		printf '  %-16s %s  the shared layer, for all %d holders\n' "$key" "$shared_print" "${#holders[@]}"
		[ "${#shadows_ok[@]}" -gt 0 ] &&
			printf '                   · %d holder(s) repeat it locally with the same value: %s\n' \
				"${#shadows_ok[@]}" "${shadows_ok[*]}"
		for dir in "${shadows_bad[@]}"; do
			printf '  ✗ %-14s %s repeats it with a DIFFERENT value — a shell without the direnv hook reads that one\n' \
				"$key" "$dir"
			FAILED=1
		done
		continue
	fi

	unique=$(printf '%s\n' "${prints[@]}" | sort -u | wc -l)

	if [ "${#prints[@]}" -eq 0 ]; then
		printf '  %-16s unprovisioned in all %d holders\n' "$key" "${#holders[@]}"
	elif [ "$unique" -eq 1 ]; then
		printf '  %-16s %s  %d holder(s) agree\n' "$key" "${prints[0]}" "${#prints[@]}"
	else
		printf '  ✗ %-14s %d holders hold %d DIFFERENT values:\n' "$key" "${#prints[@]}" "$unique"
		for i in "${!prints[@]}"; do
			printf '                   %s  %s\n' "${prints[$i]}" "${labels[$i]}"
		done
		FAILED=1
	fi

	for dir in "${missing[@]}"; do
		printf '  ✗ %-14s %s names it in its template and answers it nowhere — that service does not boot\n' \
			"$key" "$dir"
		FAILED=1
	done
done

# ── One flag, whose exact spelling decides whether anything is encrypted ─────────────────────────────
#
# ⚠️ `REDIS_TLS` is read as `process.env.REDIS_TLS === 'true'`, and that exactness is deliberate: a
# truthiness test would hand TLS to every deployment that wrote `false`, and both `docs/architecture.md`
# and **R45** state the accepted spelling. The cost of it is a silent one — `TRUE`, `True`, `1`, `yes`
# and `on` are all *off*, with no warning at boot, so a deployment that believes it encrypted the Redis
# leg is the one shape in which R45 looks closed while being open. Nothing else on this platform looks
# at that value, because the code that reads it lives in `@axiumine/koa-utils` rather than here.
#
# `true` and `false` are the two documented spellings and both pass; unset and empty are the off state
# and pass; anything else is refused by name, on the grounds that it can only be someone trying to say
# one of the two and missing. The value is never printed, like everything else here.
TLS_FLAG='REDIS_TLS'
tls_misspelt=()

for dir in "${PROJECTS[@]}" ROOT_LAYER; do
	[ "$dir" = 'ROOT_LAYER' ] && file=$LAYER || file="${dir%/}/.env"
	flag=$(value_of "$file" "$TLS_FLAG") || continue
	case $flag in
		true | false) ;;
		*) tls_misspelt+=("$file") ;;
	esac
done

if [ "${#tls_misspelt[@]}" -gt 0 ]; then
	for file in "${tls_misspelt[@]}"; do
		printf '  ✗ %-14s %s sets it to neither `true` nor `false` — that reader treats it as off, silently\n' \
			"$TLS_FLAG" "$file"
	done
	FAILED=1
	TLS_MISSPELT=1
fi

printf '\n'

# ⚠️ The fresh-clone exit is deliberately not conditioned on FAILED: on a clone with no real file, every
# holder is MISSING and that is the state this branch exists to forgive. A misspelt flag is the one thing
# it must not forgive, because writing REDIS_TLS at all means someone has provisioned something.
if [ "$FILES_SEEN" -eq 0 ] && [ "$TLS_MISSPELT" -eq 0 ]; then
	printf 'No real environment file exists in this workspace yet, so nothing can disagree.\n'
	printf 'Provision first — SETUP.md §5 — then run this again.\n\n'
	exit 0
fi

if [ "$FAILED" -eq 0 ]; then
	printf 'Every shared value is held identically everywhere it is read.\n'
	printf 'Compare the six-hex prints above with another machine to check the two agree.\n\n'
	exit 0
fi

printf 'A shared value disagrees with itself, or a flag is spelt a way its reader does not accept.\n'
printf 'No suite catches either and no service says so at boot, apart from the two KEYGRIP paths —\n'
printf 'see docs/PRODUCTION_HARDENING.md §1-3 for the first and R45 for the second.\n\n'
exit 1
