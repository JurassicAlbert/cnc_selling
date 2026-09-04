/**
 * The option list for each configurator step - ARCHITECTURE.md §7.2.
 *
 * The actual filtering rules live in `domain/compatibility` and are already
 * unit-tested there. This module is thin on purpose: it only reshapes a real
 * product's rows (whatever field names the schema happens to use) into the
 * inputs those pure functions expect, and reads back the customer's current
 * selection to know which direction to narrow.
 */

import {
  availableDesigns,
  availableFinishes,
  availableMaterials,
  availableThicknesses,
} from '@/domain/compatibility/resolve';
import type { Selections } from '@/domain/configuration/steps';

export type MaterialOptionRow = {
  readonly id: string;
  readonly namePl: string;
  readonly isAvailable: boolean;
  /** Real, sourced material photography (§9g) - the 2D preview's background swatch, never invented. */
  readonly imageUrl: string;
};

export type FinishOptionRow = {
  readonly id: string;
  readonly namePl: string;
  readonly isAvailable: boolean;
  /** Real, sourced finish photography - same swatch-image treatment `MaterialOptionRow.imageUrl` already gets. */
  readonly imageUrl: string;
};

export type DesignOptionRow = {
  readonly id: string;
  readonly namePl: string;
  readonly isActive: boolean;
  readonly rightsStatus: string;
  /** This design's own DesignMaterial rows. Empty means every material the product allows. */
  readonly allowedMaterialIds: readonly string[];
  /** The 2D preview's overlay artwork - the same placeholder SVG shown everywhere else this design appears. */
  readonly previewUrl: string;
};

export type ThicknessOptionRow = {
  readonly thicknessMm: number;
  readonly labelPl: string;
};

export type InstallationVariantOptionRow = {
  readonly code: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly receivesPl: string;
  readonly diagramUrl: string;
  readonly maxThicknessMm: number | null;
};

export type FontOptionRow = {
  readonly id: string;
  readonly namePl: string;
  /**
   * The exact same file `seedFont` parsed the coverage from - the 2D
   * preview loads this via the Font Loading API so the glyphs it draws are
   * never a stand-in for what validation actually checked (the `Font`
   * model's own header: "the preview MUST render with this same file, or
   * the preview is a lie").
   */
  readonly fileUrl: string;
};

/** A real `ProductPresetSize` row - 2026-08-29: SIZE picked from a short, real, staff-curated list instead of typed free-form, wherever the product doesn't require an exact customer-supplied size (`Product.requiresExactSize`). */
export type PresetSizeOptionRow = {
  readonly id: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly labelPl: string;
};

export type ConfiguratorOptionData = {
  readonly materials: readonly (MaterialOptionRow & {
    readonly finishes: readonly FinishOptionRow[];
  })[];
  readonly designs: readonly DesignOptionRow[];
  readonly thicknesses: readonly ThicknessOptionRow[];
  readonly installVariants: readonly InstallationVariantOptionRow[];
  /** Already scoped to this product's `PersonalizationSpec.allowedFontIds` - never every Font row. */
  readonly fonts: readonly FontOptionRow[];
  /** Empty for a product with none seeded yet, or for one where `requiresExactSize` makes a fixed list nonsensical. */
  readonly presetSizes: readonly PresetSizeOptionRow[];
};

export type ResolvedOptions = {
  readonly materialIds: readonly string[];
  readonly designIds: readonly string[];
  /** Empty before a material is chosen - there is nothing to resolve finishes against yet. */
  readonly finishIds: readonly string[];
  readonly thicknessesMm: readonly number[];
  /** Unfiltered - nothing narrows which installation variants exist. */
  readonly installVariantCodes: readonly string[];
  /** Unfiltered - no compatibility rule narrows which font applies, unlike material/design. */
  readonly fontIds: readonly string[];
};

export function resolveOptions(
  data: ConfiguratorOptionData,
  selections: Selections,
): ResolvedOptions {
  const materialIds = availableMaterials(
    data.materials.map((material) => ({
      materialId: material.id,
      isAvailable: material.isAvailable,
    })),
    designAllowedMaterialIds(data, selections.designId),
  );

  const designIds = availableDesigns(
    data.designs.map((design) => ({
      designId: design.id,
      isActive: design.isActive,
      rightsStatus: design.rightsStatus,
      allowedMaterialIds: design.allowedMaterialIds,
    })),
    selections.materialId,
  );

  const selectedMaterial =
    selections.materialId === null
      ? null
      : (data.materials.find((material) => material.id === selections.materialId) ?? null);
  const finishIds =
    selectedMaterial === null
      ? []
      : availableFinishes(
          selectedMaterial.finishes.map((finish) => ({
            finishId: finish.id,
            isAvailable: finish.isAvailable,
          })),
        );

  const selectedVariant =
    selections.installationVariant === null
      ? null
      : (data.installVariants.find((variant) => variant.code === selections.installationVariant) ??
        null);
  const thicknessesMm = availableThicknesses(
    data.thicknesses,
    selectedVariant?.maxThicknessMm ?? null,
  );

  const installVariantCodes = data.installVariants.map((variant) => variant.code);
  const fontIds = data.fonts.map((font) => font.id);

  return { materialIds, designIds, finishIds, thicknessesMm, installVariantCodes, fontIds };
}

function designAllowedMaterialIds(
  data: ConfiguratorOptionData,
  designId: string | null,
): readonly string[] {
  if (designId === null) {
    return [];
  }
  const design = data.designs.find((candidate) => candidate.id === designId);
  return design?.allowedMaterialIds ?? [];
}

// ---------------------------------------------------------------------------
// Annotated availability - ARCHITECTURE.md §7.2: "Unavailable options are
// shown disabled with a Polish reason, not hidden - a hidden option looks
// like a missing feature; a disabled one with a reason teaches the customer
// the rule." `resolveOptions` above answers "which ids may I select"; this
// answers "what do I render for every option that exists, and why is one of
// them greyed out" - every reason is derived by comparing two calls to the
// already-tested `domain/compatibility` functions, never by re-implementing
// their rules here.
// ---------------------------------------------------------------------------

export type UnavailabilityReason =
  | 'MATERIAL_NOT_OFFERED'
  | 'EXCLUDED_BY_DESIGN'
  | 'DESIGN_NOT_OFFERED'
  | 'EXCLUDED_BY_MATERIAL'
  | 'FINISH_NOT_OFFERED'
  | 'THICKNESS_EXCEEDS_INSTALLATION_VARIANT';

export type OptionAvailability = {
  readonly id: string;
  readonly namePl: string;
  readonly isAvailable: boolean;
  readonly reason: UnavailabilityReason | null;
};

export type ResolvedOptionAvailability = {
  readonly materials: readonly OptionAvailability[];
  readonly designs: readonly OptionAvailability[];
  /** Empty before a material is chosen - there is nothing to enumerate yet. */
  readonly finishes: readonly OptionAvailability[];
  readonly thicknesses: readonly OptionAvailability[];
  /** Every font always available - no compatibility rule narrows it, same as installation variants. */
  readonly fonts: readonly OptionAvailability[];
};

export function resolveOptionAvailability(
  data: ConfiguratorOptionData,
  selections: Selections,
): ResolvedOptionAvailability {
  const materialRows = data.materials.map((material) => ({
    materialId: material.id,
    isAvailable: material.isAvailable,
  }));
  const materialBaseline = new Set(availableMaterials(materialRows, []));
  const materialNarrowed = new Set(
    availableMaterials(materialRows, designAllowedMaterialIds(data, selections.designId)),
  );
  const materials = data.materials.map((material): OptionAvailability => {
    if (!materialBaseline.has(material.id)) {
      return { id: material.id, namePl: material.namePl, isAvailable: false, reason: 'MATERIAL_NOT_OFFERED' };
    }
    if (!materialNarrowed.has(material.id)) {
      return { id: material.id, namePl: material.namePl, isAvailable: false, reason: 'EXCLUDED_BY_DESIGN' };
    }
    return { id: material.id, namePl: material.namePl, isAvailable: true, reason: null };
  });

  const designRows = data.designs.map((design) => ({
    designId: design.id,
    isActive: design.isActive,
    rightsStatus: design.rightsStatus,
    allowedMaterialIds: design.allowedMaterialIds,
  }));
  const designBaseline = new Set(availableDesigns(designRows, null));
  const designNarrowed = new Set(availableDesigns(designRows, selections.materialId));
  const designs = data.designs.map((design): OptionAvailability => {
    if (!designBaseline.has(design.id)) {
      return { id: design.id, namePl: design.namePl, isAvailable: false, reason: 'DESIGN_NOT_OFFERED' };
    }
    if (!designNarrowed.has(design.id)) {
      return { id: design.id, namePl: design.namePl, isAvailable: false, reason: 'EXCLUDED_BY_MATERIAL' };
    }
    return { id: design.id, namePl: design.namePl, isAvailable: true, reason: null };
  });

  const selectedMaterial =
    selections.materialId === null
      ? null
      : (data.materials.find((material) => material.id === selections.materialId) ?? null);
  const finishes: OptionAvailability[] =
    selectedMaterial === null
      ? []
      : selectedMaterial.finishes.map((finish) => ({
          id: finish.id,
          namePl: finish.namePl,
          isAvailable: finish.isAvailable,
          reason: finish.isAvailable ? null : 'FINISH_NOT_OFFERED',
        }));

  const selectedVariant =
    selections.installationVariant === null
      ? null
      : (data.installVariants.find((variant) => variant.code === selections.installationVariant) ??
        null);
  const thicknessAvailable = new Set(
    availableThicknesses(data.thicknesses, selectedVariant?.maxThicknessMm ?? null),
  );
  const thicknesses = data.thicknesses.map((thickness): OptionAvailability => {
    const isAvailable = thicknessAvailable.has(thickness.thicknessMm);
    return {
      id: String(thickness.thicknessMm),
      namePl: thickness.labelPl,
      isAvailable,
      reason: isAvailable ? null : 'THICKNESS_EXCEEDS_INSTALLATION_VARIANT',
    };
  });

  const fonts: OptionAvailability[] = data.fonts.map((font) => ({
    id: font.id,
    namePl: font.namePl,
    isAvailable: true,
    reason: null,
  }));

  return { materials, designs, finishes, thicknesses, fonts };
}
