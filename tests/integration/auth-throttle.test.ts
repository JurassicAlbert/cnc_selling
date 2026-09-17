import { afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import {
  clearLoginAttempts,
  consumeLoginAttempt,
  consumeOrderAttempt,
  consumeOtpRequest,
  consumeRegisterAttempt,
  consumeUploadAttempt,
} from '@/server/rate-limit/auth-throttle';
import { AUTH_RATE_LIMITS } from '@/server/rate-limit/rules';

/**
 * `docs/REVIEW-DETAILED.md` SEC-01. Login, registration and OTP requests
 * called `auth.api.*` directly from Server Actions, which never reaches
 * Better Auth's own limiter (that lives in its HTTP router's `onRequest`
 * hook, i.e. only on `/api/auth/*`). Unlimited password guessing, and an
 * endpoint that would email any address on demand.
 *
 * Tested here rather than through `submitLogin`/`submitOtpRequest`, which
 * call `next/headers` and therefore cannot run outside a real request -
 * the same split, for the same reason, as every `apply*`/wrapper pair in
 * `src/server/operations`. These functions take the email and IP
 * explicitly; the actions read them from the request and pass them in.
 */

const PREFIX = 'test-throttle-';

function email(): string {
  return `${PREFIX}${crypto.randomUUID()}@example.test`;
}

function ip(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

afterEach(async () => {
  await prisma.rateLimit.deleteMany({ where: { key: { contains: PREFIX } } });
});

describe('login throttling', () => {
  it('refuses the attempt after the per-email limit is reached', async () => {
    const address = email();
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerEmail.limit; i++) {
      expect((await consumeLoginAttempt({ email: address, ip: ip() })).allowed).toBe(true);
    }

    const refused = await consumeLoginAttempt({ email: address, ip: ip() });

    expect(refused.allowed).toBe(false);
    if (!refused.allowed) {
      expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  it('leaves a different account completely unaffected', async () => {
    const victim = email();
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerEmail.limit + 1; i++) {
      await consumeLoginAttempt({ email: victim, ip: ip() });
    }

    expect((await consumeLoginAttempt({ email: email(), ip: ip() })).allowed).toBe(true);
  });

  it('treats the same address in different letter case as one account', async () => {
    const address = email();
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerEmail.limit; i++) {
      await consumeLoginAttempt({ email: address.toUpperCase(), ip: ip() });
    }

    expect((await consumeLoginAttempt({ email: address, ip: ip() })).allowed).toBe(false);
  });

  it('limits one IP hammering many different accounts', async () => {
    const attacker = ip();
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerIp.limit; i++) {
      expect((await consumeLoginAttempt({ email: email(), ip: attacker })).allowed).toBe(true);
    }

    expect((await consumeLoginAttempt({ email: email(), ip: attacker })).allowed).toBe(false);
  });

  it('forgets the failures once the customer actually signs in', async () => {
    const address = email();
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerEmail.limit; i++) {
      await consumeLoginAttempt({ email: address, ip: ip() });
    }

    await clearLoginAttempts(address);

    expect((await consumeLoginAttempt({ email: address, ip: ip() })).allowed).toBe(true);
  });

  /**
   * There is genuinely no IP to attribute an attempt to in local
   * development, in the e2e suite, and behind any proxy that does not set
   * `X-Forwarded-For`. Folding all of those into one shared bucket would
   * lock out every visitor at once the moment traffic picked up - a far
   * worse failure than not applying the IP dimension at all. The per-email
   * limit still applies.
   */
  it('skips the IP dimension entirely when there is no IP, rather than sharing one bucket', async () => {
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerIp.limit + 5; i++) {
      const verdict = await consumeLoginAttempt({ email: email(), ip: null });
      expect(verdict.allowed).toBe(true);
    }
  });
});

describe('OTP request throttling', () => {
  /**
   * The abuse here is not guessing - the plugin caps verification at three
   * attempts - it is that an unthrottled request endpoint will mail any
   * address, repeatedly, at the shop's cost and to a victim's inbox.
   */
  it('refuses to keep mailing the same address', async () => {
    const address = email();
    for (let i = 0; i < AUTH_RATE_LIMITS.otpRequestPerEmail.limit; i++) {
      expect((await consumeOtpRequest({ email: address, ip: ip() })).allowed).toBe(true);
    }

    expect((await consumeOtpRequest({ email: address, ip: ip() })).allowed).toBe(false);
  });

  it('limits one IP requesting codes for many addresses', async () => {
    const attacker = ip();
    for (let i = 0; i < AUTH_RATE_LIMITS.otpRequestPerIp.limit; i++) {
      await consumeOtpRequest({ email: email(), ip: attacker });
    }

    expect((await consumeOtpRequest({ email: email(), ip: attacker })).allowed).toBe(false);
  });

  it('does not share a counter with login - a throttled login still leaves OTP available', async () => {
    const address = email();
    for (let i = 0; i < AUTH_RATE_LIMITS.loginPerEmail.limit + 1; i++) {
      await consumeLoginAttempt({ email: address, ip: null });
    }

    expect((await consumeOtpRequest({ email: address, ip: null })).allowed).toBe(true);
  });
});

describe('registration throttling', () => {
  it('refuses mass account creation from one IP', async () => {
    const attacker = ip();
    for (let i = 0; i < AUTH_RATE_LIMITS.registerPerIp.limit; i++) {
      expect((await consumeRegisterAttempt({ ip: attacker })).allowed).toBe(true);
    }

    expect((await consumeRegisterAttempt({ ip: attacker })).allowed).toBe(false);
  });

  it('is a no-op without an IP', async () => {
    for (let i = 0; i < AUTH_RATE_LIMITS.registerPerIp.limit + 3; i++) {
      expect((await consumeRegisterAttempt({ ip: null })).allowed).toBe(true);
    }
  });
});

describe('order creation throttling (ARCHITECTURE.md §16.1, audit P1-8)', () => {
  it('refuses a flood of order submissions from one IP', async () => {
    const attacker = ip();
    for (let i = 0; i < AUTH_RATE_LIMITS.orderPerIp.limit; i++) {
      expect((await consumeOrderAttempt({ ip: attacker })).allowed).toBe(true);
    }

    expect((await consumeOrderAttempt({ ip: attacker })).allowed).toBe(false);
  });

  it('is a no-op without an IP, so local and e2e checkout is never blocked', async () => {
    for (let i = 0; i < AUTH_RATE_LIMITS.orderPerIp.limit + 3; i++) {
      expect((await consumeOrderAttempt({ ip: null })).allowed).toBe(true);
    }
  });
});

describe('upload throttling per IP (SEC-08)', () => {
  /*
    `isUploadRateLimited` counts this hour's `UploadedFile` rows for the
    session or the user, which is §16.1's "uploads per session/hour" and is
    the right rule - but for a guest the session IS a cookie they own.
    Clearing it hands them a fresh allowance, as many times as they like, and
    each one of those uploads can be 25 MB of disk.

    The per-IP counter is the dimension a client cannot reset, and it lives in
    the same `RateLimit` table SEC-01 built, so nothing new runs anywhere.
    Both dimensions apply: the session rule still catches one signed-in
    customer looping, this catches the same person emptying their cookie jar.
  */
  it('refuses an upload flood from one address, whatever the session says', async () => {
    const attacker = ip();
    for (let i = 0; i < AUTH_RATE_LIMITS.uploadPerIp.limit; i++) {
      expect((await consumeUploadAttempt({ ip: attacker })).allowed).toBe(true);
    }

    expect((await consumeUploadAttempt({ ip: attacker })).allowed).toBe(false);
  });

  it('leaves a different address alone - the counter is per IP, not global', async () => {
    const attacker = ip();
    for (let i = 0; i < AUTH_RATE_LIMITS.uploadPerIp.limit + 2; i++) {
      await consumeUploadAttempt({ ip: attacker });
    }

    expect((await consumeUploadAttempt({ ip: ip() })).allowed).toBe(true);
  });

  it('is a no-op without an IP, so local development and the e2e suite can still upload', async () => {
    for (let i = 0; i < AUTH_RATE_LIMITS.uploadPerIp.limit + 3; i++) {
      expect((await consumeUploadAttempt({ ip: null })).allowed).toBe(true);
    }
  });

  it('is set well above the per-session rule, so the session limit stays the one a real customer meets', async () => {
    // If the IP allowance were the tighter of the two, one household sharing
    // an address would start hitting a limit meant for an attacker.
    expect(AUTH_RATE_LIMITS.uploadPerIp.limit).toBeGreaterThan(10);
  });
});
