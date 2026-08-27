'use client';

import { useActionState, useId, useState } from 'react';
import { Alert, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { anonymizeCustomer } from '@/server/actions/admin-customers';
import type { AnonymizeCustomerResult } from '@/server/actions/admin-customers';
import { ConfirmSubmitButton } from '@/ui/primitives/ConfirmSubmitButton';

const INITIAL_STATE: AnonymizeCustomerResult = { ok: true };

export function CustomerAnonymizeForm({ customerId }: { readonly customerId: string }) {
  const [note, setNote] = useState('');
  const formId = useId();
  const boundAnonymize = async (_prev: AnonymizeCustomerResult, formData: FormData) => {
    const notePl = String(formData.get('notePl') ?? '');
    return anonymizeCustomer(customerId, notePl);
  };
  const [state, formAction] = useActionState(boundAnonymize, INITIAL_STATE);

  return (
    <Stack spacing={2} sx={{ maxWidth: 480 }}>
      <Typography variant="body2" color="text.secondary">
        {ADMIN.customerAnonymizeWarningPl}
      </Typography>
      {!state.ok && <Alert severity="error">{state.detail}</Alert>}
      <form id={formId} action={formAction}>
        <Stack spacing={2}>
          <TextField
            label={ADMIN.customerAnonymizeNoteLabelPl}
            name="notePl"
            required
            size="small"
            fullWidth
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <ConfirmSubmitButton
            label={ADMIN.customerAnonymizeButtonPl}
            confirmTitle={ADMIN.customerAnonymizeConfirmTitlePl}
            confirmMessage={ADMIN.customerAnonymizeConfirmMessagePl}
            confirmLabel={ADMIN.customerAnonymizeConfirmButtonPl}
            cancelLabel={ADMIN.cancelPl}
            color="error"
            disabled={note.trim().length === 0}
            formId={formId}
          />
        </Stack>
      </form>
    </Stack>
  );
}
