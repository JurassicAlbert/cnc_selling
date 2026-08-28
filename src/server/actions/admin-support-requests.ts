'use server';

/**
 * Staff `SupportRequest` mutations — status + internal notes only. Same
 * `applyXxx(staff, ...)` / `xxx(...)` split as every other admin action
 * file. No delete — a real record of a real customer contact.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import type { SupportRequestStatus } from '@/generated/prisma/enums';

export type SupportRequestMutationResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

const VALID_STATUSES: readonly SupportRequestStatus[] = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export async function applyUpdateSupportRequest(
  staff: CurrentSession,
  id: string,
  status: SupportRequestStatus,
  adminNotesPl: string | null,
): Promise<SupportRequestMutationResult> {
  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, detail: 'Nieprawidłowy status zgłoszenia.' };
  }
  const current = await prisma.supportRequest.findUnique({ where: { id }, select: { status: true, adminNotesPl: true } });
  if (current === null) {
    return { ok: false, detail: 'Zgłoszenie nie istnieje.' };
  }

  await prisma.supportRequest.update({ where: { id }, data: { status, adminNotesPl } });
  await writeAuditLog({
    actor: staff,
    entity: 'SupportRequest',
    entityId: id,
    action: 'update',
    diff: { status: { from: current.status, to: status }, adminNotesPl: { from: current.adminNotesPl, to: adminNotesPl } },
  });

  return { ok: true };
}

export async function updateSupportRequest(id: string, formData: FormData): Promise<SupportRequestMutationResult> {
  const staff = await requireStaffSession();
  const status = String(formData.get('status') ?? 'NEW') as SupportRequestStatus;
  const adminNotesRaw = formData.get('adminNotesPl');
  const adminNotesPl = typeof adminNotesRaw === 'string' && adminNotesRaw.trim().length > 0 ? adminNotesRaw.trim() : null;

  const result = await applyUpdateSupportRequest(staff, id, status, adminNotesPl);
  if (result.ok) {
    revalidatePath(`/panel/kontakt/${id}`);
    revalidatePath('/panel/kontakt');
  }
  return result;
}
