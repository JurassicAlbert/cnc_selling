'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminCategoryDetail } from '@/server/repositories/admin-categories';
import { createCategory, updateCategory } from '@/server/actions/admin-categories';
import type { CategoryMutationResult } from '@/server/actions/admin-categories';

const INITIAL_STATE: CategoryMutationResult = { ok: true, id: '' };

export function CategoryForm({ category }: { readonly category?: AdminCategoryDetail }) {
  const router = useRouter();

  const action = async (_prev: CategoryMutationResult, formData: FormData) => {
    const input = {
      slug: String(formData.get('slug') ?? ''),
      namePl: String(formData.get('namePl') ?? ''),
      descPl: String(formData.get('descPl') ?? ''),
      seoTitlePl: String(formData.get('seoTitlePl') ?? ''),
      seoDescPl: String(formData.get('seoDescPl') ?? ''),
      imageUrl: String(formData.get('imageUrl') ?? '').trim().length > 0 ? String(formData.get('imageUrl')) : null,
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    };
    const result = category === undefined ? await createCategory(input) : await updateCategory(category.id, input);
    if (result.ok && category === undefined) {
      router.push(`/panel/kategorie/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField label={ADMIN.categoryFieldSlugPl} name="slug" defaultValue={category?.slug} required size="small" />
        <TextField label={ADMIN.categoryFieldNamePl} name="namePl" defaultValue={category?.namePl} required size="small" />
        <TextField
          label={ADMIN.categoryFieldDescPl}
          name="descPl"
          defaultValue={category?.descPl}
          multiline
          minRows={3}
          size="small"
        />
        <TextField label={ADMIN.categoryFieldSeoTitlePl} name="seoTitlePl" defaultValue={category?.seoTitlePl} size="small" />
        <TextField
          label={ADMIN.categoryFieldSeoDescPl}
          name="seoDescPl"
          defaultValue={category?.seoDescPl}
          multiline
          minRows={2}
          size="small"
        />
        <TextField label={ADMIN.categoryFieldImageUrlPl} name="imageUrl" defaultValue={category?.imageUrl ?? ''} size="small" />
        <TextField
          label={ADMIN.categoryFieldSortOrderPl}
          name="sortOrder"
          type="number"
          defaultValue={category?.sortOrder ?? 0}
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
