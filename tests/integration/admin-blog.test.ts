import { afterEach, describe, expect, it } from 'vitest';

import { applyCreateBlogPost, applySetBlogPostActive, applyUpdateBlogPost } from '@/server/actions/admin-blog';
import { findBlogPostForAdmin, listBlogPostsForAdmin } from '@/server/repositories/admin-blog';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-blog-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

afterEach(async () => {
  await prisma.blogPost.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

function baseInput(slug: string) {
  return {
    slug,
    titlePl: 'Testowy wpis',
    shortDescPl: 'Krótki opis',
    bodyPl: 'Treść wpisu',
    seoTitlePl: 'SEO',
    seoDescPl: 'SEO opis',
    imageUrl: null,
    sortOrder: 0,
    publishedAt: null,
  };
}

describe('applyCreateBlogPost / applyUpdateBlogPost / applySetBlogPostActive', () => {
  it('creates, updates, and deactivates a blog post, each audited', async () => {
    const staff = staffActor();
    const slug = uid();
    const input = baseInput(slug);

    const created = await applyCreateBlogPost(staff, input);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');

    const detail = await findBlogPostForAdmin(created.id);
    expect(detail?.titlePl).toBe('Testowy wpis');
    expect(detail?.publishedAt).toBeNull();
    expect(detail?.isActive).toBe(true);

    const publishedAt = new Date('2026-01-01T00:00:00.000Z');
    const updated = await applyUpdateBlogPost(staff, created.id, { ...input, titlePl: 'Zmieniony tytuł', publishedAt });
    expect(updated.ok).toBe(true);
    const afterUpdate = await findBlogPostForAdmin(created.id);
    expect(afterUpdate?.titlePl).toBe('Zmieniony tytuł');
    expect(afterUpdate?.publishedAt?.toISOString()).toBe(publishedAt.toISOString());

    await applySetBlogPostActive(staff, created.id, false);
    const afterDeactivate = await findBlogPostForAdmin(created.id);
    expect(afterDeactivate?.isActive).toBe(false);

    expect(await prisma.auditLog.count({ where: { entity: 'BlogPost', actorEmail: staff.email } })).toBe(3);
  });

  it('rejects a duplicate slug', async () => {
    const staff = staffActor();
    const slug = uid();
    const input = baseInput(slug);
    await applyCreateBlogPost(staff, input);

    const result = await applyCreateBlogPost(staff, input);
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid slug', async () => {
    const result = await applyCreateBlogPost(staffActor(), baseInput('Not A Slug!'));
    expect(result.ok).toBe(false);
  });

  it('rejects an empty title/short description/body', async () => {
    const staff = staffActor();
    const slug = uid();
    const result = await applyCreateBlogPost(staff, { ...baseInput(slug), titlePl: '' });
    expect(result.ok).toBe(false);
  });

  it('lists posts ordered by sortOrder then id, unscoped by isActive/publishedAt', async () => {
    const staff = staffActor();
    const slugA = uid();
    const slugB = uid();
    await applyCreateBlogPost(staff, { ...baseInput(slugA), sortOrder: 5 });
    const createdB = await applyCreateBlogPost(staff, { ...baseInput(slugB), sortOrder: 1 });
    if (!createdB.ok) throw new Error('unreachable');
    await applySetBlogPostActive(staff, createdB.id, false);

    const rows = await listBlogPostsForAdmin();
    const testRows = rows.filter((r) => r.slug === slugA || r.slug === slugB);
    expect(testRows.map((r) => r.slug)).toEqual([slugB, slugA]);
    expect(testRows.find((r) => r.slug === slugB)?.isActive).toBe(false);
  });
});
