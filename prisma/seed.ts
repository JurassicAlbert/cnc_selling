/**
 * Seed script.
 *
 * Two layers, run in order:
 *
 *   1. Structural baseline — rows the application cannot run without:
 *      the machine's real limits (D7), one placeholder pricing version (D4),
 *      the first admin account. Unconditional, every run.
 *   2. Catalogue — the owner's real category list (2026-08-23): loft
 *      furniture, engraved jewellery, gres kitchen backsplashes, engraved
 *      floor panels, wall art, and an "inne" catch-all. One representative
 *      product per category (except "inne", which stays empty — there is
 *      nothing concrete to describe in a catch-all).
 *
 * What is still deliberately NOT real:
 *
 *   - Every price (`TODO_PRICING`, D4) — invented round numbers, never to
 *     reach a customer before being replaced.
 *   - Every product/category/material photo — as of 2026-08-24, real,
 *     freely-licensed stock photography (Unsplash; source URLs are recorded
 *     next to each `STOCK_PHOTO` usage below), sourced specifically to
 *     match each category's actual subject (loft furniture, wood/laser
 *     jewellery, ceramic tile, engraved floor panels, engraved wall art),
 *     not generic filler. This is an explicit owner decision (2026-08-24),
 *     superseding the original "generated SVG placeholder" approach for
 *     photos specifically — see `docs/HANDOVER.md` for the redesign pass
 *     this belongs to. It is STILL a placeholder in the sense that matters:
 *     it is not a photo of this shop's own work, and must be swapped for
 *     real photography before launch, same as before — only the interim
 *     fidelity changed, not the "must swap" discipline.
 *   - The design's preview art and the installation diagram — still
 *     generated on-brand placeholder SVGs
 *     (`scripts/generate-placeholder-images.mjs`), NOT stock photos. Those
 *     two are a different kind of placeholder than "here is what a wooden
 *     stool looks like": one is the business's actual creative IP (a
 *     design's artwork), the other is specific technical instruction (an
 *     installation diagram) — a stock stand-in for either would be actively
 *     wrong, not just generic, so both keep the honestly-labelled SVG.
 *   - Every description below is a first, functional draft — plain and
 *     accurate rather than flowery, so it is serviceable if it accidentally
 *     ships unreviewed, but it is NOT final marketing copy and the owner
 *     should expect to rewrite it.
 *   - The one seeded `Design` row is explicitly named as a placeholder
 *     pattern (not a real engraving motif) for the same reason as the
 *     photos: a design's artwork is the business's actual creative IP,
 *     not something to invent.
 *   - 4 `BlogPost` rows (2026-08-25, owner's explicit request) — real,
 *     generic craft/material topics (wood care, the CNC/laser process,
 *     the materials used, what personalization means), no invented
 *     claims, numbers, or customer voices. A first draft, same
 *     "must be reviewed before launch" discipline as everything above —
 *     see `seedBlogPosts()`'s own comment for why this doesn't conflict
 *     with the no-fabricated-reviews rule. Each reuses an already-sourced
 *     category/material photo (2026-08-26, owner's follow-up request) —
 *     no new image sourcing for placeholder posts.
 *
 * What IS fully real, added 2026-08-24: the `Font` row (`seedFont`) — a
 * genuine, freely-licensed font file (`public/fonts/Inter-Variable.ttf`,
 * Google's own OFL repository) with its Polish-diacritic glyph coverage
 * parsed live from the actual cmap table every time this script runs, never
 * a hardcoded JSON blob. `minHeightUm` (the legibility floor) is this one's
 * placeholder number — a real value needs an actual test cut.
 *
 * Idempotent throughout: every row is upserted (or existence-checked first,
 * for models without a natural unique key — see `seedProductImage`).
 * Re-running this script must never duplicate or silently overwrite
 * something a human already edited through the future admin panel.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import opentype from 'opentype.js';

import { PrismaClient } from '../src/generated/prisma/client';
import { POLISH_SPECIFIC_LETTERS } from '../src/domain/personalization/validate';

const adapter = new PrismaPg({ connectionString: requireEnv('DATABASE_URL') });
const prisma = new PrismaClient({ adapter });

const PLACEHOLDER_IMAGE = (slug: string) => `/images/placeholders/${slug}.svg`;
/**
 * Real, freely-licensed stock photos (Unsplash License — free for
 * commercial/noncommercial use). Source URLs, for traceability when these
 * get replaced by real photography:
 *   loft.jpg                  unsplash.com/photos/photo-1604115556773-97387d5985b3
 *   amulety-i-bransoletki.jpg unsplash.com/photos/photo-1634833132196-fcbb1594e665
 *   gres.jpg                  unsplash.com/photos/photo-1614598632980-35ee54daa5b9
 *   panele-podlogowe.jpg      unsplash.com/photos/photo-1573869908170-64b53a60d8da
 *   obrazy-drewniane.jpg      unsplash.com/photos/photo-1744369618870-9d9f530faa3d
 *   inne.jpg                  unsplash.com/photos/photo-1781032040825-04240013c228
 *   material-dab.jpg          unsplash.com/photos/photo-1611072337226-1140ab367200
 */
const STOCK_PHOTO = (slug: string) => `/images/photos/${slug}.jpg`;

async function main(): Promise<void> {
  await seedMachineSettings();
  await seedPricingSettings();
  await seedFirstAdmin();

  const materials = await seedMaterials();
  const finishes = await seedFinishes();
  await seedMaterialFinishCompatibility(materials, finishes);
  const design = await seedDesign();
  const font = await seedFont();

  const categories = await seedCategories();
  await seedProducts(categories, materials, design, font);
  await seedBlogPosts();
}

// ---------------------------------------------------------------------------
// 1. Structural baseline
// ---------------------------------------------------------------------------

/**
 * D7, confirmed 2026-08-23 against the TwoTrees TTC6050 spec sheet
 * ("600 x 500 x 100 mm" working area, stated verbatim). `minModuleMm` is the
 * pre-existing 150mm assumption, kept after the owner's own "10mm" answer
 * turned out to describe material thickness, not the module-split floor.
 * `jointAllowanceMm` and `weeklyCapacityMinutes` have no resolved value yet —
 * left at their schema defaults (0) rather than invented.
 */
async function seedMachineSettings(): Promise<void> {
  const settings = await prisma.machineSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      usableWidthMm: 600,
      usableHeightMm: 500,
      minModuleMm: 150,
      maxWorkpieceThicknessMm: 100,
    },
    update: {
      usableWidthMm: 600,
      usableHeightMm: 500,
      minModuleMm: 150,
      maxWorkpieceThicknessMm: 100,
    },
  });
  console.log(
    `MachineSettings: ${settings.usableWidthMm}x${settings.usableHeightMm}mm usable, ` +
      `${settings.minModuleMm}mm min module, ${settings.maxWorkpieceThicknessMm}mm max thickness`,
  );
}

/**
 * D4, resolved 2026-08-23: seed placeholder numbers, clearly marked, so the
 * pricing pipeline is testable end to end before real rates exist. Every
 * value below is invented and MUST be replaced before any price is shown to
 * a customer — that is what `notePl` says, in the one place a future admin
 * screen would actually display it.
 *
 * Only ever creates version 1, and only if no PricingSettings row exists.
 * Once a real rate set is published, this function becomes a no-op forever —
 * versioning happens through the (future) admin pricing screen, never here.
 */
async function seedPricingSettings(): Promise<void> {
  const existing = await prisma.pricingSettings.findFirst();
  if (existing !== null) {
    console.log(`PricingSettings: version ${existing.version} already exists, leaving it alone`);
    return;
  }

  const created = await prisma.pricingSettings.create({
    data: {
      version: 1,
      // TODO_PRICING — every rate below is an invented placeholder (D4).
      machineRateCncGrosze: 15_000, // 150,00 zł/min-equivalent, invented
      machineRateLaserGrosze: 12_000, // 120,00 zł/min-equivalent, invented
      moduleSurchargeGrosze: 4_000, // 40,00 zł per extra module, invented
      packagingTiers: [
        { maxAreaM2: 0.5, maxModules: 1, priceGrosze: 1_500 },
        { maxAreaM2: 2, maxModules: 4, priceGrosze: 4_500 },
        { maxAreaM2: null, maxModules: null, priceGrosze: 9_000 },
      ],
      vatRateBp: 2_300, // 23% — the one number here that IS real (PL standard rate)
      isActive: true,
      publishedAt: new Date(),
      publishedByEmail: 'seed-script',
      notePl:
        'TODO_PRICING: wartości tymczasowe wpisane przez skrypt seed. ' +
        'Nie pokazywać klientowi przed zastąpieniem realnymi stawkami.',
    },
  });
  console.log(`PricingSettings: created version ${created.version} (TODO_PRICING placeholders)`);
}

/**
 * The first ADMIN. Seeded from the project owner's own email so there is an
 * account to sign in with the moment Auth.js is wired up in P0's remaining
 * Next.js work — there is no other path to this role (§16.3).
 */
async function seedFirstAdmin(): Promise<void> {
  const email = requireEnv('SEED_ADMIN_EMAIL');
  const admin = await prisma.user.upsert({
    where: { email },
    create: { email, role: 'ADMIN', name: 'Admin' },
    update: { role: 'ADMIN' },
  });
  console.log(`User: ${admin.email} is ADMIN`);
}

// ---------------------------------------------------------------------------
// 2. Catalogue — materials, finishes, the placeholder design
// ---------------------------------------------------------------------------

type SeededMaterials = { readonly dab: { readonly id: string }; readonly gres: { readonly id: string } };

/**
 * Two materials, deliberately minimal: oak (wood, used by four of the five
 * real categories) and white gres (ceramic, used by the gres category
 * itself). Metal and leather for the jewellery line exist as a decision —
 * "keep hidden for now, possible to unlock" — but are NOT seeded here.
 * Leather needs no schema change when that day comes (the `LEATHER`
 * `MaterialFamily` value already exists); metal does (no `METAL` value
 * exists yet). Both are deferred rather than half-seeded as invisible rows,
 * so there is nothing to forget was there.
 */
async function seedMaterials(): Promise<SeededMaterials> {
  const dab = await prisma.material.upsert({
    where: { slug: 'dab' },
    create: {
      slug: 'dab',
      namePl: 'Dąb',
      family: 'SOLID_WOOD',
      shortDescPl: 'Lite drewno dębowe, ciepły ton i wyraźny rysunek słojów.',
      characteristicsPl:
        'Drewno naturalne — usłojenie, odcień i ewentualne sęki różnią się w każdym egzemplarzu.',
      imageUrl: STOCK_PHOTO('material-dab'),
      pricePerM2Grosze: 18_000, // TODO_PRICING
      maxSheetWidthMm: 1200,
      maxSheetHeightMm: 2400,
      minLineWidthUm: 1_200,
      minDetailSpacingUm: 2_000,
      minTextHeightUm: 6_000,
      grainDirection: 'LENGTHWISE',
      supportsCnc: true,
      supportsLaser: true,
      isNaturalVariable: true,
      isAvailable: true,
    },
    update: {},
  });

  const gres = await prisma.material.upsert({
    where: { slug: 'gres-bialy' },
    create: {
      slug: 'gres-bialy',
      namePl: 'Gres biały',
      family: 'CERAMIC',
      shortDescPl: 'Gres wielkoformatowy, jednolita biała powierzchnia pod grawer.',
      characteristicsPl: 'Materiał produkowany — bez naturalnych odchyleń koloru między sztukami.',
      imageUrl: STOCK_PHOTO('gres'),
      pricePerM2Grosze: 22_000, // TODO_PRICING
      maxSheetWidthMm: 600,
      maxSheetHeightMm: 1200,
      minLineWidthUm: 800,
      minDetailSpacingUm: 1_200,
      minTextHeightUm: 4_000,
      grainDirection: 'NONE',
      supportsCnc: false, // too hard for the TTC6050's wood router bits
      supportsLaser: true,
      isNaturalVariable: false,
      isAvailable: true,
    },
    update: {},
  });

  console.log(`Material: ${dab.namePl}, ${gres.namePl}`);
  return { dab, gres };
}

type SeededFinishes = { readonly olejowanie: { readonly id: string } };

async function seedFinishes(): Promise<SeededFinishes> {
  const olejowanie = await prisma.finish.upsert({
    where: { slug: 'olejowanie' },
    create: {
      slug: 'olejowanie',
      namePl: 'Olejowanie',
      kind: 'OIL',
      descPl: 'Naturalny olej podkreślający usłojenie drewna, chroni powierzchnię.',
      imageUrl: STOCK_PHOTO('material-dab'),
      pricePerM2Grosze: 4_000, // TODO_PRICING
      setupFeeGrosze: 0,
      extraDaysMin: 1,
      extraDaysMax: 2,
      isAvailable: true,
    },
    update: {},
  });
  console.log(`Finish: ${olejowanie.namePl}`);
  return { olejowanie };
}

async function seedMaterialFinishCompatibility(
  materials: SeededMaterials,
  finishes: SeededFinishes,
): Promise<void> {
  // Oak can be oiled. Gres is not finished the same way — no row for it,
  // which means the FINISH step for gres products currently has nothing to
  // offer. Acceptable for P2 (catalogue display); a real gap for P3
  // (configurator) to close before that step ships for KITCHEN_TILE.
  await prisma.materialFinish.upsert({
    where: {
      materialId_finishId: { materialId: materials.dab.id, finishId: finishes.olejowanie.id },
    },
    create: { materialId: materials.dab.id, finishId: finishes.olejowanie.id },
    update: {},
  });
}

type SeededDesign = { readonly id: string };

/**
 * One placeholder pattern, named as one. A design's artwork is the
 * business's actual creative IP — not something to invent, same as product
 * photography. Production metadata (line width, machining time, detail
 * level) is engineering estimate, not creative content, so it gets
 * reasonable placeholder numbers rather than being left unset; nothing here
 * can be priced or feasibility-checked without them.
 */
async function seedDesign(): Promise<SeededDesign> {
  const design = await prisma.design.upsert({
    where: { slug: 'wzor-podstawowy' },
    create: {
      slug: 'wzor-podstawowy',
      code: 'WZR-001',
      namePl: 'Wzór podstawowy — do zastąpienia',
      descPl: 'Wzór zastępczy używany do testowania katalogu przed dodaniem prawdziwych projektów.',
      tags: ['placeholder'],
      thumbnailUrl: PLACEHOLDER_IMAGE('wzor-podstawowy'),
      previewUrl: PLACEHOLDER_IMAGE('wzor-podstawowy'),
      isActive: true,
      referenceWidthMm: 600,
      minLineWidthUm: 1_200,
      minDetailSpacingUm: 2_000,
      recommendedMethod: 'CNC_CARVE',
      minRecommendedWidthMm: 300,
      detailLevel: 3,
      machiningMilliMinutesPerM2: 2_500,
      rightsStatus: 'APPROVED_COMMERCIAL',
      rightsNotes:
        'Wzór zastępczy stworzony na potrzeby seeda — do wymiany na prawdziwy projekt przed uruchomieniem sklepu.',
    },
    update: {},
  });
  console.log(`Design: ${design.code} (${design.namePl})`);
  return design;
}

/**
 * The first real engraving font — the `Font` model's own header comment
 * (`prisma/schema.prisma`) says coverage is "parsed from the font's cmap
 * table at seed time and stored — never assumed from the font's name or its
 * declared language support." This function is that parse, run for real
 * against a real file every time the seed runs, not a JSON blob copied in
 * once and left to go stale.
 *
 * Inter, not a placeholder pick: it is the site's own self-hosted body face
 * (`src/ui/theme/fonts.ts`), already relied on for real Polish body copy
 * sitewide, SIL Open Font License (`public/fonts/Inter-OFL.txt`, MIT-compatible
 * for this purpose), and a genuinely plausible real-world choice for
 * laser-engraved text — a clean sans-serif alongside decorative faces is
 * common in real engraving shops. `public/fonts/Inter-Variable.ttf` was
 * downloaded from Google's own OFL font repository
 * (github.com/google/fonts, ofl/inter) — the exact file this function reads.
 * `minHeightUm` (3mm) is this pass's one invented number here, same
 * TODO_PRICING-style placeholder discipline as everywhere else — a real
 * legibility floor needs an actual test cut, not a guess.
 */
async function seedFont(): Promise<{ readonly id: string }> {
  const fontPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../public/fonts/Inter-Variable.ttf',
  );
  const buffer = readFileSync(fontPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const parsed = opentype.parse(arrayBuffer);
  const cmap = parsed.tables.cmap as { glyphIndexMap: Record<string, number> };
  const codePoints = Object.keys(cmap.glyphIndexMap).map(Number);
  const codePointSet = new Set(codePoints);
  const ranges = compressToRanges(codePoints);

  const supportsPolishDiacritics = [...POLISH_SPECIFIC_LETTERS].every((letter) => {
    const codePoint = letter.codePointAt(0);
    return codePoint !== undefined && codePointSet.has(codePoint);
  });
  if (!supportsPolishDiacritics) {
    throw new Error(
      'seedFont: Inter-Variable.ttf is missing a Polish-specific glyph — re-check the downloaded file, do not seed a font that fails this.',
    );
  }

  const font = await prisma.font.upsert({
    where: { slug: 'inter' },
    create: {
      slug: 'inter',
      namePl: 'Inter',
      fileUrl: '/fonts/Inter-Variable.ttf',
      minHeightUm: 3_000,
      coveredCodePointRanges: ranges,
      supportsPolishDiacritics: true,
      isActive: true,
      sortOrder: 0,
    },
    update: {
      coveredCodePointRanges: ranges,
      supportsPolishDiacritics: true,
    },
  });
  console.log(
    `Font: ${font.namePl} (${codePoints.length} glyphs, ${ranges.length} ranges, parsed live from ${fontPath})`,
  );
  return font;
}

/**
 * A cmap's covered code points as inclusive [start, end] pairs — a real
 * face covers thousands of individual code points, and most of them are
 * already contiguous Unicode blocks, so this keeps the stored JSON small
 * without losing anything `toFontSpec` needs to reconstruct the exact set.
 */
function compressToRanges(codePoints: readonly number[]): Array<[number, number]> {
  const sorted = [...codePoints].sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  for (const codePoint of sorted) {
    const last = ranges[ranges.length - 1];
    if (last !== undefined && codePoint === last[1] + 1) {
      last[1] = codePoint;
    } else {
      ranges.push([codePoint, codePoint]);
    }
  }
  return ranges;
}

// ---------------------------------------------------------------------------
// 3. Catalogue — categories and products
// ---------------------------------------------------------------------------

type CategorySeed = {
  readonly slug: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly sortOrder: number;
};

/**
 * The owner's real category list, confirmed 2026-08-23 — see
 * docs/ARCHITECTURE.md §5 for how each maps onto `ProductTypeCode`. "Inne"
 * is seeded with no product: it is an open catch-all by definition, and
 * inventing a concrete item for it would be less honest than leaving it
 * empty until a real one exists.
 */
const CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    slug: 'loft',
    namePl: 'Loft',
    descPl:
      'Stołki, półki i małe stoliki łączące metalową podstawę w stylu loft z drewnianym blatem z grawerem.',
    seoTitlePl: 'Meble loft z grawerem — stołki, półki, stoliki',
    seoDescPl: 'Drewniane blaty z grawerem na metalowej podstawie w stylu loft. Wykonanie na zamówienie.',
    sortOrder: 1,
  },
  {
    slug: 'amulety-i-bransoletki',
    namePl: 'Amulety i bransoletki',
    descPl: 'Drobna biżuteria z drewna z grawerem — amulety i bransoletki na indywidualne zamówienie.',
    seoTitlePl: 'Amulety i bransoletki z grawerem',
    seoDescPl: 'Drewniane amulety i bransoletki z personalizowanym grawerem.',
    sortOrder: 2,
  },
  {
    slug: 'gres',
    namePl: 'Gres',
    descPl: 'Fartuchy kuchenne z gresu z grawerem — trwałe wykończenie ściany nad blatem.',
    seoTitlePl: 'Fartuchy kuchenne z gresu z grawerem',
    seoDescPl: 'Gresowe fartuchy kuchenne z grawerowanym wzorem, dopasowane na wymiar.',
    sortOrder: 3,
  },
  {
    slug: 'panele-podlogowe',
    namePl: 'Panele podłogowe',
    descPl: 'Drewniane panele podłogowe z grawerem, wykonywane na dokładny wymiar.',
    seoTitlePl: 'Drewniane panele podłogowe z grawerem',
    seoDescPl: 'Panele podłogowe z drewna z grawerowanym wzorem, wykonanie na wymiar.',
    sortOrder: 4,
  },
  {
    slug: 'obrazy-drewniane',
    namePl: 'Obrazy',
    descPl: 'Obrazy z drewna z grawerem — gotowe wzory lub własny projekt.',
    seoTitlePl: 'Obrazy drewniane z grawerem',
    seoDescPl: 'Drewniane obrazy z grawerowanym wzorem, z możliwością personalizacji.',
    sortOrder: 5,
  },
  {
    slug: 'inne',
    namePl: 'Inne',
    descPl: 'Projekty nietypowe, wykraczające poza pozostałe kategorie — wycena indywidualna.',
    seoTitlePl: 'Inne realizacje z grawerem',
    seoDescPl: 'Nietypowe zlecenia z grawerem, wykonywane na indywidualne zamówienie.',
    sortOrder: 6,
  },
];

async function seedCategories(): Promise<Record<string, { readonly id: string }>> {
  const result: Record<string, { readonly id: string }> = {};
  for (const seed of CATEGORY_SEEDS) {
    const category = await prisma.category.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        namePl: seed.namePl,
        descPl: seed.descPl,
        seoTitlePl: seed.seoTitlePl,
        seoDescPl: seed.seoDescPl,
        imageUrl: STOCK_PHOTO(seed.slug),
        sortOrder: seed.sortOrder,
      },
      update: {},
    });
    result[seed.slug] = category;
    console.log(`Category: ${category.namePl} (/${seed.slug})`);
  }
  return result;
}

// ---------------------------------------------------------------------------
// 4. Blog — placeholder posts
// ---------------------------------------------------------------------------

type BlogPostSeed = {
  readonly slug: string;
  readonly titlePl: string;
  readonly shortDescPl: string;
  readonly bodyPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly publishedAt: Date;
  /** Reuses an already-sourced category/material photo (`STOCK_PHOTO`) — no new image sourcing for placeholder posts. */
  readonly imageUrl: string;
};

/**
 * Explicit, one-time exception to this project's "nothing is faked" rule
 * — added 2026-08-25 at the owner's direct request, so the new homepage
 * blog section and `/blog` render real content instead of the empty
 * state. This is NOT the same category of fabrication `docs/ARCHITECTURE.md`
 * §16A.1 module 9 forbids (reviews/testimonials in a customer's voice) —
 * these are generic, genuinely-useful craft/material topics the business
 * could really publish, with no invented numbers, dates, or customer
 * claims. Same discipline as `TODO_PRICING`: a real first draft, safe to
 * demo, must be reviewed and replaced with the owner's own words before
 * launch.
 */
const BLOG_POST_SEEDS: readonly BlogPostSeed[] = [
  {
    slug: 'jak-dbac-o-drewniane-produkty-z-grawerem',
    titlePl: 'Jak dbać o drewniane produkty z grawerem',
    shortDescPl:
      'Kilka prostych zasad pielęgnacji, dzięki którym drewniany produkt z grawerem posłuży przez lata.',
    bodyPl:
      'Drewno to materiał naturalny — reaguje na wilgotność i temperaturę otoczenia, dlatego warto unikać stawiania produktów bezpośrednio nad grzejnikiem lub w miejscu z dużymi wahaniami wilgotności.\n\nDo czyszczenia na co dzień wystarczy sucha lub lekko wilgotna ściereczka. Należy unikać silnych detergentów i moczenia elementu w wodzie — może to uszkodzić zarówno drewno, jak i wykończenie olejem.\n\nGrawerowane wzory z czasem mogą lekko pociemnieć wraz z naturalnym starzeniem się drewna — to normalny proces, który nie wpływa na trwałość wzoru.\n\nRegularne, delikatne naoliwienie (raz na kilka miesięcy, zależnie od intensywności użytkowania) pomaga utrzymać naturalny wygląd i chroni powierzchnię przed wysychaniem.',
    seoTitlePl: 'Jak dbać o drewniane produkty z grawerem — CNC Selling',
    seoDescPl: 'Proste zasady pielęgnacji drewnianych produktów z grawerem, aby służyły przez lata.',
    publishedAt: new Date('2026-08-01T09:00:00Z'),
    imageUrl: STOCK_PHOTO('material-dab'),
  },
  {
    slug: 'jak-powstaje-grawer-cnc-i-laserowy',
    titlePl: 'Jak powstaje grawer CNC i laserowy',
    shortDescPl: 'Krótkie wyjaśnienie, czym różni się frezowanie CNC od grawerowania laserowego.',
    bodyPl:
      'Frezowanie CNC polega na precyzyjnym usuwaniu materiału za pomocą obracającej się frezarki, sterowanej komputerowo według wcześniej przygotowanego projektu. Sprawdza się przy głębszych, wyraźnie wyczuwalnych fakturowo wzorach.\n\nGrawerowanie laserowe działa inaczej — skupiona wiązka światła wypala lub przebarwia powierzchnię materiału, co pozwala uzyskać bardzo drobne detale i delikatne cieniowanie, niemożliwe do wykonania frezem.\n\nWybór metody zależy od materiału, wielkości detali wzoru i efektu, jaki ma zostać osiągnięty — czasem obie techniki są łączone w jednym produkcie.\n\nKażdy projekt jest najpierw sprawdzany pod kątem wykonalności — minimalnej grubości linii i odstępów między detalami — zanim trafi do produkcji.',
    seoTitlePl: 'Jak powstaje grawer CNC i laserowy — CNC Selling',
    seoDescPl: 'Czym różni się frezowanie CNC od grawerowania laserowego i kiedy stosujemy każdą z technik.',
    publishedAt: new Date('2026-08-10T09:00:00Z'),
    imageUrl: STOCK_PHOTO('inne'),
  },
  {
    slug: 'dab-i-gres-materialy-ktore-wykorzystujemy',
    titlePl: 'Dąb i gres — materiały, które wykorzystujemy',
    shortDescPl: 'Krótko o tym, dlaczego akurat te materiały trafiły do naszej oferty.',
    bodyPl:
      'Dąb to twarde, naturalne drewno o wyraźnym rysunku słojów — każdy egzemplarz jest inny, co sprawia, że gotowy produkt jest unikalny. Dobrze znosi grawerowanie zarówno CNC, jak i laserowe, a przy odpowiedniej pielęgnacji zachowuje trwałość na lata.\n\nGres to materiał ceramiczny o wysokiej odporności na wilgoć i uszkodzenia mechaniczne — sprawdza się szczególnie tam, gdzie drewno nie byłoby praktycznym wyborem, na przykład jako fartuch kuchenny nad blatem roboczym.\n\nOba materiały mają swoje realne ograniczenia — minimalną grubość linii wzoru czy maksymalny rozmiar arkusza — które są uwzględniane już na etapie konfiguracji produktu, aby zamówienie było wykonalne w praktyce, nie tylko w projekcie.',
    seoTitlePl: 'Dąb i gres — materiały, które wykorzystujemy — CNC Selling',
    seoDescPl: 'Dlaczego dąb i gres trafiły do oferty i czym różnią się jako materiały pod grawer.',
    publishedAt: new Date('2026-08-18T09:00:00Z'),
    imageUrl: STOCK_PHOTO('gres'),
  },
  {
    slug: 'czym-jest-personalizacja-grawerem',
    titlePl: 'Czym jest personalizacja grawerem',
    shortDescPl: 'Jak działa dodanie własnego tekstu do produktu i na co zwrócić uwagę.',
    bodyPl:
      'Personalizacja pozwala dodać własny tekst — na przykład imię, datę lub krótką sentencję — bezpośrednio na powierzchni produktu, w wybranym kroju pisma.\n\nNie każdy krój pisma obsługuje wszystkie znaki, dlatego przed zatwierdzeniem tekstu sprawdzane jest realne pokrycie glifów w wybranej czcionce — łącznie z polskimi znakami diakrytycznymi, takimi jak „ł" czy „ę".\n\nDługość tekstu i liczba wierszy są ograniczone przez rozmiar produktu — zbyt drobny tekst mógłby nie zostać precyzyjnie wykonany, dlatego minimalna wysokość liter jest sprawdzana automatycznie podczas konfiguracji.\n\nNie każdy produkt oferuje personalizację — dostępność tej opcji zależy od konkretnego wyrobu i jest zawsze widoczna wprost w konfiguratorze.',
    seoTitlePl: 'Czym jest personalizacja grawerem — CNC Selling',
    seoDescPl: 'Jak działa personalizacja tekstem i na co zwrócić uwagę przy wyborze kroju pisma.',
    publishedAt: new Date('2026-08-24T09:00:00Z'),
    imageUrl: STOCK_PHOTO('obrazy-drewniane'),
  },
];

async function seedBlogPosts(): Promise<void> {
  for (const seed of BLOG_POST_SEEDS) {
    const post = await prisma.blogPost.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        titlePl: seed.titlePl,
        shortDescPl: seed.shortDescPl,
        bodyPl: seed.bodyPl,
        seoTitlePl: seed.seoTitlePl,
        seoDescPl: seed.seoDescPl,
        publishedAt: seed.publishedAt,
        imageUrl: seed.imageUrl,
      },
      // Re-asserted on every run: the 4 posts were originally seeded
      // 2026-08-25 with no image, so an existing dev database needs this
      // repaired on the next `db:seed`, not left stuck without one.
      update: { imageUrl: seed.imageUrl },
    });
    console.log(`BlogPost: ${post.titlePl} (/blog/${seed.slug})`);
  }
}

async function seedProducts(
  categories: Record<string, { readonly id: string }>,
  materials: SeededMaterials,
  design: SeededDesign,
  font: { readonly id: string },
): Promise<void> {
  const loft = categories.loft;
  const amulety = categories['amulety-i-bransoletki'];
  const gres = categories.gres;
  const panele = categories['panele-podlogowe'];
  const obrazy = categories['obrazy-drewniane'];
  if (
    loft === undefined ||
    amulety === undefined ||
    gres === undefined ||
    panele === undefined ||
    obrazy === undefined
  ) {
    throw new Error('seedCategories must run before seedProducts');
  }

  const loftStool = await upsertProduct({
    slug: 'stolek-loftowy-z-grawerem',
    typeCode: 'LOFT_FURNITURE',
    categoryId: loft.id,
    namePl: 'Stołek loftowy z grawerem',
    shortDescPl: 'Dębowy blat z grawerem na metalowej podstawie w stylu loft.',
    longDescPl:
      'Stołek z dębowym siedziskiem z grawerowanym wzorem. Podstawa metalowa w stylu loft dostępna jako dodatek.',
    careInstructionsPl: 'Czyścić suchą lub lekko wilgotną ściereczką. Unikać długiego kontaktu z wodą.',
    materialNotesPl: 'Podstawa metalowa w stylu loft dostępna jako dodatek — zapytaj o wycenę.',
    seoTitlePl: 'Stołek loftowy z grawerem — dąb',
    seoDescPl: 'Dębowy stołek z grawerowanym wzorem, podstawa loft dostępna jako dodatek.',
    basePriceGrosze: 15_000,
    minPriceGrosze: 20_000,
    productionDaysMin: 5,
    productionDaysMax: 10,
    minWidthMm: 250,
    maxWidthMm: 400,
    minHeightMm: 250,
    maxHeightMm: 400,
  });
  await seedProductThicknesses(loftStool.id, [
    { thicknessMm: 27, labelPl: '27 mm' },
    { thicknessMm: 40, labelPl: '40 mm' },
  ]);
  await seedProductMaterial(loftStool.id, materials.dab.id);
  await seedProductDesign(loftStool.id, design.id);
  await seedProductImage(loftStool.id, STOCK_PHOTO('loft'), 'Stołek loftowy z grawerem — stal i drewno w stylu loft');
  await seedPersonalizationSpec(loftStool.id, {
    maxCharacters: 30,
    maxLines: 2,
    minTextHeightUm: 8_000,
    allowedFontIds: [font.id],
  });

  const bransoletka = await upsertProduct({
    slug: 'bransoletka-z-grawerem',
    typeCode: 'JEWELRY',
    categoryId: amulety.id,
    namePl: 'Bransoletka z grawerem',
    shortDescPl: 'Drewniana bransoletka z personalizowanym grawerem.',
    longDescPl: 'Bransoletka wykonana z drewna dębowego, z możliwością grawerowanej personalizacji.',
    careInstructionsPl: 'Unikać kontaktu z wodą i chemikaliami. Przechowywać w suchym miejscu.',
    materialNotesPl: null,
    seoTitlePl: 'Bransoletka z grawerem — drewno dębowe',
    seoDescPl: 'Drewniana bransoletka z personalizowanym grawerem, wykonanie na zamówienie.',
    basePriceGrosze: 3_000,
    minPriceGrosze: 4_000,
    productionDaysMin: 3,
    productionDaysMax: 7,
    minWidthMm: 40,
    maxWidthMm: 220,
    minHeightMm: 15,
    maxHeightMm: 30,
  });
  await seedProductMaterial(bransoletka.id, materials.dab.id);
  await seedProductDesign(bransoletka.id, design.id);
  await seedProductImage(
    bransoletka.id,
    STOCK_PHOTO('amulety-i-bransoletki'),
    'Drewniana bransoletka z grawerem',
  );
  await seedPersonalizationSpec(bransoletka.id, {
    maxCharacters: 20,
    maxLines: 1,
    minTextHeightUm: 3_000,
    allowedFontIds: [font.id],
  });

  const fartuch = await upsertProduct({
    slug: 'fartuch-kuchenny-z-grawerem',
    typeCode: 'KITCHEN_TILE',
    categoryId: gres.id,
    namePl: 'Fartuch kuchenny z grawerem',
    shortDescPl: 'Gresowy fartuch kuchenny z grawerowanym wzorem.',
    longDescPl: 'Fartuch kuchenny wykonany z gresu, z grawerowanym wzorem, wykonanie na wymiar.',
    careInstructionsPl: 'Czyścić standardowymi środkami do ceramiki. Odporny na wilgoć i wysoką temperaturę.',
    materialNotesPl: null,
    installationInfoPl: 'Wybierz sposób montażu w pierwszym kroku konfiguracji — patrz warianty montażu.',
    seoTitlePl: 'Fartuch kuchenny z gresu z grawerem',
    seoDescPl: 'Gresowy fartuch kuchenny z grawerowanym wzorem, dopasowany na wymiar.',
    basePriceGrosze: 30_000,
    minPriceGrosze: 40_000,
    productionDaysMin: 7,
    productionDaysMax: 14,
    minWidthMm: 300,
    maxWidthMm: 1200,
    minHeightMm: 300,
    maxHeightMm: 700,
  });
  await seedProductMaterial(fartuch.id, materials.gres.id);
  await seedProductDesign(fartuch.id, design.id);
  await seedProductImage(fartuch.id, STOCK_PHOTO('gres'), 'Biały gres z grawerowanym wzorem');
  await seedInstallationVariant(fartuch.id, {
    code: 'ON_TOP',
    namePl: 'Montaż na istniejącym fartuchu',
    descPl: 'Element montowany na powierzchni istniejącego fartucha kuchennego.',
    receivesPl: 'Otrzymujesz gotowy panel gresowy z grawerem, przygotowany do montażu na istniejącej powierzchni.',
  });

  const panel = await upsertProduct({
    slug: 'panel-podlogowy-z-grawerem',
    typeCode: 'FLOOR_ELEMENT',
    categoryId: panele.id,
    namePl: 'Panel podłogowy z grawerem',
    shortDescPl: 'Dębowy panel podłogowy z grawerowanym wzorem, wykonanie na dokładny wymiar.',
    longDescPl:
      'Panel podłogowy z drewna dębowego z grawerowanym wzorem. Produkt wykonywany na dokładny wymiar podany przez klienta.',
    careInstructionsPl: 'Czyścić zgodnie z zaleceniami dla podłóg drewnianych. Unikać nadmiaru wody.',
    materialNotesPl: null,
    seoTitlePl: 'Drewniany panel podłogowy z grawerem',
    seoDescPl: 'Dębowy panel podłogowy z grawerowanym wzorem, wykonanie na wymiar.',
    basePriceGrosze: 25_000,
    minPriceGrosze: 30_000,
    productionDaysMin: 7,
    productionDaysMax: 14,
    requiresExactSize: true,
    minWidthMm: 100,
    maxWidthMm: 1200,
    minHeightMm: 100,
    maxHeightMm: 200,
  });
  await seedProductThicknesses(panel.id, [
    { thicknessMm: 14, labelPl: '14 mm' },
    { thicknessMm: 20, labelPl: '20 mm' },
  ]);
  await seedProductMaterial(panel.id, materials.dab.id);
  await seedProductDesign(panel.id, design.id);
  await seedProductImage(
    panel.id,
    STOCK_PHOTO('panele-podlogowe'),
    'Dębowy panel podłogowy z grawerem',
  );

  const obraz = await upsertProduct({
    slug: 'obraz-drewniany-z-grawerem',
    typeCode: 'WALL_ART',
    categoryId: obrazy.id,
    namePl: 'Obraz drewniany z grawerem',
    shortDescPl: 'Dębowy obraz ścienny z grawerowanym wzorem.',
    longDescPl: 'Obraz z drewna dębowego z grawerowanym wzorem, z możliwością personalizacji tekstem.',
    careInstructionsPl: 'Czyścić suchą ściereczką. Chronić przed bezpośrednim nasłonecznieniem.',
    materialNotesPl: null,
    seoTitlePl: 'Obraz drewniany z grawerem — dąb',
    seoDescPl: 'Dębowy obraz ścienny z grawerowanym wzorem, z możliwością personalizacji.',
    basePriceGrosze: 12_000,
    minPriceGrosze: 15_000,
    productionDaysMin: 5,
    productionDaysMax: 10,
    minWidthMm: 200,
    maxWidthMm: 1200,
    minHeightMm: 200,
    maxHeightMm: 1200,
  });
  await seedProductMaterial(obraz.id, materials.dab.id);
  await seedProductDesign(obraz.id, design.id);
  await seedProductImage(
    obraz.id,
    STOCK_PHOTO('obrazy-drewniane'),
    'Obraz drewniany z grawerem',
  );
  await seedPersonalizationSpec(obraz.id, {
    maxCharacters: 40,
    maxLines: 2,
    minTextHeightUm: 6_000,
    allowedFontIds: [font.id],
  });

  console.log('Products: 5 seeded (loft, amulety, gres, panele, obrazy) — "inne" left empty by design');
}

// ---------------------------------------------------------------------------
// Product sub-entity helpers
// ---------------------------------------------------------------------------

type ProductSeedInput = {
  readonly slug: string;
  readonly typeCode: 'WALL_ART' | 'TABLE_TOP' | 'KITCHEN_TILE' | 'FLOOR_ELEMENT' | 'CUSTOM' | 'LOFT_FURNITURE' | 'JEWELRY';
  readonly categoryId: string;
  readonly namePl: string;
  readonly shortDescPl: string;
  readonly longDescPl: string;
  readonly careInstructionsPl: string;
  readonly materialNotesPl: string | null;
  readonly installationInfoPl?: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly basePriceGrosze: number;
  readonly minPriceGrosze: number;
  readonly productionDaysMin: number;
  readonly productionDaysMax: number;
  readonly requiresExactSize?: boolean;
  readonly minWidthMm: number;
  readonly maxWidthMm: number;
  readonly minHeightMm: number;
  readonly maxHeightMm: number;
};

async function upsertProduct(input: ProductSeedInput): Promise<{ readonly id: string }> {
  const product = await prisma.product.upsert({
    where: { slug: input.slug },
    create: {
      slug: input.slug,
      typeCode: input.typeCode,
      categoryId: input.categoryId,
      namePl: input.namePl,
      shortDescPl: input.shortDescPl,
      longDescPl: input.longDescPl,
      careInstructionsPl: input.careInstructionsPl,
      materialNotesPl: input.materialNotesPl,
      installationInfoPl: input.installationInfoPl,
      seoTitlePl: input.seoTitlePl,
      seoDescPl: input.seoDescPl,
      basePriceGrosze: input.basePriceGrosze,
      minPriceGrosze: input.minPriceGrosze,
      productionDaysMin: input.productionDaysMin,
      productionDaysMax: input.productionDaysMax,
      requiresExactSize: input.requiresExactSize ?? false,
      minWidthMm: input.minWidthMm,
      maxWidthMm: input.maxWidthMm,
      minHeightMm: input.minHeightMm,
      maxHeightMm: input.maxHeightMm,
    },
    update: {},
  });
  console.log(`Product: ${product.namePl} (/${input.slug})`);
  return product;
}

async function seedProductThicknesses(
  productId: string,
  thicknesses: readonly { readonly thicknessMm: number; readonly labelPl: string }[],
): Promise<void> {
  for (const t of thicknesses) {
    await prisma.productThickness.upsert({
      where: { productId_thicknessMm: { productId, thicknessMm: t.thicknessMm } },
      create: { productId, thicknessMm: t.thicknessMm, labelPl: t.labelPl },
      update: {},
    });
  }
}

async function seedProductMaterial(productId: string, materialId: string): Promise<void> {
  await prisma.productMaterial.upsert({
    where: { productId_materialId: { productId, materialId } },
    create: { productId, materialId },
    update: {},
  });
}

async function seedProductDesign(productId: string, designId: string): Promise<void> {
  await prisma.productDesign.upsert({
    where: { productId_designId: { productId, designId } },
    create: { productId, designId },
    update: {},
  });
}

/**
 * ProductImage has no natural unique key beyond its cuid `id`, so a plain
 * `create` would duplicate the row on every rerun. Existence is checked by
 * (productId, url) instead — good enough for one placeholder image per
 * product; a real multi-photo gallery will need a proper key when it exists.
 */
async function seedProductImage(productId: string, url: string, altPl: string): Promise<void> {
  const existing = await prisma.productImage.findFirst({ where: { productId, url } });
  if (existing !== null) {
    return;
  }
  await prisma.productImage.create({
    data: { productId, url, altPl, isPrimary: true, sortOrder: 0 },
  });
}

async function seedPersonalizationSpec(
  productId: string,
  spec: {
    readonly maxCharacters: number;
    readonly maxLines: number;
    readonly minTextHeightUm: number;
    readonly allowedFontIds: readonly string[];
  },
): Promise<void> {
  await prisma.personalizationSpec.upsert({
    where: { productId },
    create: {
      productId,
      isEnabled: true,
      maxCharacters: spec.maxCharacters,
      maxLines: spec.maxLines,
      minTextHeightUm: spec.minTextHeightUm,
      pricePerCharGrosze: 50, // TODO_PRICING
      flatFeeGrosze: 1_000, // TODO_PRICING
      allowedFontIds: [...spec.allowedFontIds],
    },
    // Re-asserted on every run, same as the first-admin `role: 'ADMIN'`
    // update above: `allowedFontIds` used to be an unconditional `[]`
    // placeholder ("no Font rows seeded yet"), so an existing dev database
    // seeded before this pass needs it repaired on the next `db:seed`, not
    // left stuck at the old placeholder forever.
    update: { allowedFontIds: [...spec.allowedFontIds] },
  });
}

async function seedInstallationVariant(
  productId: string,
  variant: {
    readonly code: 'ON_TOP' | 'OVERLAY' | 'REPLACEMENT';
    readonly namePl: string;
    readonly descPl: string;
    readonly receivesPl: string;
  },
): Promise<void> {
  await prisma.installationVariant.upsert({
    where: { productId_code: { productId, code: variant.code } },
    create: {
      productId,
      code: variant.code,
      namePl: variant.namePl,
      descPl: variant.descPl,
      receivesPl: variant.receivesPl,
      diagramUrl: PLACEHOLDER_IMAGE('instalacja-na-plytce'),
    },
    update: {},
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set — check your .env`);
  }
  return value;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
