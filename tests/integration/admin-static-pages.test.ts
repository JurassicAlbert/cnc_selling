import { afterEach, describe, expect, it } from 'vitest';

import { applyCreateStaticPage, applySetStaticPageActive, applyUpdateStaticPage } from '@/server/actions/admin-static-pages';
import { getActiveStaticPageBySlug } from '@/server/repositories/static-pages';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-pages-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

afterEach(async () => {
  await prisma.staticPage.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('applyCreateStaticPage / applyUpdateStaticPage / applySetStaticPageActive', () => {
  it('creates, updates, and deactivates a static page, each audited', async () => {
    const staff = staffActor();
    const slug = uid();
    const input = { slug, titlePl: 'Testowa strona', bodyPl: 'Treść', seoTitlePl: 'SEO', seoDescPl: 'SEO opis', sortOrder: 0 };

    const created = await applyCreateStaticPage(staff, input);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');

    expect((await getActiveStaticPageBySlug(slug))?.titlePl).toBe('Testowa strona');

    const updated = await applyUpdateStaticPage(staff, created.id, { ...input, titlePl: 'Zmieniony tytuł' });
    expect(updated.ok).toBe(true);
    expect((await getActiveStaticPageBySlug(slug))?.titlePl).toBe('Zmieniony tytuł');

    await applySetStaticPageActive(staff, created.id, false);
    expect(await getActiveStaticPageBySlug(slug)).toBeNull();
    expect(await prisma.staticPage.findUnique({ where: { id: created.id } })).not.toBeNull();

    expect(await prisma.auditLog.count({ where: { entity: 'StaticPage', actorEmail: staff.email } })).toBe(3);
  });

  it('rejects a duplicate slug', async () => {
    const staff = staffActor();
    const slug = uid();
    const input = { slug, titlePl: 'A', bodyPl: 'B', seoTitlePl: 'C', seoDescPl: 'D', sortOrder: 0 };
    await applyCreateStaticPage(staff, input);

    const result = await applyCreateStaticPage(staff, input);
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid slug', async () => {
    const result = await applyCreateStaticPage(staffActor(), {
      slug: 'Not A Slug!',
      titlePl: 'A',
      bodyPl: 'B',
      seoTitlePl: 'C',
      seoDescPl: 'D',
      sortOrder: 0,
    });
    expect(result.ok).toBe(false);
  });
});
