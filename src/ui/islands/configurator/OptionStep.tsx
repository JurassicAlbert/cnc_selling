'use client';

/*
  Extracted from `Configurator.tsx` for `docs/AI-CHECKLIST.md` ARCH-02, which
  finished on 2026-09-05. Moved verbatim - same bodies, same props, same
  behaviour - along seams that already existed. The state model stays in
  `Configurator.tsx`, which is what the item asks for.
*/

import { Alert, ToggleButton, ToggleButtonGroup } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { unavailabilityReasonMessage } from '@/content/pl/messages';
import { DisabledExplanation } from '@/ui/primitives/DisabledExplanation';
import type { OptionAvailability } from '@/server/configurator/resolve-options';

export function OptionStep({
  title,
  entries,
  selectedId,
  onSelect,
}: {
  readonly title: string;
  readonly entries: readonly OptionAvailability[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  if (entries.length === 0) {
    return <Alert severity="info">{SITE.configuratorNoOptionsPl}</Alert>;
  }

  return (
    <ToggleButtonGroup
      value={selectedId}
      exclusive
      onChange={(_e, value: string | null) => {
        if (value !== null) onSelect(value);
      }}
      aria-label={title}
    >
      {entries.map((entry) => (
        <DisabledExplanation key={entry.id} title={entry.reason === null ? undefined : unavailabilityReasonMessage(entry.reason)}>
          <ToggleButton value={entry.id} disabled={!entry.isAvailable}>
            {entry.namePl}
          </ToggleButton>
        </DisabledExplanation>
      ))}
    </ToggleButtonGroup>
  );
}

/**
 * P4's real upload flow (`ARCHITECTURE.md` §13). Only the first-upload
 * path is wired here - `uploadCustomDesign`. `reuploadCustomDesign`
 * (customer re-upload after staff requests `NEEDS_CHANGES`) is real,
 * tested, and callable (`server/actions/design-review.ts`), and now has
 * its own real UI on `/moje-konto/wzory/[id]` (2026-08-28) - that event
 * happens on an existing order past checkout, not inside this pre-purchase
 * configurator.
 */
