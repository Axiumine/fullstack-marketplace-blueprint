/**
 * services-status frontend — plain ES2020, no bundler, no framework.
 *
 * Talks to the server exclusively over the WS contract in CONTRACT.md
 * (ServerMessage / ClientMessage / ServiceState). The DOM is built once
 * from a 'snapshot' message and every subsequent 'states' tick only
 * patches text/classes on existing nodes — never innerHTML='' + rebuild,
 * which would kill scroll position, focus and any open logs drawer.
 */
(function () {
  'use strict';

  var RECONNECT_MIN_MS = 1000;
  var RECONNECT_MAX_MS = 30000;
  var PENDING_TIMEOUT_MS = 20000;
  var PING_INTERVAL_MS = 25000;

  var state = {
    ws: null,
    reconnectAttempts: 0,
    reconnectTimer: null,
    pingTimer: null,

    target: '', // unitTarget from the snapshot, e.g. 'marketplace.target' — used as the 'all' scope target
    servicesById: new Map(), // id -> ServiceDescriptor
    groupsById: new Map(), // id -> GroupDescriptor

    serviceEls: new Map(), // id -> { card, healthDot, healthWord, portProbe, uptime, memory, restarts, pid, errorEl, buttons }
    groupEls: new Map(), // id -> { section, counter, total, buttons }

    pendingServices: new Map(), // id -> timeoutId
    pendingGroups: new Map(), // id -> timeoutId
    pendingAll: null, // timeoutId | null

    logsTarget: null, // service id currently open in the logs drawer, or null
    logsRequestTimer: null // timeoutId for the in-flight 'logs' request, or null
  };

  // ---------------------------------------------------------------------
  // WebSocket lifecycle
  // ---------------------------------------------------------------------

  function getTokenFromQuery() {
    // AUTH_TOKEN (when the server enables it) must ride the WS handshake as ?token=,
    // since the browser WebSocket API cannot set an Authorization header. We only
    // propagate a token already present in the page URL — no login UI is built here.
    var params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  }

  function connect() {
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    var url = protocol + '//' + window.location.host + '/ws';
    var token = getTokenFromQuery();
    if (token) {
      url += '?token=' + encodeURIComponent(token);
    }

    var ws = new WebSocket(url);
    state.ws = ws;

    ws.onopen = function () {
      // Reset backoff and drop any pending reconnect timer so a flaky connection
      // that opens and immediately closes again cannot stack multiple timers.
      state.reconnectAttempts = 0;
      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
      }
      setConnectionStatus('connected');
      startPing();
      if (state.logsTarget) {
        // A drop mid-request (after 'logs' was sent, before the reply arrived) left
        // the drawer stuck on "Loading…" or on its error state — reconnect is the
        // natural point to self-heal it rather than wait for the user to hit Retry.
        requestLogs(state.logsTarget);
      }
    };

    ws.onmessage = function (event) {
      handleMessage(event.data);
    };

    ws.onclose = function () {
      setConnectionStatus('disconnected');
      stopPing();
      scheduleReconnect();
    };

    ws.onerror = function () {
      // A WebSocket 'error' is always followed by 'close', which schedules the
      // reconnect — nothing to do here beyond reflecting the visible state.
      setConnectionStatus('disconnected');
    };
  }

  function scheduleReconnect() {
    if (state.reconnectTimer) {
      return; // a reconnect is already queued — never let two timers stack
    }
    var attempt = state.reconnectAttempts;
    state.reconnectAttempts = attempt + 1;
    var base = Math.min(RECONNECT_MIN_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
    // Full jitter within [base/2, base] avoids a reconnect thundering herd
    // if several clients dropped at the same moment.
    var delay = base * (0.5 + Math.random() * 0.5);

    setConnectionStatus('reconnecting');
    state.reconnectTimer = setTimeout(function () {
      state.reconnectTimer = null;
      connect();
    }, delay);
  }

  function startPing() {
    stopPing();
    state.pingTimer = setInterval(function () {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL_MS);
  }

  function stopPing() {
    if (state.pingTimer) {
      clearInterval(state.pingTimer);
      state.pingTimer = null;
    }
  }

  // ---------------------------------------------------------------------
  // Message routing
  // ---------------------------------------------------------------------

  function handleMessage(raw) {
    var msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      return; // malformed frame — ignore rather than throw and drop the socket
    }

    switch (msg.type) {
      case 'snapshot':
        applySnapshot(msg);
        break;
      case 'states':
        applyStates(msg.states, msg.timestamp);
        break;
      case 'action-result':
        applyActionResult(msg);
        break;
      case 'logs':
        applyLogs(msg);
        break;
      default:
        break;
    }
  }

  function applySnapshot(msg) {
    state.target = msg.target;

    state.groupsById = new Map();
    msg.groups.forEach(function (g) {
      state.groupsById.set(g.id, g);
    });

    state.servicesById = new Map();
    msg.services.forEach(function (s) {
      state.servicesById.set(s.id, s);
    });

    buildGrid(msg.groups);
    applyStates(msg.states, msg.timestamp);
    setPollInterval(msg.pollIntervalMs);
  }

  function applyStates(states, timestamp) {
    var upCounts = new Map(); // groupId -> count of health === 'up'
    state.groupEls.forEach(function (_g, groupId) {
      upCounts.set(groupId, 0);
    });

    states.forEach(function (s) {
      var refs = state.serviceEls.get(s.id);
      if (!refs) {
        return; // unknown id — server/client config drift; skip rather than throw
      }
      applyServiceState(refs, s);

      if (s.health === 'up') {
        var desc = state.servicesById.get(s.id);
        if (desc) {
          upCounts.set(desc.groupId, (upCounts.get(desc.groupId) || 0) + 1);
        }
      }
    });

    state.groupEls.forEach(function (g, groupId) {
      g.counter.textContent = (upCounts.get(groupId) || 0) + '/' + g.total + ' up';
    });

    // Every 'states' broadcast is the authoritative current status for the whole
    // fleet, so it is the single point that clears every optimistic pending flag —
    // simpler and more correct than trying to correlate a poll tick to one action.
    clearAllPending();

    setLastUpdate(timestamp);
  }

  function applyServiceState(refs, s) {
    refs.healthDot.className = 'health-dot health-' + s.health;
    refs.healthWord.textContent = s.health.toUpperCase();

    refs.card.classList.remove('health-up', 'health-starting', 'health-down', 'health-failed', 'health-missing');
    refs.card.classList.add('health-' + s.health);

    refs.uptime.textContent = s.uptime || '—';
    refs.memory.textContent = s.memory || '—';
    refs.restarts.textContent = String(s.nRestarts);
    refs.pid.textContent = s.mainPid !== null ? String(s.mainPid) : '—';

    if (s.portOpen === null) {
      refs.portProbe.textContent = '';
      refs.portProbe.className = 'port-probe';
    } else if (s.portOpen) {
      refs.portProbe.textContent = 'open';
      refs.portProbe.className = 'port-probe port-open';
    } else {
      refs.portProbe.textContent = 'closed';
      refs.portProbe.className = 'port-probe port-closed';
    }

    if (s.error) {
      refs.errorEl.textContent = s.error;
      refs.errorEl.hidden = false;
    } else {
      refs.errorEl.textContent = '';
      refs.errorEl.hidden = true;
    }
  }

  function applyActionResult(msg) {
    clearPending(msg.scope, msg.targetId);
    notify(msg.ok ? 'success' : 'error', msg.message);
  }

  function applyLogs(msg) {
    if (state.logsTarget !== msg.id) {
      return; // the drawer moved on to a different service (or closed) since the request
    }
    clearLogsRequestTimer(); // the reply arrived — the in-flight timeout no longer applies
    var content = document.getElementById('logsContent');
    if (!content) {
      return;
    }
    content.classList.remove('logs-error'); // a retry can succeed — drop any prior error styling
    // A single textContent assignment — safe by construction, no HTML parsing of
    // journalctl output ever happens even though that output is attacker-influenced.
    content.textContent = msg.lines.length > 0 ? msg.lines.join('\n') : '(no log output)';
    content.scrollTop = content.scrollHeight;
  }

  // ---------------------------------------------------------------------
  // DOM construction (built once per snapshot)
  // ---------------------------------------------------------------------

  function buildGrid(groups) {
    var container = document.getElementById('servicesGrid');
    if (!container) {
      return;
    }
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    state.serviceEls.clear();
    state.groupEls.clear();

    groups.forEach(function (group) {
      var services = group.serviceIds
        .map(function (id) {
          return state.servicesById.get(id);
        })
        .filter(function (d) {
          return d !== undefined;
        });
      container.appendChild(buildGroupSection(group, services));
    });

    var loading = document.getElementById('loadingIndicator');
    if (loading) {
      loading.hidden = true;
    }
    container.hidden = false;
  }

  function buildGroupSection(group, services) {
    var section = document.createElement('section');
    section.className = 'group-section';
    section.dataset.groupId = group.id;

    var header = document.createElement('div');
    header.className = 'group-header';

    var titleRow = document.createElement('div');
    titleRow.className = 'group-title-row';

    var h2 = document.createElement('h2');
    h2.textContent = group.title;

    var counter = document.createElement('span');
    counter.className = 'group-counter';
    counter.textContent = '0/' + services.length + ' up';

    titleRow.appendChild(h2);
    titleRow.appendChild(counter);

    var descP = document.createElement('p');
    descP.className = 'group-description';
    descP.textContent = group.description;

    var actions = document.createElement('div');
    actions.className = 'group-actions';
    var startBtn = buildActionButton('start', 'group', group.id, 'Start group', 'fa-play');
    var stopBtn = buildActionButton('stop', 'group', group.id, 'Stop group', 'fa-stop');
    var restartBtn = buildActionButton('restart', 'group', group.id, 'Restart group', 'fa-sync-alt');
    actions.appendChild(startBtn);
    actions.appendChild(stopBtn);
    actions.appendChild(restartBtn);

    header.appendChild(titleRow);
    header.appendChild(descP);
    header.appendChild(actions);

    var grid = document.createElement('div');
    grid.className = 'service-grid';

    services.forEach(function (desc) {
      var refs = buildServiceCard(desc);
      grid.appendChild(refs.card);
      state.serviceEls.set(desc.id, refs);
    });

    section.appendChild(header);
    section.appendChild(grid);

    state.groupEls.set(group.id, {
      section: section,
      counter: counter,
      total: services.length,
      buttons: { start: startBtn, stop: stopBtn, restart: restartBtn }
    });

    return section;
  }

  function buildServiceCard(desc) {
    var card = document.createElement('div');
    card.className = 'service-card kind-' + desc.kind + ' health-missing';
    card.dataset.serviceId = desc.id;

    var header = document.createElement('div');
    header.className = 'card-header';

    var titleWrap = document.createElement('div');
    titleWrap.className = 'card-title';
    var labelEl = document.createElement('span');
    labelEl.className = 'service-label';
    labelEl.textContent = desc.label;
    var unitEl = document.createElement('span');
    unitEl.className = 'service-unit mono';
    unitEl.textContent = desc.unit;
    titleWrap.appendChild(labelEl);
    titleWrap.appendChild(unitEl);

    var healthWrap = document.createElement('div');
    healthWrap.className = 'health';
    var dot = document.createElement('span');
    dot.className = 'health-dot health-missing';
    dot.setAttribute('aria-hidden', 'true');
    var word = document.createElement('span');
    word.className = 'health-word';
    word.textContent = 'MISSING';
    healthWrap.appendChild(dot);
    healthWrap.appendChild(word);

    header.appendChild(titleWrap);
    header.appendChild(healthWrap);

    var descP = document.createElement('p');
    descP.className = 'service-description';
    descP.textContent = desc.description;

    var meta = document.createElement('dl');
    meta.className = 'service-meta';

    function metaRow(label) {
      var row = document.createElement('div');
      row.className = 'meta-row';
      var dt = document.createElement('dt');
      dt.textContent = label;
      var dd = document.createElement('dd');
      row.appendChild(dt);
      row.appendChild(dd);
      meta.appendChild(row);
      return dd;
    }

    var portDd = metaRow('Port');
    var portNumEl = document.createElement('span');
    portNumEl.className = 'mono';
    portNumEl.textContent = desc.port !== null ? String(desc.port) : 'n/a';
    var probeEl = document.createElement('span');
    probeEl.className = 'port-probe';
    portDd.appendChild(portNumEl);
    portDd.appendChild(probeEl);

    var urlDd = metaRow('URL');
    var urlLink = document.createElement('a');
    urlLink.className = 'service-url mono';
    urlLink.target = '_blank';
    urlLink.rel = 'noopener noreferrer';
    if (desc.url) {
      urlLink.href = desc.url;
      urlLink.textContent = desc.url;
    } else {
      urlLink.textContent = '—';
    }
    urlDd.appendChild(urlLink);

    var uptimeDd = metaRow('Uptime');
    var memoryDd = metaRow('Memory');
    var restartsDd = metaRow('Restarts');
    var pidDd = metaRow('PID');

    var errorP = document.createElement('p');
    errorP.className = 'service-error';
    errorP.hidden = true;

    var actions = document.createElement('div');
    actions.className = 'card-actions';
    var startBtn = buildActionButton('start', 'service', desc.id, 'Start', 'fa-play');
    var stopBtn = buildActionButton('stop', 'service', desc.id, 'Stop', 'fa-stop');
    var restartBtn = buildActionButton('restart', 'service', desc.id, 'Restart', 'fa-sync-alt');
    var logsBtn = buildActionButton('logs', 'service', desc.id, 'Logs', 'fa-file-lines');
    logsBtn.dataset.label = desc.label;
    actions.appendChild(startBtn);
    actions.appendChild(stopBtn);
    actions.appendChild(restartBtn);
    actions.appendChild(logsBtn);

    card.appendChild(header);
    card.appendChild(descP);
    card.appendChild(meta);
    card.appendChild(errorP);
    card.appendChild(actions);

    return {
      card: card,
      healthDot: dot,
      healthWord: word,
      portProbe: probeEl,
      uptime: uptimeDd,
      memory: memoryDd,
      restarts: restartsDd,
      pid: pidDd,
      errorEl: errorP,
      buttons: { start: startBtn, stop: stopBtn, restart: restartBtn }
    };
  }

  function buildActionButton(action, scope, targetId, label, iconClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-' + action;
    btn.dataset.action = action;
    btn.dataset.scope = scope;
    btn.dataset.target = targetId;

    var icon = document.createElement('i');
    icon.className = 'fas ' + iconClass;
    icon.setAttribute('aria-hidden', 'true');

    var text = document.createElement('span');
    text.textContent = label;

    btn.appendChild(icon);
    btn.appendChild(text);
    return btn;
  }

  // ---------------------------------------------------------------------
  // Actions + optimistic pending state
  // ---------------------------------------------------------------------

  function sendAction(scope, targetId, action) {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      notify('error', 'Not connected — action not sent.');
      return;
    }
    setPending(scope, targetId);
    state.ws.send(JSON.stringify({ type: 'action', scope: scope, targetId: targetId, action: action }));
  }

  function setPending(scope, targetId) {
    var timeoutId = setTimeout(function () {
      pendingTimedOut(scope, targetId);
    }, PENDING_TIMEOUT_MS);

    if (scope === 'service') {
      clearExistingTimeout(state.pendingServices, targetId);
      state.pendingServices.set(targetId, timeoutId);
      markCardPending(targetId, true);
    } else if (scope === 'group') {
      clearExistingTimeout(state.pendingGroups, targetId);
      state.pendingGroups.set(targetId, timeoutId);
      markGroupPending(targetId, true);
    } else {
      if (state.pendingAll !== null) {
        clearTimeout(state.pendingAll);
      }
      state.pendingAll = timeoutId;
      markAllPending(true);
    }
  }

  function clearExistingTimeout(map, key) {
    var existing = map.get(key);
    if (existing !== undefined) {
      clearTimeout(existing);
    }
  }

  function clearPending(scope, targetId) {
    if (scope === 'service') {
      var t = state.pendingServices.get(targetId);
      if (t !== undefined) {
        clearTimeout(t);
        state.pendingServices.delete(targetId);
        markCardPending(targetId, false);
      }
    } else if (scope === 'group') {
      var t2 = state.pendingGroups.get(targetId);
      if (t2 !== undefined) {
        clearTimeout(t2);
        state.pendingGroups.delete(targetId);
        markGroupPending(targetId, false);
      }
    } else if (state.pendingAll !== null) {
      clearTimeout(state.pendingAll);
      state.pendingAll = null;
      markAllPending(false);
    }
  }

  function clearAllPending() {
    state.pendingServices.forEach(function (timeoutId, id) {
      clearTimeout(timeoutId);
      markCardPending(id, false);
    });
    state.pendingServices.clear();

    state.pendingGroups.forEach(function (timeoutId, id) {
      clearTimeout(timeoutId);
      markGroupPending(id, false);
    });
    state.pendingGroups.clear();

    if (state.pendingAll !== null) {
      clearTimeout(state.pendingAll);
      state.pendingAll = null;
      markAllPending(false);
    }
  }

  function pendingTimedOut(scope, targetId) {
    clearPending(scope, targetId);
    notify('error', 'No response for ' + describeTarget(scope, targetId) + ' after 20s.');
  }

  function describeTarget(scope, targetId) {
    if (scope === 'service') {
      var d = state.servicesById.get(targetId);
      return d ? d.label : targetId;
    }
    if (scope === 'group') {
      var g = state.groupsById.get(targetId);
      return g ? g.title : targetId;
    }
    return 'all services';
  }

  function setButtonsDisabled(buttons, disabled) {
    Object.keys(buttons).forEach(function (key) {
      var btn = buttons[key];
      if (btn) {
        btn.disabled = disabled;
      }
    });
  }

  function markCardPending(id, pending) {
    var refs = state.serviceEls.get(id);
    if (!refs) {
      return;
    }
    refs.card.classList.toggle('is-pending', pending);
    setButtonsDisabled(refs.buttons, pending);
  }

  function markGroupPending(id, pending) {
    var g = state.groupEls.get(id);
    if (!g) {
      return;
    }
    g.section.classList.toggle('is-pending', pending);
    setButtonsDisabled(g.buttons, pending);
  }

  function markAllPending(pending) {
    ['startAllBtn', 'stopAllBtn', 'restartAllBtn'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) {
        btn.disabled = pending;
      }
    });
    var toolbar = document.getElementById('toolbar');
    if (toolbar) {
      toolbar.classList.toggle('is-pending', pending);
    }
  }

  // ---------------------------------------------------------------------
  // Toolbar / status chrome
  // ---------------------------------------------------------------------

  function initToolbar() {
    [
      ['startAllBtn', 'start'],
      ['stopAllBtn', 'stop'],
      ['restartAllBtn', 'restart']
    ].forEach(function (pair) {
      var btn = document.getElementById(pair[0]);
      var action = pair[1];
      if (!btn) {
        return;
      }
      btn.addEventListener('click', function () {
        if (!state.target) {
          notify('error', 'Not connected yet.');
          return;
        }
        sendAction('all', state.target, action);
      });
    });
  }

  function setConnectionStatus(status) {
    var wrap = document.getElementById('connectionStatus');
    var dot = document.getElementById('connectionDot');
    var word = document.getElementById('connectionWord');
    if (!wrap || !dot || !word) {
      return;
    }
    wrap.className = 'connection-status connection-' + status;
    dot.className = 'connection-dot connection-dot-' + status;
    var labels = { connected: 'Connected', disconnected: 'Disconnected', reconnecting: 'Reconnecting…' };
    word.textContent = labels[status] || status;
  }

  function setLastUpdate(timestamp) {
    var el = document.getElementById('lastUpdate');
    if (!el) {
      return;
    }
    el.textContent = 'Last update: ' + new Date(timestamp).toLocaleTimeString();
  }

  function setPollInterval(ms) {
    var el = document.getElementById('pollInterval');
    if (!el) {
      return;
    }
    el.textContent = 'Polling every ' + Math.round(ms / 1000) + 's';
  }

  // ---------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------

  function iconForKind(kind) {
    switch (kind) {
      case 'success':
        return 'fa-circle-check';
      case 'error':
        return 'fa-circle-exclamation';
      default:
        return 'fa-circle-info';
    }
  }

  function notify(kind, message) {
    var container = document.getElementById('notificationContainer');
    if (!container) {
      return;
    }

    var el = document.createElement('div');
    el.className = 'notification notification-' + kind;

    var iconWrap = document.createElement('div');
    iconWrap.className = 'notification-icon';
    var icon = document.createElement('i');
    icon.className = 'fas ' + iconForKind(kind);
    icon.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(icon);

    var content = document.createElement('div');
    content.className = 'notification-content';
    var msgEl = document.createElement('div');
    msgEl.className = 'notification-message';
    msgEl.textContent = message;
    content.appendChild(msgEl);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'notification-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = '×';
    close.addEventListener('click', function () {
      removeNotification(el);
    });

    el.appendChild(iconWrap);
    el.appendChild(content);
    el.appendChild(close);
    container.appendChild(el);

    // Two rAFs would be excessive; one is enough to let the initial (unshown)
    // state paint before the transition-triggering class is added.
    requestAnimationFrame(function () {
      el.classList.add('show');
    });

    setTimeout(function () {
      removeNotification(el);
    }, 5000);
  }

  function removeNotification(el) {
    if (!el.parentNode) {
      return; // already dismissed (manual close raced the auto-dismiss timer)
    }
    el.parentNode.removeChild(el);
  }

  // ---------------------------------------------------------------------
  // Logs drawer
  // ---------------------------------------------------------------------

  function openLogs(serviceId, label) {
    state.logsTarget = serviceId;
    var drawer = document.getElementById('logsDrawer');
    var title = document.getElementById('logsTitle');
    var content = document.getElementById('logsContent');
    if (title) {
      title.textContent = 'Logs — ' + label;
    }
    if (content) {
      content.textContent = 'Loading…';
    }
    if (drawer) {
      drawer.hidden = false;
    }
    document.body.classList.add('logs-open');
    requestLogs(serviceId);
  }

  function closeLogs() {
    state.logsTarget = null;
    clearLogsRequestTimer(); // no drawer left to time out — drop the in-flight watchdog too
    var drawer = document.getElementById('logsDrawer');
    if (drawer) {
      drawer.hidden = true;
    }
    document.body.classList.remove('logs-open');
  }

  function clearLogsRequestTimer() {
    if (state.logsRequestTimer !== null) {
      clearTimeout(state.logsRequestTimer);
      state.logsRequestTimer = null;
    }
  }

  // Puts the drawer body into a visible error state with a Retry button, instead
  // of leaving it on "Loading…" with only a toast (which auto-dismisses after 5s
  // and explains nothing once it's gone). Guarded by logsTarget the same way
  // applyLogs is, so a stale failure for a service the drawer already left cannot
  // stomp on whatever it is showing now.
  function showLogsError(serviceId, message) {
    if (state.logsTarget !== serviceId) {
      return;
    }
    var content = document.getElementById('logsContent');
    if (!content) {
      return;
    }
    while (content.firstChild) {
      content.removeChild(content.firstChild);
    }
    content.classList.add('logs-error');

    var msgP = document.createElement('p');
    msgP.className = 'logs-error-message';
    msgP.textContent = message;

    var retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn logs-error-retry';
    var icon = document.createElement('i');
    icon.className = 'fas fa-rotate-right';
    icon.setAttribute('aria-hidden', 'true');
    var text = document.createElement('span');
    text.textContent = 'Retry';
    retryBtn.appendChild(icon);
    retryBtn.appendChild(text);
    retryBtn.addEventListener('click', function () {
      requestLogs(serviceId);
    });

    content.appendChild(msgP);
    content.appendChild(retryBtn);
  }

  function requestLogs(serviceId) {
    clearLogsRequestTimer(); // a retry/refresh replaces whatever request was already in flight
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      notify('error', 'Not connected — cannot fetch logs.');
      showLogsError(serviceId, 'Not connected — logs could not be fetched.');
      return;
    }
    state.ws.send(JSON.stringify({ type: 'logs', id: serviceId, lines: 200 }));
    // Same dead end setPending() exists to prevent for actions: if the socket drops
    // after this send but before a 'logs' reply arrives, nothing else re-requests it
    // and the drawer would otherwise hang forever. Reuses PENDING_TIMEOUT_MS rather
    // than a second magic number for the same wait.
    state.logsRequestTimer = setTimeout(function () {
      state.logsRequestTimer = null;
      showLogsError(serviceId, 'No response after ' + (PENDING_TIMEOUT_MS / 1000) + 's.');
    }, PENDING_TIMEOUT_MS);
  }

  function initLogsDrawer() {
    var closeBtn = document.getElementById('logsCloseBtn');
    var refreshBtn = document.getElementById('logsRefreshBtn');
    var backdrop = document.getElementById('logsBackdrop');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeLogs);
    }
    if (backdrop) {
      backdrop.addEventListener('click', closeLogs);
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        if (state.logsTarget) {
          requestLogs(state.logsTarget);
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }
      var drawer = document.getElementById('logsDrawer');
      if (drawer && !drawer.hidden) {
        closeLogs();
      }
    });
  }

  // ---------------------------------------------------------------------
  // Delegated click handling for dynamically-built card/group buttons.
  // Toolbar all-* buttons are wired separately in initToolbar() since they
  // are static markup with no data-target until a snapshot has arrived.
  // ---------------------------------------------------------------------

  document.addEventListener('click', function (event) {
    var btn = event.target.closest('button[data-action]');
    if (!btn) {
      return;
    }
    var action = btn.dataset.action;
    var scope = btn.dataset.scope;
    var targetId = btn.dataset.target;
    if (!scope || !targetId) {
      return;
    }

    if (action === 'logs') {
      openLogs(targetId, btn.dataset.label || targetId);
      return;
    }
    if (action === 'start' || action === 'stop' || action === 'restart') {
      sendAction(scope, targetId, action);
    }
  });

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------

  function init() {
    initToolbar();
    initLogsDrawer();
    setConnectionStatus('disconnected');
    connect();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
