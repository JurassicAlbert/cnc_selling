import { afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { clearRateLimit, consumeRateLimit } from '@/server/rate-limit/rate-limit';
import type { RateLimitRule } from '@/server/rate-limit/rate-limit';

/**
 * The generic limiter behind `docs/REVIEW-DETAILED.md` SEC-01 (unthrottled
 * auth) and the still-open P1-8 (order creation per IP, `ARCHITECTURE.md`
 * §16.1). `docs/OPEN_ITEMS.md` §6 asked where per-attempt state should live;
 * the owner chose Postgres, so this tests the real table rather than an
 * in-memory stand-in.
 *
 * `now` is an explicit parameter throughout, which is what makes window
 * expiry testable without `setTimeout` - a sleeping test is a slow test and
 * eventually a flaky one.
 *
 * These run against the real database rather than `withTestTransaction`
 * because the limiter's whole point is a single atomic statement whose
 * behaviour under genuine concurrency is the thing being asserted; two
 * concurrent calls inside one interactive transaction would be serialised
 * by the transaction itself and prove nothing.
 */

const PREFIX = 'test-rl-';
const RULE: RateLimitRule = { limit: 3, windowSeconds: 900 };

function key(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

afterEach(async () => {
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: PREFIX } } });
});

describe('consumeRateLimit - the window', () => {
  it('allows exactly `limit` attempts and refuses the next one', async () => {
    const k = key();

    expect((await consumeRateLimit(k, RULE)).allowed).toBe(true);
    expect((await consumeRateLimit(k, RULE)).allowed).toBe(true);
    expect((await consumeRateLimit(k, RULE)).allowed).toBe(true);

    const fourth = await consumeRateLimit(k, RULE);
    expect(fourth.allowed).toBe(false);
  });

  it('reports how long to wait, and the wait shrinks as the window elapses', async () => {
    const k = key();
    const start = new Date('2026-08-30T12:00:00.000Z');
    for (let i = 0; i < RULE.limit; i++) {
      await consumeRateLimit(k, RULE, start);
    }

    const immediately = await consumeRateLimit(k, RULE, start);
    const tenMinutesLater = await consumeRateLimit(k, RULE, new Date(start.getTime() + 600_000));

    if (immediately.allowed || tenMinutesLater.allowed) {
      throw new Error('both should have been refused - the window is 15 minutes');
    }
    expect(immediately.retryAfterSeconds).toBe(900);
    expect(tenMinutesLater.retryAfterSeconds).toBe(300);
  });

  it('starts a fresh window once the old one has fully elapsed', async () => {
    const k = key();
    const start = new Date('2026-08-30T12:00:00.000Z');
    for (let i = 0; i < RULE.limit; i++) {
      await consumeRateLimit(k, RULE, start);
    }
    expect((await consumeRateLimit(k, RULE, start)).allowed).toBe(false);

    const afterWindow = new Date(start.getTime() + RULE.windowSeconds * 1000 + 1);
    expect((await consumeRateLimit(k, RULE, afterWindow)).allowed).toBe(true);
  });

  it('keeps different keys entirely independent', async () => {
    const mine = key();
    const theirs = key();
    for (let i = 0; i < RULE.limit + 1; i++) {
      await consumeRateLimit(mine, RULE);
    }

    expect((await consumeRateLimit(mine, RULE)).allowed).toBe(false);
    expect((await consumeRateLimit(theirs, RULE)).allowed).toBe(true);
  });
});

describe('consumeRateLimit - concurrency', () => {
  /**
   * The reason this is one SQL statement and not read-then-write. A limiter
   * that loses updates under load is worse than none: it reports protection
   * it does not provide, and the load an attacker generates is exactly the
   * condition that makes a read-then-write race likely.
   */
  it('counts every one of many simultaneous attempts - none is lost', async () => {
    const k = key();
    const rule: RateLimitRule = { limit: 5, windowSeconds: 900 };

    const verdicts = await Promise.all(
      Array.from({ length: 20 }, () => consumeRateLimit(k, rule)),
    );

    expect(verdicts.filter((v) => v.allowed)).toHaveLength(5);
    expect(verdicts.filter((v) => !v.allowed)).toHaveLength(15);
  });
});

describe('clearRateLimit', () => {
  it('resets a key that had been exhausted', async () => {
    const k = key();
    for (let i = 0; i < RULE.limit + 1; i++) {
      await consumeRateLimit(k, RULE);
    }
    expect((await consumeRateLimit(k, RULE)).allowed).toBe(false);

    await clearRateLimit(k);

    expect((await consumeRateLimit(k, RULE)).allowed).toBe(true);
  });

  it('is a no-op for a key that was never used', async () => {
    await expect(clearRateLimit(key())).resolves.toBeUndefined();
  });
});
