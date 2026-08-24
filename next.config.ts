import type { NextConfig } from 'next';

/**
 * Deliberately minimal. No `images.domains` — every image (including the
 * sourced stock photos added 2026-08-24, see `prisma/seed.ts`'s header)
 * lives under `public/`, and `next/image` needs no domain config for local
 * files. No redirects, no rewrites: nothing to redirect from yet. Add
 * config here as the reasons for it actually exist, not in advance of them.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
