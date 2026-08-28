'use client';

/**
 * 2026-08-28, owner feedback: the whole `/moje-konto/*` section "still has
 * too poor UI/UX" — this nav was a raw flex row of plain-text `<Link>`s and
 * a bare `<button>` for logout, the same "vanilla html/css" register the
 * rest of the account section was flagged for. Real MUI `Tabs` with icons,
 * self-contained with its own `ThemeRegistry` (rather than moving the
 * mount up into the Server Component layout and risking a double
 * `AppRouterCacheProvider` on pages that already mount their own) — same
 * "each interactive piece owns its mount" precedent every other MUI
 * island in this codebase already follows.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import PaletteIcon from '@mui/icons-material/Palette';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TurnedInIcon from '@mui/icons-material/TurnedIn';
import { Box, IconButton, Tab, Tabs, Tooltip } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { logout } from '@/server/actions/auth';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

const NAV_ITEMS = [
  { href: '/moje-konto/zamowienia', label: SITE.accountNavOrdersPl, Icon: ReceiptLongIcon },
  { href: '/moje-konto/projekty', label: SITE.accountNavConfigurationsPl, Icon: TurnedInIcon },
  { href: '/moje-konto/wzory', label: SITE.accountNavDesignsPl, Icon: PaletteIcon },
  { href: '/moje-konto/pomoc', label: SITE.accountNavHelpPl, Icon: HelpOutlineIcon },
] as const;

export function AccountNav() {
  return (
    <ThemeRegistry>
      <AccountNavInner />
    </ThemeRegistry>
  );
}

function AccountNavInner() {
  const pathname = usePathname();
  // `/moje-konto` itself (the dashboard) isn't one of the tabs — falls
  // back to no tab selected rather than forcing a false match.
  const activeIndex = NAV_ITEMS.findIndex((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: 1,
        borderColor: 'divider',
        mb: 4,
      }}
    >
      <Tabs value={activeIndex === -1 ? false : activeIndex} variant="scrollable" scrollButtons="auto">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <Tab key={href} component={Link} href={href} icon={<Icon fontSize="small" />} iconPosition="start" label={label} />
        ))}
      </Tabs>
      {/* A real `<form action={logout}>`, not an onClick handler — same
          zero-extra-JS-path Server Action invocation every other logout
          button in this codebase already uses. */}
      <form action={logout}>
        <Tooltip title={SITE.headerLogoutPl}>
          <IconButton aria-label={SITE.headerLogoutPl} type="submit">
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </form>
    </Box>
  );
}
