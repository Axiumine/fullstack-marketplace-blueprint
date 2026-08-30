import Koa from 'koa';
import Router from 'koa-router';
import serve from 'koa-static';
// ⚠️ Named imports, not `import WebSocket from 'ws'`. The default import resolves differently in
// the two module systems this file is loaded under: the CJS build gets index.js, whose export
// carries `.Server` as a static, while a test runner loading the TypeScript as ESM gets
// wrapper.mjs, whose default is the bare WebSocket class with no statics at all — so
// `new WebSocket.Server(...)` throws "default.Server is not a constructor" there and nowhere else.
// Both names below exist in both faces of the package.
import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { timingSafeEqual } from 'crypto';
import { loadConfig } from './config';
import { createMonitor, Monitor } from './monitor';
import { controlUnit, unitLogs } from './systemd';
import { Action, AppConfig, ClientMessage, ServerMessage, ServiceState } from './types';

// ---------------------------------------------------------------------------
// Small validators shared by the HTTP routes and the WS message handler
// ---------------------------------------------------------------------------

const ACTIONS: ReadonlySet<string> = new Set(['start', 'stop', 'restart']);
export function isAction(value: unknown): value is Action {
  // No `typeof value === 'string'` conjunct: Set#has answers false for anything the set does not
  // contain, a number and an object included, so the type test could never change an answer — it
  // would be a condition no input can falsify. The cast is what a hit proves: value was a member.
  return ACTIONS.has(value as string);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ---------------------------------------------------------------------------
// Auth (Bearer header or ?token= query param, timing-safe compare)
// ---------------------------------------------------------------------------

function timingSafeTokenEquals(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);
  // timingSafeEqual throws on mismatched-length buffers rather than returning false, and the
  // length check itself is fine to do in variable time here — the token's length is not the
  // secret, its bytes are.
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

// Exported for the same reason as the guards below it: the empty-Bearer fall-through cannot be
// reached over a real socket — HTTP strips the trailing whitespace that would produce it — so the
// contract is asserted here rather than through a transport that quietly rewrites the input.
export function extractToken(authorizationHeader: string | undefined, tokenQueryParam: string | undefined): string | null {
  if (authorizationHeader && authorizationHeader.toLowerCase().startsWith('bearer ')) {
    const token = authorizationHeader.slice('bearer '.length).trim();
    if (token) return token;
  }
  if (tokenQueryParam) return tokenQueryParam;
  return null;
}

// Koa hands a repeated query parameter over as an array (`?token=a&token=b`), so this one is real.
// Its header-side twin was deleted: Node discards duplicate `host`, `authorization` and `origin`
// headers rather than joining them, so `req.headers.*` is only ever a string there and the array
// arm was a branch no request could take.
function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// ---------------------------------------------------------------------------
// CSRF guard for state-changing HTTP requests (POST /api/services|groups|all/:action).
//
// Why this exists: with AUTH_TOKEN unset and the default 127.0.0.1 bind, the POST routes take
// their target from the URL path alone, which is exactly the shape a plain HTML <form method=POST>
// can auto-submit cross-origin with no CORS preflight (a form POST is a "simple request"). Any page
// the developer's browser has open could silently stop/start/restart every unit. The browser itself
// gives us the defense: it always attaches Origin (and, failing that, Referer) to a cross-site form
// submission or a same-origin fetch(), and neither can be forged by the attacking page.
// ---------------------------------------------------------------------------

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

// Host header may be "hostname" or "hostname:port"; IPv6 literals arrive bracketed
// ("[::1]:2901"). Strips down to a bare hostname so it compares 1:1 with URL#hostname, which
// never includes brackets or a port.
//
// The closing bracket is unescaped on purpose: outside a character class `]` is an ordinary
// literal in JS regex, so `\]` is a redundant escape and Qodana's RegExpRedundantEscape flags it
// at HIGH, which is a hard 0-threshold failure here. The opening `\[` genuinely needs its escape.
export function hostnameOnly(hostHeader: string): string {
  const bracketed = hostHeader.match(/^\[(.+)](?::\d+)?$/);
  if (bracketed) return bracketed[1].toLowerCase();
  const colonIndex = hostHeader.lastIndexOf(':');
  if (colonIndex > -1 && /^\d+$/.test(hostHeader.slice(colonIndex + 1))) return hostHeader.slice(0, colonIndex).toLowerCase();
  return hostHeader.toLowerCase();
}

// The set of Host header values this server answers to. Everything else is refused before any
// route runs — see assertTrustedHost() for why this exists at all.
//
// Loopback names are unconditional: the default bind is 127.0.0.1 and that is how the page is
// normally reached. DOMAIN and HOST are added because they are the names whoever deployed it set.
// ALLOWED_HOSTS extends it for the cases this process cannot derive (a LAN IP under BIND_ALL, a
// second vhost). '0.0.0.0' and '::' are wildcards, not names a browser ever sends, so they are
// never added — otherwise BIND_ALL=true would trust a literal Host: 0.0.0.0.
export function buildTrustedHosts(config: Pick<AppConfig, 'domain' | 'host' | 'allowedHosts'>): ReadonlySet<string> {
  const hosts = new Set<string>(['127.0.0.1', 'localhost', '::1']);
  if (config.domain) hosts.add(config.domain.toLowerCase());
  if (config.host && config.host !== '0.0.0.0' && config.host !== '::') hosts.add(config.host.toLowerCase());
  for (const extra of config.allowedHosts) hosts.add(extra);
  return hosts;
}

/**
 * DNS-rebinding guard, and the reason the Host header is validated instead of merely being
 * compared against Origin.
 *
 * The earlier version of this file trusted `Host` as the authority for "what this server is
 * called" and only asked whether Origin agreed with it. Those two headers agreeing proves
 * nothing, because an attacker controls both at once: point evil.example at 127.0.0.1, get the
 * victim's browser to load http://evil.example:2901/, and it sends Host: evil.example:2901 and
 * Origin: http://evil.example:2901 — a perfect match, from a page the attacker wrote. Verified
 * with a PoC against the previous code: the handshake was accepted and an action executed.
 *
 * Pinning Host to a configured allowlist breaks that: the browser will happily send the
 * attacker's name, and this server simply does not answer to it. Applied to *every* request, not
 * just state-changing ones — GET /api/services leaks the whole topology and
 * GET /api/services/:id/logs leaks journal output, so a read-only rebind is still a breach.
 */
export function assertTrustedHost(hostHeader: string | undefined, trustedHosts: ReadonlySet<string>): { allowed: boolean; reason: string } {
  // No Host at all is HTTP/1.0 or a raw socket — never a browser, and nothing here needs to
  // serve it. Refusing costs nothing and removes a branch an attacker could aim for.
  if (!hostHeader) return { allowed: false, reason: 'missing Host header' };
  const name = hostnameOnly(hostHeader);
  return trustedHosts.has(name)
    ? { allowed: true, reason: 'host is trusted' }
    : { allowed: false, reason: `Host "${name}" is not served here (add it to ALLOWED_HOSTS if that is wrong)` };
}

// True when originOrReferer names a host in the trusted set. Compared against the *allowlist*,
// never against the request's own Host header — see assertTrustedHost() above for why that
// distinction is the whole fix. Port is deliberately not compared: the page is reached at
// :PORT directly but at :443 through nginx, and the trusted-host check is what carries the
// weight here.
export function isTrustedOrigin(originOrReferer: string, trustedHosts: ReadonlySet<string>): boolean {
  try {
    // No .toLowerCase(): the WHATWG parser lowercases the host of every http/https URL, and those
    // are the only schemes a browser puts in Origin or Referer. Case survives parsing only on an
    // opaque host ('foo://EXAMPLE.com'), which is not a browser origin and is refused here — the
    // trusted set is lowercase throughout, DOMAIN, HOST and ALLOWED_HOSTS included.
    return trustedHosts.has(new URL(originOrReferer).hostname);
  } catch {
    return false; // unparsable Origin/Referer is never trusted
  }
}

// Decides whether a state-changing request may proceed. Not pure (it encodes the fallback
// policy, not just a comparison) but still free of ctx/IO so it stays unit-testable on its own.
export function assertSameOrigin(
  originHeader: string | undefined,
  refererHeader: string | undefined,
  trustedHosts: ReadonlySet<string>,
  hasValidToken: boolean
): { allowed: boolean; reason: string } {
  const candidate = originHeader || refererHeader;
  if (candidate) {
    return isTrustedOrigin(candidate, trustedHosts)
      ? { allowed: true, reason: 'same-origin' }
      : { allowed: false, reason: 'Origin/Referer host is not served here' };
  }
  // Neither header is present. A real cross-site form POST or same-origin fetch() always carries
  // at least Origin, so an absence of both means a non-browser client (curl, a script) rather than
  // a forged browser request — that case is legitimate and needs an escape hatch. The chosen hatch
  // is AUTH_TOKEN, not a new env var: a CSRF page can make the browser send a request, but it can
  // never read this server's config to learn the token, so a valid token is proof the caller isn't
  // a tricked browser. Tradeoff, stated plainly: with AUTH_TOKEN left unset, a tokenless curl POST
  // now gets 403 instead of succeeding — deliberate, because without a configured token there is no
  // credential left to fall back on.
  return hasValidToken
    ? { allowed: true, reason: 'no Origin/Referer, but a valid AUTH_TOKEN was presented' }
    : { allowed: false, reason: 'missing Origin/Referer and no valid AUTH_TOKEN' };
}

// ---------------------------------------------------------------------------
// HTML shell — element IDs below are the contract with public/app.js, which builds
// everything else (groups, cards, notifications) into these mount points at runtime.
// ---------------------------------------------------------------------------

function renderHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!-- AUTH_TOKEN rides the page URL as ?token=; a bare Referrer-Policy header covers the HTML
       response itself, but this tag also covers any navigation *away* from this document
       (e.g. clicking the cdnjs stylesheet's URL never happens, but belt-and-braces costs nothing). -->
  <meta name="referrer" content="no-referrer" />
  <title>Marketplace Services Status</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <link rel="stylesheet" href="/css/base.css" />
  <link rel="stylesheet" href="/css/layout.css" />
  <link rel="stylesheet" href="/css/toolbar.css" />
  <link rel="stylesheet" href="/css/service-cards.css" />
  <link rel="stylesheet" href="/css/service-components.css" />
  <link rel="stylesheet" href="/css/status-indicators.css" />
  <link rel="stylesheet" href="/css/logs.css" />
  <link rel="stylesheet" href="/css/notifications.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
</head>
<body>
  <div class="container">
    <header class="app-header">
      <div class="app-title"><i class="fas fa-cog" aria-hidden="true"></i> Marketplace Services Status</div>
      <div id="connectionStatus" class="connection-status">
        <span id="connectionDot" class="connection-dot"></span>
        <span id="connectionWord">Disconnected</span>
      </div>
    </header>

    <div id="toolbar" class="toolbar">
      <div class="app-meta">
        <span id="lastUpdate">Last update: never</span>
        <span id="pollInterval">Polling: —</span>
      </div>
      <div class="toolbar-actions">
        <button type="button" id="startAllBtn" class="btn btn-start"><i class="fas fa-play" aria-hidden="true"></i><span>Start all</span></button>
        <button type="button" id="stopAllBtn" class="btn btn-stop"><i class="fas fa-stop" aria-hidden="true"></i><span>Stop all</span></button>
        <button type="button" id="restartAllBtn" class="btn btn-restart"><i class="fas fa-sync-alt" aria-hidden="true"></i><span>Restart all</span></button>
      </div>
    </div>

    <div id="loadingIndicator" class="loading-indicator">
      <i class="fas fa-spinner" aria-hidden="true"></i>
      <p>Loading services…</p>
    </div>

    <div id="servicesGrid" class="services-grid" hidden></div>
  </div>

  <div id="logsDrawer" class="logs-drawer" hidden>
    <div id="logsBackdrop" class="logs-backdrop"></div>
    <div class="logs-panel">
      <div class="logs-panel-header">
        <h3 id="logsTitle">Logs</h3>
        <div class="logs-panel-actions">
          <button type="button" id="logsRefreshBtn" class="btn"><i class="fas fa-rotate" aria-hidden="true"></i><span>Refresh</span></button>
          <button type="button" id="logsCloseBtn" class="btn"><i class="fas fa-xmark" aria-hidden="true"></i><span>Close</span></button>
        </div>
      </div>
      <pre id="logsContent" class="logs-content"></pre>
    </div>
  </div>

  <div id="notificationContainer" class="notification-container"></div>

  <script src="/app.js"></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// The HTTP app — guards, routes, static assets. No listener of its own.
//
// Split out of main() so a test can drive it over a real socket inside the test process instead
// of spawning `dist/server.js` as a child. A child process is a black box to the coverage
// reporter: the security suite exercised most of the middleware below and the report still said
// 10%, which is the number a suite that tested nothing would have printed too.
// ---------------------------------------------------------------------------

export function createHttpApp(config: AppConfig, monitor: Monitor): Koa {
  const app = new Koa();
  const router = new Router();

  // Computed once at startup, not per request: config is immutable after loadConfig().
  // attachWebSocket() derives its own copy from the same config rather than being handed this
  // one — the upgrade path must not depend on the HTTP app having been built first.
  const trustedHosts = buildTrustedHosts(config);

  // Guards every HTTP request, including static assets — the page renders topology (unit
  // names, ports, repo paths) that is only harmless because reaching this server at all
  // already implies a degree of trust; once AUTH_TOKEN is set that trust is enforced here.
  app.use(async (ctx, next) => {
    // Host allowlist first, before auth and before any route — a DNS-rebound request must not
    // reach even a read-only endpoint, because /api/services leaks the topology and
    // /api/services/:id/logs leaks journal output. See assertTrustedHost() for the attack.
    const hostDecision = assertTrustedHost(ctx.get('host') || undefined, trustedHosts);
    if (!hostDecision.allowed) {
      ctx.status = 403;
      ctx.body = { ok: false, message: `request refused: ${hostDecision.reason}` };
      return;
    }

    // AUTH_TOKEN check — unchanged from before except that "was it valid" is now kept around
    // (hasValidToken) instead of discarded, because the CSRF guard below needs it as its one
    // escape hatch for tokenless, non-browser clients (curl, scripts).
    let hasValidToken = false;
    if (config.authToken) {
      const provided = extractToken(ctx.get('authorization') || undefined, firstQueryValue(ctx.query.token as string | string[] | undefined));
      hasValidToken = !!provided && timingSafeTokenEquals(provided, config.authToken);
      if (!hasValidToken) {
        ctx.status = 401;
        ctx.body = { ok: false, message: 'unauthorized' };
        return;
      }
    }

    // CSRF guard: only state-changing methods need it (GET/HEAD/OPTIONS never mutate anything
    // here), and it runs whether or not AUTH_TOKEN is configured — the attack this closes
    // (an auto-submitting <form> POST from an unrelated tab) works precisely in the default,
    // token-less config, so gating this on config.authToken would leave the default open.
    if (!SAFE_METHODS.has(ctx.method)) {
      const decision = assertSameOrigin(ctx.get('origin') || undefined, ctx.get('referer') || undefined, trustedHosts, hasValidToken);
      if (!decision.allowed) {
        ctx.status = 403;
        ctx.body = { ok: false, message: `cross-site request blocked: ${decision.reason}` };
        return;
      }
    }

    await next();
  });

  // Stryker disable next-line StringLiteral: koa-router compiles '' and '/' to the same matcher —
  // verified against this version, both serve GET / and 404 every other path — so no request can
  // tell an emptied path apart from this one.
  router.get('/', async (ctx) => {
    // No `ctx.type = 'html'`: Koa's body setter infers html from a string body that starts with
    // '<', which every renderHtml() output does, and the content-type assertion in the page test
    // is what holds that inference to the contract.
    // AUTH_TOKEN travels in this page's own URL (?token=) — a leaked Referer to the cdnjs
    // stylesheet would hand that token to a third party. The <meta> tag in renderHtml() covers
    // navigations initiated from inside the document; this header covers the response itself.
    ctx.set('Referrer-Policy', 'no-referrer');
    // Cheap hardening: this page renders topology + exposes action buttons, so it must not be
    // sniffed as something else or embedded in a frame that could clickjack those buttons.
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('X-Frame-Options', 'DENY');
    ctx.body = renderHtml();
  });

  router.get('/api/services', async (ctx) => {
    ctx.body = {
      groups: config.groups,
      services: config.services,
      states: monitor.getStates(),
      target: config.unitTarget,
      scope: config.systemctlScope,
      pollIntervalMs: config.pollIntervalMs,
      timestamp: Date.now()
    };
  });

  router.post('/api/services/:id/:action', async (ctx) => {
    const { id, action } = ctx.params;
    const service = config.serviceMap.get(id);
    if (!service) {
      ctx.status = 404;
      ctx.body = { ok: false, message: `unknown service id "${id}"` };
      return;
    }
    if (!isAction(action)) {
      ctx.status = 400;
      ctx.body = { ok: false, message: `invalid action "${action}"` };
      return;
    }
    const result = await controlUnit(service.unit, action, config.systemctlScope);
    const states = await monitor.refreshNow();
    const state = states.find((s) => s.id === id) ?? null;
    ctx.body = { ok: result.ok, message: result.message, state };
  });

  router.post('/api/groups/:groupId/:action', async (ctx) => {
    const { groupId, action } = ctx.params;
    const group = config.groupMap.get(groupId);
    if (!group) {
      ctx.status = 404;
      ctx.body = { ok: false, message: `unknown group id "${groupId}"` };
      return;
    }
    if (!isAction(action)) {
      ctx.status = 400;
      ctx.body = { ok: false, message: `invalid action "${action}"` };
      return;
    }
    const results = await Promise.all(
      group.serviceIds.map(async (id) => {
        // Safe: serviceIds was built from the same validated services list at config load time.
        const service = config.serviceMap.get(id) as NonNullable<ReturnType<typeof config.serviceMap.get>>;
        const r = await controlUnit(service.unit, action, config.systemctlScope);
        return { id, ok: r.ok, message: r.message };
      })
    );
    await monitor.refreshNow();
    const ok = results.every((r) => r.ok);
    ctx.body = { ok, message: `${results.filter((r) => r.ok).length}/${results.length} succeeded`, results };
  });

  router.post('/api/all/:action', async (ctx) => {
    const { action } = ctx.params;
    if (!isAction(action)) {
      ctx.status = 400;
      ctx.body = { ok: false, message: `invalid action "${action}"` };
      return;
    }
    const result = await controlUnit(config.unitTarget, action, config.systemctlScope);
    await monitor.refreshNow();
    ctx.body = { ok: result.ok, message: result.message };
  });

  router.get('/api/services/:id/logs', async (ctx) => {
    const { id } = ctx.params;
    const service = config.serviceMap.get(id);
    if (!service) {
      ctx.status = 404;
      ctx.body = { ok: false, message: `unknown service id "${id}"` };
      return;
    }
    const linesRaw = firstQueryValue(ctx.query.lines as string | string[] | undefined);
    // No `linesRaw !== undefined` ternary: Number.parseInt(undefined, 10) is NaN, and the
    // finiteness check on the next line already answers NaN with the configured default — the
    // ternary would be a second, unobservable spelling of that same fallback.
    const parsedLines = Number.parseInt(linesRaw as string, 10);
    const lines = await unitLogs(service.unit, Number.isFinite(parsedLines) ? parsedLines : config.logLines, config.systemctlScope);
    ctx.body = { id, lines };
  });

  app.use(serve(path.join(__dirname, 'public')));
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}

// ---------------------------------------------------------------------------
// WebSocket — noServer + manual 'upgrade' handling so the auth check runs (and can destroy
// the socket) before a single WS frame is exchanged, matching the HTTP middleware above.
// ---------------------------------------------------------------------------

export interface WebSocketParts {
  wss: WebSocketServer;
  /** Live sockets, for broadcast and for terminate-on-shutdown. */
  wsClients: Set<WebSocket>;
  /** The monitor listener this attaches — kept so shutdown can unsubscribe it. */
  broadcastStates: (states: ServiceState[]) => void;
}

export function attachWebSocket(httpServer: http.Server, config: AppConfig, monitor: Monitor): WebSocketParts {
  const trustedHosts = buildTrustedHosts(config);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
  const wsClients = new Set<WebSocket>();

  function broadcastStates(states: ServiceState[]): void {
    const message: ServerMessage = { type: 'states', states, timestamp: Date.now() };
    const json = JSON.stringify(message);
    for (const client of wsClients) {
      if (client.readyState === WebSocket.OPEN) client.send(json);
    }
  }
  monitor.subscribe(broadcastStates);

  async function actionOnService(id: string, action: Action): Promise<{ ok: boolean; message: string }> {
    const service = config.serviceMap.get(id);
    if (!service) return { ok: false, message: `unknown service id "${id}"` };
    const result = await controlUnit(service.unit, action, config.systemctlScope);
    await monitor.refreshNow();
    return result;
  }

  async function actionOnGroup(groupId: string, action: Action): Promise<{ ok: boolean; message: string }> {
    const group = config.groupMap.get(groupId);
    if (!group) return { ok: false, message: `unknown group id "${groupId}"` };
    const results = await Promise.all(
      group.serviceIds.map(async (id) => {
        const service = config.serviceMap.get(id) as NonNullable<ReturnType<typeof config.serviceMap.get>>;
        return controlUnit(service.unit, action, config.systemctlScope);
      })
    );
    await monitor.refreshNow();
    const ok = results.every((r) => r.ok);
    return { ok, message: `${results.filter((r) => r.ok).length}/${results.length} succeeded` };
  }

  async function actionOnAll(action: Action): Promise<{ ok: boolean; message: string }> {
    const result = await controlUnit(config.unitTarget, action, config.systemctlScope);
    await monitor.refreshNow();
    return result;
  }

  async function dispatchAction(scope: 'service' | 'group' | 'all', targetId: string, action: Action): Promise<{ ok: boolean; message: string }> {
    if (scope === 'service') return actionOnService(targetId, action);
    if (scope === 'group') return actionOnGroup(targetId, action);
    return actionOnAll(action); // scope === 'all' — targetId carried by the message but unused, the unit target always comes from config
  }

  async function handleClientMessage(ws: WebSocket, parsed: Record<string, unknown>): Promise<void> {
    const type = parsed.type;

    if (type === 'action') {
      const scope = parsed.scope;
      const targetId = parsed.targetId;
      const action = parsed.action;
      if ((scope !== 'service' && scope !== 'group' && scope !== 'all') || typeof targetId !== 'string' || !isAction(action)) {
        return; // malformed frame — WS has no HTTP-style status code to report a 400 against, drop silently
      }
      const result = await dispatchAction(scope, targetId, action);
      const message: ServerMessage = {
        type: 'action-result',
        ok: result.ok,
        scope,
        targetId,
        action,
        message: result.message,
        timestamp: Date.now()
      };
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
      return;
    }

    if (type === 'logs') {
      // No `typeof id !== 'string'` guard: serviceMap is keyed by string, so a non-string id misses
      // it and the frame is dropped by the check below — the type test could never change an
      // answer. The cast is what a hit proves: id was a real key.
      const id = parsed.id as string;
      const service = config.serviceMap.get(id);
      if (!service) return;
      const requestedLines = typeof parsed.lines === 'number' ? parsed.lines : config.logLines;
      const lines = await unitLogs(service.unit, requestedLines, config.systemctlScope);
      const message: ServerMessage = { type: 'logs', id, lines, timestamp: Date.now() };
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
      return;
    }

    // 'ping' (and anything unrecognized) is a no-op: ClientMessage has no corresponding
    // server-side 'pong' variant in the contract, so it exists purely to keep the client's own
    // idle-connection logic happy without needing a reply.
  }

  httpServer.on('upgrade', (req, socket, head) => {
    let requestUrl: URL;
    try {
      // String(), not `req.url ?? '/'`: Node always sets `url` on a request it parsed, and the
      // type is optional only because IncomingMessage is shared with the client side where it is
      // not. A fallback would be a branch no request can reach.
      requestUrl = new URL(String(req.url), 'http://internal.invalid');
    } catch {
      socket.destroy();
      return;
    }
    if (requestUrl.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    // Same Host allowlist as the HTTP middleware — the upgrade path bypasses that middleware
    // entirely, so it has to repeat the check rather than inherit it.
    const wsHostDecision = assertTrustedHost(req.headers.host, trustedHosts);
    if (!wsHostDecision.allowed) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    let hasValidToken = false;
    if (config.authToken) {
      const provided = extractToken(req.headers.authorization, requestUrl.searchParams.get('token') ?? undefined);
      hasValidToken = !!provided && timingSafeTokenEquals(provided, config.authToken);
      if (!hasValidToken) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    // The same CSRF guard the POST routes get, and it is NOT redundant here — it closes a hole
    // that the HTTP-side guard cannot see. A WebSocket handshake is exempt from the same-origin
    // policy and triggers no CORS preflight: any page in the developer's browser can open
    // `new WebSocket('ws://127.0.0.1:2901/ws')` cross-origin and the browser will complete it.
    // That socket then reaches handleClientMessage(), which dispatches the very same
    // start/stop/restart actions as POST /api/... — so guarding only the POST routes left the
    // whole control plane reachable by any tab, in the default token-less config. Verified with a
    // PoC before this block existed: handshake accepted from Origin https://evil.example, full
    // topology snapshot delivered, and an action executed successfully.
    //
    // Browsers always attach Origin to a WS handshake (unlike Referer, which they never send on
    // one) and a page cannot forge it, so the check is the same policy as assertSameOrigin's:
    // Origin present -> must name this host; Origin absent -> non-browser client, allowed only
    // with a valid AUTH_TOKEN. Passing `undefined` for the Referer argument is deliberate, not an
    // oversight — treating a missing Referer as evidence of anything here would be wrong.
    const originDecision = assertSameOrigin(req.headers.origin, undefined, trustedHosts, hasValidToken);
    if (!originDecision.allowed) {
      // 403, not 401: the caller may well have authenticated correctly — it is the *origin* that
      // is refused, and no amount of re-authenticating fixes that.
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    wsClients.add(ws);

    const snapshot: ServerMessage = {
      type: 'snapshot',
      groups: config.groups,
      services: config.services,
      states: monitor.getStates(),
      target: config.unitTarget,
      scope: config.systemctlScope,
      pollIntervalMs: config.pollIntervalMs,
      timestamp: Date.now()
    };
    ws.send(JSON.stringify(snapshot));

    ws.on('message', (raw) => {
      let parsed: unknown;
      // `parsed` is declared without an initializer, so emptying the catch below leaves it
      // undefined and the isPlainObject guard drops the frame on exactly the same path — the
      // `return` is provably unobservable, and no reachable frame tells the two apart. It stays
      // because a catch that falls through reads as an oversight.
      // Stryker disable BlockStatement: provably unobservable, see argument above.
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return; // malformed JSON — drop the frame, never crash the connection over it
      }
      // Stryker restore BlockStatement
      if (!isPlainObject(parsed)) return;
      handleClientMessage(ws, parsed as Partial<ClientMessage> & Record<string, unknown>).catch((err) => {
        console.error('[ws] message handling failed', err);
      });
    });

    ws.on('close', () => wsClients.delete(ws));
    ws.on('error', () => wsClients.delete(ws));
  });

  return { wss, wsClients, broadcastStates };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export interface ServerParts extends WebSocketParts {
  app: Koa;
  httpServer: http.Server;
}

/** The whole server, wired but not listening. `main()` and the tests share this one path. */
export function createServer(config: AppConfig, monitor: Monitor): ServerParts {
  const app = createHttpApp(config, monitor);
  const httpServer = http.createServer(app.callback());
  return { app, httpServer, ...attachWebSocket(httpServer, config, monitor) };
}

/**
 * Graceful shutdown, as a factory rather than a closure inside main() so its two branches are
 * reachable from a test — the second signal arriving during a shutdown already in progress must
 * be a no-op, and a suite that can only ever send the first signal cannot show that.
 */
export function createShutdown(monitor: Monitor, parts: ServerParts): (signal: string) => void {
  let shuttingDown = false;

  return function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[server] ${signal} received, shutting down`);

    monitor.unsubscribe(parts.broadcastStates);
    monitor.stop();
    for (const client of parts.wsClients) client.terminate();

    parts.httpServer.close(() => {
      console.log('[server] closed');
      process.exit(0);
    });
    // Belt-and-suspenders: don't let a stuck connection hold the process open forever.
    setTimeout(() => process.exit(0), 5000).unref();
  };
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

export interface RunningServer {
  config: AppConfig;
  monitor: Monitor;
  parts: ServerParts;
  shutdown: (signal: string) => void;
}

/**
 * Boot: config, monitor, server, listener, signal handlers. Returns the pieces rather than
 * `void` so a test can shut down what it started — the process-level handlers below are the
 * only other way to reach `shutdown`, and calling those would end the test runner.
 */
export async function main(): Promise<RunningServer> {
  const config = loadConfig(); // throws with a precise message on bad services.json / bad env
  const monitor = createMonitor(config);
  await monitor.refreshNow(); // populate state once before accepting connections

  const parts = createServer(config, monitor);

  await new Promise<void>((resolve) => parts.httpServer.listen(config.port, config.host, resolve));
  printBanner(config);

  const shutdown = createShutdown(monitor, parts);
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return { config, monitor, parts, shutdown };
}

export function printBanner(config: AppConfig): void {
  console.log('marketplace-services-status monitor listening');
  console.log(`  bind:       http://${config.host}:${config.port}`);
  console.log(`  scope:      systemctl --${config.systemctlScope}`);
  console.log(`  target:     ${config.unitTarget}`);
  console.log(`  units:      ${config.services.length} monitored across ${config.groups.length} groups`);
  console.log(`  poll every: ${config.pollIntervalMs}ms`);
  console.log(`  auth:       ${config.authToken ? 'AUTH_TOKEN required' : 'disabled (no AUTH_TOKEN set)'}`);
}

/* v8 ignore start -- entrypoint wiring: runs only as the real process, never under vitest.
   Only boot when run as the entry point. Importing this module — which the test suite does, to
   reach the exported guards and to drive the server in-process — must not start a listener or,
   when startup fails, take the importing process down with process.exit(1). The NODE_ENV clause
   matches the nine backend services: `require.main` alone is not enough, because a test runner
   that happens to load this file as its own entry would satisfy it. */
// Stryker disable all: same guard as the v8 ignore above, same reason. vitest sets NODE_ENV=test
// and reaches this file by import rather than as the entry point, so both halves of the condition
// are false in every run this suite can produce — no mutant inside the block has a reachable input
// that would tell it apart. Restored below the closing brace so the rest of the file stays mutated.
if (require.main === module && process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('[server] fatal startup error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
// Stryker restore all
/* v8 ignore stop */
