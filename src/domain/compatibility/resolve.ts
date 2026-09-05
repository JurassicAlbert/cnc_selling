/**
 * Compatibility resolution - §7.2 of the architecture doc.
 *
 * For every configurator step, the server returns the option set already
 * filtered by compatibility. These functions ARE that filter: pure, no I/O,
 * operating on rows the mapper has already fetched from the database. An
 * unavailable option is shown disabled with a Polish reason (that copy lives
 * in `src/content/pl`, not here) - never silently hidden and never silently
 * included.
 */

export type MaterialOption = {
  readonly materialId: string;
  readonly isAvailable: boolean;
};

/**
 * `availableMaterials(product) = ProductMaterial ∩ Material.isAvailable
 *                                ∩ (design.materials if design narrows)`
 *
 * `designNarrowing` is the chosen design's own `DesignMaterial` rows - NOT a
 * per-material lookup. An empty (or omitted) array means the design does not
 * narrow materials at all: the schema's comment on `Design.materials` is
 * explicit that "no rows means every material the product allows", so empty
 * must never be read as "narrows to nothing".
 */
export function availableMaterials(
  productMaterials: readonly MaterialOption[],
  designNarrowing: readonly string[] = [],
): string[] {
  const narrowedTo = designNarrowing.length > 0 ? new Set(designNarrowing) : null;

  return productMaterials
    .filter((material) => material.isAvailable && (narrowedTo === null || narrowedTo.has(material.materialId)))
    .map((material) => material.materialId);
}

export type FinishOption = {
  readonly finishId: string;
  readonly isAvailable: boolean;
};

/**
 * `availableFinishes(product, material) = MaterialFinish(material) ∩ Finish.isAvailable`
 *
 * Unlike material/design narrowing, there is no "empty means all" rule here:
 * a material with no `MaterialFinish` rows offers no finish, full stop. The
 * caller passes only the rows for the ALREADY-CHOSEN material.
 */
export function availableFinishes(materialFinishes: readonly FinishOption[]): string[] {
  return materialFinishes
    .filter((finish) => finish.isAvailable)
    .map((finish) => finish.finishId);
}

/**
 * Only these two rights statuses are ever sellable (brief §12). A design can
 * be catalogued - for internal reference, or pending permission - without
 * ever appearing in a customer-facing option list.
 */
const SELLABLE_RIGHTS_STATUSES: ReadonlySet<string> = new Set([
  'APPROVED_COMMERCIAL',
  'PUBLIC_DOMAIN',
]);

export type DesignOption = {
  readonly designId: string;
  readonly isActive: boolean;
  readonly rightsStatus: string;
  /** This DESIGN's own DesignMaterial rows. Empty means every material the product allows. */
  readonly allowedMaterialIds: readonly string[];
};

/**
 * `availableDesigns(product, material?) = ProductDesign ∩ Design.isActive
 *   ∩ rightsStatus ∈ {APPROVED_COMMERCIAL, PUBLIC_DOMAIN}
 *   ∩ (DesignMaterial if narrowed)`
 *
 * The narrowing here runs the OPPOSITE direction from `availableMaterials`:
 * each design carries its own optional material allow-list, and a design
 * whose list is non-empty and does not contain the selected material is
 * excluded. `selectedMaterialId: null` means no material has been chosen
 * yet, so no design can be excluded on that basis.
 */
export function availableDesigns(
  productDesigns: readonly DesignOption[],
  selectedMaterialId: string | null,
): string[] {
  return productDesigns
    .filter(
      (design) =>
        design.isActive &&
        SELLABLE_RIGHTS_STATUSES.has(design.rightsStatus) &&
        (selectedMaterialId === null ||
          design.allowedMaterialIds.length === 0 ||
          design.allowedMaterialIds.includes(selectedMaterialId)),
    )
    .map((design) => design.designId);
}

export type ThicknessOption = {
  readonly thicknessMm: number;
};

/**
 * `availableThicknesses(product, variant) = ProductThickness ∩ variant.maxThicknessMm`
 *
 * `maxThicknessMm: null` means the installation variant does not cap
 * thickness (or no variant applies). The cap is inclusive: a thickness
 * exactly at the limit is offered, not excluded.
 */
export function availableThicknesses(
  productThicknesses: readonly ThicknessOption[],
  maxThicknessMm: number | null,
): number[] {
  return productThicknesses
    .filter((thickness) => maxThicknessMm === null || thickness.thicknessMm <= maxThicknessMm)
    .map((thickness) => thickness.thicknessMm);
}
