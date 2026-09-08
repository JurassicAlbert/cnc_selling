'use client';

/**
 * The navbar's account control: a login form in a dialog.
 *
 * Owner request, 2026-09-06, pointing at `template.getbazaar.io` - "logowanie
 * to modal, rejestracja osobna podstrona". Checked against the reference
 * rather than guessed: its account icon opens a centred dialog holding the
 * password form, with registration a link out to its own page.
 *
 * **A real link first, a dialog second.** The trigger is an `<a
 * href="/logowanie">` and the handler only takes over when JavaScript is
 * there to open the dialog - so without it, or before hydration (a real
 * window on a slow connection), the control still goes somewhere useful.
 * `/logowanie` keeps working as a page for its own sake anyway: the session
 * gate redirects there with `?next=`, and several e2e journeys sign in
 * through it directly.
 *
 * **Better labelled than the reference.** Bazaar's dialog is
 * `role="presentation"` with no `aria-modal` and no accessible name, which
 * would fail `accessibility.spec.ts`'s "nothing interactive is left without an
 * accessible name" outright. MUI's `Dialog` gives a real `dialog` role, focus
 * trapping and Escape-to-close; `aria-labelledby` points at the heading so a
 * screen reader announces what opened.
 */

import { useState } from 'react';
import type { MouseEvent } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTitle, IconButton } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { CloseIcon, PersonIcon } from '@/ui/icons';
import { LoginForm } from '@/ui/islands/auth/LoginForm';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

const TITLE_ID = 'login-dialog-title';

export function LoginDialog() {
  const [open, setOpen] = useState(false);

  const openDialog = (event: MouseEvent<HTMLAnchorElement>): void => {
    /*
      Let the browser handle anything that is not a plain left click. A middle
      click, or ctrl/cmd-click to open `/logowanie` in a new tab, are
      navigations the customer meant and a dialog cannot honour.
    */
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <Link
        href="/logowanie"
        className="nav-link nav-icon-link"
        aria-label={SITE.headerLoginLinkPl}
        onClick={openDialog}
      >
        <PersonIcon size={20} />
      </Link>

      {/*
        `ThemeRegistry` around the dialog, and that is not boilerplate.

        The storefront chrome deliberately does not mount MUI's theme -
        `theme-vars.css`'s header records why - so each page that needs it
        mounts its own. The header is chrome, so a MUI `Dialog` rendered from
        it gets MUI's *defaults*: the submit button came out the library's blue
        while the very same `LoginForm` on `/logowanie` is the site's brown
        `rgb(46, 42, 38)`. Portals inherit React context, so this was never a
        portal problem - the header simply had no provider to inherit from.

        Only the dialog is wrapped, not the trigger, so nothing else in the
        header changes.
      */}
      <ThemeRegistry>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          aria-labelledby={TITLE_ID}
          fullWidth
          maxWidth="xs"
          slotProps={{ paper: { sx: { borderRadius: 'var(--radius-card)' } } }}
        >
          <DialogTitle id={TITLE_ID} sx={{ pr: 6 }}>
            {SITE.authLoginHeadingPl}
            <IconButton
              onClick={() => setOpen(false)}
              aria-label={SITE.dialogClosePl}
              sx={{ position: 'absolute', insetInlineEnd: 8, top: 8 }}
            >
              <CloseIcon size={20} />
            </IconButton>
          </DialogTitle>

          <DialogContent>
            {/*
              The same island `/logowanie` renders, not a copy - it owns its own
              `useActionState`, its errors and its rate-limit notice, and a
              duplicated form would be a second place for those to drift.

              It already ends with „Nie masz jeszcze konta?" and a link to
              `/rejestracja`, which is exactly the hand-off the owner asked for.
              A second copy was added here first and rendered twice in the
              dialog, which is the kind of thing only looking at it catches.
            */}
            <LoginForm />
          </DialogContent>
        </Dialog>
      </ThemeRegistry>
    </>
  );
}
