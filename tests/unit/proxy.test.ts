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
