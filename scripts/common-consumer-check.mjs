#!/usr/bin/env node
//
// What every consumer of `@axiumine/marketplace-common` actually resolves, against what it imports.
//
//   node ./scripts/common-consumer-check.mjs
//
// `marketplace-common` reaches a consumer by being published and by nothing else (ADR-037, ADR-047),
// and each consumer moves its own range deliberately — step 9 of that repo's release flow says the
// bump "is separate work in each consuming repo, and it is not part of this flow". So a consumer
// lagging the shipped version is **not** an error here and is never reported as one: twelve repos
// tracking one library at their own pace is the design. RISK_REGISTER R34 is the other half of that
// design — the bump that was *owed* and forgotten, leaving a repo compiling against a version whose
// tarball does not carry what its code imports.
//
// Four claims per consumer, none of which any single repo can make about itself:
//
//   1. the range its `package.json` declares has an entry in its own `yarn.lock` — a hand-edited range
//      with an unchanged lock resolves to nothing, and `yarn install` has not been run since
//   2. the version installed under `node_modules` is the version the lock names — a tree holding
//      something else was put there by hand, which is what `deploy-local.sh` used to do and why
//      ADR-047 deleted it: `tsc` and every test in that repo then pass against a build no lockfile
//      names and no second machine can reproduce
//   3. that version is one `marketplace-common` says it released — a consumer pointing at a version
//      that was bumped but never published names a tarball that exists on one workstation
//   4. every `@axiumine/marketplace-common` specifier the repo mentions is in that version's
//      `exports` map. ⚠️ **`tsc` already covers the static half of this** — an import of a subpath the
//      installed version lacks is a compile error in that repo's own gate. It does not cover the
//      strings: `vi.mock('@axiumine/marketplace-common/others/typo')` is a string to a typechecker,
//      and a mock of a path that resolves to nothing mocks nothing while the suite stays green.
//
// Claim 4 reads the exports map out of the installed tree rather than the tarball, which is honest
// only because claim 2 has already proved the tree is the version the lock names. It never reaches the
// registry: this runs offline like everything else `audit-check.sh` calls.
//
// It reads. It never writes, never installs, never starts a container, and needs no service running.
//
// Exit 0 = every consumer resolves what it imports. Exit 1 = at least one does not.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PKG = '@axiumine/marketplace-common'

let failed = 0

const pass = (message) => process.stdout.write(`  ✓ ${message}\n`)
const fail = (message) => {
	process.stdout.write(`  ✗ ${message}\n`)
	failed = 1
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

// Every directory this workspace holds a repo in. Discovered rather than listed, so a thirteenth
// consumer is covered on the day it declares the dependency and not on the day somebody remembers to
// add it here — the failure mode a hard-coded list has, and the one R34 is about.
const consumerDirs = () => {
	const candidates = [ROOT, join(ROOT, 'BEs'), join(ROOT, 'BEs/dev')].flatMap((parent) =>
		readdirSync(parent)
			.map((name) => join(parent, name))
			.filter((path) => statSync(path).isDirectory())
	)

	return candidates.filter((path) => {
		const manifest = join(path, 'package.json')
		if (!existsSync(manifest)) return false
		const { dependencies = {}, devDependencies = {} } = readJson(manifest)
		return PKG in dependencies || PKG in devDependencies
	})
}

// yarn v1 lockfile: an entry header naming every range that resolved to it, then an indented
// `version "x.y.z"`. The header carries the range, which is what ties a declared `^4.2.1` to the
// 4.2.1 the tree is supposed to hold.
const lockedVersion = (repo, range) => {
	const lockPath = join(repo, 'yarn.lock')
	if (!existsSync(lockPath)) return undefined

	const lines = readFileSync(lockPath, 'utf8').split('\n')
	const wanted = `${PKG}@${range}`

	for (let i = 0; i < lines.length; i += 1) {
		if (lines[i].startsWith('"') === false && lines[i].startsWith(PKG) === false) continue
		const header = lines[i].replace(/:$/, '')
		const ranges = header.split(',').map((part) => part.trim().replace(/^"|"$/g, ''))
		if (!ranges.includes(wanted)) continue

		for (let j = i + 1; j < lines.length && lines[j].startsWith(' '); j += 1) {
			const match = lines[j].match(/^\s+version "(.+)"$/)
			if (match) return match[1]
		}
	}

	return undefined
}

// The versions `marketplace-common` says it released, read from its own changelog headings. The
// registry is not asked: a check that needed the registry up would be a check that goes red when the
// proxy is down, which teaches the reader to ignore it.
const releasedVersions = () => {
	const changelog = readFileSync(join(ROOT, 'BEs/marketplace-common/CHANGELOG.md'), 'utf8')
	return new Set([...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((match) => match[1]))
}

// An `exports` key, matched the way node matches it — including the `./*` patterns, which this map
// does not use today and is free to start using tomorrow.
const exported = (map, subpath) =>
	Object.keys(map).some((key) =>
		key.includes('*')
			? new RegExp(`^${key.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(subpath)
			: key === subpath
	)

const SOURCE_FILE = /\.(m?[jt]sx?|vue|svelte)$/
const SPECIFIER = new RegExp(`['"](${PKG}(?:/[^'"]*)?)['"]`, 'g')

const specifiers = (repo) => {
	const found = new Set()

	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
			const path = join(dir, entry.name)
			if (entry.isDirectory()) walk(path)
			else if (SOURCE_FILE.test(entry.name))
				for (const match of readFileSync(path, 'utf8').matchAll(SPECIFIER)) found.add(match[1])
		}
	}

	for (const base of ['src', 'test', 'lib']) if (existsSync(join(repo, base))) walk(join(repo, base))

	return [...found]
}

const compare = (a, b) => {
	const left = a.split('.').map(Number)
	const right = b.split('.').map(Number)
	for (let i = 0; i < 3; i += 1) if (left[i] !== right[i]) return left[i] - right[i]
	return 0
}

const shipped = readJson(join(ROOT, 'BEs/marketplace-common/package.json')).version
const released = releasedVersions()
const consumers = consumerDirs()
const lagging = []

if (consumers.length === 0) {
	fail(`no repo in this workspace declares ${PKG} — the discovery walk found nothing, which is not a state this platform has`)
}

for (const repo of consumers) {
	const name = basename(repo)
	const manifest = readJson(join(repo, 'package.json'))
	const range = manifest.dependencies?.[PKG] ?? manifest.devDependencies?.[PKG]
	const locked = lockedVersion(repo, range)

	if (!locked) {
		fail(`${name} — declares ${range} and its yarn.lock resolves no such range: run yarn install and commit the lockfile`)
		continue
	}

	if (!released.has(locked)) {
		fail(`${name} — its lock names ${PKG} ${locked}, which marketplace-common's CHANGELOG does not list as released`)
	}

	const installedManifest = join(repo, 'node_modules', PKG, 'package.json')
	if (!existsSync(installedManifest)) {
		fail(`${name} — nothing installed under node_modules/${PKG}: run yarn install, or this check proves nothing about it`)
		continue
	}

	const installed = readJson(installedManifest)
	if (installed.version !== locked) {
		fail(`${name} — lock says ${locked} and the tree holds ${installed.version}: a build put there by hand is what ADR-047 deleted deploy-local.sh over`)
		continue
	}

	const unresolved = specifiers(repo).filter(
		(specifier) => !exported(installed.exports ?? {}, specifier === PKG ? '.' : `.${specifier.slice(PKG.length)}`)
	)

	if (unresolved.length > 0) {
		fail(`${name} — imports ${unresolved.join(', ')}, which ${PKG} ${locked} does not export: this consumer's bump is the one that was forgotten`)
	}

	if (compare(locked, shipped) < 0) lagging.push(`${name} ${locked}`)
}

if (failed === 0) pass(`all ${consumers.length} consumers resolve every ${PKG} path they name, at the version their lockfile pins`)

// Not a failure, and deliberately so — see the head of this file. Printed because a bump that was
// owed and forgotten looks exactly like a bump that was deliberately deferred, right up until the
// moment somebody imports the thing that is not there.
if (lagging.length > 0)
	process.stdout.write(
		`  · ${lagging.length} of ${consumers.length} lag the shipped ${shipped}, which is allowed and deliberate (BCON-07 step 9): ${lagging.join(', ')}\n`
	)

process.exit(failed)
