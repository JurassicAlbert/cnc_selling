/**
 * `docs/AI-CHECKLIST.md` BUG-11 - §13.1's DPI and aspect-mismatch warnings
 * could never fire.
 *
 * Both call sites pass `target: null` to `inspectUploadedFile`, and with no
 * target the inspector returns `[]` unconditionally. So every custom design
 * was stored with an empty warning list and the review screen told staff
 * „Brak ostrzeżeń." - "no warnings" - about a check that had never run. A
 * reviewer reads that as "the resolution is fine", which is the worst
 * possible way to be wrong: it is not a missing feature, it is a false
 * reassurance on the screen where somebody decides whether to cut it.
 *
 * **`target: null` at upload is correct and stays.** `upload.ts`'s header
 * already worked this out: `CUSTOM_UPLOAD` comes before `SIZE` in the only
 * product type that has the step, so at the moment of upload there genuinely
 * is no target size to compare against. Inventing one would be worse than
 * checking nothing.
 *
 * The fix is the one the item itself proposes, in two halves:
 *
 * 1. **Say "not yet assessed" rather than "no warnings".** `autoWarnings` is
 *    a nullable column, so the two states already have somewhere to live:
 *    `null` for never checked, `[]` for checked and clean. They were being
 *    collapsed into `[]` on write and `?? []` on read.
 * 2. **Re-inspect at add-to-cart**, which is the first moment the target size
 *    is known - `selections` carries `customUploadId`, `widthMm` and
 *    `heightMm` together.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { storage } from '@/server/storage/local-disk';
import { reinspectDesignAgainstTarget } from '@/server/upload/reinspect-design';

const PREFIX = 'test-bug11-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

afterEach(async () => {
  await prisma.customerDesign.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.uploadedFile.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
});

/**
 * A real photo from the repository, so the inspector reads real pixels:
 * `gres.jpg` is 1200x1800, a 2:3 portrait. Targets below are chosen against
 * those numbers rather than guessed - the first draft used a square target
 * for the "clean" case and got a perfectly correct ASPECT_MISMATCH back.
 */
async function seedDesign(): Promise<{ designId: string; widthPx: number }> {
  const sessionToken = uid();
  const bytes = await readFile(path.resolve(process.cwd(), 'public/images/photos/gres.jpg'));
  const storageKey = `${PREFIX}${crypto.randomUUID()}`;
  await storage.put(storageKey, bytes);

  const file = await prisma.uploadedFile.create({
    data: {
      sessionToken,
      kind: 'CUSTOMER_DESIGN',
      storageKey,
      originalName: 'gres.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: bytes.length,
      checksumSha256: 'a'.repeat(64),
    },
  });

  const design = await prisma.customerDesign.create({
    data: { fileId: file.id, sessionToken, status: 'PENDING_REVIEW' },
  });

  return { designId: design.id, widthPx: 0 };
}

async function warningsOf(designId: string): Promise<unknown> {
  const row = await prisma.customerDesign.findUniqueOrThrow({
    where: { id: designId },
    select: { autoWarnings: true },
  });
  return row.autoWarnings;
}

describe('reinspectDesignAgainstTarget', () => {
  it('records a real warning when the target is far larger than the image', async () => {
    // 2000x3000 mm keeps the image's own 2:3 ratio, so the only thing wrong
    // is the resolution: 1200 px across 2 metres is 15 DPI, far under
    // §13.1.6's threshold. Matching the ratio deliberately, so this asserts
    // the resolution rule rather than accidentally passing on an aspect
    // warning.
    const { designId } = await seedDesign();

    await reinspectDesignAgainstTarget(designId, { widthMm: 2_000, heightMm: 3_000 });

    const warnings = await warningsOf(designId);
    expect(Array.isArray(warnings)).toBe(true);
    expect(JSON.stringify(warnings)).toMatch(/LOW_RESOLUTION/);
  });

  it('records an empty list - not null - when the image is comfortably big enough', async () => {
    // The distinction the whole fix turns on: `[]` means checked and clean,
    // and only that may be shown to staff as „Brak ostrzeżeń."
    const { designId } = await seedDesign();

    // 100x150 mm: the image's own ratio, and 1200 px across 100 mm is about
    // 305 DPI - comfortably above both thresholds.
    await reinspectDesignAgainstTarget(designId, { widthMm: 100, heightMm: 150 });

    expect(await warningsOf(designId)).toEqual([]);
  });

  it('leaves the design untouched when the file is gone rather than claiming it is clean', async () => {
    // Storage can lose a key. Writing `[]` here would turn a missing file
    // into a clean bill of health, which is exactly the failure this item is
    // about - one layer further down.
    const { designId } = await seedDesign();
    const design = await prisma.customerDesign.findUniqueOrThrow({
      where: { id: designId },
      select: { file: { select: { storageKey: true } } },
    });
    await storage.delete(design.file.storageKey);

    await reinspectDesignAgainstTarget(designId, { widthMm: 2_000, heightMm: 3_000 });

    expect(await warningsOf(designId)).toBeNull();
  });

  it('does nothing for a design that does not exist', async () => {
    // Called from add-to-cart with whatever id the selections carry, which is
    // validated for ownership elsewhere. It must not throw and take a
    // legitimate add-to-cart down with it.
    await expect(
      reinspectDesignAgainstTarget(`${PREFIX}missing`, { widthMm: 500, heightMm: 500 }),
    ).resolves.toBeUndefined();
  });
});

describe('a freshly uploaded design', () => {
  it('has no warning list at all, because nothing has been assessed yet', async () => {
    // `null`, not `[]`. At upload there is no target size - CUSTOM_UPLOAD
    // comes before SIZE - so the honest record is "not assessed", and the
    // review screen says so instead of „Brak ostrzeżeń."
    const { designId } = await seedDesign();
    expect(await warningsOf(designId)).toBeNull();
  });
});
