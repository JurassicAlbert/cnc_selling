/**
 * Order status transitions.
 *
 * `ARCHITECTURE.md` enumerates the `OrderStatus` values but does not fully
 * specify the graph between them; the edges below are this project's own
 * design, built from two things that ARE specified:
 *
 *   - §15: `BANK_TRANSFER` orders are created `AWAITING_PAYMENT`,
 *     `CONTACT_ARRANGED` orders are created `NEW`. There is no payment
 *     integration (an explicit "nothing is faked" rule), so nothing but a
 *     human — `staff` — may ever move an order out of `AWAITING_PAYMENT`.
 *   - §13.3: "an order containing a CustomerDesign not in APPROVED cannot
 *     leave DESIGN_REVIEW" — except to `CANCELLED`, which must always stay
 *     reachable. A customer stuck behind a design review must still be able
 *     to cancel.
 *
 * Beyond that, this module encodes one policy of its own, stated plainly so
 * it can be argued with: **cancellation ends once an order ships.** Staff may
 * cancel at any earlier stage; a customer may only cancel before their order
 * is confirmed (paid, or otherwise accepted).
 *
 * `fromStatus: null` represents order CREATION — `OrderEvent.fromStatus` is
 * nullable for exactly that event (§6.8).
 */

export type OrderStatus =
  | 'NEW'
  | 'AWAITING_PAYMENT'
  | 'DESIGN_REVIEW'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'FINISHING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'NEW',
  'AWAITING_PAYMENT',
  'DESIGN_REVIEW',
  'CONFIRMED',
  'IN_PRODUCTION',
  'FINISHING',
  'READY_TO_SHIP',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
];

/** Matches `OrderEvent.actorType` (§6.8): who initiated the transition. */
export type OrderActorType = 'system' | 'staff' | 'customer';

export type OrderTransitionInput = {
  /** `null` means this is the order-creation event. */
  readonly fromStatus: OrderStatus | null;
  readonly toStatus: OrderStatus;
  readonly actorType: OrderActorType;
  /** True while the order has a CustomerDesign not yet APPROVED. */
  readonly hasUnapprovedCustomDesign: boolean;
};

export type OrderTransitionIssueCode =
  | 'ILLEGAL_TRANSITION'
  | 'ACTOR_NOT_PERMITTED'
  | 'DESIGN_REVIEW_GATE_BLOCKED';

export type OrderTransitionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: OrderTransitionIssueCode; readonly detail: string };

type Edge = {
  readonly from: OrderStatus | null;
  readonly to: OrderStatus;
  readonly actors: readonly OrderActorType[];
};

const EDGES: readonly Edge[] = [
  // Creation. Always the system: nobody clicks a button to create an order
  // in status NEW or AWAITING_PAYMENT — checkout does.
  { from: null, to: 'NEW', actors: ['system'] },
  { from: null, to: 'AWAITING_PAYMENT', actors: ['system'] },

  // Entering design review happens automatically as soon as a custom design
  // is attached — no human decides to route an order there.
  { from: 'NEW', to: 'DESIGN_REVIEW', actors: ['system'] },
  { from: 'AWAITING_PAYMENT', to: 'DESIGN_REVIEW', actors: ['system'] },

  // Confirming an order means "payment received, or otherwise accepted" —
  // always a human judgement, staff-only, since nothing here is automated.
  { from: 'NEW', to: 'CONFIRMED', actors: ['staff'] },
  { from: 'AWAITING_PAYMENT', to: 'CONFIRMED', actors: ['staff'] },
  { from: 'DESIGN_REVIEW', to: 'CONFIRMED', actors: ['staff'] }, // gated, see checkOrderStatusTransition

  // Cancellation. A customer may withdraw their own order right up until it
  // is confirmed; after that, only staff, and never once it has shipped.
  { from: 'NEW', to: 'CANCELLED', actors: ['staff', 'customer', 'system'] },
  { from: 'AWAITING_PAYMENT', to: 'CANCELLED', actors: ['staff', 'customer', 'system'] },
  { from: 'DESIGN_REVIEW', to: 'CANCELLED', actors: ['staff', 'customer'] }, // gate-exempt
  { from: 'CONFIRMED', to: 'CANCELLED', actors: ['staff'] },
  { from: 'IN_PRODUCTION', to: 'CANCELLED', actors: ['staff'] },
  { from: 'FINISHING', to: 'CANCELLED', actors: ['staff'] },
  { from: 'READY_TO_SHIP', to: 'CANCELLED', actors: ['staff'] },

  // Production, staff-only throughout — there is no production automation.
  { from: 'CONFIRMED', to: 'IN_PRODUCTION', actors: ['staff'] },
  { from: 'IN_PRODUCTION', to: 'FINISHING', actors: ['staff'] },
  { from: 'FINISHING', to: 'READY_TO_SHIP', actors: ['staff'] },
  { from: 'READY_TO_SHIP', to: 'SHIPPED', actors: ['staff'] },
  { from: 'SHIPPED', to: 'COMPLETED', actors: ['staff'] },

  // COMPLETED and CANCELLED are terminal: no edges leave them.
];

const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set(['COMPLETED', 'CANCELLED']);

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Checks one proposed transition. Order of checks: does the edge exist at
 * all, then is this actor allowed to use it, then — only for the one edge it
 * applies to — the design-review gate.
 */
export function checkOrderStatusTransition(
  input: OrderTransitionInput,
): OrderTransitionResult {
  const { fromStatus, toStatus, actorType, hasUnapprovedCustomDesign } = input;

  const edge = EDGES.find((candidate) => candidate.from === fromStatus && candidate.to === toStatus);

  if (edge === undefined) {
    return {
      ok: false,
      code: 'ILLEGAL_TRANSITION',
      detail: `${fromStatus ?? '(creation)'} -> ${toStatus} is not a legal order status transition`,
    };
  }

  if (!edge.actors.includes(actorType)) {
    return {
      ok: false,
      code: 'ACTOR_NOT_PERMITTED',
      detail: `actor "${actorType}" may not move an order from ${fromStatus ?? '(creation)'} to ${toStatus}`,
    };
  }

  if (fromStatus === 'DESIGN_REVIEW' && toStatus !== 'CANCELLED' && hasUnapprovedCustomDesign) {
    return {
      ok: false,
      code: 'DESIGN_REVIEW_GATE_BLOCKED',
      detail: 'the order has a customer design that is not yet APPROVED and cannot leave DESIGN_REVIEW',
    };
  }

  return { ok: true };
}
