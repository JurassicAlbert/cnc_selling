'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminExternalPatternResourceDetail } from '@/server/repositories/admin-external-pattern-resources';
import { createExternalPatternResource, updateExternalPatternResource } from '@/server/actions/admin-external-pattern-resources';
import type { ExternalPatternResourceMutationResult } from '@/server/actions/admin-external-pattern-resources';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const INITIAL_STATE: ExternalPatternResourceMutationResult = { ok: true, id: '' };

export function ExternalPatternResourceForm({ resource }: { readonly resource?: AdminExternalPatternResourceDetail }) {
  const router = useRouter();
  const { capture, fieldValue } = usePreservedFormValues();

  const action = async (_prev: ExternalPatternResourceMutationResult, formData: FormData) => {
    capture(formData);
    const input = {
      namePl: String(formData.get('namePl') ?? ''),
      url: String(formData.get('url') ?? ''),
      descPl: String(formData.get('descPl') ?? ''),
      sourceLabel: String(formData.get('sourceLabel') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    };
    const result = resource === undefined ? await createExternalPatternResource(input) : await updateExternalPatternResource(resource.id, input);
    if (result.ok && resource === undefined) {
      router.push(`/panel/zasoby-zewnetrzne/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField
          label={ADMIN.externalPatternResourcesFieldNamePl}
          name="namePl"
          defaultValue={fieldValue('namePl', resource?.namePl)}
          required
          size="small"
        />
        <TextField
          label={ADMIN.externalPatternResourcesFieldUrlPl}
          name="url"
          type="url"
          defaultValue={fieldValue('url', resource?.url)}
          required
          size="small"
          placeholder="https://…"
        />
        <TextField
          label={ADMIN.externalPatternResourcesFieldSourceLabelPl}
          name="sourceLabel"
          defaultValue={fieldValue('sourceLabel', resource?.sourceLabel)}
          required
          size="small"
        />
        <TextField
          label={ADMIN.externalPatternResourcesFieldDescPl}
          name="descPl"
          defaultValue={fieldValue('descPl', resource?.descPl ?? '')}
          multiline
          minRows={2}
          size="small"
        />
        <TextField
          label={ADMIN.externalPatternResourcesFieldSortOrderPl}
          name="sortOrder"
          type="number"
          defaultValue={fieldValue('sortOrder', String(resource?.sortOrder ?? 0))}
          size="small"
          sx={{ maxWidth: 200 }}
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
      {ADMIN.savePl}
    </Button>
  );
}
