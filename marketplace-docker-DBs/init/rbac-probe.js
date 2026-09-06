// Proves, against the running replica set, that the role shape in `roles.js` grants what every service
// needs and refuses everything else. Run by ../rbac-probe.sh, which prepends the `const CFG = { … }`
// block and concatenates `roles.js` in front of this file — mongosh has no module system, so the three
// arrive as one script, exactly the way up.sh feeds it provision.js.
//
// ⚠️ **A recipe nobody has executed is a guess.** RISK_REGISTER R24 exists because the privileges under
// the application connection were never verified; answering it with a second unverified table would be
// the same finding with more words. So every claim `roles.js` makes is asserted here in **both**
// directions: the granted operation must succeed AND the ungranted one must come back `Unauthorized`,
// on a throwaway database that is dropped at the end.
//
// CFG carries `phase` ('setup' | 'assert' | 'teardown'), `probeDb`, `probeUser` and `probePwd`.

const PROBE_GRANTED = 'user' // the one collection the probe role is given
const PROBE_DENIED = 'admin' // a collection in the same database that it is not

const UNAUTHORIZED = 13

if (CFG.phase === 'setup') {
	const target = db.getSiblingDB(CFG.probeDb)
	const roleName = roleNameFor(CFG.probeUser)

	// Left behind by an interrupted run. Dropping is idempotent enough: both throw when absent.
	try {
		target.dropUser(CFG.probeUser)
	} catch (e) {} // eslint-disable-line no-empty
	try {
		target.dropRole(roleName)
	} catch (e) {} // eslint-disable-line no-empty
	target.dropDatabase()

	target.createRole({ role: roleName, privileges: privilegesFor(CFG.probeDb, [PROBE_GRANTED]), roles: [] })
	target.createUser({ user: CFG.probeUser, pwd: CFG.probePwd, roles: [{ role: roleName, db: CFG.probeDb }] })

	print('probe: role ' + roleName + ' and user ' + CFG.probeUser + ' created on ' + CFG.probeDb)
}

/*
 * ⚠️ **The two helpers and their tally live at top level, and moving them inside the `assert` block
 * breaks them.** mongosh hoists a block-level function declaration out of its block but leaves the
 * `const` it reads behind, so the first call fails `ReferenceError: failures is not defined` — after
 * seven assertions have already printed `allowed`, which reads exactly like a pass until the exit code
 * is checked. Found by planting a failure and watching the wrong error come back.
 */
const failures = []

/** Runs `work` and records a failure unless it completed. */
function mustAllow(label, work) {
	try {
		work()
		print('  allowed  ' + label)
	} catch (e) {
		failures.push(label + ' — should have been allowed, got: ' + e.message)
		print('  BLOCKED  ' + label + '  <-- unexpected')
	}
}

/**
 * Runs `work` and records a failure unless MongoDB refused it with `Unauthorized`.
 *
 * ⚠️ The code is checked, not just the throw. A privilege table that is merely *wrong* — a typo in a
 * collection name, say — also throws here, and a test that accepts any error would call that a pass.
 */
function mustDeny(label, work) {
	try {
		work()
		failures.push(label + ' — should have been refused, and was not')
		print('  ALLOWED  ' + label + '  <-- unexpected')
	} catch (e) {
		if (e.code === UNAUTHORIZED) {
			print('  refused  ' + label)
		} else {
			failures.push(label + ' — refused with code ' + e.code + ', expected ' + UNAUTHORIZED + ': ' + e.message)
			print('  ERROR    ' + label + '  <-- code ' + e.code + ', expected ' + UNAUTHORIZED)
		}
	}
}

if (CFG.phase === 'assert') {
	const target = db.getSiblingDB(CFG.probeDb)

	print('probe: what the narrow role can do')
	mustAllow('insert into the granted collection', function () {
		target.getCollection(PROBE_GRANTED).insertOne({ _id: 'probe', email: 'probe@example.test' })
	})
	mustAllow('read it back', function () {
		target.getCollection(PROBE_GRANTED).findOne({ _id: 'probe' })
	})
	mustAllow('update it', function () {
		target.getCollection(PROBE_GRANTED).updateOne({ _id: 'probe' }, { $set: { seen: true } })
	})
	mustAllow('delete it', function () {
		target.getCollection(PROBE_GRANTED).deleteOne({ _id: 'probe' })
	})
	// Mongoose's autoCreate issues this on Model.init(); without the privilege every service would need
	// `autoCreate: false`. Granted per resource, so it creates this collection and no other.
	mustAllow('create the granted collection', function () {
		target.createCollection(PROBE_GRANTED)
	})
	// setupFieldEncryption() does both of these at boot, in every one of the eight Mongo services.
	mustAllow('create the key-vault unique index', function () {
		target.getCollection('__keyVault').createIndex({ keyAltNames: 1 }, { unique: true, partialFilterExpression: { keyAltNames: { $exists: true } } })
	})
	mustAllow('insert a data key', function () {
		target.getCollection('__keyVault').insertOne({ _id: 'probeKey', keyAltNames: ['probe'] })
	})

	print('probe: what it cannot')
	mustDeny('read a collection it was not granted', function () {
		target.getCollection(PROBE_DENIED).findOne({})
	})
	mustDeny('write a collection it was not granted', function () {
		target.getCollection(PROBE_DENIED).insertOne({ _id: 'nope' })
	})
	mustDeny('create a collection it was not granted', function () {
		target.createCollection('sevenththing')
	})
	mustDeny('drop the collection it owns', function () {
		target.getCollection(PROBE_GRANTED).drop()
	})
	mustDeny('drop the database', function () {
		target.dropDatabase()
	})
	// The key vault is deliberately insert-and-read: deleting a data key makes every field encrypted
	// under it permanently unreadable.
	mustDeny('delete a data key', function () {
		target.getCollection('__keyVault').deleteOne({ _id: 'probeKey' })
	})

	if (failures.length > 0) {
		print('')
		print('probe FAILED — ' + failures.length + ' of the expectations in roles.js do not hold:')
		failures.forEach(function (line) {
			print('  ! ' + line)
		})
		quit(1)
	}

	print('')
	print('probe OK — every granted operation succeeded and every ungranted one came back Unauthorized.')
}

if (CFG.phase === 'teardown') {
	const target = db.getSiblingDB(CFG.probeDb)

	target.dropUser(CFG.probeUser)
	target.dropRole(roleNameFor(CFG.probeUser))
	target.dropDatabase()

	print('probe: ' + CFG.probeDb + ' dropped, along with its user and role')
}
