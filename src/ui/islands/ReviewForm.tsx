'use client';

/**
 * Shared review-submission form for both entry points (guest confirmation
 * page, logged-in order-history page) — the page binds the right Server
 * Action (`submitGuestReview`/`submitAccountReview`, both
 * `src/server/actions/reviews.ts`) and passes it in, so this component
 * itself never knows or cares which context it's in.
 */

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { SITE } from '@/content/pl/site';
import type { SubmitReviewResult } from '@/server/actions/reviews';

const INITIAL_STATE: SubmitReviewResult = { ok: true };

export function ReviewForm({ action }: { readonly action: (formData: FormData) => Promise<SubmitReviewResult> }) {
  // `useActionState`'s initial state is also `{ ok: true }` — a plain
  // `submitted` flag is what actually distinguishes "hasn't been
  // submitted yet" from "just submitted successfully."
  const [submitted, setSubmitted] = useState(false);
  const [state, formAction] = useActionState(async (_prev: SubmitReviewResult, formData: FormData) => {
    const result = await action(formData);
    if (result.ok) {
      setSubmitted(true);
    }
    return result;
  }, INITIAL_STATE);

  if (submitted) {
    return <p style={{ marginBlockStart: 16 }}>{SITE.reviewFormThankYouPl}</p>;
  }

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480, marginBlockStart: 16 }}>
      <div style={{ font: 'var(--mui-font-h6)' }}>{SITE.reviewFormHeadingPl}</div>

      {!state.ok && <p style={{ color: 'var(--mui-palette-primary-main)' }}>{state.detail}</p>}

      <label style={{ display: 'block' }}>
        {SITE.reviewFormAuthorNameLabelPl}
        <input type="text" name="authorNamePl" required style={{ display: 'block', width: '100%' }} />
      </label>

      <label style={{ display: 'block' }}>
        {SITE.reviewFormRatingLabelPl}
        <select name="rating" defaultValue="5" style={{ display: 'block', width: '100%' }}>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'block' }}>
        {SITE.reviewFormBodyLabelPl}
        <textarea name="bodyPl" required rows={4} style={{ display: 'block', width: '100%' }} />
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        font: 'var(--mui-font-button)',
        padding: '10px 20px',
        background: 'var(--mui-palette-primary-main)',
        color: 'var(--mui-palette-background-paper)',
        border: 'none',
        borderRadius: 2,
        cursor: 'pointer',
        alignSelf: 'flex-start',
      }}
    >
      {SITE.reviewFormSubmitPl}
    </button>
  );
}
