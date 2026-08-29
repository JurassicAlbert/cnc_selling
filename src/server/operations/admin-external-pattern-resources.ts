/** Staff external-pattern-resource mutations. Same `applyXxx(staff, ...)` / `xxx(...)` split as every other admin action file — `revalidatePath` only in the wrapper. No delete — `isActive` toggle only, consistent with every other panel entity. */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type ExternalPatternResourceFormInput = {
  readonly namePl: string;
  readonly url: string;
  readonly descPl: string;
  readonly sourceLabel: string;
  readonly sortOrder: number;
};

export type ExternalPatternResourceMutationResult = { readonly ok: true; readonly id: string } | { readonly ok: false; readonly detail: string };

/** Only ever rendered as a real `<a href>` — reject anything that isn't an actual http(s) link, e.g. a `javascript:` URI. */
function isPlausibleHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateExternalPatternResourceInput(input: ExternalPatternResourceFormInput): string | null {
  if (input.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  if (input.sourceLabel.trim().length === 0) {
    return 'Etykieta źródła jest wymagana.';
  }
  if (!isPlausibleHttpUrl(input.url)) {
    return 'Adres URL musi być prawidłowym linkiem http(s).';
  }
  return null;
}

export async function applyCreateExternalPatternResource(
  staff: CurrentSession,
  input: ExternalPatternResourceFormInput,
): Promise<ExternalPatternResourceMutationResult> {
  const issue = validateExternalPatternResourceInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const resource = await prisma.externalPatternResource.create({
    data: { ...input, descPl: input.descPl.trim().length > 0 ? input.descPl : null },
  });
  await writeAuditLog({ actor: staff, entity: 'ExternalPatternResource', entityId: resource.id, action: 'create', diff: input });
  return { ok: true, id: resource.id };
}

export async function createExternalPatternResource(input: ExternalPatternResourceFormInput): Promise<ExternalPatternResourceMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateExternalPatternResource(staff, input);
  if (result.ok) {
    revalidatePath('/panel/zasoby-zewnetrzne');
    revalidatePath('/wzory');
  }
  return result;
}

export async function applyUpdateExternalPatternResource(
  staff: CurrentSession,
  id: string,
  input: ExternalPatternResourceFormInput,
): Promise<ExternalPatternResourceMutationResult> {
  const issue = validateExternalPatternResourceInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const current = await prisma.externalPatternResource.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Zasób nie istnieje.' };
  }
  const data = { ...input, descPl: input.descPl.trim().length > 0 ? input.descPl : null };
  await prisma.externalPatternResource.update({ where: { id }, data });
  await writeAuditLog({ actor: staff, entity: 'ExternalPatternResource', entityId: id, action: 'update', diff: { before: current, after: data } });
  return { ok: true, id };
}

export async function updateExternalPatternResource(
  id: string,
  input: ExternalPatternResourceFormInput,
): Promise<ExternalPatternResourceMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateExternalPatternResource(staff, id, input);
  if (result.ok) {
    revalidatePath('/panel/zasoby-zewnetrzne');
    revalidatePath('/wzory');
  }
  return result;
}

export async function applySetExternalPatternResourceActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.externalPatternResource.findUnique({ where: { id }, select: { isActive: true } });
  if (current === null) {
    return;
  }
  await prisma.externalPatternResource.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'ExternalPatternResource',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });
}

export async function setExternalPatternResourceActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetExternalPatternResourceActive(staff, id, isActive);
  revalidatePath('/panel/zasoby-zewnetrzne');
  revalidatePath('/wzory');
}
