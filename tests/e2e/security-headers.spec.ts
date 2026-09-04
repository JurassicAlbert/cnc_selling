import { expect, test } from '@playwright/test';

/**
 * `docs/REVIEW-DETAILED.md` SEC-05 / ARCHITECTURE.md §16.1. The unit tests
 * (`tests/unit/security-headers.test.ts`) pin the policy *string*; these pin
 * the things only a running server can show:
 *
 * - the headers survive the round trip at all (a `headers()` block that
 *   never matches, or a proxy matcher that never fires, is silent);
 * - Next actually applies the nonce it read out of our request header to
 *   its own script tags - the failure this whole approach hinges on, and
 *   one that produces a completely blank page rather than a warning;
 * - nothing on a real page violates the policy.
 *
 * Deliberately asserts only what holds in BOTH environments. `npm run e2e`
 * builds and starts a production server, but `reuseExistingServer` means a
 * developer with `next dev` already on :3000 runs these against dev - where
 * `'unsafe-eval'` is present and HSTS is not, both correctly. Those two
 * branches are covered by the unit tests instead of being asserted here
 * against whichever server happened to answer.
 */

const PAGES = [
  ['home', '/'],
  ['product', '/produkt/bransoletka-z-grawerem'],
  ['cart', '/koszyk'],
  ['checkout', '/koszyk/zamowienie'],
  ['login', '/logowanie'],
] as const;

test('sends the four environment-independent security headers', async ({ page }) => {
  const response = await page.goto('/');
  const headers = response?.headers() ?? {};

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  // `poweredByHeader: false` - Next sends `X-Powered-By: Next.js` otherwise.
  expect(headers['x-powered-by']).toBeUndefined();
});

test('sends a nonce-based CSP that never allows inline script', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response?.headers()['content-security-policy'];

  expect(csp, 'no CSP header - check CSP_MODE and the proxy matcher').toBeDefined();

  const scriptSrc = String(csp)
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('script-src'));

  expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/_-]+={0,2}'/);
  expect(scriptSrc).toContain("'strict-dynamic'");
  expect(scriptSrc).not.toContain("'unsafe-inline'");
  expect(String(csp)).toContain("frame-ancestors 'none'");
  expect(String(csp)).toContain("object-src 'none'");
});

test('issues a different nonce for every request', async ({ page }) => {
  const nonceOf = async (): Promise<string> => {
    const response = await page.goto('/', { waitUntil: 'commit' });
    const match = /'nonce-([A-Za-z0-9+/_-]+={0,2})'/.exec(response?.headers()['content-security-policy'] ?? '');
    return match?.[1] ?? '';
  };

  const first = await nonceOf();
  const second = await nonceOf();

  expect(first).not.toBe('');
  expect(first).not.toBe(second);
});

test('Next applies the header’s nonce to its own script tags', async ({ page }) => {
  // The load-bearing integration. Next re-reads the CSP off the *request*
  // headers the proxy rewrote and stamps that nonce onto every script it
  // emits. If the two ever disagree - a malformed nonce, a matcher that
  // stops rewriting the request - the page silently loads zero JavaScript.
  const response = await page.goto('/');
  const nonce = /'nonce-([A-Za-z0-9+/_-]+={0,2})'/.exec(
    response?.headers()['content-security-policy'] ?? '',
  )?.[1];
  expect(nonce).toBeDefined();

  // `.nonce`, not `getAttribute('nonce')`: browsers deliberately blank the
  // content attribute once the element is parsed ("nonce hiding", so a CSS
  // attribute selector cannot exfiltrate it) and keep the real value on the
  // IDL property. Reading the attribute here returns "" on every script and
  // makes this test look like a failure it isn't.
  const scriptNonces = await page
    .locator('script')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).nonce));

  expect(scriptNonces.length).toBeGreaterThan(0);
  // At least one script carries the header's nonce, and none carries a
  // different one. Not "every script": under 'strict-dynamic' the router
  // injects further scripts at runtime whose trust is inherited, not
  // nonce-derived, and requiring a nonce on those would pin behaviour the
  // policy does not actually depend on.
  expect(scriptNonces).toContain(nonce);
  expect(scriptNonces.filter((value) => value !== '' && value !== nonce)).toEqual([]);
});

for (const [name, path] of PAGES) {
  test(`renders ${name} with no CSP violation`, async ({ page }) => {
    const violations: string[] = [];
    // Chromium reports a blocked resource as a console error containing
    // "Content Security Policy"; a `securitypolicyviolation` DOM event
    // fires too, but only for resources the *document* requested, so the
    // console is the wider net of the two.
    page.on('console', (message) => {
      if (message.type() === 'error' && /content security policy/i.test(message.text())) {
        violations.push(message.text());
      }
    });

    await page.goto(path);
    await page.waitForLoadState('networkidle');

    expect(violations, `CSP blocked something on ${path}`).toEqual([]);
  });
}

test('hydrates and runs a Server Action under the enforced policy', async ({ page }) => {
  // Proves 'strict-dynamic' really does let the router load its chunks:
  // changing the material re-prices server-side, so a visible price change
  // means the client bundle ran, the action reached the server, and the
  // result re-rendered.
  await page.goto('/produkt/bransoletka-z-grawerem');

  const priceBefore = await page.getByText(/Cena:/).first().textContent();
  await page.getByRole('button', { name: /^Materiał:/ }).click();
  await page.getByRole('menuitem').filter({ hasText: 'Modrzew' }).click();

  await expect(page.getByText(/Cena:/).first()).not.toHaveText(String(priceBefore));
});
