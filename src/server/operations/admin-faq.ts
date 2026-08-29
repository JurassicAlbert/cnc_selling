/** Staff FAQ mutations. Same `applyXxx(staff, ...)` / `xxx(...)` split as every other admin action file — `revalidatePath` only in the wrapper. No delete — `isActive` toggle only, consistent with every other panel entity. */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type FaqFormInput = {
  readonly questionPl: string;
  readonly answerPl: string;
  readonly sortOrder: number;
};

export type FaqMutationResult = { readonly ok: true; readonly id: string } | { readonly ok: false; readonly detail: string };

function validateFaqInput(input: FaqFormInput): string | null {
  if (input.questionPl.trim().length === 0) {
    return 'Pytanie jest wymagane.';
  }
  if (input.answerPl.trim().length === 0) {
    return 'Odpowiedź jest wymagana.';
  }
  return null;
}

export async function applyCreateFaq(staff: CurrentSession, input: FaqFormInput): Promise<FaqMutationResult> {
  const issue = validateFaqInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const faq = await prisma.faq.create({ data: input });
  await writeAuditLog({ actor: staff, entity: 'Faq', entityId: faq.id, action: 'create', diff: input });
  return { ok: true, id: faq.id };
}

export async function createFaq(input: FaqFormInput): Promise<FaqMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateFaq(staff, input);
  if (result.ok) {
    revalidatePath('/panel/faq');
    revalidatePath('/faq');
  }
  return result;
}

export async function applyUpdateFaq(staff: CurrentSession, id: string, input: FaqFormInput): Promise<FaqMutationResult> {
  const issue = validateFaqInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const current = await prisma.faq.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Pytanie nie istnieje.' };
  }
  await prisma.faq.update({ where: { id }, data: input });
  await writeAuditLog({ actor: staff, entity: 'Faq', entityId: id, action: 'update', diff: { before: current, after: input } });
  return { ok: true, id };
}

export async function updateFaq(id: string, input: FaqFormInput): Promise<FaqMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateFaq(staff, id, input);
  if (result.ok) {
    revalidatePath('/panel/faq');
    revalidatePath('/faq');
  }
  return result;
}

export async function applySetFaqActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.faq.findUnique({ where: { id }, select: { isActive: true } });
  if (current === null) {
    return;
  }
  await prisma.faq.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'Faq',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });
}

export async function setFaqActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetFaqActive(staff, id, isActive);
  revalidatePath('/panel/faq');
  revalidatePath('/faq');
}
