'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { updateEmailTemplate } from '@/server/actions/admin-email-templates';
import type { UpdateEmailTemplateResult } from '@/server/actions/admin-email-templates';
import type { AdminEmailTemplateDetail } from '@/server/repositories/admin-email-templates';

const INITIAL_STATE: UpdateEmailTemplateResult = { ok: true };

export function EmailTemplateForm({ template, placeholders }: { readonly template: AdminEmailTemplateDetail; readonly placeholders: readonly string[] }) {
  const action = async (_prev: UpdateEmailTemplateResult, formData: FormData) => {
    return updateEmailTemplate(template.key, {
      subjectPl: String(formData.get('subjectPl') ?? ''),
      bodyPl: String(formData.get('bodyPl') ?? ''),
    });
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <Typography variant="body2" color="text.secondary">
          {ADMIN.emailTemplatePlaceholdersHintPl}: {placeholders.map((p) => `{{${p}}}`).join(', ')}
        </Typography>

        <TextField label={ADMIN.emailTemplateFieldSubjectPl} name="subjectPl" defaultValue={template.subjectPl} required size="small" />
        <TextField label={ADMIN.emailTemplateFieldBodyPl} name="bodyPl" defaultValue={template.bodyPl} required multiline minRows={6} size="small" />

        <SubmitButton />
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {ADMIN.savePl}
    </Button>
  );
}
