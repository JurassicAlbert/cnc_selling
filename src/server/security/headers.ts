/**
 * Security headers and the Content-Security-Policy - ARCHITECTURE.md §16.1
 * ("Security headers + strict CSP"), built 2026-08-31 for
 * `docs/REVIEW-DETAILED.md` SEC-05. Until then the second half of that
 * sentence was implemented (`/api/plik/[fileId]` serves customer SVGs as
 * attachments) and the first half did not exist anywhere: a search for
 * `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
 * `Strict-Transport-Security`, `Referrer-Policy` and `Permissions-Policy`
 * across the repository returned zero matches.
 *
 * Pure on purpose - no `next/server`, no request, no environment reads
 * beyond what a caller passes in - so the policy itself is unit-testable
 * (`tests/unit/security-headers.test.ts`) without booting a server. The two
 * consumers are `next.config.ts` (the static headers, which never vary per
 * request) and `src/proxy.ts` (the CSP, which must, because of the nonce).
 *
 * ## Why the CSP lives in the proxy and the rest does not
 *
 * A nonce has to be fresh per request, so it cannot come from
 * `next.config.ts`'s static `headers()`. The other five headers have no
 * per-request component, and `next.config.ts` applies them to static assets
 * and image-optimizer responses too - paths the proxy matcher deliberately
 * skips.
 *
 * ## Known cost: this forecloses static rendering
 *
 * Next reads the nonce out of the *request* CSP header at render time
 * (`node_modules/next/dist/server/app-render/app-render.js:209-210`) and
 * stamps it onto the framework's own script tags. A prerendered page has a
 * stale nonce baked into its HTML, so a nonce-based CSP and static/ISR/PPR
 * are mutually exclusive - Next's own CSP guide says so. Every storefront
 * route is already dynamic today (`docs/REVIEW-PERFORMANCE.md` Finding 1
 * measured 91 of 93), so this costs nothing right now, but **PERF-01 cannot
 * make catalogue pages static while this is enforced with a nonce.** The
 * escape route, if that trade is ever worth making, is Next's experimental
 * `sri` (hash-based integrity, static-compatible) - recorded in
 * `docs/AI-CHECKLIST.md` under PERF-01 as a dependency rather than left to
 * be rediscovered.
 */

export type CspMode = 'enforce' | 'report-only' | 'off';

export type SecurityHeader = {
  readonly key: string;
  readonly value: string;
};

/**
 * 16 bytes from the platform CSPRNG, base64-encoded.
 *
 * Next's own guide suggests `Buffer.from(crypto.randomUUID())` - that works,
 * but base64-encodes 36 *text* characters to carry 122 bits, where this
 * carries 128 in 24. The character set matters more than the length:
 * standard base64 (`A-Za-z0-9+/=`) is inside the set Next's extractor
 * accepts (`CSP_NONCE_SOURCE_REGEX`), which is asserted directly against the
 * real function in the unit tests rather than assumed.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * `script-src` is the strict one: nonce + `'strict-dynamic'`, never
 * `'unsafe-inline'`. `'strict-dynamic'` is what lets the App Router keep
 * working - the initial script carries the nonce, and every chunk it then
 * injects inherits that trust, which a host allowlist could not express.
 *
 * `style-src` is deliberately **not** strict, and this is the one real
 * compromise in here. MUI/Emotion inject `<style>` elements from the browser
 * for anything not server-rendered, and `ThemeRegistry` is mounted from
 * `error.tsx` boundaries, which React renders with no props of ours - there
 * is no path by which a per-request nonce could reach them. Adding a nonce
 * to `style-src` anyway would be actively worse than omitting it: CSP3 makes
 * browsers ignore `'unsafe-inline'` as soon as a nonce is present, so it
 * would break every client-side style instead of tightening anything. Style
 * injection is also a far smaller prize than script injection, which is why
 * Google's own strict-CSP guidance grades on `script-src`.
 *
 * `img-src` needs `data:` (inline SVG icons and `next/image`'s blur
 * placeholders) and `blob:`. `font-src 'self'` is enough because
 * `next/font/google` downloads at build time and serves from this origin
 * (`src/ui/theme/fonts.ts`) - no runtime request to Google.
 */
/**
 * Did this page reach the *browser* over https?
 *
 * `request.nextUrl.protocol` answers it for a direct connection. Behind a
 * load balancer that terminates TLS - the usual production shape - the
 * request reaching this process is plain http, and `x-forwarded-proto` is
 * the only record of what the browser actually used.
 *
 * That header is forgeable by anyone who can reach this process directly,
 * and that is acceptable here: the worst a forged value does is add the
 * `upgrade-insecure-requests` directive to, or remove it from, the forger's
 * own response. Keeping a real visitor on https is HSTS's job
 * (`baseSecurityHeaders`), not this directive's.
 */
export function isSecureRequest(options: {
  readonly protocol: string;
  readonly forwardedProto: string | null;
}): boolean {
  const { protocol, forwardedProto } = options;
  if (forwardedProto !== null) {
    // A request through several proxies carries a list, oldest first: the
    // first entry is what the browser used.
    return forwardedProto.split(',')[0]?.trim().toLowerCase() === 'https';
  }
  return protocol === 'https:';
}

export function buildContentSecurityPolicy(options: {
  readonly nonce: string;
  readonly isDev: boolean;
  /**
   * Whether the page reached the browser over https. Not "are we in
   * production": a production build is routinely served over plain http (a
   * staging box, a LAN preview, this repo's own e2e suite), and
   * `upgrade-insecure-requests` on such a page is fatal - see the directive's
   * own comment below. Required, with no default, because a caller that
   * forgets it is exactly how this went wrong the first time.
   */
  readonly isSecure: boolean;
}): string {
  const { nonce, isDev, isSecure } = options;

  const scriptSrc = [
    "script-src 'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // React uses eval in development to reconstruct server-side error
    // stacks in the browser. It does not in production.
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(' ');

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    /*
      Only for a page that arrived over https.

      This directive rewrites every http subresource URL to https before the
      request leaves the browser. On an https page that closes a real gap. On
      a page served over http it upgrades the page's own scripts, styles and
      fonts to an origin that is not listening for TLS, and every one of them
      fails: the visitor gets unstyled server HTML and no client JavaScript.

      It was keyed to `isDev`, which was the wrong question, and the cost was
      hidden for four days because Chromium exempts loopback from the upgrade
      and WebKit does not. The e2e suite runs a production build over
      http://localhost, so every mobile-safari spec needing a hydrated island
      was failing with "SSL connect error" on each chunk while the identical
      desktop spec passed. Found 2026-09-04.

      Still excluded under `next dev` regardless: dev serves http even when
      `isSecure` would somehow be true, and a broken dev server is a bad
      trade for a directive whose whole audience is production.
    */
    ...(isDev || !isSecure ? [] : ['upgrade-insecure-requests']),
  ];

  return directives.join('; ');
}

/**
 * The headers with no per-request component. Applied from `next.config.ts`
 * so they cover static assets and API routes as well as pages.
 *
 * `Referrer-Policy` is not cosmetic here: guest order pages are reachable by
 * a `?token=` query parameter (`docs/REVIEW-DETAILED.md` BUG-22), and the
 * default referrer behaviour would hand that token to any third-party host a
 * customer navigates to from that page.
 */
export function baseSecurityHeaders(options: { readonly isProduction: boolean }): readonly SecurityHeader[] {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Redundant with `frame-ancestors 'none'` for modern browsers, kept for
    // the ones that only understand this.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    // HSTS is pinned per host by the browser and cannot be withdrawn from
    // the server side once sent. Sending it from http://localhost would
    // force https on every other localhost project on the machine, for a
    // year. Production only, always.
    ...(options.isProduction
      ? [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
        ]
      : []),
  ];
}

/**
 * `CSP_MODE`, documented in `.env.example`.
 *
 * Defaults to enforcing. An unrecognised value also enforces: a typo in an
 * environment variable must never be the thing that silently switches the
 * policy off, and a broken page is a far cheaper failure than a header
 * everyone believes is protecting them.
 */
export function resolveCspMode(raw: string | undefined): CspMode {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === 'report-only') {
    return 'report-only';
  }
  if (normalized === 'off') {
    return 'off';
  }
  return 'enforce';
}

export function cspHeaderName(mode: Exclude<CspMode, 'off'>): string {
  return mode === 'report-only' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
}
