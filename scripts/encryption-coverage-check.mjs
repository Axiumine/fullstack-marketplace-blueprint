#!/usr/bin/env node
/*
 * Prove that the two halves of ADR-029's field encryption still name the same fields.
 *
 *   node ./scripts/encryption-coverage-check.mjs
 *
 * ⚠️ **This is a cross-repo invariant, which is why it is here and not in either repo's suite.**
 * A personal field is encrypted by being in TWO places that cannot see each other:
 *
 *   `BEs/marketplace-common/src/encryption/encryptedFields.mts`   the client-side field map — which
 *                                                                paths CSFLE encrypts, and with which
 *                                                                algorithm
 *   `BEs/marketplace-db-setup/lib/schemas/*.js`                   the server-side `$jsonSchema` — which
 *                                                                paths are declared `binData`
 *
 * `encryptedFields.mts` says so itself: "Adding a personal field to a collection means adding it here
 * *and* declaring it `binData` in `marketplace-db-setup`. Nothing gates that." This is that gate, and
 * it catches both directions of the mistake:
 *
 *   IN THE MAP, NOT binData     the driver writes ciphertext into a field the validator still expects
 *                               to be a string, and every insert fails on a live database — loudly,
 *                               but only once someone runs one.
 *   binData, NOT IN THE MAP     ⚠️ the quiet one, and the reason this exists. The validator asks for
 *                               a blob, the client sends plaintext, the write fails — or, if the
 *                               validator is rebuilt later than the model, the field simply sits in
 *                               the clear and nothing anywhere says so. That is **R48**'s residual
 *                               growing without a commit that mentions it.
 *
 * What it cannot catch is the third mistake, and no program can: a personal field written down in
 * neither place. That one needs a person who knows the field is personal — the `README` in
 * `lib/schemas/` and ADR-029 are where that judgement is recorded.
 *
 * The three shop-owner fields ADR-029 deliberately leaves in the clear — `personalData.firstName`,
 * `personalData.lastName`, `personalData.address.city`, all sorted or prefix-searched by the admin
 * table — are absent from BOTH halves, so they are consistent here and this check says nothing about
 * them. Their trade-off is the ADR's, not this script's.
 *
 * Exit status: 0 when the two halves agree on all four collections, 1 on any disagreement, 2 when a
 * source it needs is missing or unreadable — a missing half is not agreement.
 *
 * ENCRYPTION_CHECK_ROOT points it at another workspace tree, for the self-test.
 */

import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.ENCRYPTION_CHECK_ROOT
	? resolve(process.env.ENCRYPTION_CHECK_ROOT)
	: resolve(dirname(fileURLToPath(import.meta.url)), '..')

const FIELD_MAP = join(ROOT, 'BEs/marketplace-common/src/encryption/encryptedFields.mts')
const SCHEMA_DIR = join(ROOT, 'BEs/marketplace-db-setup/lib/schemas')

/*
 * The four collections CSFLE covers, each with its own DEK. `item` and `itemCategory` are absent
 * because nothing in them is personal — a catalogue entry belongs to a company, not to a person.
 */
const COLLECTIONS = [
	{ name: 'admin', list: 'ENCRYPTED_FIELDS_ADMIN', schema: 'admin.js', validator: 'validatorAdmin' },
	{ name: 'shopOwner', list: 'ENCRYPTED_FIELDS_SHOP_OWNER', schema: 'shopOwner.js', validator: 'validatorShopOwner' },
	{ name: 'user', list: 'ENCRYPTED_FIELDS_USER', schema: 'user.js', validator: 'validatorUser' },
	{ name: 'company', list: 'ENCRYPTED_FIELDS_COMPANY', schema: 'company.js', validator: 'validatorCompany' }
]

const die = message => {
	process.stdout.write(`\n  ✗ ${message}\n\n`)
	process.exit(2)
}

/*
 * The field map is read as text rather than imported: it is TypeScript with path aliases, and
 * building `marketplace-common` to run a check on the parent workspace would make this script
 * depend on a `dist` that may be older than the source it is checking.
 */
const readFieldMap = () => {
	if (!existsSync(FIELD_MAP)) die(`no field map at ${FIELD_MAP}`)

	const source = readFileSync(FIELD_MAP, 'utf8')
	const found = new Map()

	for (const { list, name } of COLLECTIONS) {
		const start = source.indexOf(`export const ${list}`)
		if (start === -1) die(`${list} is not exported by encryptedFields.mts`)

		const end = source.indexOf('\n]', start)
		if (end === -1) die(`${list} has no closing bracket`)

		const paths = [...source.slice(start, end).matchAll(/\{\s*path:\s*'([^']+)'/g)].map(m => m[1])
		if (paths.length === 0) die(`${list} declares no path`)

		found.set(name, paths)
	}

	return found
}

/*
 * Every `binData` leaf in a `$jsonSchema`, as a dotted path. `items` becomes `[]`, which is the
 * notation the field map uses for the driver's own array syntax — `addresses.[].street`.
 */
const binDataPaths = (node, prefix, out) => {
	if (node === null || typeof node !== 'object') return out

	/*
	 * A validator is not always one `$jsonSchema`: `user` and `company` wrap theirs in `$and` next to
	 * the expression-level rules that a `$jsonSchema` cannot state. Those wrappers carry no field name,
	 * so they are walked through without touching the prefix — and a path declared in two branches is
	 * one field, which is why the caller de-duplicates.
	 */
	if (Array.isArray(node)) {
		for (const child of node) binDataPaths(child, prefix, out)
		return out
	}

	for (const key of ['$jsonSchema', '$and', '$or', 'allOf', 'anyOf', 'oneOf']) {
		if (node[key]) binDataPaths(node[key], prefix, out)
	}

	if (node.bsonType === 'binData' && prefix !== '') out.push(prefix)

	if (node.properties && typeof node.properties === 'object') {
		for (const [key, child] of Object.entries(node.properties)) {
			binDataPaths(child, prefix === '' ? key : `${prefix}.${key}`, out)
		}
	}

	if (node.items) binDataPaths(node.items, prefix === '' ? '[]' : `${prefix}.[]`, out)

	return out
}

const readSchemas = () => {
	const require_ = createRequire(import.meta.url)
	const found = new Map()

	for (const { name, schema, validator } of COLLECTIONS) {
		const file = join(SCHEMA_DIR, schema)
		if (!existsSync(file)) die(`no schema at ${file}`)

		let exported
		try {
			exported = require_(file)
		} catch (error) {
			die(`${schema} could not be loaded: ${error.message}`)
		}

		if (typeof exported[validator] !== 'function') die(`${schema} does not export ${validator}()`)

		const built = exported[validator]()
		found.set(name, [...new Set(binDataPaths(built?.validator ?? built, '', []))].sort())
	}

	return found
}

const fieldMap = readFieldMap()
const schemas = readSchemas()

let failed = false
let total = 0

process.stdout.write('\n')

for (const { name } of COLLECTIONS) {
	const declared = [...fieldMap.get(name)].sort()
	const validated = schemas.get(name)

	const missingInSchema = declared.filter(path => !validated.includes(path))
	const missingInMap = validated.filter(path => !declared.includes(path))

	if (missingInSchema.length === 0 && missingInMap.length === 0) {
		process.stdout.write(`  ${name.padEnd(12)} ${String(declared.length).padStart(2)} paths, both halves agree\n`)
		total += declared.length
		continue
	}

	failed = true
	process.stdout.write(`  ✗ ${name.padEnd(10)} the field map and the validator disagree\n`)

	for (const path of missingInSchema) {
		process.stdout.write(`               ${path} is encrypted by the client and not binData in the validator\n`)
	}

	for (const path of missingInMap) {
		process.stdout.write(`               ${path} is binData in the validator and not encrypted by the client\n`)
	}
}

process.stdout.write('\n')

if (failed) {
	process.stdout.write('A field is encrypted in one half and not the other. Every write to it fails on a live\n')
	process.stdout.write('database, and a validator rebuilt after the model leaves it in the clear instead (R48).\n\n')
	process.exit(1)
}

process.stdout.write(`${total} encrypted paths across ${COLLECTIONS.length} collections, named identically in both halves.\n`)
process.stdout.write('What no check can see is a personal field written down in neither — that stays ADR-029\'s.\n\n')
