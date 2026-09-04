import type { ReactNode } from 'react';
import { Card, CardContent, Divider, Typography } from '@mui/material';

/**
 * 2026-08-28, owner feedback: admin forms are "pełno vanilla tekstu przez
 * który UX jest gorsze" (full of vanilla text making the UX worse) - every
 * multi-section admin form (`ProductForm.tsx` and its siblings) rendered
 * each section as a bare `Typography variant="subtitle1"` floating above a
 * long, undifferentiated stack of fields, no card boundary, no visual
 * separation between sections beyond the label text itself.
 *
 * A real, reusable Card-per-section wrapper - `panel/layout.tsx`'s own
 * header comment already calls the admin shell "an explicit Materio-style
 * bento dashboard"; this is what makes a form actually read as bento
 * cards instead of one long scroll. Deliberately a plain Server-Component-
 * safe function (no `'use client'`, no hooks) - every admin form using it
 * is already a client component itself, so this just needs to be
 * importable from one.
 */
export function AdminFormSection({ heading, children }: { readonly heading: string; readonly children: ReactNode }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          {heading}
        </Typography>
        <Divider sx={{ mb: 2.5 }} />
        {children}
      </CardContent>
    </Card>
  );
}
