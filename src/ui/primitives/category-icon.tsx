import type { ComponentType } from 'react';

import {
  ChairIcon,
  DiamondIcon,
  EngineeringIcon,
  GridViewIcon,
  ImagePlaceholderIcon,
  ViewColumnIcon,
} from '@/ui/icons';

type IconComponent = ComponentType<{ readonly size?: number }>;

/**
 * Category slug -> a real, already-built icon (`src/ui/icons/index.tsx`).
 * `ChairIcon`/`DiamondIcon`/`GridViewIcon`/`ViewColumnIcon`/
 * `ImagePlaceholderIcon` were added during the P2 redesign but never wired
 * to anything - this is that wiring, added 2026-08-25 for the category-tile
 * and product-card badges. `EngineeringIcon` is the catch-all for `inne`.
 */
const CATEGORY_ICONS: Record<string, IconComponent> = {
  loft: ChairIcon,
  'amulety-i-bransoletki': DiamondIcon,
  gres: GridViewIcon,
  'panele-podlogowe': ViewColumnIcon,
  'obrazy-drewniane': ImagePlaceholderIcon,
};

export function getCategoryIcon(categorySlug: string): IconComponent {
  return CATEGORY_ICONS[categorySlug] ?? EngineeringIcon;
}
