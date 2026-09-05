/**
 * Reads for the warehouse screens. Owner request, 2026-09-04: "save materials
 * what we have on magazine, have link with pages for each material, so we can
 * tell how much we need to pay for material".
 *
 * Reads only, and deliberately staff-visible: a workshop operator needs to
 * know what is on the shelf. Writing a batch, which records what the shop
 * paid and who it bought from, is ADMIN, matching the split
 * `admin-pricing.ts` already uses (reading a draft is STAFF, publishing it is
 * ADMIN). That is a judgement call rather than something §16.3 settles, and
 * it is recorded here so it can be changed deliberately.
 */

import { boardCostPerM2Grosze, stockMarginBp } from '@/domain/stock/board';
import { prisma } from '@/server/db/client';

export type StockBatch = {
  readonly id: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly thicknessMm: number;
  readonly quantity: number;
  readonly purchasePriceGrosze: number;
  /** What this batch's boards really cost per square metre. */
  readonly costPerM2Grosze: number;
  readonly supplierNamePl: string | null;
  readonly supplierUrl: string | null;
  readonly notePl: string | null;
  readonly purchasedAt: Date;
};

export type MaterialStockSummary = {
  readonly materialId: string;
  readonly materialSlug: string;
  readonly materialNamePl: string;
  readonly materialImageUrl: string;
  readonly isAvailable: boolean;
  /** What the catalogue charges, for comparison with what was paid. */
  readonly chargedPerM2Grosze: number;
  readonly boardsHeld: number;
  /**
   * Boards' worth still uncut, WAREHOUSE-01. Fractional on purpose.
   *
   * `boardsHeld` counts what was bought; this is what is left after every
   * order that has gone into production. It is fractional because
   * consumption is measured by area - a board with two coasters cut from it
   * is not a used board, and rounding it to one would be the 240x error the
   * area rule exists to avoid.
   */
  readonly boardsRemaining: number;
  /** Purchase value of everything still on the shelf. */
  readonly stockValueGrosze: number;
  /**
   * Weighted by area, so a big cheap sheet does not count the same as a small
   * expensive one. `null` when nothing is held: an average of no boards is
   * not zero, it is unknown, and showing zero would read as "free".
   */
  readonly averageCostPerM2Grosze: number | null;
  /** Catalogue rate against real cost, in basis points. `null` when unknown. */
  readonly marginBp: number | null;
};

function toBatch(row: {
  id: string;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  quantity: number;
  purchasePriceGrosze: number;
  supplierNamePl: string | null;
  supplierUrl: string | null;
  notePl: string | null;
  purchasedAt: Date;
}): StockBatch {
  return {
    id: row.id,
    widthMm: row.widthMm,
    heightMm: row.heightMm,
    thicknessMm: row.thicknessMm,
    quantity: row.quantity,
    purchasePriceGrosze: row.purchasePriceGrosze,
    costPerM2Grosze: boardCostPerM2Grosze(row),
    supplierNamePl: row.supplierNamePl,
    supplierUrl: row.supplierUrl,
    notePl: row.notePl,
    purchasedAt: row.purchasedAt,
  };
}

/** Every material, with what is held of it. Materials with no stock are included. */
export async function listMaterialStockSummaries(): Promise<readonly MaterialStockSummary[]> {
  const materials = await prisma.material.findMany({
    select: {
      id: true,
      slug: true,
      namePl: true,
      imageUrl: true,
      isAvailable: true,
      pricePerM2Grosze: true,
      stock: {
        select: {
          widthMm: true,
          heightMm: true,
          thicknessMm: true,
          quantity: true,
          purchasePriceGrosze: true,
          consumedAreaMm2: true,
        },
      },
    },
    orderBy: [{ sortOrder: 'asc' }, { namePl: 'asc' }],
  });

  return materials.map((material) => {
    const boardsHeld = material.stock.reduce((sum, batch) => sum + batch.quantity, 0);
    const stockValueGrosze = material.stock.reduce(
      (sum, batch) => sum + batch.quantity * batch.purchasePriceGrosze,
      0,
    );
    // Area-weighted: total spent divided by total square metres held. A plain
    // mean of the per-batch rates would let one offcut outvote a pallet.
    const heldAreaMm2 = material.stock.reduce(
      (sum, batch) => sum + batch.quantity * batch.widthMm * batch.heightMm,
      0,
    );
    const averageCostPerM2Grosze =
      heldAreaMm2 > 0 ? Math.round((stockValueGrosze * 1_000_000) / heldAreaMm2) : null;

    /*
      WAREHOUSE-01. Summed per batch rather than as one subtraction across the
      material, because a batch that has been over-consumed must not lend its
      negative remainder to a batch that has not - the same flooring
      `remainingAreaMm2` does, and reachable the same way: the +/- control
      adjusts a board count that may already have been drawn from.

      `stockValueGrosze` and `averageCostPerM2Grosze` above are deliberately
      left measuring what was *bought*. They answer "what did we pay and what
      does this material cost us", which does not change when a board is cut.
    */
    const remainingAreaMm2 = material.stock.reduce(
      (sum, batch) => sum + Math.max(0, batch.quantity * batch.widthMm * batch.heightMm - batch.consumedAreaMm2),
      0,
    );
    const boardsRemaining = heldAreaMm2 > 0 ? (remainingAreaMm2 / heldAreaMm2) * boardsHeld : 0;

    return {
      materialId: material.id,
      materialSlug: material.slug,
      materialNamePl: material.namePl,
      materialImageUrl: material.imageUrl,
      isAvailable: material.isAvailable,
      chargedPerM2Grosze: material.pricePerM2Grosze,
      boardsHeld,
      boardsRemaining,
      stockValueGrosze,
      averageCostPerM2Grosze,
      marginBp:
        averageCostPerM2Grosze === null
          ? null
          : stockMarginBp({
              chargedPerM2Grosze: material.pricePerM2Grosze,
              costPerM2Grosze: averageCostPerM2Grosze,
            }),
    };
  });
}

export type MaterialStockDetail = {
  readonly materialId: string;
  readonly materialNamePl: string;
  readonly chargedPerM2Grosze: number;
  readonly batches: readonly StockBatch[];
};

export async function findMaterialStock(materialId: string): Promise<MaterialStockDetail | null> {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      namePl: true,
      pricePerM2Grosze: true,
      stock: {
        select: {
          id: true,
          widthMm: true,
          heightMm: true,
          thicknessMm: true,
          quantity: true,
          purchasePriceGrosze: true,
          supplierNamePl: true,
          supplierUrl: true,
          notePl: true,
          purchasedAt: true,
        },
        orderBy: { purchasedAt: 'desc' },
      },
    },
  });
  if (material === null) {
    return null;
  }

  return {
    materialId: material.id,
    materialNamePl: material.namePl,
    chargedPerM2Grosze: material.pricePerM2Grosze,
    batches: material.stock.map(toBatch),
  };
}

export async function findStockBatch(batchId: string): Promise<(StockBatch & { readonly materialId: string }) | null> {
  const row = await prisma.materialStock.findUnique({ where: { id: batchId } });
  return row === null ? null : { ...toBatch(row), materialId: row.materialId };
}
