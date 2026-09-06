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
#   ./scripts/env-shared-migrate.sh seed --no-ask   # … without the prompt, refusing every disagreement
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
# ── Resolving a disagreement at the prompt ───────────────────────────────────
# On a terminal it offers you that choice instead of only reporting it. What it shows is PROVENANCE,
# never a value: the repo directories behind each distinct value, grouped and counted. That is the
# form of the question a person can actually answer — `marketplace-docker-DBs` defines its own
# `REDIS_PASSWORD` for the optional container `./up.sh --with-redis` starts, which is a different
# server from the cluster the nine services dial, and knowing WHICH REPO a value comes from settles
# it where seeing the value would not.
#
# ⚠️ The pick is not a default and not a preference. The layer is exported and `dotenv` will not
# overwrite an exported variable, so the value chosen becomes the value in EVERY repo, including the
# ones that held the other one — they stop using theirs the moment `.envrc` loads. Skip is the
# default for that reason and leaves every repo exactly as it is. A key that genuinely needs two
# values needs to be OUT of this layer, which is what §What stays behind in `env.shared` records.
#
# ⚠️ And one shape of disagreement has no right answer at all — every repo holding a value no other
# repo holds. That is not a copy somebody edited, it is one resource per repo, and the report names
# it PER-REPO rather than leaving it in DISAGREE. `DSN` is the worked example: a Sentry DSN names one
# project, there is one project per service, and it sat in this layer until 2026-09-02 only because
# the nine committed templates all carry the same placeholder. A key like that leaves the template.
#
# `--no-ask` suppresses the prompt, and so does having no terminal, which is what keeps the script
# usable from a pipe: with no one to ask, a disagreement is reported and omitted exactly as before.
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

# Groups the repos by the value they hold for key $1, in PROJECTS order, and prints one line per
# distinct value: the repo directories holding it, space-separated. Line 1 is the group seed offers
# as `[1]`, so the order is the order of PROJECTS and is the same on every run.
#
# ⚠️ The grouping key is the value's md5, never the value, so that no array in this script ever holds
# a secret a later `printf '%s\n' "${array[@]}"` could spill. The plaintext exists in `$value` for
# one loop iteration and is passed nowhere. md5 is doing equality here, not security.
value_groups() {
	local dir real value digest
	local -A members=()
	local -a order=()

	for dir in "${PROJECTS[@]}"; do
		dir=${dir%/}
		real="$dir/.env"
		[ -f "$real" ] || continue
		has_key "$real" "$1" || continue

		value=$(value_of "$real" "$1")
		[ -n "${value//[[:space:]]/}" ] || continue

		digest=$(printf '%s' "$value" | md5sum | cut -d' ' -f1)

		if [ -z "${members[$digest]+set}" ]; then
			members["$digest"]=$dir
			order+=("$digest")
		else
			members["$digest"]="${members[$digest]} $dir"
		fi
	done

	for digest in "${order[@]}"; do printf '%s\n' "${members[$digest]}"; done
}

# True when every repo that sets $1 holds a value no other repo holds — one group, one repo, all the
# way down.
#
# ⚠️ That pattern is not drift and must not be answered at the prompt. It is what a key that is
# PER-REPO BY NATURE looks like: a project token, a port, a DSN naming one Sentry project per
# service. Drift is n repos sharing m values with m far below n — someone edited one copy. Nine
# repos with nine values is nine resources, and unifying them repoints eight of the nine at the
# ninth's, permanently, because the layer answers first and no repo can override it. Such a key
# belongs in `env.shared` §What stays behind, not in this file.
#
# The reason seed can tell at all is that it measures the real files. The committed templates all
# carry one placeholder, which is exactly how DSN was admitted to the layer in the first place.
all_distinct() {
	local line
	local -a repos=()

	# Its own stdin, so it is safe to call from inside the key loop, whose stdin is the key list.
	while read -r line; do
		read -ra repos <<<"$line"
		[ "${#repos[@]}" -eq 1 ] || return 1
	done < <(value_groups "$1")

	return 0
}

# Puts the groups of key $1 to the person at the terminal and prints the NUMBER of the group they
# chose, or nothing at all if they skipped.
#
# ⚠️ Everything the person sees goes to /dev/tty and the answer is read from it, because the caller's
# stdin is the key list arriving from a process substitution — a plain `read` here would eat the next
# key instead of the answer, and the loop would silently skip it.
ask_which() {
	local answer index noun
	local -a groups=() repos=()

	mapfile -t groups < <(value_groups "$1")

	{
		printf '\n  %s — the repos hold %s different values:\n\n' "$1" "${#groups[@]}"

		for index in "${!groups[@]}"; do
			read -ra repos <<<"${groups[$index]}"
			[ "${#repos[@]}" -eq 1 ] && noun=repo || noun=repos

			printf '    [%s] %s %s\n' "$((index + 1))" "${#repos[@]}" "$noun"
			printf '          %s\n' "${repos[@]}"
		done

		printf '    [s] skip, leave it to the repos  (default)\n\n'
		printf '  ⚠️ What you pick becomes the value in EVERY repo — the layer is exported and cannot\n'
		printf '     be overridden, so the repos holding the other value stop using it.\n\n'

		if [ "$2" -eq 1 ]; then
			printf '  ⚠️ Every one of those repos holds a value no other repo holds. That is not drift,\n'
			printf '     it is what a key that is per-repo BY NATURE looks like — one project, one\n'
			printf '     token, one server PER REPO. Skip it here and take it out of env.shared: no\n'
			printf '     answer to this question is right, including the one that looks tidiest.\n\n'
		fi
	} >/dev/tty

	while true; do
		printf '  take the value from > ' >/dev/tty

		# A closed tty answers EOF, which is a skip: the alternative is a loop nobody can leave.
		read -r answer </dev/tty || {
			printf '\n' >/dev/tty
			return
		}

		case "$answer" in
		'' | s | S) return ;;
		*[!0-9]*) ;;
		*)
			if [ "$answer" -ge 1 ] && [ "$answer" -le "${#groups[@]}" ]; then
				printf '%s' "$answer"
				return
			fi
			;;
		esac

		printf '  not one of the choices.\n' >/dev/tty
	done
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

# ⚠️ Opens /dev/tty rather than testing it with `-r`. The device is mode 0666, so `-r` is true on a
# process with no controlling terminal at all and the prompt would then block on a read nobody can
# answer; opening it is what actually fails (ENXIO), which is the question being asked.
has_tty() { (exec </dev/tty) 2>/dev/null; }

usage() {
	printf 'usage: %s seed [--force] [--ask|--no-ask] | strip [--apply]\n' "$0" >&2
	exit 2
}

[ "$#" -ge 1 ] || usage
cmd=$1
shift

case "$cmd" in
seed)
	force=0
	ask=auto

	while [ "$#" -gt 0 ]; do
		case "$1" in
		--force) force=1 ;;
		--ask) ask=yes ;;
		--no-ask) ask=no ;;
		*) usage ;;
		esac
		shift
	done

	# ⚠️ Decided here, at the top level, and never inside the key loop: that loop's stdin is a process
	# substitution, so `-t 0` inside it answers "not a terminal" on a machine that plainly has one.
	case "$ask" in
	yes)
		has_tty || {
			printf -- '--ask, but there is no terminal to ask at\n' >&2
			exit 1
		}
		interactive=1
		;;
	no) interactive=0 ;;
	*)
		if [ -t 0 ] && [ -t 1 ] && has_tty; then interactive=1; else interactive=0; fi
		;;
	esac

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

	seeded=() skipped=() nowhere=() inert=() inert_disagree=() undetermined=() resolved=() per_repo_keys=()

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
			per_repo=0
			all_distinct "$key" && per_repo=1
			[ "$per_repo" -eq 1 ] && per_repo_keys+=("$key")
			choice=''
			[ "$interactive" -eq 1 ] && choice=$(ask_which "$key" "$per_repo")

			if [ -n "$choice" ]; then
				read -ra chosen <<<"$(value_groups "$key" | sed -n "${choice}p")"
				resolved+=("$key ${chosen[0]}")
				printf '# %s — %s values across the repos; taken from %s, chosen at the prompt\n' "$key" "$count" "${chosen[0]}" >>"$tmp"
				printf '%s=%s\n' "$key" "$(value_of "${chosen[0]}/.env" "$key")" >>"$tmp"
			else
				skipped+=("$key $count")
				printf '# %s — omitted: %s different values across the repos, resolve them first\n' "$key" "$count" >>"$tmp"
			fi
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
	if [ "${#resolved[@]}" -gt 0 ]; then
		printf '\n  RESOLVED AT THE PROMPT — one line each as "<key> <the repo its value came from>":\n'
		printf '     %s\n' "${resolved[@]}"
		printf '     Every other repo now takes that value and can no longer override it. One that\n'
		printf '     needs a different value needs the key OUT of this layer, not a second value in it\n'
		printf '     — env.shared §What stays behind is where that is recorded.\n'
	fi
	if [ "${#skipped[@]}" -gt 0 ]; then
		printf '\n  ⚠️ DISAGREE — omitted, one line each as "<key> <how many distinct values>":\n'
		printf '     %s\n' "${skipped[@]}"
		printf '     The shared layer cannot be overridden, so a guess here is wrong in every repo at\n'
		printf '     once. Make the repos agree, then re-run with --force.\n'
		[ "$interactive" -eq 1 ] ||
			printf '     Nothing was asked: there is no terminal here, or --no-ask. Re-run on one to\n     choose which repo each value comes from.\n'
	fi
	if [ "${#per_repo_keys[@]}" -gt 0 ]; then
		printf '\n  ⚠️ PER-REPO BY THE LOOK OF IT — every repo holds a value no other repo holds:\n'
		printf '     %s\n' "${per_repo_keys[*]}"
		printf '     Drift is many repos sharing few values. One value per repo is many resources —\n'
		printf '     one project, one token, one server EACH — and no answer to that is right: the\n'
		printf '     layer cannot be overridden, so whichever value won would repoint all the others.\n'
		printf '     These belong in env.shared §What stays behind. Delete the key from the template\n'
		printf '     and re-run; each repo keeps its own, which is what it already had.\n'
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
