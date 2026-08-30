'use client';

/**
 * MUI has no native file-input component. This is MUI's own documented
 * pattern for one: a real `<Button>` acting as a `<label>`, with the native
 * `<input type="file">` visually hidden inside it (never `display: none` —
 * that would drop it from the tab order and break screen readers).
 *
 * Two call shapes, because the app genuinely has two:
 *
 * - **Form-driven** (`name`): the input keeps its real `name`/`accept`/
 *   `required`, so the enclosing `<form>`'s `FormData` sees it exactly as it
 *   would a raw file input. This is what the admin forms use.
 * - **State-driven** (`onFileChange`): the caller holds the `File` in React
 *   state and submits it itself. This is what the three customer-facing
 *   upload forms use.
 *
 * 2026-08-30: moved out of `islands/admin/` and given the second shape.
 * `CustomerDesignUploadForm`, `ReuploadCustomDesignForm` and the
 * configurator's own upload step were each rendering a bare
 * `<input type="file">` — a browser-default control sitting inside forms
 * that were otherwise entirely MUI, and the single most obviously unstyled
 * thing a customer met while uploading their own artwork. They now share
 * this one component rather than growing a second implementation of it.
 */

import { useId, useState } from 'react';
import { Button, Stack, Typography } from '@mui/material';

const VISUALLY_HIDDEN_INPUT_SX = {
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
} as const;

export function FileInputButton({
  name,
  accept,
  required = false,
  label,
  chooseLabel,
  onFileChange,
}: {
  /** Set for a form-driven input, so `FormData` picks the file up by name. */
  readonly name?: string;
  readonly accept?: string;
  readonly required?: boolean;
  readonly label: string;
  readonly chooseLabel: string;
  /** Set for a state-driven input, where the caller submits the `File` itself. */
  readonly onFileChange?: (file: File | null) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const inputId = useId();

  return (
    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
      <Button component="label" htmlFor={inputId} variant="outlined" size="small">
        {chooseLabel}
        <input
          id={inputId}
          type="file"
          name={name}
          accept={accept}
          required={required}
          aria-label={label}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setFileName(file?.name ?? null);
            onFileChange?.(file);
          }}
          style={VISUALLY_HIDDEN_INPUT_SX}
        />
      </Button>
      {/*
       * The chosen file name sits BESIDE the button rather than replacing
       * its label, which is what this used to do. A button whose text turns
       * into "moj-projekt-final-v2.png" stops looking like a button, loses
       * its own affordance, and stretches the layout to whatever length the
       * file name happens to be.
       */}
      {fileName !== null && (
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 320, wordBreak: 'break-all' }}>
          {fileName}
        </Typography>
      )}
    </Stack>
  );
}
