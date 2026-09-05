import { SITE } from '@/content/pl/site';

/**
 * The checkout flow as a list, and the rule for which of its steps a
 * customer has passed - owner request, 2026-09-04, arrangement taken from
 * `template.getbazaar.io`'s cart page.
 *
 * A plain module rather than part of `CheckoutSteps.tsx`, so the rule can be
 * unit-tested without rendering anything, and so a Server Component can
 * import it without pulling a component in.
 *
 * **Three steps, not the reference's four.** The shop has exactly three
 * pages in this flow. The payment *method* is chosen on the order form and
 * the transfer is made afterwards in the customer's own bank, because no
 * payment provider is integrated (`docs/OPEN_ITEMS.md` §1) - so a separate
 * „Płatność" step would point at a page that does not exist, which is the
 * navigational version of promising a feature the shop does not have. The
 * second step is named for what genuinely happens on it.
 */

export type CheckoutStepCode = 'CART' | 'DETAILS' | 'CONFIRMATION';

type CheckoutStep = {
  readonly code: CheckoutStepCode;
  readonly labelPl: string;
  /** Where the step lives, or `null` for one with no addressable page of its own. */
  readonly href: string | null;
};

export const CHECKOUT_STEPS: readonly CheckoutStep[] = [
  { code: 'CART', labelPl: SITE.checkoutStepCartPl, href: '/koszyk' },
  { code: 'DETAILS', labelPl: SITE.checkoutStepDetailsPl, href: '/koszyk/zamowienie' },
  // The confirmation page's URL carries an order number, so there is no
  // fixed address to link to - and once you are on it, there is nowhere
  // forward to go anyway.
  { code: 'CONFIRMATION', labelPl: SITE.checkoutStepConfirmationPl, href: null },
];

export type ResolvedCheckoutStep = CheckoutStep & {
  readonly number: number;
  readonly state: 'done' | 'current' | 'upcoming';
};

/**
 * Every step, annotated against where the customer actually is.
 *
 * Only a **completed** step is a link, and only while the order has not been
 * placed. Forward links are deliberately absent rather than present and
 * broken: `/koszyk/zamowienie` redirects to `/koszyk` on an empty cart, so a
 * link to it from the cart would sometimes bounce, and a rail whose steps
 * are clickable before they are reachable teaches a customer that the rail
 * is decoration.
 *
 * From the confirmation page nothing is a link at all. The order consumed
 * the cart, so „back to the cart" leads to an empty one, and „back to the
 * order form" invites a second order for one purchase - which
 * `Order.idempotencyKey` exists to stop, and which nothing here should be
 * inviting in the first place.
 */
export function resolveCheckoutSteps(current: CheckoutStepCode): readonly ResolvedCheckoutStep[] {
  const currentIndex = CHECKOUT_STEPS.findIndex((step) => step.code === current);
  const orderPlaced = current === 'CONFIRMATION';

  return CHECKOUT_STEPS.map((step, index) => {
    const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
    return {
      ...step,
      number: index + 1,
      href: state === 'done' && !orderPlaced ? step.href : null,
      state,
    };
  });
}
