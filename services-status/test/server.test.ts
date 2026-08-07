import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import net from 'net';
import WebSocket from 'ws';

import {
  attachWebSocket,
  createHttpApp,
  createServer,
  createShutdown,
  extractToken,
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
    servicesJsonPath: '/workspace/services-status/services.json',
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
    expect(res.json<{ message: string }>().message).toContain('nope');
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
    expect(controlUnitMock).not.toHaveBeenCalled();
  });

  it('400s an invalid action', async () => {
    const { port } = await startServer();

    const res = await post(port, '/api/groups/core/mask');

    expect(res.status).toBe(400);
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
    expect(unitLogsMock).not.toHaveBeenCalled();
  });
});

describe('the Host allowlist, over a real request', () => {
  it('refuses a rebound Host before any route runs', async () => {
    const { port } = await startServer();

    const res = await get(port, '/api/services', { Host: `evil.example:${port}` });

    expect(res.status).toBe(403);
    expect(res.json<{ message: string }>().message).toContain('not served here');
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
    expect(res.json<{ message: string }>().message).toBe('unauthorized');
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
  });

  it('refuses a tokenless, Origin-less POST', async () => {
    const { port } = await startServer();

    const res = await request(port, 'POST', '/api/all/stop', {});

    expect(res.status).toBe(403);
    expect(res.json<{ message: string }>().message).toContain('missing Origin/Referer');
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

    const printed = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(printed).toContain(`auth:       ${expected}`);
    expect(printed).toContain('bind:       http://127.0.0.1:2901');
    expect(printed).toContain('scope:      systemctl --user');
    expect(printed).toContain('units:      2 monitored across 1 groups');
    // ⚠️ Never the token itself: this banner goes to the journal, which is world-readable on
    // plenty of systems.
    expect(printed).not.toContain('super-secret-token');
    log.mockRestore();
  });
});

describe('main', () => {
  it('boots a listening server from the loaded config and hands back the pieces', async () => {
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
    // Calling them here also removes any need to signal the runner's own process.
    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      for (const listener of process.listeners(signal)) {
        if (!signalsBefore[signal].includes(listener)) {
          (listener as (signal: NodeJS.Signals) => void)(signal);
          // Leaving them attached would make the runner's own signal handling answer to this test.
          process.off(signal, listener);
        }
      }
    }
    expect(log).toHaveBeenCalledWith('[server] SIGTERM received, shutting down');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    running.monitor.stop();
    log.mockRestore();
    exit.mockRestore();
  });
});
