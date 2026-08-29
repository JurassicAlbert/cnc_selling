import { describe, expect, it } from 'vitest';

import { MAX_CART_ITEM_QUANTITY, MIN_CART_ITEM_QUANTITY, clampCartQuantity } from '@/domain/cart/quantity';

/**
 * 2026-08-29, owner feedback: "dodaj odpowiednie testy jeśli jeszcze nie ma
 * żeby nie było sytuacji w której klient kupuje 10000 sztuk produktu" —
 * this is the actual "customer buys 10 000 units" scenario, asserted
 * directly against the one function every cart-quantity mutation routes
 * through (`server/actions/cart.ts`'s own comments name it explicitly).
 */
describe('clampCartQuantity', () => {
  it('clamps an absurd quantity (10 000) down to the maximum', () => {
    expect(clampCartQuantity(10_000)).toBe(MAX_CART_ITEM_QUANTITY);
  });

  it('clamps anything above the maximum down to the maximum', () => {
    expect(clampCartQuantity(MAX_CART_ITEM_QUANTITY + 1)).toBe(MAX_CART_ITEM_QUANTITY);
    expect(clampCartQuantity(Number.MAX_SAFE_INTEGER)).toBe(MAX_CART_ITEM_QUANTITY);
  });

  it('leaves an in-range quantity untouched', () => {
    expect(clampCartQuantity(5)).toBe(5);
    expect(clampCartQuantity(MAX_CART_ITEM_QUANTITY)).toBe(MAX_CART_ITEM_QUANTITY);
    expect(clampCartQuantity(MIN_CART_ITEM_QUANTITY)).toBe(MIN_CART_ITEM_QUANTITY);
  });

  it('clamps zero and negative values up to the minimum', () => {
    expect(clampCartQuantity(0)).toBe(MIN_CART_ITEM_QUANTITY);
    expect(clampCartQuantity(-5)).toBe(MIN_CART_ITEM_QUANTITY);
  });

  it('treats any non-finite value (NaN, +/-Infinity) as the minimum — never as "unlimited"', () => {
    expect(clampCartQuantity(Number.NaN)).toBe(MIN_CART_ITEM_QUANTITY);
    expect(clampCartQuantity(Number.POSITIVE_INFINITY)).toBe(MIN_CART_ITEM_QUANTITY);
    expect(clampCartQuantity(Number.NEGATIVE_INFINITY)).toBe(MIN_CART_ITEM_QUANTITY);
  });

  it('truncates a non-integer rather than rounding', () => {
    expect(clampCartQuantity(3.9)).toBe(3);
  });
});
