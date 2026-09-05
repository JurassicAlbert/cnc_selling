/**
 * Re-run §13.1's upload checks once the target size is actually known -
 * `docs/AI-CHECKLIST.md` BUG-11.
 *
 * The DPI and aspect-mismatch rules in `domain/upload/inspect.ts` are real,
 * unit-tested, and were unreachable: both callers of `inspectUploadedFile`
 * pass `target: null`, and with no target the inspector returns `[]`
 * unconditionally. Every custom design was therefore stored with an empty
 * warning list, and the review screen told staff „Brak ostrzeżeń." about a
 * check that had never run - a false reassurance on the screen where somebody
 * decides whether to cut it.
 *
 * **`target: null` at upload is correct and stays.** `actions/upload.ts`'s
 * header worked this out already: `CUSTOM_UPLOAD` comes before `SIZE` in the
 * only product type that has the step, so at upload there genuinely is no
 * target to compare against. Inventing one would be worse than checking
 * nothing.
 *
 * Add-to-cart is the first moment both halves exist together - `selections`
 * carries `customUploadId`, `widthMm` and `heightMm` - so that is where this
 * runs.
 *
 * **Never throws.** It is called from the add-to-cart path, and a design whose
 * file has gone missing, or an id that does not resolve, must not take a
 * legitimate add-to-cart down with it. It also does not write `[]` in those
 * cases: an empty list means "checked, and clean", and turning a missing file
 * into a clean bill of health would be this same bug one layer down.
 */

import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import { logger } from '@/server/logging/logger';
import { storage } from '@/server/storage/local-disk';
import { inspectUploadedFile } from '@/server/upload/inspect-file';

export type DesignTarget = {
  readonly widthMm: number;
  readonly heightMm: number;
};

export async function reinspectDesignAgainstTarget(
  customDesignId: string,
  target: DesignTarget,
): Promise<void> {
  try {
    const design = await prisma.customerDesign.findUnique({
      where: { id: customDesignId },
      select: { id: true, file: { select: { storageKey: true } } },
    });
    if (design === null) {
      return;
    }

    const bytes = await storage.get(design.file.storageKey);
    if (bytes === null) {
      logger.error('design.reinspect_file_missing', { customDesignId });
      return;
    }

    const inspected = await inspectUploadedFile({ bytes, target });
    if (!inspected.ok) {
      // The file passed inspection when it was uploaded, so a refusal here is
      // about the file having changed underneath us, not about this target.
      // Recording it as "no warnings" would be a lie in the other direction.
      logger.error('design.reinspect_rejected', { customDesignId, code: inspected.code });
      return;
    }

    await prisma.customerDesign.update({
      where: { id: customDesignId },
      data: { autoWarnings: inspected.warnings as unknown as Prisma.InputJsonValue },
    });
  } catch (error) {
    logger.error('design.reinspect_failed', { customDesignId, error });
  }
}
