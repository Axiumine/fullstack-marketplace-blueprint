import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  assertSameOrigin,
  assertTrustedHost,
  buildTrustedHosts,
  extractToken,
  hostnameOnly,
  isAction,
  isPlainObject,
  isTrustedOrigin,
  stripIpv6Brackets
} from '../src/server';
import { hostname, ipv6, lowercase, port, RUN } from './support/arbitraries';

// ---------------------------------------------------------------------------
// The request guards of src/server.ts, stated as rules rather than as cases.
//
// `server.test.ts` pins the inputs somebody thought of. These guards sit between the network and a
// `systemctl` argv, and the inputs that matter most are the ones nobody thought of — so each test
// below says what must hold for EVERY input, and fast-check goes looking for the one that breaks it.
// A failure prints its seed and shrunk counterexample; replay it with `fc.assert(..., { seed, path })`.
//
// Nothing here replaces an example test, and none of it is needed to reach 100% — the example suites
// already do. What it adds is the question the percentages cannot ask: not "did this line run" but
// "is there any input at all for which this line answers wrong".
//
// ⚠️ The `fast-check` import above is also what OpenSSF Scorecard's Fuzzing check looks for (ADR-054): a
// static `import … from 'fast-check'` in a `.ts` file of the parent repository's own tree. Keep it static,
// and keep these suites here — a sub-repo's files are not in the tarball Scorecard reads.
// ---------------------------------------------------------------------------

const LOOPBACK = ['127.0.0.1', 'localhost', '::1'];
const WILDCARDS = ['0.0.0.0', '::'];
const VERBS = ['start', 'stop', 'restart'];

/** The names whoever deploys the panel would put in ALLOWED_HOSTS. */
const allowlist = fc.uniqueArray(hostname, { minLength: 1, maxLength: 4 });
// The name under test is either one the list holds or a fresh one. Left to chance, a random name almost
// never lands on the list and the "trusted" half of every rule below would go unexercised.
const listAndProbe = allowlist.chain((allowed) => fc.tuple(fc.constant(allowed), fc.oneof(hostname, fc.constantFrom(...allowed))));
const trustedBy = (allowedHosts: string[]): ReadonlySet<string> => buildTrustedHosts({ domain: '', host: '', allowedHosts });
// How a client writes a host into a Host header or an Origin: an IPv6 literal in brackets, anything else as it is.
const written = (name: string): string => (name.includes(':') ? `[${name}]` : name);

describe('the hostname generator, which every rule below leans on', () => {
  // If this fails the generator is wrong, not the guards: a name the URL parser rewrites would make "on the
  // allowlist" and "parsed as an origin" two different questions (see test/support/arbitraries.ts).
  it('emits names the URL parser hands back unchanged, in either case', () => {
    fc.assert(
      fc.property(hostname, fc.constantFrom('http', 'https'), fc.boolean(), (name, scheme, shout) => {
        expect(new URL(`${scheme}://${shout ? name.toUpperCase() : name}`).hostname).toBe(name);
      }),
      RUN
    );
  });

  // Same promise for IPv6: the parser hands the generated address back as it went in, so what the allowlist
  // holds and what an Origin parses to can only differ by the brackets, which is what the guards undo.
  it('emits IPv6 literals the URL parser hands back unchanged, in either case', () => {
    fc.assert(
      fc.property(ipv6, fc.constantFrom('http', 'https'), fc.boolean(), (address, scheme, shout) => {
        expect(new URL(`${scheme}://[${shout ? address.toUpperCase() : address}]`).hostname).toBe(`[${address}]`);
      }),
      RUN
    );
  });
});

describe('hostnameOnly, for any input', () => {
  it('strips a port and lowercases a name, however the client capitalised it', () => {
    fc.assert(
      fc.property(hostname, port, fc.boolean(), (host, p, shout) => {
        const sent = shout ? host.toUpperCase() : host;

        expect(hostnameOnly(`${sent}:${p}`)).toBe(host);
        expect(hostnameOnly(sent)).toBe(host);
      }),
      RUN
    );
  });

  it('unwraps a bracketed IPv6 literal, with a port or without one', () => {
    fc.assert(
      fc.property(fc.ipV6(), port, fc.boolean(), (ip, p, shout) => {
        const sent = shout ? ip.toUpperCase() : ip;

        expect(hostnameOnly(`[${sent}]:${p}`)).toBe(ip.toLowerCase());
        expect(hostnameOnly(`[${sent}]`)).toBe(ip.toLowerCase());
      }),
      RUN
    );
  });

  // A suffix that is not all digits belongs to the name. Cutting it would make `host:abc` and `host:xyz`
  // the same host, which is the collision an allowlist lookup must never be able to produce.
  it('keeps everything after a colon that is not a port', () => {
    fc.assert(
      fc.property(hostname, lowercase(1, 8), (host, suffix) => {
        expect(hostnameOnly(`${host}:${suffix}`)).toBe(`${host}:${suffix}`);
      }),
      RUN
    );
  });

  it('answers any string at all, and never with an ASCII capital', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (header) => {
        expect(hostnameOnly(header)).not.toMatch(/[A-Z]/);
      }),
      RUN
    );
  });
});

describe('stripIpv6Brackets, for any input', () => {
  const inner = fc.string({ minLength: 1, maxLength: 12 });

  it('removes exactly one enclosing pair, whatever is inside', () => {
    fc.assert(
      fc.property(inner, (text) => {
        expect(stripIpv6Brackets(`[${text}]`)).toBe(text);
      }),
      RUN
    );
  });

  // A name is returned as it came unless it starts with `[` AND ends with `]`. The oracle is that sentence, not the
  // code's regex: a half-bracketed or middle-bracketed string turned into a different string is a different host.
  it('answers every string that is not bracketed at both ends with that same string', () => {
    const notBracketed = fc
      .oneof(
        fc.string(),
        fc.tuple(inner, inner).map(([a, b]) => `${a}[${b}]${a}`)
      )
      .filter((text) => !(text.startsWith('[') && text.endsWith(']')));
    const halves = ['[', ']', '[::1', '::1]', 'x[::1]', '[::1]x', 'a[b]c', ''];

    fc.assert(
      fc.property(notBracketed, (text) => {
        expect(stripIpv6Brackets(text)).toBe(text);
      }),
      { ...RUN, examples: halves.map((text): [string] => [text]) }
    );
  });
});

describe('buildTrustedHosts, for any config', () => {
  const config = fc.record({
    domain: fc.oneof(fc.constant(''), hostname),
    host: fc.oneof(fc.constant(''), hostname, fc.constantFrom(...WILDCARDS)),
    allowedHosts: fc.array(hostname, { maxLength: 4 })
  });

  it('trusts the loopback names and every name it was given', () => {
    fc.assert(
      fc.property(config, (given) => {
        const hosts = buildTrustedHosts(given);

        for (const name of [...LOOPBACK, ...given.allowedHosts]) expect(hosts.has(name)).toBe(true);
        if (given.domain) expect(hosts.has(given.domain)).toBe(true);
        if (given.host && !WILDCARDS.includes(given.host)) expect(hosts.has(given.host)).toBe(true);
      }),
      RUN
    );
  });

  // A wildcard bind address is what the server listens on, not a name a browser ever sends. Trusting a
  // literal `Host: 0.0.0.0` would be the one entry that BIND_ALL=true adds for free.
  it('trusts nothing it was not given, the wildcard bind addresses least of all', () => {
    fc.assert(
      fc.property(config, (given) => {
        const hosts = buildTrustedHosts(given);
        const named = [...LOOPBACK, given.domain, given.host, ...given.allowedHosts];

        for (const name of hosts) expect(named).toContain(name);
        for (const wildcard of WILDCARDS) expect(hosts.has(wildcard)).toBe(false);
      }),
      RUN
    );
  });
});

describe('isTrustedOrigin, for any origin', () => {
  // Port is deliberately not compared (the page is :2901 directly and :443 behind nginx), and neither
  // is the scheme or the path. If any of them ever started to decide, a trusted host would stop being
  // trusted on one spelling of its own address.
  it('decides on the hostname alone — never the scheme, the port or the path', () => {
    fc.assert(
      fc.property(
        listAndProbe,
        fc.constantFrom('http', 'https'),
        port,
        lowercase(0, 8),
        fc.boolean(),
        ([allowed, probe], scheme, p, segment, shout) => {
          const sent = shout ? probe.toUpperCase() : probe;

          expect(isTrustedOrigin(`${scheme}://${sent}:${p}/${segment}`, trustedBy(allowed))).toBe(allowed.includes(probe));
        }
      ),
      RUN
    );
  });

  it('trusts nothing when the allowlist is empty, and never throws on the way to saying so', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string({ unit: 'binary' }), fc.webUrl()), (origin) => {
        expect(isTrustedOrigin(origin, new Set())).toBe(false);
      }),
      RUN
    );
  });
});

// The two guards read one address from two places: the Host header says it as text ("[::1]:2901") and an Origin says it
// as a URL, whose hostname keeps the brackets of an IPv6 literal. Both answer for the same allowlist, so for the same
// address they must give the same answer — a page that may be served at an address has to be able to POST from it.
describe('the Host header and the Origin of one address, for any allowlist', () => {
  type Case = [[string[], string], 'http' | 'https', number | undefined, boolean];

  const anyHost = fc.oneof(hostname, ipv6, fc.constantFrom(...LOOPBACK));
  // Half the probes come off the list, so the "trusted" arm is exercised and not left to a chance meeting.
  const listAndAnyProbe = fc
    .uniqueArray(anyHost, { minLength: 1, maxLength: 4 })
    .chain((allowed) => fc.tuple(fc.constant(allowed), fc.oneof(anyHost, fc.constantFrom(...allowed))));
  // The ones a random address almost never is: the loopback the page is normally reached at, an address on the list and
  // its neighbour, and a name that merely sits beside a bracketed one. Run first, on every run.
  const examples: Case[] = [
    [[['status.example'], '::1'], 'http', 2901, false],
    [[['status.example'], '::1'], 'https', undefined, true],
    [[['fe80::1'], 'fe80::1'], 'http', 80, true],
    [[['fe80::1'], 'fe80::2'], 'http', 80, false],
    [[['status.example'], '::2'], 'http', 2901, false]
  ];

  it('trust the same addresses: the Origin built from a host is trusted exactly when its Host header is admitted', () => {
    fc.assert(
      fc.property(
        listAndAnyProbe,
        fc.constantFrom<'http' | 'https'>('http', 'https'),
        fc.option(port, { nil: undefined }),
        fc.boolean(),
        ([allowed, probe], scheme, p, shout) => {
          const trusted = trustedBy(allowed);
          const sent = written(shout ? probe.toUpperCase() : probe);
          const hostHeader = p === undefined ? sent : `${sent}:${p}`;
          // The oracle is the list in hand, never the code's own set: the loopback names are trusted whatever the
          // list says, and anything else only when it is on it.
          const expected = LOOPBACK.includes(probe) || allowed.includes(probe);

          expect(assertTrustedHost(hostHeader, trusted).allowed).toBe(expected);
          expect(isTrustedOrigin(`${scheme}://${hostHeader}`, trusted)).toBe(expected);
        }
      ),
      { ...RUN, examples }
    );
  });

  // Undoing the brackets must not turn into finding a bracketed address anywhere in the string. The host of a URL is
  // what follows the last `@` of its authority, so a trusted literal in the userinfo, the path, the query or the
  // fragment names nothing: only the foreign name does. (`hostname` never emits a name holding a colon, so the foreign
  // name cannot be the address on the list or a loopback name, and the answer is "no" by construction.)
  it('lends no trust to a trusted address that is only mentioned, never the host', () => {
    fc.assert(
      fc.property(ipv6, hostname, port, (address, foreign, p) => {
        const trusted = trustedBy([address]);
        const mentioned = [
          `http://[${address}]@${foreign}`,
          `http://[${address}]:${p}@${foreign}`,
          `http://${foreign}:${p}/[${address}]`,
          `https://${foreign}/?[${address}]`,
          `https://${foreign}/#[${address}]`
        ];

        for (const origin of mentioned) expect(isTrustedOrigin(origin, trusted)).toBe(false);
        expect(isTrustedOrigin(`http://[${address}]:${p}/`, trusted)).toBe(true);
      }),
      RUN
    );
  });
});

describe('assertTrustedHost, for any Host header', () => {
  it('refuses a missing or empty header whatever the allowlist holds', () => {
    fc.assert(
      fc.property(allowlist, fc.constantFrom(undefined, ''), (allowed, header) => {
        expect(assertTrustedHost(header, trustedBy(allowed))).toEqual({ allowed: false, reason: 'missing Host header' });
      }),
      RUN
    );
  });

  it('admits a Host exactly when its name, port aside, is on the allowlist — and names the host it refuses', () => {
    fc.assert(
      fc.property(listAndProbe, fc.option(port, { nil: undefined }), ([allowed, probe], p) => {
        const verdict = assertTrustedHost(p === undefined ? probe : `${probe}:${p}`, trustedBy(allowed));

        expect(verdict.allowed).toBe(allowed.includes(probe));
        if (!verdict.allowed) expect(verdict.reason).toContain(`"${probe}"`);
      }),
      RUN
    );
  });
});

describe('assertSameOrigin, for any pair of headers', () => {
  const hosts = buildTrustedHosts({ domain: 'status.example', host: '127.0.0.1', allowedHosts: [] });
  // A generated name is a stranger by construction: fc.domain() could in principle emit the trusted
  // domain itself, and then "a foreign host is refused" would be a claim the code is right to fail.
  const foreign = hostname.filter((name) => !hosts.has(name));
  const origin = fc.oneof(
    fc.constant('http://status.example'),
    foreign.map((name) => `https://${name}`)
  );
  const optionalHeader = fc.option(fc.oneof(origin, fc.string()), { nil: undefined });

  // With no Origin and no Referer there is nothing to compare, so the token is the whole decision. An
  // empty string is "absent" too: ctx.get() answers '' for a header the client never sent.
  it('lets the token decide when, and only when, neither header was sent', () => {
    fc.assert(
      fc.property(fc.constantFrom(undefined, ''), fc.constantFrom(undefined, ''), fc.boolean(), (originHeader, referer, token) => {
        expect(assertSameOrigin(originHeader, referer, hosts, token).allowed).toBe(token);
      }),
      RUN
    );
  });

  // A tricked browser can be made to send a request; it cannot be made to know the token. So once a
  // header names a foreign host, holding the token must not turn the refusal into an acceptance.
  it('never lets a valid token overrule an Origin or Referer naming a foreign host', () => {
    fc.assert(
      fc.property(foreign, fc.constantFrom('origin', 'referer'), fc.boolean(), (name, header, token) => {
        const sent = `https://${name}/page`;
        const verdict =
          header === 'origin' ? assertSameOrigin(sent, undefined, hosts, token) : assertSameOrigin(undefined, sent, hosts, token);

        expect(verdict.allowed).toBe(false);
      }),
      RUN
    );
  });

  // Origin wins outright: trusting whichever of the two happens to be on the list would let an
  // attacking page pass on the weaker header.
  it('ignores the Referer completely once an Origin was sent', () => {
    fc.assert(
      fc.property(origin, optionalHeader, optionalHeader, fc.boolean(), (sent, referer, otherReferer, token) => {
        expect(assertSameOrigin(sent, referer, hosts, token)).toEqual(assertSameOrigin(sent, otherReferer, hosts, token));
      }),
      RUN
    );
  });
});

describe('extractToken, for any credential', () => {
  const secret = fc.string({ minLength: 1 }).filter((text) => text === text.trim());
  const padding = fc.constantFrom('', ' ', '   ');
  const bearer = fc.tuple(fc.mixedCase(fc.constant('bearer')), padding, secret, padding).map(([scheme, before, token, after]) => ({
    header: `${scheme} ${before}${token}${after}`,
    token
  }));
  const optional = fc.option(fc.string(), { nil: undefined });

  it('reads a Bearer token out of the header, in any casing and with any padding', () => {
    fc.assert(
      fc.property(bearer, ({ header, token }) => {
        expect(extractToken(header, undefined)).toBe(token);
      }),
      RUN
    );
  });

  it('prefers the header to the query parameter', () => {
    fc.assert(
      fc.property(bearer, optional, ({ header, token }, query) => {
        expect(extractToken(header, query)).toBe(token);
      }),
      RUN
    );
  });

  // The scheme is "bearer", one space, then the token. `Bearer` glued straight to its token, or followed by any
  // other separator, is a different scheme and carries no credential — reading it as one would hand the
  // middleware a token cut from the wrong offset. The oracle is the pattern, not the code's own startsWith.
  it('reads no token out of a header that is not "Bearer " plus a token, and falls back to the query', () => {
    const joint = fc.constantFrom('', '\t', '\n', '\u00a0', '-', ':', 's', 'x', '0');
    const notBearer = fc
      .oneof(
        fc.tuple(fc.mixedCase(fc.constant('bearer')), joint, secret).map(([scheme, glue, token]) => `${scheme}${glue}${token}`),
        fc.string()
      )
      .filter((header) => !/^bearer /i.test(header));
    // Named as well as generated: the glue is one of nine, so say which spellings every run must try.
    const spellings = ['bearertoken', 'Bearer\ttoken', 'BEARER:token', 'bearers token', 'Bearer\u00a0token'];
    const examples = spellings.map((header): [string, string] => [header, 'query']);

    fc.assert(
      fc.property(notBearer, secret, (header, query) => {
        expect(extractToken(header, undefined)).toBeNull();
        expect(extractToken(header, query)).toBe(query);
      }),
      { ...RUN, examples }
    );
  });

  it('falls back to a non-empty query parameter when the header holds no Bearer token', () => {
    fc.assert(
      fc.property(secret, fc.constantFrom(undefined, '', 'Basic abc', 'Bearer ', 'Bearer    '), (query, header) => {
        expect(extractToken(header, query)).toBe(query);
      }),
      RUN
    );
  });

  // The failure this rules out is an empty string coming back as a credential: timingSafeEqual against
  // an empty secret would answer true for it.
  it('answers null or a non-empty string, never an empty credential', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constantFrom('Bearer ', 'bearer    ', 'BEARER \t')), optional, (header, query) => {
        const token = extractToken(header, query);

        expect(token === null || token.length > 0).toBe(true);
      }),
      RUN
    );
  });
});

describe('the frame validators, for any value', () => {
  // :action goes straight into systemctl's argv, so this allowlist is the whole defence — exactly the
  // three verbs, in exactly that casing, and only as strings. The oracle is VERBS above, never the code's
  // own set, so a fourth verb added to the code is a failure here. A random string almost never lands on a
  // real systemctl verb, so the ones that matter are named and tried on every run (`examples`), and the
  // generator adds the ways one of the three can be nearly spelled.
  it('isAction admits the three verbs and nothing else', () => {
    const notActions = [
      // The rest of systemctl's vocabulary, which is what a fourth entry in the allowlist would most likely be:
      // each one acts on a unit, none is ours to offer. A verb that is on no list here (an unnamed fourth one)
      // is beyond any generator, so extend this list when systemctl grows a verb or a reviewer thinks of one.
      ...['status', 'kill', 'clean', 'freeze', 'thaw', 'isolate', 'enable', 'disable', 'reenable', 'mask', 'unmask', 'preset'],
      ...['reload', 'try-restart', 'reload-or-restart', 'try-reload-or-restart', 'reload-or-try-restart', 'force-reload'],
      ...['daemon-reload', 'daemon-reexec', 'reset-failed', 'set-property', 'edit', 'link', 'revert', 'bind', 'mount-image'],
      ...['show', 'cat', 'help', 'is-active', 'is-enabled', 'is-failed', 'list-units', 'list-dependencies'],
      ...['default', 'rescue', 'emergency', 'halt', 'poweroff', 'reboot', 'kexec', 'exit', 'suspend', 'hibernate'],
      ...['pause', 'resume', 'run', 'exec'],
      // A real verb with something wrong about it.
      ...['', 'start ', ' start', 'start\n', '\tstop', 'restart\0', 'Start', 'STOP', 'ReStart', 'restarts', 'star', 'estart'],
      ...['stop,start', 'start stop', 'start;stop', '--now']
    ];
    const nearMiss = fc.oneof(
      fc.constantFrom(...notActions),
      fc.mixedCase(fc.constantFrom(...VERBS)),
      // One character of a real verb replaced, dropped or doubled, and junk glued to either end of one.
      fc
        .tuple(fc.constantFrom(...VERBS), fc.nat(8), fc.string({ maxLength: 2 }))
        .map(([verb, at, junk]) => verb.slice(0, at) + junk + verb.slice(at + 1)),
      fc
        .tuple(fc.string({ maxLength: 2 }), fc.constantFrom(...VERBS), fc.string({ maxLength: 2 }))
        .map(([before, verb, after]) => `${before}${verb}${after}`)
    );

    fc.assert(
      fc.property(fc.oneof(fc.constantFrom(...VERBS), nearMiss, fc.string(), fc.anything()), (value) => {
        expect(isAction(value)).toBe(typeof value === 'string' && VERBS.includes(value));
      }),
      { ...RUN, examples: [...VERBS, ...notActions].map((value): [unknown] => [value]) }
    );
  });

  // A WebSocket frame is parsed JSON, so this is the set of values a stranger can actually put there.
  it('isPlainObject agrees with the JSON type of the value', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (value) => {
        expect(isPlainObject(value)).toBe(Object.prototype.toString.call(value) === '[object Object]');
      }),
      RUN
    );
  });
});
