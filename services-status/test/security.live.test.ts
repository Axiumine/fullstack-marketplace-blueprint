import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import net from 'net';
import path from 'path';
import WebSocket from 'ws';

/*
 * Integration level — a real server process, driven over a real socket.
 *
 * This is the half that would have caught the original bug. The unit tests in
 * `security.test.ts` all pass against the vulnerable revision too, because the hole was not in
 * the comparison logic — it was that the WS upgrade path never called it.
 *
 * ⚠️ **It lives in its own file because it drives `dist/server.js`, not `src/`.** The server
 * runs in a spawned child process, which no in-process instrumentation can reach: these tests
 * contribute nothing to coverage, and under Stryker they would exercise a build made before
 * any mutant existed — every assertion here passes whatever was done to `src/server.ts`, so
 * each of them would report a mutant as survived while looking like a thorough test. The
 * mutation run excludes this file for that reason (`vitest.mutation.config.mts`); the coverage
 * run keeps it, because what it checks is real and nothing else checks it.
 */

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
