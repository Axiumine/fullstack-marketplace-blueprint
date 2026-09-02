#!/usr/bin/env bash
#
# Move the shared keys out of sixteen real environment files and into one (ADR-053).
#
# ⚠️ YOU RUN THIS, NOT AN ASSISTANT. It is the only script in this workspace that reads values out
# of a real `.env` and writes them somewhere else. It prints VARIABLE NAMES ONLY — never a value,
# never a whole line, not even in a diff — and that is the whole reason it exists as a script rather
# than as a sequence of edits somebody performs by hand with the files open.
#
#   ./scripts/env-shared-migrate.sh seed            # build .env.shared from what the repos already have
#   ./scripts/env-shared-migrate.sh strip           # show which lines WOULD be removed  (dry run)
#   ./scripts/env-shared-migrate.sh strip --apply   # remove them, leaving a .env.bak beside each file
#
# Run them in that order, and read the seed report before stripping.
#
# ── seed ─────────────────────────────────────────────────────────────────────
# Takes the key NAMES from the committed `env.shared` template, collects each one's value from every
# repo's `.env`, and writes `.env.shared` — but only for a key whose value is IDENTICAL everywhere it
# appears. A key the repos disagree on is left out and reported by name with the count, because
# guessing which repo is right is exactly the R04 failure this layer exists to prevent, and the
# shared layer cannot be overridden: a wrong value seeded here is a wrong value in fifteen repos at
# once. Resolve the disagreement in the repos first, then seed again.
#
# ── Keys that only one branch of the platform reads ──────────────────────────
# Not every key is read on every machine. `REDIS_URL` names the server on the single-node branch and
# is never looked at once `REDIS_IS_CLUSTER` is `1`, where the three `REDIS_DB*` pairs name the
# nodes instead — the guard each service boots with is
# `env.REDIS_IS_CLUSTER !== '1' && !env.REDIS_URL`, in its `src/index.mts`.
#
# `env.shared` states that with a line this script parses and nothing else does:
#
#     #! active-when   <KEY>=<VALUE> <NAME>…     the named keys are read only while KEY holds VALUE
#     #! active-unless <KEY>=<VALUE> <NAME>…     … only while it holds anything else
#
# A key whose condition does not hold is reported INERT rather than NO VALUE. The distinction is the
# point of the report: on a cluster, an empty `REDIS_URL` is the correct state and an empty
# `KEYGRIP_KEK` is a service that will not boot, and a report that prints them on the same line as
# the same word is a report nobody re-reads. It cuts the other way too — on the single-node branch
# the six `REDIS_DB*` keys go INERT and an empty `REDIS_URL` is named as the hole it is.
#
# The condition's own key is resolved from the repos like any other value. If they disagree about
# it, the branch is unknown, every key it governs is reported as if it were active, and the report
# says so: guessing which branch a machine is on is the same class of error as guessing a value.
#
# ── strip ────────────────────────────────────────────────────────────────────
# Removes, from each repo's `.env`, the assignment lines for keys `.env.shared` actually answers —
# present AND non-empty, the same rule `.envrc` applies when it unsets the blanks. It refuses to
# strip a key whose repo value differs from the shared one, by name, because that repo would silently
# start using a different server the moment the line went away. Being INERT is not an exemption: a
# key the repos agree on is shared whichever branch happens to read it, so it is carried into the
# layer and stripped like any other. Only one with no agreed value to carry stays out of the strip
# set, and it stays out for the ordinary reason — the layer answers it with nothing.
#
# ⚠️ The committed `env` templates are NEVER touched. They document what a service reads, which is a
# different question from where the value comes from, and a service's own template is the only place
# the first question has a complete answer. `./scripts/env-diff.sh` reports a stripped key as SHARED.
#
# Exit status is 0 unless the arguments are wrong or a write fails.

set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

TEMPLATE=env.shared
TARGET=.env.shared

PROJECTS=(BEs/dev/*/ BEs/marketplace-common BEs/marketplace-db-setup marketplace-services-status marketplace-admin marketplace-shopowner marketplace-user marketplace-docker-DBs)

# ⚠️ `tr -d ' \t'`, never `tr -d '[:space:]'` — that class contains the newline and returns every key
# concatenated into a single word. `scripts/env-diff.sh` carried that bug for months.
key_names() { grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z_0-9]*[[:space:]]*=' "$1" | tr -d ' \t=' | sort -u; }

# Raw text after the FIRST `=` of the first assignment of $2 in file $1. Never printed by this script.
value_of() { sed -nE "s/^[[:space:]]*$2[[:space:]]*=//p" "$1" | head -n 1; }

has_key() { grep -qE "^[[:space:]]*$2[[:space:]]*=" "$1"; }

# Every non-empty value the repos carry for key $1, deduplicated. One line means they agree; more
# than one is the disagreement seed refuses to resolve; none means nobody sets it. Never printed.
distinct_values() {
	local dir real

	for dir in "${PROJECTS[@]}"; do
		real="${dir%/}/.env"
		[ -f "$real" ] || continue
		has_key "$real" "$1" || continue
		value_of "$real" "$1"
	done | grep -v '^[[:space:]]*$' | sort -u
}

# ── The `#!` conditions ───────────────────────────────────────────────────────
# CONDITION maps a governed key to `<when|unless>|<key>|<value>`; RESOLVED caches the one agreed
# value of a conditioning key, or the empty string when the repos do not agree on one. The cache is
# what keeps this to one pass over the repos per conditioning key rather than one per governed key.
declare -A CONDITION=()
declare -A RESOLVED=()

read_conditions() {
	local directive pair names sense key

	# `_` swallows the literal `#!`; the grep guarantees every line reaching here starts with one.
	while read -r _ directive pair names; do
		case "$directive" in
		active-when) sense=when ;;
		active-unless) sense=unless ;;
		*) continue ;;
		esac

		# `$names` is deliberately unquoted — it is the whitespace-separated list of governed keys.
		for key in $names; do CONDITION["$key"]="$sense|${pair%%=*}|${pair#*=}"; done
	done < <(grep -E '^#![[:space:]]+active-(when|unless)[[:space:]]' "$1")
}

# The single value every repo that sets $1 agrees on, or nothing at all when they disagree.
effective() {
	local values

	if [ -z "${RESOLVED[$1]+set}" ]; then
		values=$(distinct_values "$1")

		if [ "$(printf '%s' "$values" | grep -c .)" = 1 ]; then
			RESOLVED["$1"]=$values
		else
			RESOLVED["$1"]=''
		fi
	fi

	printf '%s' "${RESOLVED[$1]}"
}

# `active`, or `inert <conditioning key>`, or `unknown <conditioning key>` — whether the platform
# reads $1 on the branch this workspace is on. An ungoverned key is always active.
state_of() {
	local raw=${CONDITION[$1]:-} sense cond want actual

	[ -n "$raw" ] || {
		printf 'active'
		return
	}

	IFS='|' read -r sense cond want <<<"$raw"
	actual=$(effective "$cond")

	if [ -z "$actual" ]; then
		printf 'unknown %s' "$cond"
	elif [ "$sense" = when ] && [ "$actual" != "$want" ]; then
		printf 'inert %s' "$cond"
	elif [ "$sense" = unless ] && [ "$actual" = "$want" ]; then
		printf 'inert %s' "$cond"
	else
		printf 'active'
	fi
}

usage() {
	printf 'usage: %s seed [--force] | strip [--apply]\n' "$0" >&2
	exit 2
}

[ "$#" -ge 1 ] || usage
cmd=$1
shift

case "$cmd" in
seed)
	force=0
	[ "${1:-}" = "--force" ] && force=1

	[ -f "$TEMPLATE" ] || {
		printf 'no %s in this directory — run this from anywhere, it cd-s to the workspace root itself\n' "$TEMPLATE" >&2
		exit 1
	}

	if [ -f "$TARGET" ] && [ "$force" -eq 0 ]; then
		printf '%s already exists. Move it aside, or re-run with --force to overwrite it.\n' "$TARGET" >&2
		exit 1
	fi

	read_conditions "$TEMPLATE"

	tmp=$(mktemp) && trap 'rm -f "$tmp"' EXIT

	{
		printf '# Generated by scripts/env-shared-migrate.sh seed — see env.shared for what each key is.\n'
		printf '# Every value below was already identical in every repo that carries the key.\n\n'
	} >"$tmp"

	seeded=() skipped=() nowhere=() inert=() inert_disagree=() undetermined=()

	while read -r key; do
		[ -n "$key" ] || continue

		distinct=$(distinct_values "$key")
		count=$(printf '%s' "$distinct" | grep -c .)
		read -r state cond <<<"$(state_of "$key")"

		if [ "$state" = unknown ]; then
			undetermined+=("$key $cond")
		fi

		# Nothing on this machine reads it, so neither a hole nor a disagreement can misconfigure
		# anything: a value the repos agree on is carried through so that flipping the branch does
		# not lose it, and anything less is left blank. Flip the branch, re-seed, and the key lands
		# in SEEDED, NO VALUE or DISAGREE like any other.
		if [ "$state" = inert ]; then
			inert+=("$key")

			if [ "$count" = 1 ]; then
				printf '# %s — not read while %s says so; value carried through from the repos\n' "$key" "$cond" >>"$tmp"
				printf '%s=%s\n' "$key" "$distinct" >>"$tmp"
			else
				[ "$count" -gt 1 ] && inert_disagree+=("$key")
				printf '# %s — not read while %s says so; nothing carried through\n' "$key" "$cond" >>"$tmp"
				printf '%s=\n' "$key" >>"$tmp"
			fi

			continue
		fi

		case "$count" in
		0)
			nowhere+=("$key")
			printf '%s=\n' "$key" >>"$tmp"
			;;
		1)
			seeded+=("$key")
			printf '%s=%s\n' "$key" "$distinct" >>"$tmp"
			;;
		*)
			skipped+=("$key $count")
			printf '# %s — omitted: %s different values across the repos, resolve them first\n' "$key" "$count" >>"$tmp"
			;;
		esac
	done < <(key_names "$TEMPLATE")

	mv "$tmp" "$TARGET" && chmod 600 "$TARGET"
	trap - EXIT

	printf 'wrote %s (mode 600)\n\n' "$TARGET"
	[ "${#seeded[@]}" -gt 0 ] && printf '  SEEDED    %s\n' "${seeded[*]}"
	[ "${#nowhere[@]}" -gt 0 ] && printf '  NO VALUE  %s\n            no repo sets one. Left empty, therefore inert — .envrc unsets these and each\n            repo keeps its own\n' "${nowhere[*]}"
	if [ "${#inert[@]}" -gt 0 ]; then
		printf '  INERT     %s\n' "${inert[*]}"
		printf '            not read on the branch this machine is on — see the `#!` line above each\n'
		printf '            in env.shared. Empty is the CORRECT state here, not a hole. Change the\n'
		printf '            branch and re-seed and they are reported like every other key.\n'
		[ "${#inert_disagree[@]}" -gt 0 ] &&
			printf '            (%s: the repos disagree, so nothing was carried through. Harmless while\n            it stays inert, a DISAGREE the moment the branch changes.)\n' "${inert_disagree[*]}"
	fi
	if [ "${#skipped[@]}" -gt 0 ]; then
		printf '\n  ⚠️ DISAGREE — omitted, one line each as "<key> <how many distinct values>":\n'
		printf '     %s\n' "${skipped[@]}"
		printf '     The shared layer cannot be overridden, so a guess here is wrong in every repo at\n'
		printf '     once. Make the repos agree, then re-run with --force.\n'
	fi
	if [ "${#undetermined[@]}" -gt 0 ]; then
		printf '\n  ⚠️ BRANCH UNDETERMINED — one line each as "<key> <the key that decides it>":\n'
		printf '     %s\n' "${undetermined[@]}"
		printf '     The repos disagree about the deciding key, so which branch this machine is on is\n'
		printf '     not knowable and the keys above were reported as if they were read. Make the\n'
		printf '     repos agree on it, then re-run with --force.\n'
	fi
	printf '\nNext: check it, then `cp envrc .envrc && direnv allow`, then `%s strip`.\n' "$0"
	;;

strip)
	apply=0
	[ "${1:-}" = "--apply" ] && apply=1

	[ -f "$TARGET" ] || {
		printf 'no %s yet — run `%s seed` first\n' "$TARGET" "$0" >&2
		exit 1
	}

	# Only the keys the layer actually answers: present AND non-empty, the rule .envrc applies.
	mapfile -t SHARED < <(grep -E '^[[:space:]]*[A-Za-z_][A-Za-z_0-9]*[[:space:]]*=[[:space:]]*[^[:space:]]' "$TARGET" |
		grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z_0-9]*' | tr -d ' \t' | sort -u)

	[ "${#SHARED[@]}" -gt 0 ] || {
		printf '%s answers no key — nothing to strip\n' "$TARGET" >&2
		exit 1
	}

	[ "$apply" -eq 1 ] || printf 'DRY RUN — nothing is written. Re-run with --apply.\n\n'

	for dir in "${PROJECTS[@]}"; do
		dir=${dir%/}
		real="$dir/.env"
		[ -f "$real" ] || continue

		remove=() conflict=()

		for key in "${SHARED[@]}"; do
			has_key "$real" "$key" || continue

			if [ "$(value_of "$real" "$key")" = "$(value_of "$TARGET" "$key")" ]; then
				remove+=("$key")
			else
				conflict+=("$key")
			fi
		done

		[ "${#remove[@]}" -eq 0 ] && [ "${#conflict[@]}" -eq 0 ] && continue

		printf '%s\n' "$dir"
		[ "${#remove[@]}" -gt 0 ] && printf '  REMOVE    %s\n' "${remove[*]}"
		if [ "${#conflict[@]}" -gt 0 ]; then
			printf '  ⚠️ KEPT   %s\n' "${conflict[*]}"
			printf '            this repo disagrees with the shared value. Removing the line would\n'
			printf '            silently repoint it — decide which is right before stripping these.\n'
		fi

		if [ "$apply" -eq 1 ] && [ "${#remove[@]}" -gt 0 ]; then
			cp -p "$real" "$real.bak" || exit 1

			for key in "${remove[@]}"; do
				sed -i -E "/^[[:space:]]*$key[[:space:]]*=/d" "$real" || exit 1
			done

			printf '  written, previous file kept as %s.bak\n' "$real"
		fi

		printf '\n'
	done

	# `if`, not `[ … ] && printf`: that form is the last command of the branch, so a dry run — where
	# the test is false — made the whole script exit 1 and report a failure it had not had.
	if [ "$apply" -eq 1 ]; then
		printf 'Now: ./scripts/env-diff.sh — every removed key should read SHARED, none MISSING.\n'
	fi
	;;

*) usage ;;
esac
