'use server';

/**
 * Email-template edits — subject/body only, the same closed set `mailer.ts`
 * already knows about (`EmailTemplate.key` matches `MailTemplate`). No
 * create/delete action exists: every key this project will ever have is
 * already seeded (`prisma/seed.ts`'s `seedEmailTemplates`).
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type UpdateEmailTemplateResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export async function applyUpdateEmailTemplate(
  staff: CurrentSession,
  key: string,
  input: { readonly subjectPl: string; readonly bodyPl: string },
): Promise<UpdateEmailTemplateResult> {
  const subjectPl = input.subjectPl.trim();
  const bodyPl = input.bodyPl.trim();
  if (subjectPl.length === 0 || bodyPl.length === 0) {
    return { ok: false, detail: 'Temat i treść są wymagane.' };
  }

  const existing = await prisma.emailTemplate.findUnique({ where: { key }, select: { id: true } });
  if (existing === null) {
    return { ok: false, detail: 'Nie znaleziono szablonu.' };
  }

  await prisma.emailTemplate.update({ where: { key }, data: { subjectPl, bodyPl, updatedByEmail: staff.email } });
  await writeAuditLog({ actor: staff, entity: 'EmailTemplate', entityId: key, action: 'update', diff: { subjectPl, bodyPl } });

  return { ok: true };
}

export async function updateEmailTemplate(
  key: string,
  input: { readonly subjectPl: string; readonly bodyPl: string },
): Promise<UpdateEmailTemplateResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateEmailTemplate(staff, key, input);
  if (result.ok) {
    revalidatePath('/panel/ustawienia/szablony');
    revalidatePath(`/panel/ustawienia/szablony/${key}`);
  }
  return result;
}
