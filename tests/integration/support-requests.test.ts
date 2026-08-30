import { afterEach, describe, expect, it } from 'vitest';

import { applySubmitOrderSupportRequest, applySubmitSupportRequest } from '@/server/operations/support-requests';
import { listSupportRequestsForUser } from '@/server/repositories/support-requests';
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
      phone: '+48123456789',
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
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
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

  /**
   * 2026-08-30 duplicate sweep. The form is zero-JS, so nothing on the
   * client disables it while the action runs — a double-click, or a browser
   * retry after a dropped connection, filed the same question twice and
   * staff had no way to tell whether the customer really asked twice.
   */
  it('a double-submitted identical message is filed once', async () => {
    // The SAME email each time — a double-click resubmits one form, so every
    // field matches. `validFormData()` randomises the address per call.
    const email = `${uid()}@example.test`;
    expect((await applySubmitSupportRequest(null, validFormData({ email }))).ok).toBe(true);
    expect((await applySubmitSupportRequest(null, validFormData({ email }))).ok).toBe(true);

    expect(await prisma.supportRequest.count({ where: { subjectPl: `${PREFIX}temat` } })).toBe(1);
  });

  it('two genuinely concurrent submissions are filed once', async () => {
    const email = `${uid()}@example.test`;
    await Promise.all([
      applySubmitSupportRequest(null, validFormData({ email })),
      applySubmitSupportRequest(null, validFormData({ email })),
    ]);

    expect(await prisma.supportRequest.count({ where: { subjectPl: `${PREFIX}temat` } })).toBe(1);
  });

  /** A different question from the same person is a real second request, not a duplicate. */
  it('a different message from the same address is still filed', async () => {
    const email = `${uid()}@example.test`;
    await applySubmitSupportRequest(null, validFormData({ email }));
    await applySubmitSupportRequest(null, validFormData({ email, messagePl: 'Zupełnie inne pytanie o coś innego.' }));

    expect(await prisma.supportRequest.count({ where: { subjectPl: `${PREFIX}temat` } })).toBe(2);
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

/**
 * P9 continuation, 2026-08-28 — "informacje kontaktowe i pomoc do firmy"
 * (owner feedback): a customer could file a request but never see it again
 * — `applySubmitSupportRequest` already existed, `listSupportRequestsForUser`
 * is the missing read side, for `/moje-konto/pomoc`.
 */
describe('listSupportRequestsForUser', () => {
  it('returns the real owner’s own requests, newest first, with order context when present', async () => {
    const user = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Test Customer', role: 'CUSTOMER' } });
    const order = await seedOrder();

    await applySubmitSupportRequest(user.id, validFormData({ subjectPl: `${PREFIX}pierwsze` }));
    const withOrder = await applySubmitOrderSupportRequest(user.id, order.orderNumber, order.accessToken, validFormData({ subjectPl: `${PREFIX}drugie` }));
    expect(withOrder.ok).toBe(true);

    const result = await listSupportRequestsForUser(user.id);

    expect(result).toHaveLength(2);
    expect(result[0]?.subjectPl).toBe(`${PREFIX}drugie`);
    expect(result[0]?.orderNumber).toBe(order.orderNumber);
    expect(result[1]?.subjectPl).toBe(`${PREFIX}pierwsze`);
    expect(result[1]?.orderNumber).toBeNull();
  });

  it('never returns another user’s requests', async () => {
    const owner = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Owner', role: 'CUSTOMER' } });
    const other = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Other', role: 'CUSTOMER' } });
    await applySubmitSupportRequest(owner.id, validFormData());

    expect(await listSupportRequestsForUser(owner.id)).toHaveLength(1);
    expect(await listSupportRequestsForUser(other.id)).toHaveLength(0);
  });

  it('returns an empty list for a guest submission (no userId)', async () => {
    await applySubmitSupportRequest(null, validFormData());
    // Nothing to assert an id against — this just confirms a real user with
    // no requests gets an empty list, not an error.
    const user = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Test Customer', role: 'CUSTOMER' } });
    expect(await listSupportRequestsForUser(user.id)).toHaveLength(0);
  });
});
