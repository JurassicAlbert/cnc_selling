import { afterEach, describe, expect, it } from 'vitest';

import { applyDesignReviewDecision } from '@/server/actions/admin-design-review';
import { applyOrderStatusTransition } from '@/server/actions/admin-orders';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-design-review-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

afterEach(async () => {
  await prisma.designReviewComment.deleteMany({ where: { design: { sessionToken: { startsWith: PREFIX } } } });
  await prisma.orderItem.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.customerDesign.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.uploadedFile.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

async function seedCustomerDesign() {
  const sessionToken = uid();
  const file = await prisma.uploadedFile.create({
    data: {
      sessionToken,
      kind: 'CUSTOMER_DESIGN',
      storageKey: `admin-design-review-test-${crypto.randomUUID()}`,
      originalName: 'test.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      checksumSha256: 'a'.repeat(64),
    },
  });
  return prisma.customerDesign.create({ data: { fileId: file.id, sessionToken, status: 'PENDING_REVIEW' } });
}

describe('applyDesignReviewDecision', () => {
  it('approving sets status + productionMethod, writes the comment, and audits it', async () => {
    const design = await seedCustomerDesign();
    const staff = staffActor();

    const result = await applyDesignReviewDecision(staff, design.id, 'APPROVED', 'CNC_ENGRAVE', 'Wygląda dobrze.');
    expect(result).toEqual({ ok: true });

    const updated = await prisma.customerDesign.findUniqueOrThrow({ where: { id: design.id } });
    expect(updated.status).toBe('APPROVED');
    expect(updated.productionMethod).toBe('CNC_ENGRAVE');

    const comments = await prisma.designReviewComment.findMany({ where: { designId: design.id } });
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ authorType: 'staff', bodyPl: 'Wygląda dobrze.' });

    expect(await prisma.auditLog.count({ where: { entityId: design.id, entity: 'CustomerDesign' } })).toBe(1);
  });

  it('approving without a production method is rejected', async () => {
    const design = await seedCustomerDesign();
    const result = await applyDesignReviewDecision(staffActor(), design.id, 'APPROVED', null, null);
    expect(result.ok).toBe(false);
  });

  it('rejecting or requesting changes needs no production method', async () => {
    const design = await seedCustomerDesign();
    const result = await applyDesignReviewDecision(staffActor(), design.id, 'NEEDS_CHANGES', null, 'Proszę o wyższą rozdzielczość.');
    expect(result.ok).toBe(true);
    expect((await prisma.customerDesign.findUniqueOrThrow({ where: { id: design.id } })).status).toBe('NEEDS_CHANGES');
  });

  it('approving a design unblocks the order it was gating', async () => {
    const design = await seedCustomerDesign();
    const order = await prisma.order.create({
      data: {
        orderNumber: uid(),
        accessToken: uid(),
        status: 'DESIGN_REVIEW',
        paymentMethod: 'BANK_TRANSFER',
        email: `${PREFIX}${crypto.randomUUID()}@example.test`,
        phone: '+48123456789',
        firstName: 'Test',
        lastName: 'Test',
        street: 'Test 1',
        postalCode: '00-001',
        city: 'Test',
        subtotalNetGrosze: 100,
        vatGrosze: 23,
        shippingGrosze: 0,
        deliveryMethodNamePl: 'Test',
        totalGrossGrosze: 123,
        termsVersion: '1',
        termsAcceptedAt: new Date(),
        withdrawalExemptionTextPl: 'Test',
        withdrawalAcknowledgedAt: new Date(),
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        quantity: 1,
        unitNetGrosze: 100,
        unitGrossGrosze: 123,
        lineNetGrosze: 100,
        lineVatGrosze: 23,
        lineGrossGrosze: 123,
        snapshot: {},
        pricingVersion: 1,
        customerDesignId: design.id,
      },
    });

    const stillBlocked = await applyOrderStatusTransition(staffActor(), order.orderNumber, 'CONFIRMED', null);
    expect(stillBlocked.ok).toBe(false);

    await applyDesignReviewDecision(staffActor(), design.id, 'APPROVED', 'LASER_ENGRAVE', null);

    const nowAllowed = await applyOrderStatusTransition(staffActor(), order.orderNumber, 'CONFIRMED', null);
    expect(nowAllowed.ok).toBe(true);
  });
});
