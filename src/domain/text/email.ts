/**
 * A deliberately loose plausibility check, not full RFC 5322 validation —
 * the point is catching an obviously-wrong value ("test", "a@b") before it
 * reaches a mutation, not rejecting every technically-unusual but real
 * address. Real deliverability is proven by the OTP/verification email
 * actually arriving, not by a regex.
 *
 * Previously duplicated verbatim in `auth.ts` and `checkout.ts` (both
 * customer-facing forms) — extracted here so `admin-staff.ts`'s staff
 * invite could reuse it too, rather than adding a third private copy. Found
 * while auditing every Server Action for real backend validation
 * (`docs/CHECKLIST.md`'s own line): `applyInviteStaffUser` checked `email`
 * for non-empty but never for a plausible shape, so a typo'd invite (e.g.
 * "admin" instead of "admin@example.com") silently created a permanently
 * unreachable STAFF/ADMIN account — no OTP could ever be delivered to it,
 * and nothing in the UI would explain why the invited person could never
 * sign in.
 */
export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
