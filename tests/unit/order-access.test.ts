/**
 * `docs/AI-CHECKLIST.md` BUG-22 - the guest order cookie is defined twice, on
 * purpose, and the two definitions must agree.
 *
 * `src/proxy.ts` sets it when the emailed link arrives, and
 * `server/session/order-access.ts` sets it from the checkout and lookup
 * actions and reads it back on the confirmation page. The proxy cannot import
 * the module: middleware runs in its own bundle and must not pull in
 * `next/headers`.
 *
 * A silent divergence - a renamed cookie, a narrowed path - would mean the
 * emailed link sets something the page never reads, and the customer would
 * see the same "not found" as a wrong token. This reads the proxy's source
 * rather than its behaviour, because the constants are what drift.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ORDER_ACCESS_COOKIE, ORDER_ACCESS_COOKIE_PATH } from '@/server/session/order-access';

const proxySource = readFileSync(fileURLToPath(new URL('../../src/proxy.ts', import.meta.url)), 'utf8');

describe('the order-access cookie is named and scoped the same in both places', () => {
  it('uses the same cookie name in the proxy', () => {
    expect(proxySource).toContain(`const ORDER_ACCESS_COOKIE = '${ORDER_ACCESS_COOKIE}';`);
  });

  it('uses the same path in the proxy', () => {
    expect(proxySource).toContain(`const ORDER_ACCESS_COOKIE_PATH = '${ORDER_ACCESS_COOKIE_PATH}';`);
  });

  it('scopes the cookie to the order pages rather than the whole site', () => {
    // A credential that travels on requests which cannot use it has a wider
    // blast radius than it needs.
    expect(ORDER_ACCESS_COOKIE_PATH).toBe('/zamowienie');
  });
});
