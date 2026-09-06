/**
 * The harness the three `publicApp*` suites boot `src/public/app.js` with.
 *
 * That file is an IIFE loaded by a `<script>` tag: it exports nothing, and everything it does is
 * reachable only through the DOM and a WebSocket. So the harness supplies exactly those two — the
 * real HTML shell out of `renderHtml()`, and a fake socket the test drives by hand — and asserts
 * against what the page looks like afterwards.
 *
 * ⚠️ **One boot per file, deliberately.** The IIFE registers a delegated `click` listener and a
 * `keydown` listener on `document`, and nothing removes them. Booting twice in one file would leave
 * a second instance handling the same clicks off its own stale state, which reads as a flake rather
 * than as the mistake it is. Anything needing a different starting condition — a different page URL,
 * a document with none of the expected ids — is its own file, which is why there are three.
 */
import { renderHtml } from '../../src/server';
import { GroupDescriptor, ServiceDescriptor, ServiceState } from '../../src/types';

/** `WebSocket.OPEN`, read off the constructor by `app.js` rather than off the instance. */
export const OPEN = 1;

/** `WebSocket.CLOSING` — any non-OPEN value works, and this is the honest one for "going away". */
export const CLOSING = 2;

/**
 * A WebSocket that connects to nothing and records what was written to it.
 *
 * `app.js` assigns the four `on*` handlers and never calls `addEventListener`, so the test's way to
 * deliver a frame is to invoke the handler the page installed — which is also the only way to be
 * sure it installed one.
 */
export class FakeSocket {
  static readonly OPEN = OPEN;

  readyState = 0;

  readonly sent: string[] = [];

  onopen: (() => void) | null = null;

  onmessage: ((event: { data: string }) => void) | null = null;

  onclose: (() => void) | null = null;

  onerror: (() => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  /** Bring the socket up the way a browser would: readyState first, then the handler. */
  open(): void {
    this.readyState = OPEN;
    this.onopen?.();
  }

  /** Deliver one server frame, already encoded — `app.js` parses the string itself. */
  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  /** Deliver a frame that is not JSON at all. */
  receiveRaw(data: string): void {
    this.onmessage?.({ data });
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  /** Every frame this socket was asked to send, parsed back. */
  frames(): Array<Record<string, unknown>> {
    return this.sent.map((raw) => JSON.parse(raw) as Record<string, unknown>);
  }

  /** The last frame sent, parsed — the assertion most tests want. */
  lastFrame(): Record<string, unknown> {
    return JSON.parse(this.sent[this.sent.length - 1]) as Record<string, unknown>;
  }
}

/**
 * Install the fake constructor as the page's `WebSocket` and return the list every instance lands
 * in, newest last. `app.js` reconnects by constructing another one, so the list is also the record
 * of how many times it tried.
 */
export function installFakeSocket(): FakeSocket[] {
  const sockets: FakeSocket[] = [];

  class Constructed extends FakeSocket {
    constructor(url: string) {
      super(url);
      sockets.push(this);
    }
  }

  (globalThis as unknown as { WebSocket: unknown }).WebSocket = Constructed;

  return sockets;
}

/**
 * Put the server's own HTML shell into the document, minus the `<script>` tag that would ask jsdom
 * to fetch `/app.js` over a network that is not there.
 *
 * ⚠️ **The shell comes from `renderHtml()` and is never retyped here.** Every id `app.js` looks up
 * is a contract with that function, in another language, in another file, checked by nothing — so a
 * fixture copy of the markup would keep these suites green through exactly the rename that breaks
 * the page.
 */
export function mountShell(): void {
  document.documentElement.innerHTML = renderHtml().replace(/<script[\s\S]*?<\/script>/, '');
}

/** A document with none of the ids the page expects — every `if (!el) return` guard at once. */
export function mountBareDocument(): void {
  document.documentElement.innerHTML = '<head></head><body></body>';
}

/**
 * Evaluate `app.js` and fire the event it boots on.
 *
 * The import runs the IIFE, which only registers listeners; `init()` waits for `DOMContentLoaded`,
 * which jsdom fired long before this. Dispatching it by hand is what starts the page.
 */
export async function boot(): Promise<void> {
  await import('../../src/public/app.js');

  document.dispatchEvent(new Event('DOMContentLoaded'));
}

// ---------------------------------------------------------------------------
// Fixtures — the wire shapes of CONTRACT.md, with only the fields a page reads
// ---------------------------------------------------------------------------

export function service(patch: Partial<ServiceDescriptor> = {}): ServiceDescriptor {
  return {
    id: 'api',
    unit: 'api.service',
    label: 'API',
    groupId: 'core',
    kind: 'backend',
    repo: 'BEs/dev/api',
    port: 4027,
    url: 'http://127.0.0.1:4027/',
    description: 'The API service',
    ...patch
  };
}

export function group(patch: Partial<GroupDescriptor> = {}): GroupDescriptor {
  return {
    id: 'core',
    title: 'Core',
    description: 'Everything the platform needs',
    serviceIds: ['api'],
    ...patch
  };
}

export function state(patch: Partial<ServiceState> & { id: string }): ServiceState {
  return {
    unit: `${patch.id}.service`,
    loadState: 'loaded',
    activeState: 'active',
    subState: 'running',
    unitFileState: 'enabled',
    health: 'up',
    running: true,
    mainPid: 4321,
    nRestarts: 0,
    memoryBytes: 1024,
    memory: '1.0 MB',
    cpuNs: 10,
    since: 1,
    uptime: '2h 3m',
    portOpen: true,
    error: null,
    ...patch
  };
}

/** The one element with this id, or a failure that names it rather than a null dereference. */
export function byId(id: string): HTMLElement {
  const el = document.getElementById(id);

  if (!el) {
    throw new Error(`the shell has no #${id} — renderHtml() and app.js disagree`);
  }

  return el;
}

/** Every notification currently on screen, newest last, read as text. */
export function notifications(): string[] {
  return [...byId('notificationContainer').querySelectorAll('.notification-message')].map(
    (el) => el.textContent ?? ''
  );
}

/** The card for a service id, or null when the grid does not hold one. */
export function card(serviceId: string): HTMLElement | null {
  return document.querySelector(`.service-card[data-service-id="${serviceId}"]`);
}

/** One of a card's four buttons, by the action it carries. */
export function cardButton(serviceId: string, action: string): HTMLButtonElement {
  const found = card(serviceId)?.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);

  if (!found) {
    throw new Error(`no ${action} button on the ${serviceId} card`);
  }

  return found;
}

/** A group section's button, by action. */
export function groupButton(groupId: string, action: string): HTMLButtonElement {
  const found = document.querySelector<HTMLButtonElement>(
    `.group-section[data-group-id="${groupId}"] .group-actions button[data-action="${action}"]`
  );

  if (!found) {
    throw new Error(`no ${action} button on the ${groupId} group`);
  }

  return found;
}

/** A real bubbling click, the only kind the page's delegated listener sees. */
export function click(el: Element): void {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/** The text of a card's meta row, by its `<dt>` label. */
export function metaValue(serviceId: string, label: string): string {
  const rows = card(serviceId)?.querySelectorAll('.meta-row') ?? [];

  for (const row of rows) {
    if (row.querySelector('dt')?.textContent === label) {
      return row.querySelector('dd')?.textContent ?? '';
    }
  }

  throw new Error(`no ${label} row on the ${serviceId} card`);
}
