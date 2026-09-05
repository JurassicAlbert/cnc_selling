/**
 * Best-effort client IP for the current request.
 *
 * Extracted from `actions/upload.ts` once a second real caller needed it
 * (`docs/REVIEW-DETAILED.md` SEC-01's throttles), rather than copying
 * security-relevant header parsing into two places that could drift.
 *
 * `X-Forwarded-For` is set by virtually every reverse proxy and CDN in
 * front of a real deployment, and the first entry is the original client.
 * **It is client-controllable when nothing trusted sets it**, so this is
 * only ever used for rate limiting and for the `ipConfirmedIp` consent
 * record - never as an authorization input.
 *
 * `null` in local development with no proxy in front, and in the e2e
 * suite. That is honest rather than a value to invent, and every caller
 * treats `null` as "this dimension does not apply" instead of folding
 * every unattributable request into one shared bucket - see
 * `rate-limit/auth-throttle.ts` for why that distinction matters.
 */

import { headers } from 'next/headers';

export async function requestIpAddress(): Promise<string | null> {
  const store = await headers();
  const forwardedFor = store.get('x-forwarded-for');
  const first = forwardedFor?.split(',')[0]?.trim();
  return first !== undefined && first.length > 0 ? first : null;
}
