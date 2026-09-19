/** @vitest-environment jsdom */
/**
 * The same page, booted into a document that has none of the ids it looks for.
 *
 * `app.js` reaches for eighteen elements by id and checks every one of them. That is not paranoia:
 * the shell is a template literal in `src/server.ts`, in another language, and nothing but these
 * assertions holds the two together — so the answer to "what happens when the markup moves on
 * without the script" has to be *nothing happens*, on every one of those lookups, and this file is
 * where that is shown.
 *
 * ⚠️ **One boot, in order, like its siblings.** See `publicApp.test.ts` for why.
 */
import { beforeAll, expect, it, vi } from 'vitest';

import {
  boot,
  click,
  CLOSING,
  FakeSocket,
  group,
  installFakeSocket,
  mountBareDocument,
  OPEN,
  service,
  state
} from './support/browserHarness';

const T0 = 1_760_000_000_000;

let sockets: FakeSocket[];

const ws = (): FakeSocket => sockets[sockets.length - 1];

/**
 * A button of the shape the delegated handler looks for, put straight into the body — the cards that
 * would normally carry these were never built, because there is no grid to build them in.
 */
function actionButton(dataset: Record<string, string>): HTMLButtonElement {
  const btn = document.createElement('button');

  btn.type = 'button';
  for (const [key, value] of Object.entries(dataset)) {
    btn.dataset[key] = value;
  }
  document.body.appendChild(btn);

  return btn;
}

beforeAll(async () => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame']
  });
  vi.spyOn(Math, 'random').mockReturnValue(0);

  sockets = installFakeSocket();
  mountBareDocument();
  await boot();
});

it('boots and connects with no toolbar, no drawer and no status chrome to wire', () => {
  expect(sockets).toHaveLength(1);
  expect(document.body.children).toHaveLength(0);

  ws().open();

  expect(document.body.children).toHaveLength(0);
});

it('takes a whole snapshot without a grid to build it in', () => {
  ws().receive({
    type: 'snapshot',
    target: 'marketplace.target',
    pollIntervalMs: 5000,
    timestamp: T0,
    groups: [group({ id: 'core', serviceIds: ['api'] })],
    services: [service({ id: 'api' })],
    states: [state({ id: 'api', health: 'up' })]
  });

  expect(document.querySelectorAll('.service-card')).toHaveLength(0);
  expect(document.body.children).toHaveLength(0);
});

it('ignores a button that names an action but no target to act on', () => {
  // Self-contained: put the socket in the OPEN state here rather than relying on an earlier test
  // having done it — otherwise a mutant that drops the scope/target guard would still pass, only
  // because sendAction's own "not connected" guard happened to swallow the click first.
  ws().open();

  click(actionButton({ action: 'start' }));
  click(actionButton({ action: 'start', scope: 'service' }));

  expect(ws().sent).toHaveLength(0);
});

it('ignores a button whose action is not one it performs', () => {
  click(actionButton({ action: 'redeploy', scope: 'service', target: 'api' }));

  expect(ws().sent).toHaveLength(0);
});

it('falls back to the id when a logs button carries no label, and asks anyway', () => {
  click(actionButton({ action: 'logs', scope: 'service', target: 'api' }));

  expect(ws().lastFrame()).toStrictEqual({ type: 'logs', id: 'api', lines: 200 });
  expect(document.body.classList.contains('logs-open')).toBe(true);
});

it('drops a journal it has nowhere to show', () => {
  // Self-contained: open the drawer for 'api' right here instead of relying on an earlier test
  // having left state.logsTarget set to it — a mutant that drops the "nowhere to show it" guard
  // must not get to pass just because some other test happened to satisfy the precondition first.
  click(actionButton({ action: 'logs', scope: 'service', target: 'api' }));

  ws().receive({ type: 'logs', id: 'api', lines: ['a line nobody will read'] });

  expect(document.body.textContent).toBe('');
});

it('has nowhere to report that the logs could not be fetched either', () => {
  ws().readyState = CLOSING;

  click(actionButton({ action: 'logs', scope: 'service', target: 'api' }));

  expect(document.querySelectorAll('.notification')).toHaveLength(0);
  expect(document.querySelectorAll('.logs-error-message')).toHaveLength(0);

  ws().readyState = OPEN;
});

it('sends an action for a target it has no card, group or toolbar for', () => {
  // Ids the snapshot above does not describe: a card whose service was retired between the snapshot
  // and the click has exactly this shape, and the page must still send what it was asked to send.
  click(actionButton({ action: 'start', scope: 'service', target: 'retired-service' }));
  click(actionButton({ action: 'stop', scope: 'group', target: 'retired-group' }));
  click(actionButton({ action: 'restart', scope: 'all', target: 'marketplace.target' }));

  expect(ws().frames().filter((frame) => frame.type === 'action')).toStrictEqual([
    { type: 'action', scope: 'service', targetId: 'retired-service', action: 'start' },
    { type: 'action', scope: 'group', targetId: 'retired-group', action: 'stop' },
    { type: 'action', scope: 'all', targetId: 'marketplace.target', action: 'restart' }
  ]);
});

it('names the three targets by id when nothing answers and nothing describes them', () => {
  // The timeout fires for all three scopes at once. With no descriptor to look the first two up in,
  // the message falls back to the raw id — which is the only thing the page knows about them.
  vi.advanceTimersByTime(20_000);

  expect(document.querySelectorAll('.notification')).toHaveLength(0);
  expect(document.body.textContent).toBe('');
});

it('does nothing on Escape when there is no drawer to close', () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

  expect(document.body.classList.contains('logs-open')).toBe(true);
});
