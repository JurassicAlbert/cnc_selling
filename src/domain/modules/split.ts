/**
 * Splitting a product too large for the machine into aligned modules.
 *
 * This is presented to the customer as a feature (transport, installation,
 * replaceable elements), never as a limitation - but the arithmetic has to be
 * exactly right, because the module count drives both the price and the
 * production plan. The off-by-one at `width === usableWidth` is the classic
 * failure: it must produce ONE module, not two.
 *
 * Every module carries its offset in the GLOBAL product coordinate system, so
 * the design is sliced from one continuous artwork and the seams line up.
 */

export type SplitLimits = {
  /** Machine usable width after clamping and tool clearance. */
  readonly usableWidthMm: number;
  readonly usableHeightMm: number;
  /** Smallest module we are willing to produce. Avoids 40 mm slivers. */
  readonly minModuleMm: number;
};

export type ModuleSpec = {
  /** `A1`, `A2`, `B1` ... rows are letters top-to-bottom, columns are numbers. */
  readonly code: string;
  /** 0-based row index, top to bottom. */
  readonly row: number;
  /** 0-based column index, left to right. */
  readonly col: number;
  /** Offset from the product's top-left corner, in the global coordinate system. */
  readonly xMm: number;
  readonly yMm: number;
  readonly widthMm: number;
  readonly heightMm: number;
  /** 1-based row-major order: A1, A2, B1, B2. */
  readonly productionOrder: number;
};

export type ModuleLayout = {
  readonly cols: number;
  readonly rows: number;
  readonly totalModules: number;
  readonly isModular: boolean;
  readonly modules: readonly ModuleSpec[];
};

export type SplitErrorCode =
  | 'INVALID_DIMENSIONS'
  | 'INVALID_LIMITS'
  | 'INFEASIBLE_MODULE_SIZE';

export type SplitResult =
  | { readonly ok: true; readonly layout: ModuleLayout }
  | { readonly ok: false; readonly code: SplitErrorCode; readonly detail: string };

export function splitIntoModules(
  widthMm: number,
  heightMm: number,
  limits: SplitLimits,
): SplitResult {
  if (!isPositiveInteger(widthMm) || !isPositiveInteger(heightMm)) {
    return {
      ok: false,
      code: 'INVALID_DIMENSIONS',
      detail: `dimensions must be positive integers in mm, received ${widthMm} x ${heightMm}`,
    };
  }

  const { usableWidthMm, usableHeightMm, minModuleMm } = limits;

  if (!isPositiveInteger(usableWidthMm) || !isPositiveInteger(usableHeightMm)) {
    return {
      ok: false,
      code: 'INVALID_LIMITS',
      detail: 'machine usable area must be positive integers in mm',
    };
  }
  if (!Number.isInteger(minModuleMm) || minModuleMm < 0) {
    return {
      ok: false,
      code: 'INVALID_LIMITS',
      detail: 'minModuleMm must be a non-negative integer',
    };
  }
  if (minModuleMm > usableWidthMm || minModuleMm > usableHeightMm) {
    return {
      ok: false,
      code: 'INVALID_LIMITS',
      detail:
        'minModuleMm exceeds the machine usable area; no split could ever satisfy both',
    };
  }

  const cols = resolveCount(widthMm, usableWidthMm, minModuleMm);
  const rows = resolveCount(heightMm, usableHeightMm, minModuleMm);

  const colWidths = distribute(widthMm, cols);
  const rowHeights = distribute(heightMm, rows);

  const widestModule = Math.max(...colWidths);
  const tallestModule = Math.max(...rowHeights);

  if (widestModule > usableWidthMm || tallestModule > usableHeightMm) {
    return {
      ok: false,
      code: 'INFEASIBLE_MODULE_SIZE',
      detail: `smallest feasible module ${widestModule} x ${tallestModule} mm exceeds the usable area ${usableWidthMm} x ${usableHeightMm} mm`,
    };
  }

  const modules: ModuleSpec[] = [];
  let productionOrder = 0;
  let yMm = 0;

  rowHeights.forEach((moduleHeight, row) => {
    let xMm = 0;
    colWidths.forEach((moduleWidth, col) => {
      productionOrder += 1;
      modules.push({
        code: `${rowLabel(row)}${col + 1}`,
        row,
        col,
        xMm,
        yMm,
        widthMm: moduleWidth,
        heightMm: moduleHeight,
        productionOrder,
      });
      xMm += moduleWidth;
    });
    yMm += moduleHeight;
  });

  return {
    ok: true,
    layout: {
      cols,
      rows,
      totalModules: cols * rows,
      isModular: cols * rows > 1,
      modules,
    },
  };
}

/**
 * How many parts one axis needs.
 *
 * `Math.ceil(total / usable)` gives the minimum count. It is then reduced while
 * the resulting parts would fall below the minimum module size - better three
 * equal modules than four where one is a sliver. The count never drops below 1,
 * so a product smaller than the minimum module size is simply a single piece.
 */
function resolveCount(totalMm: number, usableMm: number, minModuleMm: number): number {
  let count = Math.ceil(totalMm / usableMm);
  while (count > 1 && Math.floor(totalMm / count) < minModuleMm) {
    count -= 1;
  }
  return count;
}

/**
 * Split a length into `parts` integer millimetre pieces that sum EXACTLY to it.
 *
 * The remainder is spread one millimetre at a time across the leading parts,
 * so the largest and smallest module never differ by more than 1 mm.
 */
export function distribute(totalMm: number, parts: number): number[] {
  const base = Math.floor(totalMm / parts);
  const remainder = totalMm - base * parts;
  const sizes: number[] = [];
  for (let index = 0; index < parts; index += 1) {
    sizes.push(base + (index < remainder ? 1 : 0));
  }
  return sizes;
}

/** 0 -> A, 25 -> Z, 26 -> AA */
export function rowLabel(index: number): string {
  let remaining = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);
  return label;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}
