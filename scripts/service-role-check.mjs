#!/usr/bin/env node
/*
 * Prove that every service reaches exactly the collections its role in `init/roles.js` grants.
 *
 *   node ./scripts/service-role-check.mjs
 *
 * ⚠️ **This is a cross-repo invariant, which is why it is here and not in any service's suite.** The
 * nine backend services share one `marketplaceRwDev` account whose built-in `readWrite` role is
 * database-scoped, so at the datastore layer each of them can read and write every collection in
 * `dbMarketplaceDev` (RISK_REGISTER R59). The narrow shape that removes it is written down in
 * `marketplace-docker-DBs/init/roles.js` and proved by `rbac-probe.sh`, but minting eight accounts
 * with eight passwords is provisioning work outside these sixteen repos, by ADR-039 and ADR-040.
 *
 * So the table in that file is a promise about code nobody is checking against the code. Its own
 * header says as much: "A new resolver that imports a seventh model widens the service's true surface
 * and this file stays silent about it." This is the thing that stops it being silent.
 *
 * ── What it checks ────────────────────────────────────────────────────────────────────────────────
 *
 *   THE TABLE AGAINST THE CODE  every collection in a service's row is one its `src/` imports a model
 *                               for, and every model its `src/` imports is in the row. Both
 *                               directions: a row that grants too much hands a service a collection
 *                               it never asked for, and a row that grants too little takes the
 *                               service down at first use the day the roles are real.
 *   THE SERVICES WITH NO ROW    `NO_DATABASE_SERVICES` is an assertion that those import zero models,
 *                               not an exemption from being looked at.
 *   THE EIGHT AGAINST THE NINE  every `BEs/dev/marketplace-dev-*` directory is in exactly one of the
 *                               two lists, so a tenth service cannot arrive unlisted.
 *   THE PREMISE ITSELF          no `db.collection(…)`, no `connection.db`, no `getSiblingDB` under
 *                               any service's `src/`. The derivation is only valid while the model
 *                               imports are the whole of a service's reach; the day a raw handle
 *                               appears, every row above becomes a guess and this check says so.
 *
 * ⚠️ **A model import is not proof the collection is used, and this check does not claim it is.** It
 * measures reach — what the process could touch if a resolver asked it to — which is exactly what a
 * datastore role grants. An import left behind by a deleted resolver is a row that should shrink, and
 * saying so is the point rather than a false positive.
 *
 * Exit status: 0 when the table and the code agree, 1 on any disagreement, 2 when a source it needs is
 * missing, unreadable, or no longer declares the tables — an unread half is not agreement.
 *
 * SERVICE_ROLE_CHECK_ROOT points it at another workspace tree, for the self-test.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.SERVICE_ROLE_CHECK_ROOT
	? resolve(process.env.SERVICE_ROLE_CHECK_ROOT)
	: resolve(dirname(fileURLToPath(import.meta.url)), '..')

const ROLES = join(ROOT, 'marketplace-docker-DBs/init/roles.js')
const SERVICES = join(ROOT, 'BEs/dev')

/** Every model lives at this prefix, and a service reaches MongoDB through no other path. */
const MODEL_IMPORT = /marketplace-common\/models\/MongoDB\/([A-Za-z]+)/g

/*
 * The three ways a service could reach a collection without importing a model for it. Each is the
 * raw driver under Mongoose: `connection.db` hands out the `Db`, `db.collection(…)` a collection off
 * it, and `getSiblingDB` another database entirely. None appears in any service today, which is what
 * makes the import list the collection list.
 */
const RAW_DRIVER = [
	{ pattern: /\.connection\.db\b/, what: 'connection.db' },
	{ pattern: /\bdb\.collection\(/, what: 'db.collection(…)' },
	{ pattern: /\bgetSiblingDB\(/, what: 'getSiblingDB(…)' }
]

function die(message) {
	process.stderr.write(`service-role-check: ${message}\n`)
	process.exit(2)
}

/** `1 collection`, `6 collections` — a count that reads as English in the line it lands in. */
function plural(count, noun) {
	return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/** `ItemCategory` is the model, `itemCategory` the collection — Mongoose's own default. */
function collectionOf(model) {
	return model.charAt(0).toLowerCase() + model.slice(1)
}

/**
 * `init/roles.js` is a mongosh script of declarations with no side effects — `rbac-probe.sh` `cat`s it
 * into a shell and calls into it — so evaluating it is how to read the tables without parsing
 * JavaScript with a regex. If the names it declares ever change, the throw below is the failure; a
 * check that quietly measured an empty table would be worse than no check.
 */
function readTables() {
	if (!existsSync(ROLES)) die(`${ROLES} is missing — nothing declares which collections a service may reach`)

	let source
	try {
		source = readFileSync(ROLES, 'utf8')
	} catch (error) {
		die(`${ROLES} cannot be read: ${error.message}`)
	}

	let tables
	try {
		tables = new Function(
			`${source}\nreturn { SERVICE_COLLECTIONS, SERVICE_REPOS, NO_DATABASE_SERVICES }`
		)()
	} catch (error) {
		die(`${ROLES} no longer declares the three tables this check reads: ${error.message}`)
	}

	const { SERVICE_COLLECTIONS, SERVICE_REPOS, NO_DATABASE_SERVICES } = tables

	if (!SERVICE_COLLECTIONS || !SERVICE_REPOS || !Array.isArray(NO_DATABASE_SERVICES)) {
		die(`${ROLES} declares the tables in a shape this check cannot read`)
	}

	return { SERVICE_COLLECTIONS, SERVICE_REPOS, NO_DATABASE_SERVICES }
}

/** Every file under a directory, at any depth. */
function filesUnder(dir) {
	const found = []

	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name)
		if (entry.isDirectory()) found.push(...filesUnder(path))
		else if (entry.isFile()) found.push(path)
	}

	return found
}

/** The models one service imports, and any raw-driver reach that would invalidate the question. */
function readService(repo) {
	const src = join(SERVICES, repo, 'src')

	if (!existsSync(src) || !statSync(src).isDirectory()) {
		die(`${src} is missing — a service named in init/roles.js has no source to derive a role from`)
	}

	const models = new Set()
	const escapes = []

	for (const file of filesUnder(src)) {
		let text
		try {
			text = readFileSync(file, 'utf8')
		} catch (error) {
			die(`${file} cannot be read: ${error.message}`)
		}

		for (const [, model] of text.matchAll(MODEL_IMPORT)) models.add(model)

		for (const { pattern, what } of RAW_DRIVER) {
			if (pattern.test(text)) escapes.push({ file: file.slice(ROOT.length + 1), what })
		}
	}

	return { collections: [...models].map(collectionOf).sort(), escapes }
}

const { SERVICE_COLLECTIONS, SERVICE_REPOS, NO_DATABASE_SERVICES } = readTables()

if (!existsSync(SERVICES)) die(`${SERVICES} is missing — there are no services to check`)

let failed = false

process.stdout.write('\n')

const accounts = Object.keys(SERVICE_REPOS).sort()
const listed = new Set([...accounts.map((account) => SERVICE_REPOS[account]), ...NO_DATABASE_SERVICES])

for (const account of accounts) {
	const repo = SERVICE_REPOS[account]
	const granted = SERVICE_COLLECTIONS[account]

	if (!Array.isArray(granted)) {
		die(`${account} is in SERVICE_REPOS and not in SERVICE_COLLECTIONS — the two tables disagree`)
	}

	const { collections, escapes } = readService(repo)
	const ungranted = collections.filter((collection) => !granted.includes(collection))
	const unused = granted.filter((collection) => !collections.includes(collection))

	for (const escape of escapes) {
		failed = true
		process.stdout.write(`  ✗ ${repo}\n`)
		process.stdout.write(`      ${escape.file} reaches MongoDB through ${escape.what}, not through a model\n`)
	}

	if (ungranted.length === 0 && unused.length === 0) {
		process.stdout.write(`  ${repo.padEnd(50)} ${plural(granted.length, 'collection').padEnd(14)} granted and reached\n`)
		continue
	}

	failed = true
	process.stdout.write(`  ✗ ${repo}\n`)

	for (const collection of ungranted) {
		process.stdout.write(`      reaches ${collection}, which ${account} does not grant\n`)
	}

	for (const collection of unused) {
		process.stdout.write(`      is granted ${collection} and imports no model for it\n`)
	}
}

for (const repo of NO_DATABASE_SERVICES) {
	const { collections, escapes } = readService(repo)

	if (collections.length === 0 && escapes.length === 0) {
		process.stdout.write(`  ${repo.padEnd(50)}  no MongoDB reach, as declared\n`)
		continue
	}

	failed = true
	process.stdout.write(`  ✗ ${repo}\n`)

	for (const collection of collections) {
		process.stdout.write(`      reaches ${collection} and has no account to authenticate as\n`)
	}

	for (const escape of escapes) {
		process.stdout.write(`      ${escape.file} reaches MongoDB through ${escape.what}, not through a model\n`)
	}
}

/*
 * The ninth service is the one nobody remembers to list. A directory in neither table is a service
 * whose reach nothing above measured, which reads exactly like a pass.
 */
const unlisted = readdirSync(SERVICES, { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && entry.name.startsWith('marketplace-dev-'))
	.map((entry) => entry.name)
	.filter((name) => !listed.has(name))
	.sort()

for (const repo of unlisted) {
	failed = true
	process.stdout.write(`  ✗ ${repo}\n`)
	process.stdout.write('      is in neither SERVICE_REPOS nor NO_DATABASE_SERVICES, so nothing here measured it\n')
}

process.stdout.write('\n')

if (failed) {
	process.stdout.write('The table in init/roles.js and the code disagree. Either the row is wrong, or the service\n')
	process.stdout.write('reaches a collection it should not — and on the day those roles are real, the second one is\n')
	process.stdout.write('an Unauthorized at first use rather than a review comment (R59).\n\n')
	process.exit(1)
}

process.stdout.write(
	`${plural(accounts.length, 'service')} match the collections their role grants, ` +
		`${NO_DATABASE_SERVICES.length} of them reaches no database at all, ` +
		'and none reaches one through the raw driver.\n'
)
process.stdout.write('What no check can see is whether those roles were ever provisioned — that is the adopter\'s.\n\n')
