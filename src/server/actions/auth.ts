'use server';

/**
 * Login/register/OTP/logout Server Actions — follows `checkout.ts`'s
 * `submitCheckout`/`useActionState` shape exactly (see that file's header
 * comment for why: real server-validated submission with inline field
 * errors, echoed values, for the cost of one small client island).
 *
 * Every successful sign-in path (password login, register, OTP login) ends
 * the same way: merge whatever guest cart this visit had
 * (`mergeGuestCartIntoUser`, Part B) into the now-authenticated user's cart,
 * then redirect. `nextCookies()` in `auth.ts`'s plugin list is what makes
 * `auth.api.signInEmail`/`signUpEmail`/`signInEmailOTP` actually set the
 * session cookie when called from here — a Server Action is exactly the
 * request scope that plugin's `after` hook needs.
 */

import { headers as nextHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { APIError } from 'better-auth';

import type { AuthFieldIssueCode, AuthFormErrorCode } from '@/content/pl/messages';
import { auth } from '@/server/auth/auth';
import { mergeGuestCartIntoUser } from '@/server/cart/merge-guest-cart';
import { prisma } from '@/server/db/client';
import { readGuestSessionToken } from '@/server/session/read-guest-session';

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Maps a caught `APIError` to the ONE code its call site actually expects
 * (`expectedCode`, Better Auth's own string — e.g.
 * `'INVALID_EMAIL_OR_PASSWORD'`) — anything else is a genuinely
 * unanticipated failure (a misconfigured origin, a DB error surfaced as an
 * APIError, etc.), logged rather than silently relabelled as the expected
 * one. An earlier version of this file mapped every `APIError` straight to
 * the expected code regardless of `error.body?.code`, which meant a
 * config-level failure during registration displayed as "an account with
 * this email already exists" — plausible-looking, and wrong. Found live in
 * the browser, not by code review.
 */
function mapAuthError(
  error: APIError,
  expectedCodes: readonly string[],
  mappedTo: AuthFormErrorCode,
): AuthFormErrorCode {
  if (error.body?.code !== undefined && expectedCodes.includes(error.body.code)) {
    return mappedTo;
  }
  console.error('[auth] unexpected error from Better Auth:', error.body ?? error);
  return 'UNKNOWN';
}

/**
 * Not extracted into a `redirect()`-ending helper: `redirect()`'s `never`
 * return type only lets TypeScript treat the rest of a function as
 * unreachable when the call is the caller's OWN last statement, not when
 * it happens inside an awaited helper one level down — confirmed by trying
 * exactly that and getting "Function lacks ending return statement" at each
 * of the three call sites below. `checkout.ts`'s `submitCheckout` ends with
 * a bare `redirect(...)` for the same reason.
 *
 * `STAFF`/`ADMIN` land on `/panel` directly, not `/moje-konto` — found live
 * (2026-08-27): the owner signed in with a real staff OTP and landed on the
 * plain customer account page with no indication the admin panel was a
 * separate destination, genuinely confusing. A small extra `role` lookup,
 * not read off Better Auth's own result — `signInEmailOTP`'s returned
 * `user` doesn't carry the custom `role` field (confirmed by `tsc`:
 * `signInEmail`/`signUpEmail`'s results do, `signInEmailOTP`'s doesn't),
 * so this queries it directly rather than relying on an inconsistent shape
 * across Better Auth's own sign-in methods.
 */
async function mergeAndGetRedirectTarget(userId: string): Promise<string> {
  const guestSessionToken = await readGuestSessionToken();
  await mergeGuestCartIntoUser(userId, guestSessionToken);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === 'STAFF' || user?.role === 'ADMIN' ? '/panel' : '/moje-konto';
}

export type LoginFormState = {
  readonly fieldErrors: Partial<Record<'email' | 'password', AuthFieldIssueCode>>;
  readonly formError: AuthFormErrorCode | null;
  readonly values: Partial<Record<'email', string>>;
};

export async function submitLogin(_prevState: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const email = field(formData, 'email');
  const password = field(formData, 'password');

  const fieldErrors: LoginFormState['fieldErrors'] = {};
  if (email.length === 0) fieldErrors.email = 'EMAIL_REQUIRED';
  else if (!isPlausibleEmail(email)) fieldErrors.email = 'EMAIL_INVALID';
  if (password.length === 0) fieldErrors.password = 'PASSWORD_REQUIRED';

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: null, values: { email } };
  }

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: await nextHeaders(),
    });
    redirect(await mergeAndGetRedirectTarget(result.user.id));
  } catch (error) {
    if (error instanceof APIError) {
      const formError = mapAuthError(error, ['INVALID_EMAIL_OR_PASSWORD'], 'INVALID_CREDENTIALS');
      return { fieldErrors: {}, formError, values: { email } };
    }
    throw error;
  }
}

export type RegisterFormState = {
  readonly fieldErrors: Partial<Record<'name' | 'email' | 'password', AuthFieldIssueCode>>;
  readonly formError: AuthFormErrorCode | null;
  readonly values: Partial<Record<'name' | 'email', string>>;
};

export async function submitRegister(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const name = field(formData, 'name');
  const email = field(formData, 'email');
  const password = field(formData, 'password');

  const fieldErrors: RegisterFormState['fieldErrors'] = {};
  if (name.length === 0) fieldErrors.name = 'NAME_REQUIRED';
  if (email.length === 0) fieldErrors.email = 'EMAIL_REQUIRED';
  else if (!isPlausibleEmail(email)) fieldErrors.email = 'EMAIL_INVALID';
  if (password.length === 0) fieldErrors.password = 'PASSWORD_REQUIRED';
  else if (password.length < 8) fieldErrors.password = 'PASSWORD_TOO_SHORT';

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: null, values: { name, email } };
  }

  try {
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
      headers: await nextHeaders(),
    });
    redirect(await mergeAndGetRedirectTarget(result.user.id));
  } catch (error) {
    if (error instanceof APIError) {
      const formError = mapAuthError(error, ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'], 'EMAIL_ALREADY_EXISTS');
      return { fieldErrors: {}, formError, values: { name, email } };
    }
    throw error;
  }
}

export type OtpRequestFormState = {
  readonly fieldErrors: Partial<Record<'email', AuthFieldIssueCode>>;
  readonly formError: AuthFormErrorCode | null;
  readonly values: Partial<Record<'email', string>>;
  readonly sent: boolean;
};

export async function submitOtpRequest(
  _prevState: OtpRequestFormState,
  formData: FormData,
): Promise<OtpRequestFormState> {
  const email = field(formData, 'email');

  const fieldErrors: OtpRequestFormState['fieldErrors'] = {};
  if (email.length === 0) fieldErrors.email = 'EMAIL_REQUIRED';
  else if (!isPlausibleEmail(email)) fieldErrors.email = 'EMAIL_INVALID';

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: null, values: { email }, sent: false };
  }

  try {
    await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });
    return { fieldErrors: {}, formError: null, values: { email }, sent: true };
  } catch (error) {
    if (error instanceof APIError) {
      console.error('[auth] unexpected error from Better Auth:', error.body ?? error);
      return { fieldErrors: {}, formError: 'UNKNOWN', values: { email }, sent: false };
    }
    throw error;
  }
}

export type OtpLoginFormState = {
  readonly fieldErrors: Partial<Record<'email' | 'otp', AuthFieldIssueCode>>;
  readonly formError: AuthFormErrorCode | null;
  readonly values: Partial<Record<'email', string>>;
};

export async function submitOtpLogin(
  _prevState: OtpLoginFormState,
  formData: FormData,
): Promise<OtpLoginFormState> {
  const email = field(formData, 'email');
  const otp = field(formData, 'otp');

  const fieldErrors: OtpLoginFormState['fieldErrors'] = {};
  if (email.length === 0) fieldErrors.email = 'EMAIL_REQUIRED';
  else if (!isPlausibleEmail(email)) fieldErrors.email = 'EMAIL_INVALID';
  if (otp.length === 0) fieldErrors.otp = 'OTP_REQUIRED';

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, formError: null, values: { email } };
  }

  try {
    const result = await auth.api.signInEmailOTP({
      body: { email, otp },
      headers: await nextHeaders(),
    });
    redirect(await mergeAndGetRedirectTarget(result.user.id));
  } catch (error) {
    if (error instanceof APIError) {
      const formError = mapAuthError(error, ['INVALID_OTP', 'OTP_EXPIRED'], 'OTP_INVALID');
      return { fieldErrors: {}, formError, values: { email } };
    }
    throw error;
  }
}

export async function logout(): Promise<void> {
  await auth.api.signOut({ headers: await nextHeaders() });
  redirect('/');
}
