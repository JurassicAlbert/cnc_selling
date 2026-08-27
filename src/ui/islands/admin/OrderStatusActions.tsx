'use client';

/**
 * Status-transition buttons + the "mark paid" action for one order.
 * `candidates` is computed server-side (`checkOrderStatusTransition` run
 * against every `OrderStatus` for `actorType: 'staff'`) — this component
 * only renders what the domain's own state machine already says is legal,
 * never re-derives the graph.
 */

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';

import { ADMIN, adminOrderStatusLabel } from '@/content/pl/admin';
import type { OrderStatus } from '@/domain/order-status/transitions';
import { markOrderPaid, transitionOrderStatus } from '@/server/actions/admin-orders';
import type { MarkOrderPaidResult, TransitionOrderStatusResult } from '@/server/actions/admin-orders';

export type StatusCandidate = {
  readonly status: OrderStatus;
  /** True when the only reason this edge doesn't apply yet is the DESIGN_REVIEW gate — shown disabled with an explanation, per §16A.5 ("explain every disabled control"), rather than hidden. */
  readonly blockedByDesignReview: boolean;
};

const TRANSITION_INITIAL_STATE: TransitionOrderStatusResult = { ok: true };
const PAID_INITIAL_STATE: MarkOrderPaidResult = { ok: true };

export function OrderStatusActions({
  orderNumber,
  candidates,
  canMarkPaid,
}: {
  readonly orderNumber: string;
  readonly candidates: readonly StatusCandidate[];
  readonly canMarkPaid: boolean;
}) {
  const [noteByStatus, setNoteByStatus] = useState<Record<string, string>>({});
  const boundTransition = async (_prev: TransitionOrderStatusResult, formData: FormData) => {
    const toStatus = formData.get('toStatus') as OrderStatus;
    const notePl = formData.get('notePl');
    return transitionOrderStatus(orderNumber, toStatus, typeof notePl === 'string' && notePl.length > 0 ? notePl : null);
  };
  const [transitionState, transitionAction] = useActionState(boundTransition, TRANSITION_INITIAL_STATE);
  const boundMarkPaid = async () => markOrderPaid(orderNumber);
  const [paidState, paidAction] = useActionState(boundMarkPaid, PAID_INITIAL_STATE);

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      {!transitionState.ok && <Alert severity="error">{transitionState.detail}</Alert>}
      {!paidState.ok && <Alert severity="error">{paidState.detail}</Alert>}

      {canMarkPaid && (
        <form action={paidAction}>
          <SubmitButton label={ADMIN.orderMarkPaidPl} variant="outlined" />
        </form>
      )}

      <Stack spacing={1}>
        {candidates.map((candidate) => (
          <form key={candidate.status} action={transitionAction}>
            <input type="hidden" name="toStatus" value={candidate.status} />
            {candidate.status === 'CANCELLED' && (
              <TextField
                label={ADMIN.orderCancelNoteLabelPl}
                name="notePl"
                size="small"
                fullWidth
                sx={{ mb: 1 }}
                value={noteByStatus[candidate.status] ?? ''}
                onChange={(e) => setNoteByStatus((prev) => ({ ...prev, [candidate.status]: e.target.value }))}
              />
            )}
            {candidate.status !== 'CANCELLED' && !candidate.blockedByDesignReview && (
              <TextField
                label={ADMIN.orderTransitionNotePl}
                name="notePl"
                size="small"
                fullWidth
                sx={{ mb: 1 }}
                value={noteByStatus[candidate.status] ?? ''}
                onChange={(e) => setNoteByStatus((prev) => ({ ...prev, [candidate.status]: e.target.value }))}
              />
            )}
            <SubmitButton
              label={adminOrderStatusLabel(candidate.status)}
              variant={candidate.status === 'CANCELLED' ? 'text' : 'contained'}
              disabled={candidate.blockedByDesignReview}
              title={candidate.blockedByDesignReview ? ADMIN.orderDesignBlockedPl : undefined}
            />
            {candidate.blockedByDesignReview && (
              <Typography variant="caption" color="text.secondary" component="p">
                {ADMIN.orderDesignBlockedPl}
              </Typography>
            )}
          </form>
        ))}
      </Stack>
    </Stack>
  );
}

function SubmitButton({
  label,
  variant,
  disabled,
  title,
}: {
  readonly label: string;
  readonly variant: 'contained' | 'outlined' | 'text';
  readonly disabled?: boolean;
  readonly title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={disabled === true || pending} title={title} size="small">
      {label}
    </Button>
  );
}
