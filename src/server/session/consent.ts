/**
 * The RODO/cookie consent choice — P6 Part E. A first-party cookie, not
 * `localStorage`: it has to be readable server-side (`layout.tsx` decides
 * whether to still show the banner; `record-event.ts` decides whether an
 * analytics write is allowed at all) — a client-only store can't gate a
 * server-side decision without an extra round trip.
 *
 * Deliberately a THIRD, separate cookie from the guest-session (`gsid`) and
 * Better Auth's own session cookie — same "different mechanism, different
 * blast radius" reasoning `.env.example` already states for those two:
 * `gsid`/the auth session are strictly necessary (cart/login cannot
 * function without them) and are never consent-gated; this cookie is
 * itself the ONE thing that IS optional here; conflating it with either
 * would make an essential cookie look consent-dependent.
 */

import { cookies } from 'next/headers';

export const CONSENT_COOKIE_NAME = 'consent';

export type ConsentChoice = 'accepted' | 'declined';

const SITE_IS_HTTPS = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');
const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** `null` means no choice has been made yet — the caller should show the banner. */
export async function readConsentChoice(): Promise<ConsentChoice | null> {
  const store = await cookies();
  const value = store.get(CONSENT_COOKIE_NAME)?.value;
  return value === 'accepted' || value === 'declined' ? value : null;
}

export async function writeConsentChoice(choice: ConsentChoice): Promise<void> {
  const store = await cookies();
  store.set(CONSENT_COOKIE_NAME, choice, {
    httpOnly: true,
    secure: SITE_IS_HTTPS,
    sameSite: 'lax',
    path: '/',
    maxAge: CONSENT_COOKIE_MAX_AGE_SECONDS,
  });
}
