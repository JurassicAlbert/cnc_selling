import { afterEach, describe, expect, it } from 'vitest';

import { applyCreateMaterial, applySetMaterialAvailable, applySetMaterialSortOrder, applyUpdateMaterial } from '@/server/actions/admin-materials';
import { applyAddMaterialFinish } from '@/server/actions/admin-material-finishes';
import { listMaterialOptionsForAdmin } from '@/server/repositories/admin-products';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-materials-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

function testJpegBytes(): Buffer {
  // Smallest real JPEG magic-byte header `file-type` will actually sniff as image/jpeg (SOI + APP0 marker), padded — content doesn't matter, only the header.
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, ...Array(64).fill(0), 0xff, 0xd9]);
}

function materialFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    slug: uid(),
    namePl: 'Testowy materiał',
    family: 'SOLID_WOOD',
    shortDescPl: 'Krótki opis',
    characteristicsPl: 'Charakterystyka',
    pricePerM2Pln: '150',
    maxSheetWidthMm: '1000',
    maxSheetHeightMm: '1000',
    minLineWidthUm: '1000',
    minDetailSpacingUm: '1000',
    minTextHeightUm: '6000',
    grainDirection: 'NONE',
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
  await prisma.materialFinish.deleteMany({ where: { material: { slug: { startsWith: PREFIX } } } });
  await prisma.material.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.finish.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('applyCreateMaterial', () => {
  it('creates a material with a real uploaded image and audits it', async () => {
    const staff = staffActor();
    const formData = materialFormData();
    const slug = formData.get('slug');

    const result = await applyCreateMaterial(staff, formData);
    expect(result.ok).toBe(true);

    const material = await prisma.material.findUnique({ where: { slug: String(slug) } });
    expect(material?.namePl).toBe('Testowy materiał');
    expect(material?.imageUrl).toMatch(/^\/images\/materials\//);
    expect(await prisma.auditLog.count({ where: { entity: 'Material', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('rejects a missing image', async () => {
    const result = await applyCreateMaterial(staffActor(), materialFormData({ skipFile: 'true' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a duplicate slug', async () => {
    const staff = staffActor();
    const formData = materialFormData();
    const slug = String(formData.get('slug'));
    await applyCreateMaterial(staff, formData);

    const result = await applyCreateMaterial(staff, materialFormData({ slug }));
    expect(result.ok).toBe(false);
  });
});

describe('applyUpdateMaterial', () => {
  it('updates fields without requiring a new image', async () => {
    const staff = staffActor();
    const created = await applyCreateMaterial(staff, materialFormData());
    if (!created.ok) throw new Error('setup failed');
    const before = await prisma.material.findUniqueOrThrow({ where: { id: created.id } });

    const updateForm = materialFormData({ slug: before.slug, namePl: 'Zmieniona nazwa', skipFile: 'true' });
    const result = await applyUpdateMaterial(staff, created.id, updateForm);
    expect(result.ok).toBe(true);

    const after = await prisma.material.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.namePl).toBe('Zmieniona nazwa');
    expect(after.imageUrl).toBe(before.imageUrl);
  });
});

describe('applySetMaterialAvailable', () => {
  it('marking unavailable removes it from the real material-picker query without deleting the row', async () => {
    const staff = staffActor();
    const created = await applyCreateMaterial(staff, materialFormData());
    if (!created.ok) throw new Error('setup failed');

    expect((await listMaterialOptionsForAdmin()).some((m) => m.id === created.id)).toBe(true);

    await applySetMaterialAvailable(staff, created.id, false);

    expect((await listMaterialOptionsForAdmin()).some((m) => m.id === created.id)).toBe(false);
    expect(await prisma.material.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});

describe('applySetMaterialSortOrder', () => {
  it('updates sortOrder and audits the change', async () => {
    const staff = staffActor();
    const created = await applyCreateMaterial(staff, materialFormData({ sortOrder: '0' }));
    if (!created.ok) throw new Error('setup failed');

    await applySetMaterialSortOrder(staff, created.id, 9);

    const material = await prisma.material.findUniqueOrThrow({ where: { id: created.id } });
    expect(material.sortOrder).toBe(9);
    expect(await prisma.auditLog.count({ where: { entity: 'Material', entityId: created.id, action: 'update', actorEmail: staff.email } })).toBeGreaterThanOrEqual(1);
  });

  it('rejects a negative or non-integer value and leaves sortOrder unchanged', async () => {
    const staff = staffActor();
    const created = await applyCreateMaterial(staff, materialFormData({ sortOrder: '2' }));
    if (!created.ok) throw new Error('setup failed');

    await applySetMaterialSortOrder(staff, created.id, -1);
    await applySetMaterialSortOrder(staff, created.id, 1.5);

    const material = await prisma.material.findUniqueOrThrow({ where: { id: created.id } });
    expect(material.sortOrder).toBe(2);
  });
});

describe('applyAddMaterialFinish (nested editor)', () => {
  it('links a finish to a material and audits it', async () => {
    const staff = staffActor();
    const material = await applyCreateMaterial(staff, materialFormData());
    if (!material.ok) throw new Error('setup failed');
    const finish = await prisma.finish.create({
      data: {
        slug: uid(),
        namePl: 'Testowe wykończenie',
        kind: 'OIL',
        descPl: 'Opis',
        imageUrl: '/images/photos/material-dab.jpg',
        pricePerM2Grosze: 5000,
      },
    });

    const result = await applyAddMaterialFinish(staff, material.id, finish.id);
    expect(result.ok).toBe(true);

    const link = await prisma.materialFinish.findUnique({ where: { materialId_finishId: { materialId: material.id, finishId: finish.id } } });
    expect(link).not.toBeNull();
  });
});
