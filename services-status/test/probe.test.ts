import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as net from 'net';

import { probeTcp } from '../src/probe';

// ---------------------------------------------------------------------------
// Two halves, and both are needed.
//
// The real-socket half proves the thing actually probes TCP. It can reach 'connect' and 'error'
// on loopback deterministically, and nothing else: 'timeout' needs a peer that swallows the SYN
// without refusing it, which no local address does and no firewall-free test may arrange.
//
// The fake-socket half reaches the remaining paths — the timeout, and the settle-once guard that
// keeps a socket which times out *and then* connects from resolving twice. It is injected with
// vi.doMock + a fresh import rather than a top-level vi.mock precisely so the real half above can
// keep using the real `net` in the same file.
// ---------------------------------------------------------------------------

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (typeof addr === 'object' && addr) srv.close(() => resolve(addr.port));
      else srv.close(() => reject(new Error('could not determine a free port')));
    });
  });

describe('probeTcp over a real socket', () => {
  it('answers true for a port something is listening on', async () => {
    const server = net.createServer();
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        resolve(typeof addr === 'object' && addr ? addr.port : 0);
      });
    });

    try {
      await expect(probeTcp('127.0.0.1', port, 1000)).resolves.toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  /*
   * ⚠️ A refused connection is the normal reading of "the unit is active but the app inside it has
   * not opened its port yet" — tsx and vite take seconds to get there. It resolves false; it must
   * never reject, or one booting service would take down the whole poll tick with it.
   */
  it('answers false for a refused port instead of rejecting', async () => {
    const port = await freePort();

    await expect(probeTcp('127.0.0.1', port, 1000)).resolves.toBe(false);
  });
});

// The socket the faked `net` hands out, so a test can drive its events by hand.
class FakeSocket extends EventEmitter {
  public destroyCount = 0;
  public timeoutMs: number | null = null;
  public connectedTo: { port: number; host: string } | null = null;

  setTimeout(ms: number): void {
    this.timeoutMs = ms;
  }

  destroy(): void {
    this.destroyCount += 1;
  }

  connect(port: number, host: string): void {
    this.connectedTo = { port, host };
  }
}

describe('probeTcp against a faked socket', () => {
  const sockets: FakeSocket[] = [];

  /** Loads a fresh probe module bound to a `net` whose Socket is the fake above. */
  const freshProbe = async (): Promise<typeof probeTcp> => {
    sockets.length = 0;
    vi.resetModules();
    vi.doMock('net', () => ({
      Socket: class extends FakeSocket {
        constructor() {
          super();
          sockets.push(this);
        }
      }
    }));
    return (await import('../src/probe')).probeTcp;
  };

  afterEach(() => {
    vi.doUnmock('net');
    vi.resetModules();
  });

  it('arms the inactivity timeout before connecting, and connects where it was told to', async () => {
    const probe = await freshProbe();
    const pending = probe('10.0.0.5', 4027, 250);
    const socket = sockets[0];

    expect(socket.timeoutMs).toBe(250);
    expect(socket.connectedTo).toEqual({ port: 4027, host: '10.0.0.5' });

    socket.emit('connect');
    await expect(pending).resolves.toBe(true);
  });

  it.each([
    ['timeout', false],
    ['error', false],
    ['connect', true]
  ])('resolves %s as %s, and destroys the socket', async (event, expected) => {
    const probe = await freshProbe();
    const pending = probe('127.0.0.1', 4027, 100);
    const socket = sockets[0];

    socket.emit(event);

    await expect(pending).resolves.toBe(expected);
    expect(socket.destroyCount).toBe(1);
  });

  /*
   * ⚠️ The settle-once guard, and it is not theoretical: a socket that fires 'timeout' is not
   * cancelled by it, so a connection completing a millisecond later emits 'connect' on the same
   * socket. Without the guard the second event calls resolve() again — harmless on a promise — and
   * destroy() again on a socket already torn down. The count is what makes the guard visible.
   */
  it('ignores every event after the first one', async () => {
    const probe = await freshProbe();
    const pending = probe('127.0.0.1', 4027, 100);
    const socket = sockets[0];

    socket.emit('timeout');
    socket.emit('connect');
    socket.emit('error', new Error('ECONNRESET'));

    await expect(pending).resolves.toBe(false);
    expect(socket.destroyCount).toBe(1);
  });
});
