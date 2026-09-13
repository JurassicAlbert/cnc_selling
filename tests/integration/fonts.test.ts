import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { POLISH_SPECIFIC_LETTERS } from '@/domain/personalization/validate';
import { toFontSpec } from '@/server/mapping/to-domain';

/**
 * `docs/AI-CHECKLIST.md` BUG-31: „only one `Font` is seeded and it is `Inter`,
 * the site's own UI face; the cmap-coverage apparatus guards a single
 * sans-serif."
 *
 * The apparatus was never the problem - it parses a real file, extracts a
 * real cmap, and refuses to seed a face missing a Polish glyph. What it had
 * was nothing to prove itself against: one face, and one that was chosen
 * because it was already in the repository rather than because anyone would
 * engrave with it.
 *
 * **Owner decision 2026-09-13: EB Garamond, Playfair Display, Montserrat and
 * Parisienne**, all SIL OFL, all fetched from `github.com/google/fonts` -
 * the same source and the same licence family as the Inter file already
 * here, with each face's `OFL.txt` stored beside it.
 *
 * What these tests are actually for:
 *
 * - **Polish coverage is asserted from the stored ranges, never from
 *   `supportsPolishDiacritics`.** The schema says that column is a
 *   „denormalised convenience flag ... NEVER used for validation", and a test
 *   that trusted it would be asserting the flag agrees with itself. The
 *   ranges are what `toFontSpec` expands and what actually refuses a „ż".
 * - **Every face's file has to be on disk.** This is BUG-37's lesson applied
 *   before it can happen again: a row pointing at a file nobody shipped is a
 *   preview that cannot render, and the schema is explicit that „the preview
 *   MUST render with this same file, or the preview is a lie".
 * - **The flag has to agree with the ranges.** It is denormalised, so it can
 *   drift, and the admin list is read by people deciding what to offer.
 */
const PUBLIC_ROOT = path.resolve(process.cwd(), 'public');

/** The four the owner chose, plus the one that was already here. */
const EXPECTED_SLUGS = ['ebgaramond', 'inter', 'montserrat', 'parisienne', 'playfairdisplay'];

describe('the engraving faces on offer', () => {
  it('offers more than the single sans-serif BUG-31 was about', async () => {
    const fonts = await prisma.font.findMany({ where: { isActive: true }, select: { slug: true } });

    expect(fonts.map((font) => font.slug).sort()).toEqual(EXPECTED_SLUGS);
  });

  it('ships the file behind every row', async () => {
    const fonts = await prisma.font.findMany({ select: { slug: true, fileUrl: true } });
    expect(fonts.length).toBeGreaterThan(0);

    const missing = fonts.filter((font) => !existsSync(path.join(PUBLIC_ROOT, font.fileUrl.replace(/^\//, ''))));

    expect(
      missing.map((font) => `${font.slug} -> ${font.fileUrl}`),
      'a row pointing at a file nobody shipped renders a preview that is a lie',
    ).toEqual([]);
  });

  it('covers every Polish letter, checked against the ranges rather than the flag', async () => {
    const fonts = await prisma.font.findMany();
    expect(fonts.length).toBeGreaterThan(1);

    for (const font of fonts) {
      const spec = toFontSpec(font);
      const missing = [...POLISH_SPECIFIC_LETTERS].filter((letter) => {
        const codePoint = letter.codePointAt(0);
        return codePoint === undefined || !spec.supportedCodePoints.has(codePoint);
      });
      expect(missing, `${font.slug} cannot engrave: ${missing.join('')}`).toEqual([]);
    }
  });

  it('keeps the convenience flag honest', async () => {
    const fonts = await prisma.font.findMany();

    for (const font of fonts) {
      const spec = toFontSpec(font);
      const reallyCovers = [...POLISH_SPECIFIC_LETTERS].every((letter) => {
        const codePoint = letter.codePointAt(0);
        return codePoint !== undefined && spec.supportedCodePoints.has(codePoint);
      });
      expect(font.supportsPolishDiacritics, `${font.slug}'s flag disagrees with its ranges`).toBe(reallyCovers);
    }
  });

  it('can still engrave plain Latin and digits', async () => {
    /*
      The obvious case, and worth one assertion: a decorative script that
      covers „ąćęłńóśźż" and quietly lacks a digit would pass every check
      above while refusing „Anna 2026".
    */
    const fonts = await prisma.font.findMany();

    for (const font of fonts) {
      const spec = toFontSpec(font);
      const missing = [...'ABCZabcz0123456789 .,-'].filter((character) => {
        const codePoint = character.codePointAt(0);
        return codePoint === undefined || !spec.supportedCodePoints.has(codePoint);
      });
      expect(missing, `${font.slug} is missing: ${JSON.stringify(missing.join(''))}`).toEqual([]);
    }
  });
});
