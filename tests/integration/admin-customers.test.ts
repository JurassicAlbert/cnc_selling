import { afterEach, describe, expect, it } from 'vitest';

import { applyAnonymizeCustomer } from '@/server/operations/admin-customers';
import {
  buildCustomerExport,
  findCustomerForAdmin,
  listCustomersForAdmin,
} from '@/server/repositories/admin-customers';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-customers-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

/**
 * ADMIN, not STAFF - changed 2026-08-31 for docs/REVIEW-DETAILED.md SEC-04.
 * This operation now refuses a STAFF actor (ARCHITECTURE.md §16.3), so an
 * actor built here has to be one that is genuinely allowed to perform it;
 * the refusal itself is covered by tests/integration/admin-authorization.test.ts.
 * The name is kept as `staffActor` because every call site below reads as
 * "the acting member of staff", which an ADMIN still is.
 */
function staffActor(): CurrentSession {
  return { userId: uid(), role: 'ADMIN', name: 'Test Admin', email: `${uid()}@example.test` };
}

async function seedCustomer() {
  return prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Test Customer', role: 'CUSTOMER', phone: '600000000' } });
}

async function seedProduct() {
  const category = await prisma.category.create({
    data: { slug: uid(), namePl: 'Test Category', descPl: 'Test', seoTitlePl: 'Test', seoDescPl: 'Test' },
  });
  return prisma.product.create({
    data: {
      slug: uid(),
      typeCode: 'WALL_ART',
      categoryId: category.id,
      namePl: 'Test Product',
      shortDescPl: 'Test',
      longDescPl: 'Test',
      careInstructionsPl: 'Test',
      seoTitlePl: 'Test',
      seoDescPl: 'Test',
      basePriceGrosze: 10_000,
      minPriceGrosze: 10_000,
      productionDaysMin: 1,
      productionDaysMax: 2,
      minWidthMm: 100,
      maxWidthMm: 1000,
      minHeightMm: 100,
      maxHeightMm: 1000,
    },
  });
}

async function seedOrder(userId: string | null) {
  return prisma.order.create({
    data: {
      orderNumber: uid(),
      accessToken: uid(),
      status: 'COMPLETED',
      userId,
      paymentMethod: 'BANK_TRANSFER',
      email: `${PREFIX}${crypto.randomUUID()}@example.test`,
      phone: '+48123456789',
      firstName: 'Jan',
      lastName: 'Testowy',
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

afterEach(async () => {
  await prisma.configuration.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.uploadedFile.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.order.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.session.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.account.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

describe('applyAnonymizeCustomer', () => {
  it('rejects an empty note', async () => {
    const customer = await seedCustomer();
    const result = await applyAnonymizeCustomer(staffActor(), customer.id, '   ');
    expect(result.ok).toBe(false);
  });

  it('rejects a STAFF target', async () => {
    const staffUser = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Staff', role: 'STAFF' } });
    const result = await applyAnonymizeCustomer(staffActor(), staffUser.id, 'Żądanie klienta.');
    expect(result.ok).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staffUser.id } })).anonymizedAt).toBeNull();
  });

  it('rejects an already-anonymized customer', async () => {
    const customer = await seedCustomer();
    await applyAnonymizeCustomer(staffActor(), customer.id, 'Pierwsze żądanie.');

    const second = await applyAnonymizeCustomer(staffActor(), customer.id, 'Drugie żądanie.');
    expect(second.ok).toBe(false);
  });

  it('scrubs identity fields, revokes sessions/accounts, preserves order records, and audits it', async () => {
    const staff = staffActor();
    const customer = await seedCustomer();
    const order = await seedOrder(customer.id);
    await prisma.session.create({
      data: { userId: customer.id, token: uid(), expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await prisma.account.create({
      data: { userId: customer.id, providerId: 'credential', issuer: 'credential', accountId: customer.email, password: 'hashed' },
    });

    const result = await applyAnonymizeCustomer(staff, customer.id, 'Żądanie RODO klienta.');
    expect(result.ok).toBe(true);

    const anonymized = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(anonymized.name).not.toBe(customer.name);
    expect(anonymized.email).not.toBe(customer.email);
    expect(anonymized.phone).toBeNull();
    expect(anonymized.anonymizedAt).not.toBeNull();

    expect(await prisma.session.count({ where: { userId: customer.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: customer.id } })).toBe(0);

    const preservedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(preservedOrder.email).toBe(order.email);
    expect(preservedOrder.firstName).toBe('Jan');
    expect(preservedOrder.lastName).toBe('Testowy');

    expect(await prisma.auditLog.count({ where: { entity: 'User', entityId: customer.id, actorEmail: staff.email } })).toBe(1);
  });
});

describe('listCustomersForAdmin / findCustomerForAdmin', () => {
  it('search matches name and email, and a STAFF user is never returned', async () => {
    const customer = await seedCustomer();
    const staffUser = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Test Staff Person', role: 'STAFF' } });

    const byName = (await listCustomersForAdmin(customer.name, { skip: 0, take: 100 })).items;
    expect(byName.some((c) => c.id === customer.id)).toBe(true);
    expect(byName.some((c) => c.id === staffUser.id)).toBe(false);

    const byEmail = (await listCustomersForAdmin(customer.email, { skip: 0, take: 100 })).items;
    expect(byEmail.some((c) => c.id === customer.id)).toBe(true);

    expect(await findCustomerForAdmin(customer.id)).not.toBeNull();
    expect(await findCustomerForAdmin(staffUser.id)).toBeNull();
  });
});

describe('buildCustomerExport', () => {
  it('returns real data for a genuine customer, scoped to that customer only', async () => {
    const customerA = await seedCustomer();
    const customerB = await seedCustomer();
    const product = await seedProduct();
    await prisma.configuration.create({ data: { userId: customerA.id, productId: product.id, isComplete: true } });
    await seedOrder(customerA.id);
    await seedOrder(customerB.id);

    const exportA = await buildCustomerExport(customerA.id);
    expect(exportA?.profile.id).toBe(customerA.id);
    expect(exportA?.orders).toHaveLength(1);
    expect(exportA?.configurations).toHaveLength(1);
  });

  it('returns null for a nonexistent or non-customer user', async () => {
    expect(await buildCustomerExport('does-not-exist')).toBeNull();
    const staffUser = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Staff', role: 'STAFF' } });
    expect(await buildCustomerExport(staffUser.id)).toBeNull();
  });
});
