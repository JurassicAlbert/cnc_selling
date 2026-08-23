'use client';

import type { ReactNode } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v13-appRouter';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { theme } from './theme';

/**
 * The one client boundary the root layout needs. `AppRouterCacheProvider`
 * is what makes Emotion emit its styles as a single collected `<style>` tag
 * during SSR instead of one per component — without it MUI still works, it
 * just ships more HTML for no reason.
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
