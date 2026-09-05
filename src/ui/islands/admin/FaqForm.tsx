'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminFaqDetail } from '@/server/repositories/admin-faq';
import { createFaq, updateFaq } from '@/server/actions/admin-faq';
import type { FaqMutationResult } from '@/server/actions/admin-faq';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const INITIAL_STATE: FaqMutationResult = { ok: true, id: '' };

export function FaqForm({ faq }: { readonly faq?: AdminFaqDetail }) {
  const router = useRouter();
  const { capture, fieldValue } = usePreservedFormValues();

  const action = async (_prev: FaqMutationResult, formData: FormData) => {
    capture(formData);
    const input = {
      questionPl: String(formData.get('questionPl') ?? ''),
      answerPl: String(formData.get('answerPl') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    };
    const result = faq === undefined ? await createFaq(input) : await updateFaq(faq.id, input);
    if (result.ok && faq === undefined) {
      router.push(`/panel/faq/${result.id}`);
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 640 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <TextField label={ADMIN.faqFieldQuestionPl} name="questionPl" defaultValue={fieldValue('questionPl', faq?.questionPl)} required size="small" />
        <TextField
          label={ADMIN.faqFieldAnswerPl}
          name="answerPl"
          defaultValue={fieldValue('answerPl', faq?.answerPl)}
          required
          multiline
          minRows={3}
          size="small"
        />
        <TextField
          label={ADMIN.faqFieldSortOrderPl}
          name="sortOrder"
          type="number"
          defaultValue={fieldValue('sortOrder', String(faq?.sortOrder ?? 0))}
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
