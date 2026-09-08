/**
 * The proxy has two responsibilities that must not interfere with each
 * other: the `/panel` redirect it has always done, and the per-request CSP
 * added 2026-08-31 for `docs/REVIEW-DETAILED.md` SEC-05. Widening the
 * matcher from `/panel/:path*` to (almost) everything is exactly the kind of
 * change that quietly drops the redirect - proxy's own documentation warns
 * about it - so both halves are pinned here.
 *
 * The CSP mode is documented in `.env.example` as an operator-facing escape
 * hatch. An escape hatch nobody has ever exercised is a claim, not a
 * feature, so each of the three modes is driven end to end through the real
 * function rather than inferred from `resolveCspMode` alone.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { proxy } from '@/proxy';

const originalMode = process.env.CSP_MODE;

afterEach(() => {
  if (originalMode === undefined) {
    delete process.env.CSP_MODE;
  } else {
    process.env.CSP_MODE = originalMode;
  }
});

function request(path: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(`http://localhost:3000${path}`, init));
}

function secureRequest(path: string): NextRequest {
  return new NextRequest(new Request(`https://sklep.example${path}`));
}

describe('proxy - the /panel gate, unchanged by the CSP work', () => {
  it('redirects an unauthenticated /panel request to the login page', () => {
    const response = proxy(request('/panel/zamowienia'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/logowanie');
  });

  it('still sends the CSP on that redirect', () => {
    expect(proxy(request('/panel')).headers.get('content-security-policy')).toContain("default-src 'self'");
  });

  it('never redirects a storefront request', () => {
    const response = proxy(request('/koszyk'));

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('proxy - CSP_MODE', () => {
  it('enforces when unset', () => {
    delete process.env.CSP_MODE;
    const headers = proxy(request('/')).headers;

    expect(headers.get('content-security-policy')).toContain("script-src 'self' 'nonce-");
    expect(headers.get('content-security-policy-report-only')).toBeNull();
  });

  it('reports without blocking when set to report-only', () => {
    process.env.CSP_MODE = 'report-only';
    const headers = proxy(request('/')).headers;

    expect(headers.get('content-security-policy-report-only')).toContain("script-src 'self' 'nonce-");
    expect(headers.get('content-security-policy')).toBeNull();
  });

  it('sends no policy at all when set to off, and still gates /panel', () => {
    process.env.CSP_MODE = 'off';

    const storefront = proxy(request('/'));
    expect(storefront.headers.get('content-security-policy')).toBeNull();
    expect(storefront.headers.get('content-security-policy-report-only')).toBeNull();

    // The failure mode worth pinning: turning the CSP off must not also
    // turn the authentication redirect off.
    expect(proxy(request('/panel')).status).toBe(307);
  });

  it('issues a fresh nonce per request', () => {
    const nonceOf = (response: { headers: Headers }): string =>
      /'nonce-([^']+)'/.exec(response.headers.get('content-security-policy') ?? '')?.[1] ?? '';

    expect(nonceOf(proxy(request('/')))).not.toBe(nonceOf(proxy(request('/'))));
  });
});

/*
  Whether the page reached the browser over https is a property of the
  request, so the proxy is the only place that can answer it - and getting it
  wrong is not a subtle degradation. `upgrade-insecure-requests` on an http
  page rewrites the page's own asset URLs to an origin with no TLS listener,
  and the whole site fails to load. See `security-headers.test.ts` for the
  incident.
*/
describe('proxy - upgrade-insecure-requests follows the request, not the build', () => {
  const cspOf = (r: NextRequest): string => proxy(r).headers.get('content-security-policy') ?? '';

  it('omits the upgrade on a plain http request', () => {
    delete process.env.CSP_MODE;
    expect(cspOf(request('/'))).not.toContain('upgrade-insecure-requests');
  });

  it('sends the upgrade on an https request', () => {
    delete process.env.CSP_MODE;
    expect(cspOf(secureRequest('/'))).toContain('upgrade-insecure-requests');
  });

  it('trusts x-forwarded-proto, for TLS terminated at a proxy in front of us', () => {
    // The usual production shape: the browser speaks https to a load
    // balancer, which speaks http to this process. Without this the
    // directive would never be sent in the one deployment that wants it.
    //
    // Forgeable by anyone who can reach this process directly, and
    // deliberately so: the worst a forged value can do is add the directive
    // to, or remove it from, the forger's own response. HSTS
    // (`baseSecurityHeaders`) is the control that actually keeps a real
    // visitor on https.
    delete process.env.CSP_MODE;
    expect(cspOf(request('/', { headers: { 'x-forwarded-proto': 'https' } }))).toContain(
      'upgrade-insecure-requests',
    );
  });

  it('reads the first entry when x-forwarded-proto has been through several hops', () => {
    delete process.env.CSP_MODE;
    expect(cspOf(request('/', { headers: { 'x-forwarded-proto': 'https, http' } }))).toContain(
      'upgrade-insecure-requests',
    );
  });

  it('does not treat a forwarded http hop as secure', () => {
    delete process.env.CSP_MODE;
    expect(cspOf(request('/', { headers: { 'x-forwarded-proto': 'http' } }))).not.toContain(
      'upgrade-insecure-requests',
    );
  });
});

/**
 * `docs/AI-CHECKLIST.md` BUG-22 - the guest order token travelled in the
 * query string.
 *
 * `/zamowienie/2026-09-0042?token=abc` puts the credential in the address
 * bar, browser history, server access logs, and the `Referer` of anything
 * the customer clicks from that page.
 *
 * **Owner's instruction, 2026-09-05**, taken as written rather than as the
 * option button pressed: "we should rather not use get (tokens or any
 * personal info visible in the address - endpoint - it should use post or
 * other way to hide it)". So the token is exchanged once and removed from
 * the address.
 *
 * The emailed link still carries it - that is what makes it one click, and
 * the owner kept that - so the token appears in exactly one request and then
 * lives in an `HttpOnly` cookie. What it no longer does is sit in the address
 * for the rest of the visit.
 *
 * The proxy is the right place: setting a cookie needs a response, and a
 * Server Component cannot write one. It already runs on this path.
 */
describe('proxy - the order token never stays in the address (BUG-22)', () => {
  const CONFIRMATION = '/zamowienie/2026-09-0042';

  it('redirects the token out of the URL', () => {
    delete process.env.CSP_MODE;
    const response = proxy(request(`${CONFIRMATION}?token=secret-token`));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') ?? '', 'http://localhost:3000');
    expect(location.pathname).toBe(CONFIRMATION);
    expect(location.search).toBe('');
  });

  it('carries the token onward in an HttpOnly cookie', () => {
    delete process.env.CSP_MODE;
    const response = proxy(request(`${CONFIRMATION}?token=secret-token`));

    const cookie = response.cookies.get('order-access');
    expect(cookie?.value).toBe('secret-token');
    // HttpOnly so a script cannot read it, which is the whole reason a cookie
    // is an improvement on a query string rather than a lateral move.
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
  });

  it('marks the cookie Secure on https and not on plain http', () => {
    delete process.env.CSP_MODE;
    // Same reasoning as SEC-11's `upgrade-insecure-requests`: a `Secure`
    // cookie is simply dropped over http, which would break the local suite
    // and any LAN preview while looking like an authorization bug.
    expect(proxy(secureRequest(`${CONFIRMATION}?token=t`)).cookies.get('order-access')?.secure).toBe(true);
    expect(proxy(request(`${CONFIRMATION}?token=t`)).cookies.get('order-access')?.secure).toBe(false);
  });

  it('keeps the other query parameters a page might need', () => {
    delete process.env.CSP_MODE;
    const response = proxy(request(`${CONFIRMATION}?token=secret&utm_source=email`));

    const location = new URL(response.headers.get('location') ?? '', 'http://localhost:3000');
    expect(location.searchParams.get('token')).toBeNull();
    expect(location.searchParams.get('utm_source')).toBe('email');
  });

  it('leaves a request without a token alone', () => {
    delete process.env.CSP_MODE;
    // The ordinary case after the exchange: the page reads the cookie and the
    // proxy must not bounce it in a loop.
    const response = proxy(request(CONFIRMATION));

    expect(response.status).toBe(200);
    expect(response.cookies.get('order-access')).toBeUndefined();
  });

  it('does not exchange tokens on other routes', () => {
    delete process.env.CSP_MODE;
    // Narrow on purpose. `?token=` means something specific on this path and
    // nothing anywhere else, and a proxy that harvests any parameter called
    // "token" into a cookie would be a new problem rather than a fix.
    const response = proxy(request('/szukaj?token=not-an-order-token'));

    expect(response.status).toBe(200);
    expect(response.cookies.get('order-access')).toBeUndefined();
  });

  it('still sends the CSP on the exchange redirect', () => {
    delete process.env.CSP_MODE;
    // The redirect is a real response the browser acts on, and SEC-05's own
    // test makes the same point about the /panel redirect.
    const response = proxy(request(`${CONFIRMATION}?token=secret`));
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
  });
});
