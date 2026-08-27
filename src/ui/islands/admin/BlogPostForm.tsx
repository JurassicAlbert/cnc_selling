'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminBlogPostDetail } from '@/server/repositories/admin-blog';
import { createBlogPost, updateBlogPost } from '@/server/actions/admin-blog';
import type { BlogPostMutationResult } from '@/server/actions/admin-blog';

const INITIAL_STATE: BlogPostMutationResult = { ok: true, id: '' };

function toDateInputValue(date: Date | null): string {
  return date === null ? '' : date.toISOString().slice(0, 10);
}

export function BlogPostForm({ post }: { readonly post?: AdminBlogPostDetail }) {
  const router = useRouter();

  const action = async (_prev: BlogPostMutationResult, formData: FormData) => {
    const imageUrl = String(formData.get('imageUrl') ?? '').trim();
    const publishedAtRaw = String(formData.get('publishedAt') ?? '').trim();
    const input = {
      slug: String(formData.get('slug') ?? ''),
      titlePl: String(formData.get('titlePl') ?? ''),
      shortDescPl: String(formData.get('shortDescPl') ?? ''),
      bodyPl: String(formData.get('bodyPl') ?? ''),
      seoTitlePl: String(formData.get('seoTitlePl') ?? ''),
      seoDescPl: String(formData.get('seoDescPl') ?? ''),
      imageUrl: imageUrl.length > 0 ? imageUrl : null,
      sortOrder: Number(formData.get('sortOrder') ?? 0),
      publishedAt: publishedAtRaw.length > 0 ? new Date(`${publishedAtRaw}T00:00:00.000Z`) : null,
    };
    const result = post === undefined ? await createBlogPost(input) : await updateBlogPost(post.id, input);
    if (result.ok && post === undefined) {
      router.push(`/panel/blog/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 720 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField label={ADMIN.blogPostFieldSlugPl} name="slug" defaultValue={post?.slug} required size="small" />
        <TextField label={ADMIN.blogPostFieldTitlePl} name="titlePl" defaultValue={post?.titlePl} required size="small" />
        <TextField
          label={ADMIN.blogPostFieldShortDescPl}
          name="shortDescPl"
          defaultValue={post?.shortDescPl}
          required
          multiline
          minRows={2}
          size="small"
        />
        <TextField label={ADMIN.blogPostFieldBodyPl} name="bodyPl" defaultValue={post?.bodyPl} required multiline minRows={10} size="small" />
        <TextField label={ADMIN.blogPostFieldSeoTitlePl} name="seoTitlePl" defaultValue={post?.seoTitlePl} size="small" />
        <TextField label={ADMIN.blogPostFieldSeoDescPl} name="seoDescPl" defaultValue={post?.seoDescPl} multiline minRows={2} size="small" />
        <TextField label={ADMIN.blogPostFieldImageUrlPl} name="imageUrl" defaultValue={post?.imageUrl ?? ''} size="small" />
        <TextField
          label={ADMIN.blogPostFieldSortOrderPl}
          name="sortOrder"
          type="number"
          defaultValue={post?.sortOrder ?? 0}
          size="small"
          sx={{ maxWidth: 200 }}
        />

        <TextField
          label={ADMIN.blogPostFieldPublishedAtPl}
          name="publishedAt"
          type="date"
          defaultValue={toDateInputValue(post?.publishedAt ?? null)}
          size="small"
          sx={{ maxWidth: 220 }}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Typography variant="caption" color="text.secondary">
          {ADMIN.blogPostPublishedAtHintPl}
        </Typography>

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
