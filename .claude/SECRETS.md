# Secret handling — what is enforced

A secret printed into a Claude Code session is leaked twice over: the tool result is sent to the model
API, and the transcript is written unencrypted to `~/.claude/projects/<slug>/*.jsonl` (mode `0600`, kept
`cleanupPeriodDays` days). There is no un-send and no redaction pass. So the protection has to stop the
call *before* it runs, which is what these layers do.

Machine-scoped (they apply in every project, not just Marketplace) unless noted.

## 1. `permissions.deny` — `~/.claude/settings.json`

Denies the `Read` tool on `**/.env`, `**/.env.*`, `**/.envrc`, `**/.npmrc`, `**/.yarnrc`,
`**/.yarnrc.yml`, `**/.netrc`, `**/.pgpass`, `**/*.pem`, `**/*.p12`, `**/id_rsa`, `**/id_ed25519`,
`~/.ssh/**`. Cheap, declarative, and independent of hooks — it still holds if hooks are disabled.

Does **not** cover shell access, which is why layer 2 exists.

## 2. `no-secret-leak` PreToolUse hook — `~/.claude/hooks/no-secret-leak.cjs`

Matcher `Bash|Read|Grep|NotebookEdit`. Denies:

|Case|Example|
|---|---|
|content read of a secret file|`cat .env`, `head .npmrc`, `sed -n 1,5p .env`|
|indirection|`echo $(cat .env)`, `find . -name .env \| xargs cat`|
|copy / transmit|`cp .env /tmp/x`, `scp`, `curl -F f=@.env`, `tar … \| nc`|
|staging|`git add .env`|
|shell expansion of a protected var|`echo $KEYGRIP_KEY_1`, `printenv QODANA_TOKEN`|
|bare environment dump|`printenv`, `env \| grep …`|
|inline interpreter lookup|`node -e "…process.env.MONGODB_URI"`, `python3 -c "…os.environ['REDIS_PASSWORD']"`|
|protected-value retrieval|`npm config get //registry.npmjs.org/:_authToken`|

Allowed on purpose: metadata verbs (`ls`, `stat`, `wc`, `md5sum`, `file`, `git check-ignore`,
`git ls-files`), key-name extraction (`grep -oE '^[A-Za-z_0-9]+' .env`, `cut -d= -f1`, `grep -c`), and
writing source that merely *mentions* `process.env.X` without an interpreter evaluating it.

Fail-closed by design: when a secret path appears in a command, only that allowlist passes, and a crash
in the hook itself denies rather than waves the call through. 41 cases in
`scratchpad/guard-cases.txt` cover both directions.

**Known limit:** the hook inspects the *command line*, not the contents of a script it launches.
`bash leak.sh`, where `leak.sh` contains `cat .env`, is not caught. Only output-side redaction would
close that, and no such hook point exists — so treat it as a real gap rather than a solved problem.

## 3. `pre-commit` guard — installed in all 11 repos

Blocks a commit when a staged **path** looks like a secret file, or when staged **added lines** contain a
high-entropy secret: real npm token (`npm_` + 36), UUID/JWT `_authToken`, `-----BEGIN … PRIVATE KEY-----`,
a 40+ char non-placeholder `KEYGRIP_KEY_*`, a `QODANA_TOKEN`/`SOCKETLABS_SERVER_APIKEY`/`REDIS_PASSWORD`/
`INTROSPECTION_CODE` literal ≥16 chars, or a mongodb URI with a ≥10 char password.

Patterns were tuned against the whole tracked corpus of all 11 repos so the committed `env` and `npmrc`
placeholder templates pass — a guard that cries wolf gets disabled. Vendored scanner rulesets
(`semgrep/vendor/`) are skipped. Escape hatch: `git commit --no-verify`.

**Declared-placeholder filter.** A line whose *entire* content is a placeholder assignment —
`KEY=test-…` / `KEY: 'test-…'`, also `dummy` / `fake` / `sample` / `example` / `placeholder` /
`changeme` / `your-` — is dropped before the value scan (`$PLACEHOLDER` in the hook). It exists because
the vitest fixture that assigns `INTROSPECTION_CODE` a `test-` prefixed literal tripped the
`INTROSPECTION_CODE` literal rule, which forced `--no-verify` on every commit touching a vitest config.
The regex is anchored at **both** ends, so it can only whitelist a self-declared placeholder line — never
a secret embedded in a URI, an object literal, or any longer expression. Verified against the tracked
corpus of all 11 repos: the only lines whose verdict changes are the two `vitest.config.mts` fixtures;
the live-looking credentials in `marketplace-db-setup/setup/mongodb.js` still block.

Tracked at `.githooks/pre-commit` in **all 11 repos**, each setting `core.hooksPath=.githooks`. The ten
repos that have a `package.json` set it from their `prepare` script, so installing dependencies arms the
guard and a fresh clone is protected without anyone remembering to install it by hand.

⚠️ This parent workspace has no `package.json`, so nothing runs `prepare` here. The hook file is tracked
and travels with the clone, but after cloning the parent you must arm it once by hand:

```bash
git config core.hooksPath .githooks
```

Once `hooksPath` is set, `.git/hooks/pre-commit` never runs, so the old untracked copy was deleted in
every repo rather than left to drift out of sync with the tracked one. Each repo now holds exactly one
copy, all 11 byte-identical; a fix to one must be copied to all.

## 4. Git ignore, two levels

- `~/.config/git/ignore` — machine-wide, so a repo created tomorrow ignores `.env` before anyone thinks
  about it. Git reads this XDG path natively; no `core.excludesfile` needed.
- The parent workspace `.gitignore` — was the one repo of the eleven that did **not** ignore `.env`.
  Fixed. All ten sub-repos already did.

Verified: no `.env` is tracked in any of the 11 repos, and none appears anywhere in their histories.

## Not fixed here

`BEs/marketplace-db-setup/setup/mongodb.js` is tracked and contains live-looking database
credentials in `mongodb+srv://` URIs (`marketplaceRwDev`, and `uOwnerDbWetrade` — a *different* project's
owner account). Rotate those and move them to `.env`; the pre-commit guard will block the next edit to
those lines until the values are gone.
