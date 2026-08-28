/**
 * Pure delivery-pricing logic — deliberately NOT in `src/server/repositories`
 * (which imports the real `pg`/Prisma client, unsafe to pull into a
 * `'use client'` component: doing that once broke the production build with
 * `Module not found: Can't resolve 'net'/'tls'/'util'`, the Postgres driver's
 * Node-only dependencies leaking into the browser bundle). Both
 * `create-order.ts` (server) and `CheckoutForm.tsx` (client, for its live
 * estimate) import this same function so the two can never silently drift.
 */

export type DeliveryPriceInfo = {
  readonly priceGrosze: number;
  readonly freeShippingThresholdGrosze: number | null;
};

/**
 * The actual shipping charge for a given method and order subtotal — free
 * once the subtotal clears the method's own threshold, if it has one.
 * `subtotalGrossGrosze` is the pre-shipping gross total (products + VAT,
 * before delivery is added) — thresholds are set and understood in gross
 * terms ("free over 200 zł"), matching what a customer actually sees.
 */
export function computeShippingGrosze(method: DeliveryPriceInfo, subtotalGrossGrosze: number): number {
  if (method.freeShippingThresholdGrosze !== null && subtotalGrossGrosze >= method.freeShippingThresholdGrosze) {
    return 0;
  }
  return method.priceGrosze;
}
