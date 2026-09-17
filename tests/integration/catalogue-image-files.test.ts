import { describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';

import { publicImageExists } from './public-image-files';

/**
 * `docs/AI-CHECKLIST.md` BUG-36, first half.
 *
 * A full e2e run printed „The requested resource isn't a valid image for
 * /images/photos/zamowienie-wlasne.jpg received null", and it was written off
 * as noise from an intermittent render failure it happened to appear beside.
 * It is not intermittent: it fires on **every render of the home page**, and
 * the cause is a data defect the seed produces on any fresh database.
 *
 * `prisma/seed.ts` derives a category's photo from its own slug -
 * `STOCK_PHOTO(seed.slug)` - so a category's image path is a function of its
 * name. On 2026-09-04 the owner renamed „Inne" to „Zamówienie własne" and the
 * slug moved with it. The comment written at the time considered links
 * („nothing links to /inne yet") and not the image, so `inne.jpg` stayed on
 * disk under its old name while every freshly seeded database started
 * pointing at a `zamowienie-wlasne.jpg` that was never created.
 *
 * **The development database hid it.** Its row predates the rename and was
 * renamed in place, so it still carries the valid `/images/photos/inne.jpg`.
 * A fresh seed and the database the developer looks at silently disagreed -
 * which is why this went unnoticed for nine days and why the fix makes the
 * seed state the path explicitly instead of deriving it.
 *
 * **Scoped to `/images/photos/`, deliberately.** Those are the stock photos
 * tracked in the repository, so they are there or they are not, and this
 * assertion cannot flake. The uploaded kinds - designs, materials, finishes -
 * are excluded because the admin test files create and remove rows and files
 * concurrently with this one, and a test that fails when another test is
 * halfway through its own cleanup is a test people learn to re-run rather
 * than read. (Dangling rows of that kind do exist in the development
 * catalogue; they are T-35's leftovers, and this is not the tool that finds
 * them.)
 */
const TRACKED_PHOTOS = '/images/photos/';

type ImageRow = { readonly table: string; readonly ref: string; readonly url: string };

async function everyStockPhotoReference(): Promise<ImageRow[]> {
  const [categories, posts, productImages, materials] = await Promise.all([
    prisma.category.findMany({ select: { slug: true, imageUrl: true } }),
    prisma.blogPost.findMany({ select: { slug: true, imageUrl: true } }),
    prisma.productImage.findMany({ select: { id: true, url: true } }),
    prisma.material.findMany({ select: { namePl: true, imageUrl: true } }),
  ]);

  const rows: ImageRow[] = [
    ...categories.map((row) => ({ table: 'Category', ref: row.slug, url: row.imageUrl ?? '' })),
    ...posts.map((row) => ({ table: 'BlogPost', ref: row.slug, url: row.imageUrl ?? '' })),
    ...productImages.map((row) => ({ table: 'ProductImage', ref: row.id, url: row.url })),
    ...materials.map((row) => ({ table: 'Material', ref: row.namePl, url: row.imageUrl ?? '' })),
  ];

  return rows.filter((row) => row.url.startsWith(TRACKED_PHOTOS));
}

describe('the catalogue never points at a stock photo that is not there', () => {
  it('resolves every /images/photos/ reference to a real file', async () => {
    const references = await everyStockPhotoReference();

    // A guard that finds nothing to check passes for the wrong reason, and
    // this one would: point the seed at a different directory and every
    // assertion below becomes vacuous.
    expect(references.length).toBeGreaterThan(5);

    const dangling = references.filter((row) => !publicImageExists(row.url));

    expect(
      dangling,
      // Naming the row is the whole value of failing here. „One image is
      // missing" sends someone reading the seed top to bottom; „Category
      // zamowienie-wlasne -> /images/photos/zamowienie-wlasne.jpg" does not.
      `pointing at a file that is not on disk:\n${dangling.map((row) => `  ${row.table} ${row.ref} -> ${row.url}`).join('\n')}`,
    ).toEqual([]);
  });

  it('still finds the category whose rename started this', async () => {
    /*
      The specific regression, pinned by name. The test above would go quiet
      if this category were ever dropped from the seed, and „the bug cannot
      happen because the data is gone" is not the same as fixed.
    */
    const category = await prisma.category.findUnique({
      where: { slug: 'zamowienie-wlasne' },
      select: { imageUrl: true },
    });

    expect(category).not.toBeNull();
    expect(category?.imageUrl).not.toBeNull();
    expect(publicImageExists(category?.imageUrl ?? '')).toBe(true);
  });
});
