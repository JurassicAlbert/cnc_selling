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
import { plPL as dataGridPlPL } from '@mui/x-data-grid/locales';

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
  /**
   * A real type scale — 2026-08-30.
   *
   * Until now every variant below only overrode `fontFamily`, so the site
   * was running MUI's STOCK Material scale with a serif swapped in. That
   * scale is built for dashboards: `h1` came out 96px at weight 300 with no
   * letter-spacing at all, which on a high-contrast display serif reads
   * thin and loose, and forced three-line wraps on ordinary product titles.
   * The steps between sizes were inherited too, and inconsistent
   * (96→60→48→34→24→20: ratios of 1.6, 1.25, 1.41, 1.42, 1.2).
   *
   * What changed, and why each part of it:
   *
   * - **Sizes** follow one ratio (~1.28 through the display range), so the
   *   jump from any level to the next reads as deliberate.
   * - **Weight rises as size falls** (400 → 500 → 600). Large type needs
   *   less weight to hold its own; small type needs more to stay legible.
   *   The old 300 on `h1`/`h2` was never a brand decision — it is simply
   *   what MUI's default is, inherited because only `fontFamily` was set.
   * - **Line-height falls as size rises.** 1.167 on a 96px heading is a
   *   paragraph line-height applied to display type.
   * - **Letter-spacing is tuned per level**: negative on large serif
   *   headings (which are set too loose by default at display sizes),
   *   neutral through body, positive on `caption`/`overline` where small
   *   and uppercase text needs air to stay readable.
   * - **`clamp()` on every heading**, so the scale is genuinely responsive
   *   rather than one desktop size shrunk by luck. `responsiveFontSizes()`
   *   is not usable here: `ThemeRegistry` is deliberately not mounted
   *   site-wide (see `theme-vars.css`'s header), so most of the storefront
   *   never sees a live ThemeProvider. Each clamp's preferred term equals
   *   its desktop value exactly at 1200px, the `Container` max-width.
   *
   * Every value here is mirrored in `src/app/theme-vars.css`, which is what
   * the RSC primitives actually read. If you change one, change both — that
   * file's own header says the same thing, and now it matters more.
   */
  typography: {
    fontFamily: 'var(--font-body)',
    h1: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(2.25rem, calc(2.25rem + (100vw - 375px) * 0.04364), 4.5rem)',
      fontWeight: 400,
      lineHeight: 1.06,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(1.875rem, calc(1.875rem + (100vw - 375px) * 0.02667), 3.25rem)',
      fontWeight: 400,
      lineHeight: 1.12,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(1.5rem, calc(1.5rem + (100vw - 375px) * 0.01455), 2.25rem)',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '-0.015em',
    },
    h4: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(1.375rem, calc(1.375rem + (100vw - 375px) * 0.00727), 1.75rem)',
      fontWeight: 500,
      lineHeight: 1.25,
      letterSpacing: '-0.01em',
    },
    h5: {
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(1.25rem, calc(1.25rem + (100vw - 375px) * 0.00242), 1.375rem)',
      fontWeight: 600,
      lineHeight: 1.32,
      letterSpacing: '-0.005em',
    },
    h6: {
      fontFamily: 'var(--font-display)',
      fontSize: '1.125rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: 0,
    },
    // 1.65 rather than MUI's 1.5: this is the variant real paragraphs use,
    // and 1.5 is a UI line-height, not a reading one.
    body1: { lineHeight: 1.65, letterSpacing: 0 },
    body2: { lineHeight: 1.55, letterSpacing: 0 },
    // A subtitle that shares body1's weight is not a subtitle. 500 and a
    // slightly larger size is what separates the two at a glance.
    subtitle1: { fontSize: '1.0625rem', fontWeight: 500, lineHeight: 1.5, letterSpacing: '-0.005em' },
    subtitle2: { fontWeight: 600, lineHeight: 1.5, letterSpacing: 0 },
    caption: { lineHeight: 1.5, letterSpacing: '0.01em' },
    // MUI renders this uppercase; uppercase without tracking is the classic
    // unreadable-label mistake, and 2.66 line-height made it float.
    overline: { fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.6, letterSpacing: '0.1em' },
    // No uppercase buttons — a stock MUI button shouting "SUBMIT" is the
    // single fastest tell that a site is running the default theme.
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
  },
  shape: {
    borderRadius: 2,
  },
  spacing: 8, // theme.spacing(1) = 8px. This IS the MUI default; stated
  // explicitly here because §2.1 calls it out as a deliberate rhythm choice,
  // not an accident of not having configured it.
  shadows: buildFlattenedShadows(),
  /**
   * 2026-08-30 — make MUI's own controls look like this site rather than
   * like Material.
   *
   * `shape.borderRadius` stayed 2 while the visible design moved to a real
   * 12px radius: `theme-vars.css` introduced `--radius-card` precisely
   * because "the previous `borderRadius: 2` literal was 2px, not a design
   * unit, which is a real part of why cards and the header read as flat".
   * Cards, the hero CTA and the styled native controls all followed; the
   * MUI components never did, so every `Button` and `TextField` on the
   * storefront was still rendering at the abandoned value — visibly
   * squarer than the card it sat inside.
   *
   * Overriding the three interactive controls rather than raising
   * `shape.borderRadius` itself is deliberate and not timidity: `sx`
   * treats `borderRadius: 3` as a MULTIPLE of `shape.borderRadius`, so
   * changing it from 2 to 12 would silently turn every existing
   * `borderRadius: 3` surface into 36px. This changes exactly what it
   * means to change.
   */
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: { borderRadius: 'var(--radius-card)' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 'var(--radius-card)' },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { borderRadius: 'var(--radius-card)' },
      },
    },
  },
});

export const theme = createTheme(brandTheme, plPL, dataGridPlPL);

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
