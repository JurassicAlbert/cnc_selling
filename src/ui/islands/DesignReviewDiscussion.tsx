'use client';

/**
 * P9 continuation, 2026-08-28 — the customer-facing half of the design
 * review "dyskusja". The read side already existed
 * (`design-review.ts`'s `requireOwnedDesignStatus`, unused until now); this
 * island is the reply form, calling the new `postCustomerDesignComment`
 * action. `router.refresh()` picks up the new comment from the Server
 * Component parent, same shape as `CustomerDesignUploadForm.tsx`.
 */

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { postCustomerDesignComment } from '@/server/actions/design-review';

export function DesignReviewDiscussion({ customerDesignId }: { readonly customerDesignId: string }) {
  const router = useRouter();
  const [bodyPl, setBodyPl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (bodyPl.trim().length === 0) {
      setError(SITE.designDetailReplyEmptyErrorPl);
      return;
    }
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set('bodyPl', bodyPl);
    const result = await postCustomerDesignComment(customerDesignId, formData);
    setPending(false);
    if (!result.ok) {
      setError(SITE.designDetailReplyErrorPl);
      return;
    }
    setBodyPl('');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack spacing={2} sx={{ maxWidth: 480 }}>
        {error !== null && <Alert severity="error">{error}</Alert>}
        <TextField
          label={SITE.designDetailReplyLabelPl}
          value={bodyPl}
          onChange={(event) => setBodyPl(event.target.value)}
          multiline
          minRows={3}
          fullWidth
        />
        <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
          {SITE.designDetailReplySubmitPl}
        </Button>
      </Stack>
    </form>
  );
}
