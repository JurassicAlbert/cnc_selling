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

export async function getConfiguratorProductData(
  slug: string,
): Promise<ConfiguratorProductData | null> {
  const [product, machine, pricing] = await Promise.all([
    prisma.product.findFirst({
      where: { slug, isActive: true },
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
      },
    }),
    prisma.machineSettings.findUnique({ where: { id: 1 } }),
    prisma.pricingSettings.findFirst({ where: { isActive: true } }),
  ]);

  if (product === null || machine === null || pricing === null) {
    return null;
  }

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
          select: { id: true, namePl: true, minHeightUm: true, coveredCodePointRanges: true },
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
      material.finishes.map(({ finish }) => [
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
      finishes: material.finishes.map(({ finish }) => ({
        id: finish.id,
        namePl: finish.namePl,
        isAvailable: finish.isAvailable,
      })),
    })),
    designs: product.designs.map(({ design }) => ({
      id: design.id,
      namePl: design.namePl,
      isActive: design.isActive,
      rightsStatus: design.rightsStatus,
      allowedMaterialIds: design.materials.map((m) => m.materialId),
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
    fonts: fonts.map((font) => ({ id: font.id, namePl: font.namePl })),
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
