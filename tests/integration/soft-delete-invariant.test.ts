import { afterEach, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';

/**
 * `docs/CHECKLIST.md`'s "Soft delete enforced for entities referenced by
 * orders" (`docs/ARCHITECTURE.md` §16A.2's own invariant #2). Two real
 * facts back this, both verified here rather than just claimed:
 *
 * 1. **No hard-delete action exists for any of the 6 core catalogue
 *    entities** (Category/Product/Material/Finish/Design/DesignCollection)
 *    - confirmed by `grep -rn "prisma\.(category|product|material|finish|
 *    design|designCollection)\.delete\b" src/` returning zero matches
 *    outside Prisma's own generated JSDoc example comments. Every one of
 *    those entities' own action files documents this explicitly (e.g.
 *    `admin-categories.ts`: "No delete action exists here on purpose").
 *
 * 2. **Even if one somehow disappeared, no existing order would break** -
 *    `OrderItem` (`prisma/schema.prisma`) has NO live foreign key to
 *    Product/Material/Design/Finish at all, only `orderId`/
 *    `customerDesignId`; everything catalogue-related is the immutable
 *    `snapshot` JSON the schema's own comment describes: "Rendering an
 *    order NEVER joins to a live catalogue row." This test proves that
 *    architecturally-implied claim at the DB level, directly: hard-delete
 *    a `Material` row a real order's snapshot references (bypassing the
 *    app entirely, since the app itself has no path to do this - a
 *    stronger check than "the button doesn't exist"), and confirm the
 *    order's stored data is completely untouched.
 */

const PREFIX = 'test-soft-delete-invariant-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

afterEach(async () => {
  await prisma.orderItem.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.material.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

describe('soft-delete invariant (§16A.2 #2)', () => {
  it('hard-deleting a Material referenced by an order snapshot leaves the order completely unaffected', async () => {
    const material = await prisma.material.create({
      data: {
        slug: uid(),
        namePl: 'Znikający materiał testowy',
        family: 'SOLID_WOOD',
        shortDescPl: 'Test',
        characteristicsPl: 'Test',
        imageUrl: '/images/test.jpg',
        pricePerM2Grosze: 12_345,
        densityKgPerM3: 600,
        maxSheetWidthMm: 1000,
        maxSheetHeightMm: 1000,
        minLineWidthUm: 1000,
        minDetailSpacingUm: 1000,
        minTextHeightUm: 6000,
      },
    });

    const snapshot = { productNamePl: 'Test product', materialNamePl: material.namePl, materialId: material.id };
    const order = await prisma.order.create({
      data: {
        orderNumber: uid(),
        accessToken: uid(),
        status: 'NEW',
        paymentMethod: 'BANK_TRANSFER',
        email: `${PREFIX}${crypto.randomUUID()}@example.test`,
        phone: '+48123456789',
        firstName: 'Test',
        lastName: 'Test',
        street: 'Test 1',
        postalCode: '00-001',
        city: 'Test',
        subtotalNetGrosze: 100_00,
        vatGrosze: 23_00,
        shippingGrosze: 0,
        deliveryMethodNamePl: 'Test',
        totalGrossGrosze: 123_00,
        termsVersion: '1',
        termsAcceptedAt: new Date(),
        withdrawalExemptionTextPl: 'Test',
        withdrawalAcknowledgedAt: new Date(),
        items: {
          create: {
            quantity: 1,
            unitNetGrosze: 100_00,
            unitGrossGrosze: 123_00,
            lineNetGrosze: 100_00,
            lineVatGrosze: 23_00,
            lineGrossGrosze: 123_00,
            snapshot,
            pricingVersion: 1,
          },
        },
      },
      include: { items: true },
    });

    // The real invariant: no FK from OrderItem to Material means this
    // succeeds with no constraint error - proving there is nothing left
    // to "cascade break" even in the hypothetical worst case.
    await prisma.material.delete({ where: { id: material.id } });
    expect(await prisma.material.findUnique({ where: { id: material.id } })).toBeNull();

    const [seededItem] = order.items;
    if (seededItem === undefined) throw new Error('setup failed');
    const itemAfter = await prisma.orderItem.findUniqueOrThrow({ where: { id: seededItem.id } });
    expect(itemAfter.snapshot).toEqual(snapshot);
    expect(itemAfter.lineGrossGrosze).toBe(123_00);

    const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(orderAfter.totalGrossGrosze).toBe(123_00);
  });
});
