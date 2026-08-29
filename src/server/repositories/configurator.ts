import { prisma } from '@/server/db/client';
import type { ProductTypeCode } from '@/domain/configuration/steps';
import type { ProductionMethod } from '@/domain/pricing/types';
import type { ConfiguratorOptionData } from '@/server/configurator/resolve-options';
import type {
  FontRow,
  MachineSettingsRow,
  PersonalizationSpecRow,
  PricingSettingsRow,
  ProductRow,
} from '@/server/mapping/to-domain';

/**
 * Everything the configurator's server actions need for one product, in one
 * fetch. Assembled here rather than inline in the Server Action so the
 * Prisma query stays in one reviewable place — `src/server/repositories` is
 * already the project's convention for "the only files that query Prisma for
 * page content" (see `docs/HANDOVER.md` §9e).
 */
export type ConfiguratorProductData = {
  readonly productId: string;
  readonly namePl: string;
  readonly typeCode: ProductTypeCode;
  readonly product: ProductRow & { readonly isFloorElement: boolean };
  readonly options: ConfiguratorOptionData;
  readonly designsById: ReadonlyMap<
    string,
    {
      readonly surchargeGrosze: number;
      readonly referenceWidthMm: number;
      readonly minLineWidthUm: number;
      readonly minDetailSpacingUm: number;
      readonly detailLevel: number;
      readonly minRecommendedWidthMm: number;
      readonly machiningMilliMinutesPerM2: number;
      readonly recommendedMethod: ProductionMethod;
    }
  >;
  readonly materialsById: ReadonlyMap<
    string,
    {
      readonly priceFactorBp: number;
      readonly pricePerM2Grosze: number;
      readonly maxSheetWidthMm: number;
      readonly maxSheetHeightMm: number;
      readonly minLineWidthUm: number;
      readonly minDetailSpacingUm: number;
      readonly minTextHeightUm: number;
      readonly isNaturalVariable: boolean;
    }
  >;
  readonly finishesById: ReadonlyMap<
    string,
    { readonly pricePerM2Grosze: number; readonly setupFeeGrosze: number }
  >;
  readonly thicknessesByMm: ReadonlyMap<number, { readonly priceFactorBp: number }>;
  readonly installVariantsByCode: ReadonlyMap<string, { readonly priceFactorBp: number }>;
  readonly personalizationSpec: PersonalizationSpecRow | null;
  /** Only the fonts this product's `PersonalizationSpec.allowedFontIds` actually lists. */
  readonly fontsById: ReadonlyMap<string, FontRow>;
  readonly machine: MachineSettingsRow;
  readonly pricing: PricingSettingsRow;
};

/**
 * `activeOnly` defaults to `true` (every existing call site's behavior,
 * unchanged) — pass `false` only from a caller already gated behind
 * `requireStaffSession()`, e.g. the "Preview as customer" admin feature
 * previewing a not-yet-published product's configurator exactly as
 * `/produkt/[slug]/page.tsx` renders it.
 */
export async function getConfiguratorProductData(
  slug: string,
  activeOnly = true,
): Promise<ConfiguratorProductData | null> {
  const [product, machine, pricing] = await Promise.all([
    prisma.product.findFirst({
      // Same `category.isActive` cascade as `products.ts`'s
      // `findProductBySlug` — a deactivated category (Gres/Panele
      // podłogowe, 2026-08-28) must block pricing/checkout for its
      // products too, not just hide them from listings.
      where: activeOnly ? { slug, isActive: true, category: { isActive: true } } : { slug },
      select: {
        id: true,
        namePl: true,
        typeCode: true,
        basePriceGrosze: true,
        minPriceGrosze: true,
        minWidthMm: true,
        maxWidthMm: true,
        minHeightMm: true,
        maxHeightMm: true,
        minAspectRatioBp: true,
        maxAspectRatioBp: true,
        personalization: {
          select: {
            isEnabled: true,
            maxCharacters: true,
            maxLines: true,
            minTextHeightUm: true,
            flatFeeGrosze: true,
            pricePerCharGrosze: true,
            allowedFontIds: true,
          },
        },
        materials: {
          select: {
            priceFactorBp: true,
            material: {
              select: {
                id: true,
                namePl: true,
                isAvailable: true,
                imageUrl: true,
                pricePerM2Grosze: true,
                maxSheetWidthMm: true,
                maxSheetHeightMm: true,
                minLineWidthUm: true,
                minDetailSpacingUm: true,
                minTextHeightUm: true,
                isNaturalVariable: true,
                finishes: {
                  select: {
                    finish: {
                      select: {
                        id: true,
                        namePl: true,
                        isAvailable: true,
                        imageUrl: true,
                        pricePerM2Grosze: true,
                        setupFeeGrosze: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        designs: {
          select: {
            surchargeGrosze: true,
            design: {
              select: {
                id: true,
                namePl: true,
                isActive: true,
                rightsStatus: true,
                previewUrl: true,
                referenceWidthMm: true,
                minLineWidthUm: true,
                minDetailSpacingUm: true,
                detailLevel: true,
                minRecommendedWidthMm: true,
                machiningMilliMinutesPerM2: true,
                recommendedMethod: true,
                materials: { select: { materialId: true } },
              },
            },
          },
        },
        thicknesses: {
          select: { thicknessMm: true, labelPl: true, priceFactorBp: true },
        },
        installVariants: {
          select: {
            code: true,
            namePl: true,
            descPl: true,
            receivesPl: true,
            diagramUrl: true,
            maxThicknessMm: true,
            priceFactorBp: true,
          },
        },
        presetSizes: {
          select: { id: true, widthMm: true, heightMm: true, labelPl: true },
          orderBy: { sortOrder: 'asc' },
        },
        // 2026-08-29: which finishes are excluded for THIS product even when
        // the material otherwise allows them (`ProductFinishExclusion`'s own
        // schema comment — e.g. bejcowanie/lakierowanie off by default for
        // the wall-art "Obrazy" product). A `Set` of ids, filtered against
        // below — never trusted as "the only finishes", since a material's
        // own `MaterialFinish` compatibility still applies first.
        finishExclusions: { select: { finishId: true } },
      },
    }),
    prisma.machineSettings.findUnique({ where: { id: 1 } }),
    prisma.pricingSettings.findFirst({ where: { isActive: true } }),
  ]);

  if (product === null || machine === null || pricing === null) {
    return null;
  }

  const excludedFinishIds = new Set(product.finishExclusions.map((row) => row.finishId));

  // A second round trip, deliberately: `allowedFontIds` only exists once we
  // have `product.personalization`, so this cannot join into the query
  // above. `PersonalizationSpec.allowedFontIds` is a plain string array, not
  // a relation (see the schema's own comment on that field), so there is no
  // Prisma `include` that would fetch it in one shot either.
  const fonts =
    product.personalization === null || product.personalization.allowedFontIds.length === 0
      ? []
      : await prisma.font.findMany({
          where: { id: { in: product.personalization.allowedFontIds }, isActive: true },
          select: {
            id: true,
            namePl: true,
            fileUrl: true,
            minHeightUm: true,
            coveredCodePointRanges: true,
          },
          orderBy: { sortOrder: 'asc' },
        });

  const materialsById = new Map(
    product.materials.map(({ material, priceFactorBp }) => [
      material.id,
      {
        priceFactorBp,
        pricePerM2Grosze: material.pricePerM2Grosze,
        maxSheetWidthMm: material.maxSheetWidthMm,
        maxSheetHeightMm: material.maxSheetHeightMm,
        minLineWidthUm: material.minLineWidthUm,
        minDetailSpacingUm: material.minDetailSpacingUm,
        minTextHeightUm: material.minTextHeightUm,
        isNaturalVariable: material.isNaturalVariable,
      },
    ]),
  );

  const finishesById = new Map(
    product.materials.flatMap(({ material }) =>
      material.finishes
        .filter(({ finish }) => !excludedFinishIds.has(finish.id))
        .map(({ finish }) => [
          finish.id,
          { pricePerM2Grosze: finish.pricePerM2Grosze, setupFeeGrosze: finish.setupFeeGrosze },
        ]),
    ),
  );

  const designsById = new Map(
    product.designs.map(({ design, surchargeGrosze }) => [
      design.id,
      {
        surchargeGrosze,
        referenceWidthMm: design.referenceWidthMm,
        minLineWidthUm: design.minLineWidthUm,
        minDetailSpacingUm: design.minDetailSpacingUm,
        detailLevel: design.detailLevel,
        minRecommendedWidthMm: design.minRecommendedWidthMm,
        machiningMilliMinutesPerM2: design.machiningMilliMinutesPerM2,
        recommendedMethod: design.recommendedMethod,
      },
    ]),
  );

  const thicknessesByMm = new Map(
    product.thicknesses.map((thickness) => [
      thickness.thicknessMm,
      { priceFactorBp: thickness.priceFactorBp },
    ]),
  );

  const installVariantsByCode = new Map(
    product.installVariants.map((variant) => [
      variant.code,
      { priceFactorBp: variant.priceFactorBp },
    ]),
  );

  const fontsById = new Map(
    fonts.map((font) => [
      font.id,
      {
        id: font.id,
        minHeightUm: font.minHeightUm,
        coveredCodePointRanges: font.coveredCodePointRanges,
      },
    ]),
  );

  const productRow: ProductRow & { isFloorElement: boolean } = {
    basePriceGrosze: product.basePriceGrosze,
    minPriceGrosze: product.minPriceGrosze,
    minWidthMm: product.minWidthMm,
    maxWidthMm: product.maxWidthMm,
    minHeightMm: product.minHeightMm,
    maxHeightMm: product.maxHeightMm,
    minAspectRatioBp: product.minAspectRatioBp,
    maxAspectRatioBp: product.maxAspectRatioBp,
    isFloorElement: product.typeCode === 'FLOOR_ELEMENT',
  };

  const options: ConfiguratorOptionData = {
    materials: product.materials.map(({ material }) => ({
      id: material.id,
      namePl: material.namePl,
      isAvailable: material.isAvailable,
      imageUrl: material.imageUrl,
      finishes: material.finishes
        .filter(({ finish }) => !excludedFinishIds.has(finish.id))
        .map(({ finish }) => ({
          id: finish.id,
          namePl: finish.namePl,
          isAvailable: finish.isAvailable,
          imageUrl: finish.imageUrl,
        })),
    })),
    designs: product.designs.map(({ design }) => ({
      id: design.id,
      namePl: design.namePl,
      isActive: design.isActive,
      rightsStatus: design.rightsStatus,
      allowedMaterialIds: design.materials.map((m) => m.materialId),
      previewUrl: design.previewUrl,
    })),
    thicknesses: product.thicknesses.map((thickness) => ({
      thicknessMm: thickness.thicknessMm,
      labelPl: thickness.labelPl,
    })),
    installVariants: product.installVariants.map((variant) => ({
      code: variant.code,
      namePl: variant.namePl,
      descPl: variant.descPl,
      receivesPl: variant.receivesPl,
      diagramUrl: variant.diagramUrl,
      maxThicknessMm: variant.maxThicknessMm,
    })),
    fonts: fonts.map((font) => ({ id: font.id, namePl: font.namePl, fileUrl: font.fileUrl })),
    presetSizes: product.presetSizes.map((preset) => ({
      id: preset.id,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
      labelPl: preset.labelPl,
    })),
  };

  return {
    productId: product.id,
    namePl: product.namePl,
    typeCode: product.typeCode,
    product: productRow,
    options,
    designsById,
    materialsById,
    finishesById,
    thicknessesByMm,
    installVariantsByCode,
    personalizationSpec: product.personalization,
    fontsById,
    machine,
    pricing,
  };
}
