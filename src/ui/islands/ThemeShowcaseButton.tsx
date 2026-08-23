'use client';

import Button from '@mui/material/Button';

import { SITE } from '@/content/pl/site';

/**
 * Proof-of-architecture, not a real feature: a Server Component page
 * (`(marketing)/page.tsx`) renders this as a child without itself importing
 * `@mui/material` — exactly the split §2.1 and §7 require. This is the one
 * client island in the P0 shell; real islands (configurator, cart, upload)
 * arrive in P3+.
 */
export function ThemeShowcaseButton() {
  return (
    <Button variant="contained" color="secondary">
      {SITE.themeShowcaseButtonPl}
    </Button>
  );
}
