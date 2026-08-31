/**
 * The one rolling-window rate limiter — `docs/ARCHITECTURE.md` §16.1's
 * "rate limits: uploads per session/hour, order creation per IP, auth
 * attempts".
 *
 * Storage is Postgres, decided by the owner on 2026-08-30 (the question
 * `docs/OPEN_ITEMS.md` §6 held open): no new infrastructure to run or pay
 * for, and the counter is the shape this codebase already trusts for
 * `OrderNumberCounter`. The whole surface is these two functions, so
 * swapping to Redis later is a rewrite of this file and nothing else.
 *
 * **One statement, deliberately.** Reading a count and writing back
 * `count + 1` loses updates under concurrency — and concurrency is
 * precisely the condition a rate limiter exists for, so a racy limiter
 * reports protection it does not provide. `INSERT … ON CONFLICT DO UPDATE
 * … RETURNING` decides, increments and reports in one atomic step. This is
 * the same lesson `docs/AUDIT-2026-08-30.md` P0-3 recorded for cart
 * quantities and `docs/REVIEW-DETAILED.md` BUG-05 found again afterwards.
 *
 * **`now` is a parameter**, not `new Date()` at the point of use, so window
 * expiry is testable without a sleeping test. Callers never pass it.
 */

import { prisma } from '@/server/db/client';

export type RateLimitRule = {
  /** Attempts permitted within one window. The (limit + 1)th is refused. */
  readonly limit: number;
  /** Window length. The window is rolling from the first attempt, not a fixed calendar bucket. */
  readonly windowSeconds: number;
};

export type RateLimitVerdict =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

type CounterRow = { readonly count: number; readonly windowStart: Date };

/**
 * Counts one attempt against `key` and says whether it is permitted.
 *
 * Always counts, including the refused attempt — that is what makes
 * hammering a locked-out key keep it locked out rather than letting an
 * attacker free-run once the limit is reached. `retryAfterSeconds` is
 * measured from the window's own start, so it shrinks as the window
 * elapses instead of being reset by each new attempt.
 */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
  now: Date = new Date(),
): Promise<RateLimitVerdict> {
  const windowStartCutoff = new Date(now.getTime() - rule.windowSeconds * 1000);

  const rows = await prisma.$queryRaw<CounterRow[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "updatedAt")
    VALUES (${key}, 1, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" <= ${windowStartCutoff} THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" <= ${windowStartCutoff} THEN ${now}
        ELSE "RateLimit"."windowStart"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "windowStart"
  `;

  const row = rows[0];
  if (row === undefined) {
    // Unreachable with RETURNING on an upsert, but failing open here would
    // silently disable the limiter, so this fails closed instead.
    return { allowed: false, retryAfterSeconds: rule.windowSeconds };
  }

  if (row.count <= rule.limit) {
    return { allowed: true };
  }

  const windowEndsAt = row.windowStart.getTime() + rule.windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEndsAt - now.getTime()) / 1000));
  return { allowed: false, retryAfterSeconds };
}

/**
 * Forgets a key entirely.
 *
 * Called after a genuinely successful attempt, so a customer who mistypes
 * their password three times and then gets it right is not still carrying
 * three strikes for the next quarter of an hour. Without this, the limiter
 * would punish exactly the people it is not meant to.
 *
 * `deleteMany`, not `delete`: a key that was never used is not an error.
 */
export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}
