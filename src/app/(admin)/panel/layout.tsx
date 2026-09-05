import type { ReactNode } from 'react';
import { Alert, AppBar, Box, Button, Stack, Toolbar, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { requireStaffSession } from '@/server/auth/session';
import { logout } from '@/server/actions/auth';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { GlobalSearch } from '@/ui/islands/admin/GlobalSearch';
import { AdminSidebarNav } from '@/ui/islands/admin/AdminSidebarNav';

const SIDEBAR_WIDTH = 260;

/**
 * `/panel/*` shell - `requireStaffSession()` is the real authorization
 * check (redirect if unauthenticated, `notFound()` for `CUSTOMER`);
 * `src/proxy.ts` only pre-empts the unauthenticated case cheaply.
 *
 * Wrapped in `ThemeRegistry` deliberately, unlike the rest of the app
 * (`theme-vars.css`'s header explains why it's normally kept OUT of the
 * root layout). Unlike the rest of the app it also uses its OWN theme
 * (`adminTheme`, not the storefront `theme`) - see that file's header for
 * why the panel deliberately does NOT share the storefront's flattened,
 * accent-free look. `docs/ARCHITECTURE.md` §16A: "Full MUI... standard
 * Material, dense layout, no brand theming investment" - refined
 * 2026-08-27 into an explicit Materio-style bento dashboard.
 *
 * Top `AppBar` (search + identity + logout) plus a grouped icon sidebar
 * (`AdminSidebarNav`) - closer to Materio's actual layout than the old
 * flat text-link list that used to live entirely in the nav column.
 */
export default async function PanelLayout({ children }: { readonly children: ReactNode }) {
  const staff = await requireStaffSession();

  return (
    <ThemeRegistry variant="admin">
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box
          component="nav"
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '@media print': { display: 'none' },
          }}
        >
          <Toolbar sx={{ minHeight: '64px !important' }}>
            <Typography variant="h6" component="span" sx={{ fontWeight: 700, color: 'primary.main' }}>
              RYT
            </Typography>
          </Toolbar>
          {/*
            A plain string, not the session object: `AdminSidebarNav` is a
            Client Component, and `CurrentSession` carries nothing else it
            needs. `requireStaffSession()` above guarantees the role is one
            of these two.
          */}
          <AdminSidebarNav role={staff.role === 'ADMIN' ? 'ADMIN' : 'STAFF'} />
        </Box>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <AppBar position="sticky" sx={{ '@media print': { display: 'none' } }}>
            <Toolbar sx={{ gap: 2 }}>
              <Box sx={{ flex: 1, maxWidth: 480 }}>
                <GlobalSearch />
              </Box>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {staff.email}
                </Typography>
                <form action={logout}>
                  <Button type="submit" size="small" variant="outlined">
                    {ADMIN.logoutPl}
                  </Button>
                </form>
              </Stack>
            </Toolbar>
          </AppBar>
          <Box component="main" sx={{ flex: 1, p: 3 }}>
            {/*
              P2-9: STAFF is read-only across the whole panel, so the notice
              belongs here rather than beside each of the 84 controls it
              applies to. One place cannot go stale the way 84 can, and the
              rule it states is genuinely panel-wide.

              The controls are deliberately left on the page. A STAFF account
              is meant to see everything - that is the whole content of
              "read-only" - and hiding every form would also hide what the
              settings currently are. What the owner's rule forbids is a
              control that fails without warning, which this answers by
              saying up front what will happen.
            */}
            {staff.role !== 'ADMIN' ? (
              <Alert severity="info" sx={{ mb: 3 }}>
                {ADMIN.staffReadOnlyNoticePl}
              </Alert>
            ) : null}
            {children}
          </Box>
        </Box>
      </Box>
    </ThemeRegistry>
  );
}
