import { afterEach, describe, expect, it } from 'vitest';

import { applyToggleFavoriteDesign } from '@/server/operations/design-favorites';
import { listFavoriteDesigns, listFavoritedDesignIds } from '@/server/repositories/design-favorites';
import { prisma } from '@/server/db/client';

/**
 * P9 continuation, 2026-08-28 - "wzory, które dodał do ulubionych" (owner
 * feedback). `DesignFavorite` is login-only by design (schema's own
 * comment) - no guest/sessionToken half to test here, unlike
 * `customer-designs.test.ts`.
 */

const PREFIX = 'test-design-favorites-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedUser() {
  return prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Test Customer', role: 'CUSTOMER' } });
}

async function seedDesign(namePl: string) {
  return prisma.design.create({
    data: {
      slug: uid(),
      code: uid(),
      namePl,
      thumbnailUrl: '/images/placeholders/wzor-podstawowy.svg',
      previewUrl: '/images/placeholders/wzor-podstawowy.svg',
      referenceWidthMm: 200,
      minLineWidthUm: 500,
      minDetailSpacingUm: 500,
      minEngraveDepthUm: 200,
      recommendedMethod: 'CNC_ENGRAVE',
      minRecommendedWidthMm: 100,
      detailLevel: 1,
      machiningMilliMinutesPerM2: 1000,
      rightsStatus: 'APPROVED_COMMERCIAL',
    },
  });
}

afterEach(async () => {
  await prisma.designFavorite.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.design.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('applyToggleFavoriteDesign', () => {
  it('favourites on the first call, unfavourites on the second - a real toggle, not a one-way add', async () => {
    const user = await seedUser();
    const design = await seedDesign('Wzór testowy');

    const first = await applyToggleFavoriteDesign(user.id, design.id);
    expect(first).toEqual({ ok: true, favorited: true });
    expect(await listFavoriteDesigns(user.id)).toHaveLength(1);

    const second = await applyToggleFavoriteDesign(user.id, design.id);
    expect(second).toEqual({ ok: true, favorited: false });
    expect(await listFavoriteDesigns(user.id)).toHaveLength(0);
  });

  it('refuses a nonexistent design', async () => {
    const user = await seedUser();
    const result = await applyToggleFavoriteDesign(user.id, 'nonexistent-design-id');
    expect(result).toEqual({ ok: false, code: 'DESIGN_NOT_FOUND' });
  });

  it('never leaks another user’s favourite', async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const design = await seedDesign('Wzór testowy');
    await applyToggleFavoriteDesign(owner.id, design.id);

    expect(await listFavoriteDesigns(owner.id)).toHaveLength(1);
    expect(await listFavoriteDesigns(other.id)).toHaveLength(0);
  });
});

describe('listFavoritedDesignIds', () => {
  it('returns only the ids the given user actually favourited, from a larger candidate set', async () => {
    const user = await seedUser();
    const favorited = await seedDesign('Ulubiony');
    const notFavorited = await seedDesign('Nieulubiony');
    await applyToggleFavoriteDesign(user.id, favorited.id);

    const result = await listFavoritedDesignIds(user.id, [favorited.id, notFavorited.id]);

    expect(result.has(favorited.id)).toBe(true);
    expect(result.has(notFavorited.id)).toBe(false);
  });

  it('returns an empty set for a guest (null userId) rather than erroring', async () => {
    const design = await seedDesign('Wzór testowy');
    const result = await listFavoritedDesignIds(null, [design.id]);
    expect(result.size).toBe(0);
  });
});
