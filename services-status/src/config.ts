import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AppConfig, GroupDescriptor, ServiceDescriptor, SystemctlScope } from './types';

// ---------------------------------------------------------------------------
// services.json location
// ---------------------------------------------------------------------------

/**
 * services.json lives at the project root (services-status/), one level above src/. At runtime
 * __dirname is dist/ (compiled, `yarn start`) or src/ (tsx/ts-node-dev, `yarn dev`) — both are
 * exactly one level below the project root today, so '../services.json' resolves correctly in
 * both. The '../../services.json' candidate is a safety net, not the expected path: it only
 * matters if a future tsconfig change nests the compiled output one level deeper (e.g. an
 * accidental rootDir that includes an extra segment) and lets that mistake fail with a clear
 * "not found" message instead of resolving to the wrong file silently.
 */
function findServicesJsonPath(): string {
  const candidates = [path.resolve(__dirname, '..', 'services.json'), path.resolve(__dirname, '..', '..', 'services.json')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`[config] could not find services.json — looked in:\n  ${candidates.join('\n  ')}`);
}

// ---------------------------------------------------------------------------
// services.json validation — fail fast, name the offending JSON pointer
// ---------------------------------------------------------------------------

function fail(servicesJsonPath: string, pointer: string, detail: string): never {
  throw new Error(`[config] ${servicesJsonPath}#${pointer}: ${detail}`);
}

function joinPointer(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function describeType(value: unknown): string {
  // No `undefined` arm: `typeof undefined` is already the string 'undefined', so the fall-through
  // at the bottom answers it. `null` needs one because `typeof null` is 'object'.
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') return `string ${JSON.stringify(value)}`;
  if (t === 'number' || t === 'boolean') return `${t} ${String(value)}`;
  if (Array.isArray(value)) return `array(length ${value.length})`;
  return t; // 'object' etc. — never dump arbitrary nested content into an error message
}

function expectObject(value: unknown, servicesJsonPath: string, pointer: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(servicesJsonPath, pointer, `must be an object, got ${describeType(value)}`);
  }
  return value as Record<string, unknown>;
}

function expectArray(obj: Record<string, unknown>, key: string, servicesJsonPath: string, parentPointer: string): unknown[] {
  const pointer = joinPointer(parentPointer, key);
  const value = obj[key];
  if (!Array.isArray(value)) fail(servicesJsonPath, pointer, `must be an array, got ${describeType(value)}`);
  return value;
}

function expectString(obj: Record<string, unknown>, key: string, servicesJsonPath: string, parentPointer: string): string {
  const pointer = joinPointer(parentPointer, key);
  const value = obj[key];
  if (typeof value !== 'string' || value.length === 0) {
    fail(servicesJsonPath, pointer, `must be a non-empty string, got ${describeType(value)}`);
  }
  return value;
}

function expectOptionalString(
  obj: Record<string, unknown>,
  key: string,
  servicesJsonPath: string,
  parentPointer: string
): string | undefined {
  const pointer = joinPointer(parentPointer, key);
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length === 0) {
    fail(servicesJsonPath, pointer, `must be a non-empty string when present, got ${describeType(value)}`);
  }
  return value;
}

function expectNullableNumber(obj: Record<string, unknown>, key: string, servicesJsonPath: string, parentPointer: string): number | null {
  const pointer = joinPointer(parentPointer, key);
  const value = obj[key];
  if (value === undefined) fail(servicesJsonPath, pointer, 'is required (use null, not omission, for "no port")');
  if (value === null) return null;
  if (typeof value !== 'number') fail(servicesJsonPath, pointer, `must be a number or null, got ${describeType(value)}`);
  // Split from the check above rather than or-ed into it, because the two reject different files
  // and deserve different messages: a string port is a typo, while Infinity is what JSON.parse
  // hands back for any literal too large to represent (1e999) and would otherwise sail through
  // `typeof value === 'number'` straight into a URL as "http://127.0.0.1:Infinity".
  if (!Number.isFinite(value)) fail(servicesJsonPath, pointer, `must be a finite number, got ${describeType(value)}`);
  return value;
}

function expectKind(obj: Record<string, unknown>, key: string, servicesJsonPath: string, parentPointer: string): 'backend' | 'frontend' {
  const pointer = joinPointer(parentPointer, key);
  const value = obj[key];
  if (value !== 'backend' && value !== 'frontend') {
    fail(servicesJsonPath, pointer, `must be "backend" or "frontend", got ${describeType(value)}`);
  }
  return value; // narrowed to the literal union by the check above (not a raw `unknown` cast)
}

interface ParsedServicesJson {
  workspaceRoot: string;
  unitTarget: string;
  monitorUnit: string;
  groups: GroupDescriptor[];
  services: ServiceDescriptor[];
  serviceMap: Map<string, ServiceDescriptor>;
  groupMap: Map<string, GroupDescriptor>;
  serviceHosts: Map<string, string>;
}

function parseServicesJson(raw: unknown, servicesJsonPath: string, projectRoot: string): ParsedServicesJson {
  const root = expectObject(raw, servicesJsonPath, '');
  const workspaceRootRaw = expectString(root, 'workspaceRoot', servicesJsonPath, '');
  // Validated for shape even though config.ts itself never reads them — services.json is the
  // shared source of truth for two consumers (this file and systemd/generate.mjs), and a
  // malformed nodeVersion/nvmDir should fail here rather than surface as a confusing unit-file
  // bug only when the generator runs.
  expectString(root, 'nodeVersion', servicesJsonPath, '');
  expectString(root, 'nvmDir', servicesJsonPath, '');
  const unitTarget = expectString(root, 'unitTarget', servicesJsonPath, '');
  const monitorUnit = expectString(root, 'monitorUnit', servicesJsonPath, '');
  const rawGroups = expectArray(root, 'groups', servicesJsonPath, '');
  if (rawGroups.length === 0) fail(servicesJsonPath, 'groups', 'must contain at least one group');

  const workspaceRootOverride = process.env.WORKSPACE_ROOT;
  const workspaceRoot = workspaceRootOverride ? path.resolve(workspaceRootOverride) : path.resolve(projectRoot, workspaceRootRaw);

  const groups: GroupDescriptor[] = [];
  const services: ServiceDescriptor[] = [];
  const serviceMap = new Map<string, ServiceDescriptor>();
  const groupMap = new Map<string, GroupDescriptor>();
  const serviceHosts = new Map<string, string>();

  rawGroups.forEach((rawGroupUnknown, gi) => {
    const groupPointer = `groups[${gi}]`;
    const rawGroup = expectObject(rawGroupUnknown, servicesJsonPath, groupPointer);
    const groupId = expectString(rawGroup, 'id', servicesJsonPath, groupPointer);
    if (groupMap.has(groupId)) fail(servicesJsonPath, joinPointer(groupPointer, 'id'), `duplicate group id "${groupId}"`);
    const title = expectString(rawGroup, 'title', servicesJsonPath, groupPointer);
    const description = expectString(rawGroup, 'description', servicesJsonPath, groupPointer);
    const rawServices = expectArray(rawGroup, 'services', servicesJsonPath, groupPointer);
    if (rawServices.length === 0) fail(servicesJsonPath, joinPointer(groupPointer, 'services'), 'must contain at least one service');

    const serviceIds: string[] = [];

    rawServices.forEach((rawServiceUnknown, si) => {
      const servicePointer = `${joinPointer(groupPointer, 'services')}[${si}]`;
      const rawService = expectObject(rawServiceUnknown, servicesJsonPath, servicePointer);
      const id = expectString(rawService, 'id', servicesJsonPath, servicePointer);
      if (serviceMap.has(id)) fail(servicesJsonPath, joinPointer(servicePointer, 'id'), `duplicate service id "${id}"`);
      const label = expectString(rawService, 'label', servicesJsonPath, servicePointer);
      const repo = expectString(rawService, 'repo', servicesJsonPath, servicePointer);
      const kind = expectKind(rawService, 'kind', servicesJsonPath, servicePointer);
      // 'script' belongs to systemd/generate.mjs (ExecStart), not the monitor server — validated
      // for shape only, so a bad services.json fails here rather than only in the generator.
      expectString(rawService, 'script', servicesJsonPath, servicePointer);
      const port = expectNullableNumber(rawService, 'port', servicesJsonPath, servicePointer);
      const svcPath = expectString(rawService, 'path', servicesJsonPath, servicePointer);
      const description2 = expectString(rawService, 'description', servicesJsonPath, servicePointer);
      const host = expectOptionalString(rawService, 'host', servicesJsonPath, servicePointer) ?? '127.0.0.1';
      // Reserved for a future HTTP health probe (see ServiceDescriptor comment in CONTRACT.md);
      // validated for shape only since nothing here reads it yet.
      expectOptionalString(rawService, 'healthPath', servicesJsonPath, servicePointer);

      const unit = `${id}.service`;
      const url = port === null ? null : `http://${host}:${port}${svcPath}`;

      const descriptor: ServiceDescriptor = {
        id,
        unit,
        label,
        groupId,
        kind,
        repo,
        port,
        url,
        description: description2
      };

      services.push(descriptor);
      serviceMap.set(id, descriptor);
      serviceHosts.set(id, host);
      serviceIds.push(id);
    });

    const group: GroupDescriptor = { id: groupId, title, description, serviceIds };
    groups.push(group);
    groupMap.set(groupId, group);
  });

  return { workspaceRoot, unitTarget, monitorUnit, groups, services, serviceMap, groupMap, serviceHosts };
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function parseBoolEnv(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw.trim() === '') return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  throw new Error(`[config] env ${name}=${JSON.stringify(raw)} is not a valid boolean (use true/false)`);
}

function parseIntEnv(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) throw new Error(`[config] env ${name}=${JSON.stringify(raw)} is not a valid integer`);
  return n;
}

function parseScopeEnv(raw: string | undefined): SystemctlScope {
  const v = (raw ?? 'user').trim();
  if (v !== 'user' && v !== 'system') {
    throw new Error(`[config] env SYSTEMCTL_SCOPE=${JSON.stringify(raw)} must be "user" or "system"`);
  }
  return v;
}

interface EnvConfig {
  port: number;
  host: string;
  bindAll: boolean;
  behindProxy: boolean;
  proxyProtocol: string;
  domain: string;
  systemctlScope: SystemctlScope;
  pollIntervalMs: number;
  probeTimeoutMs: number;
  logLines: number;
  authToken: string | null;
  allowedHosts: string[];
}

// Extra Host header values to trust, beyond the loopback names + DOMAIN + HOST that are always
// accepted. Only needed when the page is reached under a name this process cannot derive on its
// own — most often BIND_ALL=true reached at a LAN IP, or a second vhost in front of it. Comma
// separated; a bare hostname or an IP, never a scheme or a port ("status.lan", "192.168.1.10").
function parseAllowedHostsEnv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);
}

function loadEnv(): EnvConfig {
  const bindAll = parseBoolEnv('BIND_ALL', process.env.BIND_ALL, false);
  const authTokenRaw = process.env.AUTH_TOKEN;
  // '' is not a token. It has to read as "no auth configured", never as a secret the auth
  // middleware then compares every request against — timingSafeTokenEquals answers true for an
  // empty header against an empty secret, so an empty AUTH_TOKEN would authenticate everyone.
  const authToken = authTokenRaw === undefined || authTokenRaw === '' ? null : authTokenRaw;

  // This page starts and stops production-adjacent processes. Binding beyond loopback with no
  // token turns that into an open door for anyone who can reach the port — refuse at startup,
  // not at the first unauthenticated request.
  if (bindAll && !authToken) {
    throw new Error(
      '[config] BIND_ALL=true requires a non-empty AUTH_TOKEN — refusing to bind beyond 127.0.0.1 without auth. Set AUTH_TOKEN in .env or leave BIND_ALL=false.'
    );
  }

  // HOST is only consulted once BIND_ALL has said it's safe to leave loopback; otherwise the
  // bind address is forced to 127.0.0.1 no matter what HOST is set to, so a stray
  // HOST=0.0.0.0 left in the environment can never widen the bind on its own.
  const host = bindAll ? process.env.HOST || '0.0.0.0' : '127.0.0.1';

  return {
    port: parseIntEnv('PORT', process.env.PORT, 2901),
    host,
    bindAll,
    behindProxy: parseBoolEnv('BEHIND_PROXY', process.env.BEHIND_PROXY, false),
    proxyProtocol: process.env.PROXY_PROTOCOL || 'http',
    domain: process.env.DOMAIN || 'localhost',
    systemctlScope: parseScopeEnv(process.env.SYSTEMCTL_SCOPE),
    pollIntervalMs: parseIntEnv('POLL_INTERVAL_MS', process.env.POLL_INTERVAL_MS, 2000),
    probeTimeoutMs: parseIntEnv('PROBE_TIMEOUT_MS', process.env.PROBE_TIMEOUT_MS, 500),
    logLines: parseIntEnv('LOG_LINES', process.env.LOG_LINES, 200),
    authToken,
    allowedHosts: parseAllowedHostsEnv(process.env.ALLOWED_HOSTS)
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Loads and validates .env + services.json into one AppConfig. Throws synchronously with a
 * precise, actionable message on any shape/env problem — callers should let this crash the
 * process at startup rather than catching and continuing with partial config.
 */
export function loadConfig(): AppConfig {
  dotenv.config();

  const servicesJsonPath = findServicesJsonPath();
  const projectRoot = path.dirname(servicesJsonPath);

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(servicesJsonPath, 'utf8'));
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`[config] ${servicesJsonPath} is not valid JSON: ${reason}`);
  }

  const parsed = parseServicesJson(raw, servicesJsonPath, projectRoot);
  const env = loadEnv();

  return { ...env, ...parsed, servicesJsonPath };
}
