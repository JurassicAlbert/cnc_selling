/**
 * The throttles for the actions that authenticate, register, or send mail
 * to a caller-supplied address - `docs/REVIEW-DETAILED.md` SEC-01.
 *
 * Why these exist at all: every auth form in this project calls
 * `auth.api.signInEmail(...)` and friends **directly** from a Server
 * Action. Better Auth does ship a rate limiter, but it is installed as its
 * HTTP router's `onRequest` hook, so it only ever runs for requests that
 * reach `auth.handler` - i.e. `/api/auth/*`, a path this application's own
 * forms never take. The result was unlimited password guessing and an
 * unmetered "email me a code" endpoint.
 *
 * These take `email`/`ip` as explicit parameters and read nothing from the
 * request, which is what makes them testable - the same split, for the
 * same reason, as every `apply*`/wrapper pair in `src/server/operations`.
 * The Server Actions read the real values and pass them in.
 */

import { clearRateLimit, consumeRateLimit } from './rate-limit';
import type { RateLimitRule, RateLimitVerdict } from './rate-limit';
import { AUTH_RATE_LIMITS } from './rules';

export type ThrottleVerdict = RateLimitVerdict;

const ALLOWED: ThrottleVerdict = { allowed: true };

/**
 * Addresses are compared case-insensitively everywhere else that matters
 * (Better Auth's own lookup, `User.email @unique` in practice), so the
 * counter has to agree - otherwise `Ala@example.pl` and `ala@example.pl`
 * would be five free attempts each.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailKey(action: string, email: string): string {
  return `${action}:email:${normalizeEmail(email)}`;
}

function ipKey(action: string, ip: string): string {
  return `${action}:ip:${ip}`;
}

/**
 * Runs every dimension and returns the harshest refusal, rather than
 * stopping at the first one.
 *
 * Deliberate: an attempt that is already refused by the email counter
 * should still count against the IP counter, or someone grinding a single
 * locked account would get an unlimited free ride on the IP dimension.
 * The longest `retryAfterSeconds` wins, because that is the one that is
 * actually true.
 */
async function consumeAll(
  entries: ReadonlyArray<{ readonly key: string; readonly rule: RateLimitRule }>,
  now: Date | undefined,
): Promise<ThrottleVerdict> {
  const verdicts = await Promise.all(
    entries.map((entry) => consumeRateLimit(entry.key, entry.rule, now)),
  );
  const refusals = verdicts.filter((verdict) => !verdict.allowed);
  if (refusals.length === 0) {
    return ALLOWED;
  }
  return refusals.reduce((worst, verdict) =>
    !worst.allowed && !verdict.allowed && verdict.retryAfterSeconds > worst.retryAfterSeconds ? verdict : worst,
  );
}

/**
 * `null` means there is genuinely no address to attribute this to: local
 * development, the e2e suite, and any deployment whose proxy does not set
 * `X-Forwarded-For`. Folding all of those into one shared `"ip:unknown"`
 * bucket would lock out every visitor simultaneously the moment traffic
 * picked up - a far worse failure than not applying this dimension. The
 * per-email limit still applies in every one of those cases.
 */
function ipEntry(
  action: string,
  ip: string | null,
  rule: RateLimitRule,
): ReadonlyArray<{ readonly key: string; readonly rule: RateLimitRule }> {
  return ip === null ? [] : [{ key: ipKey(action, ip), rule }];
}

export type AuthAttempt = { readonly email: string; readonly ip: string | null };

/** Counted on every login attempt, and cleared by `clearLoginAttempts` the moment one succeeds. */
export async function consumeLoginAttempt(attempt: AuthAttempt, now?: Date): Promise<ThrottleVerdict> {
  return consumeAll(
    [
      { key: emailKey('login', attempt.email), rule: AUTH_RATE_LIMITS.loginPerEmail },
      ...ipEntry('login', attempt.ip, AUTH_RATE_LIMITS.loginPerIp),
    ],
    now,
  );
}

/**
 * Called after a genuinely successful sign-in.
 *
 * Only the email counter is cleared, never the IP one: a successful login
 * proves this person owns this account, which says nothing about the other
 * nineteen attempts from the same address.
 */
export async function clearLoginAttempts(email: string): Promise<void> {
  await clearRateLimit(emailKey('login', email));
}

export async function consumeOtpRequest(attempt: AuthAttempt, now?: Date): Promise<ThrottleVerdict> {
  return consumeAll(
    [
      { key: emailKey('otp-request', attempt.email), rule: AUTH_RATE_LIMITS.otpRequestPerEmail },
      ...ipEntry('otp-request', attempt.ip, AUTH_RATE_LIMITS.otpRequestPerIp),
    ],
    now,
  );
}

export async function consumeRegisterAttempt(attempt: { readonly ip: string | null }, now?: Date): Promise<ThrottleVerdict> {
  return consumeAll(ipEntry('register', attempt.ip, AUTH_RATE_LIMITS.registerPerIp), now);
}

/** §16.1's "order creation per IP" - `docs/AUDIT-2026-08-30.md` P1-8, unblocked once the storage question was answered. */
export async function consumeOrderAttempt(attempt: { readonly ip: string | null }, now?: Date): Promise<ThrottleVerdict> {
  return consumeAll(ipEntry('order', attempt.ip, AUTH_RATE_LIMITS.orderPerIp), now);
}
