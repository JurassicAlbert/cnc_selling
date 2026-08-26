import { describe, expect, it } from 'vitest';

import {
  checkDesignReviewTransition,
  isTerminalDesignReviewStatus,
} from '@/domain/design-review/transitions';

/**
 * The design-review state machine (`ARCHITECTURE.md` §13.3's diagram),
 * encoded the same way `tests/unit/order-status.test.ts` tests the order
 * graph.
 */

function ok(input: Parameters<typeof checkDesignReviewTransition>[0]) {
  expect(checkDesignReviewTransition(input)).toEqual({ ok: true });
}

function issue(input: Parameters<typeof checkDesignReviewTransition>[0], code: string) {
  const result = checkDesignReviewTransition(input);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.code).toBe(code);
  }
}

describe('design creation', () => {
  it('starts at PENDING_REVIEW, by the customer uploading', () => {
    ok({ fromStatus: null, toStatus: 'PENDING_REVIEW', actorType: 'customer' });
  });

  it('may not start anywhere else', () => {
    issue({ fromStatus: null, toStatus: 'APPROVED', actorType: 'customer' }, 'ILLEGAL_TRANSITION');
  });

  it('may not be created by staff', () => {
    issue({ fromStatus: null, toStatus: 'PENDING_REVIEW', actorType: 'staff' }, 'ACTOR_NOT_PERMITTED');
  });
});

describe('staff review decisions', () => {
  it('approves a pending design', () => {
    ok({ fromStatus: 'PENDING_REVIEW', toStatus: 'APPROVED', actorType: 'staff' });
  });

  it('requests changes on a pending design', () => {
    ok({ fromStatus: 'PENDING_REVIEW', toStatus: 'NEEDS_CHANGES', actorType: 'staff' });
  });

  it('rejects a pending design', () => {
    ok({ fromStatus: 'PENDING_REVIEW', toStatus: 'REJECTED', actorType: 'staff' });
  });

  it('does not let a customer decide their own review', () => {
    issue({ fromStatus: 'PENDING_REVIEW', toStatus: 'APPROVED', actorType: 'customer' }, 'ACTOR_NOT_PERMITTED');
    issue(
      { fromStatus: 'PENDING_REVIEW', toStatus: 'NEEDS_CHANGES', actorType: 'customer' },
      'ACTOR_NOT_PERMITTED',
    );
    issue({ fromStatus: 'PENDING_REVIEW', toStatus: 'REJECTED', actorType: 'customer' }, 'ACTOR_NOT_PERMITTED');
  });
});

describe('re-upload after NEEDS_CHANGES', () => {
  it('lets the customer return to PENDING_REVIEW by re-uploading', () => {
    ok({ fromStatus: 'NEEDS_CHANGES', toStatus: 'PENDING_REVIEW', actorType: 'customer' });
  });

  it('does not let staff perform the re-upload transition — it is the customer\'s action', () => {
    issue(
      { fromStatus: 'NEEDS_CHANGES', toStatus: 'PENDING_REVIEW', actorType: 'staff' },
      'ACTOR_NOT_PERMITTED',
    );
  });
});

describe('illegal transitions', () => {
  it('rejects a status transitioning to itself', () => {
    issue({ fromStatus: 'PENDING_REVIEW', toStatus: 'PENDING_REVIEW', actorType: 'staff' }, 'ILLEGAL_TRANSITION');
  });

  it('rejects any transition out of APPROVED — it is terminal', () => {
    issue({ fromStatus: 'APPROVED', toStatus: 'NEEDS_CHANGES', actorType: 'staff' }, 'ILLEGAL_TRANSITION');
    issue({ fromStatus: 'APPROVED', toStatus: 'PENDING_REVIEW', actorType: 'customer' }, 'ILLEGAL_TRANSITION');
  });

  it('rejects any transition out of REJECTED — it is terminal', () => {
    issue({ fromStatus: 'REJECTED', toStatus: 'PENDING_REVIEW', actorType: 'customer' }, 'ILLEGAL_TRANSITION');
    issue({ fromStatus: 'REJECTED', toStatus: 'APPROVED', actorType: 'staff' }, 'ILLEGAL_TRANSITION');
  });

  it('rejects skipping straight from NEEDS_CHANGES to APPROVED — a re-upload must go through PENDING_REVIEW again', () => {
    issue({ fromStatus: 'NEEDS_CHANGES', toStatus: 'APPROVED', actorType: 'staff' }, 'ILLEGAL_TRANSITION');
  });
});

describe('isTerminalDesignReviewStatus', () => {
  it('is true only for APPROVED and REJECTED', () => {
    expect(isTerminalDesignReviewStatus('APPROVED')).toBe(true);
    expect(isTerminalDesignReviewStatus('REJECTED')).toBe(true);
    expect(isTerminalDesignReviewStatus('PENDING_REVIEW')).toBe(false);
    expect(isTerminalDesignReviewStatus('NEEDS_CHANGES')).toBe(false);
  });
});
