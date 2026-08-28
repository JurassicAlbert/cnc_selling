import { afterEach, describe, expect, it } from 'vitest';

import {
  applyBulkSetFinishAvailable,
  applyCreateFinish,
  applySetFinishAvailable,
  applySetFinishSortOrder,
  applyUpdateFinish,
} from '@/server/actions/admin-finishes';
import { listFinishOptionsForAdmin } from '@/server/repositories/admin-finishes';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-finishes-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

function testJpegBytes(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, ...Array(64).fill(0), 0xff, 0xd9]);
}

function finishFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    slug: uid(),
    namePl: 'Testowe wykończenie',
    kind: 'OIL',
    descPl: 'Opis',
    pricePerM2Pln: '50',
    setupFeePln: '0',
    extraDaysMin: '0',
    extraDaysMax: '2',
    sortOrder: '0',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  if (!('skipFile' in overrides)) {
    formData.set('file', new File([new Uint8Array(testJpegBytes())], 'test.jpg', { type: 'image/jpeg' }));
  }
  return formData;
}

afterEach(async () => {
  await prisma.finish.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('applyCreateFinish', () => {
  it('creates a finish with a real uploaded image and audits it', async () => {
    const staff = staffActor();
    const formData = finishFormData();
    const slug = String(formData.get('slug'));

    const result = await applyCreateFinish(staff, formData);
    expect(result.ok).toBe(true);

    const finish = await prisma.finish.findUnique({ where: { slug } });
    expect(finish?.namePl).toBe('Testowe wykończenie');
    expect(finish?.imageUrl).toMatch(/^\/images\/finishes\//);
    expect(await prisma.auditLog.count({ where: { entity: 'Finish', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('rejects a missing image', async () => {
    const result = await applyCreateFinish(staffActor(), finishFormData({ skipFile: 'true' }));
    expect(result.ok).toBe(false);
  });

  it('rejects extraDaysMin above extraDaysMax', async () => {
    const result = await applyCreateFinish(staffActor(), finishFormData({ extraDaysMin: '5', extraDaysMax: '2' }));
    expect(result.ok).toBe(false);
  });
});

describe('applyUpdateFinish', () => {
  it('updates fields without requiring a new image', async () => {
    const staff = staffActor();
    const created = await applyCreateFinish(staff, finishFormData());
    if (!created.ok) throw new Error('setup failed');
    const before = await prisma.finish.findUniqueOrThrow({ where: { id: created.id } });

    const result = await applyUpdateFinish(staff, created.id, finishFormData({ slug: before.slug, namePl: 'Zmieniona nazwa', skipFile: 'true' }));
    expect(result.ok).toBe(true);

    const after = await prisma.finish.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.namePl).toBe('Zmieniona nazwa');
    expect(after.imageUrl).toBe(before.imageUrl);
  });
});

describe('applySetFinishAvailable', () => {
  it('marking unavailable removes it from the real finish-picker query without deleting the row', async () => {
    const staff = staffActor();
    const created = await applyCreateFinish(staff, finishFormData());
    if (!created.ok) throw new Error('setup failed');

    expect((await listFinishOptionsForAdmin()).some((f) => f.id === created.id)).toBe(true);

    await applySetFinishAvailable(staff, created.id, false);

    expect((await listFinishOptionsForAdmin()).some((f) => f.id === created.id)).toBe(false);
    expect(await prisma.finish.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});

describe('applyBulkSetFinishAvailable', () => {
  it('marks every id in the batch unavailable and audits each one', async () => {
    const staff = staffActor();
    const first = await applyCreateFinish(staff, finishFormData());
    const second = await applyCreateFinish(staff, finishFormData());
    if (!first.ok || !second.ok) throw new Error('setup failed');

    await applyBulkSetFinishAvailable(staff, [first.id, second.id], false);

    const rows = await prisma.finish.findMany({ where: { id: { in: [first.id, second.id] } } });
    expect(rows.every((f) => f.isAvailable === false)).toBe(true);
    expect(
      await prisma.auditLog.count({
        where: { entity: 'Finish', entityId: { in: [first.id, second.id] }, action: 'update', actorEmail: staff.email },
      }),
    ).toBe(2);
  });
});

describe('applySetFinishSortOrder', () => {
  it('updates sortOrder and audits the change', async () => {
    const staff = staffActor();
    const created = await applyCreateFinish(staff, finishFormData({ sortOrder: '0' }));
    if (!created.ok) throw new Error('setup failed');

    await applySetFinishSortOrder(staff, created.id, 6);

    const finish = await prisma.finish.findUniqueOrThrow({ where: { id: created.id } });
    expect(finish.sortOrder).toBe(6);
    expect(await prisma.auditLog.count({ where: { entity: 'Finish', entityId: created.id, action: 'update', actorEmail: staff.email } })).toBeGreaterThanOrEqual(1);
  });

  it('rejects a negative or non-integer value and leaves sortOrder unchanged', async () => {
    const staff = staffActor();
    const created = await applyCreateFinish(staff, finishFormData({ sortOrder: '1' }));
    if (!created.ok) throw new Error('setup failed');

    await applySetFinishSortOrder(staff, created.id, -1);
    await applySetFinishSortOrder(staff, created.id, 1.5);

    const finish = await prisma.finish.findUniqueOrThrow({ where: { id: created.id } });
    expect(finish.sortOrder).toBe(1);
  });
});
