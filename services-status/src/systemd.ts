import { execFile } from 'child_process';
import { promisify } from 'util';
import { Action, SystemctlScope } from './types';

// The only place in this codebase that shells out, and it never does so via a shell: every call
// below is execFile with an argv array, so a unit/action string can never be interpreted as
// shell syntax no matter what it contains. Callers are still responsible for only ever passing a
// unit name that came from services.json (see config.ts) — this module trusts its arguments.
const execFileAsync = promisify(execFile);

export interface UnitShowResult {
  id: string;
  loadState: string;
  activeState: string;
  subState: string;
  unitFileState: string;
  mainPid: number | null;
  nRestarts: number;
  memoryBytes: number | null;
  cpuNs: number | null;
  since: number | null;
  // Populated only when systemctl itself failed for this unit (ENOENT, timeout, non-zero exit
  // on the whole batch) — a unit systemd simply doesn't know about is not an error, it's a
  // legitimate LoadState=not-found block, handled by the health derivation in monitor.ts.
  error: string | null;
}

export interface ControlResult {
  ok: boolean;
  message: string;
}

const SHOW_PROPERTIES = [
  'Id',
  'LoadState',
  'ActiveState',
  'SubState',
  'UnitFileState',
  'MemoryCurrent',
  'CPUUsageNSec',
  'MainPID',
  'NRestarts',
  'ActiveEnterTimestamp',
  'ExecMainStartTimestamp'
];

const SHOW_TIMEOUT_MS = 10_000;
const CONTROL_TIMEOUT_MS = 10_000;
const LOGS_TIMEOUT_MS = 15_000;
const DEFAULT_LOG_LINES = 200;
const MIN_LOG_LINES = 1;
const MAX_LOG_LINES = 2000;
// 2000 lines of journalctl --output=short-iso, including the occasional tsx/vite stack trace,
// stays comfortably under this — far above Node's ~1MB exec default, which would otherwise
// truncate a busy service's log tail with a MAXBUFFER error.
const LOGS_MAX_BUFFER = 16 * 1024 * 1024;

function scopeFlag(scope: SystemctlScope): string[] {
  return scope === 'user' ? ['--user'] : [];
}

// systemctl/journalctl absence (ENOENT) and "ran but exited non-zero" need different messages;
// centralizing the translation keeps every exported function reporting failures the same way.
function describeExecError(err: unknown, binary: string): string {
  const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
  if (e && e.code === 'ENOENT') {
    return `${binary} not found on PATH — is this a systemd host?`;
  }
  const stderr = typeof e?.stderr === 'string' ? e.stderr.trim() : '';
  if (stderr) return stderr;
  return e instanceof Error ? e.message : String(err);
}

function clampLogLines(requested: number): number {
  if (!Number.isFinite(requested)) return DEFAULT_LOG_LINES;
  return Math.min(MAX_LOG_LINES, Math.max(MIN_LOG_LINES, Math.trunc(requested)));
}

function parseNumericProperty(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '[not set]') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/**
 * systemctl show's default timestamp format is locale-dependent free text, e.g.
 * 'Thu 2026-08-06 08:09:21 CEST'. Both the leading weekday and the trailing zone abbreviation
 * vary with locale/TZ and the abbreviation alone is not reliably re-parseable (e.g. 'CST' maps
 * to three different UTC offsets depending on region). Rather than guess an offset, this pulls
 * out just the 'YYYY-MM-DD HH:MM:SS' core and interprets it as local time on this host — correct
 * as long as the monitor and the systemd instance it queries share a timezone, which they always
 * do here since both run on the same machine. Anything that doesn't match the expected shape
 * (including '[not set]'/'') returns null, never NaN — a bad date must never silently become
 * "epoch zero" uptime.
 */
function parseSystemdTimestamp(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === '[not set]' || trimmed === 'n/a') return null;
  const match = trimmed.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/);
  if (!match) return null;
  const ms = Date.parse(`${match[1]}T${match[2]}`);
  return Number.isNaN(ms) ? null : ms;
}

function parseShowBlock(block: string): Record<string, string> {
  const record: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    record[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return record;
}

function toUnitShowResult(record: Record<string, string>): UnitShowResult {
  const mainPidRaw = parseNumericProperty(record.MainPID);
  return {
    id: record.Id ?? '',
    loadState: record.LoadState ?? 'error',
    activeState: record.ActiveState ?? 'unknown',
    subState: record.SubState ?? 'unknown',
    unitFileState: record.UnitFileState ?? '',
    // systemctl reports MainPID=0 for a unit with no running main process — 0 is not a real pid.
    mainPid: mainPidRaw && mainPidRaw > 0 ? mainPidRaw : null,
    nRestarts: parseNumericProperty(record.NRestarts) ?? 0,
    memoryBytes: parseNumericProperty(record.MemoryCurrent),
    cpuNs: parseNumericProperty(record.CPUUsageNSec),
    since: parseSystemdTimestamp(record.ActiveEnterTimestamp) ?? parseSystemdTimestamp(record.ExecMainStartTimestamp),
    error: null
  };
}

function errorResult(unit: string, message: string): UnitShowResult {
  return {
    id: unit,
    loadState: 'error',
    activeState: 'unknown',
    subState: 'unknown',
    unitFileState: '',
    mainPid: null,
    nRestarts: 0,
    memoryBytes: null,
    cpuNs: null,
    since: null,
    error: message
  };
}

/**
 * One batched `systemctl show` call for every monitored unit per poll tick, instead of one call
 * per unit — this replaces the old per-client-per-second exec storm. Blocks are matched back to
 * the requested unit list by the Id= field systemd itself reports in each block, never by array
 * position: position happening to match request order today is not a documented guarantee,
 * Id= matching is.
 */
export async function showUnits(units: string[], scope: SystemctlScope): Promise<Map<string, UnitShowResult>> {
  const result = new Map<string, UnitShowResult>();
  if (units.length === 0) return result;

  const args = [...scopeFlag(scope), 'show', ...units, ...SHOW_PROPERTIES.flatMap((p) => ['-p', p])];

  let stdout: string;
  try {
    const r = await execFileAsync('systemctl', args, { timeout: SHOW_TIMEOUT_MS });
    stdout = r.stdout;
  } catch (err) {
    // The whole batch failed (systemctl missing, timed out, or crashed) — every requested unit
    // gets an error entry rather than being silently absent, so monitor.ts can still build a
    // ServiceState (health 'missing') for each one instead of dropping it from the response.
    const message = describeExecError(err, 'systemctl');
    for (const unit of units) result.set(unit, errorResult(unit, message));
    return result;
  }

  const blocks = stdout
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  for (const block of blocks) {
    const record = parseShowBlock(block);
    if (!record.Id) continue; // a block we can't attribute to any unit is dropped, not guessed at
    result.set(record.Id, toUnitShowResult(record));
  }

  // Defensive: a requested unit missing from the output (should not happen in practice) still
  // gets a result, so every caller can always index the map by the full requested unit list.
  for (const unit of units) {
    if (!result.has(unit)) result.set(unit, errorResult(unit, 'systemctl show returned no block for this unit'));
  }

  return result;
}

/** Start/stop/restart one unit. Never throws — failure is reported via {ok:false, message}. */
export async function controlUnit(unit: string, action: Action, scope: SystemctlScope): Promise<ControlResult> {
  const args = [...scopeFlag(scope), action, unit];
  try {
    await execFileAsync('systemctl', args, { timeout: CONTROL_TIMEOUT_MS });
    return { ok: true, message: `${unit}: ${action} succeeded` };
  } catch (err) {
    return { ok: false, message: describeExecError(err, 'systemctl') };
  }
}

/** Last N journal lines for a unit. Never throws — a failure comes back as one explanatory line. */
export async function unitLogs(unit: string, requestedLines: number, scope: SystemctlScope): Promise<string[]> {
  const lines = clampLogLines(requestedLines);
  const args = [...scopeFlag(scope), '-u', unit, '-n', String(lines), '--no-pager', '--output=short-iso'];
  try {
    const r = await execFileAsync('journalctl', args, { timeout: LOGS_TIMEOUT_MS, maxBuffer: LOGS_MAX_BUFFER });
    const raw = r.stdout.split('\n');
    if (raw.length > 0 && raw[raw.length - 1] === '') raw.pop(); // trailing newline from journalctl's own output
    return raw;
  } catch (err) {
    // Logs are a read-only convenience feature — surface the failure as a single log-shaped
    // line instead of throwing, so callers can stay 200/ok and the drawer just shows why.
    return [`(failed to read logs: ${describeExecError(err, 'journalctl')})`];
  }
}

export async function daemonReload(scope: SystemctlScope): Promise<ControlResult> {
  const args = [...scopeFlag(scope), 'daemon-reload'];
  try {
    await execFileAsync('systemctl', args, { timeout: CONTROL_TIMEOUT_MS });
    return { ok: true, message: 'daemon-reload succeeded' };
  } catch (err) {
    return { ok: false, message: describeExecError(err, 'systemctl') };
  }
}

export async function isEnabled(unit: string, scope: SystemctlScope): Promise<string> {
  const args = [...scopeFlag(scope), 'is-enabled', unit];
  try {
    const r = await execFileAsync('systemctl', args, { timeout: CONTROL_TIMEOUT_MS });
    return r.stdout.trim();
  } catch (err) {
    // `systemctl is-enabled` exits non-zero for perfectly normal states (disabled, static) and
    // still prints the state to stdout in that case — recover it from the error object instead
    // of treating every non-zero exit as a hard failure.
    const e = err as NodeJS.ErrnoException & { stdout?: string };
    if (typeof e.stdout === 'string' && e.stdout.trim()) return e.stdout.trim();
    if (e && e.code === 'ENOENT') return 'unknown (systemctl not found)';
    return 'unknown';
  }
}
