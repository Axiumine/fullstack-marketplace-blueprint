import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import net from 'net';
import WebSocket from 'ws';

import {
  assertSameOrigin,
  assertTrustedHost,
  attachWebSocket,
  buildTrustedHosts,
  createHttpApp,
  createServer,
  createShutdown,
  extractToken,
  hostnameOnly,
  isAction,
  isPlainObject,
  isTrustedOrigin,
  main,
  printBanner,
  ServerParts
} from '../src/server';
import { Monitor } from '../src/monitor';
import { AppConfig, GroupDescriptor, ServiceDescriptor, ServiceState } from '../src/types';

// systemd is faked wholesale: every route and every WS frame below ends in controlUnit or
// unitLogs, and letting those reach the real systemctl would make the assertions depend on which
// units happen to exist on the machine running the suite — and would start and stop them.
vi.mock('../src/systemd', () => ({
  controlUnit: vi.fn(async () => ({ ok: true, message: 'ok' })),
  unitLogs: vi.fn(async () => ['line one', 'line two']),
  showUnits: vi.fn(async () => new Map())
}));

// Only main() builds a real monitor, and a real monitor probes every configured port. Faking the
// probe keeps this suite from opening sockets at whatever happens to be listening on 4027 here.
vi.mock('../src/probe', () => ({ probeTcp: vi.fn(async () => false) }));

// loadConfig is only reached by main(); mocking it keeps that one test off the real services.json
// (and off the real .env, which carries a live AUTH_TOKEN on this machine).
vi.mock('../src/config', () => ({ loadConfig: vi.fn() }));

const { controlUnit, unitLogs } = await import('../src/systemd');
const { loadConfig } = await import('../src/config');

const controlUnitMock = vi.mocked(controlUnit);
const unitLogsMock = vi.mocked(unitLogs);
const loadConfigMock = vi.mocked(loadConfig);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const service = (patch: Partial<ServiceDescriptor> = {}): ServiceDescriptor => ({
  id: 'api',
  unit: 'api.service',
  label: 'API',
  groupId: 'core',
  kind: 'backend',
  repo: 'BEs/dev/api',
  port: 4027,
  url: 'http://127.0.0.1:4027/api',
  description: 'The API',
  ...patch
});

const SERVICES: ServiceDescriptor[] = [
  service(),
  service({ id: 'web', unit: 'web.service', label: 'Web', kind: 'frontend', repo: 'web', port: 3045, url: 'http://127.0.0.1:3045' })
];

const GROUPS: GroupDescriptor[] = [{ id: 'core', title: 'Core', description: 'Everything', serviceIds: ['api', 'web'] }];

const stateFor = (id: string, patch: Partial<ServiceState> = {}): ServiceState => ({
  id,
  unit: `${id}.service`,
  loadState: 'loaded',
  activeState: 'active',
  subState: 'running',
  unitFileState: 'enabled',
  health: 'up',
  running: true,
  mainPid: 1234,
  nRestarts: 0,
  memoryBytes: null,
  memory: null,
  cpuNs: null,
  since: null,
  uptime: null,
  portOpen: true,
  error: null,
  ...patch
});

const configOf = (patch: Partial<AppConfig> = {}): AppConfig =>
  ({
    port: 2901,
    host: '127.0.0.1',
    bindAll: false,
    behindProxy: false,
    proxyProtocol: 'http',
    domain: '',
    systemctlScope: 'user',
    pollIntervalMs: 60_000,
    probeTimeoutMs: 500,
    logLines: 200,
    authToken: null,
    allowedHosts: [],
    workspaceRoot: '/workspace',
    servicesJsonPath: '/workspace/marketplace-services-status/services.json',
    unitTarget: 'marketplace.target',
    monitorUnit: 'marketplace-status.service',
    groups: GROUPS,
    services: SERVICES,
    serviceMap: new Map(SERVICES.map((s) => [s.id, s])),
    groupMap: new Map(GROUPS.map((g) => [g.id, g])),
    serviceHosts: new Map(SERVICES.map((s) => [s.id, '127.0.0.1'])),
    ...patch
  }) as AppConfig;

interface FakeMonitor extends Monitor {
  listeners: Set<(states: ServiceState[]) => void>;
  emit: (states: ServiceState[]) => void;
  refreshCount: () => number;
}

const fakeMonitor = (states: ServiceState[] = [stateFor('api'), stateFor('web')]): FakeMonitor => {
  const listeners = new Set<(s: ServiceState[]) => void>();
  let refreshes = 0;
  return {
    getStates: () => states,
    refreshNow: async () => {
      refreshes += 1;
      return states;
    },
    subscribe: (listener) => {
      listeners.add(listener);
    },
    unsubscribe: (listener) => {
      listeners.delete(listener);
    },
    stop: vi.fn(),
    listeners,
    emit: (next) => {
      for (const listener of listeners) listener(next);
    },
    refreshCount: () => refreshes
  };
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

const deferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

// ---------------------------------------------------------------------------
// Driving the thing over a real socket, in-process.
//
// Not a spawned `dist/server.js` like security.test.ts does: a child process is opaque to the
// coverage reporter, which is how a suite that exercised most of this file could still report 10%.
// Same server, same sockets, same guards — just inside the runner.
// ---------------------------------------------------------------------------

const listening: http.Server[] = [];

const listen = async (server: http.Server): Promise<number> => {
  listening.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address !== 'object' || !address) throw new Error('server did not report an address');
  return address.port;
};

interface Started {
  port: number;
  parts: ServerParts;
  monitor: FakeMonitor;
}

const startServer = async (config: AppConfig = configOf(), monitor: FakeMonitor = fakeMonitor()): Promise<Started> => {
  const parts = createServer(config, monitor);
  const port = await listen(parts.httpServer);
  return { port, parts, monitor };
};

interface Response {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  json: <T>() => T;
}

const request = (port: number, method: string, reqPath: string, headers: Record<string, string> = {}): Promise<Response> =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: reqPath, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        body += chunk;
      });
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body,
          json: <T>() => JSON.parse(body) as T
        })
      );
    });
    req.on('error', reject);
    req.end();
  });

const get = (port: number, reqPath: string, headers: Record<string, string> = {}): Promise<Response> =>
  request(port, 'GET', reqPath, headers);

// Every POST here is legitimate unless a test says otherwise, so the CSRF guard needs a trusted
// Origin — the guard itself is exercised on its own further down.
const post = (port: number, reqPath: string, headers: Record<string, string> = {}): Promise<Response> =>
  request(port, 'POST', reqPath, { Origin: `http://127.0.0.1:${port}`, ...headers });

afterEach(async () => {
  await Promise.all(listening.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  vi.useRealTimers();
});

beforeEach(() => {
  controlUnitMock.mockReset();
  unitLogsMock.mockReset();
  controlUnitMock.mockResolvedValue({ ok: true, message: 'ok' });
  unitLogsMock.mockResolvedValue(['line one', 'line two']);
});

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// The guards on their own. Every one of them is exported for this: a request can only ever
// carry the shapes an HTTP client and a browser agree to send, and half of what these have to
// refuse is not among them.
// ---------------------------------------------------------------------------

describe('isAction', () => {
  it.each([
    ['start', true],
    ['stop', true],
    ['restart', true],
    // :action goes straight into systemctl's argv, so the allowlist is the whole defence.
    ['mask', false],
    ['kill', false],
    ['--user=root', false],
    // Case-sensitively: 'START' is not the verb, and systemctl would not take it either.
    ['START', false],
    ['', false]
  ])('answers %s with %s', (value, expected) => {
    expect(isAction(value)).toBe(expected);
  });

  // A WS frame is parsed JSON, so `action` arrives as whatever the sender put there.
  it.each([
    ['a number', 7],
    ['null', null],
    ['undefined', undefined],
    ['an array holding the verb', ['start']],
    ['an object that stringifies to the verb', { toString: () => 'start' }]
  ])('refuses %s', (_label, value) => {
    expect(isAction(value)).toBe(false);
  });
});

describe('isPlainObject', () => {
  it.each([
    ['an empty object', {}, true],
    ['an object with keys', { type: 'logs' }, true],
    // ⚠️ typeof null is 'object'. This is the arm that keeps a literal `null` frame out of the
    // handler, where destructuring it would throw on every scanner that sends one.
    ['null', null, false],
    // An array is an object too, and `[].type` is undefined rather than an error — it would be
    // accepted and then silently ignored, which is a worse answer than refusing it here.
    ['an array', [], false],
    ['a number', 42, false],
    ['a string', 'logs', false],
    ['a boolean', true, false],
    ['undefined', undefined, false]
  ])('answers %s with %s', (_label, value, expected) => {
    expect(isPlainObject(value)).toBe(expected);
  });
});

describe('hostnameOnly', () => {
  it.each([
    ['a bare name', 'status.lan', 'status.lan'],
    ['a name with a port', 'status.lan:2901', 'status.lan'],
    ['mixed case', 'Status.LAN:2901', 'status.lan'],
    // A one-character name still has its port stripped: the guard is "is there a colon at all",
    // not "is there a colon far enough in".
    ['a one-character name with a port', 'a:80', 'a'],
    ['a bracketed IPv6 literal with a port', '[::1]:2901', '::1'],
    ['a bracketed IPv6 literal without one', '[fe80::1]', 'fe80::1'],
    ['a bracketed IPv6 literal in mixed case', '[FE80::1]:2901', 'fe80::1'],
    // No colon at all, and every character a digit: there is no port here to strip, and cutting
    // the last character off would answer with a name nothing is served under.
    ['an all-digit name', '2901', '2901'],
    // The port is digits and nothing else. Anything else after the last colon belongs to the
    // name — truncating it would make two different hosts compare equal.
    ['a colon followed by non-digits', 'host:ab12', 'host:ab12'],
    ['a colon followed by digits and then letters', 'host:12ab', 'host:12ab'],
    // The bracket form is anchored at both ends, so neither of these is a bracketed literal —
    // reading them as one would hand back a hostname the client never named.
    ['a bracket that does not start the value', 'x[abc]', 'x[abc]'],
    ['trailing junk after the closing bracket', '[::1]junk', '[::1]junk']
  ])('reads %s', (_label, header, expected) => {
    expect(hostnameOnly(header)).toBe(expected);
  });
});

describe('buildTrustedHosts', () => {
  const hostsOf = (patch: Partial<Pick<AppConfig, 'domain' | 'host' | 'allowedHosts'>> = {}): ReadonlySet<string> =>
    buildTrustedHosts({ domain: '', host: '127.0.0.1', allowedHosts: [], ...patch });

  it('always trusts the loopback names, whatever else the config says', () => {
    expect([...hostsOf({ host: '' })].sort()).toEqual(['127.0.0.1', '::1', 'localhost']);
  });

  it.each([
    ['DOMAIN', { domain: 'Status.Example' }, 'status.example'],
    ['HOST', { host: 'LAN-Box.local' }, 'lan-box.local']
  ])('adds %s, lowercased to match the Host header', (_label, patch, expected) => {
    expect(hostsOf(patch).has(expected)).toBe(true);
  });

  /*
   * ⚠️ The wildcards are bind addresses, not names. Adding them would mean BIND_ALL=true also
   * trusted a literal `Host: 0.0.0.0` — a value no browser sends and an attacker can.
   */
  it.each(['0.0.0.0', '::'])('never adds the wildcard bind %s', (host) => {
    expect(hostsOf({ host }).has(host)).toBe(false);
  });

  it('adds every ALLOWED_HOSTS entry', () => {
    const hosts = hostsOf({ allowedHosts: ['status.lan', '192.168.1.10'] });

    expect(hosts.has('status.lan')).toBe(true);
    expect(hosts.has('192.168.1.10')).toBe(true);
  });

  // Unset is the default for both, and '' must never end up in the set: assertTrustedHost refuses
  // a missing Host header before it compares anything, but a set carrying '' is one edit from a hole.
  it('adds nothing at all for an unset DOMAIN or HOST', () => {
    expect(hostsOf({ domain: '', host: '' }).has('')).toBe(false);
  });
});

describe('assertTrustedHost', () => {
  const hosts = buildTrustedHosts({ domain: 'status.example', host: '127.0.0.1', allowedHosts: [] });

  it('accepts a trusted host, and says why', () => {
    expect(assertTrustedHost('status.example:2901', hosts)).toEqual({ allowed: true, reason: 'host is trusted' });
  });

  // The reason names the host and the way to fix it: this is the message you meet when you first
  // put the page behind a name of your own.
  it('refuses a host that is not in the set, naming it', () => {
    expect(assertTrustedHost('evil.example', hosts)).toEqual({
      allowed: false,
      reason: 'Host "evil.example" is not served here (add it to ALLOWED_HOSTS if that is wrong)'
    });
  });

  it.each([
    ['a missing Host header', undefined],
    // ctx.get() answers '' for an absent header, so both spellings have to reach the same arm.
    ['an empty Host header', '']
  ])('refuses %s', (_label, header) => {
    expect(assertTrustedHost(header, hosts)).toEqual({ allowed: false, reason: 'missing Host header' });
  });
});

describe('isTrustedOrigin', () => {
  const hosts = buildTrustedHosts({ domain: 'status.example', host: '127.0.0.1', allowedHosts: [] });

  it.each([
    ['a trusted origin', 'http://status.example', true],
    // The port is deliberately not compared: the page is reached at :2901 directly and at :443
    // through nginx, and the Host allowlist is what carries the weight.
    ['a trusted origin on another port', 'http://status.example:2901', true],
    ['a trusted origin over https', 'https://status.example', true],
    ['a trusted origin spelled in capitals', 'http://STATUS.EXAMPLE', true],
    ['a foreign origin', 'https://evil.example', false],
    ['a bare hostname, which is not a URL', 'evil.example', false],
    // What a sandboxed iframe and a file:// page send. It parses as nothing and is trusted by nothing.
    ['the null origin', 'null', false],
    ['an empty string', '', false]
  ])('reads %s as %s', (_label, origin, expected) => {
    expect(isTrustedOrigin(origin, hosts)).toBe(expected);
  });
});

describe('assertSameOrigin', () => {
  const hosts = buildTrustedHosts({ domain: 'status.example', host: '127.0.0.1', allowedHosts: [] });

  it('accepts a trusted Origin', () => {
    expect(assertSameOrigin('http://status.example', undefined, hosts, false)).toEqual({ allowed: true, reason: 'same-origin' });
  });

  // Referer is the fallback, not an alternative: a fetch() carries Origin, an old browser's form
  // POST may carry only Referer, and both are attached by the browser rather than by the page.
  it('falls back to Referer when Origin is absent', () => {
    expect(assertSameOrigin(undefined, 'http://status.example/page', hosts, false)).toEqual({
      allowed: true,
      reason: 'same-origin'
    });
  });

  /*
   * ⚠️ Origin wins outright when both are present. Trusting whichever of the two happens to be in
   * the set would let an attacking page send a forged-looking pair and pass on the weaker one.
   */
  it('refuses a foreign Origin even when the Referer is trusted', () => {
    expect(assertSameOrigin('https://evil.example', 'http://status.example/page', hosts, true)).toEqual({
      allowed: false,
      reason: 'Origin/Referer host is not served here'
    });
  });

  it('accepts a header-less caller that presented a valid token', () => {
    expect(assertSameOrigin(undefined, undefined, hosts, true)).toEqual({
      allowed: true,
      reason: 'no Origin/Referer, but a valid AUTH_TOKEN was presented'
    });
  });

  it('refuses a header-less caller with no token', () => {
    expect(assertSameOrigin(undefined, undefined, hosts, false)).toEqual({
      allowed: false,
      reason: 'missing Origin/Referer and no valid AUTH_TOKEN'
    });
  });

  // ctx.get() answers '' for an absent header, so '' has to read as absent — not as an origin
  // that failed to parse, which would refuse every tokened curl call.
  it('treats empty headers as absent ones', () => {
    expect(assertSameOrigin('', '', hosts, true)).toEqual({
      allowed: true,
      reason: 'no Origin/Referer, but a valid AUTH_TOKEN was presented'
    });
  });
});

describe('the page', () => {
  it('serves the shell with the mount points app.js expects, and the hardening headers', async () => {
    const { port } = await startServer();

    const res = await get(port, '/');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    // The contract with public/app.js: it builds groups, cards and notifications into these.
    for (const id of ['servicesGrid', 'notificationContainer', 'logsDrawer', 'connectionStatus', 'toolbar']) {
      expect(res.body).toContain(`id="${id}"`);
    }
  });

  // The shell is served at exactly one path. A matcher that answered more would put the topology
  // — and the action buttons — under every URL the static middleware does not claim.
  it('404s a path the page does not own', async () => {
    const { port } = await startServer();

    expect((await get(port, '/dashboard')).status).toBe(404);
  });

  it('serves the static assets that shell links to', async () => {
    const { port } = await startServer();

    const res = await get(port, '/app.js');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('GET /api/services', () => {
  it('answers the same snapshot the WebSocket sends, minus the frame', async () => {
    const monitor = fakeMonitor([stateFor('api')]);
    const { port } = await startServer(configOf({ pollIntervalMs: 3000 }), monitor);

    const body = (await get(port, '/api/services')).json<{
      groups: GroupDescriptor[];
      services: ServiceDescriptor[];
      states: ServiceState[];
      target: string;
      scope: string;
      pollIntervalMs: number;
      timestamp: number;
    }>();

    expect(body.groups).toHaveLength(1);
    expect(body.services.map((s) => s.id)).toEqual(['api', 'web']);
    expect(body.states.map((s) => s.id)).toEqual(['api']);
    expect(body).toMatchObject({ target: 'marketplace.target', scope: 'user', pollIntervalMs: 3000 });
    expect(typeof body.timestamp).toBe('number');
  });
});

describe('POST /api/services/:id/:action', () => {
  it('runs the action against that service unit and answers with its refreshed state', async () => {
    const monitor = fakeMonitor([stateFor('api', { health: 'starting' })]);
    const { port } = await startServer(configOf({ systemctlScope: 'system' }), monitor);
    controlUnitMock.mockResolvedValue({ ok: true, message: 'started api.service' });

    const res = await post(port, '/api/services/api/restart');

    expect(controlUnitMock).toHaveBeenCalledWith('api.service', 'restart', 'system');
    // ⚠️ The refresh is the point: answering with the pre-action state would leave the card
    // saying 'down' on a service the click just started.
    expect(monitor.refreshCount()).toBe(1);
    expect(res.json<{ ok: boolean; message: string; state: ServiceState }>()).toMatchObject({
      ok: true,
      message: 'started api.service',
      state: { id: 'api', health: 'starting' }
    });
  });

  it('answers a null state when the refresh has nothing to say about that id', async () => {
    const { port } = await startServer(configOf(), fakeMonitor([stateFor('web')]));

    const res = await post(port, '/api/services/api/start');

    expect(res.json<{ state: null }>().state).toBeNull();
  });

  it('reports a failed action without a 500 — the systemctl message is the useful part', async () => {
    const { port } = await startServer();
    controlUnitMock.mockResolvedValue({ ok: false, message: 'Unit api.service not found.' });

    const res = await post(port, '/api/services/api/stop');

    expect(res.status).toBe(200);
    expect(res.json<{ ok: boolean; message: string }>()).toMatchObject({ ok: false, message: 'Unit api.service not found.' });
  });

  it('404s an unknown service id, without shelling out', async () => {
    const { port } = await startServer();

    const res = await post(port, '/api/services/nope/start');

    expect(res.status).toBe(404);
    // The whole body, not just the status: public/app.js renders `message` into a notification
    // and reads `ok` to decide whether it is a red one, so both are the contract.
    expect(res.json()).toEqual({ ok: false, message: 'unknown service id "nope"' });
    expect(controlUnitMock).not.toHaveBeenCalled();
  });

  /*
   * ⚠️ The action allowlist is what keeps this route from being an arbitrary `systemctl` verb
   * runner: `:action` goes straight into the argv, so 'mask', 'kill' or '--user=root' would all be
   * a valid path segment without it.
   */
  it.each(['mask', 'kill', 'daemon-reload', 'START'])('400s the action %s instead of passing it to systemctl', async (action) => {
    const { port } = await startServer();

    const res = await post(port, `/api/services/api/${action}`);

    expect(res.status).toBe(400);
    expect(res.json()).toEqual({ ok: false, message: `invalid action "${action}"` });
    expect(controlUnitMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/groups/:groupId/:action', () => {
  it('runs the action on every unit in the group and tallies the results', async () => {
    const { port, monitor } = await startServer();

    const res = await post(port, '/api/groups/core/start');

    expect(controlUnitMock.mock.calls.map((call) => call[0])).toEqual(['api.service', 'web.service']);
    expect(monitor.refreshCount()).toBe(1);
    expect(res.json<{ ok: boolean; message: string; results: unknown[] }>()).toMatchObject({
      ok: true,
      message: '2/2 succeeded',
      results: [
        { id: 'api', ok: true, message: 'ok' },
        { id: 'web', ok: true, message: 'ok' }
      ]
    });
  });

  it('is not ok when one member fails, and says how many made it', async () => {
    const { port } = await startServer();
    controlUnitMock.mockResolvedValueOnce({ ok: true, message: 'ok' }).mockResolvedValueOnce({ ok: false, message: 'nope' });

    const res = await post(port, '/api/groups/core/stop');

    expect(res.json<{ ok: boolean; message: string }>()).toMatchObject({ ok: false, message: '1/2 succeeded' });
  });

  it('404s an unknown group id', async () => {
    const { port } = await startServer();

    const res = await post(port, '/api/groups/nope/start');

    expect(res.status).toBe(404);
    expect(res.json()).toEqual({ ok: false, message: 'unknown group id "nope"' });
    expect(controlUnitMock).not.toHaveBeenCalled();
  });

  it('400s an invalid action', async () => {
    const { port } = await startServer();

    const res = await post(port, '/api/groups/core/mask');

    expect(res.status).toBe(400);
    expect(res.json()).toEqual({ ok: false, message: 'invalid action "mask"' });
    expect(controlUnitMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/all/:action', () => {
  it('acts on the target unit, not on each service in turn', async () => {
    const { port, monitor } = await startServer();

    const res = await post(port, '/api/all/restart');

    expect(controlUnitMock).toHaveBeenCalledTimes(1);
    expect(controlUnitMock).toHaveBeenCalledWith('marketplace.target', 'restart', 'user');
    expect(monitor.refreshCount()).toBe(1);
    expect(res.json<{ ok: boolean }>().ok).toBe(true);
  });

  it('400s an invalid action', async () => {
    const { port } = await startServer();

    const res = await post(port, '/api/all/obliterate');

    expect(res.status).toBe(400);
    expect(res.json()).toEqual({ ok: false, message: 'invalid action "obliterate"' });
    expect(controlUnitMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/services/:id/logs', () => {
  it('reads the configured number of lines by default', async () => {
    const { port } = await startServer(configOf({ logLines: 150 }));

    const res = await get(port, '/api/services/api/logs');

    expect(unitLogsMock).toHaveBeenCalledWith('api.service', 150, 'user');
    expect(res.json<{ id: string; lines: string[] }>()).toEqual({ id: 'api', lines: ['line one', 'line two'] });
  });

  it('honours ?lines=', async () => {
    const { port } = await startServer();

    await get(port, '/api/services/api/logs?lines=25');

    expect(unitLogsMock).toHaveBeenCalledWith('api.service', 25, 'user');
  });

  /*
   * ⚠️ A non-numeric ?lines= must fall back rather than reach unitLogs: `journalctl -n NaN` is an
   * argument systemd rejects, so the drawer would show an error instead of the logs.
   */
  it('falls back to the configured count when ?lines= is not a number', async () => {
    const { port } = await startServer(configOf({ logLines: 200 }));

    await get(port, '/api/services/api/logs?lines=banana');

    expect(unitLogsMock).toHaveBeenCalledWith('api.service', 200, 'user');
  });

  // Koa hands a repeated query parameter over as an array; taking the first is what keeps
  // `Number.parseInt` from being handed one.
  it('takes the first value of a repeated ?lines=', async () => {
    const { port } = await startServer();

    await get(port, '/api/services/api/logs?lines=10&lines=20');

    expect(unitLogsMock).toHaveBeenCalledWith('api.service', 10, 'user');
  });

  it('404s an unknown service id', async () => {
    const { port } = await startServer();

    const res = await get(port, '/api/services/nope/logs');

    expect(res.status).toBe(404);
    expect(res.json()).toEqual({ ok: false, message: 'unknown service id "nope"' });
    expect(unitLogsMock).not.toHaveBeenCalled();
  });
});

describe('the Host allowlist, over a real request', () => {
  it('refuses a rebound Host before any route runs', async () => {
    const { port } = await startServer();

    const res = await get(port, '/api/services', { Host: `evil.example:${port}` });

    expect(res.status).toBe(403);
    expect(res.json()).toEqual({
      ok: false,
      message: 'request refused: Host "evil.example" is not served here (add it to ALLOWED_HOSTS if that is wrong)'
    });
  });

  /*
   * ⚠️ A request with no Host header at all. Unreachable through any HTTP client — Node's own
   * refuses to omit it on HTTP/1.1 — so it takes a raw HTTP/1.0 request line, where the header is
   * optional. Refused rather than served: nothing that speaks 1.0 needs this page, and leaving the
   * arm open would mean one way to reach the topology without naming a host at all.
   */
  it('refuses a request that carries no Host header', async () => {
    const { port } = await startServer();

    const bytes = await new Promise<string>((resolve) => {
      const socket = net.connect(port, '127.0.0.1', () => socket.write('GET /api/services HTTP/1.0\r\n\r\n'));
      let received = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        received += chunk;
      });
      socket.on('close', () => resolve(received));
    });

    expect(bytes).toContain('403 Forbidden');
    expect(bytes).toContain('missing Host header');
  });

  it('serves a Host that ALLOWED_HOSTS names', async () => {
    const { port } = await startServer(configOf({ allowedHosts: ['status.lan'] }));

    expect((await get(port, '/api/services', { Host: 'status.lan' })).status).toBe(200);
  });
});

describe('extractToken', () => {
  it.each([
    ['a Bearer header', 'Bearer abc123', undefined, 'abc123'],
    ['a Bearer header in any casing', 'BEARER abc123', undefined, 'abc123'],
    ['a padded Bearer header', 'Bearer   abc123  ', undefined, 'abc123'],
    ['a query parameter', undefined, 'abc123', 'abc123'],
    // ⚠️ The header wins when both are present: a fetch() that sets one deliberately should not be
    // overridden by a token left over in the page URL.
    ['both, header first', 'Bearer from-header', 'from-query', 'from-header'],
    // ⚠️ The fall-through this function exists for. It cannot be produced over a socket — HTTP
    // trims the trailing whitespace, so "Bearer " arrives as "Bearer" and never matches the prefix
    // at all — but a caller that hands the pieces over directly can, and an empty string must not
    // be mistaken for a token.
    ['an empty Bearer header alongside a query parameter', 'Bearer   ', 'from-query', 'from-query'],
    ['an empty Bearer header on its own', 'Bearer   ', undefined, null],
    ['a scheme that is not Bearer', 'Basic abc123', undefined, null],
    ['nothing at all', undefined, undefined, null],
    ['an empty query parameter', undefined, '', null]
  ])('reads %s as %s', (_label, header, query, expected) => {
    expect(extractToken(header, query)).toBe(expected);
  });
});

describe('AUTH_TOKEN', () => {
  const authed = (): AppConfig => configOf({ authToken: 'super-secret-token' });

  it('401s a request with no credentials at all', async () => {
    const { port } = await startServer(authed());

    const res = await get(port, '/api/services');

    expect(res.status).toBe(401);
    // Generic on purpose, and asserted so it stays that way: naming what was wrong with the
    // credentials would tell a caller whether AUTH_TOKEN is set at all.
    expect(res.json()).toEqual({ ok: false, message: 'unauthorized' });
  });

  it('401s a wrong token of the same length, and a wrong token of a different length', async () => {
    const { port } = await startServer(authed());

    // Same length exercises the timingSafeEqual comparison itself; the short one exercises the
    // length guard, which exists because timingSafeEqual throws on mismatched buffers.
    expect((await get(port, '/api/services', { Authorization: 'Bearer super-secret-tokeN' })).status).toBe(401);
    expect((await get(port, '/api/services', { Authorization: 'Bearer short' })).status).toBe(401);
  });

  it.each([
    ['a Bearer header', { Authorization: 'Bearer super-secret-token' }, '/api/services'],
    ['a Bearer header in any casing', { Authorization: 'bEaReR super-secret-token' }, '/api/services'],
    ['a ?token= query parameter', {}, '/api/services?token=super-secret-token'],
    // The header is present but carries nothing after "Bearer ", so the query parameter is what
    // has to answer — the page itself is opened as /?token=… and its fetches inherit that.
    ['an empty Bearer header alongside ?token=', { Authorization: 'Bearer   ' }, '/api/services?token=super-secret-token'],
    ['the first of a repeated ?token=', {}, '/api/services?token=super-secret-token&token=other']
  ])('accepts %s', async (_label, headers, reqPath) => {
    const { port } = await startServer(authed());

    expect((await get(port, reqPath, headers)).status).toBe(200);
  });

  it('ignores an Authorization scheme that is not Bearer', async () => {
    const { port } = await startServer(authed());

    expect((await get(port, '/api/services', { Authorization: 'Basic super-secret-token' })).status).toBe(401);
  });

  /*
   * ⚠️ Token-before-CSRF ordering, and the two are not interchangeable: a valid token is the only
   * escape hatch for a client that sends no Origin at all (curl, a script), so the CSRF guard has
   * to know the token verdict — which means the token check has to have run first.
   */
  it('lets a tokened, Origin-less POST through', async () => {
    const { port } = await startServer(authed());

    const res = await request(port, 'POST', '/api/all/start?token=super-secret-token', {});

    expect(res.status).toBe(200);
  });

  it('still refuses a tokened POST from a foreign Origin', async () => {
    const { port } = await startServer(authed());

    const res = await request(port, 'POST', '/api/all/start?token=super-secret-token', { Origin: 'https://evil.example' });

    expect(res.status).toBe(403);
    expect(controlUnitMock).not.toHaveBeenCalled();
  });
});

describe('the CSRF guard, over a real request', () => {
  it('lets safe methods through without an Origin', async () => {
    const { port } = await startServer();

    expect((await request(port, 'GET', '/api/services', {})).status).toBe(200);
    expect((await request(port, 'HEAD', '/api/services', {})).status).toBe(200);
    // OPTIONS mutates nothing either, and it is the one a browser sends on its own initiative —
    // refusing it as a cross-site POST would answer a preflight with 403 and break the fetch
    // that follows.
    expect((await request(port, 'OPTIONS', '/api/services', {})).status).toBe(200);
  });

  it('refuses a tokenless, Origin-less POST', async () => {
    const { port } = await startServer();

    const res = await request(port, 'POST', '/api/all/stop', {});

    expect(res.status).toBe(403);
    expect(res.json()).toEqual({ ok: false, message: 'cross-site request blocked: missing Origin/Referer and no valid AUTH_TOKEN' });
    expect(controlUnitMock).not.toHaveBeenCalled();
  });

  it('accepts a POST whose Referer names a trusted host when Origin is absent', async () => {
    const { port } = await startServer();

    const res = await request(port, 'POST', '/api/all/stop', { Referer: `http://127.0.0.1:${port}/` });

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

type AnyMessage = Record<string, unknown> & { type: string };

interface Client {
  ws: WebSocket;
  messages: AnyMessage[];
  /** Waits until a message of that type has arrived, and returns it. */
  waitFor: (type: string) => Promise<AnyMessage>;
  send: (payload: unknown) => void;
}

const clients: WebSocket[] = [];

const connect = async (port: number, options: { path?: string; headers?: Record<string, string> } = {}): Promise<Client> => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}${options.path ?? '/ws'}`, {
    headers: { Origin: `http://127.0.0.1:${port}`, ...options.headers }
  });
  clients.push(ws);
  const messages: AnyMessage[] = [];
  ws.on('message', (raw: WebSocket.RawData) => messages.push(JSON.parse(raw.toString()) as AnyMessage));

  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
    ws.once('unexpected-response', (_req, res) => reject(Object.assign(new Error('handshake refused'), { status: res.statusCode })));
  });

  return {
    ws,
    messages,
    waitFor: async (type) => {
      await vi.waitFor(() => expect(messages.some((m) => m.type === type)).toBe(true));
      return messages.find((m) => m.type === type) as AnyMessage;
    },
    send: (payload) => ws.send(JSON.stringify(payload))
  };
};

/** The status code of a refused handshake, or null when the socket was destroyed without one. */
const handshakeStatus = (port: number, options: { path?: string; headers?: Record<string, string> } = {}): Promise<number | null> =>
  new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${options.path ?? '/ws'}`, { headers: options.headers ?? {} });
    clients.push(ws);
    ws.once('unexpected-response', (_req, res) => resolve(res.statusCode ?? null));
    ws.once('error', () => resolve(null));
    ws.once('open', () => resolve(200));
  });

afterEach(() => {
  for (const ws of clients.splice(0)) ws.terminate();
});

describe('the WebSocket handshake', () => {
  it('accepts a same-origin connection and opens with a snapshot', async () => {
    const { port } = await startServer(configOf({ pollIntervalMs: 4000 }), fakeMonitor([stateFor('api')]));

    const snapshot = await (await connect(port)).waitFor('snapshot');

    expect(snapshot).toMatchObject({
      target: 'marketplace.target',
      scope: 'user',
      pollIntervalMs: 4000
    });
    expect((snapshot.services as ServiceDescriptor[]).map((s) => s.id)).toEqual(['api', 'web']);
    expect((snapshot.states as ServiceState[]).map((s) => s.id)).toEqual(['api']);
  });

  it.each([
    ['a foreign Origin', { headers: { Origin: 'https://evil.example' } }, 403],
    ['no Origin and no token', {}, 403],
    ['a rebound Host', { headers: { Host: 'evil.example', Origin: 'http://evil.example' } }, 403]
  ])('refuses %s with %i', async (_label, options, expected) => {
    const { port } = await startServer();

    expect(await handshakeStatus(port, options)).toBe(expected);
  });

  /*
   * ⚠️ A rebound Host *with a Origin the allowlist accepts* — the shape the Origin check alone
   * cannot see. evil.example resolving to 127.0.0.1 is the whole DNS-rebinding attack, and a page
   * on it can send whatever Origin it likes; only the Host allowlist refuses the connection.
   */
  it('refuses a rebound Host even when the Origin is a trusted one', async () => {
    const { port } = await startServer();

    const status = await handshakeStatus(port, { headers: { Host: 'evil.example', Origin: `http://127.0.0.1:${port}` } });

    expect(status).toBe(403);
  });

  it('401s a handshake with a wrong token, and accepts the right one from the query string', async () => {
    const { port } = await startServer(configOf({ authToken: 'super-secret-token' }));

    expect(await handshakeStatus(port, { path: '/ws?token=wrong', headers: { Origin: `http://127.0.0.1:${port}` } })).toBe(401);
    expect(
      await handshakeStatus(port, { path: '/ws?token=super-secret-token', headers: { Origin: `http://127.0.0.1:${port}` } })
    ).toBe(200);
  });

  it('accepts a handshake authenticated by the Authorization header', async () => {
    const { port } = await startServer(configOf({ authToken: 'super-secret-token' }));

    const status = await handshakeStatus(port, {
      headers: { Origin: `http://127.0.0.1:${port}`, Authorization: 'Bearer super-secret-token' }
    });

    expect(status).toBe(200);
  });

  /*
   * ⚠️ Destroyed, not refused: a request to any other path is not a WebSocket client that got
   * something wrong, and writing an HTTP response to it would be answering a caller that never
   * asked. The distinction is visible on the wire — a 403 handshake gets response bytes, this
   * gets none.
   */
  it('destroys an upgrade aimed at any path other than /ws', async () => {
    const { port } = await startServer();

    expect(await handshakeStatus(port, { path: '/not-ws' })).toBeNull();
  });

  /*
   * ⚠️ An unparsable request target. `GET // HTTP/1.1` is a request line Node's parser accepts and
   * hands over as req.url === '//', which `new URL('//', base)` rejects outright — a
   * protocol-relative reference with an empty host. Reached with a raw socket because no HTTP
   * client will send that line, and the branch has to hold: an exception in an 'upgrade' handler
   * is not caught by anything above it and would take the process down.
   */
  it('destroys an upgrade whose request target is not a URL at all', async () => {
    const { port } = await startServer();

    const outcome = await new Promise<{ bytes: string; ended: boolean }>((resolve) => {
      const socket = net.connect(port, '127.0.0.1', () => {
        socket.write(
          'GET // HTTP/1.1\r\n' +
            `Host: 127.0.0.1:${port}\r\n` +
            'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n'
        );
      });
      let bytes = '';
      socket.setEncoding('utf8');
      socket.on('data', (chunk: string) => {
        bytes += chunk;
      });
      socket.on('close', () => resolve({ bytes, ended: true }));
      socket.on('error', () => resolve({ bytes, ended: true }));
    });

    expect(outcome.ended).toBe(true);
    expect(outcome.bytes).toBe('');
  });
});

describe('broadcasting', () => {
  it('pushes every monitor tick to every open client', async () => {
    const monitor = fakeMonitor();
    const { port } = await startServer(configOf(), monitor);
    const [a, b] = [await connect(port), await connect(port)];
    await Promise.all([a.waitFor('snapshot'), b.waitFor('snapshot')]);

    monitor.emit([stateFor('api', { health: 'failed' })]);

    for (const client of [a, b]) {
      const message = await client.waitFor('states');
      expect((message.states as ServiceState[])[0]).toMatchObject({ id: 'api', health: 'failed' });
    }
  });

  /*
   * ⚠️ The readyState check is not belt-and-braces: a socket that has begun closing is still in
   * wsClients until its 'close' event lands, and send() on it throws rather than no-opping.
   */
  it('skips a client that is no longer open', async () => {
    const { parts } = await startServer();
    const closing = { readyState: WebSocket.CLOSING, send: vi.fn() } as unknown as WebSocket;
    parts.wsClients.add(closing);

    parts.broadcastStates([stateFor('api')]);

    expect(closing.send).not.toHaveBeenCalled();
  });

  it('forgets a client once it disconnects', async () => {
    const { port, parts } = await startServer();
    const client = await connect(port);
    await client.waitFor('snapshot');
    expect(parts.wsClients.size).toBe(1);

    client.ws.close();

    await vi.waitFor(() => expect(parts.wsClients.size).toBe(0));
  });

  it('forgets a client whose socket errors out', async () => {
    const { port, parts } = await startServer();
    const client = await connect(port);
    await client.waitFor('snapshot');
    const [serverSide] = [...parts.wsClients];

    serverSide.emit('error', new Error('ECONNRESET'));

    expect(parts.wsClients.size).toBe(0);
  });
});

describe('WebSocket actions', () => {
  it.each([
    ['service', 'api', 'api.service', 1],
    ['group', 'core', 'api.service', 2],
    // ⚠️ 'all' carries a targetId on the wire but must ignore it: the unit to act on is the
    // configured target, never a name the client chose.
    ['all', 'ignored-by-design', 'marketplace.target', 1]
  ])('dispatches a %s action', async (scope, targetId, firstUnit, calls) => {
    const { port, monitor } = await startServer();
    const client = await connect(port);
    await client.waitFor('snapshot');

    client.send({ type: 'action', scope, targetId, action: 'restart' });

    const result = await client.waitFor('action-result');
    expect(result).toMatchObject({ ok: true, scope, targetId, action: 'restart', message: expect.any(String) });
    expect(controlUnitMock).toHaveBeenCalledTimes(calls);
    expect(controlUnitMock.mock.calls[0][0]).toBe(firstUnit);
    expect(monitor.refreshCount()).toBe(1);
  });

  it('answers an unknown service id without shelling out', async () => {
    const { port } = await startServer();
    const client = await connect(port);
    await client.waitFor('snapshot');

    client.send({ type: 'action', scope: 'service', targetId: 'nope', action: 'start' });

    const result = await client.waitFor('action-result');
    expect(result).toMatchObject({ ok: false, message: 'unknown service id "nope"' });
    expect(controlUnitMock).not.toHaveBeenCalled();
  });

  it('answers an unknown group id without shelling out', async () => {
    const { port } = await startServer();
    const client = await connect(port);
    await client.waitFor('snapshot');

    client.send({ type: 'action', scope: 'group', targetId: 'nope', action: 'start' });

    const result = await client.waitFor('action-result');
    expect(result).toMatchObject({ ok: false, message: 'unknown group id "nope"' });
    expect(controlUnitMock).not.toHaveBeenCalled();
  });

  it('reports a partially failed group action', async () => {
    const { port } = await startServer();
    controlUnitMock.mockResolvedValueOnce({ ok: false, message: 'nope' }).mockResolvedValueOnce({ ok: true, message: 'ok' });
    const client = await connect(port);
    await client.waitFor('snapshot');

    client.send({ type: 'action', scope: 'group', targetId: 'core', action: 'stop' });

    expect(await client.waitFor('action-result')).toMatchObject({ ok: false, message: '1/2 succeeded' });
  });
});

describe('WebSocket frames that go nowhere', () => {
  /**
   * Sends a frame that must be ignored, then a frame that must be answered. The reply proves the
   * connection survived *and* that the ignored frame produced nothing — a bare timeout would
   * prove neither.
   */
  const ignoredThenAnswered = async (port: number, ignored: string): Promise<AnyMessage[]> => {
    const client = await connect(port);
    await client.waitFor('snapshot');
    client.ws.send(ignored);
    client.send({ type: 'logs', id: 'api' });
    await client.waitFor('logs');
    return client.messages.filter((m) => m.type !== 'snapshot');
  };

  it.each([
    ['malformed JSON', 'not json at all'],
    ['a JSON array', '[]'],
    ['a JSON scalar', '42'],
    ['null', 'null'],
    ['a frame with no type', '{"scope":"all"}'],
    ['an unrecognized type', '{"type":"ping"}'],
    // ⚠️ A ping carrying a real service id. Every field a logs frame needs is present and only
    // `type` says otherwise — which is the one thing that must decide whether journalctl runs.
    ['an unrecognized type carrying a valid id', '{"type":"ping","id":"api"}'],
    ['an action with an unknown scope', '{"type":"action","scope":"universe","targetId":"api","action":"start"}'],
    ['an action with a non-string targetId', '{"type":"action","scope":"service","targetId":7,"action":"start"}'],
    ['an action with a verb outside the allowlist', '{"type":"action","scope":"service","targetId":"api","action":"mask"}'],
    ['a logs frame with a non-string id', '{"type":"logs","id":7}'],
    ['a logs frame for an unknown service', '{"type":"logs","id":"nope"}']
  ])('ignores %s and keeps the connection usable', async (_label, frame) => {
    const { port } = await startServer();

    const replies = await ignoredThenAnswered(port, frame);

    expect(replies).toHaveLength(1);
    expect(replies[0].type).toBe('logs');
    expect(controlUnitMock).not.toHaveBeenCalled();
  });

  /*
   * ⚠️ Dropped before the handler, not inside it. A frame that reached handleClientMessage and
   * threw there would be caught by its .catch() and look identical from the outside — ignored,
   * connection alive — while writing a stack trace to the journal for every malformed frame a
   * port scanner sends. console.error is the only place that difference shows.
   */
  it.each([
    ['malformed JSON', 'not json at all'],
    ['a JSON scalar', '42'],
    ['null', 'null'],
    ['a logs frame for an unknown service', '{"type":"logs","id":"nope"}']
  ])('drops %s without letting the handler throw', async (_label, frame) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { port } = await startServer();

    expect(await ignoredThenAnswered(port, frame)).toHaveLength(1);

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  /*
   * ⚠️ 8 KiB is the ceiling on what one frame can make this process buffer, and every frame the
   * contract defines is a few hundred bytes. Without the cap `ws` accepts its own 100 MB default,
   * so a socket that has completed the handshake can hold that much heap, over and over.
   */
  it('closes a connection that sends a frame past the payload cap', async () => {
    const { port } = await startServer();
    const client = await connect(port);
    await client.waitFor('snapshot');

    const closed = new Promise<number>((resolve) => client.ws.once('close', resolve));
    client.ws.send(JSON.stringify({ type: 'logs', id: 'a'.repeat(9 * 1024) }));

    expect(await closed).toBe(1009);
    expect(unitLogsMock).not.toHaveBeenCalled();
  });
});

describe('WebSocket logs', () => {
  it('reads the configured number of lines by default', async () => {
    const { port } = await startServer(configOf({ logLines: 120 }));
    const client = await connect(port);
    await client.waitFor('snapshot');

    client.send({ type: 'logs', id: 'api' });

    expect(await client.waitFor('logs')).toMatchObject({ id: 'api', lines: ['line one', 'line two'] });
    expect(unitLogsMock).toHaveBeenCalledWith('api.service', 120, 'user');
  });

  it('honours a numeric lines field', async () => {
    const { port } = await startServer();
    const client = await connect(port);
    await client.waitFor('snapshot');

    client.send({ type: 'logs', id: 'api', lines: 30 });
    await client.waitFor('logs');

    expect(unitLogsMock).toHaveBeenCalledWith('api.service', 30, 'user');
  });

  it('falls back to the configured count when lines is not a number', async () => {
    const { port } = await startServer(configOf({ logLines: 200 }));
    const client = await connect(port);
    await client.waitFor('snapshot');

    client.ws.send('{"type":"logs","id":"api","lines":"lots"}');
    await client.waitFor('logs');

    expect(unitLogsMock).toHaveBeenCalledWith('api.service', 200, 'user');
  });
});

describe('when a frame is handled after its client is gone', () => {
  /*
   * ⚠️ A start/restart takes as long as systemd takes, and the client is free to close in the
   * meantime. Sending into a closed socket throws, and that throw would land in the .catch() as a
   * logged error on a perfectly normal disconnect — the readyState guard is what makes it a no-op.
   */
  it('does not send the result into a socket that closed while systemctl ran', async () => {
    const { port, parts } = await startServer();
    const gate = deferred<{ ok: boolean; message: string }>();
    controlUnitMock.mockReturnValue(gate.promise);
    const client = await connect(port);
    await client.waitFor('snapshot');
    const [serverSide] = [...parts.wsClients];
    const send = vi.spyOn(serverSide, 'send');

    client.send({ type: 'action', scope: 'service', targetId: 'api', action: 'start' });
    await vi.waitFor(() => expect(controlUnitMock).toHaveBeenCalled());
    client.ws.close();
    await vi.waitFor(() => expect(parts.wsClients.size).toBe(0));
    gate.resolve({ ok: true, message: 'ok' });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(send).not.toHaveBeenCalled();
  });

  // Same guard, the other call site: a logs read is the slowest frame the client can send, so it
  // is the one most likely to come back to a socket that has gone.
  it('does not send logs into a socket that closed while journalctl ran', async () => {
    const { port, parts } = await startServer();
    const gate = deferred<string[]>();
    unitLogsMock.mockReturnValue(gate.promise);
    const client = await connect(port);
    await client.waitFor('snapshot');
    const [serverSide] = [...parts.wsClients];
    const send = vi.spyOn(serverSide, 'send');

    client.send({ type: 'logs', id: 'api' });
    await vi.waitFor(() => expect(unitLogsMock).toHaveBeenCalled());
    client.ws.close();
    await vi.waitFor(() => expect(parts.wsClients.size).toBe(0));
    gate.resolve(['a line']);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(send).not.toHaveBeenCalled();
  });

  /*
   * ⚠️ handleClientMessage is fired from an event listener, so nothing awaits it. Without the
   * .catch() a rejected systemctl call is an unhandled rejection — which, under Node's default,
   * takes the whole monitor process down.
   */
  it('logs a rejected handler instead of crashing the process', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { port } = await startServer();
    controlUnitMock.mockRejectedValue(new Error('dbus is gone'));
    const client = await connect(port);
    await client.waitFor('snapshot');

    client.send({ type: 'action', scope: 'all', targetId: 'all', action: 'stop' });

    await vi.waitFor(() => expect(error).toHaveBeenCalledWith('[ws] message handling failed', expect.any(Error)));
    expect(client.ws.readyState).toBe(WebSocket.OPEN);
    error.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Assembly, shutdown, startup
// ---------------------------------------------------------------------------

describe('createHttpApp and attachWebSocket compose', () => {
  it('can be wired by hand, one half at a time', async () => {
    const config = configOf();
    const monitor = fakeMonitor();
    const httpServer = http.createServer(createHttpApp(config, monitor).callback());
    const { wsClients } = attachWebSocket(httpServer, config, monitor);
    const port = await listen(httpServer);

    expect((await get(port, '/api/services')).status).toBe(200);
    const client = await connect(port);
    await client.waitFor('snapshot');
    expect(wsClients.size).toBe(1);
  });
});

describe('createShutdown', () => {
  const shutdownFixture = async (): Promise<{ parts: ServerParts; monitor: FakeMonitor; shutdown: (signal: string) => void }> => {
    const config = configOf();
    const monitor = fakeMonitor();
    const parts = createServer(config, monitor);
    await listen(parts.httpServer);
    return { parts, monitor, shutdown: createShutdown(monitor, parts) };
  };

  it('unsubscribes, stops the monitor, terminates the clients and exits once closed', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { parts, monitor, shutdown } = await shutdownFixture();
    const terminate = vi.fn();
    parts.wsClients.add({ terminate } as unknown as WebSocket);

    shutdown('SIGTERM');

    expect(log).toHaveBeenCalledWith('[server] SIGTERM received, shutting down');
    expect(monitor.listeners.size).toBe(0);
    expect(monitor.stop).toHaveBeenCalled();
    expect(terminate).toHaveBeenCalled();
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith('[server] closed'));
    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
    log.mockRestore();
  });

  /*
   * ⚠️ The second signal is not hypothetical: systemd sends SIGTERM and, if the unit has not gone
   * away, sends it again. Re-running the body would terminate an already-terminated client set and
   * arm a second exit timer.
   */
  it('ignores every signal after the first', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { monitor, shutdown } = await shutdownFixture();

    shutdown('SIGTERM');
    shutdown('SIGINT');

    expect(log).not.toHaveBeenCalledWith('[server] SIGINT received, shutting down');
    expect(monitor.stop).toHaveBeenCalledTimes(1);
    // The close callback calls process.exit; let it land on the spy rather than on the real one
    // after this test has restored it.
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    exit.mockRestore();
    log.mockRestore();
  });

  /*
   * ⚠️ The 5s escape hatch. httpServer.close() waits for every open connection to end, and a
   * WebSocket that is not terminating is exactly such a connection — without this timer the
   * process would sit there until the client felt like leaving. It is unref'd so it never holds
   * the process open on its own.
   */
  it('exits anyway when close never comes back', async () => {
    vi.useFakeTimers();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const config = configOf();
    const monitor = fakeMonitor();
    // A server that never calls back — the stuck-connection case, without needing a stuck client.
    const parts = { ...createServer(config, monitor), httpServer: { close: vi.fn() } as unknown as http.Server };

    createShutdown(monitor, parts)('SIGTERM');
    expect(exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5000);

    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
    log.mockRestore();
  });
});

describe('printBanner', () => {
  it.each([
    ['disabled (no AUTH_TOKEN set)', null],
    ['AUTH_TOKEN required', 'super-secret-token']
  ])('reports auth as %s', (expected, authToken) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    printBanner(configOf({ authToken }));

    // Every line, in order. The banner is what you read out of `systemctl status` when
    // the page will not load, so a line that silently stopped being printed is a real loss.
    expect(log.mock.calls.map((call) => String(call[0]))).toEqual([
      'marketplace-services-status monitor listening',
      '  bind:       http://127.0.0.1:2901',
      '  scope:      systemctl --user',
      '  target:     marketplace.target',
      '  units:      2 monitored across 1 groups',
      '  poll every: 60000ms',
      `  auth:       ${expected}`
    ]);
    // ⚠️ Never the token itself: this banner goes to the journal, which is world-readable on
    // plenty of systems.
    expect(log.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain('super-secret-token');
    log.mockRestore();
  });
});

describe('main', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)('boots a listening server and shuts it down on %s', async (signal) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    // Port 0 lets the OS pick, and the listening server reports the real one back.
    loadConfigMock.mockReturnValue(configOf({ port: 0 }));
    const signalsBefore = { SIGTERM: process.listeners('SIGTERM'), SIGINT: process.listeners('SIGINT') };

    const running = await main();
    listening.push(running.parts.httpServer);

    const address = running.parts.httpServer.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    expect(port).toBeGreaterThan(0);
    expect((await get(port, '/api/services')).status).toBe(200);
    // ⚠️ One refresh before the listener is armed: the first client must not be handed an empty
    // states array and have to wait a whole poll interval for the real one.
    expect(running.monitor.getStates()).toHaveLength(2);
    expect(running.shutdown).toBeTypeOf('function');
    expect(process.listeners('SIGTERM').length).toBe(signalsBefore.SIGTERM.length + 1);
    expect(process.listeners('SIGINT').length).toBe(signalsBefore.SIGINT.length + 1);

    // ⚠️ Invoked, not just counted: a handler registered on the wrong signal, or one that forgets
    // to pass the signal name through, is exactly the bug a listener-count assertion cannot see.
    // Calling it here also removes any need to signal the runner's own process. One signal per
    // run, because createShutdown ignores everything after the first — a second one in the same
    // test would exercise nothing but the re-entrancy guard.
    for (const listener of process.listeners(signal)) {
      if (!signalsBefore[signal].includes(listener)) (listener as (signal: NodeJS.Signals) => void)(signal);
    }
    // Leaving them attached would make the runner's own signal handling answer to this test.
    for (const registered of ['SIGTERM', 'SIGINT'] as const) {
      for (const listener of process.listeners(registered)) {
        if (!signalsBefore[registered].includes(listener)) process.off(registered, listener);
      }
    }
    expect(log).toHaveBeenCalledWith(`[server] ${signal} received, shutting down`);
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    running.monitor.stop();
    log.mockRestore();
    exit.mockRestore();
  });
});
