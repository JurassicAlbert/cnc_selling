'use client';

import type { ReactNode } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { theme } from './theme';
import { adminTheme } from './adminTheme';

const THEMES = { storefront: theme, admin: adminTheme } as const;

/**
 * NOT mounted at the root layout - see `src/app/theme-vars.css`'s header
 * comment for why (a Lighthouse audit caught it shipping the full MUI +
 * Emotion + React client runtime to pages that use zero interactive MUI
 * components, tanking mobile LCP). This component is still correct and
 * still needed - wrap it around the first real interactive island (P3's
 * configurator, cart, checkout) once one exists, not around the whole app.
 *
 * `AppRouterCacheProvider` is what makes Emotion emit its styles as a
 * single collected `<style>` tag during SSR instead of one per component -
 * without it MUI still works, it just ships more HTML for no reason.
 *
 * `variant`, not a `Theme` object prop: every call site of this component
 * lives in a Server Component (`panel/layout.tsx`, the Configurator's host
 * page, the product page), and a real MUI `Theme` object is full of
 * functions (`sx`, `alpha`, transition helpers, ...) - passing one as a
 * prop across the Server→Client Component boundary crashes at runtime
 * ("Functions cannot be passed directly to Client Components"), confirmed
 * live. A plain string variant is serializable; the actual `Theme` object
 * is picked from `THEMES` here, entirely inside this client module.
 */
export function ThemeRegistry({ children, variant = 'storefront' }: { children: ReactNode; variant?: keyof typeof THEMES }) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={THEMES[variant]}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
