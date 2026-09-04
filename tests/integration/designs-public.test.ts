import { afterEach, describe, expect, it } from 'vitest';

import { listActiveDesignsForBrowsing } from '@/server/repositories/designs';
import { prisma } from '@/server/db/client';

/**
 * P9 phase 3's real consumer of `Design.featured` (added phase 2) - the
 * public `/wzory` pattern-browsing page. Seeds real `Design` rows directly
 * (this repository, like `listOwnedCustomerDesigns`, reads via the app's
 * own `prisma` singleton, not a tx - same PREFIX/`afterEach` pattern as
 * `customer-designs.test.ts`).
 */

const PREFIX = 'test-designs-public-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedDesign(overrides: {
  readonly namePl?: string;
  readonly isActive?: boolean;
  readonly featured?: boolean;
  readonly sortOrder?: number;
  readonly rightsStatus?: 'APPROVED_COMMERCIAL' | 'PUBLIC_DOMAIN' | 'REQUIRES_PERMISSION' | 'RESTRICTED';
}) {
  return prisma.design.create({
    data: {
      slug: uid(),
      code: uid(),
      namePl: overrides.namePl ?? 'Testowy wzór',
      tags: [],
      thumbnailUrl: '/images/designs/test-thumb.jpg',
      previewUrl: '/images/designs/test-preview.jpg',
      isActive: overrides.isActive ?? true,
      featured: overrides.featured ?? false,
      sortOrder: overrides.sortOrder ?? 0,
      rightsStatus: overrides.rightsStatus ?? 'APPROVED_COMMERCIAL',
      referenceWidthMm: 300,
      minLineWidthUm: 1000,
      minDetailSpacingUm: 1000,
      recommendedMethod: 'CNC_ENGRAVE',
      minRecommendedWidthMm: 100,
      detailLevel: 3,
      machiningMilliMinutesPerM2: 2500,
    },
  });
}

afterEach(async () => {
  await prisma.design.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

describe('listActiveDesignsForBrowsing', () => {
  it('shows an active, rights-clear design', async () => {
    const design = await seedDesign({ namePl: `${PREFIX}widoczny` });

    const result = await listActiveDesignsForBrowsing();

    expect(result.some((d) => d.id === design.id)).toBe(true);
  });

  it('excludes an inactive design', async () => {
    const design = await seedDesign({ isActive: false });

    expect((await listActiveDesignsForBrowsing()).some((d) => d.id === design.id)).toBe(false);
  });

  it('excludes a design still awaiting rights permission - never shown as if it were usable', async () => {
    const design = await seedDesign({ rightsStatus: 'REQUIRES_PERMISSION' });

    expect((await listActiveDesignsForBrowsing()).some((d) => d.id === design.id)).toBe(false);
  });

  it('sorts featured designs first, ahead of a lower sortOrder non-featured design', async () => {
    const plain = await seedDesign({ namePl: `${PREFIX}zwykly`, sortOrder: 0, featured: false });
    const highlighted = await seedDesign({ namePl: `${PREFIX}wyrozniony`, sortOrder: 5, featured: true });

    const result = await listActiveDesignsForBrowsing();
    const plainIndex = result.findIndex((d) => d.id === plain.id);
    const highlightedIndex = result.findIndex((d) => d.id === highlighted.id);

    expect(highlightedIndex).toBeLessThan(plainIndex);
  });
});
