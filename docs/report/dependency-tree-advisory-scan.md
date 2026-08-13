# Dependency Tree — Advisory Scan and Reachability
# Marketplace

**Status:** finding - closes E18-S04
**Version:** 1.0
**Date:** 2026-08-13
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
   `@sentry/node@10.69.0`, `@axiumine/koa-utils@6.0.0` — not one carries an open advisory. Everything found is in
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

`@axiumine/marketplace-common` is unpublished by design — it is consumed by package name and deployed with
`deploy-local.sh` — and yarn 1 aborts the **entire** audit when any single package fails to resolve against the
registry, rather than skipping it. The failure is identical with `--registry https://registry.npmjs.org` and
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

---

## 4. Production zone — the twenty-nine

### 4.1 `axios@0.21.4` — 23 advisories, 8 services, 1 loader

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
| `picomatch` | 2.3.1 | high + moderate | [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj), [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | `tsc-alias@1.9.1 > chokidar > anymatch` | **no** at runtime — but see below |

### 4.3 The env contract points at the wrong services

Tracing which service loads the email client turned up a mismatch that E18-S03's env contracts encode as if it
were intended. `REQUIRED_ENV_VARS` demands `SOCKETLABS_SERVER_ID` and `SOCKETLABS_SERVER_APIKEY` in:

| Service | Requires the SocketLabs vars | Loads the email module |
|---|---|---|
| `marketplace-dev-authenticated-resource` | **yes** — `src/index.mts:47-48` | no |
| `marketplace-dev-admin-authenticated-resource` | **yes** — `src/index.mts:48-49` | no |
| `marketplace-dev-public-resource` | **no** | **yes** — 4 files |

It is exactly backwards. Two services refuse to boot without credentials for a client they never construct, and
the one service that constructs it will boot happily without them — `SocketLabsLib`'s constructor reads
`` `${process.env.SOCKETLABS_SERVER_APIKEY}` `` into a template literal, so an unset variable becomes the string
`"undefined"` and the failure arrives at the first registration email rather than at startup. That is the precise
failure mode E18-S03 exists to prevent, in the one place it was not applied.

`marketplace-dev-user-authenticated-resource` already removed the four SocketLabs variables from its list, and
`src/index.mts:27` records why: *"owner tier's copy came to demand `SOCKETLABS_SERVER_ID` on a service that sends
no mail."* The same reasoning had not been carried to the two services above.

⚠️ **`tsc-alias` is in `dependencies`, not `devDependencies`, in eight of the nine services.** It is a build-time
tool that rewrites path aliases in `dist/`; nothing imports it at runtime. It is the *only* reason a glob matcher
with a ReDoS advisory counts as a production dependency here.
`marketplace-dev-authenticated-logout` declares it under `devDependencies` — which is the correct placement, and
makes the other eight a copy-paste divergence rather than a decision.

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
| `@axiumine/koa-utils` | 6.0.0 | `dependencies` in all 9 services | Session middleware, the Redis data source, the login/reset/verify flows, `SocketLabsLib`. Hardcodes `redis://` in the cluster branch (R45) | **no — external, unpublished from here, no source in this workspace** |
| `@axiumine/marketplace-common` | 1.0.0 | `dependencies` in all 9 services + all 3 frontends | Session key builders, the encrypted-field map, the shared boundary case list | yes — `BEs/marketplace-common`, deployed with `deploy-local.sh` |
| `keygrip` | 1.1.0 | `dependencies` in 6 services, transitive in 3 | Cookie signing and the rotating key list behind ADR-034 | **no — external** |
| `cookies` | 0.9.1 | transitive in all 9, via `koa` | Writes and reads the signed cookies; the `Secure` attribute the edge rewrites | **no — external** |
| `koa` | 3.2.1 | `dependencies` in all 9 | The HTTP layer; owns `ctx.cookies` | **no — external** |
| `@koa/router` | 15.7.0 | `dependencies` in `public-resource` only | The one service with non-GraphQL routes | **no — external** |
| `redis` | 6.2.0 (6.2.1 in `db-setup`) | `dependencies` in all 9 + `db-setup` | Every session read and write; `@redis/client` is its own transitive at the same version | **no — external** |
| `@sentry/node` | 10.69.0 | `dependencies` in all 9 | Error reporting; the scrubbing rules that keep tokens out of events | **no — external** |
| `@sentry/react` | 10.69.0 | `dependencies` in all 3 frontends | The browser half of the same | **no — external** |
| `@apollo/server` | 5.5.1 | `dependencies` in all 9 | GraphQL transport; brings `body-parser`, `qs` and the protobuf telemetry stack | **no — external** |
| `@socketlabs/email` | 1.4.4 | `dependencies` in 8 services | Transactional email — registration confirmation and password reset. Pins `axios@^0.21.1` | **no — external, and at its latest published version** |
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

---

## 8. What this closes, and what it opens

**Closes:** the audit's §5 "No full dependency-tree audit was performed". It has now been performed, with
reachability, across all fourteen repos that have a tree.

**Answers E18 open question 3** — *"Who owns the dependency-advisory scan going forward, and does it run in CI?"*:
it does not run in CI, because there is no CI. It runs in two git hooks, via Qodana, and reports nothing (§7).

**Opens — actionable, as stories:**

| # | What | Why it is a story and not a note |
|---|---|---|
| 1 | ~~Remove `@socketlabs/email` from the seven services that never load it~~ **Done 2026-08-13, E18-S10** | Seven `package.json` edits across seven repos plus a parent pointer bump; each needs its own gate run. It came to eight repos and eight commits, because the env contract was corrected in the same story — see the note below |
| 2 | Make the vulnerable-dependency gate actually report | Either fix the Qodana SCA path or add a scan that works despite the unpublished package (§2). Without this, every other dependency decision here is unverifiable next month |
| 3 | Move `tsc-alias` to `devDependencies` in the eight services that have it in `dependencies` | It is the only reason `picomatch@2.3.1` is a production dependency, and `logout` already shows the correct placement |

**Opens — accepted, as a risk row:** the residual `axios@0.21.4` in `marketplace-dev-public-resource` after story 1
lands. `@socketlabs/email@1.4.4` is the latest published version and pins `^0.21.1`; the only ways out are a
`resolutions` override forcing `axios@0.33.0` — untested against the SDK — or replacing the email provider.
Recorded as **R49**.

**Corrects R21.** Its evidence column says no audit step was found "beyond lint/coverage/mutation/Qodana". Qodana
*is* the step, it is configured to do exactly this, and it does not work. The row is rewritten rather than closed.
