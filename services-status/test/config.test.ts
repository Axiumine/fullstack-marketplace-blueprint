import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as path from 'path';

import { loadConfig } from '../src/config';

// ---------------------------------------------------------------------------
// The whole module is driven through its one export, loadConfig(), because that is the only way
// in: findServicesJsonPath, parseServicesJson and loadEnv are module-private on purpose (nothing
// outside this file may load half a config). So both of its inputs are faked instead.
//
// `fs` is mocked rather than pointed at a temp directory because the path it reads is derived from
// __dirname and is not a parameter — a real file would have to be written into the project root,
// where it would shadow the real services.json for every other suite in the same run.
//
// `dotenv` is mocked to a no-op, and that is not a convenience: services-status/.env holds a live
// AUTH_TOKEN, and letting it load would make every assertion below depend on a file that is not in
// the repo and differs per machine — the BIND_ALL guard in particular flips on it.
// ---------------------------------------------------------------------------

const { files, readFailure } = vi.hoisted(() => ({
  files: new Map<string, string>(),
  // What readFileSync should throw instead of answering, when a test needs the failure itself to
  // be the subject rather than the content.
  readFailure: { value: null as unknown }
}));

vi.mock('fs', () => ({
  existsSync: (p: string) => files.has(p),
  readFileSync: (p: string, encoding?: unknown) => {
    if (readFailure.value !== null) throw readFailure.value;
    // Faithful to node, and load-bearing: an unknown encoding is a TypeError before the file is
    // even opened, and omitting it answers a Buffer rather than a string. A mock that ignored the
    // argument would let `readFileSync(path)` and `readFileSync(path, 'utf8')` test the same.
    if (typeof encoding !== 'string' || !Buffer.isEncoding(encoding)) {
      throw new TypeError(`The "options.encoding" property must be a valid string encoding. Received ${JSON.stringify(encoding)}`);
    }
    const content = files.get(p);
    if (content === undefined) throw new Error(`ENOENT: no such file or directory, open '${p}'`);
    return content;
  }
}));

vi.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

// __dirname inside src/config.ts, and the two candidates it derives from it. Written the same way
// the source does rather than hard-coded, so a moved file fails these tests instead of silently
// testing a path nothing reads.
const SRC_DIR = path.resolve(__dirname, '..', 'src');
const PRIMARY = path.resolve(SRC_DIR, '..', 'services.json');
const FALLBACK = path.resolve(SRC_DIR, '..', '..', 'services.json');

const PROJECT_ROOT = path.dirname(PRIMARY);

interface Json {
  [key: string]: unknown;
}

const service = (patch: Json = {}): Json => ({
  id: 'marketplace-dev-public-resource',
  label: 'Public Resource',
  repo: 'BEs/dev/marketplace-dev-public-resource',
  kind: 'backend',
  script: 'dev',
  port: 4027,
  path: '/public-resource',
  description: 'Public catalogue reads, customer registration',
  ...patch
});

const group = (patch: Json = {}): Json => ({
  id: 'public',
  title: 'Public tier',
  description: 'Anonymous traffic',
  services: [service()],
  ...patch
});

const root = (patch: Json = {}): Json => ({
  workspaceRoot: '..',
  nodeVersion: '24.18.0',
  nvmDir: '~/.nvm',
  unitTarget: 'marketplace.target',
  monitorUnit: 'marketplace-status.service',
  groups: [group()],
  ...patch
});

/** Writes the fixture where findServicesJsonPath will look for it first. */
const write = (json: unknown, at: string = PRIMARY): void => {
  files.set(at, JSON.stringify(json));
};

/** One root object whose single group holds exactly the services given. */
const withServices = (...services: Json[]): Json => root({ groups: [group({ services })] });

// Every variable loadEnv reads. Cleared before each test and restored after, so a developer's own
// shell (or a previous test's assignment) can never decide which branch of the guard runs.
const ENV_KEYS = [
  'WORKSPACE_ROOT',
  'PORT',
  'HOST',
  'BIND_ALL',
  'BEHIND_PROXY',
  'PROXY_PROTOCOL',
  'DOMAIN',
  'SYSTEMCTL_SCOPE',
  'POLL_INTERVAL_MS',
  'PROBE_TIMEOUT_MS',
  'LOG_LINES',
  'AUTH_TOKEN',
  'ALLOWED_HOSTS'
] as const;

const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  files.clear();
  readFailure.value = null;
  write(root());
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('loadConfig: finding services.json', () => {
  it('reads the file one level above src/', () => {
    expect(loadConfig().servicesJsonPath).toBe(PRIMARY);
  });

  it('falls back to two levels up when the first candidate is absent', () => {
    // Not the expected layout — the safety net for a tsconfig that nests the build one deeper.
    files.clear();
    write(root(), FALLBACK);

    expect(loadConfig().servicesJsonPath).toBe(FALLBACK);
  });

  it('names both candidates when neither exists, one per line', () => {
    files.clear();

    // The separator is asserted, not just the two paths: joined with nothing they run together
    // into one unreadable path-that-is-not-a-path, which is exactly what the message is for.
    expect(() => loadConfig()).toThrow(`could not find services.json — looked in:\n  ${PRIMARY}\n  ${FALLBACK}`);
  });

  it("reports unparsable JSON with the path and the parser's own reason", () => {
    files.set(PRIMARY, '{ not json');

    expect(() => loadConfig()).toThrow(new RegExp(`^\\[config\\] ${PRIMARY} is not valid JSON: .`));
  });

  /*
   * ⚠️ A read that fails with something that is not an Error. `String(err)` is the arm that keeps
   * the message readable — without it the report reads "is not valid JSON: [object Object]" or,
   * worse, throws a second time inside the error handler while reading `.message` off a string.
   */
  it('reports a non-Error failure without losing what it said', () => {
    readFailure.value = 'EIO: the disk gave up';

    expect(() => loadConfig()).toThrow(`[config] ${PRIMARY} is not valid JSON: EIO: the disk gave up`);
  });
});

describe('loadConfig: services.json shape', () => {
  // The pointer in the message is the whole point of these errors: a services.json with 12 services
  // in 4 groups is not a file anyone wants to bisect by hand.
  it.each([
    ['a root that is not an object', [], '#: must be an object, got array(length 0)'],
    // `typeof null` is 'object', so null is the one value that reaches this check looking like a
    // match for it. Left through, it fails later as "Cannot read properties of null" instead.
    ['a root that is null', null, '#: must be an object, got null'],
    ['a missing workspaceRoot', root({ workspaceRoot: undefined }), '#workspaceRoot: must be a non-empty string, got undefined'],
    ['an empty workspaceRoot', root({ workspaceRoot: '' }), '#workspaceRoot: must be a non-empty string, got string ""'],
    ['a missing nodeVersion', root({ nodeVersion: undefined }), '#nodeVersion: must be a non-empty string, got undefined'],
    ['a missing nvmDir', root({ nvmDir: undefined }), '#nvmDir: must be a non-empty string, got undefined'],
    ['a missing unitTarget', root({ unitTarget: undefined }), '#unitTarget: must be a non-empty string, got undefined'],
    ['a missing monitorUnit', root({ monitorUnit: undefined }), '#monitorUnit: must be a non-empty string, got undefined'],
    ['groups as an object', root({ groups: {} }), '#groups: must be an array, got object'],
    ['no groups at all', root({ groups: [] }), '#groups: must contain at least one group'],
    ['a group that is not an object', root({ groups: ['public'] }), '#groups[0]: must be an object, got string "public"'],
    ['a group with no id', root({ groups: [group({ id: undefined })] }), '#groups[0].id: must be a non-empty string, got undefined'],
    ['a group with no title', root({ groups: [group({ title: 42 })] }), '#groups[0].title: must be a non-empty string, got number 42'],
    [
      'a group with no description',
      root({ groups: [group({ description: null })] }),
      '#groups[0].description: must be a non-empty string, got null'
    ],
    ['a group whose services is not an array', root({ groups: [group({ services: 'all' })] }), '#groups[0].services: must be an array, got string "all"'],
    ['a group with no services', root({ groups: [group({ services: [] })] }), '#groups[0].services: must contain at least one service'],
    ['a service that is not an object', withServices([] as unknown as Json), '#groups[0].services[0]: must be an object, got array(length 0)'],
    ['a service with no id', withServices(service({ id: undefined })), '#groups[0].services[0].id: must be a non-empty string, got undefined'],
    ['a service with no label', withServices(service({ label: undefined })), '#groups[0].services[0].label: must be a non-empty string, got undefined'],
    ['a service with no repo', withServices(service({ repo: undefined })), '#groups[0].services[0].repo: must be a non-empty string, got undefined'],
    ['a service with no script', withServices(service({ script: undefined })), '#groups[0].services[0].script: must be a non-empty string, got undefined'],
    ['a service with no path', withServices(service({ path: undefined })), '#groups[0].services[0].path: must be a non-empty string, got undefined'],
    [
      'a service with no description',
      withServices(service({ description: undefined })),
      '#groups[0].services[0].description: must be a non-empty string, got undefined'
    ],
    ['a service of an unknown kind', withServices(service({ kind: 'worker' })), '#groups[0].services[0].kind: must be "backend" or "frontend", got string "worker"'],
    ['a kind that is a boolean', withServices(service({ kind: true })), '#groups[0].services[0].kind: must be "backend" or "frontend", got boolean true'],
    [
      'a port that is a string',
      withServices(service({ port: '4027' })),
      '#groups[0].services[0].port: must be a number or null, got string "4027"'
    ],
    ['an empty host', withServices(service({ host: '' })), '#groups[0].services[0].host: must be a non-empty string when present, got string ""'],
    [
      'a healthPath that is a number',
      withServices(service({ healthPath: 8 })),
      '#groups[0].services[0].healthPath: must be a non-empty string when present, got number 8'
    ]
  ])('rejects %s', (_label, json, expected) => {
    write(json);

    expect(() => loadConfig()).toThrow(`[config] ${PRIMARY}${expected}`);
  });

  /*
   * ⚠️ An omitted port is not "no port". `null` is, and the difference is a service the monitor
   * silently stops probing versus one it was never told about — so omission is refused outright
   * rather than defaulted to either reading.
   */
  it('refuses an omitted port, and says which spelling means "no port"', () => {
    write(withServices(service({ port: undefined })));

    expect(() => loadConfig()).toThrow('#groups[0].services[0].port: is required (use null, not omission, for "no port")');
  });

  /*
   * Reachable only from a real file, which is why it is written as raw text: JSON.stringify(Infinity)
   * emits `null`, but the *parser* reads `1e999` back as Infinity. A port of Infinity would sail
   * through a `typeof value === 'number'` test and end up in a URL as "http://127.0.0.1:Infinity".
   */
  it('refuses a port the JSON parser read as Infinity', () => {
    files.set(PRIMARY, JSON.stringify(withServices(service({ port: 0 }))).replace('"port":0', '"port":1e999'));

    expect(() => loadConfig()).toThrow('#groups[0].services[0].port: must be a finite number, got number Infinity');
  });

  it('refuses two groups with the same id', () => {
    write(root({ groups: [group(), group({ title: 'Public tier, again' })] }));

    expect(() => loadConfig()).toThrow('#groups[1].id: duplicate group id "public"');
  });

  /*
   * ⚠️ Ids are the key of serviceMap and the payload of every WS action frame. A duplicate would
   * not throw anywhere: the second entry would overwrite the first in the map while both stayed in
   * the services array, so the page would render two cards and both would drive the same unit.
   */
  it('refuses two services with the same id, across groups', () => {
    write(root({ groups: [group(), group({ id: 'shopOwner', services: [service({ label: 'Copy' })] })] }));

    expect(() => loadConfig()).toThrow('#groups[1].services[0].id: duplicate service id "marketplace-dev-public-resource"');
  });
});

describe('loadConfig: what it builds', () => {
  it('derives the unit name and the URL from the id, the host and the path', () => {
    const config = loadConfig();

    expect(config.services).toEqual([
      {
        id: 'marketplace-dev-public-resource',
        unit: 'marketplace-dev-public-resource.service',
        label: 'Public Resource',
        groupId: 'public',
        kind: 'backend',
        repo: 'BEs/dev/marketplace-dev-public-resource',
        port: 4027,
        url: 'http://127.0.0.1:4027/public-resource',
        description: 'Public catalogue reads, customer registration'
      }
    ]);
  });

  /*
   * ⚠️ `host` is validated and stored, but deliberately not part of ServiceDescriptor — it lives in
   * the sibling serviceHosts map so a stray JSON.stringify(config.services) on the wire cannot leak
   * an internal address the page never needed. Asserted here so that separation stays deliberate.
   */
  it('keeps a service host out of the wire shape and in the sibling map', () => {
    write(withServices(service({ host: '10.0.0.5' })));
    const config = loadConfig();

    expect(config.services[0]).not.toHaveProperty('host');
    expect(config.serviceHosts.get('marketplace-dev-public-resource')).toBe('10.0.0.5');
    expect(config.services[0].url).toBe('http://10.0.0.5:4027/public-resource');
  });

  it('defaults a service with no host of its own to loopback', () => {
    expect(loadConfig().serviceHosts.get('marketplace-dev-public-resource')).toBe('127.0.0.1');
  });

  // A service with no port is a real case (a unit with nothing listening), and it must not produce
  // a link — "http://127.0.0.1:null/" is a URL the page would happily render as clickable.
  it('gives a portless service no URL rather than a broken one', () => {
    write(withServices(service({ port: null })));
    const config = loadConfig();

    expect(config.services[0].port).toBeNull();
    expect(config.services[0].url).toBeNull();
  });

  // 'frontend' is the other half of the kind union and nothing else asserts it: with only
  // 'backend' exercised, a validator that accepted *no* kind but 'backend' would pass every test
  // here while refusing every frontend entry of the real services.json.
  it('accepts a frontend service as readily as a backend one', () => {
    write(withServices(service({ kind: 'frontend', id: 'marketplace-user', port: 3045 })));

    expect(loadConfig().services[0].kind).toBe('frontend');
  });

  it('accepts an optional healthPath without putting it on the wire', () => {
    write(withServices(service({ healthPath: '/check/' })));

    expect(loadConfig().services[0]).not.toHaveProperty('healthPath');
  });

  it("indexes groups and services by id, and lists each group's service ids in order", () => {
    write(
      root({
        groups: [
          group({ services: [service(), service({ id: 'marketplace-dev-public-authorization', port: 4028 })] }),
          group({ id: 'user', services: [service({ id: 'marketplace-dev-user-authenticated-resource', port: 4032 })] })
        ]
      })
    );
    const config = loadConfig();

    expect(config.groups.map((g) => g.id)).toEqual(['public', 'user']);
    expect(config.groups[0].serviceIds).toEqual(['marketplace-dev-public-resource', 'marketplace-dev-public-authorization']);
    expect(config.groupMap.get('user')?.serviceIds).toEqual(['marketplace-dev-user-authenticated-resource']);
    expect(config.serviceMap.get('marketplace-dev-public-authorization')?.unit).toBe('marketplace-dev-public-authorization.service');
    expect(config.serviceMap.size).toBe(3);
  });

  it("carries the unit target and the monitor's own unit through", () => {
    const config = loadConfig();

    expect(config.unitTarget).toBe('marketplace.target');
    expect(config.monitorUnit).toBe('marketplace-status.service');
  });

  it('resolves workspaceRoot against the directory services.json lives in', () => {
    expect(loadConfig().workspaceRoot).toBe(path.resolve(PROJECT_ROOT, '..'));
  });

  // The override exists so a test or a relocated checkout can point the monitor at a workspace that
  // is not a fixed number of levels above services.json.
  it('lets WORKSPACE_ROOT override it, resolved to an absolute path', () => {
    process.env.WORKSPACE_ROOT = 'relative/elsewhere';

    expect(loadConfig().workspaceRoot).toBe(path.resolve('relative/elsewhere'));
  });

  it('ignores an empty WORKSPACE_ROOT rather than resolving it to the cwd', () => {
    process.env.WORKSPACE_ROOT = '';

    expect(loadConfig().workspaceRoot).toBe(path.resolve(PROJECT_ROOT, '..'));
  });
});

describe('loadConfig: environment', () => {
  it('has a working default for every variable', () => {
    const config = loadConfig();

    expect(config).toMatchObject({
      port: 2901,
      host: '127.0.0.1',
      bindAll: false,
      behindProxy: false,
      proxyProtocol: 'http',
      domain: 'localhost',
      systemctlScope: 'user',
      pollIntervalMs: 2000,
      probeTimeoutMs: 500,
      logLines: 200,
      authToken: null,
      allowedHosts: []
    });
  });

  it('reads every integer variable', () => {
    process.env.PORT = '3901';
    process.env.POLL_INTERVAL_MS = '60000';
    process.env.PROBE_TIMEOUT_MS = '250';
    process.env.LOG_LINES = '50';
    const config = loadConfig();

    expect(config).toMatchObject({ port: 3901, pollIntervalMs: 60000, probeTimeoutMs: 250, logLines: 50 });
  });

  it.each([
    ['an empty string', ''],
    ['whitespace', '   ']
  ])('treats %s as "not set" and keeps the default', (_label, raw) => {
    process.env.PORT = raw;

    expect(loadConfig().port).toBe(2901);
  });

  // Each variable names *itself* in its own failure. One shared message would send whoever set
  // LOG_LINES=all off to check PORT.
  it.each([['PORT' as const], ['POLL_INTERVAL_MS' as const], ['PROBE_TIMEOUT_MS' as const], ['LOG_LINES' as const]])(
    'refuses %s when it is not an integer, and says which variable it was',
    (name) => {
      process.env[name] = 'often';

      expect(() => loadConfig()).toThrow(`[config] env ${name}="often" is not a valid integer`);
    }
  );

  it.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['TRUE', true],
    [' true ', true],
    ['false', false],
    ['0', false],
    ['no', false]
  ])('reads BEHIND_PROXY=%s as %s', (raw, expected) => {
    process.env.BEHIND_PROXY = raw;

    expect(loadConfig().behindProxy).toBe(expected);
  });

  it.each([
    ['BEHIND_PROXY' as const],
    // BIND_ALL is read through the same parser and is the one whose failure matters most: it
    // decides whether the process leaves loopback at all.
    ['BIND_ALL' as const]
  ])('refuses %s when it is neither, and says which variable it was', (name) => {
    process.env[name] = 'maybe';

    expect(() => loadConfig()).toThrow(`[config] env ${name}="maybe" is not a valid boolean (use true/false)`);
  });

  it.each([
    ['an empty string', ''],
    // Whitespace is what a hand-edited env file leaves behind ("BEHIND_PROXY= "), and it is not
    // the string 'false' — untrimmed it would reach the boolean table and fail the whole startup.
    ['whitespace', '  ']
  ])('reads %s as the default rather than as false', (_label, raw) => {
    process.env.BEHIND_PROXY = raw;

    expect(loadConfig().behindProxy).toBe(false);
  });

  it.each([
    ['user' as const],
    ['system' as const]
  ])('accepts SYSTEMCTL_SCOPE=%s', (scope) => {
    process.env.SYSTEMCTL_SCOPE = scope;

    expect(loadConfig().systemctlScope).toBe(scope);
  });

  it('trims SYSTEMCTL_SCOPE before matching it', () => {
    process.env.SYSTEMCTL_SCOPE = ' system ';

    expect(loadConfig().systemctlScope).toBe('system');
  });

  it('refuses any other scope', () => {
    process.env.SYSTEMCTL_SCOPE = 'session';

    expect(() => loadConfig()).toThrow('[config] env SYSTEMCTL_SCOPE="session" must be "user" or "system"');
  });

  it('reads PROXY_PROTOCOL and DOMAIN, falling back when they are empty', () => {
    process.env.PROXY_PROTOCOL = 'https';
    process.env.DOMAIN = 'status.example.com';
    expect(loadConfig()).toMatchObject({ proxyProtocol: 'https', domain: 'status.example.com' });

    process.env.PROXY_PROTOCOL = '';
    process.env.DOMAIN = '';
    expect(loadConfig()).toMatchObject({ proxyProtocol: 'http', domain: 'localhost' });
  });

  it('reads ALLOWED_HOSTS as a comma-separated list, trimmed and lowercased', () => {
    process.env.ALLOWED_HOSTS = ' Status.LAN , 10.0.0.5 ,,  ';

    expect(loadConfig().allowedHosts).toEqual(['status.lan', '10.0.0.5']);
  });

  it('reads an empty ALLOWED_HOSTS as no extra hosts at all', () => {
    process.env.ALLOWED_HOSTS = '';

    expect(loadConfig().allowedHosts).toEqual([]);
  });

  it('reads an empty AUTH_TOKEN as no token, not as a token of length zero', () => {
    // The distinction matters: `authToken: ''` would make the auth middleware compare every request
    // against the empty string, which timingSafeTokenEquals answers true for on an empty header.
    process.env.AUTH_TOKEN = '';

    expect(loadConfig().authToken).toBeNull();
  });

  it('keeps a real AUTH_TOKEN', () => {
    process.env.AUTH_TOKEN = 'a-real-token';

    expect(loadConfig().authToken).toBe('a-real-token');
  });
});

describe('loadConfig: the BIND_ALL guard', () => {
  /*
   * ⚠️ This page starts and stops production-adjacent units. Binding it beyond loopback with no
   * token is an open door for anyone who can reach the port, and the refusal is at startup on
   * purpose — a check at the first request would leave the door open until someone knocked.
   */
  it('refuses to bind beyond loopback without a token', () => {
    process.env.BIND_ALL = 'true';

    expect(() => loadConfig()).toThrow('[config] BIND_ALL=true requires a non-empty AUTH_TOKEN');
  });

  it('refuses an empty token just as firmly as a missing one', () => {
    process.env.BIND_ALL = 'true';
    process.env.AUTH_TOKEN = '';

    expect(() => loadConfig()).toThrow('refusing to bind beyond 127.0.0.1 without auth');
  });

  it('binds the wildcard once a token is configured', () => {
    process.env.BIND_ALL = 'true';
    process.env.AUTH_TOKEN = 'a-real-token';

    expect(loadConfig()).toMatchObject({ bindAll: true, host: '0.0.0.0' });
  });

  it('binds the configured HOST when there is one', () => {
    process.env.BIND_ALL = 'true';
    process.env.AUTH_TOKEN = 'a-real-token';
    process.env.HOST = '192.168.1.10';

    expect(loadConfig().host).toBe('192.168.1.10');
  });

  /*
   * ⚠️ HOST is consulted only after BIND_ALL has said leaving loopback is safe. A stray
   * HOST=0.0.0.0 left in a shell — the shape of a copy-pasted env — must never widen the bind on
   * its own, because it would do so without ever reaching the token guard above.
   */
  it('ignores HOST entirely while BIND_ALL is false', () => {
    process.env.HOST = '0.0.0.0';

    expect(loadConfig()).toMatchObject({ bindAll: false, host: '127.0.0.1' });
  });

  it('falls back to the wildcard when BIND_ALL is set and HOST is empty', () => {
    process.env.BIND_ALL = 'true';
    process.env.AUTH_TOKEN = 'a-real-token';
    process.env.HOST = '';

    expect(loadConfig().host).toBe('0.0.0.0');
  });
});
