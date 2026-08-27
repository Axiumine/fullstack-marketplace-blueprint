import * as net from 'net';

/**
 * TCP connect probe. Tells "the systemd unit is active" apart from "the app inside it has
 * actually finished booting and is listening" — tsx/vite watch can take several seconds after
 * the process starts before the port opens, and that gap is what health 'starting' captures
 * (see deriveHealth in monitor.ts).
 *
 * Never throws and always destroys the socket: an unreachable/refused/timed-out port is a
 * normal "not up yet" result here, not an application error, so every outcome — connect,
 * timeout, or error — resolves a boolean rather than rejecting.
 */
export function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));

    socket.connect(port, host);
  });
}
