import { afterEach, describe, expect, it } from 'vitest';

import type { Selections } from '@/domain/configuration/steps';
import { createOrder } from '@/server/orders/create-order';
import { priceAndValidateSelections } from '@/server/configurator/validate-and-price';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import type { OrderItemSnapshot } from '@/server/orders/snapshot';
import { prisma } from '@/server/db/client';

/**
 * P9 phases 5 & 6: `createOrder` re-checks both the chosen `DeliveryMethod`
 * and the chosen `PaymentMethodConfig` itself, never trusting whatever the
 * checkout form last rendered - the same "never trust client-side prices"
 * discipline as its own per-item re-pricing loop. Both checks run BEFORE
 * that pricing loop (right after the cart-emptiness check, in that order:
 * cart → delivery → payment), so they're reachable with a minimal, real
 * but not-necessarily-priceable cart item - same bare-bones
 * `Configuration`/`CartItem` shape `auth.test.ts`'s cart-merge tests
 * already use. The "creates a real order with correctly computed
 * shipping/payment" success path needs a genuinely priceable
 * product/config (materials, thicknesses, dimension envelope, pricing
 * version) - that's exercised end-to-end instead by the existing real e2e
 * checkout spec (`tests/e2e/checkout.spec.ts`) plus this session's own
 * live browser/DB verification, not duplicated here.
 */

const PREFIX = 'test-create-order-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

async function seedBareProduct() {
  const category = await prisma.category.create({
    data: { slug: uid(), namePl: 'Test Category', descPl: 'Test', seoTitlePl: 'Test', seoDescPl: 'Test' },
  });
  return prisma.product.create({
    data: {
      slug: uid(),
      typeCode: 'WALL_ART',
      categoryId: category.id,
      namePl: `${PREFIX}produkt`,
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

async function seedGuestCartWithOneItem() {
  const sessionToken = uid();
  const product = await seedBareProduct();
  const configuration = await prisma.configuration.create({
    data: { sessionToken, productId: product.id, isComplete: true },
  });
  const cart = await prisma.cart.create({ data: { sessionToken } });
  await prisma.cartItem.create({ data: { cartId: cart.id, configurationId: configuration.id, configurationSignature: configuration.id, quantity: 1 } });
  return { sessionToken, product, cart };
}

async function seedDeliveryMethod(overrides: { readonly isActive?: boolean; readonly requiresPickupPoint?: boolean } = {}) {
  return prisma.deliveryMethod.create({
    data: {
      namePl: `${PREFIX}dostawa`,
      descPl: 'Test',
      priceGrosze: 1_500,
      estimatedDaysMin: 1,
      estimatedDaysMax: 3,
      isActive: overrides.isActive ?? true,
      requiresPickupPoint: overrides.requiresPickupPoint ?? false,
    },
  });
}

async function seedPaymentMethodConfig(overrides: { readonly isActive?: boolean; readonly isConnected?: boolean } = {}) {
  return prisma.paymentMethodConfig.create({
    data: {
      namePl: `${PREFIX}platnosc`,
      descPl: 'Test',
      provider: 'BANK_TRANSFER',
      isActive: overrides.isActive ?? true,
      isConnected: overrides.isConnected ?? true,
    },
  });
}

/**
 * The bare product above is deliberately unpriceable - enough to reach the
 * delivery/payment/pickup checks, never enough to actually create an order.
 * The idempotency and concurrency tests below need a real order to actually
 * come out the other end, so they use the real seeded catalogue instead:
 * the same wall-art product `tests/e2e/checkout.spec.ts` buys, priced
 * through the same `priceAndValidateSelections` the configurator and
 * `createOrder` both use, so the cached price on the `Configuration` row
 * matches what checkout will recompute (a mismatch is `PRICE_CHANGED`,
 * which would make these tests pass for the wrong reason).
 *
 * Rather than hardcode ids or a size known to be feasible - both of which
 * silently rot when the seed changes - this walks the product's own real
 * option combinations and takes the first that genuinely prices.
 */
const PRICEABLE_PRODUCT_SLUG = 'obraz-drewniany-z-grawerem';

async function firstPriceableSelections(): Promise<{ readonly selections: Selections; readonly productId: string }> {
  const data = await getConfiguratorProductData(PRICEABLE_PRODUCT_SLUG);
  if (data === null) {
    throw new Error(`No "${PRICEABLE_PRODUCT_SLUG}" in this database - seed it first (npm run db:seed against TEST_DATABASE_URL)`);
  }
  const presetSizes = await prisma.productPresetSize.findMany({
    where: { productId: data.productId },
    orderBy: { sortOrder: 'asc' },
    select: { widthMm: true, heightMm: true },
  });
  // A product's smallest allowed size is NOT reliably priceable - a design
  // has its own real minimum recommended width, below which feasibility
  // blocks (a genuine catalogue fact this project's e2e spec already
  // documents, not a bug). With no preset sizes to lean on, walk a spread
  // across the product's real envelope rather than guessing one point.
  const fractions = [0.5, 0.75, 0.35, 1];
  const sizes =
    presetSizes.length > 0
      ? presetSizes
      : fractions.map((fraction) => ({
          widthMm: Math.round(data.product.minWidthMm + (data.product.maxWidthMm - data.product.minWidthMm) * fraction),
          heightMm: Math.round(data.product.minHeightMm + (data.product.maxHeightMm - data.product.minHeightMm) * fraction),
        }));

  for (const designId of data.designsById.keys()) {
    for (const materialId of data.materialsById.keys()) {
      for (const finishId of [...data.finishesById.keys(), null]) {
        for (const size of sizes) {
          const selections: Selections = {
            designId,
            customUploadId: null,
            materialId,
            widthMm: size.widthMm,
            heightMm: size.heightMm,
            thicknessMm: null,
            finishId,
            installationVariant: null,
            personalizationText: null,
            fontId: null,
          };
          if ((await priceAndValidateSelections(PRICEABLE_PRODUCT_SLUG, selections)).ok) {
            return { selections, productId: data.productId };
          }
        }
      }
    }
  }
  throw new Error(`No priceable option combination for "${PRICEABLE_PRODUCT_SLUG}" - the seeded catalogue changed`);
}

async function seedPriceableGuestCart() {
  const sessionToken = uid();
  const { selections, productId } = await firstPriceableSelections();
  const validated = await priceAndValidateSelections(PRICEABLE_PRODUCT_SLUG, selections);
  if (!validated.ok) {
    throw new Error('unreachable - firstPriceableSelections only returns combinations that price');
  }
  const configuration = await prisma.configuration.create({
    data: {
      sessionToken,
      productId,
      designId: selections.designId,
      materialId: selections.materialId,
      finishId: selections.finishId,
      widthMm: selections.widthMm,
      heightMm: selections.heightMm,
      priceGrossGrosze: validated.pricing.priceBreakdown.unitGrossGrosze,
      pricingVersion: validated.pricing.priceBreakdown.pricingVersion,
      isComplete: true,
    },
  });
  const cart = await prisma.cart.create({ data: { sessionToken } });
  await prisma.cartItem.create({ data: { cartId: cart.id, configurationId: configuration.id, configurationSignature: configuration.id, quantity: 1 } });
  return { sessionToken, cart };
}

function baseInput(overrides: {
  readonly sessionToken: string;
  readonly deliveryMethodId: string;
  readonly paymentMethodConfigId: string;
  readonly pickupPointId?: string | null;
  readonly idempotencyKey?: string;
}) {
  return {
    idempotencyKey: overrides.idempotencyKey ?? uid(),
    sessionToken: overrides.sessionToken,
    userId: null,
    email: 'test@example.test',
    phone: '+48123456789',
    firstName: 'Test',
    lastName: 'Testowy',
    companyName: null,
    nip: null,
    street: 'Testowa 1',
    postalCode: '00-001',
    city: 'Warszawa',
    deliveryMethodId: overrides.deliveryMethodId,
    paymentMethodConfigId: overrides.paymentMethodConfigId,
    pickupPointId: overrides.pickupPointId ?? null,
    courierNotePl: null,
    internalShipmentNotePl: null,
  };
}

afterEach(async () => {
  await prisma.order.deleteMany({
    where: { OR: [{ deliveryMethod: { namePl: { startsWith: PREFIX } } }, { paymentMethodConfig: { namePl: { startsWith: PREFIX } } }] },
  });
  await prisma.cartItem.deleteMany({ where: { cart: { sessionToken: { startsWith: PREFIX } } } });
  await prisma.cart.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.configuration.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
  await prisma.product.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.deliveryMethod.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
  await prisma.paymentMethodConfig.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
});

describe('createOrder - delivery method validation', () => {
  it('rejects a delivery method id that does not exist', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: 'does-not-exist', paymentMethodConfigId: 'does-not-exist' }));

    expect(result).toEqual({ ok: false, code: 'DELIVERY_METHOD_INVALID' });
  });

  it('rejects a real but deactivated delivery method - never trusts what the form last rendered', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const method = await seedDeliveryMethod({ isActive: false });

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: method.id, paymentMethodConfigId: 'does-not-exist' }));

    expect(result).toEqual({ ok: false, code: 'DELIVERY_METHOD_INVALID' });
  });

  it('still rejects with CART_EMPTY for an empty cart even when the delivery method id is bogus - cart-emptiness is checked first', async () => {
    const sessionToken = uid();
    await prisma.cart.create({ data: { sessionToken } });

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: 'does-not-exist', paymentMethodConfigId: 'does-not-exist' }));

    expect(result).toEqual({ ok: false, code: 'CART_EMPTY' });

    await prisma.cart.deleteMany({ where: { sessionToken } });
  });
});

describe('createOrder - payment method validation', () => {
  it('rejects a payment method config id that does not exist', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod();

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: 'does-not-exist' }));

    expect(result).toEqual({ ok: false, code: 'PAYMENT_METHOD_INVALID' });
  });

  it('rejects a real but deactivated payment method', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig({ isActive: false });

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id }));

    expect(result).toEqual({ ok: false, code: 'PAYMENT_METHOD_INVALID' });
  });

  it('rejects a real, active, but unconnected payment method - never treated as "disabled but selectable", always fully unreachable', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig({ isConnected: false });

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id }));

    expect(result).toEqual({ ok: false, code: 'PAYMENT_METHOD_INVALID' });
  });
});

/**
 * 2026-08-29, owner request: real pickup-point ("paczkomat/punkt odbioru")
 * validation for a `DeliveryMethod` with `requiresPickupPoint: true` - the
 * id is re-checked against `server/delivery/pickup-points.ts`'s own static
 * dataset, never trusted from whatever the checkout form last rendered,
 * same layering as the delivery/payment method checks above.
 */
describe('createOrder - pickup point validation', () => {
  it('rejects a required pickup point that was never chosen', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod({ requiresPickupPoint: true });
    const payment = await seedPaymentMethodConfig();

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id, pickupPointId: null }));

    expect(result).toEqual({ ok: false, code: 'PICKUP_POINT_INVALID' });
  });

  it('rejects a pickup point id that does not exist in the dataset - never trusts an id echoed back by the client', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod({ requiresPickupPoint: true });
    const payment = await seedPaymentMethodConfig();

    const result = await createOrder(
      baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id, pickupPointId: 'not-a-real-point' }),
    );

    expect(result).toEqual({ ok: false, code: 'PICKUP_POINT_INVALID' });
  });

  it('a pickup point id is ignored (never required) for a method that does not require one', async () => {
    const { sessionToken } = await seedGuestCartWithOneItem();
    const delivery = await seedDeliveryMethod({ requiresPickupPoint: false });
    const payment = await seedPaymentMethodConfig();

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id, pickupPointId: null }));

    // Both the delivery and payment checks pass; the next real rejection is
    // the per-item re-pricing loop, since the bare-bones seeded product has
    // no pricing rules - proof this path is reached at all, not stuck on
    // pickup-point validation for a method that never asked for one.
    expect(result).toEqual({ ok: false, code: 'PRICE_CHANGED' });
  });
});

/**
 * `docs/AUDIT-2026-08-30.md` P0-2 - the worst functional bug the audit
 * found. Before this, `createOrder` had no idempotency mechanism at all:
 * two submissions of one checkout both read a non-empty cart, both priced,
 * and both created a real `Order`. The checkout form's `useFormStatus()`
 * disables its own button while pending, which covers a plain double-click
 * in one tab and nothing else - not two tabs, not a retried request after a
 * dropped connection, not a back-and-resubmit, not a direct POST to the
 * action endpoint. These tests exercise the mechanism itself, below the UI.
 */
describe('createOrder - idempotency and concurrency', () => {
  it('creates a real order from a genuinely priceable cart (the premise the rest of this block depends on)', { retry: 1 }, async () => {
    const { sessionToken } = await seedPriceableGuestCart();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig();

    const result = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id }));

    expect(result.ok).toBe(true);
    expect(await prisma.order.count({ where: { deliveryMethodId: delivery.id } })).toBe(1);
  });

  it('a resubmitted checkout carrying the same key returns the FIRST order rather than creating a second', { retry: 1 }, async () => {
    const { sessionToken } = await seedPriceableGuestCart();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig();
    const input = baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id });

    const first = await createOrder(input);
    const second = await createOrder(input);

    expect(first.ok).toBe(true);
    // Not merely "the second one failed" - the customer who hit submit
    // twice must still land on their real order, with the same number and
    // the same access token, not on an error page.
    expect(second).toEqual(first);
    expect(await prisma.order.count({ where: { deliveryMethodId: delivery.id } })).toBe(1);
  });

  it('two genuinely concurrent submissions of one checkout create exactly one order', { retry: 1 }, async () => {
    const { sessionToken } = await seedPriceableGuestCart();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig();
    const input = baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id });

    const [first, second] = await Promise.all([createOrder(input), createOrder(input)]);

    expect(await prisma.order.count({ where: { deliveryMethodId: delivery.id } })).toBe(1);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second).toEqual(first);
  });

  it('two concurrent submissions from two DIFFERENT checkout renders still create exactly one order', { retry: 1 }, async () => {
    const { sessionToken } = await seedPriceableGuestCart();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig();
    // Two tabs: same cart, two separate page loads, so two separate keys.
    // The idempotency key cannot help here - the cart claim inside the
    // transaction is what stops the second one.
    const results = await Promise.all([
      createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id })),
      createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id })),
    ]);

    expect(await prisma.order.count({ where: { deliveryMethodId: delivery.id } })).toBe(1);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, code: 'CART_CHANGED' }]);
  });

  it('a stale second tab submitted after the first already checked out is rejected, not charged again', { retry: 1 }, async () => {
    const { sessionToken } = await seedPriceableGuestCart();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig();

    const first = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id }));
    const stale = await createOrder(baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id }));

    expect(first.ok).toBe(true);
    expect(stale).toEqual({ ok: false, code: 'CART_EMPTY' });
    expect(await prisma.order.count({ where: { deliveryMethodId: delivery.id } })).toBe(1);
  });
});

/**
 * `docs/REVIEW-DETAILED.md` BUG-19 - the snapshot omits fields §6.8 requires.
 *
 * §6.8 specifies it as "product name **and slug**, design code and name,
 * material name **and family**, dimensions, thickness, finish, installation
 * variant, personalization text and font, module count and layout, the full
 * price breakdown with the pricing version, **estimated production days**,
 * and the customer design file reference". Three of those were missing, plus
 * two the architecture requires elsewhere: `materialNotesPl` (§12 - the
 * confirmation has to render it) and the installation variant's `namePl` /
 * `receivesPl` (§6.5 - the „Co otrzymujesz" line "goes into the summary and
 * the order snapshot"). Only the bare enum code was stored, so showing it in
 * Polish meant either a live catalogue lookup - the one thing a snapshot
 * exists to avoid - or printing `ON_TOP` at a customer.
 *
 * **This is the argument for doing it now rather than later.** The snapshot
 * is what the customer bought, frozen at checkout. A field not captured then
 * cannot be recovered, because the catalogue row it would have come from has
 * moved on. Every order placed before this is permanently missing them.
 *
 * Driven through `createOrder`, not by writing a snapshot by hand: the
 * question is whether the real checkout path captures these.
 */
describe('the order snapshot, as ARCHITECTURE.md §6.8 specifies it', () => {
  /*
    One order for all six assertions, placed once.

    Not merely faster. Each placement opens a window between the cart storing
    its price and `createOrder` re-pricing it, and `admin-pricing.test.ts` -
    running in parallel against the same database - publishes a new pricing
    version, which makes any cart seeded a moment earlier fail with
    `PRICE_CHANGED`. That refusal is correct behaviour; it is simply not what
    these tests are about. Six placements meant six windows; this is one.

    The `retry: 1` on the cases below closes the rest of the gap, and cannot
    hide a regression: a genuinely broken checkout fails the retry too. Found
    2026-09-05, the same shared-database contention
    `docs/REVIEW-TEST-COVERAGE.md` already records twice.
  */
  let cachedSnapshot: OrderItemSnapshot | null = null;

  async function placeAndReadSnapshot(): Promise<OrderItemSnapshot> {
    if (cachedSnapshot !== null) {
      return cachedSnapshot;
    }

    const { sessionToken } = await seedPriceableGuestCart();
    const delivery = await seedDeliveryMethod();
    const payment = await seedPaymentMethodConfig();

    const result = await createOrder(
      baseInput({ sessionToken, deliveryMethodId: delivery.id, paymentMethodConfigId: payment.id }),
    );
    if (!result.ok) {
      throw new Error(`expected the order to be placed, got ${JSON.stringify(result)}`);
    }

    const item = await prisma.orderItem.findFirstOrThrow({
      where: { order: { orderNumber: result.orderNumber } },
      select: { snapshot: true },
    });
    cachedSnapshot = item.snapshot as unknown as OrderItemSnapshot;
    return cachedSnapshot;
  }

  it('captures the product slug, so an order survives a catalogue rename', { retry: 1 }, async () => {
    // A name is what you show; a slug is what you look things up by. Without
    // it, matching an old order back to a catalogue entry means matching on
    // a display string staff are free to change.
    expect((await placeAndReadSnapshot()).productSlug).toBe(PRICEABLE_PRODUCT_SLUG);
  });

  it("captures the material's family, not only its name", async () => {
    // §6.8 asks for both. The family is what production keys off - solid wood
    // is not ceramic - and it is exactly what a rename would silently lose.
    // `SOLID_WOOD` is a real `MaterialFamily` member, not a guess: this
    // product's materials are dąb, świerk, modrzew and sosna.
    expect((await placeAndReadSnapshot()).materialFamilyCode).toBe('SOLID_WOOD');
  });

  it('captures the production estimate the customer was actually quoted', async () => {
    const snapshot = await placeAndReadSnapshot();

    // Reading this live later answers "what do we promise today", which is a
    // different question from "what did we promise them".
    expect(typeof snapshot.productionDaysMin).toBe('number');
    expect(typeof snapshot.productionDaysMax).toBe('number');
    expect(snapshot.productionDaysMin ?? 0).toBeLessThanOrEqual(snapshot.productionDaysMax ?? 0);
  });

  it('captures materialNotesPl, which §12 requires the confirmation to render', async () => {
    // „Produkt obejmuje blat. Nogi nie są w zestawie." and similar. The
    // confirmation is required to show it and could only have done so by
    // joining to a live product row.
    expect(Object.hasOwn(await placeAndReadSnapshot(), 'materialNotesPl')).toBe(true);
  });

  it('leaves what it genuinely cannot know absent rather than guessed', async () => {
    // This product has no installation variant, so §6.5's two fields have
    // nothing to capture. Null, not an empty string and not a fabricated
    // label - the discipline `machiningMilliMinutesPerM2` already follows
    // for a CUSTOM product.
    const snapshot = await placeAndReadSnapshot();

    expect(snapshot.installationVariant).toBeNull();
    expect(snapshot.installationVariantNamePl ?? null).toBeNull();
    expect(snapshot.installationVariantReceivesPl ?? null).toBeNull();
  });

  it('still captures everything it captured before', async () => {
    // The new fields must not cost the ones already relied on:
    // `admin-production.ts` reads `moduleLayout`, `OrderSummary` the names.
    const snapshot = await placeAndReadSnapshot();

    expect(snapshot.productNamePl.length).toBeGreaterThan(0);
    expect(snapshot.materialNamePl).not.toBeNull();
    expect(snapshot.moduleLayout.totalModules).toBeGreaterThan(0);
    expect(snapshot.priceBreakdown.unitGrossGrosze).toBeGreaterThan(0);
  });
});
