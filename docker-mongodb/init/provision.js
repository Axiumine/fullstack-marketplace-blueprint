// Creates every database user the platform expects. Run by ../up.sh through mongosh, authenticated
// as the root user, against the replica set as a whole.
//
// up.sh prepends a `const CFG = { … }` block built from .env, because mongosh exposes no `process`
// and therefore no environment. This file is never run on its own.
//
// Idempotent by design: it is re-run on every `./up.sh`, and createUser fails on a duplicate. It
// checks for the user first and skips it, so an existing account keeps the password it already has
// — changing one is `db.getSiblingDB(name).dropUser(user)` followed by another `./up.sh`.

/**
 * The test database of every repo that runs integration tests. This list is the one in
 * marketplace-db-setup/setup/mongodb.js, which is gitignored and does not travel with a clone.
 *
 * Nine, not eight: marketplace-common owns one too. marketplace-dev-authenticated-logout is absent
 * on purpose — its integration suite never touches MongoDB and it carries no MONGO_TEST_* block.
 * marketplace-db-setup uses CFG.testDb (dbMarketplaceTest) itself and so is not repeated here.
 *
 * Each suite drops its OWN database on every run, which is the whole reason they cannot share one.
 */
const PER_REPO_TEST_DATABASES = [
	'dbMarketplaceTestCommon', // marketplace-common
	'dbMarketplaceTestPublicAuthz', // marketplace-dev-public-authorization
	'dbMarketplaceTestPublicRes', // marketplace-dev-public-resource
	'dbMarketplaceTestOwnerAuthz', // marketplace-dev-authenticated-authorization
	'dbMarketplaceTestOwnerRes', // marketplace-dev-authenticated-resource
	'dbMarketplaceTestAdminAuthz', // marketplace-dev-admin-authenticated-authorization
	'dbMarketplaceTestAdminRes', // marketplace-dev-admin-authenticated-resource
	'dbMarketplaceTestUserAuthz', // marketplace-dev-user-authenticated-authorization
	'dbMarketplaceTestUserRes' // marketplace-dev-user-authenticated-resource
]

const created = []
const kept = []

// The role is granted ON the same database the user is defined in, so authSource is that database
// and never `admin`. vitest.mongo.mts asserts exactly that (MONGO_TEST_AUTH_ADMIN === MONGO_TEST_DB).
function ensureUser(dbName, user, pwd, role) {
	const target = db.getSiblingDB(dbName)
	if (target.getUser(user)) {
		kept.push(dbName + '/' + user)
		return
	}
	target.createUser({ user: user, pwd: pwd, roles: [{ role: role, db: dbName }] })
	created.push(dbName + '/' + user + ' (' + role + ')')
}

// The dev pair shares one password — that is the shape marketplace-db-setup/env already has
// (MONGO_DEV_PWD, singular, for both MONGO_DEV_UDBOWNER and MONGO_DEV_URW).
ensureUser(CFG.devDb, CFG.devOwner, CFG.devPwd, 'dbOwner')
ensureUser(CFG.devDb, CFG.devRw, CFG.devPwd, 'readWrite')

// marketplace-db-setup's own throwaway database.
ensureUser(CFG.testDb, CFG.testOwner, CFG.testOwnerPwd, 'dbOwner')
ensureUser(CFG.testDb, CFG.testRw, CFG.testRwPwd, 'readWrite')

PER_REPO_TEST_DATABASES.forEach(function (name) {
	ensureUser(name, CFG.testOwner, CFG.testOwnerPwd, 'dbOwner')
	ensureUser(name, CFG.testRw, CFG.testRwPwd, 'readWrite')
})

print('provision: created ' + created.length + ', already present ' + kept.length)
created.forEach(function (line) {
	print('  + ' + line)
})
