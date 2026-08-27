import { afterEach, describe, expect, it } from 'vitest';

import { searchGlobal } from '@/server/repositories/admin-global-search';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-global-search-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedOrder() {
  return prisma.order.create({
    data: {
      orderNumber: `${PREFIX}${crypto.randomUUID().slice(0, 8)}`,
      accessToken: uid(),
      status: 'AWAITING_PAYMENT',
      paymentMethod: 'BANK_TRANSFER',
      email: `${PREFIX}${crypto.randomUUID()}@example.test`,
      firstName: 'Search',
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

async function seedCustomer() {
  return prisma.user.create({ data: { email: `${uid()}@example.test`, name: `${PREFIX}Customer`, role: 'CUSTOMER' } });
}

async function seedDesign() {
  const collection = await prisma.designCollection.create({
    data: { slug: uid(), namePl: 'Test Collection', descPl: 'Test', sortOrder: 0 },
  });
  return prisma.design.create({
    data: {
      slug: uid(),
      code: `${PREFIX}CODE`,
      namePl: `${PREFIX}Design`,
      collectionId: collection.id,
      thumbnailUrl: '/x.jpg',
      previewUrl: '/x.jpg',
      referenceWidthMm: 100,
      minLineWidthUm: 1000,
      minDetailSpacingUm: 1000,
      minRecommendedWidthMm: 50,
      detailLevel: 3,
      recommendedMethod: 'CNC_ENGRAVE',
      machiningMilliMinutesPerM2: 2000,
    },
  });
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
      namePl: `${PREFIX}Product`,
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

afterEach(async () => {
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
  await prisma.design.deleteMany({ where: { code: { startsWith: PREFIX } } });
  await prisma.designCollection.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
});

describe('searchGlobal', () => {
  it('returns an empty result for a blank query without touching the database', async () => {
    const result = await searchGlobal('   ');
    expect(result).toEqual({ orders: [], customers: [], designs: [], products: [] });
  });

  it('finds a real order, customer, design, and product, each correctly typed and linked', async () => {
    const order = await seedOrder();
    const customer = await seedCustomer();
    const design = await seedDesign();
    const product = await seedProduct();

    const orderResult = await searchGlobal(order.orderNumber);
    expect(orderResult.orders.map((r) => r.id)).toContain(order.orderNumber);
    expect(orderResult.orders[0]?.href).toBe(`/panel/zamowienia/${order.orderNumber}`);

    const customerResult = await searchGlobal(customer.name);
    expect(customerResult.customers.map((r) => r.id)).toContain(customer.id);
    expect(customerResult.customers.find((r) => r.id === customer.id)?.href).toBe(`/panel/klienci/${customer.id}`);

    const designResult = await searchGlobal(design.code);
    expect(designResult.designs.map((r) => r.id)).toContain(design.id);
    expect(designResult.designs.find((r) => r.id === design.id)?.href).toBe(`/panel/wzory/${design.id}`);

    const productResult = await searchGlobal(product.namePl);
    expect(productResult.products.map((r) => r.id)).toContain(product.id);
    expect(productResult.products.find((r) => r.id === product.id)?.href).toBe(`/panel/produkty/${product.id}`);
  });

  it('returns all-empty groups for a query matching nothing', async () => {
    const result = await searchGlobal(`${PREFIX}no-such-thing-${crypto.randomUUID()}`);
    expect(result).toEqual({ orders: [], customers: [], designs: [], products: [] });
  });
});
