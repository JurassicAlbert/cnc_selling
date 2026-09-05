/**
 * "Which of our items can we make from this board, and how many?"
 *
 * The owner's 2026-09-04 request, verbatim: "when we put what desk we have,
 * z jakimi wymiarami, to pokazuje nam ikonki przedmiotów z kategorii i
 * kolekcji jakie możemy zrobić". This is the query behind that screen.
 *
 * It deliberately reuses the catalogue's own rules rather than inventing a
 * parallel set. A product appears here only if it is genuinely orderable
 * today: active, in an active category, and offering this material. That
 * matters because the whole point of the screen is to answer "what can I
 * actually make", and a list that includes a retired product is worse than
 * no list - the same reasoning behind `offered-is-buildable.test.ts`.
 *
 * The arithmetic lives in `domain/stock/board.ts`, pure and unit-tested.
 * Nothing here computes a yield or a cost itself.
 */

import { boardCostPerM2Grosze, fitsOnBoard, howManyFitOnBoard, materialCostForItemGrosze } from '@/domain/stock/board';
import type { Board } from '@/domain/stock/board';
import { stepsForProductType } from '@/domain/configuration/steps';
import type { ProductTypeCode } from '@/domain/configuration/steps';
import { prisma } from '@/server/db/client';

export type MakeableItem = {
  readonly slug: string;
  readonly namePl: string;
  readonly categoryNamePl: string;
  /**
   * The shop's own product photo, rendered small on the warehouse screen.
   * `null` when a product has no image yet, which the UI shows as a plain
   * placeholder rather than inventing one.
   */
  readonly imageUrl: string | null;
  /** The offered size that yields the most pieces from this board. */
  readonly bestSize: { readonly widthMm: number; readonly heightMm: number; readonly labelPl: string };
  /** How many of that size come off one board, cutting in rows. */
  readonly fitsPerBoard: number;
  /** What the material for one piece really cost, from this board's price. */
  readonly materialCostGrosze: number;
  /** The advertised gross "od" price, for comparison. `null` when there is none. */
  readonly startingPriceGrossGrosze: number | null;
};

export type BoardFitReport = {
  readonly costPerM2Grosze: number;
  /** Catalogue rate for the same material, so the screen can show the gap. */
  readonly chargedPerM2Grosze: number;
  readonly items: readonly MakeableItem[];
  /**
   * Products that offer this material but whose smallest offered size will
   * not fit on the board. Listed rather than dropped: "this board is too
   * small for X" is the answer the operator came for just as often as the
   * positive one.
   */
  readonly tooLarge: readonly { readonly slug: string; readonly namePl: string }[];
};

/**
 * A product's thickness step, if it has one, has to match the board. A
 * product type with no THICKNESS step is made from whatever stock is to
 * hand, so the board's thickness does not constrain it - the same rule
 * `findSelectionOutsideProductType` applies on the write path.
 */
function thicknessAllows(
  typeCode: ProductTypeCode,
  offeredThicknessesMm: readonly number[],
  boardThicknessMm: number,
): boolean {
  if (!stepsForProductType(typeCode).includes('THICKNESS')) {
    return true;
  }
  if (offeredThicknessesMm.length === 0) {
    return true;
  }
  return offeredThicknessesMm.includes(boardThicknessMm);
}

export async function reportWhatFitsOnBoard(materialId: string, board: Board): Promise<BoardFitReport | null> {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: { id: true, pricePerM2Grosze: true },
  });
  if (material === null) {
    return null;
  }

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      category: { isActive: true },
      materials: { some: { materialId } },
    },
    select: {
      slug: true,
      namePl: true,
      typeCode: true,
      minWidthMm: true,
      minHeightMm: true,
      startingPriceGrossGrosze: true,
      category: { select: { namePl: true } },
      presetSizes: { select: { widthMm: true, heightMm: true, labelPl: true }, orderBy: { sortOrder: 'asc' } },
      thicknesses: { select: { thicknessMm: true } },
      images: { select: { url: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
    },
    orderBy: { namePl: 'asc' },
  });

  const items: MakeableItem[] = [];
  const tooLarge: { slug: string; namePl: string }[] = [];

  for (const product of products) {
    if (!thicknessAllows(product.typeCode, product.thicknesses.map((t) => t.thicknessMm), board.thicknessMm)) {
      continue;
    }

    // A product with no preset sizes (a floor element, which needs the
    // customer's own measurement) is represented by its smallest orderable
    // size: that is the one honest answer to "can this board make one".
    const candidates =
      product.presetSizes.length > 0
        ? product.presetSizes
        : [{ widthMm: product.minWidthMm, heightMm: product.minHeightMm, labelPl: `${product.minWidthMm} x ${product.minHeightMm} mm` }];

    const fitting = candidates.filter((size) => fitsOnBoard(board, size));
    if (fitting.length === 0) {
      tooLarge.push({ slug: product.slug, namePl: product.namePl });
      continue;
    }

    const best = fitting.reduce((a, b) =>
      howManyFitOnBoard(board, b) > howManyFitOnBoard(board, a) ? b : a,
    );

    items.push({
      slug: product.slug,
      namePl: product.namePl,
      categoryNamePl: product.category.namePl,
      imageUrl: product.images[0]?.url ?? null,
      bestSize: { widthMm: best.widthMm, heightMm: best.heightMm, labelPl: best.labelPl },
      fitsPerBoard: howManyFitOnBoard(board, best),
      materialCostGrosze: materialCostForItemGrosze(board, best),
      startingPriceGrossGrosze: product.startingPriceGrossGrosze,
    });
  }

  return {
    costPerM2Grosze: boardCostPerM2Grosze(board),
    chargedPerM2Grosze: material.pricePerM2Grosze,
    items,
    tooLarge,
  };
}
