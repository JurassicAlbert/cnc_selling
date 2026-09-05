'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminCollectionDetail } from '@/server/repositories/admin-designs';
import { createCollection, updateCollection } from '@/server/actions/admin-designs';
import type { CollectionMutationResult } from '@/server/actions/admin-designs';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const INITIAL_STATE: CollectionMutationResult = { ok: true, id: '' };

export function CollectionForm({ collection }: { readonly collection?: AdminCollectionDetail }) {
  const router = useRouter();
  const { capture, fieldValue } = usePreservedFormValues();

  const action = async (_prev: CollectionMutationResult, formData: FormData) => {
    capture(formData);
    const input = {
      slug: String(formData.get('slug') ?? ''),
      namePl: String(formData.get('namePl') ?? ''),
      descPl: String(formData.get('descPl') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    };
    const result = collection === undefined ? await createCollection(input) : await updateCollection(collection.id, input);
    if (result.ok && collection === undefined) {
      router.push(`/panel/kolekcje/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField label={ADMIN.collectionFieldSlugPl} name="slug" defaultValue={fieldValue('slug', collection?.slug)} required size="small" />
        <TextField label={ADMIN.collectionFieldNamePl} name="namePl" defaultValue={fieldValue('namePl', collection?.namePl)} required size="small" />
        <TextField
          label={ADMIN.collectionFieldDescPl}
          name="descPl"
          defaultValue={fieldValue('descPl', collection?.descPl)}
          multiline
          minRows={3}
          size="small"
        />
        <TextField
          label={ADMIN.collectionFieldSortOrderPl}
          name="sortOrder"
          type="number"
          defaultValue={fieldValue('sortOrder', String(collection?.sortOrder ?? 0))}
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
