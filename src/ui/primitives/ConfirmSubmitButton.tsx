'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';

type BaseProps = {
  readonly label: string;
  readonly confirmTitle: string;
  readonly confirmMessage: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly variant?: 'contained' | 'outlined' | 'text';
  readonly color?: 'primary' | 'error' | 'warning';
  readonly disabled?: boolean;
  readonly title?: string;
};

type ConfirmSubmitButtonProps = BaseProps &
  (
    | {
        /** The `id` of the `<form action={...}>` this button's dialog submits. Use this mode for a real Server Action form — the dialog's confirm button is a plain `type="submit" form={formId}` (MUI's `Dialog` portals to `document.body`, so it's never a DOM descendant of the form it submits; `form={id}` is the standard HTML mechanism for that). */
        readonly formId: string;
        readonly onConfirm?: never;
        readonly pending?: never;
      }
    | {
        /** For an action that isn't a plain form submission (e.g. one that also drives client-side state) — called when the user confirms; the caller owns its own pending state. */
        readonly onConfirm: () => void;
        readonly pending: boolean;
        readonly formId?: never;
      }
  );

/**
 * A real MUI confirmation dialog for irreversible actions — `docs/CHECKLIST.md`
 * / `ARCHITECTURE.md` §16A.5: "Confirmation dialogs only for irreversible
 * actions." Before this, the one call site that needed one (publishing a
 * pricing version) used a bare `window.confirm()` as an honestly-documented
 * placeholder, and two others (customer anonymization, order cancellation —
 * both genuinely terminal, no domain path back) had no confirmation step
 * at all.
 *
 * Two modes: `formId` keeps a real `<form action={serverAction}>`
 * submission (see that prop's own comment for how a portaled dialog button
 * still submits a form it isn't nested inside); `onConfirm` is for the one
 * call site (`PricingSimulator`) that already drives its own client-side
 * pending/error state around a direct Server Action call rather than a
 * plain form.
 */
export function ConfirmSubmitButton(props: ConfirmSubmitButtonProps) {
  const { label, confirmTitle, confirmMessage, confirmLabel, cancelLabel, variant = 'contained', color, disabled = false, title } = props;
  const [open, setOpen] = useState(false);
  const formStatus = useFormStatus();
  const pending = props.formId !== undefined ? formStatus.pending : props.pending;

  return (
    <>
      <Button type="button" variant={variant} color={color} disabled={disabled || pending} title={title} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{confirmTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmMessage}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{cancelLabel}</Button>
          {props.formId !== undefined ? (
            <Button type="submit" form={props.formId} variant="contained" color={color ?? 'primary'} onClick={() => setOpen(false)} autoFocus>
              {confirmLabel}
            </Button>
          ) : (
            <Button
              type="button"
              variant="contained"
              color={color ?? 'primary'}
              autoFocus
              onClick={() => {
                setOpen(false);
                props.onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
