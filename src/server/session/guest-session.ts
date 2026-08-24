/**
 * The signed guest-cart session token — `docs/ARCHITECTURE.md` §15.1's
 * "signed guest session cookie", and `Configuration.sessionToken`'s own
 * schema comment: "Signed cookie value, never derived from the request
 * body." This is the FIRST cookie-writing code in this codebase (P0–P4
 * never needed one — everything before P5 was either fully public
 * catalogue browsing or the configurator's own URL-encoded state).
 *
 * Signed, not just random, and deliberately a DIFFERENT mechanism from
 * `Order.accessToken` (32 random bytes, unsigned, "compared in constant
 * time"): an `accessToken` is minted once, shared once, for one order, to
 * one person — unguessability alone is enough. A guest `sessionToken` is a
 * long-lived cookie that is the SOLE ownership check for carts, uploaded
 * files and custom designs across an entire visit; signing lets a stored
 * value be rejected as tampered/forged cheaply, without a DB round trip,
 * which is exactly what "never derived from the request body" is guarding.
 *
 * Token format: `{randomToken}.{hmacSha256(randomToken)}`, base64url
 * throughout. The FULL string (both halves) is what gets stored in every
 * `*.sessionToken` DB column and compared by plain equality — signing
 * happens once, at mint time; every later check just re-derives the
 * signature and compares.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

function sign(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('base64url');
}

export function mintSignedSessionValue(secret: string): string {
  const token = randomBytes(32).toString('base64url');
  return `${token}.${sign(token, secret)}`;
}

/**
 * `timingSafeEqual` throws `RangeError` on a length mismatch rather than
 * returning `false` — guarded explicitly, since an attacker (or just a
 * stale/truncated cookie) supplying a wrong-length value must fail closed,
 * not crash the caller.
 */
export function isValidSignedSessionValue(value: string, secret: string): boolean {
  const dot = value.lastIndexOf('.');
  if (dot === -1) {
    return false;
  }
  const token = value.slice(0, dot);
  const providedSignature = Buffer.from(value.slice(dot + 1));
  const expectedSignature = Buffer.from(sign(token, secret));
  return (
    providedSignature.length === expectedSignature.length &&
    timingSafeEqual(providedSignature, expectedSignature)
  );
}

export function requireSessionSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (value === undefined || value.length === 0) {
    throw new Error('SESSION_SECRET is not set — check your .env');
  }
  return value;
}
