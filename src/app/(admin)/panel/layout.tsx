import type { ReactNode } from 'react';
import Link from 'next/link';
import { Box, Button, Stack, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { requireStaffSession } from '@/server/auth/session';
import { logout } from '@/server/actions/auth';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

/**
 * `/panel/*` shell — `requireStaffSession()` is the real authorization
 * check (redirect if unauthenticated, `notFound()` for `CUSTOMER`);
 * `src/proxy.ts` only pre-empts the unauthenticated case cheaply.
 *
 * Wrapped in `ThemeRegistry` deliberately, unlike the rest of the app
 * (`theme-vars.css`'s header explains why it's normally kept OUT of the
 * root layout — shipping MUI+Emotion to pages with no interactive MUI
 * costs real LCP). The panel is the one part of this app meant to be
 * built in real MUI throughout (`docs/ARCHITECTURE.md` §16A: "Full MUI...
 * standard Material, dense layout, no brand theming investment"), so it
 * gets its own registry the same way the configurator island does.
 */
export default async function PanelLayout({ children }: { readonly children: ReactNode }) {
  const staff = await requireStaffSession();

  return (
    <ThemeRegistry>
      <Box sx={{ display: 'flex', minHeight: '100vh' }}>
        <Box component="nav" sx={{ width: 220, borderRight: 1, borderColor: 'divider', p: 2, flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            {staff.email}
          </Typography>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Link href="/panel/zamowienia">{ADMIN.navOrdersPl}</Link>
            <Link href="/panel/weryfikacja">{ADMIN.navDesignReviewPl}</Link>
            <Link href="/panel/kategorie">{ADMIN.navCategoriesPl}</Link>
            <Link href="/panel/produkty">{ADMIN.navProductsPl}</Link>
            <Link href="/panel/materialy">{ADMIN.navMaterialsPl}</Link>
            <Link href="/panel/wykonczenia">{ADMIN.navFinishesPl}</Link>
            <Link href="/panel/wzory">{ADMIN.navDesignsPl}</Link>
            <Link href="/panel/kolekcje">{ADMIN.navCollectionsPl}</Link>
          </Stack>
          <form action={logout}>
            <Button type="submit" size="small" variant="text">
              {ADMIN.logoutPl}
            </Button>
          </form>
        </Box>
        <Box component="main" sx={{ flex: 1, p: 3 }}>
          {children}
        </Box>
      </Box>
    </ThemeRegistry>
  );
}
