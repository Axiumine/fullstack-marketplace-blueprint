/** @vitest-environment jsdom */
/**
 * The dashboard's browser half, driven through the only two handles it has.
 *
 * `src/public/app.js` is an IIFE that exports nothing: the page is reachable through the DOM it
 * builds and the WebSocket it builds it from, and through nothing else. So this file mounts the
 * server's own HTML shell, hands the page a socket that connects to nothing, and walks it through a
 * session — connect, snapshot, health ticks, actions, logs, a drop and a reconnect — asserting on
 * what the page looks like at each step.
 *
 * ⚠️ **The tests run in order and share one boot.** The IIFE puts a delegated `click` listener and a
 * `keydown` listener on `document` and removes neither, so a second boot in this file would leave two
 * page instances handling the same clicks off two copies of the state. A case needing a different
 * starting condition — another page URL, a document without the expected ids, a socket that refuses
 * to open — is one of the three sibling `publicApp*` files instead.
 */
import { beforeAll, expect, it, vi } from 'vitest';

import {
  boot,
  byId,
  card,
  cardButton,
  click,
  CLOSING,
  FakeSocket,
  group,
  groupButton,
  installFakeSocket,
  metaValue,
  mountShell,
  notifications,
  OPEN,
  service,
  state
} from './support/browserHarness';

/** A fixed instant — `setLastUpdate` formats it, so nothing here may depend on the wall clock. */
const T0 = 1_760_000_000_000;

let sockets: FakeSocket[];

/** The socket the page is currently on. A reconnect appends, so the last one is always the live one. */
const ws = (): FakeSocket => sockets[sockets.length - 1];

/** Everything the page has sent on the current socket, by frame type. */
const framesOfType = (type: string): Array<Record<string, unknown>> =>
  ws()
    .frames()
    .filter((frame) => frame.type === type);

const advance = (ms: number): void => {
  vi.advanceTimersByTime(ms);
};

/**
 * The whole snapshot the page is driven from. `ghost` is listed in the `core` group and described
 * nowhere, which is the config drift `buildGrid` filters out rather than rendering as a blank card.
 */
function snapshot(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'snapshot',
    target: 'marketplace.target',
    pollIntervalMs: 5000,
    timestamp: T0,
    groups: [
      group({ id: 'core', title: 'Core', serviceIds: ['api', 'authz', 'ghost'] }),
      group({ id: 'fe', title: 'Frontends', description: 'The three apps', serviceIds: ['user'] })
    ],
    services: [
      service({ id: 'api' }),
      service({
        id: 'authz',
        unit: 'authz.service',
        label: 'Authz',
        description: 'Token lifecycle',
        port: null,
        url: null
      }),
      service({
        id: 'user',
        unit: 'user.service',
        label: 'User app',
        groupId: 'fe',
        kind: 'frontend',
        repo: 'marketplace-user',
        port: 3045,
        url: 'http://127.0.0.1:3045/',
        description: 'The customer-facing app'
      })
    ],
    states: [
      state({ id: 'api', health: 'up' }),
      state({ id: 'authz', health: 'down', running: false, portOpen: false }),
      state({ id: 'user', health: 'up' })
    ],
    ...patch
  };
}

/** Take an element out of the shell and hand back the undo — for the "the page is half there" arms. */
function detach(id: string): () => void {
  const el = byId(id);
  const parent = el.parentNode as ParentNode & Node;
  const next = el.nextSibling;

  parent.removeChild(el);

  return () => {
    parent.insertBefore(el, next);
  };
}

beforeAll(async () => {
  // requestAnimationFrame is faked alongside the timers because `notify()` schedules the class that
  // starts its transition on one; left real, that callback lands after the test that caused it.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame']
  });
  // The reconnect delay is `base * (0.5 + random/2)`. Pinning random to 0 makes it exactly base/2,
  // which is what lets the backoff assertions below be equalities rather than ranges.
  vi.spyOn(Math, 'random').mockReturnValue(0);

  sockets = installFakeSocket();
  mountShell();
  await boot();
});

it('opens a plain-ws socket at the page host and starts out disconnected', () => {
  expect(sockets).toHaveLength(1);
  expect(ws().url).toBe('ws://localhost:3000/ws');
  expect(byId('connectionWord').textContent).toBe('Disconnected');
  expect(byId('connectionStatus').className).toBe('connection-status connection-disconnected');
});

it('refuses an all-scope action before a snapshot has named the target', () => {
  click(byId('startAllBtn'));

  expect(notifications()).toContain('Not connected yet.');
  expect(ws().sent).toHaveLength(0);
});

it('goes green when the socket opens', () => {
  ws().open();

  expect(byId('connectionWord').textContent).toBe('Connected');
  expect(byId('connectionDot').className).toBe('connection-dot connection-dot-connected');
});

it('pings on the interval, and stops sending while the socket is not open', () => {
  advance(25_000);
  expect(framesOfType('ping')).toHaveLength(1);

  ws().readyState = CLOSING;
  advance(25_000);
  expect(framesOfType('ping')).toHaveLength(1);

  ws().readyState = OPEN;
  advance(25_000);
  expect(framesOfType('ping')).toHaveLength(2);
});

it('builds the grid from a snapshot, and leaves out an id nothing describes', () => {
  ws().receive(snapshot());

  expect(byId('loadingIndicator').hidden).toBe(true);
  expect(byId('servicesGrid').hidden).toBe(false);

  expect(document.querySelectorAll('.group-section')).toHaveLength(2);
  expect(document.querySelectorAll('.service-card')).toHaveLength(3);
  expect(card('ghost')).toBeNull();

  expect(byId('pollInterval').textContent).toBe('Polling every 5s');
  expect(byId('lastUpdate').textContent).toBe(`Last update: ${new Date(T0).toLocaleTimeString()}`);
});

it('renders each service card from its descriptor', () => {
  expect(card('api')?.className).toBe('service-card kind-backend health-up');
  expect(card('user')?.className).toBe('service-card kind-frontend health-up');

  expect(metaValue('api', 'Port')).toBe('4027open');
  expect(metaValue('api', 'URL')).toBe('http://127.0.0.1:4027/');
  expect(card('api')?.querySelector<HTMLAnchorElement>('.service-url')?.href).toBe(
    'http://127.0.0.1:4027/'
  );

  // A service with no port and no URL is the other half of both conditionals in buildServiceCard.
  expect(metaValue('authz', 'Port')).toBe('n/aclosed');
  expect(metaValue('authz', 'URL')).toBe('—');
  expect(card('authz')?.querySelector<HTMLAnchorElement>('.service-url')?.getAttribute('href')).toBeNull();

  expect(card('api')?.querySelector('.service-unit')?.textContent).toBe('api.service');
  expect(card('api')?.querySelector('.service-description')?.textContent).toBe('The API service');
});

it('counts only the services a group has up', () => {
  const counters = [...document.querySelectorAll('.group-counter')].map((el) => el.textContent);

  expect(counters).toStrictEqual(['1/2 up', '1/1 up']);
});

it('ignores a frame that is not JSON, and a message type it does not know', () => {
  ws().receiveRaw('} not json {');
  ws().receive({ type: 'a-type-from-a-newer-server' });

  expect(document.querySelectorAll('.service-card')).toHaveLength(3);
});

it('paints every health value onto the card and its dot', () => {
  for (const health of ['starting', 'down', 'failed', 'missing', 'up'] as const) {
    ws().receive({ type: 'states', timestamp: T0, states: [state({ id: 'api', health })] });

    expect(card('api')?.className).toBe(`service-card kind-backend health-${health}`);
    expect(card('api')?.querySelector('.health-dot')?.className).toBe(`health-dot health-${health}`);
    expect(card('api')?.querySelector('.health-word')?.textContent).toBe(health.toUpperCase());
  }
});

it('shows a dash for every figure systemd did not report, and the error when there is one', () => {
  ws().receive({
    type: 'states',
    timestamp: T0,
    states: [
      state({
        id: 'api',
        health: 'failed',
        uptime: null,
        memory: null,
        mainPid: null,
        nRestarts: 7,
        portOpen: null,
        error: 'Unit entered failed state'
      })
    ]
  });

  expect(metaValue('api', 'Uptime')).toBe('—');
  expect(metaValue('api', 'Memory')).toBe('—');
  expect(metaValue('api', 'PID')).toBe('—');
  expect(metaValue('api', 'Restarts')).toBe('7');
  expect(metaValue('api', 'Port')).toBe('4027');
  expect(card('api')?.querySelector('.port-probe')?.className).toBe('port-probe');

  const error = card('api')?.querySelector<HTMLElement>('.service-error');
  expect(error?.hidden).toBe(false);
  expect(error?.textContent).toBe('Unit entered failed state');
});

it('puts the figures back, and hides the error again, on the next clean tick', () => {
  ws().receive({ type: 'states', timestamp: T0, states: [state({ id: 'api', health: 'up' })] });

  expect(metaValue('api', 'Uptime')).toBe('2h 3m');
  expect(metaValue('api', 'Memory')).toBe('1.0 MB');
  expect(metaValue('api', 'PID')).toBe('4321');
  expect(metaValue('api', 'Port')).toBe('4027open');
  expect(card('api')?.querySelector<HTMLElement>('.service-error')?.hidden).toBe(true);
});

it('skips a state for a service it has no card for', () => {
  ws().receive({
    type: 'states',
    timestamp: T0,
    states: [
      state({ id: 'a-service-this-page-never-heard-of', health: 'up' }),
      state({ id: 'api', health: 'up' }),
      state({ id: 'authz', health: 'up' })
    ]
  });

  expect(card('a-service-this-page-never-heard-of')).toBeNull();
  expect(document.querySelector('.group-counter')?.textContent).toBe('2/2 up');
});

it('sends a service action, marks the card pending, and clears it on the result', () => {
  click(cardButton('api', 'restart'));

  expect(ws().lastFrame()).toStrictEqual({
    type: 'action',
    scope: 'service',
    targetId: 'api',
    action: 'restart'
  });
  expect(card('api')?.classList.contains('is-pending')).toBe(true);
  expect(cardButton('api', 'start').disabled).toBe(true);
  expect(cardButton('api', 'logs').disabled).toBe(false);

  ws().receive({
    type: 'action-result',
    ok: true,
    scope: 'service',
    targetId: 'api',
    message: 'Restarted API'
  });

  expect(card('api')?.classList.contains('is-pending')).toBe(false);
  expect(cardButton('api', 'start').disabled).toBe(false);
  expect(notifications()).toContain('Restarted API');
  expect(document.querySelector('.notification')?.className).toBe('notification notification-success');
  expect(document.querySelector('.notification-icon i')?.className).toBe('fas fa-circle-check');
});

it('sends a group action, and reports a failed result as an error', () => {
  click(groupButton('core', 'stop'));

  expect(ws().lastFrame()).toStrictEqual({
    type: 'action',
    scope: 'group',
    targetId: 'core',
    action: 'stop'
  });

  const section = document.querySelector('.group-section');
  expect(section?.classList.contains('is-pending')).toBe(true);
  expect(groupButton('core', 'start').disabled).toBe(true);

  ws().receive({
    type: 'action-result',
    ok: false,
    scope: 'group',
    targetId: 'core',
    message: 'systemctl stop failed'
  });

  expect(section?.classList.contains('is-pending')).toBe(false);
  expect(notifications()).toContain('systemctl stop failed');
  expect(document.querySelector('.notification.notification-error')).not.toBeNull();
  expect(document.querySelector('.notification-error .notification-icon i')?.className).toBe(
    'fas fa-circle-exclamation'
  );
});

it('sends the all-scope action against the snapshot target', () => {
  click(byId('restartAllBtn'));

  expect(ws().lastFrame()).toStrictEqual({
    type: 'action',
    scope: 'all',
    targetId: 'marketplace.target',
    action: 'restart'
  });
  expect(byId('toolbar').classList.contains('is-pending')).toBe(true);
  expect((byId('startAllBtn') as HTMLButtonElement).disabled).toBe(true);

  ws().receive({
    type: 'action-result',
    ok: true,
    scope: 'all',
    targetId: 'marketplace.target',
    message: 'Restarted every unit'
  });

  expect(byId('toolbar').classList.contains('is-pending')).toBe(false);
  expect((byId('startAllBtn') as HTMLButtonElement).disabled).toBe(false);
});

it('clears an all-scope pending flag on the next states tick, result or no result', () => {
  click(byId('stopAllBtn'));
  expect(byId('toolbar').classList.contains('is-pending')).toBe(true);

  // A states broadcast is the authoritative fleet status, so it is what retires every optimistic flag.
  ws().receive({ type: 'states', timestamp: T0, states: [state({ id: 'api', health: 'up' })] });

  expect(byId('toolbar').classList.contains('is-pending')).toBe(false);
  expect((byId('stopAllBtn') as HTMLButtonElement).disabled).toBe(false);
});

it('takes an action result for something it is not waiting on without touching the page', () => {
  // The server answers whoever asked, and this page may not have been the one — a result with no
  // pending flag behind it is a notification and nothing else.
  ws().receive({ type: 'action-result', ok: true, scope: 'service', targetId: 'authz', message: 'Started Authz' });
  ws().receive({ type: 'action-result', ok: true, scope: 'group', targetId: 'fe', message: 'Started Frontends' });
  ws().receive({ type: 'action-result', ok: true, scope: 'all', targetId: 'marketplace.target', message: 'All up' });

  expect(card('authz')?.classList.contains('is-pending')).toBe(false);
  expect(byId('toolbar').classList.contains('is-pending')).toBe(false);
  expect(notifications()).toContain('All up');
});

it('gives up on an action nothing ever answers, and names what it was waiting for', () => {
  click(cardButton('api', 'start'));
  click(groupButton('core', 'start'));
  click(byId('stopAllBtn'));

  advance(20_000);

  expect(notifications()).toContain('No response for API after 20s.');
  expect(notifications()).toContain('No response for Core after 20s.');
  expect(notifications()).toContain('No response for all services after 20s.');

  expect(card('api')?.classList.contains('is-pending')).toBe(false);
  expect(document.querySelector('.group-section')?.classList.contains('is-pending')).toBe(false);
  expect(byId('toolbar').classList.contains('is-pending')).toBe(false);
});

it('says so rather than sending when the socket is not open', () => {
  ws().readyState = CLOSING;

  click(cardButton('api', 'stop'));

  expect(notifications()).toContain('Not connected — action not sent.');
  expect(card('api')?.classList.contains('is-pending')).toBe(false);

  ws().readyState = OPEN;
});

it('drops a notification when it is dismissed, and again when the timer comes round', () => {
  ws().receive({ type: 'action-result', ok: true, scope: 'service', targetId: 'api', message: 'Only this one' });

  const container = byId('notificationContainer');
  const only = [...container.querySelectorAll('.notification')].pop() as HTMLElement;

  // The class that starts the slide-in is deferred to the next frame, so it is not on yet.
  expect(only.classList.contains('show')).toBe(false);
  advance(16);
  expect(only.classList.contains('show')).toBe(true);

  click(only.querySelector('.notification-close') as Element);
  expect(container.contains(only)).toBe(false);

  // The auto-dismiss timer for the same element still fires — and finds nothing left to remove.
  advance(5_000);
  expect(container.querySelectorAll('.notification')).toHaveLength(0);
});

it('opens the logs drawer, asks for the journal, and shows what comes back', () => {
  click(cardButton('api', 'logs'));

  expect(byId('logsDrawer').hidden).toBe(false);
  expect(document.body.classList.contains('logs-open')).toBe(true);
  expect(byId('logsTitle').textContent).toBe('Logs — API');
  expect(byId('logsContent').textContent).toBe('Loading…');
  expect(ws().lastFrame()).toStrictEqual({ type: 'logs', id: 'api', lines: 200 });

  ws().receive({ type: 'logs', id: 'api', lines: ['first line', 'second line'] });
  expect(byId('logsContent').textContent).toBe('first line\nsecond line');
  expect(byId('logsContent').classList.contains('logs-error')).toBe(false);
});

it('says so when the journal came back empty, and ignores a reply for another service', () => {
  ws().receive({ type: 'logs', id: 'api', lines: [] });
  expect(byId('logsContent').textContent).toBe('(no log output)');

  ws().receive({ type: 'logs', id: 'user', lines: ['not for this drawer'] });
  expect(byId('logsContent').textContent).toBe('(no log output)');
});

it('re-asks on Refresh', () => {
  click(byId('logsRefreshBtn'));

  expect(ws().lastFrame()).toStrictEqual({ type: 'logs', id: 'api', lines: 200 });
});

it('shows an error with a Retry when the journal never comes back', () => {
  advance(20_000);

  const content = byId('logsContent');
  expect(content.classList.contains('logs-error')).toBe(true);
  expect(content.querySelector('.logs-error-message')?.textContent).toBe('No response after 20s.');

  click(content.querySelector('.logs-error-retry') as Element);
  expect(ws().lastFrame()).toStrictEqual({ type: 'logs', id: 'api', lines: 200 });
  expect(byId('logsContent').classList.contains('logs-error')).toBe(true);

  ws().receive({ type: 'logs', id: 'api', lines: ['back again'] });
  expect(byId('logsContent').classList.contains('logs-error')).toBe(false);
  expect(byId('logsContent').textContent).toBe('back again');
});

it('cannot fetch logs while the socket is down, and says that in the drawer as well as in a toast', () => {
  ws().readyState = CLOSING;

  click(byId('logsRefreshBtn'));

  expect(notifications()).toContain('Not connected — cannot fetch logs.');
  expect(byId('logsContent').querySelector('.logs-error-message')?.textContent).toBe(
    'Not connected — logs could not be fetched.'
  );

  ws().readyState = OPEN;
});

it('closes the drawer on Escape, and leaves other keys alone', () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
  expect(byId('logsDrawer').hidden).toBe(false);

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(byId('logsDrawer').hidden).toBe(true);
  expect(document.body.classList.contains('logs-open')).toBe(false);

  // Escape with the drawer already closed is a no-op rather than a second close.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(byId('logsDrawer').hidden).toBe(true);
});

it('does nothing on Refresh once the drawer has been closed', () => {
  const before = ws().sent.length;

  click(byId('logsRefreshBtn'));

  expect(ws().sent).toHaveLength(before);
});

it('closes the drawer when the backdrop is clicked', () => {
  click(cardButton('user', 'logs'));
  expect(byId('logsTitle').textContent).toBe('Logs — User app');

  click(byId('logsBackdrop'));
  expect(byId('logsDrawer').hidden).toBe(true);
});

it('closes cleanly when the drawer is no longer in the document', () => {
  click(cardButton('api', 'logs'));

  const closeBtn = byId('logsCloseBtn');
  const restore = detach('logsDrawer');

  // The close button went out of the document with the panel it lives in, and is still wired to it.
  // Closing has to survive not finding the thing it was told to hide.
  click(closeBtn);
  restore();

  expect(document.body.classList.contains('logs-open')).toBe(false);
  expect(byId('logsDrawer').hidden).toBe(false);

  click(byId('logsCloseBtn'));
  expect(byId('logsDrawer').hidden).toBe(true);
});

it('ignores a click that is not on an action button', () => {
  const before = ws().sent.length;

  click(byId('toolbar'));
  click(byId('lastUpdate'));

  expect(ws().sent).toHaveLength(before);
});

it('backs off further on every reconnect, and never past the ceiling', () => {
  const delays = [500, 1000, 2000, 4000, 8000, 15_000];

  for (const delay of delays) {
    const opened = sockets.length;

    ws().close();
    expect(byId('connectionWord').textContent).toBe('Reconnecting…');
    expect(byId('connectionStatus').className).toBe('connection-status connection-reconnecting');

    // A second close before the timer fires must not stack a second reconnect.
    ws().onclose?.();

    advance(delay - 1);
    expect(sockets).toHaveLength(opened);

    advance(1);
    expect(sockets).toHaveLength(opened + 1);
  }
});

it('reflects an error frame as a disconnection, and lets the close that follows do the work', () => {
  ws().onerror?.();

  expect(byId('connectionWord').textContent).toBe('Disconnected');
});

it('drops the queued reconnect when the socket it gave up on opens after all', () => {
  const opened = sockets.length;

  ws().close();
  expect(byId('connectionWord').textContent).toBe('Reconnecting…');

  ws().open();
  expect(byId('connectionWord').textContent).toBe('Connected');

  // The timer that was queued a moment ago has been dropped, so no second socket ever appears.
  advance(30_000);
  expect(sockets).toHaveLength(opened);
});

it('re-asks for the logs it was waiting on when the socket comes back', () => {
  click(cardButton('api', 'logs'));
  ws().receive({ type: 'logs', id: 'api', lines: ['before the drop'] });

  ws().close();
  advance(500);

  const reconnected = ws();
  reconnected.open();

  expect(reconnected.lastFrame()).toStrictEqual({ type: 'logs', id: 'api', lines: 200 });

  click(byId('logsCloseBtn'));
  expect(byId('logsDrawer').hidden).toBe(true);
});

it('says nothing rather than throwing when the connection chrome is not all there', () => {
  for (const id of ['connectionStatus', 'connectionDot', 'connectionWord']) {
    const restore = detach(id);
    ws().onerror?.();
    restore();
  }

  // The shell is whole again, so the next status change lands where it always did.
  ws().onerror?.();
  expect(byId('connectionWord').textContent).toBe('Disconnected');
  ws().open();
});

it('rebuilds the grid on a second snapshot, with or without a loading indicator to hide', () => {
  const restore = detach('loadingIndicator');

  ws().receive(snapshot());

  expect(document.querySelectorAll('.service-card')).toHaveLength(3);
  restore();

  ws().receive(snapshot());
  expect(document.querySelectorAll('.service-card')).toHaveLength(3);
  expect(byId('loadingIndicator').hidden).toBe(true);
});

it('leaves the cards it cannot rebuild alone, and counts nobody it can no longer describe', () => {
  const grid = byId('servicesGrid');
  const restore = detach('servicesGrid');

  // With nowhere to build, the snapshot replaces what the page knows without replacing what it shows:
  // the cards on screen are now for services the new snapshot does not describe.
  ws().receive(
    snapshot({
      services: [service({ id: 'renamed-since', groupId: 'core' })],
      states: [state({ id: 'api', health: 'up' })]
    })
  );

  expect(grid.querySelector('.group-counter')?.textContent).toBe('0/2 up');
  expect(card('api')).toBeNull();

  restore();
  expect(card('api')?.className).toBe('service-card kind-backend health-up');

  ws().receive(snapshot());
  expect(document.querySelector('.group-counter')?.textContent).toBe('1/2 up');
});

it('clears a pending flag whose card and group the next snapshot removed', () => {
  click(cardButton('api', 'restart'));
  click(groupButton('core', 'restart'));
  expect(card('api')?.classList.contains('is-pending')).toBe(true);

  ws().receive(
    snapshot({
      groups: [group({ id: 'later', title: 'Later', serviceIds: [] })],
      services: [],
      states: []
    })
  );

  expect(document.querySelectorAll('.service-card')).toHaveLength(0);
  expect(document.querySelector('.group-counter')?.textContent).toBe('0/0 up');

  // Nothing threw on the way past two pending targets that no longer exist, and the page is usable.
  ws().receive(snapshot());
  expect(document.querySelectorAll('.service-card')).toHaveLength(3);
  expect(card('api')?.classList.contains('is-pending')).toBe(false);
});
