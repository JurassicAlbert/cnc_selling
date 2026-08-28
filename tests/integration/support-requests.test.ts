import { afterEach, describe, expect, it } from 'vitest';

import { applySubmitOrderSupportRequest, applySubmitSupportRequest } from '@/server/actions/support-requests';
import { prisma } from '@/server/db/client';

/**
 * P9 phase 8. `submitOrderSupportRequest`'s order/shipment context is
 * re-verified server-side (real `accessToken`, constant-time compare) —
 * never trusted from a client-supplied `orderNumber` alone. Covers the
 * two "context fails to verify" cases explicitly: the whole submission
 * must still succeed, just without the link.
 */

const PREFIX = 'test-support-requests-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function validFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const fields: Record<string, string> = {
    email: `${uid()}@example.test`,
    subjectPl: `${PREFIX}temat`,
    messagePl: 'Testowa wiadomość.',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

async function seedOrder() {
  return prisma.order.create({
    data: {
      orderNumber: uid(),
      accessToken: uid(),
      paymentMethod: 'BANK_TRANSFER',
      deliveryMethodNamePl: 'Test',
      email: `${uid()}@example.test`,
      firstName: 'Test',
      lastName: 'Test',
      street: 'Test 1',
      postalCode: '00-001',
      city: 'Test',
      subtotalNetGrosze: 100,
      vatGrosze: 23,
      shippingGrosze: 0,
      totalGrossGrosze: 123,
      termsVersion: '1',
      termsAcceptedAt: new Date(),
      withdrawalExemptionTextPl: 'Test',
      withdrawalAcknowledgedAt: new Date(),
    },
  });
}

afterEach(async () => {
  await prisma.supportRequest.deleteMany({ where: { subjectPl: { startsWith: PREFIX } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: PREFIX } } });
});

describe('submitSupportRequest (standalone)', () => {
  it('creates a real row with no order context', async () => {
    const result = await applySubmitSupportRequest(null, validFormData());
    expect(result.ok).toBe(true);

    const created = await prisma.supportRequest.findFirstOrThrow({ where: { subjectPl: `${PREFIX}temat` } });
    expect(created.orderId).toBeNull();
    expect(created.status).toBe('NEW');
  });

  it('rejects an implausible email', async () => {
    const result = await applySubmitSupportRequest(null, validFormData({ email: 'not-an-email' }));
    expect(result.ok).toBe(false);
  });

  it('rejects an empty subject', async () => {
    const result = await applySubmitSupportRequest(null, validFormData({ subjectPl: '  ' }));
    expect(result.ok).toBe(false);
  });

  it('rejects an empty message', async () => {
    const result = await applySubmitSupportRequest(null, validFormData({ messagePl: '  ' }));
    expect(result.ok).toBe(false);
  });
});

describe('submitOrderSupportRequest (contextual)', () => {
  it('links the real order when the token matches', async () => {
    const order = await seedOrder();

    const result = await applySubmitOrderSupportRequest(null, order.orderNumber, order.accessToken, validFormData());
    expect(result.ok).toBe(true);

    const created = await prisma.supportRequest.findFirstOrThrow({ where: { subjectPl: `${PREFIX}temat` } });
    expect(created.orderId).toBe(order.id);
  });

  it('still creates the request, but WITHOUT the link, when the token is wrong', async () => {
    const order = await seedOrder();

    const result = await applySubmitOrderSupportRequest(null, order.orderNumber, 'wrong-token', validFormData());
    expect(result.ok).toBe(true);

    const created = await prisma.supportRequest.findFirstOrThrow({ where: { subjectPl: `${PREFIX}temat` } });
    expect(created.orderId).toBeNull();
  });

  it('still creates the request, but WITHOUT the link, when the order number does not exist', async () => {
    const result = await applySubmitOrderSupportRequest(null, 'does-not-exist', 'irrelevant', validFormData());
    expect(result.ok).toBe(true);

    const created = await prisma.supportRequest.findFirstOrThrow({ where: { subjectPl: `${PREFIX}temat` } });
    expect(created.orderId).toBeNull();
  });

  it('still validates the message fields even with valid order context', async () => {
    const order = await seedOrder();
    const result = await applySubmitOrderSupportRequest(null, order.orderNumber, order.accessToken, validFormData({ messagePl: '  ' }));
    expect(result.ok).toBe(false);
  });
});
