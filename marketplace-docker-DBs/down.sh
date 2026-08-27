#!/usr/bin/env bash
#
#   ./down.sh            stop the containers, keep the data
#   ./down.sh --purge    stop them and DELETE the volumes — every database, every user, gone
#
# --purge does not touch secrets/. The CSFLE master key survives on purpose: wiping a dev database
# is routine, and losing that file is not (ADR-029 — the data keys in every __keyVault are encrypted
# under it and there is no escrow). Delete secrets/ by hand if you really mean to start from zero.

set -euo pipefail

cd "$(dirname "$0")"

if docker compose version > /dev/null 2>&1; then
	dc() { docker compose "$@"; }
elif command -v docker-compose > /dev/null 2>&1; then
	dc() { docker-compose "$@"; }
else
	echo "down.sh: neither 'docker compose' nor 'docker-compose' is available." >&2
	exit 1
fi

PURGE=0
for arg in "$@"; do
	case "$arg" in
		--purge) PURGE=1 ;;
		-h | --help)
			sed -n '2,8p' "$0"
			exit 0
			;;
		*)
			echo "down.sh: unknown argument '$arg' — try --help." >&2
			exit 2
			;;
	esac
done

if [ "$PURGE" -eq 1 ]; then
	printf 'down.sh: this deletes dbMarketplaceDev, every test database and every user. Type PURGE to confirm: '
	read -r answer
	if [ "$answer" != 'PURGE' ]; then
		echo 'down.sh: aborted, nothing was removed.'
		exit 1
	fi
	dc --profile redis down --volumes
	echo 'down.sh: containers and volumes removed. secrets/ was left alone.'
else
	dc --profile redis down
	echo 'down.sh: containers stopped, volumes kept. `./up.sh` brings it all back.'
fi
