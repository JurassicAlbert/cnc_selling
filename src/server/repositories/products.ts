import { cache } from 'react';

import { matchesPl } from '@/domain/text/collation';
import { prisma } from '@/server/db/client';

export type ProductCardData = {
  readonly slug: string;
  readonly namePl: string;
  readonly shortDescPl: string;
  /**
   * The advertised "od X zł" - GROSS, and the cheapest configuration a
   * customer can actually buy (`server/pricing/starting-price.ts`). `null`
   * means no price may be shown at all: never fall back to
   * `minPriceGrosze`, which is the net internal clamp this replaced
   * (`docs/REVIEW-DETAILED.md` BUG-02).
   */
  readonly startingPriceGrossGrosze: number | null;
  readonly primaryImageUrl: string | null;
  readonly categoryNamePl: string;
  readonly categorySlug: string;
  /** Real, from `PersonalizationSpec.isEnabled` - not every product offers it. */
  readonly hasPersonalization: boolean;
  readonly productionDaysMin: number;
  readonly productionDaysMax: number;
  readonly minWidthMm: number;
  readonly maxWidthMm: number;
  /** A real many-to-many join (`ProductMaterial`) - every seeded product has exactly one today, but the card must not assume that's permanent. */
  readonly materials: readonly { readonly namePl: string }[];
};

export type ProductSort = 'price_asc' | 'price_desc' | null;

export type CategoryProductFilter = {
  /** `null` (no material param) shows every product; a slug narrows to that material. */
  readonly materialSlug?: string | null;
  readonly sort?: ProductSort;
};

/** For a category's product grid. Only active products, cheapest-first image already picked. */
export async function listActiveProductsByCategorySlug(
  categorySlug: string,
  filter: CategoryProductFilter = {},
): Promise<ProductCardData[]> {
  const { materialSlug, sort } = filter;
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      category: { slug: categorySlug, isActive: true },
      ...(materialSlug ? { materials: { some: { material: { slug: materialSlug } } } } : {}),
    },
    // Sorted by the price customers are actually shown, not by the
    // internal net clamp - otherwise "od najtańszych" could order the list
    // differently from the numbers on the cards. Nulls sort last either
    // way: a product with no advertised price belongs at the end of a
    // price-sorted list, not the front.
    orderBy: sort === 'price_asc'
      ? { startingPriceGrossGrosze: { sort: 'asc', nulls: 'last' } }
      : sort === 'price_desc'
        ? { startingPriceGrossGrosze: { sort: 'desc', nulls: 'last' } }
        : { sortOrder: 'asc' },
    select: {
      slug: true,
      namePl: true,
      shortDescPl: true,
      startingPriceGrossGrosze: true,
      category: { select: { namePl: true, slug: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
      personalization: { select: { isEnabled: true } },
      productionDaysMin: true,
      productionDaysMax: true,
      minWidthMm: true,
      maxWidthMm: true,
      materials: { select: { material: { select: { namePl: true } } } },
    },
  });

  return products.map((product) => ({
    slug: product.slug,
    namePl: product.namePl,
    shortDescPl: product.shortDescPl,
    startingPriceGrossGrosze: product.startingPriceGrossGrosze,
    primaryImageUrl: product.images[0]?.url ?? null,
    categoryNamePl: product.category.namePl,
    categorySlug: product.category.slug,
    hasPersonalization: product.personalization?.isEnabled ?? false,
    productionDaysMin: product.productionDaysMin,
    productionDaysMax: product.productionDaysMax,
    minWidthMm: product.minWidthMm,
    maxWidthMm: product.maxWidthMm,
    materials: product.materials.map((m) => ({ namePl: m.material.namePl })),
  }));
}

/** The distinct materials offered across a category's active products, for the filter sidebar. */
export async function listCategoryFilterMaterials(
  categorySlug: string,
): Promise<{ readonly slug: string; readonly namePl: string }[]> {
  const rows = await prisma.productMaterial.findMany({
    where: {
      product: { isActive: true, category: { slug: categorySlug, isActive: true } },
      material: { isAvailable: true },
    },
    select: { material: { select: { slug: true, namePl: true } } },
    distinct: ['materialId'],
  });
  return rows.map((row) => row.material);
}

/**
 * Every active product, for the homepage's single honest "Nasze produkty"
 * grid - no fake curation. Also joins `category.isActive`: a deactivated
 * category (e.g. Gres/Panele podłogowe, 2026-08-28) must hide its products
 * everywhere, not just from its own category page and nav - this repository
 * is the shared source for the homepage grid, sitewide search
 * (`searchActiveProducts` below reuses this), and the sitemap.
 */
export async function listAllActiveProducts(): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, category: { isActive: true } },
    orderBy: { sortOrder: 'asc' },
    select: {
      slug: true,
      namePl: true,
      shortDescPl: true,
      startingPriceGrossGrosze: true,
      category: { select: { namePl: true, slug: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
      personalization: { select: { isEnabled: true } },
      productionDaysMin: true,
      productionDaysMax: true,
      minWidthMm: true,
      maxWidthMm: true,
      materials: { select: { material: { select: { namePl: true } } } },
    },
  });

  return products.map((product) => ({
    slug: product.slug,
    namePl: product.namePl,
    shortDescPl: product.shortDescPl,
    startingPriceGrossGrosze: product.startingPriceGrossGrosze,
    primaryImageUrl: product.images[0]?.url ?? null,
    categoryNamePl: product.category.namePl,
    categorySlug: product.category.slug,
    hasPersonalization: product.personalization?.isEnabled ?? false,
    productionDaysMin: product.productionDaysMin,
    productionDaysMax: product.productionDaysMax,
    minWidthMm: product.minWidthMm,
    maxWidthMm: product.maxWidthMm,
    materials: product.materials.map((m) => ({ namePl: m.material.namePl })),
  }));
}

export type ProductSearchRequest = {
  readonly query: string;
  /**
   * The category the customer picked from the selector attached to the
   * search field (UX-23), or `undefined` for "wszystkie kategorie".
   *
   * A slug rather than an id, because it comes straight off the query
   * string and has to survive being bookmarked and shared.
   */
  readonly categorySlug?: string;
};

/**
 * A real search, not decoration: diacritic-insensitive matching
 * (`matchesPl`, already built in P1) against name and short description.
 * Filtered in memory rather than a DB `LIKE` - reasonable at today's scale
 * (a handful of products); revisit if the catalogue ever grows enough for
 * that to matter.
 *
 * **The category argument arrived with UX-23**, which attached a category
 * selector to the search field. It narrows for real: a control that appears
 * to filter and does not is the same class of thing as a price we will not
 * honour, and this repository is where "only what is genuinely on sale" is
 * decided (`listAllActiveProducts` already excludes retired products and
 * deactivated categories, and both filters below inherit that).
 *
 * Two request shapes are both legitimate, and they are not the same:
 *
 * - a phrase, with or without a category - an ordinary search;
 * - a category with **no** phrase - "show me what is in here", which is
 *   exactly what someone does after choosing from the selector and pressing
 *   the button. Answering that with nothing would make the selector a dead
 *   end, so it lists the category.
 *
 * The one empty request is neither: no phrase and no category returns
 * nothing rather than the whole catalogue, because that is not a search
 * result and the page has honest copy for it.
 *
 * A category slug that is unknown, or names a category the shop has
 * deactivated, returns nothing rather than silently widening the search to
 * everything - the same refusal UX-21 applies to a stale configuration link,
 * and for the same reason: a stale bookmark should not quietly become a
 * different request.
 */
export async function searchActiveProducts(request: ProductSearchRequest): Promise<ProductCardData[]> {
  const trimmed = request.query.trim();
  const categorySlug = request.categorySlug?.trim();
  const hasCategory = categorySlug !== undefined && categorySlug.length > 0;

  if (trimmed.length === 0 && !hasCategory) {
    return [];
  }

  const all = await listAllActiveProducts();
  const inScope = hasCategory ? all.filter((product) => product.categorySlug === categorySlug) : all;

  if (trimmed.length === 0) {
    return inScope;
  }
  return inScope.filter(
    (product) => matchesPl(product.namePl, trimmed) || matchesPl(product.shortDescPl, trimmed),
  );
}

export type ProductDetail = {
  readonly slug: string;
  readonly namePl: string;
  readonly shortDescPl: string;
  readonly longDescPl: string;
  readonly careInstructionsPl: string;
  readonly installationInfoPl: string | null;
  readonly materialNotesPl: string | null;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly basePriceGrosze: number;
  readonly startingPriceGrossGrosze: number | null;
  readonly productionDaysMin: number;
  readonly productionDaysMax: number;
  readonly minWidthMm: number;
  readonly maxWidthMm: number;
  readonly minHeightMm: number;
  readonly maxHeightMm: number;
  /** Floor/panel products: the customer must state final dimensions (§11) - no trimming after the fact. */
  readonly requiresExactSize: boolean;
  readonly category: { readonly slug: string; readonly namePl: string };
  readonly images: readonly { readonly url: string; readonly altPl: string }[];
  readonly materials: readonly { readonly namePl: string }[];
  /**
   * Rights-clear, active designs this product's configurator actually
   * offers - 2026-08-28, owner feedback: patterns were only ever visible by
   * opening the configurator and stepping through it; now shown directly in
   * the product's own properties, so a customer can see what's available
   * before starting the configurator. Same `rightsStatus` filter
   * `designs.ts`'s public browsing repository already uses.
   */
  readonly designs: readonly { readonly slug: string; readonly namePl: string; readonly thumbnailUrl: string }[];
  readonly installationVariants: readonly {
    readonly namePl: string;
    readonly descPl: string;
    readonly receivesPl: string;
  }[];
};

async function findProductBySlug(slug: string, activeOnly: boolean): Promise<ProductDetail | null> {
  const product = await prisma.product.findFirst({
    // A deactivated category hides its products from direct-URL access too,
    // not just from listings - matching how a deactivated product already
    // 404s. `activeOnly: false` (staff preview only, see
    // `getProductBySlugForPreview`) deliberately skips both checks.
    where: activeOnly ? { slug, isActive: true, category: { isActive: true } } : { slug },
    select: {
      slug: true,
      namePl: true,
      shortDescPl: true,
      longDescPl: true,
      careInstructionsPl: true,
      installationInfoPl: true,
      materialNotesPl: true,
      seoTitlePl: true,
      seoDescPl: true,
      basePriceGrosze: true,
      startingPriceGrossGrosze: true,
      productionDaysMin: true,
      productionDaysMax: true,
      minWidthMm: true,
      maxWidthMm: true,
      minHeightMm: true,
      maxHeightMm: true,
      requiresExactSize: true,
      category: { select: { slug: true, namePl: true } },
      images: {
        orderBy: { sortOrder: 'asc' },
        select: { url: true, altPl: true },
      },
      materials: {
        select: { material: { select: { namePl: true } } },
      },
      installVariants: {
        orderBy: { sortOrder: 'asc' },
        select: { namePl: true, descPl: true, receivesPl: true },
      },
      designs: {
        where: { design: { isActive: true, rightsStatus: { in: ['APPROVED_COMMERCIAL', 'PUBLIC_DOMAIN'] } } },
        select: { design: { select: { slug: true, namePl: true, thumbnailUrl: true } } },
      },
    },
  });

  if (product === null) {
    return null;
  }

  const { installVariants, designs, ...rest } = product;
  return {
    ...rest,
    materials: product.materials.map((m) => ({ namePl: m.material.namePl })),
    installationVariants: installVariants,
    designs: designs.map((d) => d.design),
  };
}

/**
 * `cache()` from React, not a data cache - `docs/REVIEW-DETAILED.md` PERF-02.
 * It memoizes for the duration of ONE request, nothing longer, so there is no
 * staleness to reason about: an admin edit is visible on the very next
 * request either way.
 *
 * It is here because each of the five `generateMetadata` routes calls its
 * repository function twice - once for the metadata, once for the page body
 * - and Next deduplicates `fetch`, not Prisma. Every one of those pages was
 * issuing the identical query twice per render.
 */
export const getActiveProductBySlug = cache(
  async (slug: string): Promise<ProductDetail | null> => findProductBySlug(slug, true),
);

/**
 * Same shape as `getActiveProductBySlug`, minus the `isActive` filter -
 * §16A.5's "Preview as customer" admin feature, letting staff see a
 * not-yet-published product exactly as `/produkt/[slug]/page.tsx` renders
 * it. **Callers MUST gate this behind `requireStaffSession()`** - it has
 * no auth check of its own, matching every other admin-only repository
 * function in this codebase (`admin-*.ts`), even though this one happens
 * to live in the public `products.ts` module because it shares the exact
 * query shape with the public page.
 */
export async function getProductBySlugForPreview(slug: string): Promise<ProductDetail | null> {
  return findProductBySlug(slug, false);
}

/** Every active product slug, for the sitemap. Same `category.isActive` cascade as `listAllActiveProducts`. */
export async function listAllActiveProductSlugs(): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, category: { isActive: true } },
    select: { slug: true },
  });
  return products.map((p) => p.slug);
}
