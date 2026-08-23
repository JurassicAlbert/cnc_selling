#!/usr/bin/env node
/**
 * Generates on-brand placeholder images for the catalogue.
 *
 * There is no real product photography yet (D5, still open in
 * docs/HANDOVER.md) — nothing was downloaded from the web to stand in for
 * it. A stock photo of someone else's product, presented as if it depicted
 * this shop's actual work, would misrepresent what the business sells; that
 * is a form of the "nothing is faked" violation the project's own rules
 * forbid (docs/ARCHITECTURE.md §14), not a harmless stand-in. A plain,
 * honestly-labelled placeholder is the correct kind of fake: everyone who
 * sees it knows immediately that it is one.
 *
 * Output: static SVGs under public/images/placeholders/, served by Next.js
 * at /images/placeholders/<slug>.svg — referenced directly from
 * Category.imageUrl / ProductImage.url in prisma/seed.ts.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUTPUT_DIR = join(process.cwd(), 'public', 'images', 'placeholders');

// Matches src/ui/theme/theme.ts exactly — this script has no access to the
// running theme (it's a build-time asset generator, not part of the app),
// so the palette is duplicated here deliberately. If the theme palette ever
// changes, update both.
const PALETTE = {
  backgroundPaper: '#FFFFFF',
  divider: '#E6E0D8',
  textPrimary: '#1F1D1B',
  textSecondary: '#6B655E',
  secondary: '#A97B4F',
};

/**
 * @param {string} labelPl - the category/product name, shown large
 * @param {string} noticePl - the "this is a placeholder" line, shown small
 */
function placeholderSvg(labelPl, noticePl) {
  const width = 800;
  const height = 600;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(labelPl)} — ${escapeXml(noticePl)}">
  <rect width="${width}" height="${height}" fill="${PALETTE.backgroundPaper}" />
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" fill="none" stroke="${PALETTE.divider}" stroke-width="2" />
  <line x1="24" y1="24" x2="104" y2="24" stroke="${PALETTE.secondary}" stroke-width="4" />
  <line x1="24" y1="24" x2="24" y2="104" stroke="${PALETTE.secondary}" stroke-width="4" />
  <line x1="${width - 24}" y1="${height - 24}" x2="${width - 104}" y2="${height - 24}" stroke="${PALETTE.secondary}" stroke-width="4" />
  <line x1="${width - 24}" y1="${height - 24}" x2="${width - 24}" y2="${height - 104}" stroke="${PALETTE.secondary}" stroke-width="4" />
  <text x="50%" y="46%" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="40" fill="${PALETTE.textPrimary}">${escapeXml(labelPl)}</text>
  <text x="50%" y="56%" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="1" fill="${PALETTE.textSecondary}">${escapeXml(noticePl)}</text>
</svg>
`;
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const NOTICE_PL = 'zdjęcie w przygotowaniu';

/** slug -> the label shown on the placeholder */
const CATEGORY_IMAGES = {
  loft: 'Loft',
  'amulety-i-bransoletki': 'Amulety i bransoletki',
  gres: 'Gres',
  'panele-podlogowe': 'Panele podłogowe',
  'obrazy-drewniane': 'Obrazy',
  inne: 'Inne',
};

/** Same treatment for a design's own preview art and an installation diagram. */
const OTHER_IMAGES = {
  'wzor-podstawowy': ['Wzór', 'podgląd wzoru w przygotowaniu'],
  'instalacja-na-plytce': ['Montaż', 'diagram w przygotowaniu'],
};

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const [slug, labelPl] of Object.entries(CATEGORY_IMAGES)) {
    const svg = placeholderSvg(labelPl, NOTICE_PL);
    const path = join(OUTPUT_DIR, `${slug}.svg`);
    await writeFile(path, svg, 'utf8');
    console.log(`wrote ${path}`);
  }

  for (const [slug, [labelPl, noticePl]] of Object.entries(OTHER_IMAGES)) {
    const svg = placeholderSvg(labelPl, noticePl);
    const path = join(OUTPUT_DIR, `${slug}.svg`);
    await writeFile(path, svg, 'utf8');
    console.log(`wrote ${path}`);
  }
}

await main();
