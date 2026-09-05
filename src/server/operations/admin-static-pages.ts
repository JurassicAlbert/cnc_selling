/** Staff static-page mutations. Same `applyXxx(staff, ...)` / `xxx(...)` split as every other admin action file. No delete - `isActive` toggle only. */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type StaticPageFormInput = {
  readonly slug: string;
  readonly titlePl: string;
  readonly bodyPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly sortOrder: number;
};

export type StaticPageMutationResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly detail: string };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateStaticPageInput(input: StaticPageFormInput): string | null {
  if (!SLUG_PATTERN.test(input.slug)) {
    return 'Identyfikator URL może zawierać tylko małe litery, cyfry i myślniki.';
  }
  if (input.titlePl.trim().length === 0) {
    return 'Tytuł jest wymagany.';
  }
  if (input.bodyPl.trim().length === 0) {
    return 'Treść jest wymagana.';
  }
  return null;
}

export async function applyCreateStaticPage(staff: CurrentSession, input: StaticPageFormInput): Promise<StaticPageMutationResult> {
  const issue = validateStaticPageInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const existing = await prisma.staticPage.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (existing !== null) {
    return { ok: false, detail: 'Strona z tym identyfikatorem URL już istnieje.' };
  }
  const page = await prisma.staticPage.create({ data: input });
  await writeAuditLog({ actor: staff, entity: 'StaticPage', entityId: page.id, action: 'create', diff: input });
  return { ok: true, id: page.id };
}

export async function createStaticPage(input: StaticPageFormInput): Promise<StaticPageMutationResult> {
  const staff = await requireAdminSession();
  const result = await applyCreateStaticPage(staff, input);
  if (result.ok) {
    revalidatePath('/panel/strony');
    revalidatePath(`/strony/${input.slug}`);
  }
  return result;
}

export async function applyUpdateStaticPage(
  staff: CurrentSession,
  id: string,
  input: StaticPageFormInput,
): Promise<StaticPageMutationResult> {
  const issue = validateStaticPageInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const current = await prisma.staticPage.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Strona nie istnieje.' };
  }
  if (current.slug !== input.slug) {
    const clashing = await prisma.staticPage.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Strona z tym identyfikatorem URL już istnieje.' };
    }
  }
  await prisma.staticPage.update({ where: { id }, data: input });
  await writeAuditLog({
    actor: staff,
    entity: 'StaticPage',
    entityId: id,
    action: 'update',
    diff: { before: current, after: input },
  });
  return { ok: true, id };
}

export async function updateStaticPage(id: string, input: StaticPageFormInput): Promise<StaticPageMutationResult> {
  const staff = await requireAdminSession();
  const result = await applyUpdateStaticPage(staff, id, input);
  if (result.ok) {
    revalidatePath('/panel/strony');
    revalidatePath(`/panel/strony/${id}`);
    revalidatePath(`/strony/${input.slug}`);
  }
  return result;
}

export async function applySetStaticPageActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.staticPage.findUnique({ where: { id }, select: { isActive: true, slug: true } });
  if (current === null) {
    return;
  }
  await prisma.staticPage.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'StaticPage',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });
}

export async function setStaticPageActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireAdminSession();
  const current = await prisma.staticPage.findUnique({ where: { id }, select: { slug: true } });
  await applySetStaticPageActive(staff, id, isActive);
  revalidatePath('/panel/strony');
  revalidatePath(`/panel/strony/${id}`);
  if (current !== null) {
    revalidatePath(`/strony/${current.slug}`);
  }
}
