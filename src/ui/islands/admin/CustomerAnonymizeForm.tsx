'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { anonymizeCustomer } from '@/server/actions/admin-customers';
import type { AnonymizeCustomerResult } from '@/server/actions/admin-customers';

const INITIAL_STATE: AnonymizeCustomerResult = { ok: true };

export function CustomerAnonymizeForm({ customerId }: { readonly customerId: string }) {
  const [note, setNote] = useState('');
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
      <form action={formAction}>
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
          <SubmitButton disabled={note.trim().length === 0} />
        </Stack>
      </form>
    </Stack>
  );
}

function SubmitButton({ disabled }: { readonly disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" color="error" disabled={disabled || pending} sx={{ alignSelf: 'flex-start' }}>
      {ADMIN.customerAnonymizeButtonPl}
    </Button>
  );
}
