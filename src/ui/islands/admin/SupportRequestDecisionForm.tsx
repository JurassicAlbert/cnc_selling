'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, MenuItem, Stack, TextField } from '@mui/material';

import { ADMIN, adminSupportRequestStatusLabel } from '@/content/pl/admin';
import { updateSupportRequest } from '@/server/actions/admin-support-requests';
import type { SupportRequestMutationResult } from '@/server/actions/admin-support-requests';
import type { SupportRequestStatus } from '@/generated/prisma/enums';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const STATUSES: readonly SupportRequestStatus[] = ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const INITIAL_STATE: SupportRequestMutationResult = { ok: true };

export function SupportRequestDecisionForm({
  id,
  status,
  adminNotesPl,
}: {
  readonly id: string;
  readonly status: SupportRequestStatus;
  readonly adminNotesPl: string | null;
}) {
  const { capture, fieldValue, resetKey } = usePreservedFormValues();

  const action = async (_prev: SupportRequestMutationResult, formData: FormData) => {
    capture(formData);
    return updateSupportRequest(id, formData);
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ mt: 3, maxWidth: 480 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField
          key={resetKey}
          select
          label={ADMIN.supportRequestFieldStatusPl}
          name="status"
          defaultValue={fieldValue('status', status)}
          size="small"
        >
          {STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {adminSupportRequestStatusLabel(s)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label={ADMIN.supportRequestFieldAdminNotesPl}
          name="adminNotesPl"
          defaultValue={fieldValue('adminNotesPl', adminNotesPl ?? '')}
          size="small"
          multiline
          minRows={3}
        />

        <SubmitButton />
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {ADMIN.supportRequestSavePl}
    </Button>
  );
}
