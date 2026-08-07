import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMonitor, Monitor } from '../src/monitor';
import { UnitShowResult } from '../src/systemd';
import { AppConfig, ServiceDescriptor, ServiceState } from '../src/types';

// systemd and probe are the two things this module does not own: one shells out, the other opens a
// socket. Faking both is what makes the health table below assertable at all — every combination of
// (loadState, activeState, portOpen) it has to answer for is a state that would otherwise need a
// real unit deliberately broken in a specific way.
vi.mock('../src/systemd', () => ({ showUnits: vi.fn() }));
vi.mock('../src/probe', () => ({ probeTcp: vi.fn() }));

const { showUnits } = await import('../src/systemd');
const { probeTcp } = await import('../src/probe');

const showUnitsMock = vi.mocked(showUnits);
const probeTcpMock = vi.mocked(probeTcp);

const SHOW_DEFAULTS: UnitShowResult = {
  id: '',
  loadState: 'loaded',
  activeState: 'active',
  subState: 'running',
  unitFileState: 'enabled',
  mainPid: 4242,
  nRestarts: 0,
  memoryBytes: null,
  cpuNs: null,
  since: null,
  error: null
};

const descriptor = (patch: Partial<ServiceDescriptor> = {}): ServiceDescriptor => ({
  id: 'public-resource',
  unit: 'public-resource.service',
  label: 'Public Resource',
  groupId: 'public',
  kind: 'backend',
  repo: 'BEs/dev/marketplace-dev-public-resource',
  port: 4027,
  url: 'http://127.0.0.1:4027/public-resource',
  description: 'Public catalogue reads',
  ...patch
});

const configOf = (services: ServiceDescriptor[], patch: Partial<AppConfig> = {}): AppConfig =>
  ({
    port: 2901,
    host: '127.0.0.1',
    bindAll: false,
    behindProxy: false,
    proxyProtocol: 'http',
    domain: 'localhost',
    systemctlScope: 'user',
    pollIntervalMs: 2000,
    probeTimeoutMs: 500,
    logLines: 200,
    authToken: null,
    allowedHosts: [],
    workspaceRoot: '/workspace',
    servicesJsonPath: '/workspace/services-status/services.json',
    unitTarget: 'marketplace.target',
    monitorUnit: 'marketplace-status.service',
    groups: [{ id: 'public', title: 'Public tier', description: 'Anonymous traffic', serviceIds: services.map((s) => s.id) }],
    services,
    serviceMap: new Map(services.map((s) => [s.id, s])),
    groupMap: new Map(),
    serviceHosts: new Map(services.map((s) => [s.id, '127.0.0.1'])),
    ...patch
  }) as AppConfig;

/** systemctl show answered these blocks, keyed the way showUnits keys them: by unit name. */
const showing = (...results: Partial<UnitShowResult>[]): void => {
  showUnitsMock.mockResolvedValue(new Map(results.map((r) => [r.id ?? '', { ...SHOW_DEFAULTS, ...r }])));
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

// Every monitor started by a test, stopped afterwards — createMonitor arms a setInterval the moment
// it is called, and a leaked one keeps ticking into the next test's mocks.
const started: Monitor[] = [];

const monitorFor = (config: AppConfig): Monitor => {
  const monitor = createMonitor(config);
  started.push(monitor);
  return monitor;
};

beforeEach(() => {
  showUnitsMock.mockReset();
  probeTcpMock.mockReset();
  showing({ id: 'public-resource.service' });
  probeTcpMock.mockResolvedValue(true);
});

afterEach(() => {
  for (const monitor of started.splice(0)) monitor.stop();
  vi.useRealTimers();
});

describe('the state a monitor builds', () => {
  it('joins a service descriptor, its systemd block and its port probe into one state', async () => {
    showing({
      id: 'public-resource.service',
      loadState: 'loaded',
      activeState: 'active',
      subState: 'running',
      unitFileState: 'enabled',
      mainPid: 4242,
      nRestarts: 2,
      memoryBytes: 52_428_800,
      cpuNs: 1_234_567_890,
      since: Date.now() - 3_600_000
    });

    const [state] = await monitorFor(configOf([descriptor()])).refreshNow();

    expect(state).toMatchObject({
      id: 'public-resource',
      unit: 'public-resource.service',
      loadState: 'loaded',
      activeState: 'active',
      subState: 'running',
      unitFileState: 'enabled',
      health: 'up',
      running: true,
      mainPid: 4242,
      nRestarts: 2,
      memoryBytes: 52_428_800,
      memory: '50.0 MB',
      cpuNs: 1_234_567_890,
      uptime: '1h 0m',
      portOpen: true,
      error: null
    });
  });

  /*
   * ⚠️ Defensive, and not dead: showUnits promises an entry per requested unit, but this module is
   * the one that would render `undefined.loadState` if that ever stopped being true. Defaulting to
   * 'error'/'unknown' makes the card read 'missing' instead of taking the whole tick down.
   */
  it('survives a unit systemd said nothing at all about', async () => {
    showUnitsMock.mockResolvedValue(new Map());

    const [state] = await monitorFor(configOf([descriptor()])).refreshNow();

    expect(state).toMatchObject({
      loadState: 'error',
      activeState: 'unknown',
      subState: 'unknown',
      unitFileState: '',
      health: 'missing',
      running: false,
      mainPid: null,
      nRestarts: 0,
      memoryBytes: null,
      memory: null,
      since: null,
      uptime: null,
      error: null
    });
  });

  it('carries a batch failure through to the card', async () => {
    showing({ id: 'public-resource.service', loadState: 'error', activeState: 'unknown', error: 'systemctl not found on PATH' });

    const [state] = await monitorFor(configOf([descriptor()])).refreshNow();

    expect(state).toMatchObject({ health: 'missing', error: 'systemctl not found on PATH' });
  });
});

describe('health derivation', () => {
  /*
   * ⚠️ The order of these rules is not commutative and the second row is why: a unit that failed
   * while a stale process still holds its port must read 'failed', not 'up'. Reordering the checks
   * so the port wins would make a crashed service look healthy for as long as the orphan lives.
   */
  it.each([
    ['a unit systemd does not know about', { loadState: 'not-found', activeState: 'inactive' }, true, 'missing'],
    ['a failed unit whose port is still open', { activeState: 'failed' }, true, 'failed'],
    ['a unit still activating', { activeState: 'activating' }, false, 'starting'],
    ['a unit shutting down', { activeState: 'deactivating' }, true, 'starting'],
    ['an active unit with its port open', { activeState: 'active' }, true, 'up'],
    ['an active unit whose app has not opened its port yet', { activeState: 'active' }, false, 'starting'],
    ['a stopped unit', { activeState: 'inactive' }, false, 'down']
  ])('reads %s as %s', async (_label, show, portOpen, expected) => {
    showing({ id: 'public-resource.service', ...show });
    probeTcpMock.mockResolvedValue(portOpen);

    const [state] = await monitorFor(configOf([descriptor()])).refreshNow();

    expect(state.health).toBe(expected);
  });

  /*
   * ⚠️ A service with no port is not a service that failed its probe. There is nothing to connect
   * to — a `marketplace.target` or a unit that only writes files — so 'active' alone is the whole
   * answer, and the probe is never run at all.
   */
  it('reads an active portless unit as up without probing anything', async () => {
    showing({ id: 'worker.service', activeState: 'active' });

    const [state] = await monitorFor(configOf([descriptor({ id: 'worker', unit: 'worker.service', port: null, url: null })])).refreshNow();

    expect(state).toMatchObject({ health: 'up', portOpen: null });
    expect(probeTcpMock).not.toHaveBeenCalled();
  });

  it('probes the host services.json named for that service, at the configured timeout', async () => {
    const services = [descriptor({ id: 'a', unit: 'a.service', port: 4027 }), descriptor({ id: 'b', unit: 'b.service', port: 4028 })];
    showing({ id: 'a.service' }, { id: 'b.service' });

    await monitorFor(
      configOf(services, { probeTimeoutMs: 250, serviceHosts: new Map([['a', '10.0.0.5']]) })
    ).refreshNow();

    expect(probeTcpMock).toHaveBeenNthCalledWith(1, '10.0.0.5', 4027, 250);
    // 'b' has no entry in serviceHosts — loopback, not a crash and not a skipped probe.
    expect(probeTcpMock).toHaveBeenNthCalledWith(2, '127.0.0.1', 4028, 250);
  });
});

describe('formatting', () => {
  const withMemory = async (memoryBytes: number | null): Promise<ServiceState> => {
    showing({ id: 'public-resource.service', memoryBytes });
    const [state] = await monitorFor(configOf([descriptor()])).refreshNow();
    return state;
  };

  it.each([
    [null, null],
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [52_428_800, '50.0 MB'],
    [3_221_225_472, '3.0 GB'],
    [1024 ** 4, '1.0 TB'],
    // Past the last unit the loop knows: it must stop at TB rather than run off the end of the
    // array and print "1024.0 undefined".
    [1024 ** 5, '1024.0 TB']
  ])('renders %s bytes as %s', async (bytes, expected) => {
    expect((await withMemory(bytes)).memory).toBe(expected);
  });

  describe('uptime', () => {
    const NOW = Date.parse('2026-08-06T12:00:00.000Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    const withSince = async (since: number | null): Promise<ServiceState> => {
      showing({ id: 'public-resource.service', since });
      const [state] = await monitorFor(configOf([descriptor()])).refreshNow();
      return state;
    };

    it.each([
      ['a unit with no start time at all', null, null],
      ['seconds', NOW - 30_000, '0m'],
      ['minutes', NOW - 7 * 60_000, '7m'],
      ['hours', NOW - (3 * 3600 + 12 * 60) * 1000, '3h 12m'],
      ['days', NOW - (2 * 86_400 + 3 * 3600 + 4 * 60) * 1000, '2d 3h 4m'],
      // ⚠️ Clock skew, clamped. A start time in the future would otherwise render as a negative
      // uptime — "-1m" on a card is a bug report waiting to happen, and the unit is simply new.
      ['a start time in the future', NOW + 60_000, '0m']
    ])('renders %s as %s', async (_label, since, expected) => {
      expect((await withSince(since)).uptime).toBe(expected);
    });
  });
});

describe('subscribers', () => {
  it('hands every tick to every subscriber, and stops at unsubscribe', async () => {
    const seen: ServiceState[][] = [];
    const listener = (states: ServiceState[]): void => {
      seen.push(states);
    };
    const monitor = monitorFor(configOf([descriptor()]));

    monitor.subscribe(listener);
    await monitor.refreshNow();
    monitor.unsubscribe(listener);
    await monitor.refreshNow();

    expect(seen).toHaveLength(1);
    expect(seen[0][0].id).toBe('public-resource');
  });

  it('starts with no states and keeps the last batch afterwards', async () => {
    const monitor = monitorFor(configOf([descriptor()]));

    expect(monitor.getStates()).toEqual([]);

    const states = await monitor.refreshNow();

    expect(monitor.getStates()).toBe(states);
  });
});

describe('the poll loop', () => {
  it('ticks on its own interval, without anyone asking', async () => {
    vi.useFakeTimers();
    monitorFor(configOf([descriptor()], { pollIntervalMs: 2000 }));

    await vi.advanceTimersByTimeAsync(2000);
    expect(showUnitsMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4000);
    expect(showUnitsMock).toHaveBeenCalledTimes(3);
  });

  it('stops ticking once it is stopped', async () => {
    vi.useFakeTimers();
    const monitor = monitorFor(configOf([descriptor()]));

    await vi.advanceTimersByTimeAsync(2000);
    monitor.stop();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(showUnitsMock).toHaveBeenCalledTimes(1);
  });

  /*
   * ⚠️ Coalescing, and the reason it is a promise rather than a boolean flag. A tick that lands
   * while another is in flight joins it instead of issuing a second `systemctl show` batch — the
   * probes alone can occupy a real fraction of one interval on a slow host, so overlapping ticks
   * are the normal case, not an edge.
   */
  it('joins a tick already in flight instead of starting a second batch', async () => {
    vi.useFakeTimers();
    const pending = deferred<Map<string, UnitShowResult>>();
    showUnitsMock.mockReturnValue(pending.promise);
    monitorFor(configOf([descriptor()], { pollIntervalMs: 1000 }));

    await vi.advanceTimersByTimeAsync(3000);
    expect(showUnitsMock).toHaveBeenCalledTimes(1);

    pending.resolve(new Map([['public-resource.service', { ...SHOW_DEFAULTS, id: 'public-resource.service' }]]));
    await vi.advanceTimersByTimeAsync(1000);
    expect(showUnitsMock).toHaveBeenCalledTimes(2);
  });

  /*
   * ⚠️ refreshNow is the *post-action* path and must not merely join the tick in flight. That
   * tick's `systemctl show` may have been issued before the start/stop command the caller just ran
   * finished, so joining it would answer the HTTP request with pre-action state — a card that
   * still says 'down' on the service the click just started. It waits, then runs a genuinely new
   * batch.
   */
  it('waits for the tick in flight and then runs a fresh one', async () => {
    const first = deferred<Map<string, UnitShowResult>>();
    const answered = new Map([['public-resource.service', { ...SHOW_DEFAULTS, id: 'public-resource.service' }]]);
    showUnitsMock.mockReturnValueOnce(first.promise).mockResolvedValue(answered);
    const monitor = monitorFor(configOf([descriptor()]));

    const inFlight = monitor.refreshNow();
    const afterAction = monitor.refreshNow();
    first.resolve(answered);

    await Promise.all([inFlight, afterAction]);
    expect(showUnitsMock).toHaveBeenCalledTimes(2);
  });

  /*
   * ⚠️ A rejected tick is logged and the interval survives it. Letting it escape would be an
   * unhandled rejection from a setInterval callback — which takes the whole monitor process down,
   * for a systemctl call that will very likely work again in two seconds.
   */
  it('logs a failed tick and keeps polling', async () => {
    vi.useFakeTimers();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    showUnitsMock.mockRejectedValueOnce(new Error('dbus is gone')).mockResolvedValue(new Map());
    monitorFor(configOf([descriptor()], { pollIntervalMs: 1000 }));

    await vi.advanceTimersByTimeAsync(2000);

    expect(error).toHaveBeenCalledWith('[monitor] tick failed', expect.any(Error));
    expect(showUnitsMock).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });
});
