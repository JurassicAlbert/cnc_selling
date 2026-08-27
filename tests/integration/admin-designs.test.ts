import { afterEach, describe, expect, it } from 'vitest';

import {
  applyCreateCollection,
  applyCreateDesign,
  applySetCollectionActive,
  applySetCollectionSortOrder,
  applySetDesignActive,
  applySetDesignSortOrder,
  applyUpdateCollection,
} from '@/server/actions/admin-designs';
import { applyAddDesignMaterial } from '@/server/actions/admin-design-materials';
import { listDesignOptionsForAdmin } from '@/server/repositories/admin-products';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-designs-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

function testJpegBytes(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, ...Array(64).fill(0), 0xff, 0xd9]);
}

function testFile(name: string): File {
  return new File([new Uint8Array(testJpegBytes())], name, { type: 'image/jpeg' });
}

function designFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    slug: uid(),
    code: uid(),
    namePl: 'Testowy wzór',
    tags: 'test, e2e',
    referenceWidthMm: '300',
    minLineWidthUm: '1000',
    minDetailSpacingUm: '1000',
    recommendedMethod: 'CNC_ENGRAVE',
    minRecommendedWidthMm: '100',
    detailLevel: '3',
    machiningMilliMinutesPerM2: '2500',
    sortOrder: '0',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  if (!('skipThumbnail' in overrides)) {
    formData.set('thumbnailFile', testFile('thumb.jpg'));
  }
  if (!('skipPreview' in overrides)) {
    formData.set('previewFile', testFile('preview.jpg'));
  }
  return formData;
}

afterEach(async () => {
  await prisma.designMaterial.deleteMany({ where: { design: { slug: { startsWith: PREFIX } } } });
  await prisma.productDesign.deleteMany({ where: { design: { slug: { startsWith: PREFIX } } } });
  await prisma.design.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.designCollection.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.material.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('applyCreateCollection / applyUpdateCollection / applySetCollectionActive', () => {
  it('creates, updates, and deactivates a collection, each audited', async () => {
    const staff = staffActor();
    const slug = uid();

    const created = await applyCreateCollection(staff, { slug, namePl: 'Testowa kolekcja', descPl: 'Opis', sortOrder: 0 });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');

    const updated = await applyUpdateCollection(staff, created.id, { slug, namePl: 'Zmieniona nazwa', descPl: 'Opis', sortOrder: 0 });
    expect(updated.ok).toBe(true);
    expect((await prisma.designCollection.findUniqueOrThrow({ where: { id: created.id } })).namePl).toBe('Zmieniona nazwa');

    await applySetCollectionActive(staff, created.id, false);
    const deactivated = await prisma.designCollection.findUniqueOrThrow({ where: { id: created.id } });
    expect(deactivated.isActive).toBe(false);

    expect(await prisma.auditLog.count({ where: { entity: 'DesignCollection', actorEmail: staff.email } })).toBe(3);
  });
});

describe('applySetCollectionSortOrder', () => {
  it('updates sortOrder and audits the change', async () => {
    const staff = staffActor();
    const created = await applyCreateCollection(staff, { slug: uid(), namePl: 'Testowa kolekcja', descPl: 'Opis', sortOrder: 0 });
    if (!created.ok) throw new Error('setup failed');

    await applySetCollectionSortOrder(staff, created.id, 8);

    const collection = await prisma.designCollection.findUniqueOrThrow({ where: { id: created.id } });
    expect(collection.sortOrder).toBe(8);
    expect(await prisma.auditLog.count({ where: { entity: 'DesignCollection', entityId: created.id, action: 'update', actorEmail: staff.email } })).toBeGreaterThanOrEqual(1);
  });

  it('rejects a negative or non-integer value and leaves sortOrder unchanged', async () => {
    const staff = staffActor();
    const created = await applyCreateCollection(staff, { slug: uid(), namePl: 'Testowa kolekcja', descPl: 'Opis', sortOrder: 2 });
    if (!created.ok) throw new Error('setup failed');

    await applySetCollectionSortOrder(staff, created.id, -1);
    await applySetCollectionSortOrder(staff, created.id, 1.5);

    const collection = await prisma.designCollection.findUniqueOrThrow({ where: { id: created.id } });
    expect(collection.sortOrder).toBe(2);
  });
});

describe('applyCreateDesign', () => {
  it('creates a design with two real uploaded images and audits it', async () => {
    const staff = staffActor();
    const formData = designFormData();
    const slug = String(formData.get('slug'));

    const result = await applyCreateDesign(staff, formData);
    expect(result.ok).toBe(true);

    const design = await prisma.design.findUnique({ where: { slug } });
    expect(design?.thumbnailUrl).toMatch(/^\/images\/designs\//);
    expect(design?.previewUrl).toMatch(/^\/images\/designs\//);
    expect(design?.thumbnailUrl).not.toBe(design?.previewUrl);
    expect(await prisma.auditLog.count({ where: { entity: 'Design', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('rights status defaults to REQUIRES_PERMISSION when not explicitly overridden — §12, never silently sellable', async () => {
    const staff = staffActor();
    const formData = designFormData();
    const slug = String(formData.get('slug'));

    await applyCreateDesign(staff, formData);

    const design = await prisma.design.findUniqueOrThrow({ where: { slug } });
    expect(design.rightsStatus).toBe('REQUIRES_PERMISSION');
  });

  it('rejects a missing thumbnail', async () => {
    const result = await applyCreateDesign(staffActor(), designFormData({ skipThumbnail: 'true' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a missing preview image', async () => {
    const result = await applyCreateDesign(staffActor(), designFormData({ skipPreview: 'true' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a duplicate code', async () => {
    const staff = staffActor();
    const code = uid();
    await applyCreateDesign(staff, designFormData({ code }));

    const result = await applyCreateDesign(staff, designFormData({ code }));
    expect(result.ok).toBe(false);
  });
});

describe('applySetDesignActive', () => {
  it('deactivating removes it from the real design-picker query without deleting the row', async () => {
    const staff = staffActor();
    const created = await applyCreateDesign(staff, designFormData());
    if (!created.ok) throw new Error('setup failed');

    expect((await listDesignOptionsForAdmin()).some((d) => d.id === created.id)).toBe(true);

    await applySetDesignActive(staff, created.id, false);

    expect((await listDesignOptionsForAdmin()).some((d) => d.id === created.id)).toBe(false);
    expect(await prisma.design.findUnique({ where: { id: created.id } })).not.toBeNull();
  });
});

describe('applySetDesignSortOrder', () => {
  it('updates sortOrder and audits the change', async () => {
    const staff = staffActor();
    const created = await applyCreateDesign(staff, designFormData({ sortOrder: '0' }));
    if (!created.ok) throw new Error('setup failed');

    await applySetDesignSortOrder(staff, created.id, 10);

    const design = await prisma.design.findUniqueOrThrow({ where: { id: created.id } });
    expect(design.sortOrder).toBe(10);
    expect(await prisma.auditLog.count({ where: { entity: 'Design', entityId: created.id, action: 'update', actorEmail: staff.email } })).toBeGreaterThanOrEqual(1);
  });

  it('rejects a negative or non-integer value and leaves sortOrder unchanged', async () => {
    const staff = staffActor();
    const created = await applyCreateDesign(staff, designFormData({ sortOrder: '3' }));
    if (!created.ok) throw new Error('setup failed');

    await applySetDesignSortOrder(staff, created.id, -1);
    await applySetDesignSortOrder(staff, created.id, 1.5);

    const design = await prisma.design.findUniqueOrThrow({ where: { id: created.id } });
    expect(design.sortOrder).toBe(3);
  });
});

describe('applyAddDesignMaterial (nested editor)', () => {
  it('links a material to a design', async () => {
    const staff = staffActor();
    const design = await applyCreateDesign(staff, designFormData());
    if (!design.ok) throw new Error('setup failed');
    const material = await prisma.material.create({
      data: {
        slug: uid(),
        namePl: 'Testowy materiał',
        family: 'SOLID_WOOD',
        shortDescPl: 'Test',
        characteristicsPl: 'Test',
        imageUrl: '/images/photos/material-dab.jpg',
        pricePerM2Grosze: 10_000,
        maxSheetWidthMm: 1000,
        maxSheetHeightMm: 1000,
        minLineWidthUm: 1000,
        minDetailSpacingUm: 1000,
        minTextHeightUm: 6000,
      },
    });

    const result = await applyAddDesignMaterial(staff, design.id, material.id);
    expect(result.ok).toBe(true);

    const link = await prisma.designMaterial.findUnique({ where: { designId_materialId: { designId: design.id, materialId: material.id } } });
    expect(link).not.toBeNull();

    await prisma.material.delete({ where: { id: material.id } });
  });
});
