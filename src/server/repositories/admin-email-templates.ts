/**
 * Admin queries over `EmailTemplate` — the fixed, small set of DB-editable
 * overrides for `mailer.ts`'s hardcoded default copy. Edit-only from the
 * panel (no create/delete UI), matching the closed `MailTemplate` union.
 */

import { prisma } from '@/server/db/client';

export type AdminEmailTemplateListItem = {
  readonly key: string;
  readonly subjectPl: string;
  readonly updatedAt: Date;
};

export async function listEmailTemplates(): Promise<readonly AdminEmailTemplateListItem[]> {
  const templates = await prisma.emailTemplate.findMany({
    orderBy: { key: 'asc' },
    select: { key: true, subjectPl: true, updatedAt: true },
  });
  return templates;
}

export type AdminEmailTemplateDetail = {
  readonly key: string;
  readonly subjectPl: string;
  readonly bodyPl: string;
};

export async function findEmailTemplate(key: string): Promise<AdminEmailTemplateDetail | null> {
  return prisma.emailTemplate.findUnique({ where: { key }, select: { key: true, subjectPl: true, bodyPl: true } });
}
