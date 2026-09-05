/**
 * Staff blog-post mutations. Same `applyXxx(staff, ...)` / `xxx(...)` split
 * as every other admin action file. No delete - `isActive` toggle only,
 * matching `admin-static-pages.ts`'s own convention exactly.
 *
 * `publishedAt` is a real draft/scheduled-publish mechanism already built
 * into `blog.ts`'s public query (`isActive && publishedAt` set and not in
 * the future - a null `publishedAt` is a draft) - this is the first admin
 * screen to actually let staff set it, rather than only the seed script.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type BlogPostFormInput = {
  readonly slug: string;
  readonly titlePl: string;
  readonly shortDescPl: string;
  readonly bodyPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
  /** `null` = draft, never public. */
  readonly publishedAt: Date | null;
};

export type BlogPostMutationResult = { readonly ok: true; readonly id: string } | { readonly ok: false; readonly detail: string };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateBlogPostInput(input: BlogPostFormInput): string | null {
  if (!SLUG_PATTERN.test(input.slug)) {
    return 'Identyfikator URL może zawierać tylko małe litery, cyfry i myślniki.';
  }
  if (input.titlePl.trim().length === 0) {
    return 'Tytuł jest wymagany.';
  }
  if (input.shortDescPl.trim().length === 0) {
    return 'Krótki opis jest wymagany.';
  }
  if (input.bodyPl.trim().length === 0) {
    return 'Treść jest wymagana.';
  }
  return null;
}

export async function applyCreateBlogPost(staff: CurrentSession, input: BlogPostFormInput): Promise<BlogPostMutationResult> {
  const issue = validateBlogPostInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const existing = await prisma.blogPost.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (existing !== null) {
    return { ok: false, detail: 'Wpis z tym identyfikatorem URL już istnieje.' };
  }
  const post = await prisma.blogPost.create({ data: input });
  await writeAuditLog({ actor: staff, entity: 'BlogPost', entityId: post.id, action: 'create', diff: input });
  return { ok: true, id: post.id };
}

export async function createBlogPost(input: BlogPostFormInput): Promise<BlogPostMutationResult> {
  const staff = await requireAdminSession();
  const result = await applyCreateBlogPost(staff, input);
  if (result.ok) {
    revalidatePath('/panel/blog');
    revalidatePath('/blog');
    revalidatePath(`/blog/${input.slug}`);
  }
  return result;
}

export async function applyUpdateBlogPost(staff: CurrentSession, id: string, input: BlogPostFormInput): Promise<BlogPostMutationResult> {
  const issue = validateBlogPostInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const current = await prisma.blogPost.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Wpis nie istnieje.' };
  }
  if (current.slug !== input.slug) {
    const clashing = await prisma.blogPost.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (clashing !== null) {
      return { ok: false, detail: 'Wpis z tym identyfikatorem URL już istnieje.' };
    }
  }
  await prisma.blogPost.update({ where: { id }, data: input });
  await writeAuditLog({ actor: staff, entity: 'BlogPost', entityId: id, action: 'update', diff: { before: current, after: input } });
  return { ok: true, id };
}

export async function updateBlogPost(id: string, input: BlogPostFormInput): Promise<BlogPostMutationResult> {
  const staff = await requireAdminSession();
  const result = await applyUpdateBlogPost(staff, id, input);
  if (result.ok) {
    revalidatePath('/panel/blog');
    revalidatePath(`/panel/blog/${id}`);
    revalidatePath('/blog');
    revalidatePath(`/blog/${input.slug}`);
  }
  return result;
}

export async function applySetBlogPostActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.blogPost.findUnique({ where: { id }, select: { isActive: true, slug: true } });
  if (current === null) {
    return;
  }
  await prisma.blogPost.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'BlogPost',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });
}

export async function setBlogPostActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireAdminSession();
  const current = await prisma.blogPost.findUnique({ where: { id }, select: { slug: true } });
  await applySetBlogPostActive(staff, id, isActive);
  revalidatePath('/panel/blog');
  revalidatePath(`/panel/blog/${id}`);
  revalidatePath('/blog');
  if (current !== null) {
    revalidatePath(`/blog/${current.slug}`);
  }
}
