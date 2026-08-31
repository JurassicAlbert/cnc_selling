/**
 * Email-template edits — subject/body only, the same closed set `mailer.ts`
 * already knows about (`EmailTemplate.key` matches `MailTemplate`). No
 * create/delete action exists: every key this project will ever have is
 * already seeded (`prisma/seed.ts`'s `seedEmailTemplates`).
 *
 * **`ADMIN`, not `STAFF`** — changed 2026-08-31, `docs/REVIEW-DETAILED.md`
 * SEC-04. These bodies are customer-facing email, `verification-otp`
 * included: whoever can rewrite them can rewrite what a sign-in message
 * says and where it tells the reader to go. `refuseUnlessAdmin` repeats the
 * wrapper's gate inside the `apply` so a test can reach it — see
 * `admin-only.ts`.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { refuseUnlessAdmin } from './admin-only';

export type UpdateEmailTemplateResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export async function applyUpdateEmailTemplate(
  admin: CurrentSession,
  key: string,
  input: { readonly subjectPl: string; readonly bodyPl: string },
): Promise<UpdateEmailTemplateResult> {
  const refusal = refuseUnlessAdmin(admin);
  if (refusal !== null) {
    return refusal;
  }

  const subjectPl = input.subjectPl.trim();
  const bodyPl = input.bodyPl.trim();
  if (subjectPl.length === 0 || bodyPl.length === 0) {
    return { ok: false, detail: 'Temat i treść są wymagane.' };
  }

  const existing = await prisma.emailTemplate.findUnique({ where: { key }, select: { id: true } });
  if (existing === null) {
    return { ok: false, detail: 'Nie znaleziono szablonu.' };
  }

  await prisma.emailTemplate.update({ where: { key }, data: { subjectPl, bodyPl, updatedByEmail: admin.email } });
  await writeAuditLog({ actor: admin, entity: 'EmailTemplate', entityId: key, action: 'update', diff: { subjectPl, bodyPl } });

  return { ok: true };
}

export async function updateEmailTemplate(
  key: string,
  input: { readonly subjectPl: string; readonly bodyPl: string },
): Promise<UpdateEmailTemplateResult> {
  const admin = await requireAdminSession();
  const result = await applyUpdateEmailTemplate(admin, key, input);
  if (result.ok) {
    revalidatePath('/panel/ustawienia/szablony');
    revalidatePath(`/panel/ustawienia/szablony/${key}`);
  }
  return result;
}
