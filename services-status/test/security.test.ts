import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import net from 'net';
import path from 'path';
import WebSocket from 'ws';

import { assertSameOrigin, assertTrustedHost, buildTrustedHosts, hostnameOnly, isTrustedOrigin } from '../src/server';

// ---------------------------------------------------------------------------
// Unit level — the pure guards, no server involved
// ---------------------------------------------------------------------------

describe('hostnameOnly', () => {
  it.each([
    ['127.0.0.1:2901', '127.0.0.1'],
    ['127.0.0.1', '127.0.0.1'],
    ['[::1]:2901', '::1'],
    ['[::1]', '::1'],
    ['Status.LAN:8080', 'status.lan'],
    // A trailing colon-group that is not numeric is part of the name, not a port — stripping it
    // would silently widen the allowlist to a host nobody configured.
    ['example.com:notaport', 'example.com:notaport']
  ])('%s -> %s', (input, expected) => {
    expect(hostnameOnly(input)).toBe(expected);
  });
});

describe('buildTrustedHosts', () => {
  const base = { domain: '', host: '', allowedHosts: [] as string[] };

  it('always trusts the loopback names', () => {
    const hosts = buildTrustedHosts(base);
    expect(hosts.has('127.0.0.1')).toBe(true);
    expect(hosts.has('localhost')).toBe(true);
    expect(hosts.has('::1')).toBe(true);
  });

  it('adds DOMAIN and HOST, lowercased', () => {
    const hosts = buildTrustedHosts({ ...base, domain: 'Status.Example.COM', host: '192.168.1.10' });
    expect(hosts.has('status.example.com')).toBe(true);
    expect(hosts.has('192.168.1.10')).toBe(true);
  });

  it('never trusts a wildcard bind address as a name', () => {
    // A browser never sends Host: 0.0.0.0; trusting it would only ever help an attacker.
    expect(buildTrustedHosts({ ...base, host: '0.0.0.0' }).has('0.0.0.0')).toBe(false);
    expect(buildTrustedHosts({ ...base, host: '::' }).has('::')).toBe(false);
  });

  it('adds ALLOWED_HOSTS entries', () => {
    const hosts = buildTrustedHosts({ ...base, allowedHosts: ['status.lan', '10.0.0.5'] });
    expect(hosts.has('status.lan')).toBe(true);
    expect(hosts.has('10.0.0.5')).toBe(true);
  });
});

describe('assertTrustedHost', () => {
  const trusted = buildTrustedHosts({ domain: 'status.example.com', host: '', allowedHosts: [] });

  it('accepts a configured host, with or without a port', () => {
    expect(assertTrustedHost('127.0.0.1:2901', trusted).allowed).toBe(true);
    expect(assertTrustedHost('status.example.com', trusted).allowed).toBe(true);
  });

  it('rejects an unknown host — this is the DNS-rebinding defense', () => {
    const decision = assertTrustedHost('evil.example:2901', trusted);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('ALLOWED_HOSTS');
  });

  it('rejects a missing Host header outright', () => {
    expect(assertTrustedHost(undefined, trusted).allowed).toBe(false);
  });
});

describe('isTrustedOrigin', () => {
  const trusted = buildTrustedHosts({ domain: '', host: '', allowedHosts: [] });

  it('accepts an origin whose host is trusted', () => {
    expect(isTrustedOrigin('http://127.0.0.1:2901', trusted)).toBe(true);
  });

  it('rejects an untrusted host', () => {
    expect(isTrustedOrigin('https://evil.example', trusted)).toBe(false);
  });

  it('rejects an unparsable origin instead of throwing', () => {
    expect(isTrustedOrigin('not a url', trusted)).toBe(false);
    expect(isTrustedOrigin('', trusted)).toBe(false);
  });
});

describe('assertSameOrigin', () => {
  const trusted = buildTrustedHosts({ domain: '', host: '', allowedHosts: [] });

  it('accepts a trusted Origin', () => {
    expect(assertSameOrigin('http://127.0.0.1:2901', undefined, trusted, false).allowed).toBe(true);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(assertSameOrigin(undefined, 'http://127.0.0.1:2901/', trusted, false).allowed).toBe(true);
  });

  it('rejects a cross-site Origin even when a valid token is present', () => {
    // A token does not launder a forged origin: the browser attached that Origin, and the token
    // may simply have been sitting in the page URL of a tab the attacker got the victim to open.
    expect(assertSameOrigin('https://evil.example', undefined, trusted, true).allowed).toBe(false);
  });

  it('allows a header-less request only when a valid token is presented', () => {
    expect(assertSameOrigin(undefined, undefined, trusted, true).allowed).toBe(true);
    expect(assertSameOrigin(undefined, undefined, trusted, false).allowed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration level — a real server process, driven over a real socket.
//
// This is the half that would have caught the original bug. The unit tests above all pass
// against the vulnerable revision too, because the hole was not in the comparison logic — it
// was that the WS upgrade path never called it.
// ---------------------------------------------------------------------------

const projectRoot = path.resolve(__dirname, '..');

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (typeof addr === 'object' && addr) {
        const { port } = addr;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error('could not determine a free port')));
      }
    });
  });
}

function request(
  port: number,
  method: string,
  reqPath: string,
  headers: Record<string, string>
): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: reqPath, headers }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
    });
    req.on('error', reject);
    req.end();
  });
}

type WsOutcome = { accepted: true; services: number } | { accepted: false; status: number | null };

function wsHandshake(port: number, headers: Record<string, string>): Promise<WsOutcome> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
    const finish = (outcome: WsOutcome): void => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* already destroyed */
      }
      resolve(outcome);
    };
    const timer = setTimeout(() => {
      try {
        ws.terminate();
      } catch {
        /* already destroyed */
      }
      resolve({ accepted: false, status: null });
    }, 8000);

    ws.on('unexpected-response', (_req, res) => finish({ accepted: false, status: res.statusCode ?? null }));
    ws.on('error', () => finish({ accepted: false, status: null }));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as { type: string; services?: unknown[] };
      if (msg.type === 'snapshot') finish({ accepted: true, services: msg.services?.length ?? 0 });
    });
  });
}

describe('live server: origin and host enforcement', () => {
  let child: ChildProcess;
  let port: number;

  beforeAll(async () => {
    port = await freePort();
    child = spawn(process.execPath, ['dist/server.js'], {
      cwd: projectRoot,
      // Explicit env, not a merge of the ambient one: a stray AUTH_TOKEN in the developer's shell
      // would otherwise silently change which branch of the guard these assertions exercise.
      // dotenv.config() does not override an already-set variable, so these win over any .env.
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        PORT: String(port),
        BIND_ALL: 'false',
        AUTH_TOKEN: '',
        ALLOWED_HOSTS: '',
        DOMAIN: '127.0.0.1',
        POLL_INTERVAL_MS: '60000' // one poll at boot is enough; don't spam systemctl during the run
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const deadline = Date.now() + 20_000;
    for (;;) {
      if (Date.now() > deadline) throw new Error('server did not become reachable within 20s');
      try {
        await request(port, 'GET', '/', { Host: `127.0.0.1:${port}` });
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  }, 30_000);

  afterAll(() => {
    child?.kill('SIGTERM');
  });

  describe('WebSocket upgrade', () => {
    it('refuses a cross-origin handshake with 403', async () => {
      // The original hole: this handshake was accepted, delivered the full topology, and could
      // then dispatch start/stop/restart on every unit.
      const outcome = await wsHandshake(port, { Origin: 'https://evil.example' });
      expect(outcome).toEqual({ accepted: false, status: 403 });
    });

    it('refuses a DNS-rebound handshake whose Host and Origin agree with each other', async () => {
      const outcome = await wsHandshake(port, { Origin: `http://evil.example:${port}`, Host: `evil.example:${port}` });
      expect(outcome).toEqual({ accepted: false, status: 403 });
    });

    it('refuses a handshake with no Origin and no token', async () => {
      const outcome = await wsHandshake(port, {});
      expect(outcome).toEqual({ accepted: false, status: 403 });
    });

    it('accepts the legitimate same-origin handshake and sends a snapshot', async () => {
      const outcome = await wsHandshake(port, { Origin: `http://127.0.0.1:${port}` });
      expect(outcome.accepted).toBe(true);
    });

    it('accepts the legitimate handshake under the localhost name', async () => {
      const outcome = await wsHandshake(port, { Origin: `http://localhost:${port}`, Host: `localhost:${port}` });
      expect(outcome.accepted).toBe(true);
    });
  });

  describe('HTTP', () => {
    it('refuses a DNS-rebound read of the topology', async () => {
      // Reads matter too: this endpoint returns every unit name, port and repo path.
      const res = await request(port, 'GET', '/api/services', { Host: `evil.example:${port}` });
      expect(res.status).toBe(403);
    });

    it('refuses a DNS-rebound read of journal output', async () => {
      const res = await request(port, 'GET', '/api/services/marketplace-admin/logs', { Host: `evil.example:${port}` });
      expect(res.status).toBe(403);
    });

    it('serves a legitimate read', async () => {
      const res = await request(port, 'GET', '/api/services', { Host: `127.0.0.1:${port}` });
      expect(res.status).toBe(200);
    });

    it('refuses a cross-site POST (the auto-submitting form attack)', async () => {
      const res = await request(port, 'POST', '/api/all/stop', {
        Host: `127.0.0.1:${port}`,
        Origin: 'https://evil.example'
      });
      expect(res.status).toBe(403);
    });

    it('refuses a DNS-rebound POST', async () => {
      const res = await request(port, 'POST', '/api/all/stop', {
        Host: `evil.example:${port}`,
        Origin: `http://evil.example:${port}`
      });
      expect(res.status).toBe(403);
    });

    it('refuses a POST with no Origin and no token', async () => {
      const res = await request(port, 'POST', '/api/all/stop', { Host: `127.0.0.1:${port}` });
      expect(res.status).toBe(403);
    });
  });
});
