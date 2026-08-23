import { describe, expect, it } from 'vitest';

import {
  checkOrderStatusTransition,
  isTerminalOrderStatus,
} from '@/domain/order-status/transitions';

/**
 * The order status machine. `fromStatus: null` represents order creation —
 * `OrderEvent.fromStatus` is nullable for exactly this event, per
 * ARCHITECTURE.md §6.8.
 *
 * The graph encoded here is this project's own design (ARCHITECTURE.md
 * enumerates the OrderStatus values but does not fully specify the edges);
 * it follows §15's payment rule directly — BANK_TRANSFER orders are created
 * `AWAITING_PAYMENT`, CONTACT_ARRANGED orders are created `NEW` — and one
 * explicit rule from §13.3: "an order containing a CustomerDesign not in
 * APPROVED cannot leave DESIGN_REVIEW", except to CANCELLED, which must
 * always remain reachable regardless of an unresolved design.
 */

function ok(input: Parameters<typeof checkOrderStatusTransition>[0]) {
  expect(checkOrderStatusTransition(input)).toEqual({ ok: true });
}

function issue(
  input: Parameters<typeof checkOrderStatusTransition>[0],
  code: string,
) {
  const result = checkOrderStatusTransition(input);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe(code);
  }
}

describe('order creation', () => {
  it('may start at NEW (CONTACT_ARRANGED orders), by the system', () => {
    ok({
      fromStatus: null,
      toStatus: 'NEW',
      actorType: 'system',
      hasUnapprovedCustomDesign: false,
    });
  });

  it('may start at AWAITING_PAYMENT (BANK_TRANSFER orders), by the system', () => {
    ok({
      fromStatus: null,
      toStatus: 'AWAITING_PAYMENT',
      actorType: 'system',
      hasUnapprovedCustomDesign: false,
    });
  });

  it('may not start anywhere else', () => {
    issue(
      {
        fromStatus: null,
        toStatus: 'CONFIRMED',
        actorType: 'system',
        hasUnapprovedCustomDesign: false,
      },
      'ILLEGAL_TRANSITION',
    );
  });

  it('may not be created directly by staff or a customer', () => {
    issue(
      {
        fromStatus: null,
        toStatus: 'NEW',
        actorType: 'customer',
        hasUnapprovedCustomDesign: false,
      },
      'ACTOR_NOT_PERMITTED',
    );
  });
});

describe('legal forward transitions', () => {
  it('walks the full happy path to COMPLETED', () => {
    ok({ fromStatus: 'NEW', toStatus: 'CONFIRMED', actorType: 'staff', hasUnapprovedCustomDesign: false });
    ok({ fromStatus: 'AWAITING_PAYMENT', toStatus: 'CONFIRMED', actorType: 'staff', hasUnapprovedCustomDesign: false });
    ok({ fromStatus: 'CONFIRMED', toStatus: 'IN_PRODUCTION', actorType: 'staff', hasUnapprovedCustomDesign: false });
    ok({ fromStatus: 'IN_PRODUCTION', toStatus: 'FINISHING', actorType: 'staff', hasUnapprovedCustomDesign: false });
    ok({ fromStatus: 'FINISHING', toStatus: 'READY_TO_SHIP', actorType: 'staff', hasUnapprovedCustomDesign: false });
    ok({ fromStatus: 'READY_TO_SHIP', toStatus: 'SHIPPED', actorType: 'staff', hasUnapprovedCustomDesign: false });
    ok({ fromStatus: 'SHIPPED', toStatus: 'COMPLETED', actorType: 'staff', hasUnapprovedCustomDesign: false });
  });

  it('enters DESIGN_REVIEW automatically from either starting status', () => {
    ok({ fromStatus: 'NEW', toStatus: 'DESIGN_REVIEW', actorType: 'system', hasUnapprovedCustomDesign: true });
    ok({
      fromStatus: 'AWAITING_PAYMENT',
      toStatus: 'DESIGN_REVIEW',
      actorType: 'system',
      hasUnapprovedCustomDesign: true,
    });
  });
});

describe('illegal transitions', () => {
  it('rejects skipping stages', () => {
    issue(
      { fromStatus: 'NEW', toStatus: 'SHIPPED', actorType: 'staff', hasUnapprovedCustomDesign: false },
      'ILLEGAL_TRANSITION',
    );
  });

  it('rejects a status transitioning to itself', () => {
    issue(
      { fromStatus: 'CONFIRMED', toStatus: 'CONFIRMED', actorType: 'staff', hasUnapprovedCustomDesign: false },
      'ILLEGAL_TRANSITION',
    );
  });

  it('rejects any transition out of COMPLETED — it is terminal', () => {
    issue(
      { fromStatus: 'COMPLETED', toStatus: 'CANCELLED', actorType: 'staff', hasUnapprovedCustomDesign: false },
      'ILLEGAL_TRANSITION',
    );
  });

  it('rejects any transition out of CANCELLED — it is terminal', () => {
    issue(
      { fromStatus: 'CANCELLED', toStatus: 'NEW', actorType: 'staff', hasUnapprovedCustomDesign: false },
      'ILLEGAL_TRANSITION',
    );
  });

  it('rejects cancelling a shipped order — cancellation ends once goods are sent', () => {
    issue(
      { fromStatus: 'SHIPPED', toStatus: 'CANCELLED', actorType: 'staff', hasUnapprovedCustomDesign: false },
      'ILLEGAL_TRANSITION',
    );
  });

  it('rejects going backwards, not just sideways', () => {
    issue(
      {
        fromStatus: 'IN_PRODUCTION',
        toStatus: 'CONFIRMED',
        actorType: 'staff',
        hasUnapprovedCustomDesign: false,
      },
      'ILLEGAL_TRANSITION',
    );
  });
});

describe('actor permission', () => {
  it('lets a customer cancel their own unpaid order', () => {
    ok({ fromStatus: 'NEW', toStatus: 'CANCELLED', actorType: 'customer', hasUnapprovedCustomDesign: false });
    ok({
      fromStatus: 'AWAITING_PAYMENT',
      toStatus: 'CANCELLED',
      actorType: 'customer',
      hasUnapprovedCustomDesign: false,
    });
  });

  it('does not let a customer confirm their own order — only staff marks payment received', () => {
    issue(
      { fromStatus: 'NEW', toStatus: 'CONFIRMED', actorType: 'customer', hasUnapprovedCustomDesign: false },
      'ACTOR_NOT_PERMITTED',
    );
  });

  it('does not let the system mark payment received — there is no payment integration (brief: nothing faked)', () => {
    issue(
      {
        fromStatus: 'AWAITING_PAYMENT',
        toStatus: 'CONFIRMED',
        actorType: 'system',
        hasUnapprovedCustomDesign: false,
      },
      'ACTOR_NOT_PERMITTED',
    );
  });

  it('no longer lets a customer cancel once an order is confirmed — only staff can, past that point', () => {
    issue(
      { fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', actorType: 'customer', hasUnapprovedCustomDesign: false },
      'ACTOR_NOT_PERMITTED',
    );
  });

  it('lets staff cancel at any pre-shipment stage', () => {
    ok({ fromStatus: 'CONFIRMED', toStatus: 'CANCELLED', actorType: 'staff', hasUnapprovedCustomDesign: false });
    ok({ fromStatus: 'IN_PRODUCTION', toStatus: 'CANCELLED', actorType: 'staff', hasUnapprovedCustomDesign: false });
    ok({ fromStatus: 'FINISHING', toStatus: 'CANCELLED', actorType: 'staff', hasUnapprovedCustomDesign: false });
    ok({
      fromStatus: 'READY_TO_SHIP',
      toStatus: 'CANCELLED',
      actorType: 'staff',
      hasUnapprovedCustomDesign: false,
    });
  });
});

describe('the design-review gate (§13.3)', () => {
  it('blocks leaving DESIGN_REVIEW while a custom design is unapproved', () => {
    issue(
      {
        fromStatus: 'DESIGN_REVIEW',
        toStatus: 'CONFIRMED',
        actorType: 'staff',
        hasUnapprovedCustomDesign: true,
      },
      'DESIGN_REVIEW_GATE_BLOCKED',
    );
  });

  it('allows leaving DESIGN_REVIEW once the design is approved', () => {
    ok({
      fromStatus: 'DESIGN_REVIEW',
      toStatus: 'CONFIRMED',
      actorType: 'staff',
      hasUnapprovedCustomDesign: false,
    });
  });

  it('never blocks cancellation, even with an unapproved design', () => {
    ok({
      fromStatus: 'DESIGN_REVIEW',
      toStatus: 'CANCELLED',
      actorType: 'staff',
      hasUnapprovedCustomDesign: true,
    });
    ok({
      fromStatus: 'DESIGN_REVIEW',
      toStatus: 'CANCELLED',
      actorType: 'customer',
      hasUnapprovedCustomDesign: true,
    });
  });

  it('does not apply to any other status — an unapproved flag elsewhere has no effect', () => {
    ok({ fromStatus: 'NEW', toStatus: 'CONFIRMED', actorType: 'staff', hasUnapprovedCustomDesign: true });
  });
});

describe('isTerminalOrderStatus', () => {
  it('is true only for COMPLETED and CANCELLED', () => {
    expect(isTerminalOrderStatus('COMPLETED')).toBe(true);
    expect(isTerminalOrderStatus('CANCELLED')).toBe(true);
    expect(isTerminalOrderStatus('NEW')).toBe(false);
    expect(isTerminalOrderStatus('SHIPPED')).toBe(false);
  });
});
