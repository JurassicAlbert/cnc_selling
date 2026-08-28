'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';

import { ADMIN, adminProductionMethodLabel } from '@/content/pl/admin';
import type { DesignReviewDecision } from '@/server/actions/admin-design-review';
import { decideDesignReview } from '@/server/actions/admin-design-review';
import type { DecideDesignReviewResult } from '@/server/actions/admin-design-review';
import type { ProductionMethod } from '@/generated/prisma/enums';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const PRODUCTION_METHODS: readonly ProductionMethod[] = [
  'CNC_CARVE',
  'CNC_ENGRAVE',
  'LASER_ENGRAVE',
  'MIXED',
  'MANUAL_PREP',
];

const INITIAL_STATE: DecideDesignReviewResult = { ok: true };

export function DesignReviewDecisionForm({ designId }: { readonly designId: string }) {
  const { capture, fieldValue, resetKey } = usePreservedFormValues();

  const action = async (_prev: DecideDesignReviewResult, formData: FormData) => {
    capture(formData);
    const decision = formData.get('decision') as DesignReviewDecision;
    const productionMethod = formData.get('productionMethod');
    const commentPl = formData.get('commentPl');
    return decideDesignReview(
      designId,
      decision,
      typeof productionMethod === 'string' && productionMethod.length > 0 ? (productionMethod as ProductionMethod) : null,
      typeof commentPl === 'string' && commentPl.length > 0 ? commentPl : null,
    );
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ mt: 2, maxWidth: 480 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField label={ADMIN.designReviewCommentLabelPl} name="commentPl" defaultValue={fieldValue('commentPl', '')} multiline minRows={2} />

        <TextField
          key={resetKey}
          select
          label={ADMIN.designReviewProductionMethodLabelPl}
          name="productionMethod"
          defaultValue={fieldValue('productionMethod', '')}
        >
          <MenuItem value="">—</MenuItem>
          {PRODUCTION_METHODS.map((method) => (
            <MenuItem key={method} value={method}>
              {adminProductionMethodLabel(method)}
            </MenuItem>
          ))}
        </TextField>

        <Stack direction="row" spacing={1}>
          <DecisionButton decision="APPROVED" label={ADMIN.designReviewApprovePl} variant="contained" />
          <DecisionButton decision="NEEDS_CHANGES" label={ADMIN.designReviewRequestChangesPl} variant="outlined" />
          <DecisionButton decision="REJECTED" label={ADMIN.designReviewRejectPl} variant="text" />
        </Stack>
      </Stack>
    </form>
  );
}

function DecisionButton({
  decision,
  label,
  variant,
}: {
  readonly decision: DesignReviewDecision;
  readonly label: string;
  readonly variant: 'contained' | 'outlined' | 'text';
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="decision" value={decision} variant={variant} disabled={pending} size="small">
      {label}
    </Button>
  );
}
