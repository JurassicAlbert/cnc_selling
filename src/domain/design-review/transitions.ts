/**
 * Customer-design review transitions — `ARCHITECTURE.md` §13.3's diagram,
 * encoded the same way `domain/order-status/transitions.ts` encodes the
 * order graph (that file's shape is copied here deliberately, not
 * reinvented):
 *
 * ```
 * PENDING_REVIEW ──approve──▶ APPROVED
 *       │
 *       ├──request changes──▶ NEEDS_CHANGES ──customer re-uploads──▶ PENDING_REVIEW
 *       │
 *       └──reject──────────▶ REJECTED (terminal)
 * ```
 *
 * `fromStatus: null` is the creation event — a customer's own upload
 * starts a design at `PENDING_REVIEW` (`CustomerDesign.status`'s schema
 * default), the same way `OrderEvent.fromStatus: null` represents order
 * creation. Only the edges the diagram actually draws exist here:
 * `APPROVED` has no outgoing edge in the spec, so it's terminal in this
 * function exactly like `REJECTED` — if a future phase needs to revoke
 * an approval, that is a new, deliberate edge to add then, not something
 * to guess at now.
 */

export type DesignReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED';

/** Matches `DesignReviewComment.authorType` ("staff" | "customer") — no `system` actor exists in this graph, unlike order status. */
export type DesignReviewActorType = 'staff' | 'customer';

export type DesignReviewTransitionInput = {
  /** `null` means this is the design's initial upload. */
  readonly fromStatus: DesignReviewStatus | null;
  readonly toStatus: DesignReviewStatus;
  readonly actorType: DesignReviewActorType;
};

export type DesignReviewTransitionIssueCode = 'ILLEGAL_TRANSITION' | 'ACTOR_NOT_PERMITTED';

export type DesignReviewTransitionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: DesignReviewTransitionIssueCode; readonly detail: string };

type Edge = {
  readonly from: DesignReviewStatus | null;
  readonly to: DesignReviewStatus;
  readonly actors: readonly DesignReviewActorType[];
};

const EDGES: readonly Edge[] = [
  // Creation: a customer's own upload always starts PENDING_REVIEW.
  { from: null, to: 'PENDING_REVIEW', actors: ['customer'] },

  // Staff decisions on a pending design.
  { from: 'PENDING_REVIEW', to: 'APPROVED', actors: ['staff'] },
  { from: 'PENDING_REVIEW', to: 'NEEDS_CHANGES', actors: ['staff'] },
  { from: 'PENDING_REVIEW', to: 'REJECTED', actors: ['staff'] },

  // Only the customer can act on NEEDS_CHANGES, by re-uploading.
  { from: 'NEEDS_CHANGES', to: 'PENDING_REVIEW', actors: ['customer'] },

  // APPROVED and REJECTED are terminal: no edges leave them.
];

const TERMINAL_STATUSES: ReadonlySet<DesignReviewStatus> = new Set(['APPROVED', 'REJECTED']);

export function isTerminalDesignReviewStatus(status: DesignReviewStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function checkDesignReviewTransition(
  input: DesignReviewTransitionInput,
): DesignReviewTransitionResult {
  const { fromStatus, toStatus, actorType } = input;

  const edge = EDGES.find((candidate) => candidate.from === fromStatus && candidate.to === toStatus);

  if (edge === undefined) {
    return {
      ok: false,
      code: 'ILLEGAL_TRANSITION',
      detail: `${fromStatus ?? '(creation)'} -> ${toStatus} is not a legal design-review transition`,
    };
  }

  if (!edge.actors.includes(actorType)) {
    return {
      ok: false,
      code: 'ACTOR_NOT_PERMITTED',
      detail: `actor "${actorType}" may not move a design from ${fromStatus ?? '(creation)'} to ${toStatus}`,
    };
  }

  return { ok: true };
}
