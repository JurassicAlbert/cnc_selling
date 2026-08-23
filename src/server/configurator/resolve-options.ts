/**
 * The option list for each configurator step — ARCHITECTURE.md §7.2.
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
};

export type FinishOptionRow = {
  readonly id: string;
  readonly namePl: string;
  readonly isAvailable: boolean;
};

export type DesignOptionRow = {
  readonly id: string;
  readonly namePl: string;
  readonly isActive: boolean;
  readonly rightsStatus: string;
  /** This design's own DesignMaterial rows. Empty means every material the product allows. */
  readonly allowedMaterialIds: readonly string[];
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

export type ConfiguratorOptionData = {
  readonly materials: readonly (MaterialOptionRow & {
    readonly finishes: readonly FinishOptionRow[];
  })[];
  readonly designs: readonly DesignOptionRow[];
  readonly thicknesses: readonly ThicknessOptionRow[];
  readonly installVariants: readonly InstallationVariantOptionRow[];
};

export type ResolvedOptions = {
  readonly materialIds: readonly string[];
  readonly designIds: readonly string[];
  /** Empty before a material is chosen — there is nothing to resolve finishes against yet. */
  readonly finishIds: readonly string[];
  readonly thicknessesMm: readonly number[];
  /** Unfiltered — nothing narrows which installation variants exist. */
  readonly installVariantCodes: readonly string[];
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

  return { materialIds, designIds, finishIds, thicknessesMm, installVariantCodes };
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
