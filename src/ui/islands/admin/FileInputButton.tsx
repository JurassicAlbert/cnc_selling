'use client';

/**
 * MUI has no native file-input component. This is MUI's own documented
 * pattern for one: a real `<Button>` acting as a `<label>`, with the native
 * `<input type="file">` visually hidden inside it (never `display: none` —
 * that would drop it from the tab order and break screen readers). The
 * input keeps its real `name`/`accept`/`required`, so the enclosing
 * `<form>`'s `FormData` sees it exactly as it would a raw file input.
 */

import { useId, useState } from 'react';
import { Button } from '@mui/material';

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
}: {
  readonly name: string;
  readonly accept?: string;
  readonly required?: boolean;
  readonly label: string;
  readonly chooseLabel: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const inputId = useId();

  return (
    <Button component="label" htmlFor={inputId} variant="outlined" size="small" sx={{ alignSelf: 'flex-start' }}>
      {fileName ?? chooseLabel}
      <input
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        required={required}
        aria-label={label}
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        style={VISUALLY_HIDDEN_INPUT_SX}
      />
    </Button>
  );
}
