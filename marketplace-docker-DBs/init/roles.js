// The per-service MongoDB roles this platform would run on if every service authenticated as itself.
//
// ⚠️ **Nothing in this repo creates these roles today, and `up.sh` does not read this file.** It is the
// definition and the argument, kept next to `provision.js` so the two cannot drift into different ideas
// of what a service needs. RISK_REGISTER R24: the nine backend services share one `marketplaceRwDev`
// account holding the built-in `readWrite` role, which is **database-scoped** — CRUD on every collection
// in `dbMarketplaceDev`, including the ones nobody has created yet — so a bug in the public storefront
// reaches the `admin` collection at the datastore layer with `assertTier` never consulted.
//
// `rbac-probe.sh` runs the shape below against a throwaway database and proves both directions: the
// granted operations succeed and the ungranted ones come back `Unauthorized`. Run it before trusting
// any of this.
//
// ── Why it is a definition and not a deployment ───────────────────────────────────────────────────
//
// Eight roles need eight accounts, and eight accounts need eight passwords that exist in no template
// in this workspace and cannot be invented here: the moment they share one, a service that reads its
// own environment can authenticate as any of the others and the whole separation is decoration. Who
// mints those, and where they are kept, is the adopter's — the same boundary ADR-039 draws for the
// datastore host and ADR-040 for the secrets manager.
//
// ── How the table below was derived ───────────────────────────────────────────────────────────────
//
// Not by judgement. Every service reaches MongoDB through a model imported from
// `@axiumine/marketplace-common/models/MongoDB/…` and through nothing else — there is no
// `db.collection(…)`, no `connection.db` and no `getSiblingDB` anywhere under any service's `src/`, so
// the import list *is* the collection list. Re-derive it with:
//
//   grep -rhoE "marketplace-common/models/MongoDB/[A-Za-z]+" <service>/src | sed 's|.*/||' | sort -u
//
// ⚠️ **A new resolver that imports a seventh model widens the service's true surface, and until
// 2026-09-06 this file stayed silent about it.** It no longer does: `scripts/service-role-check.mjs`
// re-runs the derivation above against every service's `src/` and compares it to the table below, so
// the two disagree loudly rather than quietly (RISK_REGISTER R59, MC-29). The check reads this file as
// data — it evaluates it and takes `SERVICE_COLLECTIONS`, `SERVICE_REPOS` and `NO_DATABASE_SERVICES` —
// so a table renamed here is a failure there rather than a check that silently measures nothing.
//
// It also re-asserts the sentence the derivation rests on: no `db.collection(…)`, no `connection.db`
// and no `getSiblingDB` under any service's `src/`. The day one of those appears, the import list
// stops being the collection list and every row below becomes a guess.

/**
 * Collections each service's own `src/` actually reaches, as of 2026-09-06.
 *
 * `marketplace-dev-authenticated-logout` is absent on purpose: it holds no MongoDB connection at all
 * (`src/index.mts` says so — Redis only), so it needs no account and gets no role.
 */
const SERVICE_COLLECTIONS = {
	marketplaceAdminAuthzDev: ['admin'],
	marketplaceAdminResDev: ['admin', 'company', 'item', 'itemCategory', 'shopOwner', 'user'],
	marketplaceOwnerAuthzDev: ['shopOwner'],
	marketplaceOwnerResDev: ['company', 'item', 'itemCategory', 'shopOwner'],
	marketplacePublicAuthzDev: ['admin', 'shopOwner', 'user'],
	marketplacePublicResDev: ['company', 'item', 'itemCategory', 'shopOwner', 'user'],
	marketplaceUserAuthzDev: ['user'],
	marketplaceUserResDev: ['user']
}

/**
 * Which repository under `BEs/dev/` each account speaks for.
 *
 * The keys above are MongoDB account names and these are directory names; nothing else in this
 * workspace maps one to the other, and `scripts/service-role-check.mjs` needs the mapping to be a
 * value rather than a convention a reader infers from the abbreviations.
 */
const SERVICE_REPOS = {
	marketplaceAdminAuthzDev: 'marketplace-dev-admin-authenticated-authorization',
	marketplaceAdminResDev: 'marketplace-dev-admin-authenticated-resource',
	marketplaceOwnerAuthzDev: 'marketplace-dev-authenticated-authorization',
	marketplaceOwnerResDev: 'marketplace-dev-authenticated-resource',
	marketplacePublicAuthzDev: 'marketplace-dev-public-authorization',
	marketplacePublicResDev: 'marketplace-dev-public-resource',
	marketplaceUserAuthzDev: 'marketplace-dev-user-authenticated-authorization',
	marketplaceUserResDev: 'marketplace-dev-user-authenticated-resource'
}

/**
 * Services that hold no MongoDB connection at all, and so get no account and no role.
 *
 * ⚠️ **This is an assertion, not an exemption.** The check reads it as "this service must import zero
 * models", so a resolver added here that reaches a collection fails rather than passing unnoticed as
 * a service nobody listed.
 */
const NO_DATABASE_SERVICES = ['marketplace-dev-authenticated-logout']

/**
 * What a service is allowed to do to a collection it owns.
 *
 * ⚠️ **`createCollection` is in the list and is not a hole.** A privilege names a resource, so
 * `createCollection` on `{ db, collection: 'user' }` creates `user` and refuses a seventh collection —
 * which is what makes it safe to leave Mongoose's `autoCreate` alone. Without it, the first
 * `Model.init()` against an empty database fails `Unauthorized` and every service would need
 * `autoCreate: false` set in eight places.
 *
 * ⚠️ **The DDL that `readWrite` grants and this does not** is the whole point: no `dropCollection`, no
 * `dropDatabase`, no `collMod`, and no reach into a collection the service was not given. Schema
 * changes belong to `marketplace-db-setup`, which authenticates as the `dbOwner` account and keeps it.
 */
const COLLECTION_ACTIONS = ['find', 'insert', 'update', 'remove', 'createCollection', 'createIndex', 'listIndexes']

/**
 * ⚠️ **Every service needs the key vault, whatever else it needs.** All eight call
 * `setupFieldEncryption()` at boot, and `ensureDataKeys` in `marketplace-common` both **creates a unique
 * index** on `keyAltNames` and inserts a data key when one is missing — so `find` alone is not enough
 * and a role without this block takes every service down at startup rather than at first use.
 *
 * `remove` is deliberately absent: a service that deletes a data key makes every field encrypted under
 * it permanently unreadable, and no code here has a reason to.
 */
const KEY_VAULT = '__keyVault'
const KEY_VAULT_ACTIONS = ['find', 'insert', 'createIndex', 'listIndexes']

/** The `privileges` array for one service, ready for `db.createRole`. */
function privilegesFor(dbName, collections) {
	const privileges = collections.map(function (collection) {
		return { resource: { db: dbName, collection: collection }, actions: COLLECTION_ACTIONS.slice() }
	})

	privileges.push({ resource: { db: dbName, collection: KEY_VAULT }, actions: KEY_VAULT_ACTIONS.slice() })

	return privileges
}

/** Role name for a service account — `marketplacePublicResDev` becomes `marketplacePublicResDevRole`. */
function roleNameFor(user) {
	return user + 'Role'
}
