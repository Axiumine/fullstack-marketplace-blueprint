#!/usr/bin/env bash
#
# An authenticated, interactive mongosh against the replica set.
#
#   ./shell.sh              as the root user, on admin
#   ./shell.sh dev          as marketplaceRwDev on the dev database
#   ./shell.sh owner        as marketplaceOwnerDev on the dev database
#
# The password is handed to the container as an environment variable and only interpolated INSIDE
# it, so it never appears in a host process line — `ps` on this machine shows the literal $MP_PWD.

set -euo pipefail

cd "$(dirname "$0")"

[ -f .env ] || {
	echo 'shell.sh: no .env here — see README.md.' >&2
	exit 1
}

set -a
# shellcheck disable=SC1091
. ./.env
set +a

if docker compose version > /dev/null 2>&1; then
	dc() { docker compose "$@"; }
else
	dc() { docker-compose "$@"; }
fi

case "${1:-root}" in
	root) authdb='admin' user="$MONGO_ROOT_USER" secret="$MONGO_ROOT_PWD" ;;
	dev) authdb="$MONGO_DEV_DB" user="$MONGO_DEV_URW" secret="$MONGO_DEV_PWD" ;;
	owner) authdb="$MONGO_DEV_DB" user="$MONGO_DEV_UDBOWNER" secret="$MONGO_DEV_PWD" ;;
	*)
		echo "shell.sh: unknown role '$1' — root | dev | owner." >&2
		exit 2
		;;
esac

# --shell keeps the REPL open after --eval has run, with `db` already switched and authenticated.
dc exec \
	-e MP_AUTHDB="$authdb" -e MP_USER="$user" -e MP_PWD="$secret" \
	db1 sh -c 'exec mongosh --shell --quiet \
		--eval "db = db.getSiblingDB(\"$MP_AUTHDB\"); db.auth(\"$MP_USER\", \"$MP_PWD\")" \
		"mongodb://db1:27017,db2:27018,db3:27019/?replicaSet=rs0"'
