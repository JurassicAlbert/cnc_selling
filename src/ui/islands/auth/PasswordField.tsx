'use client';

import { useState } from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { VisibilityIcon, VisibilityOffIcon } from '@/ui/icons';

type PasswordFieldProps = {
  readonly autoComplete: 'current-password' | 'new-password';
  readonly error: boolean;
  readonly helperText: string | undefined;
};

/**
 * The password box, with a way to see what you typed - RWD-03.
 *
 * The owner's reference puts an eye toggle inside the field on both of its
 * auth forms. On a phone, with a small keyboard and autocorrect in the way,
 * typing a password blind is where people give up and reset it instead -
 * which costs us an email and them a detour, for a control that is two lines
 * of state.
 *
 * **One component rather than the same toggle written twice.** Sign-in and
 * registration had byte-identical fields differing only in `autoComplete`,
 * and a toggle duplicated across both is a toggle that will be fixed in one
 * of them.
 *
 * The button is `type="button"` on purpose: inside a `<form>` a bare button
 * submits, so without it revealing your password would post the form.
 *
 * `name` and `label` are fixed rather than props - both forms use the same
 * ones, and a password field that could be called something else is an
 * invitation to break the server action that reads `password` from the form
 * data.
 */
export function PasswordField({ autoComplete, error, helperText }: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <TextField
      label={SITE.authPasswordLabelPl}
      name="password"
      // The input's own `type` is what decides whether the characters are
      // readable; everything else here is decoration around that one value.
      type={revealed ? 'text' : 'password'}
      autoComplete={autoComplete}
      error={error}
      helperText={helperText}
      size="small"
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                type="button"
                onClick={() => setRevealed((current) => !current)}
                aria-label={revealed ? SITE.authHidePasswordPl : SITE.authShowPasswordPl}
                edge="end"
                size="small"
              >
                {revealed ? <VisibilityOffIcon size={20} /> : <VisibilityIcon size={20} />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
