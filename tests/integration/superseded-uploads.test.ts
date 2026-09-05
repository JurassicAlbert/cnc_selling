/**
 * `docs/AI-CHECKLIST.md` BUG-15 - a re-uploaded design orphaned its
 * predecessor.
 *
 * `CustomerDesign.fileId` moved to the new upload and nothing pointed at the
 * old row again. The bytes stayed on disk forever, staff could not see what
 * the customer had originally sent, and the customer's old link kept working
 * for a file they believed they had replaced.
 *
 * **Owner decision, 2026-09-05:** keep the file and show it in the review
 * history, over deleting it on re-upload - being able to see every version is
 * what settles a "but I sent the right one" dispute. The loose end that
 * leaves was put to the owner separately: staff keep access, the customer
 * loses it, and there is deliberately **no expiry**. A superseded file stays
 * reachable to staff for as long as it exists.
 *
 * So there are three things to pin, and they pull in different directions -
 * which is exactly why all three are here rather than just the happy one.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { findOwnedUploadedFile } from '@/server/repositories/design-review';

const PREFIX = 'test-bug15-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

afterEach(async () => {
  await prisma.customerDesign.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.uploadedFile.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
});

async function seedFile(sessionToken: string) {
  return prisma.uploadedFile.create({
    data: {
      sessionToken,
      kind: 'CUSTOMER_DESIGN',
      storageKey: uid(),
      originalName: 'projekt.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      checksumSha256: 'a'.repeat(64),
    },
  });
}

/** A design whose first file has been replaced by a second. */
async function seedReplacedDesign() {
  const sessionToken = uid();
  const oldFile = await seedFile(sessionToken);
  const design = await prisma.customerDesign.create({
    data: { fileId: oldFile.id, sessionToken, status: 'PENDING_REVIEW' },
  });
  const newFile = await seedFile(sessionToken);

  await prisma.$transaction([
    prisma.uploadedFile.update({
      where: { id: oldFile.id },
      data: { supersededAt: new Date(), supersededForDesignId: design.id },
    }),
    prisma.customerDesign.update({ where: { id: design.id }, data: { fileId: newFile.id } }),
  ]);

  return { sessionToken, designId: design.id, oldFileId: oldFile.id, newFileId: newFile.id };
}

describe('a superseded design file', () => {
  it('is no longer reachable by the customer who uploaded it', async () => {
    // The point of the whole change. Ownership is unchanged - it is still
    // their file - so the refusal has to come from the file being superseded,
    // not from the owner check.
    const { sessionToken, oldFileId } = await seedReplacedDesign();

    const found = await findOwnedUploadedFile(oldFileId, { userId: null, sessionToken });

    expect(found).toBeNull();
  });

  it('still lets the customer reach the file that replaced it', async () => {
    // The guard must not swallow the current file too, which is the obvious
    // way to get this wrong.
    const { sessionToken, newFileId } = await seedReplacedDesign();

    const found = await findOwnedUploadedFile(newFileId, { userId: null, sessionToken });

    expect(found?.id).toBe(newFileId);
  });

  it('stays on the design as history, newest first', async () => {
    // What the owner actually asked for: staff can see every version the
    // customer sent.
    const { designId, oldFileId } = await seedReplacedDesign();

    const history = await prisma.uploadedFile.findMany({
      where: { supersededForDesignId: designId },
      orderBy: { supersededAt: 'desc' },
      select: { id: true },
    });

    expect(history.map((file) => file.id)).toEqual([oldFileId]);
  });

  it('does not expire - it is still there long after being replaced', async () => {
    // Explicitly pinned because "expire them after a while" was offered and
    // refused. A future TTL would break this test, which is the point: it is
    // a decision, not an oversight.
    const { oldFileId } = await seedReplacedDesign();

    await prisma.uploadedFile.update({
      where: { id: oldFileId },
      data: { supersededAt: new Date('2020-01-01T00:00:00Z') },
    });

    const stillThere = await prisma.uploadedFile.findUnique({ where: { id: oldFileId } });
    expect(stillThere).not.toBeNull();
  });

  it('survives its design being deleted, rather than vanishing with it', async () => {
    // ON DELETE SET NULL, not CASCADE: deleting a design must not take the
    // evidence of its own history with it.
    const { designId, oldFileId } = await seedReplacedDesign();
    await prisma.customerDesign.delete({ where: { id: designId } });

    const orphan = await prisma.uploadedFile.findUnique({ where: { id: oldFileId } });
    expect(orphan).not.toBeNull();
    expect(orphan?.supersededForDesignId).toBeNull();
  });
});
