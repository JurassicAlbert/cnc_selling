import type { NextConfig } from 'next';

import { baseSecurityHeaders } from './src/server/security/headers';

/**
 * Deliberately minimal. No `images.domains` - every image (including the
 * sourced stock photos added 2026-08-24, see `prisma/seed.ts`'s header)
 * lives under `public/`, and `next/image` needs no domain config for local
 * files. No redirects, no rewrites: nothing to redirect from yet. Add
 * config here as the reasons for it actually exist, not in advance of them.
 *
 * `experimental.serverActions.bodySizeLimit`, added 2026-08-26 for P4:
 * Next's own default is 1MB - well under `domain/upload/inspect.ts`'s
 * real 25MB JPG/PNG/PDF caps (`ARCHITECTURE.md` §13.1.1). Without this,
 * Next's own framework-level body parser would reject any upload over
 * 1MB with a generic error *before* `uploadCustomDesign` ever runs,
 * making those caps unreachable for most real photos - a genuine gap
 * this project's own manual testing almost missed (every test upload
 * used happened to be under 1MB). Set a little above the largest real
 * cap to leave room for multipart/form overhead around the raw file
 * bytes, not exactly equal to it.
 *
 * `headers()`, added 2026-08-31 for `docs/REVIEW-DETAILED.md` SEC-05
 * (ARCHITECTURE.md §16.1). Only the headers with no per-request component
 * live here - they then cover static assets, the image optimizer and API
 * routes, none of which the proxy matcher touches. The Content-Security-
 * Policy is set in `src/proxy.ts` instead, because its nonce must be fresh
 * per request; `src/server/security/headers.ts` holds both and explains the
 * split.
 *
 * `NODE_ENV` rather than a bespoke flag: `next build` sets it to
 * `production`, and `headers()` runs at build time, so this is evaluated
 * once per build and not per request.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `X-Powered-By: Next.js` on every response, on by default. Obscurity is
  // not security and nothing here depends on hiding the framework, but the
  // header buys nothing either, and it hands a scanner the exact stack to
  // match CVEs against for free. Off costs one line.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '26mb',
    },
  },
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [...baseSecurityHeaders({ isProduction: process.env.NODE_ENV === 'production' })],
      },
    ]);
  },
};

export default nextConfig;
