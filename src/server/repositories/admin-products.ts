/**
 * Admin product queries — unscoped by `isActive`, unlike
 * `repositories/products.ts`'s storefront-facing reads. Every caller here
 * MUST go through `requireStaffSession()` first.
 */

import { prisma } from '@/server/db/client';
import type { InstallationVariantCode, JoineryTechniqueCode, ProductTypeCode } from '@/generated/prisma/enums';

export type AdminProductListFilters = {
  readonly categoryId?: string;
  readonly typeCode?: ProductTypeCode;
};

export type AdminProductListItem = {
  readonly id: string;
  readonly slug: string;
  readonly namePl: string;
  readonly typeCode: ProductTypeCode;
  readonly categoryNamePl: string;
  readonly isActive: boolean;
};

export async function listProductsForAdmin(filters: AdminProductListFilters): Promise<readonly AdminProductListItem[]> {
  const products = await prisma.product.findMany({
    where: { categoryId: filters.categoryId, typeCode: filters.typeCode },
    orderBy: [{ categoryId: 'asc' }, { sortOrder: 'asc' }],
    select: {
      id: true,
      slug: true,
      namePl: true,
      typeCode: true,
      isActive: true,
      category: { select: { namePl: true } },
    },
  });
  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    namePl: product.namePl,
    typeCode: product.typeCode,
    categoryNamePl: product.category.namePl,
    isActive: product.isActive,
  }));
}

export type AdminProductCore = {
  readonly id: string;
  readonly slug: string;
  readonly typeCode: ProductTypeCode;
  readonly categoryId: string;
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
  readonly minAspectRatioBp: number | null;
  readonly maxAspectRatioBp: number | null;
  readonly allowsCustomSize: boolean;
  readonly requiresExactSize: boolean;
  readonly supportsPanelJoinery: boolean;
  readonly joineryTechniqueCode: JoineryTechniqueCode | null;
  readonly joinedMaxWidthMm: number | null;
  readonly joinedMaxHeightMm: number | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export type AdminPresetSize = { readonly id: string; readonly widthMm: number; readonly heightMm: number; readonly labelPl: string; readonly sortOrder: number };
export type AdminThickness = { readonly id: string; readonly thicknessMm: number; readonly labelPl: string; readonly priceFactorBp: number; readonly sortOrder: number };
export type AdminProductMaterial = { readonly materialId: string; readonly namePl: string; readonly priceFactorBp: number };
export type AdminProductDesign = { readonly designId: string; readonly namePl: string; readonly code: string; readonly surchargeGrosze: number };
export type AdminInstallationVariant = {
  readonly id: string;
  readonly code: InstallationVariantCode;
  readonly namePl: string;
  readonly descPl: string;
  readonly receivesPl: string;
  readonly diagramUrl: string;
  readonly maxThicknessMm: number | null;
  readonly priceFactorBp: number;
  readonly sortOrder: number;
};
export type AdminProductImage = { readonly id: string; readonly url: string; readonly altPl: string; readonly isPrimary: boolean; readonly sortOrder: number };

export type AdminProductDetail = AdminProductCore & {
  readonly presetSizes: readonly AdminPresetSize[];
  readonly thicknesses: readonly AdminThickness[];
  readonly materials: readonly AdminProductMaterial[];
  readonly designs: readonly AdminProductDesign[];
  readonly installVariants: readonly AdminInstallationVariant[];
  readonly images: readonly AdminProductImage[];
};

export async function findProductForAdmin(id: string): Promise<AdminProductDetail | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      presetSizes: { orderBy: { sortOrder: 'asc' } },
      thicknesses: { orderBy: { sortOrder: 'asc' } },
      materials: { include: { material: { select: { namePl: true } } } },
      designs: { include: { design: { select: { namePl: true, code: true } } } },
      installVariants: { orderBy: { sortOrder: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (product === null) {
    return null;
  }

  return {
    id: product.id,
    slug: product.slug,
    typeCode: product.typeCode,
    categoryId: product.categoryId,
    namePl: product.namePl,
    shortDescPl: product.shortDescPl,
    longDescPl: product.longDescPl,
    careInstructionsPl: product.careInstructionsPl,
    installationInfoPl: product.installationInfoPl,
    materialNotesPl: product.materialNotesPl,
    seoTitlePl: product.seoTitlePl,
    seoDescPl: product.seoDescPl,
    basePriceGrosze: product.basePriceGrosze,
    minPriceGrosze: product.minPriceGrosze,
    productionDaysMin: product.productionDaysMin,
    productionDaysMax: product.productionDaysMax,
    minWidthMm: product.minWidthMm,
    maxWidthMm: product.maxWidthMm,
    minHeightMm: product.minHeightMm,
    maxHeightMm: product.maxHeightMm,
    minAspectRatioBp: product.minAspectRatioBp,
    maxAspectRatioBp: product.maxAspectRatioBp,
    allowsCustomSize: product.allowsCustomSize,
    requiresExactSize: product.requiresExactSize,
    supportsPanelJoinery: product.supportsPanelJoinery,
    joineryTechniqueCode: product.joineryTechniqueCode,
    joinedMaxWidthMm: product.joinedMaxWidthMm,
    joinedMaxHeightMm: product.joinedMaxHeightMm,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    presetSizes: product.presetSizes,
    thicknesses: product.thicknesses,
    materials: product.materials.map((m) => ({ materialId: m.materialId, namePl: m.material.namePl, priceFactorBp: m.priceFactorBp })),
    designs: product.designs.map((d) => ({ designId: d.designId, namePl: d.design.namePl, code: d.design.code, surchargeGrosze: d.surchargeGrosze })),
    installVariants: product.installVariants,
    images: product.images,
  };
}

export type AdminMaterialOption = { readonly id: string; readonly namePl: string };
export async function listMaterialOptionsForAdmin(): Promise<readonly AdminMaterialOption[]> {
  return prisma.material.findMany({ where: { isAvailable: true }, orderBy: { sortOrder: 'asc' }, select: { id: true, namePl: true } });
}

export type AdminDesignOption = { readonly id: string; readonly namePl: string; readonly code: string };
export async function listDesignOptionsForAdmin(): Promise<readonly AdminDesignOption[]> {
  return prisma.design.findMany({ where: { isActive: true }, orderBy: { code: 'asc' }, select: { id: true, namePl: true, code: true } });
}

export type AdminCategoryOption = { readonly id: string; readonly namePl: string };
export async function listCategoryOptionsForAdmin(): Promise<readonly AdminCategoryOption[]> {
  return prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, namePl: true } });
}
