import type { NextConfig } from 'next';

/**
 * Deliberately minimal. No `images.domains` yet — there is no product
 * photography (D5 is still open). No redirects, no rewrites: nothing to
 * redirect from yet. Add config here as the reasons for it actually exist,
 * not in advance of them.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
