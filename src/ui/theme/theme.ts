/**
 * The storefront theme. ARCHITECTURE.md §2.1 is explicit that the stock
 * Material look "reads as admin dashboard" — the exact failure mode the
 * brief forbids — so every override below exists to destroy that look, not
 * to decorate it. This file is the one place that risk is fought.
 *
 * `cssVariables: true` so Server Components in `(marketing)`/`(shop)` can
 * consume brand tokens (`var(--mui-palette-primary-main)`, etc.) without
 * shipping Emotion just to render a heading — see `src/ui/primitives`.
 *
 * Dark mode is explicitly out of scope for MVP (§2.1); no `colorSchemes`
 * here. Adding it later is cheap precisely because this is CSS-variables
 * already — that is deferred work, not a limitation of this file.
 */

import { createTheme } from '@mui/material/styles';
import type { Shadows } from '@mui/material/styles';
import { plPL } from '@mui/material/locale';

const brandTheme = createTheme({
  cssVariables: true,
  palette: {
    background: {
      default: '#FAF8F5', // warm off-white — page ground
      paper: '#FFFFFF', // cards, configurator surfaces
    },
    text: {
      primary: '#1F1D1B', // graphite
      secondary: '#6B655E', // meta, helper text
    },
    primary: {
      main: '#2E2A26', // near-black — CTAs, deliberately not a colour
    },
    secondary: {
      main: '#A97B4F', // warm oak — accents, active configurator step
    },
    divider: '#E6E0D8', // hairlines
    error: {
      main: '#8C3A2E', // muted brick — no bright red
    },
  },
  typography: {
    fontFamily: 'var(--font-body)',
    h1: { fontFamily: 'var(--font-display)' },
    h2: { fontFamily: 'var(--font-display)' },
    h3: { fontFamily: 'var(--font-display)' },
    h4: { fontFamily: 'var(--font-display)' },
    h5: { fontFamily: 'var(--font-display)' },
    h6: { fontFamily: 'var(--font-display)' },
    // No uppercase buttons — a stock MUI button shouting "SUBMIT" is the
    // single fastest tell that a site is running the default theme.
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 2,
  },
  spacing: 8, // theme.spacing(1) = 8px. This IS the MUI default; stated
  // explicitly here because §2.1 calls it out as a deliberate rhythm choice,
  // not an accident of not having configured it.
  shadows: buildFlattenedShadows(),
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
  },
});

export const theme = createTheme(brandTheme, plPL);

/**
 * MUI's default shadow scale is 25 entries of increasingly heavy box-shadow,
 * built for elevation-heavy dashboards. §2.1 asks for them "flattened to
 * near-none" — not literally `none` throughout (index 0 already means that,
 * and always has), but a single, barely-there shadow reused at every other
 * elevation so nothing on the storefront reads as a floating card.
 */
function buildFlattenedShadows(): Shadows {
  const subtle = '0 1px 2px 0 rgba(31, 29, 27, 0.04)';
  const shadows = Array.from({ length: 25 }, () => subtle) as Shadows;
  shadows[0] = 'none';
  return shadows;
}
