import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Nothing unexpected sits in `public/`, because everything in `public/` is
 * served to the internet and, from 2026-09-16, baked into the production
 * image.
 *
 * **This is a real finding, not a hypothetical.** Three tracked files were
 * found here while preparing the deployment: `public/<uuid>.jpg`,
 * `public/images/<uuid>.jpg`, and `public/images/b/<uuid>.jpg`. All three are
 * byte-identical to `public/images/photos/gres.jpg`, which is the fixture
 * `tests/integration/public-images.test.ts` uploads, and all three were added
 * by commit `8a05a7e` - **the SEC-06 fix itself**.
 *
 * They are the artefacts of that item's own red run. Before the containment
 * guard existed, `savePublicImage` joined an unvalidated `ownerId` onto its
 * destination, so the traversal cases the test feeds it really did write
 * where they were pointed: `'..'` landed in `public/images`, `'../..'` landed
 * in `public/` itself, and `'a/../../b'` created `public/images/b`. The fix
 * and the proof it was needed were committed together by a `git add -A`.
 *
 * Harmless in content - it is a stock photo of a tile - but one of them was
 * being served at the site root, and this is exactly the shape of residue
 * that stops being harmless the moment the file is something else. Deleted,
 * and this test is what keeps the tree clean now that a wrong file here
 * follows the app into production.
 *
 * Asserted against an allow-list rather than a deny-list: a new upload kind
 * is a deliberate act and should come with a line here, whereas a
 * deny-list only ever catches the mistake somebody already thought of.
 */

const PUBLIC_ROOT = path.resolve(process.cwd(), 'public');

/** Top-level entries `public/` is allowed to contain. */
const ALLOWED_AT_ROOT = new Set(['fonts', 'images', 'videos']);

/**
 * Directories `public/images/` is allowed to contain.
 *
 * The first five are the runtime upload kinds `savePublicImage` writes into -
 * all five are gitignored, and in production all five are volumes rather than
 * image layers, because a container replacement would otherwise take every
 * catalogue photo an admin has ever uploaded with it. The rest are tracked
 * artwork that ships with the build.
 */
const ALLOWED_IN_IMAGES = new Set([
  'products',
  'categories',
  'materials',
  'finishes',
  'designs',
  'brand',
  'collections',
  'patterns',
  'photos',
  'placeholders',
]);

function entriesOf(directory: string): string[] {
  return readdirSync(directory).filter((entry) => !entry.startsWith('.'));
}

describe('public/ contains only what is meant to be served', () => {
  it('has no loose files at its root', () => {
    const loose = entriesOf(PUBLIC_ROOT).filter((entry) => statSync(path.join(PUBLIC_ROOT, entry)).isFile());

    expect(
      loose,
      `served at the site root, and almost certainly written by accident: ${loose.join(', ')}`,
    ).toEqual([]);
  });

  it('has no directories at its root beyond the three that are meant to be there', () => {
    const directories = entriesOf(PUBLIC_ROOT).filter((entry) =>
      statSync(path.join(PUBLIC_ROOT, entry)).isDirectory(),
    );

    const unexpected = directories.filter((entry) => !ALLOWED_AT_ROOT.has(entry));
    expect(unexpected, `unexpected directories in public/: ${unexpected.join(', ')}`).toEqual([]);
  });

  it('has no loose files directly inside public/images', () => {
    /*
      Every real image lives one level deeper, under its kind. A file sitting
      directly here escaped the directory it was meant to go in - which is
      precisely what the traversal cases did before SEC-06 was fixed.
    */
    const imagesRoot = path.join(PUBLIC_ROOT, 'images');
    const loose = entriesOf(imagesRoot).filter((entry) => statSync(path.join(imagesRoot, entry)).isFile());

    expect(loose, `escaped their kind directory: ${loose.join(', ')}`).toEqual([]);
  });

  it('has no image kind beyond the ten that are declared', () => {
    const imagesRoot = path.join(PUBLIC_ROOT, 'images');
    const directories = entriesOf(imagesRoot).filter((entry) =>
      statSync(path.join(imagesRoot, entry)).isDirectory(),
    );

    const unexpected = directories.filter((entry) => !ALLOWED_IN_IMAGES.has(entry));
    expect(
      unexpected,
      `not a declared upload kind - "b" was created by a traversal test: ${unexpected.join(', ')}`,
    ).toEqual([]);
  });
});
