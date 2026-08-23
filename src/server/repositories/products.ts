import { prisma } from '@/server/db/client';

export type ProductCardData = {
  readonly slug: string;
  readonly namePl: string;
  readonly shortDescPl: string;
  readonly minPriceGrosze: number;
  readonly primaryImageUrl: string | null;
};

/** For a category's product grid. Only active products, cheapest-first image already picked. */
export async function listActiveProductsByCategorySlug(
  categorySlug: string,
): Promise<ProductCardData[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, category: { slug: categorySlug, isActive: true } },
    orderBy: { sortOrder: 'asc' },
    select: {
      slug: true,
      namePl: true,
      shortDescPl: true,
      minPriceGrosze: true,
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true },
      },
    },
  });

  return products.map((product) => ({
    slug: product.slug,
    namePl: product.namePl,
    shortDescPl: product.shortDescPl,
    minPriceGrosze: product.minPriceGrosze,
    primaryImageUrl: product.images[0]?.url ?? null,
  }));
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
