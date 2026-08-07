import { describe, expect, it } from 'vitest';

import { assertSameOrigin, assertTrustedHost, buildTrustedHosts, hostnameOnly, isTrustedOrigin } from '../src/server';

// ---------------------------------------------------------------------------
// Unit level — the pure guards, imported straight from src/ and called directly.
//
// The other half of this suite — a real server process driven over a real socket — is
// `security.live.test.ts`. It was split out because it runs `dist/`, which puts it out of
// reach of both coverage and mutation; the header of that file explains what that costs.
// ---------------------------------------------------------------------------

describe('hostnameOnly', () => {
  it.each([
    ['127.0.0.1:2901', '127.0.0.1'],
    ['127.0.0.1', '127.0.0.1'],
    ['[::1]:2901', '::1'],
    ['[::1]', '::1'],
    ['Status.LAN:8080', 'status.lan'],
    // A trailing colon-group that is not numeric is part of the name, not a port — stripping it
    // would silently widen the allowlist to a host nobody configured.
    ['example.com:notaport', 'example.com:notaport']
  ])('%s -> %s', (input, expected) => {
    expect(hostnameOnly(input)).toBe(expected);
  });
});

describe('buildTrustedHosts', () => {
  const base = { domain: '', host: '', allowedHosts: [] as string[] };

  it('always trusts the loopback names', () => {
    const hosts = buildTrustedHosts(base);
    expect(hosts.has('127.0.0.1')).toBe(true);
    expect(hosts.has('localhost')).toBe(true);
    expect(hosts.has('::1')).toBe(true);
  });

  it('adds DOMAIN and HOST, lowercased', () => {
    const hosts = buildTrustedHosts({ ...base, domain: 'Status.Example.COM', host: '192.168.1.10' });
    expect(hosts.has('status.example.com')).toBe(true);
    expect(hosts.has('192.168.1.10')).toBe(true);
  });

  it('never trusts a wildcard bind address as a name', () => {
    // A browser never sends Host: 0.0.0.0; trusting it would only ever help an attacker.
    expect(buildTrustedHosts({ ...base, host: '0.0.0.0' }).has('0.0.0.0')).toBe(false);
    expect(buildTrustedHosts({ ...base, host: '::' }).has('::')).toBe(false);
  });

  it('adds ALLOWED_HOSTS entries', () => {
    const hosts = buildTrustedHosts({ ...base, allowedHosts: ['status.lan', '10.0.0.5'] });
    expect(hosts.has('status.lan')).toBe(true);
    expect(hosts.has('10.0.0.5')).toBe(true);
  });
});

describe('assertTrustedHost', () => {
  const trusted = buildTrustedHosts({ domain: 'status.example.com', host: '', allowedHosts: [] });

  it('accepts a configured host, with or without a port', () => {
    expect(assertTrustedHost('127.0.0.1:2901', trusted).allowed).toBe(true);
    expect(assertTrustedHost('status.example.com', trusted).allowed).toBe(true);
  });

  it('rejects an unknown host — this is the DNS-rebinding defense', () => {
    const decision = assertTrustedHost('evil.example:2901', trusted);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('ALLOWED_HOSTS');
  });

  it('rejects a missing Host header outright', () => {
    expect(assertTrustedHost(undefined, trusted).allowed).toBe(false);
  });
});

describe('isTrustedOrigin', () => {
  const trusted = buildTrustedHosts({ domain: '', host: '', allowedHosts: [] });

  it('accepts an origin whose host is trusted', () => {
    expect(isTrustedOrigin('http://127.0.0.1:2901', trusted)).toBe(true);
  });

  it('rejects an untrusted host', () => {
    expect(isTrustedOrigin('https://evil.example', trusted)).toBe(false);
  });

  it('rejects an unparsable origin instead of throwing', () => {
    expect(isTrustedOrigin('not a url', trusted)).toBe(false);
    expect(isTrustedOrigin('', trusted)).toBe(false);
  });
});

describe('assertSameOrigin', () => {
  const trusted = buildTrustedHosts({ domain: '', host: '', allowedHosts: [] });

  it('accepts a trusted Origin', () => {
    expect(assertSameOrigin('http://127.0.0.1:2901', undefined, trusted, false).allowed).toBe(true);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(assertSameOrigin(undefined, 'http://127.0.0.1:2901/', trusted, false).allowed).toBe(true);
  });

  it('rejects a cross-site Origin even when a valid token is present', () => {
    // A token does not launder a forged origin: the browser attached that Origin, and the token
    // may simply have been sitting in the page URL of a tab the attacker got the victim to open.
    expect(assertSameOrigin('https://evil.example', undefined, trusted, true).allowed).toBe(false);
  });

  it('allows a header-less request only when a valid token is presented', () => {
    expect(assertSameOrigin(undefined, undefined, trusted, true).allowed).toBe(true);
    expect(assertSameOrigin(undefined, undefined, trusted, false).allowed).toBe(false);
  });
});
