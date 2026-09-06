#!/usr/bin/env node
/*
 * Prove that every source file a package.json hands to a runtime is reached by that package's
 * coverage gate, or is declared as a file that is not.
 *
 *   node ./scripts/runnable-source-check.mjs
 *
 * ⚠️ **This is a cross-repo invariant, and it is here because no repo can state it about itself.**
 * A repo's own `scripts/coverage-audit.mjs` proves that every tracked file *under a source root
 * `coverage.include` declares* reached the report. It says nothing about a file outside every root,
 * because the roots are read from the same globs — a file no glob mentions is absent from the report
 * AND absent from the list the report is compared against, and nothing anywhere goes red for it
 * (RISK_REGISTER R61). Two such files were found: `marketplace-user/serve.mjs`, the SSR adapter
 * `yarn start` runs, and `marketplace-services-status/systemd/generate.mjs`, which writes the
 * `ExecStart` of thirteen real systemd units. Both were untested and unmutated for as long as they
 * had existed. This is the thing that stops a third one arriving the same way.
 *
 * ── What it checks ────────────────────────────────────────────────────────────────────────────────
 *
 *   WHAT IS RUNNABLE     every tracked file a package.json hands to node, tsx, ts-node or
 *                        ts-node-dev in a `scripts` entry, plus whatever `main` and `bin` name. That
 *                        is the definition of "this file runs in production or in a gate", written
 *                        from the manifest rather than from a list somebody maintains here.
 *   THAT IT IS GATED     each of those is matched by a `coverage.include` glob of its own package —
 *                        so the 100% threshold is computed over it — or is named, by exact path, in
 *                        that package's `coverage-exempt.txt` or in `scripts/runnable-exempt.txt`.
 *   THE OTHER DIRECTION  a line in `scripts/runnable-exempt.txt` naming a file that is now gated, is
 *                        declared in its own package's `coverage-exempt.txt`, or is no longer
 *                        runnable at all, is a stale line holding a hole open for the next file to
 *                        carry that path. Both directions fail.
 *   WHICH PACKAGES       every directory carrying `scripts/coverage-audit.mjs`, which is exactly
 *                        `audit-check.sh` §6's definition of a coverage-gated package. Discovered
 *                        rather than listed, so a sixteenth cannot arrive unchecked; §6 is what
 *                        holds the fifteen to carrying that file in the first place, and a package
 *                        that dropped it would fail there rather than quietly leave this check.
 *
 * ⚠️ **Untracked output is not a source file and is skipped deliberately.** `node dist/server.js` and
 * `node ./dist/instrument.mjs` are build products of files that are gated already; gating the build
 * as well would mean gating a copy of the same code that no test imports.
 *
 * ⚠️ **`marketplace-nginx` and `marketplace-docker-DBs` are absent, and not by oversight.** Neither
 * carries a coverage gate at all, so "outside its source roots" is not a thing that can be said about
 * a file in them. What runs there is shell and container config, gated by `audit-check.sh` §7 and by
 * the suites in `marketplace-nginx/test/`.
 *
 * Exit status: 0 when every runnable source is gated or declared, 1 on any disagreement, 2 when a
 * source it needs is missing, unreadable, or no longer declares what it is read for — an unread half
 * is not agreement.
 *
 * RUNNABLE_SOURCE_CHECK_ROOT points it at another workspace tree, for the self-test.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = process.env.RUNNABLE_SOURCE_CHECK_ROOT
	? resolve(process.env.RUNNABLE_SOURCE_CHECK_ROOT)
	: resolve(dirname(fileURLToPath(import.meta.url)), '..')

const EXEMPT_FILE = 'scripts/runnable-exempt.txt'

/* Where a package may sit: the workspace root, `BEs/`, and `BEs/dev/`. Nothing on this platform
 * nests deeper, and an unbounded walk would descend into fifteen `node_modules` trees. */
const PACKAGE_PARENTS = ['.', 'BEs', 'BEs/dev']

/** The file whose presence makes a directory a coverage-gated package — `audit-check.sh` §6. */
const GATE_SCRIPT = 'scripts/coverage-audit.mjs'

const CONFIGS = ['vitest.config.mts', 'vitest.config.ts', 'vitest.config.mjs', 'vitest.config.js']

/* The four ways a package.json starts a JavaScript or TypeScript file directly. `yarn`, `vitest`,
 * `stryker` and the rest run files of their own choosing, from a config this check does not read. */
const RUNTIMES = new Set(['node', 'tsx', 'ts-node', 'ts-node-dev', 'node-dev'])

const SOURCE_EXT = /\.[cm]?[jt]sx?$/

function die(message) {
	process.stderr.write(`runnable-source-check: ${message}\n`)
	process.exit(2)
}

/** `1 file`, `3 files` — a count that reads as English in the line it lands in. */
function plural(count, noun) {
	return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function read(path, what) {
	try {
		return readFileSync(path, 'utf8')
	} catch {
		return die(`cannot read ${what} at ${path}`)
	}
}

/*
 * Strip comments before parsing, with a quote-aware scan rather than a regex — the glob patterns
 * about to be read are full of `/` and `*`, and a naive `//` strip mangles them. Same shape as the
 * one in every repo's `scripts/coverage-audit.mjs`, for the same reason.
 */
function stripComments(src) {
	let out = ''
	let quote = null

	for (let i = 0; i < src.length; i++) {
		const c = src[i]

		if (quote) {
			out += c
			if (c === '\\') {
				out += src[++i] ?? ''
			} else if (c === quote) {
				quote = null
			}
			continue
		}
		if (c === "'" || c === '"' || c === '`') {
			quote = c
			out += c
			continue
		}
		if (c === '/' && src[i + 1] === '/') {
			while (i < src.length && src[i] !== '\n') i++
			out += '\n'
			continue
		}
		if (c === '/' && src[i + 1] === '*') {
			i += 2
			while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
			i++
			continue
		}
		out += c
	}

	return out
}

/** The `include` array of the `coverage` block — never the `include` that names the test files. */
function coverageInclude(src) {
	const block = src.slice(src.search(/\bcoverage\s*:\s*\{/))
	const m = block.match(/\binclude\s*:\s*\[([\s\S]*?)]/)

	if (!m) return null

	return [...m[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((s) => s[1] ?? s[2])
}

const escapeRe = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/* Enough glob for the patterns these fifteen configs use: `**`, `*`, `?` and `{a,b}`. `**\/`
 * matches zero directories too, so `src/**\/*.mts` covers `src/index.mts`. */
function globToRegExp(glob) {
	let re = '^'

	for (let i = 0; i < glob.length; i++) {
		const c = glob[i]

		if (c === '*') {
			if (glob[i + 1] === '*') {
				if (glob[i + 2] === '/') {
					re += '(?:[^/]+/)*'
					i += 2
				} else {
					re += '.*'
					i += 1
				}
			} else {
				re += '[^/]*'
			}
		} else if (c === '?') {
			re += '[^/]'
		} else if (c === '{') {
			const end = glob.indexOf('}', i)

			if (end === -1) die(`unclosed { in a coverage.include pattern: "${glob}"`)
			re += `(?:${glob
				.slice(i + 1, end)
				.split(',')
				.map(escapeRe)
				.join('|')})`
			i = end
		} else {
			re += escapeRe(c)
		}
	}

	return new RegExp(`${re}$`)
}

/** `./x.mjs` and `'x.mjs'` are the same file as `x.mjs`, and a manifest may spell it either way. */
function normalise(path) {
	return path.replace(/^['"]|['"]$/g, '').replace(/^\.\//, '')
}

/*
 * Every file the manifest hands to a runtime: `main`, every `bin` value, and the arguments of every
 * `scripts` command whose word is one of RUNTIMES. Flags are skipped and every remaining argument
 * with a source extension is taken, so `node --loader ./a.mjs b.mjs` yields both rather than the
 * first — a loader is code that runs too.
 */
function runnablePaths(pkg) {
	const found = new Set()
	const consider = (value) => {
		if (typeof value === 'string' && SOURCE_EXT.test(normalise(value))) found.add(normalise(value))
	}

	consider(pkg.main)
	if (typeof pkg.bin === 'string') {
		consider(pkg.bin)
	} else if (pkg.bin && typeof pkg.bin === 'object') {
		for (const value of Object.values(pkg.bin)) consider(value)
	}

	for (const script of Object.values(pkg.scripts ?? {})) {
		for (const segment of String(script).split(/&&|\|\||[;|]/)) {
			const tokens = segment.trim().split(/\s+/).filter(Boolean)
			const start = tokens[0] === 'npx' ? 1 : 0
			const runtime = (tokens[start] ?? '').split('/').pop()

			if (!RUNTIMES.has(runtime)) continue
			for (const token of tokens.slice(start + 1)) {
				if (!token.startsWith('-')) consider(token)
			}
		}
	}

	return [...found]
}

/** The paths git tracks under a package, relative to it — the only definition of "a source file". */
function trackedFiles(dir, rel) {
	try {
		return new Set(
			execFileSync('git', ['ls-files', '-z'], { cwd: dir, encoding: 'utf8' })
				.split('\0')
				.filter(Boolean)
		)
	} catch {
		return die(`cannot list the tracked files of ${rel} — is it a git working tree?`)
	}
}

/** The exact paths a package's own coverage-exempt.txt declares, or an empty set when it has none. */
function coverageExempt(dir) {
	const path = join(dir, 'coverage-exempt.txt')

	if (!existsSync(path)) return new Set()

	return new Set(
		readFileSync(path, 'utf8')
			.split('\n')
			.map((line) => line.replace(/#.*$/, '').trim())
			.filter(Boolean)
	)
}

/* ── The declaration file ────────────────────────────────────────────────────────────────────── */

const exemptPath = join(ROOT, EXEMPT_FILE)

if (!existsSync(exemptPath)) {
	die(`${EXEMPT_FILE} is missing — it is the list of runnable files that are deliberately ungated`)
}

const declared = new Map()

for (const [index, raw] of read(exemptPath, 'the exemption list').split('\n').entries()) {
	const line = raw.replace(/#.*$/, '').trim()

	if (!line) continue
	if (/[*?{]/.test(line)) {
		die(
			`${EXEMPT_FILE}:${index + 1} is a glob ("${line}"). Exact paths only: a glob exempts ` +
				'whatever lands beside the file next, in silence, with the run still green.'
		)
	}
	if (declared.has(line)) die(`${EXEMPT_FILE}:${index + 1} names "${line}" twice`)
	declared.set(line, index + 1)
}

/* ── The packages ────────────────────────────────────────────────────────────────────────────── */

const failures = []
const PACKAGES = []

for (const parent of PACKAGE_PARENTS) {
	const dir = join(ROOT, parent)

	if (!existsSync(dir)) die(`${parent} does not exist under ${ROOT}`)
	for (const entry of readdirSync(dir).sort()) {
		const rel = parent === '.' ? entry : `${parent}/${entry}`

		if (!statSync(join(dir, entry)).isDirectory()) continue
		if (existsSync(join(dir, entry, GATE_SCRIPT))) PACKAGES.push(rel)
	}
}

if (PACKAGES.length === 0) {
	die(`no directory under ${PACKAGE_PARENTS.join(', ')} carries ${GATE_SCRIPT} — nothing to check`)
}

/* ── The check ───────────────────────────────────────────────────────────────────────────────── */

const seen = new Set()
let runnable = 0
let gated = 0

for (const rel of PACKAGES) {
	const dir = join(ROOT, rel)
	const pkg = JSON.parse(read(join(dir, 'package.json'), `${rel}'s manifest`))
	const configPath = CONFIGS.map((c) => join(dir, c)).find(existsSync)

	if (!configPath) die(`${rel} has no vitest config (looked for ${CONFIGS.join(', ')})`)

	const include = coverageInclude(stripComments(read(configPath, `${rel}'s vitest config`)))

	if (!include || include.length === 0) {
		die(
			`${rel} sets no coverage.include — with none, the v8 provider reports only what a test ` +
				'imported and this check has no roots to compare against (RISK_REGISTER R07).'
		)
	}

	const matchers = include.map(globToRegExp)
	const tracked = trackedFiles(dir, rel)
	const exempt = coverageExempt(dir)

	for (const path of runnablePaths(pkg)) {
		if (!tracked.has(path)) continue

		runnable++

		const key = `${rel}/${path}`

		seen.add(key)
		if (matchers.some((re) => re.test(path))) {
			gated++
			if (declared.has(key)) {
				failures.push(
					`${EXEMPT_FILE}:${declared.get(key)} — ${key} is gated by coverage.include now; ` +
						'the line is stale and holds the hole open for the next file at that path'
				)
			}
			continue
		}
		if (exempt.has(path)) {
			if (declared.has(key)) {
				failures.push(
					`${EXEMPT_FILE}:${declared.get(key)} — ${key} is declared in ${rel}/coverage-exempt.txt ` +
						'already; two declarations of one decision drift apart'
				)
			}
			continue
		}
		if (!declared.has(key)) {
			failures.push(
				`${key} is run by package.json and no coverage.include glob reaches it. ` +
					`Gate it, or name it in ${EXEMPT_FILE} with the reason it cannot be gated.`
			)
		}
	}
}

for (const [key, line] of declared) {
	if (!seen.has(key)) {
		failures.push(
			`${EXEMPT_FILE}:${line} — ${key} is not a runnable tracked file of a gated package any more`
		)
	}
}

if (failures.length > 0) {
	process.stderr.write('runnable-source-check: BLOCKED\n')
	for (const failure of failures) process.stderr.write(`  ✗ ${failure}\n`)
	process.exit(1)
}

process.stdout.write(
	`runnable-source-check: ${plural(runnable, 'runnable source file')} across ` +
		`${plural(PACKAGES.length, 'gated package')} — ${gated} gated by coverage.include, ` +
		`${runnable - gated} declared by name.\n`
)
