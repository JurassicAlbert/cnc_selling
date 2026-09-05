/**
 * The checkout step rail - owner request, 2026-09-04: "nie ma u nas pod
 * paskiem wyszukiwania - nad zakupami menu przejścia między etapami
 * płatności".
 *
 * The arithmetic is trivial. What is worth pinning is the honesty of it: a
 * rail that shows four steps when the shop has three is a promise about a
 * flow that does not exist, and a rail whose "completed" marks run ahead of
 * where the customer actually is tells them they have done something they
 * have not.
 *
 * The real flow is three pages. Payment is *chosen* on the second one and
 * settled by bank transfer afterwards - no provider is integrated
 * (`docs/OPEN_ITEMS.md` §1) - so there is no third page to point a
 * „Płatność" step at. The second step is named for what actually happens
 * there instead.
 */

import { describe, expect, it } from 'vitest';

import { CHECKOUT_STEPS, resolveCheckoutSteps } from '@/ui/primitives/checkout-steps';

describe('resolveCheckoutSteps', () => {
  it('has one step per real page in the flow, and no more', () => {
    // Three, not the reference layout's four. A "Płatność" step would need a
    // payment page to point at, and there is none: the method is picked on
    // the order form and the transfer happens in the customer's own bank.
    expect(CHECKOUT_STEPS.map((step) => step.code)).toEqual(['CART', 'DETAILS', 'CONFIRMATION']);
  });

  it('marks the current step, everything before it done, everything after it upcoming', () => {
    const states = resolveCheckoutSteps('DETAILS');

    expect(states.map((s) => s.state)).toEqual(['done', 'current', 'upcoming']);
  });

  it('marks nothing done on the first step', () => {
    expect(resolveCheckoutSteps('CART').map((s) => s.state)).toEqual(['current', 'upcoming', 'upcoming']);
  });

  it('marks everything done on the last step', () => {
    // The confirmation page: the order exists, so the two steps behind it
    // genuinely are finished.
    expect(resolveCheckoutSteps('CONFIRMATION').map((s) => s.state)).toEqual(['done', 'done', 'current']);
  });

  it('links back to a completed step and never forward to an unreached one', () => {
    // Going back to the cart from the order form is a real thing to want.
    // Jumping forward to a page that would redirect straight back is not, so
    // an upcoming step is not a link at all rather than a link that fails.
    const states = resolveCheckoutSteps('DETAILS');

    expect(states.find((s) => s.code === 'CART')?.href).toBe('/koszyk');
    expect(states.find((s) => s.code === 'DETAILS')?.href).toBeNull();
    expect(states.find((s) => s.code === 'CONFIRMATION')?.href).toBeNull();
  });

  it('offers no link at all once the order is placed', () => {
    // From the confirmation page, "back to the cart" would lead to an empty
    // cart - the order consumed it - and "back to the order form" would
    // invite a second order for one purchase.
    expect(resolveCheckoutSteps('CONFIRMATION').every((s) => s.href === null)).toBe(true);
  });

  it('numbers the steps from one, for display', () => {
    expect(resolveCheckoutSteps('CART').map((s) => s.number)).toEqual([1, 2, 3]);
  });
});
