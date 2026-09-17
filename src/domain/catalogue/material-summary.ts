/**
 * What a product card should say about the materials it offers - UX-17.
 *
 * The card used to render `materials[0].namePl` plus „ +N", which is
 * developer shorthand: „Dąb +3" reads as a version number to anyone who has
 * not seen the data behind it. The checklist proposed „4 gatunki drewna",
 * and that phrase is only true for some products.
 *
 * **`fartuch-kuchenny-z-grawerem` offers exactly one material and it is Gres
 * biały, family `CERAMIC`.** The schema also allows `PLYWOOD`, `MDF`,
 * `LEATHER` and `OTHER`. So the count alone cannot choose the noun, and
 * calling a tile a „gatunek drewna" is the plain kind of lie the owner ruled
 * out. The families decide it.
 *
 * Pure, and in `domain` rather than beside the component, because it is a
 * statement about the catalogue rather than about a layout - and because the
 * rule is worth testing without rendering anything.
 */

/**
 * Mirrors `MaterialFamily` in `prisma/schema.prisma`. Written out rather than
 * imported from `@/generated/prisma` so `domain` keeps its "no framework, no
 * database" property, which every other module here holds to. A family added
 * to the schema and passed in here stops compiling at the call site, which is
 * the reminder we would want.
 */
export type MaterialFamily = 'SOLID_WOOD' | 'PLYWOOD' | 'MDF' | 'CERAMIC' | 'LEATHER' | 'OTHER';

export type MaterialChoice = {
  readonly namePl: string;
  readonly family: MaterialFamily;
};

export type MaterialSummary =
  | { readonly kind: 'none' }
  /** One option: its name, which is always more use than the number 1. */
  | { readonly kind: 'single'; readonly namePl: string }
  /** Several, and every one of them a real wood species. */
  | { readonly kind: 'wood'; readonly count: number }
  /** Several, not all wood - the count is still worth saying, the word is not. */
  | { readonly kind: 'mixed'; readonly count: number };

export function summariseMaterials(materials: readonly MaterialChoice[]): MaterialSummary {
  if (materials.length === 0) {
    return { kind: 'none' };
  }
  const only = materials[0];
  if (materials.length === 1 && only !== undefined) {
    return { kind: 'single', namePl: only.namePl };
  }
  /*
    `SOLID_WOOD` and nothing else. Plywood and MDF are wood-derived boards
    rather than species, and „gatunek" means species - so a product offering
    oak and plywood gets the count without the noun.
  */
  const everyOneIsWood = materials.every((material) => material.family === 'SOLID_WOOD');
  return { kind: everyOneIsWood ? 'wood' : 'mixed', count: materials.length };
}
