/**
 * `docs/REVIEW-DETAILED.md` SEC-05 - ARCHITECTURE.md §16.1 requires
 * "Security headers + strict CSP", and before 2026-08-31 a case-insensitive
 * search for every one of those header names across the whole repository
 * returned nothing.
 *
 * These tests pin the *policy*, not the plumbing: which directives exist,
 * which relaxations are allowed and in which environment, and - the part
 * that is easy to get subtly, silently wrong - that Next.js's own parser can
 * actually extract the nonce we generate. A CSP that the framework cannot
 * read a nonce out of does not fail loudly; it just quietly stops applying
 * the nonce to the framework's own scripts, and every script on the page is
 * then blocked.
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import {
  baseSecurityHeaders,
  buildContentSecurityPolicy,
  cspHeaderName,
  generateNonce,
  resolveCspMode,
} from '@/server/security/headers';

/**
 * Next's real extractor, imported from the installed package rather than
 * re-implemented here. If a Next upgrade changes how it reads the nonce,
 * this test is meant to fail - that is the signal we want, and the reason
 * for reaching into `dist/` deliberately (`node_modules/next/dist/server/
 * app-render/app-render.js:209-210` is the only caller).
 */
const require = createRequire(import.meta.url);
const { getScriptNonceFromHeader } = require(
  'next/dist/server/app-render/get-script-nonce-from-header.js',
) as { getScriptNonceFromHeader: (csp: string) => string | undefined };

function directive(csp: string, name: string): string {
  const found = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  if (found === undefined) {
    throw new Error(`CSP has no "${name}" directive: ${csp}`);
  }
  return found;
}

const NONCE = 'dGVzdC1ub25jZS0xMjM0';

describe('generateNonce - unguessable, single-use, and readable by Next', () => {
  it('never repeats', () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateNonce()));
    expect(seen.size).toBe(500);
  });

  it('carries at least 128 bits of entropy', () => {
    // 16 random bytes, base64 -> 24 characters (22 + padding).
    expect(generateNonce().length).toBeGreaterThanOrEqual(22);
  });

  it('matches the character set Next’s own extractor accepts', () => {
    // CSP_NONCE_SOURCE_REGEX in get-script-nonce-from-header.js.
    for (let i = 0; i < 200; i += 1) {
      expect(generateNonce()).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
    }
  });

  it('round-trips through Next’s extractor out of a real policy string', () => {
    const nonce = generateNonce();
    const csp = buildContentSecurityPolicy({ nonce, isDev: false, isSecure: true });
    expect(getScriptNonceFromHeader(csp)).toBe(nonce);
  });
});

describe('buildContentSecurityPolicy - script execution', () => {
  it('allows scripts only by nonce, never by ‘unsafe-inline’', () => {
    for (const isDev of [true, false]) {
      const scriptSrc = directive(
        buildContentSecurityPolicy({ nonce: NONCE, isDev, isSecure: true }),
        'script-src',
      );
      expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    }
  });

  it("carries 'strict-dynamic' so router-injected chunks inherit the nonce’s trust", () => {
    expect(directive(buildContentSecurityPolicy({ nonce: NONCE, isDev: false, isSecure: true }), 'script-src')).toContain(
      "'strict-dynamic'",
    );
  });

  it("allows 'unsafe-eval' in development only", () => {
    // React uses eval in dev to rebuild server stacks in the browser; it
    // does not in production (Next's own CSP guide says so explicitly).
    expect(directive(buildContentSecurityPolicy({ nonce: NONCE, isDev: true, isSecure: true }), 'script-src')).toContain(
      "'unsafe-eval'",
    );
    expect(directive(buildContentSecurityPolicy({ nonce: NONCE, isDev: false, isSecure: true }), 'script-src')).not.toContain(
      "'unsafe-eval'",
    );
  });
});

describe('buildContentSecurityPolicy - styles', () => {
  /**
   * The deliberate relaxation. Emotion injects `<style>` elements from the
   * browser for anything not already server-rendered, and MUI is mounted
   * from `error.tsx` boundaries too - which React renders with no props of
   * our own, so no nonce can ever reach them. `'unsafe-inline'` for styles
   * is the documented cost; `script-src` stays strict, which is where XSS
   * actually lives.
   */
  it("allows inline styles, because Emotion injects them client-side", () => {
    expect(directive(buildContentSecurityPolicy({ nonce: NONCE, isDev: false, isSecure: true }), 'style-src')).toContain(
      "'unsafe-inline'",
    );
  });

  it('carries no nonce in style-src, which would disable that allowance', () => {
    // A nonce in style-src makes browsers ignore 'unsafe-inline' entirely
    // (CSP3) - the exact failure mode this pairing has to avoid.
    expect(directive(buildContentSecurityPolicy({ nonce: NONCE, isDev: false, isSecure: true }), 'style-src')).not.toContain(
      'nonce-',
    );
  });
});

describe('buildContentSecurityPolicy - everything else', () => {
  const prod = buildContentSecurityPolicy({ nonce: NONCE, isDev: false, isSecure: true });

  it('locks down the directives an injection would reach for', () => {
    expect(directive(prod, 'default-src')).toBe("default-src 'self'");
    expect(directive(prod, 'object-src')).toBe("object-src 'none'");
    expect(directive(prod, 'base-uri')).toBe("base-uri 'self'");
    expect(directive(prod, 'frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive(prod, 'frame-src')).toBe("frame-src 'none'");
  });

  it('keeps form submissions on this origin', () => {
    // Every checkout form posts to a Server Action on this origin. When
    // Przelewy24 redirects are wired up (OPEN_ITEMS.md §1) that integration
    // has to add its host here, and this test is where it will be noticed.
    expect(directive(prod, 'form-action')).toBe("form-action 'self'");
  });

  it('allows the image sources next/image and upload previews really use', () => {
    const imgSrc = directive(prod, 'img-src');
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('blob:');
  });

  it('allows fonts only from this origin - next/font self-hosts them', () => {
    expect(directive(prod, 'font-src')).toBe("font-src 'self'");
  });

  it('allows connections only to this origin', () => {
    expect(directive(prod, 'connect-src')).toContain("'self'");
  });

  /*
    `upgrade-insecure-requests` rewrites every http subresource URL to https
    before the request leaves the browser. On an https page that is what you
    want. On a page served over plain http it upgrades the page's own assets
    to an origin that is not listening for TLS, and every script, stylesheet
    and font fails to load - the page renders as unstyled server HTML with no
    client JavaScript at all.

    This was keyed to `isDev` and was wrong, found 2026-09-04. The e2e suite
    runs a production build over http://localhost, so `isDev` was false and
    the directive was emitted; WebKit honours it on localhost (Chromium
    exempts loopback), so every mobile-safari spec that needed a hydrated
    island failed with "SSL connect error" on each chunk. Chromium's
    exemption is why this survived a full desktop suite and a browser check.

    The condition was never "are we in development" - it is "did this page
    reach the browser over https", which is a property of the request, not of
    the build.
  */
  it('upgrades insecure requests only when the page itself was served over https', () => {
    expect(buildContentSecurityPolicy({ nonce: NONCE, isDev: false, isSecure: true })).toContain(
      'upgrade-insecure-requests',
    );
  });

  it('does not upgrade insecure requests on a page served over http', () => {
    // A production build on plain http: a staging box, a LAN preview, a
    // container behind a proxy that terminates TLS elsewhere, or this
    // repo's own e2e suite. Upgrading here breaks the page outright.
    expect(buildContentSecurityPolicy({ nonce: NONCE, isDev: false, isSecure: false })).not.toContain(
      'upgrade-insecure-requests',
    );
  });

  it('does not upgrade insecure requests under next dev', () => {
    for (const isSecure of [true, false]) {
      expect(buildContentSecurityPolicy({ nonce: NONCE, isDev: true, isSecure })).not.toContain(
        'upgrade-insecure-requests',
      );
    }
  });

  it('is a single header line with no double spaces or empty directives', () => {
    for (const isDev of [true, false]) {
      const csp = buildContentSecurityPolicy({ nonce: NONCE, isDev, isSecure: true });
      expect(csp).not.toMatch(/[\r\n]/);
      expect(csp).not.toMatch(/ {2}/);
      expect(csp).not.toMatch(/;\s*;/);
      expect(csp.endsWith(';')).toBe(false);
    }
  });
});

describe('baseSecurityHeaders', () => {
  function headerValue(headers: readonly { key: string; value: string }[], key: string): string | undefined {
    return headers.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value;
  }

  it('sets the four headers that apply in every environment', () => {
    for (const isProduction of [true, false]) {
      const headers = baseSecurityHeaders({ isProduction });
      expect(headerValue(headers, 'X-Content-Type-Options')).toBe('nosniff');
      expect(headerValue(headers, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(headerValue(headers, 'X-Frame-Options')).toBe('DENY');
      expect(headerValue(headers, 'Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    }
  });

  it('sends HSTS in production only, for at least a year, including subdomains', () => {
    const value = headerValue(baseSecurityHeaders({ isProduction: true }), 'Strict-Transport-Security');
    expect(value).toBeDefined();
    const maxAge = Number(/max-age=(\d+)/.exec(String(value))?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
    expect(value).toContain('includeSubDomains');

    // Never in development: HSTS is pinned per host, so sending it from
    // http://localhost would force https on every other localhost project
    // on this machine, for a year, with no way to undo it from here.
    expect(headerValue(baseSecurityHeaders({ isProduction: false }), 'Strict-Transport-Security')).toBeUndefined();
  });

  it('never includes the CSP - that one is per-request, in the proxy', () => {
    for (const isProduction of [true, false]) {
      const keys = baseSecurityHeaders({ isProduction }).map((header) => header.key.toLowerCase());
      expect(keys).not.toContain('content-security-policy');
      expect(keys).not.toContain('content-security-policy-report-only');
    }
  });
});

describe('resolveCspMode / cspHeaderName', () => {
  it('enforces by default', () => {
    expect(resolveCspMode(undefined)).toBe('enforce');
    expect(resolveCspMode('')).toBe('enforce');
  });

  it('accepts the two documented escape hatches', () => {
    expect(resolveCspMode('report-only')).toBe('report-only');
    expect(resolveCspMode('off')).toBe('off');
  });

  it('ignores case and surrounding whitespace', () => {
    expect(resolveCspMode('  Report-Only ')).toBe('report-only');
  });

  it('falls back to enforcing on an unrecognised value rather than silently disabling', () => {
    // A typo in an env var must never be the thing that turns the policy
    // off - failing closed is the whole point of this header.
    expect(resolveCspMode('reportonly')).toBe('enforce');
    expect(resolveCspMode('yes')).toBe('enforce');
  });

  it('maps each mode to the header name browsers actually act on', () => {
    expect(cspHeaderName('enforce')).toBe('Content-Security-Policy');
    expect(cspHeaderName('report-only')).toBe('Content-Security-Policy-Report-Only');
  });
});
