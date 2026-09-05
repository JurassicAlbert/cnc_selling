'use client';

/*
  Extracted from `Configurator.tsx` on 2026-09-05 for `docs/AI-CHECKLIST.md`
  ARCH-02: that file was 1 632 lines, three times the next largest in the
  repository, with no test of its own except through e2e. Moved verbatim -
  same body, same props, same behaviour - along a seam that already existed.
  The state model stays in `Configurator.tsx`, which is what ARCH-02 asks.
*/

import { Alert, TextField } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { dimensionMessage } from '@/content/pl/messages';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import type { DimensionIssue } from '@/domain/dimensions/dimensions';

export function SizeFields({
  widthInput,
  heightInput,
  widthError,
  heightError,
  dimensionEnvelope,
  onWidthChange,
  onHeightChange,
  onCommitWidth,
  onCommitHeight,
  dimensionIssues,
}: {
  readonly widthInput: string;
  readonly heightInput: string;
  readonly widthError: string | null;
  readonly heightError: string | null;
  readonly dimensionEnvelope: {
    readonly minWidthMm: number;
    readonly maxWidthMm: number;
    readonly minHeightMm: number;
    readonly maxHeightMm: number;
  };
  readonly onWidthChange: (value: string) => void;
  readonly onHeightChange: (value: string) => void;
  readonly onCommitWidth: () => void;
  readonly onCommitHeight: () => void;
  readonly dimensionIssues: readonly DimensionIssue[];
}) {
  const minWidthCm = Number(formatMmAsCentimetres(dimensionEnvelope.minWidthMm));
  const maxWidthCm = Number(formatMmAsCentimetres(dimensionEnvelope.maxWidthMm));
  const minHeightCm = Number(formatMmAsCentimetres(dimensionEnvelope.minHeightMm));
  const maxHeightCm = Number(formatMmAsCentimetres(dimensionEnvelope.maxHeightMm));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TextField
        label={SITE.configuratorWidthLabelPl}
        value={widthInput}
        onChange={(e) => onWidthChange(e.target.value)}
        onBlur={onCommitWidth}
        error={widthError !== null}
        helperText={widthError ?? `${minWidthCm}–${maxWidthCm} cm`}
        size="small"
      />
      <TextField
        label={SITE.configuratorHeightLabelPl}
        value={heightInput}
        onChange={(e) => onHeightChange(e.target.value)}
        onBlur={onCommitHeight}
        error={heightError !== null}
        helperText={heightError ?? `${minHeightCm}–${maxHeightCm} cm`}
        size="small"
      />

      {dimensionIssues.length > 0 && (
        <Alert severity="error">
          {dimensionIssues.map((issue) => (
            <div key={issue.code}>{dimensionMessage(issue)}</div>
          ))}
        </Alert>
      )}
    </div>
  );
}

/**
 * Pinned to the viewport bottom throughout - the running price is always
 * visible while configuring, the same pattern Bazaar/NextMerce use for
 * their PDP add-to-cart bar (this session's redesign reference,
 * `docs/HANDOVER.md` §9g). `position: fixed` rather than `sticky`: the
 * page's content height varies a lot depending on the product's own step
 * list, and `sticky` only pins once the element would otherwise scroll past
 * its normal flow position - `fixed` is unconditional on both mobile and
 * desktop. The outer `<div>`'s `paddingBottom: 72` above keeps this from
 * covering the page's last section.
 */
