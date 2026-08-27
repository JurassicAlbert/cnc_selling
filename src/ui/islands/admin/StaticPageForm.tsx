'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminStaticPageDetail } from '@/server/repositories/admin-static-pages';
import { createStaticPage, updateStaticPage } from '@/server/actions/admin-static-pages';
import type { StaticPageMutationResult } from '@/server/actions/admin-static-pages';

const INITIAL_STATE: StaticPageMutationResult = { ok: true, id: '' };

export function StaticPageForm({ page }: { readonly page?: AdminStaticPageDetail }) {
  const router = useRouter();

  const action = async (_prev: StaticPageMutationResult, formData: FormData) => {
    const input = {
      slug: String(formData.get('slug') ?? ''),
      titlePl: String(formData.get('titlePl') ?? ''),
      bodyPl: String(formData.get('bodyPl') ?? ''),
      seoTitlePl: String(formData.get('seoTitlePl') ?? ''),
      seoDescPl: String(formData.get('seoDescPl') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    };
    const result = page === undefined ? await createStaticPage(input) : await updateStaticPage(page.id, input);
    if (result.ok && page === undefined) {
      router.push(`/panel/strony/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField label={ADMIN.staticPageFieldSlugPl} name="slug" defaultValue={page?.slug} required size="small" />
        <TextField label={ADMIN.staticPageFieldTitlePl} name="titlePl" defaultValue={page?.titlePl} required size="small" />
        <TextField label={ADMIN.staticPageFieldBodyPl} name="bodyPl" defaultValue={page?.bodyPl} required multiline minRows={8} size="small" />
        <TextField label={ADMIN.staticPageFieldSeoTitlePl} name="seoTitlePl" defaultValue={page?.seoTitlePl} size="small" />
        <TextField label={ADMIN.staticPageFieldSeoDescPl} name="seoDescPl" defaultValue={page?.seoDescPl} multiline minRows={2} size="small" />
        <TextField label={ADMIN.staticPageFieldSortOrderPl} name="sortOrder" type="number" defaultValue={page?.sortOrder ?? 0} size="small" sx={{ maxWidth: 200 }} />

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
