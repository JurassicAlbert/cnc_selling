'use client';

/**
 * Grouped, icon-led sidebar nav — replaces the old flat text-link list.
 * Needs `usePathname()` for active-route highlighting, which is the only
 * reason this is a client component; everything else in `panel/layout.tsx`
 * stays server-rendered.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List, ListItemButton, ListItemIcon, ListItemText, ListSubheader } from '@mui/material';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import CollectionsBookmarkOutlinedIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import AutoAwesomeMosaicOutlinedIcon from '@mui/icons-material/AutoAwesomeMosaicOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import NewspaperOutlinedIcon from '@mui/icons-material/NewspaperOutlined';
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';

import { ADMIN } from '@/content/pl/admin';

type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: ReactNode;
};

type NavGroup = {
  readonly headerPl?: string;
  readonly items: readonly NavItem[];
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [{ href: '/panel', label: ADMIN.navDashboardPl, icon: <DashboardOutlinedIcon fontSize="small" /> }],
  },
  {
    headerPl: ADMIN.navGroupSalesPl,
    items: [
      { href: '/panel/zamowienia', label: ADMIN.navOrdersPl, icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
      { href: '/panel/klienci', label: ADMIN.navCustomersPl, icon: <PeopleOutlinedIcon fontSize="small" /> },
      { href: '/panel/weryfikacja', label: ADMIN.navDesignReviewPl, icon: <FactCheckOutlinedIcon fontSize="small" /> },
      { href: '/panel/produkcja', label: ADMIN.navProductionPl, icon: <PrecisionManufacturingOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    headerPl: ADMIN.navGroupCatalogPl,
    items: [
      { href: '/panel/kategorie', label: ADMIN.navCategoriesPl, icon: <CategoryOutlinedIcon fontSize="small" /> },
      { href: '/panel/produkty', label: ADMIN.navProductsPl, icon: <Inventory2OutlinedIcon fontSize="small" /> },
      { href: '/panel/materialy', label: ADMIN.navMaterialsPl, icon: <LayersOutlinedIcon fontSize="small" /> },
      { href: '/panel/wykonczenia', label: ADMIN.navFinishesPl, icon: <BrushOutlinedIcon fontSize="small" /> },
      { href: '/panel/wzory', label: ADMIN.navDesignsPl, icon: <PaletteOutlinedIcon fontSize="small" /> },
      { href: '/panel/kolekcje', label: ADMIN.navCollectionsPl, icon: <CollectionsBookmarkOutlinedIcon fontSize="small" /> },
      { href: '/panel/zasoby-zewnetrzne', label: ADMIN.navExternalPatternResourcesPl, icon: <LinkOutlinedIcon fontSize="small" /> },
      { href: '/panel/kolekcje-produktow', label: ADMIN.navProductCollectionsPl, icon: <AutoAwesomeMosaicOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    headerPl: ADMIN.navGroupContentPl,
    items: [
      { href: '/panel/faq', label: ADMIN.navFaqPl, icon: <HelpOutlineOutlinedIcon fontSize="small" /> },
      { href: '/panel/strony', label: ADMIN.navStaticPagesPl, icon: <ArticleOutlinedIcon fontSize="small" /> },
      { href: '/panel/blog', label: ADMIN.navBlogPl, icon: <NewspaperOutlinedIcon fontSize="small" /> },
      { href: '/panel/opinie', label: ADMIN.navReviewsPl, icon: <StarBorderOutlinedIcon fontSize="small" /> },
    ],
  },
  {
    headerPl: ADMIN.navGroupSystemPl,
    items: [
      { href: '/panel/ustawienia', label: ADMIN.navSettingsPl, icon: <SettingsOutlinedIcon fontSize="small" /> },
      { href: '/panel/ceny', label: ADMIN.navPricingPl, icon: <SellOutlinedIcon fontSize="small" /> },
      { href: '/panel/dziennik-zdarzen', label: ADMIN.navAuditLogPl, icon: <HistoryOutlinedIcon fontSize="small" /> },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/panel') {
    return pathname === '/panel';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <List dense sx={{ py: 0 }}>
      {NAV_GROUPS.map((group) => (
        <li key={group.headerPl ?? 'root'}>
          <ul style={{ padding: 0 }}>
            {group.headerPl !== undefined && <ListSubheader disableSticky>{group.headerPl}</ListSubheader>}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <ListItemButton selected={active} sx={{ borderRadius: 1, mx: 1, width: 'auto' }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} slotProps={{ primary: { variant: 'body2' } }} />
                  </ListItemButton>
                </Link>
              );
            })}
          </ul>
        </li>
      ))}
    </List>
  );
}
