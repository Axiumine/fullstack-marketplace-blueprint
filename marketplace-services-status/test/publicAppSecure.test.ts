/** @vitest-environment jsdom */
/** @vitest-environment-options { "url": "https://status.internal.example/?token=a%2Fb%3Fc" } */
/**
 * The same page served over TLS, with the token in its own URL.
 *
 * Both facts are read off `window.location` at boot, which is fixed for the life of a document — so
 * the only way to test them is a document that was created with that URL, and that is a whole file.
 *
 * ⚠️ **`?token=` is the WebSocket's only way to carry `AUTH_TOKEN`.** The browser WebSocket API takes
 * no headers, so when the server has auth on, this query parameter is the handshake credential; a
 * page that dropped it would fail the upgrade with a 401 and reconnect forever.
 */
import { beforeAll, expect, it } from 'vitest';

import { boot, byId, FakeSocket, installFakeSocket, mountShell } from './support/browserHarness';

let sockets: FakeSocket[];

beforeAll(async () => {
  sockets = installFakeSocket();
  mountShell();
  await boot();
});

it('upgrades to wss on an https page and carries the token through, re-encoded', () => {
  expect(sockets).toHaveLength(1);
  expect(sockets[0].url).toBe('wss://status.internal.example/ws?token=a%2Fb%3Fc');
});

it('is otherwise the same page', () => {
  sockets[0].open();

  expect(byId('connectionWord').textContent).toBe('Connected');
});
