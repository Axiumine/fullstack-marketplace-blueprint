import { beforeEach, describe, expect, it, vi } from 'vitest';

import { controlUnit, daemonReload, isEnabled, showUnits, unitLogs } from '../src/systemd';

// ---------------------------------------------------------------------------
// child_process is mocked, and this is the one module where that is not a shortcut: every export
// here shells out to systemctl/journalctl, and a suite that ran them for real would assert on
// whatever units happen to exist on the machine running it — green on the developer's box, red in
// any container, and capable of stopping a real service if a test ever passed the wrong argv.
//
// The mock is callback-shaped because src/systemd.ts wraps it in promisify() at module load:
// calling back with (null, {stdout, stderr}) is what makes `await execFileAsync(...)` resolve to
// an object with a .stdout, exactly as the real execFile's own promisified form does.
// ---------------------------------------------------------------------------

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));

vi.mock('child_process', () => ({ execFile: execFileMock }));

type ExecCallback = (err: unknown, result?: { stdout: string; stderr: string }) => void;

/** Every invocation succeeds with this stdout. */
const succeedsWith = (stdout: string, stderr = ''): void => {
  execFileMock.mockImplementation((_file: string, _args: string[], _opts: unknown, cb: ExecCallback) => {
    cb(null, { stdout, stderr });
  });
};

/** Every invocation rejects with this value — an Error, or anything else promisify may hand back. */
const failsWith = (err: unknown): void => {
  execFileMock.mockImplementation((_file: string, _args: string[], _opts: unknown, cb: ExecCallback) => {
    cb(err);
  });
};

const enoent = (): NodeJS.ErrnoException => Object.assign(new Error('spawn systemctl ENOENT'), { code: 'ENOENT' });

/** One `systemctl show` block, in the order systemd prints it. */
const showBlock = (props: Record<string, string>): string =>
  Object.entries(props)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

const LOADED_ACTIVE = {
  Id: 'marketplace-dev-public-resource.service',
  LoadState: 'loaded',
  ActiveState: 'active',
  SubState: 'running',
  UnitFileState: 'enabled',
  MemoryCurrent: '52428800',
  CPUUsageNSec: '1234567890',
  MainPID: '4242',
  NRestarts: '3',
  ActiveEnterTimestamp: 'Thu 2026-08-06 08:09:21 CEST',
  ExecMainStartTimestamp: 'Thu 2026-08-06 08:09:20 CEST'
};

const args = (call = 0): string[] => execFileMock.mock.calls[call][1] as string[];
const binary = (call = 0): string => execFileMock.mock.calls[call][0] as string;
// The options object is the third argument, and asserting it is not pedantry: without a timeout
// every one of these calls inherits execFile's default of "wait forever", which is how one hung
// systemctl becomes a poll tick that never completes and a page that stops updating.
const opts = (call = 0): { timeout?: number; maxBuffer?: number } =>
  execFileMock.mock.calls[call][2] as { timeout?: number; maxBuffer?: number };

beforeEach(() => {
  execFileMock.mockReset();
});

describe('showUnits', () => {
  it('never shells out at all for an empty unit list', async () => {
    const result = await showUnits([], 'user');

    expect(result.size).toBe(0);
    expect(execFileMock).not.toHaveBeenCalled();
  });

  /*
   * ⚠️ One batched call for every unit, not one call per unit — this is the whole reason the
   * function takes an array. The old shape was `12 services × 3 exec calls × every connected
   * client × every second`, which is what made the page a load generator for the machine it was
   * supposed to be watching.
   */
  it('asks for every unit in a single systemctl call, with every property it needs', async () => {
    succeedsWith(showBlock(LOADED_ACTIVE));

    await showUnits(['a.service', 'b.service'], 'user');

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(binary()).toBe('systemctl');
    expect(args().slice(0, 4)).toEqual(['--user', 'show', 'a.service', 'b.service']);
    // Each property arrives as its own `-p <name>` pair. Asserting the flag and not just the name
    // is what keeps the list from degenerating into eleven bare words systemctl would read as
    // eleven more unit names.
    for (const property of ['Id', 'LoadState', 'ActiveState', 'SubState', 'UnitFileState', 'MemoryCurrent', 'CPUUsageNSec', 'MainPID', 'NRestarts', 'ActiveEnterTimestamp', 'ExecMainStartTimestamp']) {
      const at = args().indexOf(property);
      expect(at).toBeGreaterThan(3);
      expect(args()[at - 1]).toBe('-p');
    }
    expect(opts().timeout).toBe(10_000);
  });

  it('drops the --user flag for the system scope', async () => {
    succeedsWith(showBlock(LOADED_ACTIVE));

    await showUnits(['a.service'], 'system');

    expect(args()[0]).toBe('show');
  });

  it('reads every property off a healthy unit', async () => {
    succeedsWith(showBlock(LOADED_ACTIVE));

    const result = await showUnits(['marketplace-dev-public-resource.service'], 'user');

    expect(result.get('marketplace-dev-public-resource.service')).toEqual({
      id: 'marketplace-dev-public-resource.service',
      loadState: 'loaded',
      activeState: 'active',
      subState: 'running',
      unitFileState: 'enabled',
      mainPid: 4242,
      nRestarts: 3,
      memoryBytes: 52428800,
      cpuNs: 1234567890,
      since: Date.parse('2026-08-06T08:09:21'),
      error: null
    });
  });

  /*
   * ⚠️ Blocks are matched back to units by the Id= systemd itself prints, never by position.
   * Position happening to match request order today is not a documented guarantee, and the failure
   * it would produce is the worst kind: every card on the page showing another unit's state.
   */
  it('matches blocks to units by Id, not by the order they were asked for', async () => {
    succeedsWith(
      [showBlock({ ...LOADED_ACTIVE, Id: 'b.service' }), showBlock({ ...LOADED_ACTIVE, Id: 'a.service', ActiveState: 'failed' })].join('\n\n')
    );

    const result = await showUnits(['a.service', 'b.service'], 'user');

    expect(result.get('a.service')?.activeState).toBe('failed');
    expect(result.get('b.service')?.activeState).toBe('active');
  });

  it('drops a block it cannot attribute to any unit rather than guessing', async () => {
    succeedsWith([showBlock({ LoadState: 'loaded' }), showBlock({ ...LOADED_ACTIVE, Id: 'a.service' })].join('\n\n'));

    const result = await showUnits(['a.service'], 'user');

    expect(result.size).toBe(1);
    expect(result.get('a.service')?.loadState).toBe('loaded');
  });

  // Defensive, and the reason every caller can index the map by the full requested list without a
  // presence check of its own.
  it('still answers for a unit systemctl printed no block for', async () => {
    succeedsWith(showBlock({ ...LOADED_ACTIVE, Id: 'a.service' }));

    const result = await showUnits(['a.service', 'ghost.service'], 'user');

    expect(result.get('ghost.service')).toMatchObject({
      id: 'ghost.service',
      loadState: 'error',
      activeState: 'unknown',
      error: 'systemctl show returned no block for this unit'
    });
  });

  it('fills in defaults for a block that carries only an Id', async () => {
    succeedsWith(showBlock({ Id: 'a.service' }));

    expect(await showUnits(['a.service'], 'user')).toEqual(
      new Map([
        [
          'a.service',
          {
            id: 'a.service',
            loadState: 'error',
            activeState: 'unknown',
            subState: 'unknown',
            unitFileState: '',
            mainPid: null,
            nRestarts: 0,
            memoryBytes: null,
            cpuNs: null,
            since: null,
            error: null
          }
        ]
      ])
    );
  });

  it('ignores a line with no "=" in it', async () => {
    succeedsWith(['this is not a property', showBlock({ Id: 'a.service', ActiveState: 'active' })].join('\n'));

    expect(await showUnits(['a.service'], 'user')).toMatchObject(new Map([['a.service', { activeState: 'active' }]]));
  });

  /*
   * ⚠️ A line with no '=' is *dropped*, not sliced. The stray line below is deliberately a real
   * property name with one character appended, because that is the only shape in which the
   * difference is observable: split at `indexOf('=')` regardless — which is what the guard exists
   * to prevent — it becomes the key `MainPID` with the whole line as its value, and a truncated
   * write from systemd would silently overwrite the pid of a running unit with nonsense.
   */
  it('never turns a line with no "=" into a key by slicing it', async () => {
    succeedsWith([showBlock({ Id: 'a.service', MainPID: '4242' }), 'MainPIDX'].join('\n'));

    expect((await showUnits(['a.service'], 'user')).get('a.service')?.mainPid).toBe(4242);
  });

  it('keeps an "=" that appears inside a value', async () => {
    succeedsWith(showBlock({ Id: 'a.service', SubState: 'running=maybe' }));

    expect((await showUnits(['a.service'], 'user')).get('a.service')?.subState).toBe('running=maybe');
  });

  // MainPID=0 is what systemd reports for a unit with no running main process. Treating it as a pid
  // would put "PID 0" on the card and make a stopped unit look like it owns process zero.
  it.each([
    ['0', null],
    ['4242', 4242],
    ['', null],
    ['[not set]', null],
    // Not a shape systemd produces, and the point: `mainPidRaw > 0` is the only thing standing
    // between a garbled property and a card claiming the unit runs as PID -1.
    ['-1', null]
  ])('reads MainPID=%s as %s', async (raw, expected) => {
    succeedsWith(showBlock({ Id: 'a.service', MainPID: raw }));

    expect((await showUnits(['a.service'], 'user')).get('a.service')?.mainPid).toBe(expected);
  });

  it.each([
    ['a plain number', '52428800', 52428800],
    [`systemd's own "unset" spelling`, '[not set]', null],
    ['an empty value', '', null],
    ['whitespace', '   ', null],
    ['something not numeric at all', 'infinity-ish', null]
  ])('reads MemoryCurrent from %s', async (_label, raw, expected) => {
    // NRestarts trails it so the whitespace row is a value in the middle of a block rather than at
    // the very end of stdout, where it would be indistinguishable from an empty one.
    succeedsWith(showBlock({ Id: 'a.service', MemoryCurrent: raw, NRestarts: '0' }));

    expect((await showUnits(['a.service'], 'user')).get('a.service')?.memoryBytes).toBe(expected);
  });

  it('reads a missing NRestarts as zero restarts, not as unknown', async () => {
    succeedsWith(showBlock({ Id: 'a.service' }));

    expect((await showUnits(['a.service'], 'user')).get('a.service')?.nRestarts).toBe(0);
  });

  describe('timestamps', () => {
    /*
     * ⚠️ systemd prints a locale-dependent free-text timestamp ('Thu 2026-08-06 08:09:21 CEST').
     * Only the middle is re-parseable: the trailing abbreviation is ambiguous (CST alone names
     * three different offsets), so the date is read as local time on this host — correct because
     * the monitor and the systemd it queries are always the same machine.
     */
    it('reads the parseable core of a systemd timestamp as local time', async () => {
      succeedsWith(showBlock({ Id: 'a.service', ActiveEnterTimestamp: 'Thu 2026-08-06 08:09:21 CEST' }));

      expect((await showUnits(['a.service'], 'user')).get('a.service')?.since).toBe(Date.parse('2026-08-06T08:09:21'));
    });

    // Column-aligned output pads the gap between the date and the time. One space and several have
    // to read the same, or a unit's uptime disappears on whichever hosts pad it.
    it('reads a timestamp whose date and time are separated by more than one space', async () => {
      succeedsWith(showBlock({ Id: 'a.service', ActiveEnterTimestamp: 'Thu 2026-08-06   08:09:21 CEST' }));

      expect((await showUnits(['a.service'], 'user')).get('a.service')?.since).toBe(Date.parse('2026-08-06T08:09:21'));
    });

    it('falls back to ExecMainStartTimestamp when the unit never finished activating', async () => {
      succeedsWith(
        showBlock({ Id: 'a.service', ActiveEnterTimestamp: 'n/a', ExecMainStartTimestamp: 'Thu 2026-08-06 08:09:20 CEST' })
      );

      expect((await showUnits(['a.service'], 'user')).get('a.service')?.since).toBe(Date.parse('2026-08-06T08:09:20'));
    });

    /*
     * ⚠️ Every unreadable shape answers null, never NaN. A NaN reaching formatUptime in monitor.ts
     * would render as an uptime of "56y" — epoch zero — on a service that started a minute ago.
     */
    it.each([
      [`systemd's "unset"`, '[not set]'],
      ['its other "unset"', 'n/a'],
      ['an empty value', ''],
      ['whitespace', '  '],
      ['free text with no date in it', 'Thu CEST'],
      ['a date-shaped string no calendar has', 'Thu 2026-13-45 25:61:61 CEST']
    ])('answers null for %s', async (_label, raw) => {
      succeedsWith(showBlock({ Id: 'a.service', ActiveEnterTimestamp: raw, ExecMainStartTimestamp: raw }));

      expect((await showUnits(['a.service'], 'user')).get('a.service')?.since).toBeNull();
    });
  });

  describe('when the batch itself fails', () => {
    /*
     * ⚠️ Every requested unit gets an error entry rather than being absent from the map. Absence
     * would drop the service from the page entirely; an entry with loadState 'error' is what lets
     * monitor.ts still build a card for it, reading 'missing'.
     */
    it('gives every requested unit the same failure, not none of them', async () => {
      failsWith(enoent());

      const result = await showUnits(['a.service', 'b.service'], 'user');

      expect([...result.keys()]).toEqual(['a.service', 'b.service']);
      expect(result.get('a.service')).toEqual({
        id: 'a.service',
        loadState: 'error',
        activeState: 'unknown',
        subState: 'unknown',
        unitFileState: '',
        mainPid: null,
        nRestarts: 0,
        memoryBytes: null,
        cpuNs: null,
        since: null,
        error: 'systemctl not found on PATH — is this a systemd host?'
      });
    });

    it('reports what systemctl wrote to stderr, when it wrote anything', async () => {
      failsWith(Object.assign(new Error('Command failed'), { stderr: '  Failed to connect to bus: No such file\n' }));

      expect((await showUnits(['a.service'], 'user')).get('a.service')?.error).toBe('Failed to connect to bus: No such file');
    });

    it.each([
      ['stderr is absent', {}],
      ['stderr is only whitespace', { stderr: '  \n' }],
      ['stderr is not a string at all', { stderr: Buffer.from('bytes') }]
    ])('falls back to the error message when %s', async (_label, extra) => {
      failsWith(Object.assign(new Error('Command failed: timeout'), extra));

      expect((await showUnits(['a.service'], 'user')).get('a.service')?.error).toBe('Command failed: timeout');
    });

    // promisify rejects with whatever the callback was handed, and that is not guaranteed to be an
    // Error — reading `.message` off a string would report `undefined` as the reason.
    it('stringifies a rejection that is not an Error', async () => {
      failsWith('systemctl exploded');

      expect((await showUnits(['a.service'], 'user')).get('a.service')?.error).toBe('systemctl exploded');
    });
  });
});

describe('controlUnit', () => {
  it.each([
    ['start' as const],
    ['stop' as const],
    ['restart' as const]
  ])('runs systemctl --user %s on the unit', async (action) => {
    succeedsWith('');

    const result = await controlUnit('a.service', action, 'user');

    expect(binary()).toBe('systemctl');
    expect(args()).toEqual(['--user', action, 'a.service']);
    expect(opts().timeout).toBe(10_000);
    expect(result).toEqual({ ok: true, message: `a.service: ${action} succeeded` });
  });

  it('runs without --user in the system scope', async () => {
    succeedsWith('');

    await controlUnit('a.service', 'start', 'system');

    expect(args()).toEqual(['start', 'a.service']);
  });

  /*
   * ⚠️ Never throws. A failed start is an ordinary answer here — it comes back as {ok:false} and is
   * rendered as a notification, because the alternative is one bad unit rejecting the group action
   * that was meant to start the other eleven.
   */
  it('reports a failure instead of throwing it', async () => {
    failsWith(Object.assign(new Error('Command failed'), { stderr: 'Unit a.service not found.\n' }));

    expect(await controlUnit('a.service', 'start', 'user')).toEqual({ ok: false, message: 'Unit a.service not found.' });
  });

  // The failure names the binary that is missing. 'not found on PATH' alone would be reported for
  // journalctl too, and the two are installed — or absent — independently.
  it('names systemctl itself when systemctl is the thing that is missing', async () => {
    failsWith(enoent());

    expect(await controlUnit('a.service', 'start', 'user')).toEqual({
      ok: false,
      message: 'systemctl not found on PATH — is this a systemd host?'
    });
  });
});

describe('daemonReload', () => {
  it('reloads in the requested scope', async () => {
    succeedsWith('');

    expect(await daemonReload('user')).toEqual({ ok: true, message: 'daemon-reload succeeded' });
    expect(binary()).toBe('systemctl');
    expect(args()).toEqual(['--user', 'daemon-reload']);
    expect(opts().timeout).toBe(10_000);
  });

  it('reports a failure instead of throwing it', async () => {
    failsWith(enoent());

    expect(await daemonReload('system')).toEqual({ ok: false, message: 'systemctl not found on PATH — is this a systemd host?' });
    expect(args()).toEqual(['daemon-reload']);
  });
});

describe('unitLogs', () => {
  it('asks journalctl for the requested unit, in a shape a browser can render', async () => {
    succeedsWith('line one\nline two\n');

    const lines = await unitLogs('a.service', 200, 'user');

    expect(binary()).toBe('journalctl');
    expect(args()).toEqual(['--user', '-u', 'a.service', '-n', '200', '--no-pager', '--output=short-iso']);
    // 16 MiB, not node's ~1 MiB exec default: 2000 lines of --output=short-iso with the occasional
    // stack trace in them overruns the default, and an overrun is a MAXBUFFER error rather than a
    // truncated tail. The timeout is longer than the control one for the same reason.
    expect(opts()).toEqual({ timeout: 15_000, maxBuffer: 16 * 1024 * 1024 });
    expect(lines).toEqual(['line one', 'line two']);
  });

  it('drops only the trailing newline, and keeps a blank line in the middle', async () => {
    succeedsWith('line one\n\nline three\n');

    expect(await unitLogs('a.service', 10, 'user')).toEqual(['line one', '', 'line three']);
  });

  it('keeps the last line of output that does not end in a newline', async () => {
    succeedsWith('line one\nline two');

    expect(await unitLogs('a.service', 10, 'user')).toEqual(['line one', 'line two']);
  });

  it('answers an empty list for a unit with no journal at all', async () => {
    succeedsWith('');

    expect(await unitLogs('a.service', 10, 'user')).toEqual([]);
  });

  /*
   * The clamp exists because the line count is client-supplied: `?lines=` on the HTTP route and a
   * `lines` field on the WS frame. Unbounded, it is a request for the entire journal — 20 seconds
   * of journalctl and a buffer overrun — and zero or a negative asks for output nobody can use.
   */
  it.each([
    ['a request in range', 500, '500'],
    ['a request above the cap', 999999, '2000'],
    ['zero', 0, '1'],
    ['a negative number', -20, '1'],
    ['a fractional number', 12.9, '12'],
    ['NaN', Number.NaN, '200'],
    ['Infinity', Number.POSITIVE_INFINITY, '200']
  ])('clamps %s', async (_label, requested, expected) => {
    succeedsWith('');

    await unitLogs('a.service', requested, 'user');

    expect(args()[args().indexOf('-n') + 1]).toBe(expected);
  });

  it('drops --user in the system scope', async () => {
    succeedsWith('');

    await unitLogs('a.service', 10, 'system');

    expect(args()[0]).toBe('-u');
  });

  /*
   * ⚠️ Logs are a read-only convenience. A journalctl that is missing or times out comes back as
   * one log-shaped line so the drawer can show why, rather than as a rejection that would turn a
   * failed log read into a failed HTTP request.
   */
  it('answers a failure as a single explanatory line', async () => {
    failsWith(enoent());

    expect(await unitLogs('a.service', 10, 'user')).toEqual([
      '(failed to read logs: journalctl not found on PATH — is this a systemd host?)'
    ]);
  });
});

describe('isEnabled', () => {
  it('answers what systemctl printed, trimmed', async () => {
    succeedsWith('enabled\n');

    expect(await isEnabled('a.service', 'user')).toBe('enabled');
    expect(binary()).toBe('systemctl');
    expect(args()).toEqual(['--user', 'is-enabled', 'a.service']);
    expect(opts().timeout).toBe(10_000);
  });

  /*
   * ⚠️ `systemctl is-enabled` exits non-zero for perfectly ordinary states — 'disabled' and
   * 'static' among them — while still printing the state on stdout. Treating every non-zero exit
   * as a hard failure would report every disabled unit as 'unknown'.
   */
  it.each([
    ['disabled'],
    ['static']
  ])('recovers "%s" from a non-zero exit', async (state) => {
    failsWith(Object.assign(new Error('Command failed'), { stdout: `${state}\n` }));

    expect(await isEnabled('a.service', 'user')).toBe(state);
  });

  it('answers a specific unknown when systemctl is not installed', async () => {
    failsWith(enoent());

    expect(await isEnabled('a.service', 'system')).toBe('unknown (systemctl not found)');
    expect(args()).toEqual(['is-enabled', 'a.service']);
  });

  it.each([
    ['no stdout at all', {}],
    ['stdout that is only whitespace', { stdout: '  \n' }],
    ['stdout that is not a string', { stdout: 42 }]
  ])('answers a plain unknown for a failure with %s', async (_label, extra) => {
    failsWith(Object.assign(new Error('Command failed'), extra));

    expect(await isEnabled('a.service', 'user')).toBe('unknown');
  });
});
