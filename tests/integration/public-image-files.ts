/**
 * Reading and clearing the files that `savePublicImage` really writes.
 *
 * `docs/AI-CHECKLIST.md` PERF-04 turned out to be about these. The item
 * counted Turbopack's over-bundling warnings and proposed a literal path map;
 * what the numbers were actually counting was **7 296 orphaned directories
 * this test suite had left in `public/images`** - every one of them named
 * `test-admin-designs-…`, `test-admin-materials-…` or `test-admin-finishes-…`,
 * against 13 real designs in the database.
 *
 * Two separate causes, and only one of them is the tests':
 *
 * 1. **The application never deleted a replaced image.** `savePublicImage` is
 *    called from four operation modules and `deletePublicImage` from one, so
 *    an admin swapping a design thumbnail left the old file on disk forever.
 *    That is a production defect the tests merely exercised thousands of
 *    times, and it is fixed in `admin-designs.ts`, `admin-materials.ts` and
 *    `admin-finishes.ts`.
 * 2. **The tests deleted their rows and not their files.** Fixed by
 *    `removeTestPublicImages`, called from the same `afterEach` that clears
 *    the rows.
 *
 * Safe to delete from, and worth saying why: `public/images/designs/` is
 * gitignored outright and only 37 files under `public/images` are tracked at
 * all, so nothing here can remove a real catalogue photo that is in the
 * repository. The guard below is belt to that brace - it refuses to touch
 * anything whose directory name does not start with the caller's own test
 * prefix.
 */

import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const PUBLIC_IMAGES_ROOT = path.resolve(process.cwd(), 'public', 'images');

/** Every kind `savePublicImage` will write into. */
const KINDS = ['products', 'categories', 'materials', 'finishes', 'designs'] as const;

/**
 * The absolute path a `/images/…` URL points at.
 *
 * Deliberately derived from the URL the operation returned rather than
 * rebuilt from a slug: a test that recomputes the path is testing its own
 * arithmetic, and would keep passing if the operation started writing
 * somewhere else entirely.
 */
export function publicImageFilePath(url: string): string {
  return path.join(process.cwd(), 'public', url.replace(/^\//, ''));
}

/** Is the file behind this `/images/…` URL actually on disk? */
export function publicImageExists(url: string): boolean {
  return existsSync(publicImageFilePath(url));
}

/**
 * Remove the owner directories a test file created.
 *
 * Matched on the directory name, which is the entity's slug, so a test whose
 * slugs all start with its own `PREFIX` clears exactly its own and nothing
 * else. A kind that does not exist yet is not an error - nothing was written.
 */
export async function removeTestPublicImages(prefix: string): Promise<void> {
  if (prefix.trim().length === 0) {
    throw new Error('removeTestPublicImages needs a real prefix - an empty one would match every directory');
  }

  await Promise.all(
    KINDS.map(async (kind) => {
      const kindRoot = path.join(PUBLIC_IMAGES_ROOT, kind);
      let entries: string[];
      try {
        entries = await readdir(kindRoot);
      } catch {
        return;
      }
      await Promise.all(
        entries
          .filter((entry) => entry.startsWith(prefix))
          .map((entry) => rm(path.join(kindRoot, entry), { recursive: true, force: true })),
      );
    }),
  );
}
