'use client';

/*
  Extracted from `Configurator.tsx` for `docs/AI-CHECKLIST.md` ARCH-02, which
  finished on 2026-09-05. Moved verbatim - same bodies, same props, same
  behaviour - along seams that already existed. The state model stays in
  `Configurator.tsx`, which is what the item asks for.
*/

import type { ReactNode } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, TextField, Typography } from '@mui/material';

import { SITE } from '@/content/pl/site';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { STEP_LABEL } from './step-labels';
import type { StepCode } from '@/domain/configuration/steps';

export function ConfigSection({
  step,
  heading,
  selectedLabel,
  expanded,
  onToggle,
  children,
}: {
  readonly step: StepCode;
  readonly heading: string;
  readonly selectedLabel: string | null;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        '&:before': { display: 'none' },
        '&.Mui-expanded': { borderColor: 'secondary.main' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`${step}-content`} id={`${step}-header`}>
        <Typography variant="h6" component="h3">
          {heading}
          {selectedLabel !== null && (
            <Typography component="span" color="text.secondary" sx={{ ml: 1, font: 'var(--mui-font-body1)' }}>
              - {selectedLabel}
            </Typography>
          )}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

/**
 * 2026-08-29, owner feedback, verbatim: "tekst do wygrawerowania - this
 * should be very small section - disabled for now, and number of
 * characters should match with the product" - a real disabled `TextField`,
 * not a full form: the placeholder states it's not enabled yet and shows
 * this exact product's own real `PersonalizationSpec.maxCharacters`
 * (`null` - no spec at all, or one not enabled - falls back to a generic
 * "not offered" placeholder, same honesty `PersonalizationStep` used to
 * apply). No accordion band, no breadcrumb - just this one small field.
 */

export function PersonalizationStub({ maxCharacters }: { readonly maxCharacters: number | null }) {
  return (
    <TextField
      label={STEP_LABEL.PERSONALIZATION}
      placeholder={
        maxCharacters !== null
          ? SITE.configuratorPersonalizationComingSoonPl(maxCharacters)
          : SITE.configuratorPersonalizationUnavailablePl
      }
      disabled
      fullWidth
      size="small"
    />
  );
}

/**
 * The SIZE crumb's popover content - two plain, precise `TextField`s.
 * 2026-08-29, owner feedback, verbatim: "you don't need to visualize the
 * wood size or look" - the previous pass's `Slider` (a visual, drag-driven
 * control) is gone; a compact popover triggered from a breadcrumb crumb has
 * no room for one anyway. Each field still commits on blur, so live
 * pricing (§10.2) is unchanged - the server round-trip fires the moment a
 * real value is typed and the field loses focus, exactly as before.
 */
