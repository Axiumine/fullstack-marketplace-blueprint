# Dependency Tree — Advisory Scan and Reachability
# Marketplace

**Status:** finding - closes [`token-handling-security-audit.md`](./token-handling-security-audit.md) §5 —
"No full dependency-tree audit was performed"
**Version:** 1.2
**Date:** 2026-08-13, §2 annotated 2026-08-27, the `koa-utils` version annotated the same day, §6.1 added 2026-08-28, §4.1 and §8 rewritten 2026-09-06 when the `axios` line was actually fixed
**Author:** claude
**Scope:** every one of the sixteen repos in this workspace, production and toolchain dependencies alike
**Method:** the installed tree read from `node_modules` on disk, resolved the way Node resolves it, then queried
against npm's bulk advisory endpoint — the same data `npm audit` reports. Reachability decided by reading the
call site, not by trusting the dependency graph
**Reads against:** [`token-handling-security-audit.md`](./token-handling-security-audit.md) §5 — "No full
dependency-tree audit was performed"; [`RISK_REGISTER.md`](../devprotocol/phase5/RISK_REGISTER.md) R21

---

## 1. Verdict

**Fifty-four distinct advisories match packages installed in this workspace. Twenty-nine of them sit in the
production zone of at least one service. Every one of those twenty-nine is in `@socketlabs/email`'s pinned
`axios@0.21.4` or in a transitive of `@apollo/server`, and none of them is reachable through an attacker-influenced
path — but seven of the eight services that install the vulnerable `axios` never load it, and the eighth calls it
through a client whose endpoint URL is a hard-coded literal and whose proxy is never configured.**

Three things this scan establishes that the audit could not:

1. **The auth path's own dependencies are clean.** `keygrip@1.1.0`, `cookies@0.9.1`, `koa@3.2.1`, `redis@6.2.0`,
   `@sentry/node@10.69.0`, `@axiumine/koa-utils@6.0.0` — not one carries an open advisory.
   ⚠️ **`koa-utils` is `7.0.0` since 2026-08-27 and `7.1.0` since 2026-08-28**, and the finding survives both bumps: `yarn audit --groups dependencies`
   in `marketplace-dev-public-resource` reports the same 268 packages and 28 advisories after it as before, and the
   Trivy gate the same 10 HIGH, all of them `axios@0.21.4`. Everything found is in
   the email client, the GraphQL server's body parser, or the test and lint toolchain.
2. **The vulnerable `axios` ships into seven services that never execute a line of it.** `@socketlabs/email` is a
   *peer* of `@axiumine/koa-utils`, and eight services declare it as a direct dependency. Only
   `marketplace-dev-public-resource` imports the module that uses it. That is a dependency to delete in seven
   places, not a vulnerability to patch.
3. **The gate that should have caught this ran, and reported nothing.** Qodana's `VulnerableLibrariesLocal`
   inspection — "Vulnerable declared dependency" — is armed in every `qodana.yaml`, executes on every pre-commit
   and pre-push, and its own summary records **172 invocations, 0.02 seconds, 0 problems** in
   `marketplace-dev-public-resource`, and 0 problems in every other repo checked. In the same tree, the same day,
   an independent query returned ten High advisories against a production dependency. R21 assumed no gate existed.
   The truth is worse: one exists, it is wired into two hooks, and it is silent.

---

## 2. Why `yarn audit` could not be used, and what was used instead

`yarn audit` works in exactly one of the fourteen repos that have a dependency tree.

```
Error: https://registry.npmjs.org/@axiumine%2fmarketplace-common: Not found
```

⚠️ **Expired 2026-08-27, and recorded rather than rewritten — this is a dated finding.** The package was
published on 2026-08-26 (`ADR-037`), and `yarn audit` in `marketplace-dev-public-resource` now completes: 734
packages audited, 80 advisories; 268 and 28 with `--groups dependencies`. Everything below was accurate when
measured and the scan's conclusions do not rest on it.

`@axiumine/marketplace-common` was unpublished when this ran — consumed by package name and copied into each
consumer by a local script — and yarn 1 aborts the **entire** audit when any single package fails to resolve
against the registry, rather than skipping it. ⚠️ **Neither half survives:** the package has been on
`registry.npmjs.org` since 2026-08-26 (`ADR-037`) and the script was deleted on 2026-08-30
(`ADR-047`), so the resolution failure this paragraph describes cannot happen again — re-run the audit
before treating anything below as current. The failure is identical with `--registry https://registry.npmjs.org` and
against the default. It is not a misconfiguration: it is what yarn 1 does, and it means the obvious command has
never been able to answer this question in this workspace. That alone explains why no one had run it.

What was run instead, in three steps:

| Step | What it does |
|---|---|
| Read the tree | Every `package.json` under every `node_modules`, recursively, scoped packages included — the tree as installed, not as declared |
| Decide the zone | Breadth-first from `dependencies` and from `devDependencies` separately, following Node's own upward resolution, so a package that only the toolchain reaches is never called production |
| Ask for advisories | `POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk` in chunks of 250 names — the endpoint `npm audit` itself uses |

⚠️ **The bulk endpoint answers per package *name*, not per version.** An advisory returned for `axios` may describe
a range no copy here installs. Every response is filtered through `semver.satisfies(version, vulnerable_versions)`
before it becomes a row. Skipping that filter roughly triples the count and every extra row is false.

The scan covers **14 repos**. `marketplace-nginx` and the parent workspace have no `package.json`, no `yarn.lock`
and no `node_modules` — the other two of the sixteen. That is a fact about the workspace, not a gap in the scan.

---

## 3. The tree, per repo

`installed` counts distinct `name@version` pairs physically present. A package can be reachable from both zones;
it is counted in each.

| Repo | Installed | Prod-reachable | Dev-reachable |
|---|---|---|---|
| `marketplace-common` | 444 | 2 | 443 |
| `marketplace-db-setup` | 285 | 66 | 223 |
| `marketplace-dev-admin-authenticated-authorization` | 614 | 280 | 371 |
| `marketplace-dev-admin-authenticated-resource` | 644 | 308 | 377 |
| `marketplace-dev-authenticated-authorization` | 614 | 280 | 371 |
| `marketplace-dev-authenticated-logout` | 582 | 191 | 419 |
| `marketplace-dev-authenticated-resource` | 644 | 308 | 377 |
| `marketplace-dev-public-authorization` | 614 | 280 | 371 |
| `marketplace-dev-public-resource` | 618 | 283 | 372 |
| `marketplace-dev-user-authenticated-authorization` | 614 | 280 | 371 |
| `marketplace-dev-user-authenticated-resource` | 608 | 274 | 371 |
| `marketplace-admin` | 584 | 38 | 544 |
| `marketplace-shopowner` | 584 | 38 | 544 |
| `marketplace-user` | 627 | 143 | 538 |

**894 distinct package names** across the workspace. **13 of them** carry an advisory that matches an installed
version.

⚠️ `marketplace-common` shows 2 prod-reachable because it is a library: its runtime dependencies are declared as
`peerDependencies` (63 reachable) and `devDependencies`, so the consumer provides them. Reading its `dependencies`
as "what it needs at runtime" gives the wrong answer, and this is the one repo where that is true.

> **This table is the tree as installed on 2026-08-13, before the `@socketlabs/email` removal and the `tsc-alias`
> move landed (§8).** Both changes moved packages out of the production zone rather than out of the tree, so
> `Installed` is unchanged and `Prod-reachable` is not: the `tsc-alias` move takes **37** off each of the eight
> service rows that had `tsc-alias` misplaced
> (every row above except `authenticated-logout`, `marketplace-common`, `marketplace-db-setup` and the three
> frontends). The re-measurement is a re-implementation of the method in §2 and its absolute counts run **6 below**
> the ones here — the same offset in every repo, including the ones neither story touched. The delta is the number
> to read, not the absolute: nothing in this document turns on the sixth decimal of a package count, and rewriting
> the table from a second implementation would replace a measurement with an estimate.

---

## 4. Production zone — the twenty-nine

### 4.1 `axios@0.21.4` — 23 advisories, 8 services, 1 loader — ✅ **fixed 2026-09-06**

⚠️ **Everything in this section describes the tree as it was, and the tree changed twice.** A change on 2026-08-13 took the package out of the seven services that never loaded it, and on 2026-09-06 `marketplace-dev-public-resource` — the eighth, the one that does load it — gained a `resolutions` block pinning `axios` to `0.33.0`. **No service installs `axios@0.21.4` today.** The reasoning below is kept because it is what made the decision defensible for the three weeks in between, and because the reachability argument is the reason this was never an emergency; the section that supersedes it is §8.

The chain is the same in all eight:

```
@socketlabs/email@1.4.4 > axios@0.21.4 > follow-redirects@1.15.11
```

`@socketlabs/email@1.4.4` pins `"axios": "^0.21.1"`. For a `0.x` version the caret does not float the minor, so
that range is `>=0.21.1 <0.22.0` and `0.21.4` is the newest thing it can ever install. **1.4.4 is the latest
published version of `@socketlabs/email`** — there are fourteen versions and no newer one to move to. `axios` is at
`1.19.0`, with `0.33.0` the newest on the `0.x` line. There is no upgrade path inside the SDK.

| Severity | Count |
|---|---|
| High | 10 |
| Moderate | 12 |
| Low | 1 |

The ten Highs:

| Advisory | Fixed after | Title |
|---|---|---|
| [GHSA-jr5f-v2jv-69x6](https://github.com/advisories/GHSA-jr5f-v2jv-69x6) | 0.30.0 | SSRF and credential leakage via absolute URL |
| [GHSA-hfxv-24rg-xrqf](https://github.com/advisories/GHSA-hfxv-24rg-xrqf) | 0.31.1 | ReDoS via cookie name injection |
| [GHSA-p92q-9vqr-4j8v](https://github.com/advisories/GHSA-p92q-9vqr-4j8v) | 0.31.1 | Proxy-Authorization leak across HTTP-to-HTTPS redirect |
| [GHSA-j5f8-grm9-p9fc](https://github.com/advisories/GHSA-j5f8-grm9-p9fc) | 0.31.1 | Proxy-Authorization leaks when a proxy is re-evaluated to direct |
| [GHSA-3g43-6gmg-66jw](https://github.com/advisories/GHSA-3g43-6gmg-66jw) | 0.31.1 | Credential theft and response hijacking via prototype-pollution gadget in config merge |
| [GHSA-pmwg-cvhr-8vh7](https://github.com/advisories/GHSA-pmwg-cvhr-8vh7) | 0.31.0 | NO_PROXY bypassed via the 127.0.0.0/8 loopback subnet |
| [GHSA-pf86-5x62-jrwf](https://github.com/advisories/GHSA-pf86-5x62-jrwf) | 0.31.0 | Prototype-pollution gadgets — response tampering, exfiltration, request hijacking |
| [GHSA-6chq-wfr3-2hj9](https://github.com/advisories/GHSA-6chq-wfr3-2hj9) | 0.31.0 | Header injection via prototype pollution |
| [GHSA-43fc-jf86-j433](https://github.com/advisories/GHSA-43fc-jf86-j433) | 0.30.2 | DoS via `__proto__` key in `mergeConfig` |
| [GHSA-pjwm-pj3p-43mv](https://github.com/advisories/GHSA-pjwm-pj3p-43mv) | 0.31.1 | NO_PROXY bypass via IPv4-mapped IPv6 addresses |

**Reachability — who loads it.** `@axiumine/koa-utils` has no root entry point (`main` is undefined; it publishes
subpath exports only), so importing any of its modules pulls exactly that module's graph. Following every
`@axiumine/koa-utils/...` specifier that each service's `src/` imports, through the published `dist/`, to a
`@socketlabs/email` import:

| Service | Declares `@socketlabs/email` | Reaches it from `src/` |
|---|---|---|
| `marketplace-dev-public-resource` | yes | **yes** — 4 files, via `@axiumine/koa-utils/email/SocketLabsLib` |
| `marketplace-dev-admin-authenticated-authorization` | yes | no |
| `marketplace-dev-admin-authenticated-resource` | yes | no |
| `marketplace-dev-authenticated-authorization` | yes | no |
| `marketplace-dev-authenticated-logout` | yes | no |
| `marketplace-dev-authenticated-resource` | yes | no |
| `marketplace-dev-public-authorization` | yes | no |
| `marketplace-dev-user-authenticated-authorization` | yes | no |
| `marketplace-dev-user-authenticated-resource` | no | no |

Seven services install `axios@0.21.4` and never execute it. Removing `@socketlabs/email` from their `package.json`
removes twenty-three advisories from seven trees and changes no behaviour: it is a peer of `koa-utils`, needed only
where the email module is used.

**Reachability — the one that does load it.** In `marketplace-dev-public-resource` the client is constructed in
`@axiumine/koa-utils`'s `dist/email/SocketLabsLib.mjs`:

```js
this.client = new SocketLabsClient(
    parseInt(process.env.SOCKETLABS_SERVER_ID || '0'),
    `${process.env.SOCKETLABS_SERVER_APIKEY}`,
    { requestTimeout: 120, numberOfRetries: 3 }
)
```

The SDK's constructor is `constructor(serverId, apiKey, { endpointUrl = null, optionalProxy = null, requestTimeout
= null, numberOfRetries = null } = {})`. Neither `endpointUrl` nor `optionalProxy` is passed, so:

| Advisory class | Reachable here | Why |
|---|---|---|
| SSRF / absolute-URL / NO_PROXY bypass (5) | **no** | The URL is the literal `https://inject.socketlabs.com/api/v1/email`, set in the SDK's own constructor. Nothing in this platform's data reaches it |
| Proxy-Authorization leak (2) | **no** | `optionalProxy` is never set; the proxy branch never runs |
| Prototype-pollution gadgets (5) | **no** | The config object is a literal built inside the SDK from a serverId, an API key and two numbers. No request-derived value merges into it |
| ReDoS via cookie-name injection (1) | **bounded** | Requires a hostile `Set-Cookie` from `inject.socketlabs.com` over TLS |
| DoS via deeply nested `toFormData` (1) | **no** | The body is a `BasicMessage`, shaped by `koa-utils`, not by the caller |
| `follow-redirects` auth-header leak (1) | **bounded** | Requires `inject.socketlabs.com` to redirect cross-domain |

The two bounded ones both require the SocketLabs API host itself to be hostile or impersonated over TLS. That is
not zero, and it is not a code path this platform can be tricked into.

### 4.2 The rest of the production zone

| Package | Version | Sev | Advisory | Arrives via | Reachable |
|---|---|---|---|---|---|
| `body-parser` | 2.2.2 | low | [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6) | `@apollo/server@5.5.1` | **no** — the DoS needs an *invalid* `limit` value silently disabling size enforcement; Apollo sets its own |
| `qs` | 6.15.0 | moderate | [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26) | `@apollo/server > body-parser` | **no** — the crash is in `qs.stringify` with `encodeValuesOnly`; the server parses, it does not stringify |
| `@protobufjs/utf8` | 1.1.0 | moderate | [GHSA-q6x5-8v7m-xcrf](https://github.com/advisories/GHSA-q6x5-8v7m-xcrf) | `@apollo/server > @apollo/usage-reporting-protobuf > @apollo/protobufjs` | **no** — usage reporting is Apollo Studio telemetry; no service sends it |
| `follow-redirects` | 1.15.11 | moderate | [GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653) | `@socketlabs/email > axios` | bounded — see §4.1 |
| `picomatch` | 2.3.1 | high + moderate | [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj), [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | `tsc-alias@1.9.1 > chokidar > anymatch` | **no** at runtime — **and no longer in the production zone at all: moved out 2026-08-13** |

### 4.3 The env contract points at the wrong services

Tracing which service loads the email client turned up a mismatch that the required-env checks' contracts encode
as if it were intended. `REQUIRED_ENV_VARS` demands `SOCKETLABS_SERVER_ID` and `SOCKETLABS_SERVER_APIKEY` in:

| Service | Requires the SocketLabs vars | Loads the email module |
|---|---|---|
| `marketplace-dev-authenticated-resource` | **yes** — `src/index.mts:47-48` | no |
| `marketplace-dev-admin-authenticated-resource` | **yes** — `src/index.mts:48-49` | no |
| `marketplace-dev-public-resource` | **no** | **yes** — 4 files |

It is exactly backwards. Two services refuse to boot without credentials for a client they never construct, and
the one service that constructs it will boot happily without them — `SocketLabsLib`'s constructor reads
`` `${process.env.SOCKETLABS_SERVER_APIKEY}` `` into a template literal, so an unset variable becomes the string
`"undefined"` and the failure arrives at the first registration email rather than at startup. That is the precise
failure mode the required-env check exists to prevent, in the one place it was not applied.

`marketplace-dev-user-authenticated-resource` already removed the four SocketLabs variables from its list, and
`src/index.mts:27` records why: *"owner tier's copy came to demand `SOCKETLABS_SERVER_ID` on a service that sends
no mail."* The same reasoning had not been carried to the two services above.

⚠️ **`tsc-alias` is in `dependencies`, not `devDependencies`, in eight of the nine services.** It is a build-time
tool that rewrites path aliases in `dist/`; nothing imports it at runtime. It is the *only* reason a glob matcher
with a ReDoS advisory counts as a production dependency here.
`marketplace-dev-authenticated-logout` declares it under `devDependencies` — which is the correct placement, and
makes the other eight a copy-paste divergence rather than a decision.

> **Closed 2026-08-13.** All eight moved. Re-measured the same way — breadth-first from `dependencies`
> alone, through Node's own upward resolution — each of the eight production zones loses **37 packages** and
> `picomatch` is in none of them. `tsc-alias`, `chokidar` and `anymatch` leave the production zone with it. Every
> service still builds (`yarn clean && tsc && tsc-alias`) and every gate still passes, which is the whole proof
> that the move changed nothing but the manifest.

---

## 5. Toolchain zone — the twenty-eight

None of these ships. They are reachable only from `devDependencies`, and the four things that pull them are
`eslint`, `vitest`/`vite`, `@stryker-mutator/core` and `@typescript-eslint`.

| Package | Versions | Advisories | Arrives via |
|---|---|---|---|
| `brace-expansion` | 1.1.12, 1.1.16, 2.1.2, 5.0.3, 5.0.4, 5.0.7, 5.0.8 | 11 (8 high, 3 moderate) | `@eslint/eslintrc > minimatch`, `@typescript-eslint/parser > … > minimatch`, `@stryker-mutator/core > minimatch`, `typescript-transform-paths > minimatch` |
| `fast-uri` | 3.1.0, 3.1.4 | 5 high | `@stryker-mutator/core > ajv` |
| `picomatch` | 2.3.1, 4.0.3 | 4 (2 high, 2 moderate) | `vitest`, `vite`, `@graphql-codegen/cli > micromatch` |
| `flatted` | 3.3.3, 3.3.4 | 2 high | `eslint > file-entry-cache > flat-cache` |
| `minimatch` | 10.2.2 | 2 high | `@typescript-eslint/parser > @typescript-eslint/typescript-estree` |
| `js-yaml` | 4.3.0 | 1 high | `@eslint/eslintrc`, `@graphql-codegen/cli > cosmiconfig` |
| `nanoid` | 3.3.16 | 1 high | `vite > postcss` |
| `postcss` | 8.5.21, 8.5.22 | 1 moderate | `vitest > vite`, `vite` |
| `qs` | 6.15.1 | 1 moderate | `@stryker-mutator/core > typed-rest-client` |

All eleven `brace-expansion` advisories and both `minimatch` ones are unbounded-expansion denial of service driven
by a hostile *glob pattern*. The patterns here come from `eslint.config.js`, `stryker.config.json` and
`vitest.config.mts` — files in the repo, written by the people running the tool. `fast-uri`'s host-confusion
advisories fire on parsing a hostile URI; `ajv` sees only the JSON schemas Stryker ships. `postcss`'s advisory needs
an attacker-controlled `sourceMappingURL`; the CSS is the frontends' own.

**Verdict for the whole zone: not reachable.** The threat model for a lint or mutation run is a developer's own
config file, and a workspace where a hostile config is the concern has a larger problem than a ReDoS.

⚠️ That verdict is about *today's* exploitability, not about hygiene. Eight of these nine have a fixed version
already published, and the reason they are pinned old is that nothing bumps them: there is no dependency-update
process in this workspace at all.

---

## 6. The auth path, named and versioned

Three stories in this backlog are constrained by what these packages do. This is the list, so the next one does not
have to rediscover it.

| Package | Version | Where it is declared | What it does in the auth path | Ours to change |
|---|---|---|---|---|
| `@axiumine/koa-utils` | 6.0.0 ⚠️ **7.0.0 since 2026-08-27, 7.1.0 since 2026-08-28** | `dependencies` in all 9 services | Session middleware, the Redis data source, the login/reset/verify flows, `SocketLabsLib`. Hardcoded `redis://` in the cluster branch through `7.0.0`; `7.1.0` reads the scheme from `REDIS_TLS` instead, which no `env` here sets (R45, still open) | **no — external, unpublished from here, no source in this workspace** |
| `@axiumine/marketplace-common` | whatever each consumer's `yarn.lock` pins | `dependencies` in all 9 services + all 3 frontends | Session key builders, the encrypted-field map, the shared boundary case list | yes — `BEs/marketplace-common`, resolved from `registry.npmjs.org` like any other dependency since `ADR-037`; the local copy step this column named is deleted (`ADR-047`) |
| `keygrip` | 1.1.0 | `dependencies` in 6 services, transitive in 3 | Cookie signing and the rotating key list behind ADR-034 | **no — external** |
| `cookies` | 0.9.1 | transitive in all 9, via `koa` | Writes and reads the signed cookies; the `Secure` attribute the edge rewrites | **no — external** |
| `koa` | 3.2.1 | `dependencies` in all 9 | The HTTP layer; owns `ctx.cookies` | **no — external** |
| `@koa/router` | 15.7.0 | `dependencies` in `public-resource` only | The one service with non-GraphQL routes | **no — external** |
| `redis` | 6.2.0 (6.2.1 in `db-setup`) | `dependencies` in all 9 + `db-setup` | Every session read and write; `@redis/client` is its own transitive at the same version | **no — external** |
| `@sentry/node` | 10.69.0 | `dependencies` in all 9 | Error reporting; the scrubbing rules that keep tokens out of events | **no — external** |
| `@sentry/react` | 10.69.0 | `dependencies` in all 3 frontends | The browser half of the same | **no — external** |
| `@apollo/server` | 5.5.1 | `dependencies` in all 9 | GraphQL transport; brings `body-parser`, `qs` and the protobuf telemetry stack | **no — external** |
| `@socketlabs/email` | 1.4.4 | `dependencies` in **1** service — `marketplace-dev-public-resource`; it was 8 when this table was written and story 1 removed the other seven on 2026-08-13 | Transactional email — registration confirmation and password reset. Pins `axios@^0.21.1` | **no — external, and at its latest published version** |
| `mongoose` | 9.9.1 (9.8.0 in `marketplace-common`) | `dependencies` in 8 services, `devDependencies` in `logout` | The models behind every authenticated read | **no — external** |
| `mongodb` | 7.5.0 | `dependencies` in 6, transitive in the rest | CSFLE's `ClientEncryption` (ADR-029) | **no — external** |
| `uuid` | 14.0.1 | `dependencies` in 8 services | Refresh-token family ids | **no — external** |

**Zero of these carry an open advisory** except `@apollo/server`'s transitives (§4.2) and `@socketlabs/email`'s
`axios` (§4.1). `keygrip`, `cookies`, `koa`, `redis` and both Sentry packages are clean.

**The boundary, stated once so it stops being rediscovered:** everything in the table above except
`@axiumine/marketplace-common` is external and unmodifiable from this workspace. There is no source tree, no fork
and no patch step. The three levers available are (a) a version bump when upstream publishes one, (b) a yarn
`resolutions` entry forcing a transitive — **no repo in this workspace currently has a `resolutions` or `overrides`
block**, so that lever is entirely unused, and (c) deleting the dependency, which §4.1 shows is the right answer
seven times over.

---

## 7. The gate that was supposed to catch this

R21 records "No automated dependency-audit gate for the npm supply chain". That is not quite what is true, and the
truth is worse.

Every repo's `qodana.yaml` runs the `qodana.recommended` profile on the Ultimate JS linter, and `.githooks/pre-commit`
and `.githooks/pre-push` both invoke it. The config is deliberate about it — the comment beside
`dependencyOverrides` says, in the repo's own words:

> This overrides license *metadata* only. The package stays in the SCA pass, so a future CVE in it is still reported.

And `failureConditions.severityThresholds` is `critical: 0, high: 0`, which the config's own comment records as
verified to make the scan exit 255 rather than 0.

So the gate is armed. Here is what it produced, from Qodana's own
`.qodana/results/log/qodana_inspections_summary.csv` in `marketplace-dev-public-resource`, run 2026-08-13 07:50:

```
VulnerableLibrariesLocal;Security;Vulnerable declared dependency;;LOCAL;0.02;0.10%;0;172
NpmVulnerableApiCode;JavaScript and TypeScript/Security;Vulnerable API usage;JavaScript;LOCAL;0.00;0.01%;0;93
```

**172 invocations, 0.02 seconds, 0 problems** — in the repo that installs `axios@0.21.4` as a production dependency
with ten High advisories against it. The run's `qodana-short.sarif.json` closes with `"exitCode": 0` and
`qodanaNewResultSummary: { moderate: 3, total: 3 }`, those three being `DuplicatedCode` notes.

The same inspection, same result, everywhere:

| Repo | `VulnerableLibrariesLocal` invocations | Problems |
|---|---|---|
| `marketplace-common` | 265 | 0 |
| `marketplace-dev-admin-authenticated-resource` | 210 | 0 |
| `marketplace-dev-authenticated-logout` | 84 | 0 |
| `marketplace-dev-public-resource` | 172 | 0 |
| `marketplace-admin` | 304 | 0 |
| `marketplace-user` | 380 | 0 |

⚠️ **This finding states the measurement, not the cause.** Two candidates fit and neither is established here: the
vulnerable-dependency check is an Ultimate Plus feature gated on `QODANA_TOKEN` — which the committed `env`
template carries as an empty key — or the checker's advisory database is not being fetched in the local container.
Either way the observable behaviour is the same and is the thing that matters: **a security inspection that reports
zero is indistinguishable from a passing one**, and two hooks have been reporting green on that basis.

**There is no CI.** No `.github/` directory exists anywhere in the sixteen repos. The hooks are the whole gate
apparatus, which makes a silent inspection inside them the only line there is.

⚠️ **Correction, 2026-09-20 — the sentence above was true when this report was written and is not now.** Every
repo has a `.github/` directory carrying a Scorecard workflow, and fifteen also carry CodeQL
([`ADR-054`](../devprotocol/phase3/adr/ADR-054-the-supply-chain-score-is-a-gate-with-a-floor.md)). Both measure;
neither gates, so the paragraph's actual point — the hooks are the whole gate apparatus — is unchanged, and the
`trivy fs` gate this report's §8 asked for now runs in `pre-push` beside a Scorecard floor gate. Nothing else in
this report is restated: it is a dated scan and the rest of it stands as written.

---

## 8. What this closes, and what it opens

**Closes:** the audit's §5 "No full dependency-tree audit was performed". It has now been performed, with
reachability, across all fourteen repos that have a tree.

**Answers question 3 from [`PLATFORM_OPERATIONS_QUALITY_GATES.md`](../devprotocol/phase5/PLATFORM_OPERATIONS_QUALITY_GATES.md) §6** — *"Who owns the dependency-advisory scan going forward, and does it run in CI?"*:
it does not run in CI, because there is no CI. It runs in two git hooks, via Qodana, and reports nothing (§7).

**Opens — actionable, as stories:**

| # | What | Why it is a story and not a note |
|---|---|---|
| 1 | Remove `@socketlabs/email` from the seven services that never load it **Done 2026-08-13** | Seven `package.json` edits across seven repos plus a parent pointer bump; each needs its own gate run. It came to eight repos and eight commits, because the env contract was corrected in the same story — see the note below |
| 2 | Make the vulnerable-dependency gate actually report | Either fix the Qodana SCA path or add a scan that reports. ⚠️ *"despite the unpublished package (§2)"* dropped 2026-08-27 — the package is published and `yarn audit` runs, so it is a candidate again. Without a reporting gate, every other dependency decision here is unverifiable next month |
| 3 | Move `tsc-alias` to `devDependencies` in the eight services that have it in `dependencies` **Done 2026-08-13** | It is the only reason `picomatch@2.3.1` is a production dependency, and `logout` already shows the correct placement. Eight manifests, eight commits, one pointer bump; `yarn.lock` untouched in all eight, because it records resolutions and not which block declared them |

✅ **Closed 2026-09-06, by the lever this paragraph called untested.** It read: the residual `axios@0.21.4`
in `marketplace-dev-public-resource` after story 1 lands is accepted as a risk row, because
`@socketlabs/email@1.4.4` is the latest published version and pins `^0.21.1`, and the only ways out are a
`resolutions` override forcing `axios@0.33.0` — untested against the SDK — or replacing the email provider.

The override is now in that repo's `package.json` and tested. `resolutions` is a yarn 1 lever and needs no
cooperation from `@socketlabs/email`, whose pin is unchanged and irrelevant. `axios` moves `0.21.4 → 0.33.0` and
`follow-redirects` `1.15.11 → 1.16.0`; the seven packages that appear alongside them — `asynckit`,
`combined-stream`, `delayed-stream`, `es-set-tostringtag`, `form-data`, `hasown`, `proxy-from-env` — are `0.33`'s
own dependencies, and **no other resolved version in the lockfile moves**. The npm bulk advisory endpoint returns
`{}` for all ten. The pinned Trivy container the `pre-push` gate runs exits 1 on the committed lockfile, naming
CVE-2026-44486, 44487, 44492, 44495 and 44496, and exits 0 on this one — this repo was an active push blocker and
is not one now. The suite is unchanged at 611 tests and 100% on all four metrics, because nothing here branches on
the SDK's error shape (`koa-utils` captures it and returns `false`) and every call site is mocked.

⚠️ **The premise that made this an open is gone too.** The paragraph rested on "`yarn install` cannot run here at
all", which was true of the workspace that produced this report and stopped being true with **ADR-037**: the
package is published to `registry.npmjs.org` and every consumer resolves it by name. `yarn install` was run to
produce the lockfile above. **R49 is closed.**

**Corrects R21.** Its evidence column says no audit step was found "beyond lint/coverage/mutation/Qodana". Qodana
*is* the step, it is configured to do exactly this, and it does not work. The row is rewritten rather than closed.
