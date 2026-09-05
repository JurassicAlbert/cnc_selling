'use client';

/*
  Extracted from `Configurator.tsx` for `docs/AI-CHECKLIST.md` ARCH-02, which
  finished on 2026-09-05. Moved verbatim - same bodies, same props, same
  behaviour - along seams that already existed. The state model stays in
  `Configurator.tsx`, which is what the item asks for.
*/

import { Link, MenuItem } from '@mui/material';

import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { unavailabilityReasonMessage } from '@/content/pl/messages';
import { DisabledExplanation } from '@/ui/primitives/DisabledExplanation';
import type { OptionAvailability } from '@/server/configurator/resolve-options';
import type { SwatchEntry } from './ImageSwatchGroup';

export function CrumbLink({
  label,
  value,
  onOpen,
}: {
  readonly label: string;
  readonly value: string | null;
  readonly onOpen: (anchor: HTMLElement) => void;
}) {
  return (
    <Link
      component="button"
      type="button"
      underline="hover"
      onClick={(e) => onOpen(e.currentTarget)}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        font: 'var(--mui-font-body1)',
        color: value !== null ? 'text.primary' : 'primary.main',
      }}
    >
      {value !== null ? `${label}: ${value}` : label}
      <ExpandMoreIcon fontSize="inherit" />
    </Link>
  );
}

/**
 * One row of the DESIGN dropdown - the one crumb that shows real artwork.
 * 2026-08-29, owner feedback, verbatim: "pattern should be more like png
 * without background not some div block" - a bare `<img>` (not `next/image`;
 * these patterns are transparent SVGs, and `next/image` cannot optimize SVG
 * without `dangerouslyAllowSVG`, same reason the installation diagram above
 * uses a plain `<img>`), no circle/card behind it, `objectFit: contain` so
 * the transparent padding around the motif stays intact instead of being
 * cropped the way `objectFit: cover` would.
 */

export function DesignMenuItem({
  entry,
  selected,
  onSelect,
}: {
  readonly entry: SwatchEntry;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const item = (
    <MenuItem disabled={!entry.isAvailable} selected={selected} onClick={() => onSelect(entry.id)} sx={{ gap: 1.5 }}>
      {/* biome-ignore lint/performance/noImgElement: transparent SVG pattern art - next/image can't optimize SVG without dangerouslyAllowSVG, same precedent as the installation diagram below */}
      <img src={entry.imageUrl} alt="" width={32} height={32} style={{ objectFit: 'contain', flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{entry.namePl}</span>
      {selected && <CheckIcon fontSize="small" color="secondary" />}
    </MenuItem>
  );
  return <DisabledExplanation title={entry.reasonPl ?? undefined}>{item}</DisabledExplanation>;
}

/** One row of the MATERIAL/FINISH dropdowns - text only, no image (owner: "you don't need to visualize the wood size or look"). */

export function TextMenuItem({
  entry,
  selected,
  onSelect,
}: {
  readonly entry: OptionAvailability;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const item = (
    <MenuItem disabled={!entry.isAvailable} selected={selected} onClick={() => onSelect(entry.id)}>
      <span style={{ flex: 1 }}>{entry.namePl}</span>
      {selected && <CheckIcon fontSize="small" color="secondary" sx={{ ml: 1.5 }} />}
    </MenuItem>
  );
  return (
    <DisabledExplanation title={entry.reason === null ? undefined : unavailabilityReasonMessage(entry.reason)}>
      {item}
    </DisabledExplanation>
  );
}

/**
 * One collapsible "band" of the configurator - a real MUI `Accordion`,
 * closed by default except the first unsatisfied step (owner feedback,
 * 2026-08-28: "wybiera się poprzez kliknięcie na band z nazwą" - you pick
 * by clicking a named band, like a t-shirt colour/size selector). The
 * band's own header always shows the current selection next to its name,
 * so a collapsed band still communicates its state at a glance.
 */
