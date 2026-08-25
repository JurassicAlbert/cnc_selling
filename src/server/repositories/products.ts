import { matchesPl } from '@/domain/text/collation';
import { prisma } from '@/server/db/client';

export type ProductCardData = {
  readonly slug: string;
  readonly namePl: string;
  readonly shortDescPl: string;
  readonly minPriceGrosze: number;
  readonly primaryImageUrl: string | null;
  readonly categoryNamePl: string;
  readonly categorySlug: string;
  /** Real, from `PersonalizationSpec.isEnabled` — not every product offers it. */
  readonly hasPersonalization: boolean;
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
    orderBy: sort === 'price_asc'
      ? { minPriceGrosze: 'asc' }
      : sort === 'price_desc'
        ? { minPriceGrosze: 'desc' }
        : { sortOrder: 'asc' },
    select: {
      slug: true,
      namePl: true,
      shortDescPl: true,
      minPriceGrosze: true,
      category: { select: { namePl: true, slug: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
      personalization: { select: { isEnabled: true } },
    },
  });

  return products.map((product) => ({
    slug: product.slug,
    namePl: product.namePl,
    shortDescPl: product.shortDescPl,
    minPriceGrosze: product.minPriceGrosze,
    primaryImageUrl: product.images[0]?.url ?? null,
    categoryNamePl: product.category.namePl,
    categorySlug: product.category.slug,
    hasPersonalization: product.personalization?.isEnabled ?? false,
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

/** Every active product, for the homepage's single honest "Nasze produkty" grid — no fake curation. */
export async function listAllActiveProducts(): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      slug: true,
      namePl: true,
      shortDescPl: true,
      minPriceGrosze: true,
      category: { select: { namePl: true, slug: true } },
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
      personalization: { select: { isEnabled: true } },
    },
  });

  return products.map((product) => ({
    slug: product.slug,
    namePl: product.namePl,
    shortDescPl: product.shortDescPl,
    minPriceGrosze: product.minPriceGrosze,
    primaryImageUrl: product.images[0]?.url ?? null,
    categoryNamePl: product.category.namePl,
    categorySlug: product.category.slug,
    hasPersonalization: product.personalization?.isEnabled ?? false,
  }));
}

/**
 * A real search, not decoration: diacritic-insensitive matching
 * (`matchesPl`, already built in P1) against name and short description.
 * Filtered in memory rather than a DB `LIKE` — reasonable at today's scale
 * (a handful of products); revisit if the catalogue ever grows enough for
 * that to matter.
 */
export async function searchActiveProducts(query: string): Promise<ProductCardData[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const all = await listAllActiveProducts();
  return all.filter(
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
  readonly minPriceGrosze: number;
  readonly productionDaysMin: number;
  readonly productionDaysMax: number;
  readonly minWidthMm: number;
  readonly maxWidthMm: number;
  readonly minHeightMm: number;
  readonly maxHeightMm: number;
  /** Floor/panel products: the customer must state final dimensions (§11) — no trimming after the fact. */
  readonly requiresExactSize: boolean;
  readonly category: { readonly slug: string; readonly namePl: string };
  readonly images: readonly { readonly url: string; readonly altPl: string }[];
  readonly materials: readonly { readonly namePl: string }[];
  readonly installationVariants: readonly {
    readonly namePl: string;
    readonly descPl: string;
    readonly receivesPl: string;
  }[];
};

export async function getActiveProductBySlug(slug: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
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
      minPriceGrosze: true,
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
    },
  });

  if (product === null) {
    return null;
  }

  const { installVariants, ...rest } = product;
  return {
    ...rest,
    materials: product.materials.map((m) => ({ namePl: m.material.namePl })),
    installationVariants: installVariants,
  };
}

/** Every active product slug, for the sitemap. */
export async function listAllActiveProductSlugs(): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { slug: true },
  });
  return products.map((p) => p.slug);
}
