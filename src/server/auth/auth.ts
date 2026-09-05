/**
 * Better Auth server config - P6, 2026-08-26. `docs/HANDOVER.md` §9 records
 * the decision to use Better Auth over Auth.js/NextAuth v5 (still beta, no
 * verified Prisma 7 peer-dep support at the time of writing).
 *
 * `prismaAdapter` here operates at the Prisma **Client** query-API level
 * (`prisma.user.create(...)`), never touching the `PrismaPg` driver-adapter
 * layer that caused the earlier `EADDRINUSE` bug (`src/server/db/client.ts`)
 * - confirmed by reading `node_modules/@better-auth/prisma-adapter`'s own
 * type definitions directly, not assumed.
 *
 * `role`/`phone`/`anonymizedAt` on `User` are this project's own additions
 * on top of Better Auth's base user shape (`prisma/schema.prisma`'s `User`
 * model) - registered as `additionalFields` below so the adapter reads and
 * writes them untouched, without Better Auth needing to know what they mean.
 * `role` is `input: false`: there is no self-service path to STAFF/ADMIN
 * (`docs/ARCHITECTURE.md` §16.3) - Better Auth must never accept it from a
 * sign-up/update request body.
 *
 * `nextCookies()` MUST be last in `plugins` - Better Auth's own requirement
 * for its `after` hook (which calls `next/headers`'s `cookies().set(...)`)
 * to run after every other plugin's hooks have had a chance to set
 * response headers/cookies of their own.
 */

import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';
import { prismaAdapter } from '@better-auth/prisma-adapter';

import { prisma } from '@/server/db/client';
import { mailer } from '@/server/mail/mailer';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set - check your .env`);
  }
  return value;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: requireEnv('BETTER_AUTH_SECRET'),
  baseURL: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: true, input: false, defaultValue: 'CUSTOMER' },
      phone: { type: 'string', required: false },
      anonymizedAt: { type: 'date', required: false },
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        await mailer.send('verification-otp', email, { otp, purpose: type });
      },
    }),
    // Must stay last - see header comment.
    nextCookies(),
  ],
});
