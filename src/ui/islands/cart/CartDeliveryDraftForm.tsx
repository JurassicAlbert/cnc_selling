'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Grid, Paper, Stack, TextField, Typography } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { saveCartDeliveryDraft } from '@/server/actions/cart-delivery-draft';
import type { SaveCartDeliveryDraftResult } from '@/server/actions/cart-delivery-draft';
import type { CartDeliveryDraft } from '@/server/repositories/cart';

const INITIAL: SaveCartDeliveryDraftResult = { ok: true };

/**
 * The address and note a customer can give on the cart page - owner request,
 * 2026-09-04: "podania pełnego adresu razem z komentarzem", the way the
 * reference layout's cart carries a comments box and a shipping panel.
 *
 * **It is not a second checkout.** What it saves is a draft on the cart, and
 * the order form on the next page starts pre-filled from it. That is the
 * whole reason it exists: a cart that collects an address and then makes
 * someone type it again is theatre - it looks like progress and produces
 * none - and the copy says plainly that nothing here is binding yet.
 *
 * Nothing is validated on the way in, deliberately. This is saved while
 * somebody is still typing, so refusing a half-finished postcode would make
 * the form unusable; `createOrder`'s validation is unchanged and runs on
 * what is actually submitted at checkout.
 *
 * `'use client'` for `useActionState`'s success and error feedback, which is
 * the one thing this form genuinely needs that a plain Server Action form
 * cannot give. Every field is uncontrolled, so the draft seeds the first
 * render and the customer owns them after that.
 */
export function CartDeliveryDraftForm({ draft }: { readonly draft: CartDeliveryDraft }) {
  const [saved, setSaved] = useState(false);
  const action = async (_prev: SaveCartDeliveryDraftResult, formData: FormData) => {
    const result = await saveCartDeliveryDraft({
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      firstName: String(formData.get('firstName') ?? ''),
      lastName: String(formData.get('lastName') ?? ''),
      street: String(formData.get('street') ?? ''),
      postalCode: String(formData.get('postalCode') ?? ''),
      city: String(formData.get('city') ?? ''),
      courierNotePl: String(formData.get('courierNotePl') ?? ''),
    });
    setSaved(result.ok);
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL);

  // Same borderless, softly-shadowed surface as the item cards - see
  // `SOFT_CARD` in `CartContents.tsx` for why the outline went.
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3,
        bgcolor: 'background.paper',
        boxShadow: '0 1px 2px rgba(60, 42, 25, 0.05), 0 4px 16px rgba(60, 42, 25, 0.05)',
      }}
    >
      <form action={formAction}>
        <Stack spacing={2}>
          <div>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {SITE.cartDeliveryHeadingPl}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {SITE.cartDeliveryIntroPl}
            </Typography>
          </div>

          {!state.ok && (
            <Alert severity="error">
              {state.code === 'TOO_LONG' ? SITE.cartDeliveryTooLongPl : SITE.cartDeliveryErrorPl}
            </Alert>
          )}
          {state.ok && saved && <Alert severity="success">{SITE.cartDeliverySavedPl}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={SITE.cartDeliveryFirstNamePl}
                name="firstName"
                defaultValue={draft.firstName ?? ''}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={SITE.cartDeliveryLastNamePl}
                name="lastName"
                defaultValue={draft.lastName ?? ''}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={SITE.cartDeliveryEmailPl}
                name="email"
                type="email"
                defaultValue={draft.email ?? ''}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label={SITE.cartDeliveryPhonePl}
                name="phone"
                type="tel"
                defaultValue={draft.phone ?? ''}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label={SITE.cartDeliveryStreetPl}
                name="street"
                defaultValue={draft.street ?? ''}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label={SITE.cartDeliveryPostalCodePl}
                name="postalCode"
                defaultValue={draft.postalCode ?? ''}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 7 }}>
              <TextField
                label={SITE.cartDeliveryCityPl}
                name="city"
                defaultValue={draft.city ?? ''}
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>

          <TextField
            label={SITE.cartDeliveryNotePl}
            name="courierNotePl"
            defaultValue={draft.courierNotePl ?? ''}
            helperText={SITE.cartDeliveryNoteHelperPl}
            size="small"
            multiline
            minRows={3}
            fullWidth
          />

          <SaveButton />
        </Stack>
      </form>
    </Paper>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outlined" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {SITE.cartDeliverySavePl}
    </Button>
  );
}
