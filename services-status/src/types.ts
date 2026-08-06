/**
 * Data contract shared by src/*.ts and, in shape (not import — it has no build step), by
 * public/app.js. See CONTRACT.md for the authoritative version. Every field here that reaches
 * the wire must stay byte-for-byte in sync with what app.js reads.
 */

export type Health = 'up' | 'starting' | 'down' | 'failed' | 'missing';

export type Action = 'start' | 'stop' | 'restart';

// systemd unit scope. 'user' is the only one exercised in this deployment (see CONTRACT.md
// systemd requirements — everything is a `~/.config/systemd/user` unit), 'system' exists so the
// type isn't a lie if that ever changes.
export type SystemctlScope = 'user' | 'system';

export interface ServiceDescriptor {
  id: string;
  unit: string;
  label: string;
  groupId: string;
  kind: 'backend' | 'frontend';
  repo: string;
  port: number | null;
  url: string | null;
  description: string;
}

export interface GroupDescriptor {
  id: string;
  title: string;
  description: string;
  serviceIds: string[];
}

export interface ServiceState {
  id: string;
  unit: string;
  loadState: string;
  activeState: string;
  subState: string;
  unitFileState: string;
  health: Health;
  running: boolean;
  mainPid: number | null;
  nRestarts: number;
  memoryBytes: number | null;
  memory: string | null;
  cpuNs: number | null;
  since: number | null;
  uptime: string | null;
  portOpen: boolean | null;
  error: string | null;
}

export type ServerMessage =
  | {
      type: 'snapshot';
      groups: GroupDescriptor[];
      services: ServiceDescriptor[];
      states: ServiceState[];
      target: string;
      scope: SystemctlScope;
      pollIntervalMs: number;
      timestamp: number;
    }
  | { type: 'states'; states: ServiceState[]; timestamp: number }
  | {
      type: 'action-result';
      ok: boolean;
      scope: 'service' | 'group' | 'all';
      targetId: string;
      action: Action;
      message: string;
      timestamp: number;
    }
  | { type: 'logs'; id: string; lines: string[]; timestamp: number };

export type ClientMessage =
  | { type: 'action'; scope: 'service' | 'group' | 'all'; targetId: string; action: Action }
  | { type: 'logs'; id: string; lines?: number }
  | { type: 'ping' };

/**
 * Fully resolved, validated runtime configuration. `services`/`groups` are exactly the wire
 * shapes above (no extra fields attached) — anything internal-only (like the probe host, which
 * services.json allows per-service but ServiceDescriptor does not carry) lives in a sibling map
 * instead, so a stray `JSON.stringify(config.services)` can never leak it to a client.
 */
export interface AppConfig {
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

  workspaceRoot: string;
  servicesJsonPath: string;
  unitTarget: string;
  monitorUnit: string;

  groups: GroupDescriptor[];
  services: ServiceDescriptor[];
  serviceMap: Map<string, ServiceDescriptor>;
  groupMap: Map<string, GroupDescriptor>;
  // id -> host used for both URL construction and the TCP probe. Defaults to '127.0.0.1' when
  // services.json omits `host` for a service (true of every backend today — they bind the
  // wildcard, but the monitor itself always reaches them via loopback).
  serviceHosts: Map<string, string>;
}
