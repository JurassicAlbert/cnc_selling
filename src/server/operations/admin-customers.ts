/**
 * RODO anonymization — the "deletion" half of module 8's "data export and
 * deletion request handling." Same `applyXxx`/`xxx` split as every other
 * staff mutation this project uses: `applyAnonymizeCustomer` takes the
 * staff actor explicitly (real DB logic, directly testable),
 * `anonymizeCustomer` — the actual Server Action — derives it via
 * `requireStaffSession()`, which only works inside a real request.
 *
 * Scrubs `User` identity fields and revokes the ability to sign back in
 * (deletes `Session`/`Account` rows) — that is the real "deletion." It
 * deliberately does NOT touch `Order`, `Configuration`, `UploadedFile`, or
 * `CustomerDesign` rows: `src/content/pl/legal.ts`'s own RODO clause and
 * `docs/CHECKLIST.md`'s checklist bullet both specify order records are
 * retained (Polish accounting law), and neither `Configuration` nor
 * `UploadedFile` carries the customer's name/email/phone directly — only a
 * `userId` foreign key, which is exactly what gets orphaned by design.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type AnonymizeCustomerResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export async function applyAnonymizeCustomer(
  staff: CurrentSession,
  userId: string,
  notePl: string,
): Promise<AnonymizeCustomerResult> {
  if (notePl.trim().length === 0) {
    return { ok: false, detail: 'Anonimizacja konta wymaga podania notatki.' };
  }

  const customer = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, anonymizedAt: true } });
  if (customer === null || customer.role !== 'CUSTOMER') {
    return { ok: false, detail: 'Nie znaleziono klienta.' };
  }
  if (customer.anonymizedAt !== null) {
    return { ok: false, detail: 'To konto zostało już zanonimizowane.' };
  }

  const anonymizedAt = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Klient zanonimizowany',
        email: `zanonimizowany-${userId}@rodo.local`,
        phone: null,
        image: null,
        anonymizedAt,
      },
    }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
  ]);
  await writeAuditLog({
    actor: staff,
    entity: 'User',
    entityId: userId,
    action: 'update',
    diff: { notePl, anonymizedAt },
  });

  return { ok: true };
}

export async function anonymizeCustomer(userId: string, notePl: string): Promise<AnonymizeCustomerResult> {
  const staff = await requireStaffSession();
  const result = await applyAnonymizeCustomer(staff, userId, notePl);
  if (result.ok) {
    revalidatePath(`/panel/klienci/${userId}`);
    revalidatePath('/panel/klienci');
  }
  return result;
}
