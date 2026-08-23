'use client';

import type { ReactNode } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { theme } from './theme';

/**
 * NOT mounted at the root layout — see `src/app/theme-vars.css`'s header
 * comment for why (a Lighthouse audit caught it shipping the full MUI +
 * Emotion + React client runtime to pages that use zero interactive MUI
 * components, tanking mobile LCP). This component is still correct and
 * still needed — wrap it around the first real interactive island (P3's
 * configurator, cart, checkout) once one exists, not around the whole app.
 *
 * `AppRouterCacheProvider` is what makes Emotion emit its styles as a
 * single collected `<style>` tag during SSR instead of one per component —
 * without it MUI still works, it just ships more HTML for no reason.
 */
export function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
