'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { inviteStaffUser } from '@/server/actions/admin-staff';
import type { InviteStaffUserResult } from '@/server/actions/admin-staff';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const INITIAL_STATE: InviteStaffUserResult = { ok: true };

export function StaffInviteForm() {
  const { capture, fieldValue, resetKey } = usePreservedFormValues();

  const action = async (_prev: InviteStaffUserResult, formData: FormData) => {
    capture(formData);
    return inviteStaffUser({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      role: formData.get('role') === 'ADMIN' ? 'ADMIN' : 'STAFF',
    });
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 400 }}>
        <Typography variant="h6">{ADMIN.staffInviteHeadingPl}</Typography>
        <Typography variant="body2" color="text.secondary">
          {ADMIN.staffInviteHintPl}
        </Typography>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField label={ADMIN.staffInviteFieldNamePl} name="name" defaultValue={fieldValue('name', '')} required size="small" />
        <TextField label={ADMIN.staffInviteFieldEmailPl} name="email" type="email" defaultValue={fieldValue('email', '')} required size="small" />
        <TextField key={resetKey} select label={ADMIN.staffInviteFieldRolePl} name="role" defaultValue={fieldValue('role', 'STAFF')} size="small">
          <MenuItem value="STAFF">{ADMIN.staffRoleStaffPl}</MenuItem>
          <MenuItem value="ADMIN">{ADMIN.staffRoleAdminPl}</MenuItem>
        </TextField>

        <SubmitButton />
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {ADMIN.staffInviteSubmitPl}
    </Button>
  );
}
