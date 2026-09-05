/**
 * Staff-user management - the highest-privilege action in the panel
 * (minting accounts with panel access), so both mutations here derive
 * `requireAdminSession()`, not `requireStaffSession()`: a `STAFF` session
 * cannot invite or reassign anyone, only an `ADMIN` can.
 *
 * Inviting a staff member needs no password-setting flow: `auth.ts` already
 * has a working OTP sign-in path (`src/server/actions/auth.ts`'s
 * `signInEmailOTP` wiring), and Better Auth's `signInEmailOTP` works for
 * any existing `User` row regardless of whether it has an `Account`/
 * password at all. So `applyInviteStaffUser` only ever needs to create the
 * bare `User` row - the new staffer signs in at `/logowanie` with a code,
 * exactly like a real customer already can.
 */

import { revalidatePath } from 'next/cache';

import { isPlausibleEmail } from '@/domain/text/email';
import { prisma } from '@/server/db/client';
import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import type { UserRole } from '@/generated/prisma/enums';

export type InviteStaffUserInput = {
  readonly name: string;
  readonly email: string;
  readonly role: 'STAFF' | 'ADMIN';
};

export type InviteStaffUserResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export async function applyInviteStaffUser(admin: CurrentSession, input: InviteStaffUserInput): Promise<InviteStaffUserResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length === 0) {
    return { ok: false, detail: 'Imię i nazwisko jest wymagane.' };
  }
  if (email.length === 0) {
    return { ok: false, detail: 'E-mail jest wymagany.' };
  }
  if (!isPlausibleEmail(email)) {
    return { ok: false, detail: 'Podaj prawidłowy adres e-mail.' };
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing !== null) {
    return { ok: false, detail: 'Konto z tym adresem e-mail już istnieje.' };
  }

  const created = await prisma.user.create({ data: { name, email, role: input.role, emailVerified: true } });
  await writeAuditLog({ actor: admin, entity: 'User', entityId: created.id, action: 'create', diff: { role: input.role, email } });

  return { ok: true };
}

export async function inviteStaffUser(input: InviteStaffUserInput): Promise<InviteStaffUserResult> {
  const admin = await requireAdminSession();
  const result = await applyInviteStaffUser(admin, input);
  if (result.ok) {
    revalidatePath('/panel/ustawienia/personel');
  }
  return result;
}

export type ChangeStaffRoleResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export async function applyChangeStaffRole(
  admin: CurrentSession,
  userId: string,
  newRole: UserRole,
): Promise<ChangeStaffRoleResult> {
  if (userId === admin.userId) {
    return { ok: false, detail: 'Nie można zmienić własnej roli.' };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (target === null || (target.role !== 'STAFF' && target.role !== 'ADMIN')) {
    return { ok: false, detail: 'Nie znaleziono konta personelu.' };
  }

  await prisma.user.update({ where: { id: userId }, data: { role: newRole } });
  await writeAuditLog({
    actor: admin,
    entity: 'User',
    entityId: userId,
    action: 'update',
    diff: { role: { from: target.role, to: newRole } },
  });

  return { ok: true };
}

/**
 * Returns `Promise<void>`, not `ChangeStaffRoleResult` - this is the actual
 * Server Action a plain server-rendered `<form action={...}>` binds
 * directly (no client `useActionState` wrapper, matching `setFaqActive`/
 * `setReviewStatus`'s own precedent for one-click row actions). The page
 * itself already never renders a revoke control for the acting admin's own
 * row, so the self-demotion rejection in `applyChangeStaffRole` is real
 * defense-in-depth, not a path this UI can actually reach.
 */
export async function changeStaffRole(userId: string, newRole: UserRole): Promise<void> {
  const admin = await requireAdminSession();
  const result = await applyChangeStaffRole(admin, userId, newRole);
  if (result.ok) {
    revalidatePath('/panel/ustawienia/personel');
  }
}
