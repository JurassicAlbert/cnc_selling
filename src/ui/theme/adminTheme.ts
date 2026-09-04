/**
 * The admin-panel theme - deliberately a SEPARATE theme object from
 * `theme.ts`, not a variant of it. `theme.ts`'s whole point is fighting the
 * stock Material "admin dashboard" look on the storefront (flattened
 * shadows, no accent colour, §2.1). The panel is the opposite case: per
 * `docs/ARCHITECTURE.md` §16A it's meant to read as "Full MUI... standard
 * Material, dense layout" and, per the 2026-08-27 Materio feedback, as a
 * real bento-grid admin dashboard with soft-shadow colour-accented cards -
 * exactly the elevation and accent language `theme.ts` exists to suppress.
 *
 * Reuses `theme.ts`'s house fonts/spacing/button conventions (still the
 * same product, same typography) but keeps its own palette and shadow
 * scale. Composed with `plPL` + `dataGridPlPL` the same way `theme.ts` is -
 * every grid/locale string in the panel should read in Polish too.
 */

import { createTheme } from '@mui/material/styles';
import { plPL } from '@mui/material/locale';
import { plPL as dataGridPlPL } from '@mui/x-data-grid/locales';

const adminBaseTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    background: {
      default: '#F4F5FA', // cool light grey - Materio's own dashboard ground
      paper: '#FFFFFF',
    },
    primary: {
      main: '#5D4FBF', // indigo - a real accent colour, unlike the storefront's near-black
    },
    secondary: {
      main: '#A97B4F', // keeps the storefront's oak accent as the panel's secondary tone,
      // so the two themes still read as one product, not two unrelated skins
    },
    success: { main: '#3CA55C' },
    warning: { main: '#C98A1D' },
    error: { main: '#B23B3B' },
    info: { main: '#2E7FBF' },
    divider: '#E7E7EF',
  },
  typography: {
    fontFamily: 'var(--font-body)',
    h1: { fontFamily: 'var(--font-display)' },
    h2: { fontFamily: 'var(--font-display)' },
    h3: { fontFamily: 'var(--font-display)' },
    h4: { fontFamily: 'var(--font-display)' },
    h5: { fontFamily: 'var(--font-display)' },
    h6: { fontFamily: 'var(--font-display)' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: {
    borderRadius: 10, // Materio's soft-rounded card language
  },
  spacing: 8,
  // No flattened shadow scale here - the stock MUI elevation scale is what
  // gives the bento-grid cards their "lifted off the page" look; that's the
  // point on this theme, unlike theme.ts.
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 10px 0 rgba(30, 26, 60, 0.08)',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none', // MUI's dark-elevation overlay gradient - irrelevant in light mode, explicit off
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        color: 'inherit',
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderBottom: '1px solid #E7E7EF',
        },
      },
    },
  },
});

export const adminTheme = createTheme(adminBaseTheme, plPL, dataGridPlPL);
