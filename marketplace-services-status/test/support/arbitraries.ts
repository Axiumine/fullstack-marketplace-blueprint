/**
 * The generators and the run budget the three `*.property.test.ts` suites share.
 *
 * Indentation: this file and the three suites are two spaces, like every other file of this package. The package
 * carries no eslint or prettier (ADR-025), so nothing enforces it: a file you add here follows it by hand.
 */
import fc from 'fast-check';

/**
 * Cases per property: twice fast-check's default of 100, this repo's own choice. It is deliberately a
 * constant rather than a read of the environment: the mutation gate re-runs every covering test once per
 * mutant, so a budget that moved between runs would move the gate's duration with it. A failing run prints
 * its seed and path, which is how a counterexample is replayed.
 */
export const RUN = { numRuns: 200 };

/** `a` to `z` and nothing else, for the fields whose shape does not matter to the rule under test. */
export const lowercase = (minLength: number, maxLength: number): fc.Arbitrary<string> =>
  fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), minLength, maxLength });

/**
 * A dotted, lowercase DNS name. `fc.domain()` is used as it is, because what it emits is what these guards
 * must cope with: labels of letters, digits and inner hyphens, and a last label of two or more letters.
 *
 * Three facts about it carry the properties, so each is stated rather than assumed:
 * - the last label is letters only, so the name can never read as an IPv4 literal, and it always has a dot
 *   and a letter, so it can never be `localhost` or `127.0.0.1`, the loopback names every allowlist holds;
 * - its labels are filtered so none starts with `xn--`, so the URL parser never treats one as punycode and
 *   "the host is on the allowlist" and "the origin parsed" stay one question (the first property of
 *   `guards.property.test.ts` pins this against the parser itself, so a fast-check upgrade that changed it
 *   fails loudly instead of flaking elsewhere);
 * - it is already lowercase, so a name that went through the parser compares equal to the one that went in.
 *
 * What it does NOT promise is that it never equals a fixed name a property reserves (`status.example` in
 * `assertSameOrigin`): a property that needs "different from X" says so with its own `.filter`.
 */
export const hostname: fc.Arbitrary<string> = fc.domain();

/**
 * An IPv6 literal in the one spelling the URL parser hands back unchanged: lowercase, zeros compressed, any
 * trailing dotted IPv4 rewritten as hex. `fc.ipV6()` alone emits `0::8c:5:249.251.6.219` and `ABCD::1`, and the
 * parser rewrites both, so an address "on the allowlist" and the same address "parsed out of an Origin" would
 * stop being one question — the failure `hostname` is built to rule out, for the other kind of host. The
 * parser is the oracle here and the code under test is not: this file imports nothing from `src/`.
 *
 * It does reach `::1` and `::` (the generator draws them now and then), both of which a property that
 * involves the loopback names has to expect.
 */
export const ipv6: fc.Arbitrary<string> = fc.ipV6().map((address) => new URL(`http://[${address}]`).hostname.slice(1, -1));

/** Any TCP port, `0` and `65535` included. */
export const port: fc.Arbitrary<number> = fc.integer({ min: 0, max: 65535 });
