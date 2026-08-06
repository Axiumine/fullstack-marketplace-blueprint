import { AppConfig, Health, ServiceDescriptor, ServiceState } from './types';
import { showUnits, UnitShowResult } from './systemd';
import { probeTcp } from './probe';

export type StateListener = (states: ServiceState[]) => void;

export interface Monitor {
  subscribe(listener: StateListener): void;
  unsubscribe(listener: StateListener): void;
  getStates(): ServiceState[];
  refreshNow(): Promise<ServiceState[]>;
  stop(): void;
}

/**
 * health derivation — see CONTRACT.md, order matters and is not commutative
 * (e.g. a 'failed' unit with its port still open from a stale process must read 'failed', not 'up').
 */
function deriveHealth(loadState: string, activeState: string, portOpen: boolean | null, port: number | null): Health {
  if (loadState !== 'loaded') return 'missing';
  if (activeState === 'failed') return 'failed';
  if (activeState === 'activating' || activeState === 'deactivating') return 'starting';
  if (activeState === 'active' && (portOpen === true || port === null)) return 'up';
  if (activeState === 'active' && portOpen === false) return 'starting'; // unit is up, app still booting
  return 'down';
}

function formatMemory(bytes: number | null): string | null {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatUptime(sinceMs: number | null): string | null {
  if (sinceMs === null) return null;
  const diffMs = Math.max(0, Date.now() - sinceMs); // clamp: a clock skew must never show negative uptime
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function buildServiceState(service: ServiceDescriptor, show: UnitShowResult | undefined, portOpen: boolean | null): ServiceState {
  const loadState = show?.loadState ?? 'error';
  const activeState = show?.activeState ?? 'unknown';
  const subState = show?.subState ?? 'unknown';
  const unitFileState = show?.unitFileState ?? '';
  const memoryBytes = show?.memoryBytes ?? null;
  const since = show?.since ?? null;

  return {
    id: service.id,
    unit: service.unit,
    loadState,
    activeState,
    subState,
    unitFileState,
    health: deriveHealth(loadState, activeState, portOpen, service.port),
    running: activeState === 'active',
    mainPid: show?.mainPid ?? null,
    nRestarts: show?.nRestarts ?? 0,
    memoryBytes,
    memory: formatMemory(memoryBytes),
    cpuNs: show?.cpuNs ?? null,
    since,
    uptime: formatUptime(since),
    portOpen,
    error: show?.error ?? null
  };
}

/**
 * One shared poller for the whole process — not one per WebSocket client. This is the fix for
 * the old design's `12 services × 3 exec calls × every connected client × every second`.
 *
 * The interval keeps running for the lifetime of the process regardless of subscriber count.
 * The alternative — stop the interval when the last WS client disconnects — would leave
 * GET /api/services serving stale data (or would need its own fallback poll path), for a saving
 * that only matters when literally nobody is watching the page. Keeping it simple and always-on
 * is correct; refreshNow() is there for the (rare) case a caller wants a state guaranteed fresher
 * than the current tick without waiting for the interval.
 */
export function createMonitor(config: AppConfig): Monitor {
  const listeners = new Set<StateListener>();
  let states: ServiceState[] = [];
  // Re-entrancy guard: was a plain boolean that made a caller arriving mid-tick return the
  // PREVIOUS completed batch (`states` as of before this tick started) instead of this tick's
  // result. That is fine for the periodic interval (freshness within one pollIntervalMs doesn't
  // matter), but it made refreshNow() hand back stale, pre-action state to action handlers in
  // server.ts (start/stop -> refreshNow() -> response), since the probes alone can occupy a real
  // fraction of every poll interval. Fix: track the in-flight tick's own promise so a concurrent
  // caller awaits THAT tick's real result — still only one `systemctl show` batch in flight at a
  // time (the original goal), just coalesced instead of skipped.
  let inFlight: Promise<ServiceState[]> | null = null;

  async function run(): Promise<ServiceState[]> {
    const units = config.services.map((s) => s.unit);
    const [showResults, probeResults] = await Promise.all([
      showUnits(units, config.systemctlScope),
      Promise.all(
        config.services.map((s) => {
          if (s.port === null) return Promise.resolve(null);
          const host = config.serviceHosts.get(s.id) ?? '127.0.0.1';
          return probeTcp(host, s.port, config.probeTimeoutMs);
        })
      )
    ]);

    states = config.services.map((service, index) => buildServiceState(service, showResults.get(service.unit), probeResults[index]));

    for (const listener of listeners) listener(states);
    return states;
  }

  // Cheap path used by the periodic interval: coalesce with any tick already running rather than
  // starting a second one. A caller that lands mid-tick gets that tick's fresh-enough result.
  function tick(): Promise<ServiceState[]> {
    if (inFlight) return inFlight;
    inFlight = run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  // Guaranteed-post-action path used by refreshNow(): if a tick is already running, its
  // `systemctl show` may have been issued BEFORE the caller's control command finished, so
  // coalescing onto it alone is not enough — await it, then run a genuinely new tick. Calling
  // tick() again after the await (rather than reusing the same promise) is what makes this a
  // second, later batch instead of the same stale-relative-to-now one; `inFlight` is guaranteed
  // null at that point since run()'s `finally` clears it before this await resolves, so the
  // second tick() always starts a fresh run() and neither path can deadlock or recurse.
  async function refresh(): Promise<ServiceState[]> {
    if (inFlight) await inFlight;
    return tick();
  }

  const timer = setInterval(() => {
    tick().catch((err) => console.error('[monitor] tick failed', err));
  }, config.pollIntervalMs);

  return {
    subscribe(listener) {
      listeners.add(listener);
    },
    unsubscribe(listener) {
      listeners.delete(listener);
    },
    getStates() {
      return states;
    },
    refreshNow() {
      return refresh();
    },
    stop() {
      clearInterval(timer);
    }
  };
}
