/**
 * Cart line-item quantity bounds — pure, no I/O, per `domain/`'s own rule.
 *
 * 2026-08-29, owner feedback: "dodaj odpowiednie testy jeśli jeszcze nie ma
 * żeby nie było sytuacji w której klient kupuje 10000 sztuk produktu" (add
 * tests so a customer can't buy 10 000 units) — a real gap: neither
 * `addToCart` nor `updateCartItemQuantity` (`server/actions/cart.ts`)
 * enforced any upper bound before this. `clampCartQuantity` is the one
 * place that decides what's an acceptable quantity — every mutation path
 * (the initial add, the cart page's stepper, the cart page's typed-number
 * field) routes through it, so a direct POST past the UI can't bypass it
 * either.
 *
 * 25 units is a deliberate business choice, not a technical one: every
 * product here is custom-made to order (wood, laser/CNC time per piece) —
 * a real bulk buyer needs a quote, not a self-service cart. `panel/ustawienia`
 * has no field for this yet; revisit as a `StoreSettings` column if a real
 * bulk-order workflow is ever built.
 */
export const MAX_CART_ITEM_QUANTITY = 25;
export const MIN_CART_ITEM_QUANTITY = 1;

/** Coerces any input (typed, POSTed, or programmatically incremented) into the closed range `[1, MAX_CART_ITEM_QUANTITY]`, rounding a non-integer down and treating anything non-finite (`NaN`, `Infinity`, a missing field parsed as `0`) as the minimum. */
export function clampCartQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_CART_ITEM_QUANTITY;
  }
  const whole = Math.trunc(value);
  return Math.min(Math.max(whole, MIN_CART_ITEM_QUANTITY), MAX_CART_ITEM_QUANTITY);
}
