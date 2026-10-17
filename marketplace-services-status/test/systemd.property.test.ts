import fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { controlUnit, showUnits, unitLogs, UnitShowResult } from '../src/systemd';
import { lowercase, RUN } from './support/arbitraries';

// ---------------------------------------------------------------------------
// src/systemd.ts, stated as rules. child_process is mocked for the reason `systemd.test.ts` gives at
// length: a suite that ran the real systemctl would assert on whatever units the machine happens to
// have, and could stop one. The mock is the same callback-shaped one, because systemd.ts wraps
// execFile in promisify() at module load.
//
// `systemctl show` output is the one untrusted-shaped input this module parses — it is free text, in a
// locale, from a binary the monitor does not control — so it gets the generated-input treatment; the
// argv a unit name is handed to gets it too, because that argv is the platform's only shell boundary.
// ---------------------------------------------------------------------------

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));

vi.mock('child_process', () => ({ execFile: execFileMock }));

type ExecCallback = (err: unknown, result?: { stdout: string; stderr: string }) => void;

const succeedsWith = (stdout: string): void => {
  execFileMock.mockImplementation((_file: string, _args: string[], _opts: unknown, cb: ExecCallback) => {
    cb(null, { stdout, stderr: '' });
  });
};

/** `err` must be truthy: promisify reads a falsy one as "no error" and resolves instead of rejecting. */
const failsWith = (err: unknown): void => {
  execFileMock.mockImplementation((_file: string, _args: string[], _opts: unknown, cb: ExecCallback) => {
    cb(err);
  });
};

const lastCall = (): { binary: string; argv: string[]; options: Record<string, unknown> } => {
  const [binary, argv, options] = execFileMock.mock.calls[0] as [string, string[], Record<string, unknown>];
  return { binary, argv, options };
};

beforeEach(() => {
  execFileMock.mockReset();
});

const unitId = lowercase(1, 12).map((name) => `${name}.service`);
const nonBlank = fc.string({ minLength: 1 }).filter((text) => text.trim() !== '');

// Everything `systemctl show` prints for the eleven properties systemd.ts asks for. The two timestamps are
// left at systemd's own "nothing here" spellings in this round trip: they are local-time text, and get a
// test of their own further down, built so that it asserts on the parser and not on the machine's timezone.
interface Shown {
  id: string;
  loadState: string;
  activeState: string;
  subState: string;
  unitFileState: string;
  pid: number;
  restarts: number;
  memory: number | null;
  cpu: number | null;
  // How systemd spells a counter it has no value for: the literal, an empty value, or nothing readable.
  unset: string;
}

const shown: fc.Arbitrary<Shown> = fc.record({
  id: unitId,
  loadState: fc.constantFrom('loaded', 'not-found', 'masked'),
  activeState: fc.constantFrom('active', 'inactive', 'failed', 'activating', 'deactivating'),
  subState: lowercase(1, 10),
  unitFileState: fc.constantFrom('enabled', 'disabled', 'static', ''),
  pid: fc.nat(4_194_304),
  restarts: fc.nat(10_000),
  memory: fc.option(fc.maxSafeNat(), { nil: null }),
  cpu: fc.option(fc.maxSafeNat(), { nil: null }),
  unset: fc.constantFrom('[not set]', '', ' ', 'n/a')
});

const render = (unit: Shown): string =>
  [
    `Id=${unit.id}`,
    `LoadState=${unit.loadState}`,
    `ActiveState=${unit.activeState}`,
    `SubState=${unit.subState}`,
    `UnitFileState=${unit.unitFileState}`,
    `MemoryCurrent=${unit.memory ?? unit.unset}`,
    `CPUUsageNSec=${unit.cpu ?? unit.unset}`,
    `MainPID=${unit.pid}`,
    `NRestarts=${unit.restarts}`,
    'ActiveEnterTimestamp=n/a',
    'ExecMainStartTimestamp='
  ].join('\n');

// MainPID=0 is systemd's spelling of "no process", and 0 is not a pid.
const expected = (unit: Shown): UnitShowResult => ({
  id: unit.id,
  loadState: unit.loadState,
  activeState: unit.activeState,
  subState: unit.subState,
  unitFileState: unit.unitFileState,
  mainPid: unit.pid > 0 ? unit.pid : null,
  nRestarts: unit.restarts,
  memoryBytes: unit.memory,
  cpuNs: unit.cpu,
  since: null,
  error: null
});

const pad = (n: number): string => String(n).padStart(2, '0');

// A systemd timestamp as the text it prints, and the instant it names. systemd prints it in the machine's
// own local time, so the instant is built through the Date constructor (local time too) rather than by
// the parser under test; the weekday and the zone abbreviation are decoration the parser must ignore.
interface Stamp {
  text: string;
  ms: number | null;
}

const stamp: fc.Arbitrary<Stamp> = fc.oneof(
  {
    weight: 3,
    arbitrary: fc
      .record({
        year: fc.integer({ min: 1970, max: 2100 }),
        month: fc.integer({ min: 1, max: 12 }),
        day: fc.integer({ min: 1, max: 28 }),
        hour: fc.integer({ min: 0, max: 23 }),
        minute: fc.integer({ min: 0, max: 59 }),
        second: fc.integer({ min: 0, max: 59 }),
        weekday: fc.constantFrom('Mon', 'Thu', 'Sun'),
        zone: fc.constantFrom('CEST', 'UTC', 'CST')
      })
      .map(
        (p): Stamp => ({
          text: `${p.weekday} ${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} ${p.zone}`,
          ms: new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second).getTime()
        })
      )
  },
  {
    weight: 1,
    arbitrary: fc
      .constantFrom('', '[not set]', 'n/a', 'Thu 2026-13-45 99:99:99 CEST', '2026-01-01 25:00:00')
      .map((text): Stamp => ({ text, ms: null }))
  }
);

describe('showUnits, for any systemctl output', () => {
  // Blocks are matched back to units by the Id= each one reports, never by position. A unit list and a
  // block list in different orders is exactly the input that would show one service's pid under
  // another service's name if anything zipped them.
  it('gives every unit its own values, whatever order systemctl printed the blocks in', async () => {
    // systemctl separates blocks with one empty line; the parser accepts any blank-ish run, and the
    // other spellings are here so that tolerance is a rule somebody has to break on purpose.
    const separator = fc.constantFrom('\n\n', '\n \n', '\n\n\n');
    const inAnyOrder = fc
      .uniqueArray(shown, { minLength: 1, maxLength: 6, selector: (unit) => unit.id })
      .chain((all) =>
        fc.tuple(fc.constant(all), fc.shuffledSubarray(all, { minLength: all.length, maxLength: all.length }), separator)
      );

    await fc.assert(
      fc.asyncProperty(inAnyOrder, async ([all, printed, between]) => {
        succeedsWith(printed.map(render).join(between));

        const result = await showUnits(
          all.map((unit) => unit.id),
          'user'
        );

        expect(result.size).toBe(all.length);
        for (const unit of all) expect(result.get(unit.id)).toEqual(expected(unit));
      }),
      RUN
    );
  });

  // The output is free text from another program. Whatever it holds, every requested unit still gets an
  // entry, and no number that reaches the page can be NaN, Infinity or a pid that is not a pid.
  it('answers every requested unit and never lets a NaN or a bad pid through', async () => {
    const line = fc.tuple(
      fc.constantFrom('Id', 'LoadState', 'ActiveState', 'MainPID', 'NRestarts', 'MemoryCurrent', 'CPUUsageNSec', 'ActiveEnterTimestamp', 'Other'),
      fc.oneof(fc.string(), fc.constantFrom('', '[not set]', 'n/a', '-1', '0', '1e999', 'NaN', '0x10', 'Thu 2026-02-31 25:61:61 CEST', '9999-99-99 99:99:99'))
    );
    const printed = fc
      .tuple(fc.array(line, { maxLength: 14 }), fc.constantFrom('\n', '\n\n', '\n \n'))
      .map(([lines, separator]) => lines.map(([key, value]) => `${key}=${value}`).join(separator));

    await fc.assert(
      fc.asyncProperty(fc.oneof(fc.string({ unit: 'binary' }), printed), fc.uniqueArray(unitId, { maxLength: 4 }), async (stdout, units) => {
        succeedsWith(stdout);

        const result = await showUnits(units, 'user');

        for (const unit of units) expect(result.has(unit)).toBe(true);
        for (const [key, entry] of result) {
          // A block with no Id= belongs to no unit and is dropped, never filed under `undefined`.
          expect(typeof key).toBe('string');
          expect(key.length).toBeGreaterThan(0);
          expect(entry.id).toBe(key);
          for (const value of [entry.mainPid, entry.memoryBytes, entry.cpuNs, entry.since]) {
            expect(value === null || Number.isFinite(value)).toBe(true);
          }
          expect(entry.mainPid === null || entry.mainPid > 0).toBe(true);
          expect(Number.isFinite(entry.nRestarts)).toBe(true);
        }
      }),
      RUN
    );
  });

  // A date that matches the shape but is not one (month 13, hour 25) must come back as null: a bad date
  // must never become NaN, and never "epoch zero" uptime.
  it('reads the start time out of the local-time text, preferring ActiveEnterTimestamp', async () => {
    await fc.assert(
      fc.asyncProperty(stamp, stamp, async (entered, started) => {
        succeedsWith(
          ['Id=a.service', 'LoadState=loaded', `ActiveEnterTimestamp=${entered.text}`, `ExecMainStartTimestamp=${started.text}`].join('\n')
        );

        const result = await showUnits(['a.service'], 'user');

        expect(result.get('a.service')?.since).toBe(entered.ms ?? started.ms);
      }),
      RUN
    );
  });

  it('reports a failed batch against every unit, with the text systemctl wrote', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(unitId, { minLength: 1, maxLength: 4 }), nonBlank, async (units, stderr) => {
        failsWith(Object.assign(new Error('Command failed'), { stderr }));

        const result = await showUnits(units, 'user');

        expect(result.size).toBe(units.length);
        for (const unit of units) expect(result.get(unit)).toMatchObject({ id: unit, loadState: 'error', error: stderr.trim() });
      }),
      RUN
    );
  });
});

describe('the argv a unit name travels in, for any unit name', () => {
  // The platform's only shell boundary: `execFile` with an argv array, never `shell: true`. Whatever a
  // client manages to put in a unit name — spaces, quotes, a leading dash, a newline — it must arrive as
  // exactly one element of that array, at exactly one position, with no option set that would reinterpret it.
  const hostile = fc.oneof(
    fc.string({ unit: 'binary', minLength: 1 }),
    fc.constantFrom('a.service; reboot', '$(id)', '`id`', '--user=root', '-p Id', 'a b', '\n', 'a.service\0')
  );

  it('controlUnit passes it as one element, through no shell', async () => {
    await fc.assert(
      fc.asyncProperty(hostile, fc.constantFrom('start', 'stop', 'restart'), fc.constantFrom('user', 'system'), async (unit, action, scope) => {
        execFileMock.mockReset();
        succeedsWith('');

        await controlUnit(unit, action, scope);

        const { binary, argv, options } = lastCall();
        expect(binary).toBe('systemctl');
        expect(argv).toEqual([...(scope === 'user' ? ['--user'] : []), action, unit]);
        expect(options).not.toHaveProperty('shell');
      }),
      RUN
    );
  });

  it('showUnits and unitLogs pass it the same way', async () => {
    await fc.assert(
      fc.asyncProperty(hostile, async (unit) => {
        execFileMock.mockReset();
        succeedsWith('');

        await showUnits([unit], 'user');
        await unitLogs(unit, 10, 'user');

        const [show, logs] = execFileMock.mock.calls as [[string, string[], object], [string, string[], object]];
        expect(show[1].slice(0, 3)).toEqual(['--user', 'show', unit]);
        expect(logs[1].slice(0, 3)).toEqual(['--user', '-u', unit]);
        expect(show[2]).not.toHaveProperty('shell');
        expect(logs[2]).not.toHaveProperty('shell');
      }),
      RUN
    );
  });
});

describe('unitLogs, for any requested length', () => {
  const askedFor = (): string => {
    const { argv } = lastCall();
    return argv[argv.indexOf('-n') + 1];
  };

  // The specials are listed rather than left to chance: `fc.double()` reaches NaN and the infinities only
  // now and then, and it almost never lands on a fraction between 1 and 2000 — doubles are densest near
  // zero, so a range that wide is mostly spent on numbers too small to matter. Hundredths are the fix.
  const requestedLines = fc.oneof(
    fc.constantFrom(NaN, Infinity, -Infinity, -0, 0, 0.5, 1e300, -1e300),
    fc.integer({ min: -100, max: 250_000 }).map((hundredths) => hundredths / 100),
    fc.integer(),
    fc.double()
  );

  // Whatever arrives — NaN, a float, a negative, 1e300 — journalctl is asked for a whole number of lines
  // inside [1, 2000], so the 16 MB buffer chosen against that cap stays large enough.
  it('always asks journalctl for a whole number of lines between 1 and 2000', async () => {
    await fc.assert(
      fc.asyncProperty(requestedLines, async (requested) => {
        execFileMock.mockReset();
        succeedsWith('');

        await unitLogs('a.service', requested, 'user');

        expect(askedFor()).toMatch(/^\d+$/);
        expect(Number(askedFor())).toBeGreaterThanOrEqual(1);
        expect(Number(askedFor())).toBeLessThanOrEqual(2000);
      }),
      RUN
    );
  });

  it('passes a length that is already in range through untouched', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 2000 }), async (requested) => {
        execFileMock.mockReset();
        succeedsWith('');

        await unitLogs('a.service', requested, 'user');

        expect(askedFor()).toBe(String(requested));
      }),
      RUN
    );
  });

  // journalctl ends its output with a newline; the one empty line that leaves is not a log line.
  it('returns the journal lines with or without the final newline', async () => {
    const lines = fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 8 });

    await fc.assert(
      fc.asyncProperty(lines, fc.boolean(), async (journal, newline) => {
        execFileMock.mockReset();
        succeedsWith(journal.join('\n') + (newline ? '\n' : ''));

        expect(await unitLogs('a.service', 10, 'user')).toEqual(journal);
      }),
      RUN
    );
  });
});

describe('controlUnit, for any failure', () => {
  it('reports what systemctl wrote to stderr, trimmed', async () => {
    await fc.assert(
      fc.asyncProperty(nonBlank, async (stderr) => {
        failsWith(Object.assign(new Error('Command failed'), { stderr }));

        expect(await controlUnit('a.service', 'start', 'user')).toEqual({ ok: false, message: stderr.trim() });
      }),
      RUN
    );
  });

  it('keeps the text of a rejection that is not an Error', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (text) => {
        failsWith(text);

        expect(await controlUnit('a.service', 'stop', 'user')).toEqual({ ok: false, message: text });
      }),
      RUN
    );
  });
});
