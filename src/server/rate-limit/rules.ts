/**
 * The actual limits. Kept in one file, separate from the mechanism, so
 * changing a number is a one-line review and never touches the atomic SQL
 * in `rate-limit.ts`.
 *
 * These are starting values, chosen to be comfortably above real human
 * behaviour and far below what an attack needs — not measured from
 * production traffic, because none exists yet. They are deliberately not
 * configurable from the admin panel: a rate limit an operator can raise
 * under pressure ("customers are complaining") is a rate limit that gets
 * raised at exactly the wrong moment.
 *
 * Two dimensions per action, where both make sense:
 *
 *   - **per identity** (email) catches someone grinding one account from
 *     many addresses,
 *   - **per IP** catches someone spraying many accounts from one place.
 *
 * Neither alone is enough, and the IP dimension is skipped entirely when
 * there is no IP to attribute — see `auth-throttle.ts` for why.
 */

import type { RateLimitRule } from './rate-limit';

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const AUTH_RATE_LIMITS = {
  /**
   * Five wrong passwords in a quarter of an hour. A customer who has
   * genuinely forgotten which password they used gets several real tries,
   * and the counter is cleared the moment they succeed
   * (`clearLoginAttempts`), so this can only ever accumulate against
   * someone who keeps failing.
   */
  loginPerEmail: { limit: 5, windowSeconds: 15 * MINUTE },
  /** Deliberately generous: a household, an office or a mobile carrier NAT can legitimately share one address. */
  loginPerIp: { limit: 20, windowSeconds: 15 * MINUTE },

  /**
   * The tightest limit here, because this is the one endpoint that makes
   * the shop send mail to an address chosen by the caller. Three codes an
   * hour is more than a real person needs and useless as an inbox flood.
   */
  otpRequestPerEmail: { limit: 3, windowSeconds: 1 * HOUR },
  otpRequestPerIp: { limit: 10, windowSeconds: 1 * HOUR },

  /** Ten new accounts a day from one address is already implausible for a workshop's storefront. */
  registerPerIp: { limit: 10, windowSeconds: 1 * DAY },

  /**
   * §16.1's "order creation per IP" (`docs/AUDIT-2026-08-30.md` P1-8, open
   * until the storage question was answered). Ten in an hour is far above
   * any real customer — the guard is against a script, not against someone
   * ordering twice. Order *duplication* is a different problem, already
   * solved by `Order.idempotencyKey` and cart claiming.
   */
  orderPerIp: { limit: 10, windowSeconds: 1 * HOUR },
} as const satisfies Record<string, RateLimitRule>;
