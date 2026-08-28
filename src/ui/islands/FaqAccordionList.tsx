'use client';

/**
 * The one real interactive part of `/faq` — pulled into its own client
 * island because `ARCHITECTURE.md` §2.1's own lint rule (`noRestrictedImports`)
 * forbids importing `@mui/material` directly in a (marketing)/(shop) Server
 * Component. The page itself stays a Server Component (the actual `Faq` data
 * fetch needs no interactivity at all) and wraps just this island in
 * `ThemeRegistry`.
 */

import { Accordion, AccordionDetails, AccordionSummary, Stack } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { Text } from '@/ui/primitives/Text';
import type { FaqEntry } from '@/server/repositories/faq';

export function FaqAccordionList({ faqs }: { readonly faqs: readonly FaqEntry[] }) {
  return (
    <Stack spacing={1.5}>
      {faqs.map((faq) => (
        <Accordion key={faq.id} disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <span style={{ fontWeight: 600 }}>{faq.questionPl}</span>
          </AccordionSummary>
          <AccordionDetails>
            <Text muted>{faq.answerPl}</Text>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  );
}
