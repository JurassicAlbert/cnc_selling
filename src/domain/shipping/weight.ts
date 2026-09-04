/**
 * Real shipping weight, computed from real geometry - 2026-08-29, owner
 * request: "cena powinna być przeliczana na podstawie wielkości i wagi
 * produktu zgodnie z danymi cenowymi wybranego kuriera" (price should be
 * calculated from the product's size and weight, per the chosen courier's
 * own pricing data).
 *
 * No product carries its own fabricated "weight" field - every product
 * here is custom-sized (`widthMm`/`heightMm`/`thicknessMm` vary per
 * configuration), so a single static weight per product would already be
 * wrong for most real configurations. Instead: weight = volume × the real
 * material's own density (`Material.densityKgPerM3`, sourced from
 * standard published wood/gres reference values - see `prisma/seed.ts`'s
 * `MATERIAL_SEEDS` for the exact figures and their citation). Pure, no I/O.
 */

const GRAMS_PER_KG = 1000;
const MM_PER_M = 1000;

/** A reasonable panel thickness to assume when a cart item genuinely has none recorded (e.g. a non-dimensional product) - documented, not fabricated business data; common furniture-grade sheet stock. */
const FALLBACK_THICKNESS_MM = 18;
/** A small nominal weight for the rare item with no dimensions at all to compute from - never the majority of a real order's weight in practice. */
const FALLBACK_ITEM_WEIGHT_GRAMS = 150;

export type ItemDimensions = {
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  readonly thicknessMm: number | null;
  /** `null` for a configuration with no material yet - never happens for a real priced cart item, but the type allows it. */
  readonly materialDensityKgPerM3: number | null;
};

/** One item's real weight, in grams - `volumeM3 × densityKgPerM3 × 1000`. */
export function computeItemWeightGrams(dims: ItemDimensions): number {
  if (dims.widthMm === null || dims.heightMm === null || dims.materialDensityKgPerM3 === null) {
    return FALLBACK_ITEM_WEIGHT_GRAMS;
  }
  const thicknessMm = dims.thicknessMm ?? FALLBACK_THICKNESS_MM;
  const volumeM3 = (dims.widthMm / MM_PER_M) * (dims.heightMm / MM_PER_M) * (thicknessMm / MM_PER_M);
  const weightKg = volumeM3 * dims.materialDensityKgPerM3;
  return Math.max(1, Math.round(weightKg * GRAMS_PER_KG));
}

export type CartWeightItem = ItemDimensions & { readonly quantity: number };

/** Sum of every line's weight × quantity - the real figure a courier's weight-tier price is picked against. */
export function computeCartWeightGrams(items: readonly CartWeightItem[]): number {
  return items.reduce((sum, item) => sum + computeItemWeightGrams(item) * item.quantity, 0);
}

/**
 * Does one item physically fit an InPost Paczkomat locker of these real
 * dimensions? The locker's door/compartment opening is a fixed
 * width × height across every size (InPost's own published dimensions);
 * only the depth varies by size. An item fits if two of its three
 * dimensions, in EITHER pairing, are within the fixed opening - the third
 * (thinnest reasonable orientation) must clear the depth.
 */
export function fitsLockerOpening(
  item: { readonly widthMm: number; readonly heightMm: number; readonly thicknessMm: number },
  locker: { readonly openingWidthMm: number; readonly openingHeightMm: number; readonly maxDepthMm: number },
): boolean {
  const dims = [item.widthMm, item.heightMm, item.thicknessMm];
  // Try every pairing as the "face" that must fit the fixed door opening -
  // whichever dimension is left over must fit the size-specific depth.
  for (let i = 0; i < dims.length; i++) {
    const depth = dims[i] as number;
    const [a, b] = dims.filter((_, index) => index !== i) as [number, number];
    const facesOpening = (a <= locker.openingWidthMm && b <= locker.openingHeightMm) || (a <= locker.openingHeightMm && b <= locker.openingWidthMm);
    if (facesOpening && depth <= locker.maxDepthMm) {
      return true;
    }
  }
  return false;
}
