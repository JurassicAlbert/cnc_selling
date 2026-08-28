'use client';

/**
 * 2026-08-28, owner feedback, verbatim analogy: "wzory powinny być w
 * produkcie do wyboru tak jak kolor koszulki" (patterns should be a choice
 * in the product like a t-shirt color) — a real e-commerce variant-swatch
 * picker, not a text-labelled `ToggleButtonGroup` buried behind a wizard
 * step. The image data was already there and already fetched
 * (`MaterialOptionRow.imageUrl`, `DesignOptionRow.previewUrl`,
 * `FinishOptionRow.imageUrl` — the last one newly added to the option-row
 * projection specifically for this), just never rendered as a swatch.
 *
 * Renders EVERY entry, never just the selectable ones — same
 * ARCHITECTURE.md §7.2 rule `OptionStep` already follows: an unavailable
 * option is shown disabled with a real Polish reason on hover
 * (`DisabledExplanation`), not hidden.
 */

import Image from 'next/image';
import CheckIcon from '@mui/icons-material/Check';
import { Box, Tooltip, Typography } from '@mui/material';

export type SwatchEntry = {
  readonly id: string;
  readonly namePl: string;
  readonly imageUrl: string;
  readonly isAvailable: boolean;
  readonly reasonPl: string | null;
};

export function ImageSwatchGroup({
  entries,
  selectedId,
  onSelect,
  ariaLabel,
}: {
  readonly entries: readonly SwatchEntry[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  readonly ariaLabel: string;
}) {
  return (
    <Box role="group" aria-label={ariaLabel} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {entries.map((entry) => (
        <Swatch key={entry.id} entry={entry} selected={entry.id === selectedId} onSelect={onSelect} />
      ))}
    </Box>
  );
}

function Swatch({
  entry,
  selected,
  onSelect,
}: {
  readonly entry: SwatchEntry;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const button = (
    <Box
      component="button"
      type="button"
      disabled={!entry.isAvailable}
      onClick={() => onSelect(entry.id)}
      aria-pressed={selected}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        width: 84,
        border: 'none',
        background: 'none',
        p: 0,
        cursor: entry.isAvailable ? 'pointer' : 'not-allowed',
        opacity: entry.isAvailable ? 1 : 0.4,
        filter: entry.isAvailable ? 'none' : 'grayscale(1)',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: 72,
          height: 72,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid',
          borderColor: selected ? 'secondary.main' : 'divider',
          outline: selected ? '2px solid' : 'none',
          outlineColor: selected ? 'secondary.main' : 'transparent',
          outlineOffset: 2,
          transition: 'border-color 0.15s ease, outline-color 0.15s ease',
        }}
      >
        <Image src={entry.imageUrl} alt="" fill sizes="72px" style={{ objectFit: 'cover' }} />
        {selected && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(46, 42, 38, 0.35)',
            }}
          >
            <CheckIcon sx={{ color: '#fff' }} />
          </Box>
        )}
      </Box>
      <Typography variant="caption" align="center" sx={{ lineHeight: 1.2 }}>
        {entry.namePl}
      </Typography>
    </Box>
  );

  if (entry.reasonPl === null) {
    return button;
  }
  return <Tooltip title={entry.reasonPl}>{button}</Tooltip>;
}
