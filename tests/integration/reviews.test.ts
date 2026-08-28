import { afterEach, describe, expect, it } from 'vitest';

import { applySubmitAccountReview, submitGuestReview } from '@/server/actions/reviews';
import { applySetReviewStatus } from '@/server/actions/admin-reviews';
import { listApprovedReviews } from '@/server/repositories/reviews';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';
import type { OrderStatus } from '@/generated/prisma/enums';

const PREFIX = 'test-reviews-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

async function seedOrder(status: OrderStatus, userId: string | null = null) {
  const accessToken = uid();
  return prisma.order.create({
    data: {
      orderNumber: uid(),
      accessToken,
      status,
      userId,
      paymentMethod: 'BANK_TRANSFER',
      email: `${PREFIX}${crypto.randomUUID()}@example.test`,
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
}

function reviewFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = { authorNamePl: 'Jan K.', rating: '5', bodyPl: 'Świetna realizacja.', ...overrides };
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

afterEach(async () => {
  await prisma.review.deleteMany({ where: { order: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('submitGuestReview', () => {
  it('rejects an order that is not COMPLETED', async () => {
    const order = await seedOrder('CONFIRMED');
    const result = await submitGuestReview(order.orderNumber, order.accessToken, reviewFormData());
    expect(result.ok).toBe(false);
    expect(await prisma.review.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('rejects a wrong access token', async () => {
    const order = await seedOrder('COMPLETED');
    const result = await submitGuestReview(order.orderNumber, 'wrong-token', reviewFormData());
    expect(result.ok).toBe(false);
  });

  it('accepts a genuine first submission on a COMPLETED order, landing PENDING', async () => {
    const order = await seedOrder('COMPLETED');
    const result = await submitGuestReview(order.orderNumber, order.accessToken, reviewFormData());
    expect(result.ok).toBe(true);

    const review = await prisma.review.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(review.status).toBe('PENDING');
    expect(review.authorNamePl).toBe('Jan K.');
    expect(review.rating).toBe(5);
  });

  it('rejects a second submission on an already-reviewed order', async () => {
    const order = await seedOrder('COMPLETED');
    await submitGuestReview(order.orderNumber, order.accessToken, reviewFormData());

    const second = await submitGuestReview(order.orderNumber, order.accessToken, reviewFormData({ bodyPl: 'Druga próba.' }));
    expect(second.ok).toBe(false);
    expect(await prisma.review.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('rejects an out-of-range rating', async () => {
    const order = await seedOrder('COMPLETED');
    const result = await submitGuestReview(order.orderNumber, order.accessToken, reviewFormData({ rating: '7' }));
    expect(result.ok).toBe(false);
  });
});

describe('applySubmitAccountReview', () => {
  it('rejects submission for an order the given user does not own', async () => {
    const owner = await prisma.user.create({ data: { email: `${PREFIX}${crypto.randomUUID()}@example.test`, name: 'Owner', role: 'CUSTOMER' } });
    const stranger = await prisma.user.create({ data: { email: `${PREFIX}${crypto.randomUUID()}@example.test`, name: 'Stranger', role: 'CUSTOMER' } });
    const order = await seedOrder('COMPLETED', owner.id);

    const result = await applySubmitAccountReview(stranger.id, order.orderNumber, reviewFormData());
    expect(result.ok).toBe(false);
    expect(await prisma.review.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('accepts a genuine submission from the real owner on a COMPLETED order', async () => {
    const owner = await prisma.user.create({ data: { email: `${PREFIX}${crypto.randomUUID()}@example.test`, name: 'Owner', role: 'CUSTOMER' } });
    const order = await seedOrder('COMPLETED', owner.id);

    const result = await applySubmitAccountReview(owner.id, order.orderNumber, reviewFormData());
    expect(result.ok).toBe(true);
    expect((await prisma.review.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('PENDING');
  });

  it('rejects an order that is not COMPLETED, even for the real owner', async () => {
    const owner = await prisma.user.create({ data: { email: `${PREFIX}${crypto.randomUUID()}@example.test`, name: 'Owner', role: 'CUSTOMER' } });
    const order = await seedOrder('CONFIRMED', owner.id);

    const result = await applySubmitAccountReview(owner.id, order.orderNumber, reviewFormData());
    expect(result.ok).toBe(false);
  });
});

describe('applySetReviewStatus + listApprovedReviews', () => {
  it('moderation changes status and audits it; only APPROVED reviews are ever publicly listed', async () => {
    const staff = staffActor();
    const order = await seedOrder('COMPLETED');
    await submitGuestReview(order.orderNumber, order.accessToken, reviewFormData({ authorNamePl: uid() }));
    const review = await prisma.review.findUniqueOrThrow({ where: { orderId: order.id } });

    expect((await listApprovedReviews(50)).some((r) => r.authorNamePl === review.authorNamePl)).toBe(false);

    await applySetReviewStatus(staff, review.id, 'APPROVED');

    const approved = await prisma.review.findUniqueOrThrow({ where: { id: review.id } });
    expect(approved.status).toBe('APPROVED');
    expect(approved.moderatedByEmail).toBe(staff.email);
    expect(approved.moderatedAt).not.toBeNull();
    expect((await listApprovedReviews(50)).some((r) => r.authorNamePl === review.authorNamePl)).toBe(true);

    await applySetReviewStatus(staff, review.id, 'REJECTED');
    expect((await listApprovedReviews(50)).some((r) => r.authorNamePl === review.authorNamePl)).toBe(false);

    expect(await prisma.auditLog.count({ where: { entity: 'Review', entityId: review.id } })).toBe(2);
  });
});
