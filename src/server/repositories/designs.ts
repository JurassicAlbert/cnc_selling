import { prisma } from '@/server/db/client';

/**
 * Public pattern-browsing repository. P9 phase 3: `Design.featured` (added
 * in phase 2) finally has a real consumer here - featured designs sort
 * first, everything else falls back to `sortOrder`. Only rights-clear
 * designs are shown, mirroring the same `rightsStatus` filter the
 * configurator's own design picker already enforces (§12) - a design still
 * pending permission is never shown as if it were sellable/usable.
 */

export type PublicDesignProductLink = {
  readonly slug: string;
  readonly namePl: string;
};

export type PublicDesignCollectionLink = {
  readonly slug: string;
  readonly namePl: string;
};

export type PublicDesignListItem = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string | null;
  readonly thumbnailUrl: string;
  readonly tags: readonly string[];
  readonly featured: boolean;
  /** 2026-08-29: real `DesignCollection` grouping - `null` for a pattern deliberately left uncategorised (see `DESIGN_COLLECTION_SEEDS`'s own seed comment). */
  readonly collection: PublicDesignCollectionLink | null;
  /**
   * Which real, currently-active products this pattern can actually be
   * picked on - 2026-08-28 owner feedback: `/wzory` used to be a dead-end
   * gallery ("designs aren't linked anywhere from here"), so a customer had
   * no way to get from a pattern they liked to a product they could order
   * it on. Only active products in active categories (matches
   * `listAllActiveProducts`'s own cascade) - a pattern assigned only to a
   * since-deactivated product (e.g. Gres) shows no links, not a dead one.
   */
  readonly products: readonly PublicDesignProductLink[];
};

export async function listActiveDesignsForBrowsing(): Promise<readonly PublicDesignListItem[]> {
  const designs = await prisma.design.findMany({
    where: { isActive: true, rightsStatus: { in: ['APPROVED_COMMERCIAL', 'PUBLIC_DOMAIN'] } },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      slug: true,
      namePl: true,
      descPl: true,
      thumbnailUrl: true,
      tags: true,
      featured: true,
      collection: { select: { slug: true, namePl: true } },
      products: {
        where: { product: { isActive: true, category: { isActive: true } } },
        select: { product: { select: { slug: true, namePl: true } } },
      },
    },
  });
  return designs.map((d) => ({ ...d, products: d.products.map((p) => p.product) }));
}
