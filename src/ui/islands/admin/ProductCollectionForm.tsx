'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminProductCollectionDetail } from '@/server/repositories/admin-product-collections';
import { createProductCollection, updateProductCollection } from '@/server/actions/admin-product-collections';
import type { ProductCollectionMutationResult } from '@/server/actions/admin-product-collections';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const INITIAL_STATE: ProductCollectionMutationResult = { ok: true, id: '' };

export function ProductCollectionForm({ collection }: { readonly collection?: AdminProductCollectionDetail }) {
  const router = useRouter();
  const { capture, fieldValue } = usePreservedFormValues();

  const action = async (_prev: ProductCollectionMutationResult, formData: FormData) => {
    capture(formData);
    const input = {
      slug: String(formData.get('slug') ?? ''),
      namePl: String(formData.get('namePl') ?? ''),
      descPl: String(formData.get('descPl') ?? ''),
      imageUrl: String(formData.get('imageUrl') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    };
    const result = collection === undefined ? await createProductCollection(input) : await updateProductCollection(collection.id, input);
    if (result.ok && collection === undefined) {
      router.push(`/panel/kolekcje-produktow/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField
          label={ADMIN.productCollectionFieldSlugPl}
          name="slug"
          defaultValue={fieldValue('slug', collection?.slug)}
          required
          size="small"
        />
        <TextField label={ADMIN.productCollectionFieldNamePl} name="namePl" defaultValue={fieldValue('namePl', collection?.namePl)} required size="small" />
        <TextField
          label={ADMIN.productCollectionFieldDescPl}
          name="descPl"
          defaultValue={fieldValue('descPl', collection?.descPl)}
          required
          multiline
          minRows={3}
          size="small"
        />
        <TextField
          label={ADMIN.productCollectionFieldImageUrlPl}
          name="imageUrl"
          defaultValue={fieldValue('imageUrl', collection?.imageUrl ?? '')}
          size="small"
          placeholder="/images/…"
        />
        <TextField
          label={ADMIN.productCollectionFieldSortOrderPl}
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
