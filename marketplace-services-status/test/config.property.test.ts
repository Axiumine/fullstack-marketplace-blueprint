import fc from 'fast-check';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../src/config';
import { RUN } from './support/arbitraries';

// ---------------------------------------------------------------------------
// services.json and the environment are the two inputs loadConfig() trusts nothing about, and the file
// is hand-edited. `config.test.ts` pins the mistakes somebody has already made; these say what the
// validator must do with a mistake nobody has made yet: take the value if and only if it is valid, and
// otherwise refuse it by name — never throw something else, never pass something half-valid on.
//
// The mocks are `config.test.ts`'s, reduced to what a property needs: `fs` is an in-memory map because
// the path is derived from __dirname and is not a parameter (it keeps `config.test.ts`'s check on the
// encoding argument and drops only its injected read failure), and `dotenv` is a no-op because
// marketplace-services-status/.env holds a live AUTH_TOKEN that would make every run depend on a file
// that is not in the repo.
// ---------------------------------------------------------------------------

const { files } = vi.hoisted(() => ({ files: new Map<string, string>() }));

vi.mock('fs', () => ({
  existsSync: (target: string) => files.has(target),
  readFileSync: (target: string, encoding?: unknown) => {
    // Faithful to node, and load-bearing: omitting the encoding answers a Buffer, not a string, and an unknown
    // one is a TypeError before the file is opened. A mock that ignored the argument would let a dropped
    // 'utf8' pass here, which is exactly what `config.test.ts` guards against.
    if (typeof encoding !== 'string' || !Buffer.isEncoding(encoding)) {
      throw new TypeError(
        `The "options.encoding" property must be a valid string encoding. Received ${JSON.stringify(encoding)}`
      );
    }
    const content = files.get(target);
    if (content === undefined) throw new Error(`ENOENT: no such file or directory, open '${target}'`);
    return content;
  }
}));

vi.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

// The first place findServicesJsonPath looks: one level above src/, which is one level above test/.
const SERVICES_JSON = path.resolve(__dirname, '..', 'services.json');

interface Json {
  [key: string]: unknown;
}

const service = (patch: Json): Json => ({
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

const root = (patch: Json = {}, servicePatch: Json = {}): Json => ({
  workspaceRoot: '..',
  nodeVersion: '24.18.0',
  nvmDir: '~/.nvm',
  unitTarget: 'marketplace.target',
  monitorUnit: 'marketplace-status.service',
  groups: [{ id: 'public', title: 'Public tier', description: 'Anonymous traffic', services: [service(servicePatch)] }],
  ...patch
});

const write = (json: unknown): void => {
  files.set(SERVICES_JSON, JSON.stringify(json));
};

// Every variable loadEnv reads, cleared before each case so a developer's own shell can never decide
// which branch of a guard runs.
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

const clearEnv = (): void => {
  for (const key of ENV_KEYS) delete process.env[key];
};

const setEnv = (name: (typeof ENV_KEYS)[number], value: string | undefined): void => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  clearEnv();
  files.clear();
  write(root());
});

afterEach(() => {
  for (const key of ENV_KEYS) setEnv(key, saved[key]);
});

const isNonEmptyString = (value: unknown): boolean => typeof value === 'string' && value.length > 0;

describe('loadConfig, for any value in services.json', () => {
  const REQUIRED = ['id', 'label', 'repo', 'script', 'path', 'description'];
  const OPTIONAL = ['host', 'healthPath'];
  // The empty string is the value the rule turns on, and a random JSON value is almost never it.
  const anyField = fc.oneof(fc.jsonValue(), fc.constantFrom('', 'x', null, 0));

  it('takes a service string field if and only if it is a non-empty string', () => {
    fc.assert(
      fc.property(fc.constantFrom(...REQUIRED, ...OPTIONAL), anyField, (field, value) => {
        write(root({}, { [field]: value }));

        if (isNonEmptyString(value)) expect(() => loadConfig()).not.toThrow();
        else expect(() => loadConfig()).toThrow(`#groups[0].services[0].${field}: `);
      }),
      RUN
    );
  });

  it('takes a top-level string field if and only if it is a non-empty string', () => {
    fc.assert(
      fc.property(fc.constantFrom('workspaceRoot', 'nodeVersion', 'nvmDir', 'unitTarget', 'monitorUnit'), anyField, (field, value) => {
        write(root({ [field]: value }));

        if (isNonEmptyString(value)) expect(() => loadConfig()).not.toThrow();
        else expect(() => loadConfig()).toThrow(`#${field}: `);
      }),
      RUN
    );
  });

  it('carries the identifying fields of a valid service through unchanged', () => {
    const text = fc.string({ minLength: 1 });

    fc.assert(
      fc.property(text, text, text, text, (id, label, repo, description) => {
        write(root({}, { id, label, repo, description }));

        const [loaded] = loadConfig().services;
        expect(loaded).toMatchObject({ id, unit: `${id}.service`, label, repo, description });
      }),
      RUN
    );
  });

  // Any number can be written into the file, but a socket can only bind a whole number in [0, 65535] —
  // and `null`, not omission, is how a service says it listens on nothing. Anything else reaching
  // net.Socket#connect throws synchronously and, before this was validated, took the whole page down.
  it('takes a port if and only if it is null or a whole number a socket can bind', () => {
    const anything = fc.oneof(
      fc.jsonValue(),
      fc.constant(null),
      fc.integer({ min: -10, max: 70_000 }),
      fc.constantFrom(-1, 0, 1, 65535, 65536, 1.5),
      fc.double({ noNaN: true, noDefaultInfinity: true })
    );

    fc.assert(
      fc.property(anything, (value) => {
        write(root({}, { port: value }));
        // What the file really holds: JSON has no -0, and writes a double out in its shortest spelling.
        const sent: unknown = JSON.parse(JSON.stringify(value));
        const bindable = sent === null || (typeof sent === 'number' && Number.isInteger(sent) && sent >= 0 && sent <= 65535);

        if (bindable) {
          const [loaded] = loadConfig().services;
          expect(loaded.port).toBe(sent);
          expect(loaded.url === null).toBe(sent === null);
        } else {
          expect(() => loadConfig()).toThrow('#groups[0].services[0].port: ');
        }
      }),
      RUN
    );
  });

  it('takes a kind if and only if it is backend or frontend', () => {
    fc.assert(
      fc.property(fc.oneof(fc.jsonValue(), fc.constantFrom('backend', 'frontend', 'Backend', 'worker')), (kind) => {
        write(root({}, { kind }));

        if (kind === 'backend' || kind === 'frontend') expect(loadConfig().services[0].kind).toBe(kind);
        else expect(() => loadConfig()).toThrow('#groups[0].services[0].kind: ');
      }),
      RUN
    );
  });
});

describe('loadConfig, for any environment', () => {
  const padding = fc.constantFrom('', ' ', '\t');
  const spelled = (words: string[]): fc.Arbitrary<string> =>
    fc.tuple(padding, fc.mixedCase(fc.constantFrom(...words)), padding).map(([before, word, after]) => `${before}${word}${after}`);
  const switchedOn = spelled(['true', '1', 'yes']);
  const switchedOff = fc.oneof(spelled(['false', '0', 'no']), fc.constantFrom(undefined, '', '  '));
  const token = fc.option(fc.string(), { nil: undefined });

  // BIND_ALL gates HOST, not the other way round: a stray HOST=0.0.0.0 left in the environment must
  // never widen the bind on its own.
  it('binds 127.0.0.1 whatever HOST and AUTH_TOKEN say, unless BIND_ALL is switched on', () => {
    fc.assert(
      fc.property(switchedOff, fc.option(fc.string(), { nil: undefined }), token, (bindAll, host, authToken) => {
        clearEnv();
        setEnv('BIND_ALL', bindAll);
        setEnv('HOST', host);
        setEnv('AUTH_TOKEN', authToken);

        const config = loadConfig();
        expect(config.host).toBe('127.0.0.1');
        // '' is "no auth configured", not an empty credential for the middleware to compare requests against.
        expect(config.authToken).toBe(authToken === undefined || authToken === '' ? null : authToken);
      }),
      RUN
    );
  });

  // This page starts and stops production-adjacent processes. An empty token is "no auth configured",
  // not a credential, so it must not satisfy the guard — a bind beyond loopback with no token is refused
  // at startup rather than at the first unauthenticated request.
  it('refuses BIND_ALL without a non-empty AUTH_TOKEN, and binds HOST once there is one', () => {
    fc.assert(
      fc.property(switchedOn, fc.option(fc.string(), { nil: undefined }), token, (bindAll, host, authToken) => {
        clearEnv();
        setEnv('BIND_ALL', bindAll);
        setEnv('HOST', host);
        setEnv('AUTH_TOKEN', authToken);

        if (authToken === undefined || authToken === '') {
          expect(() => loadConfig()).toThrow('BIND_ALL=true requires a non-empty AUTH_TOKEN');
        } else {
          const config = loadConfig();
          expect(config.authToken).toBe(authToken);
          expect(config.host).toBe(host || '0.0.0.0');
        }
      }),
      RUN
    );
  });
});
