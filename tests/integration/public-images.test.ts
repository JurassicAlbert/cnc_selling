/**
 * `docs/AI-CHECKLIST.md` SEC-06 - runtime writes into `public/`.
 *
 * `savePublicImage` builds its destination as
 * `path.join(PUBLIC_IMAGES_ROOT, kind, ownerId)` and never checked where that
 * landed, while its sibling `deletePublicImage` has always refused a `..`.
 * Most callers pass `fields.slug`, which comes from an admin form.
 *
 * **Not a live hole, and worth saying so precisely rather than overstating
 * it.** Every caller validates the slug against
 * `/^[a-z0-9]+(-[a-z0-9]+)*$/` before saving - checked in all six paths,
 * create and update, on 2026-09-05. What is missing is the guard at the layer
 * that actually resolves the path. The validation lives in a different
 * module, so a caller added later, or one whose checks get reordered, escapes
 * silently and writes wherever it likes. That is exactly the shape of SEC-03,
 * where `domain/compatibility` was correct, tested, and not called on the
 * write path.
 *
 * The second half is the missing size cap. Customer uploads have one
 * (`maxUploadSizeBytes`); catalogue photos had none, so a single admin
 * mis-drop could write an arbitrarily large file into `public/`.
 *
 * These tests write to the real `public/images` tree, because that is what
 * the module does and mocking the filesystem would test the mock. Every
 * refusal case writes nothing by definition; the one success case cleans up
 * after itself.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { deletePublicImage, savePublicImage } from '@/server/storage/public-images';

const PUBLIC_IMAGES_ROOT = path.resolve(process.cwd(), 'public', 'images');

/** A real PNG, so `fileTypeFromBuffer` sniffs a real magic number. */
async function realPng(): Promise<Buffer> {
  return readFile(path.resolve(process.cwd(), 'public/images/photos/gres.jpg'));
}

describe('savePublicImage - the destination must stay inside public/images', () => {
  it.each([
    ['..', 'the parent directory'],
    ['../..', 'two levels up'],
    ['../../../etc', 'a classic traversal'],
    ['a/../../b', 'traversal hidden mid-path'],
    ['', 'an empty segment, which resolves to the kind directory itself'],
  ])('refuses ownerId %j - %s', async (ownerId, _why) => {
    const before = await readdir(PUBLIC_IMAGES_ROOT);

    const result = await savePublicImage('finishes', ownerId, await realPng());

    expect(result.ok).toBe(false);
    // And nothing was created on the way to refusing.
    expect(await readdir(PUBLIC_IMAGES_ROOT)).toEqual(before);
  });

  it('refuses an absolute path outright', async () => {
    // `path.join` does not treat this as absolute, but a caller might expect
    // it to, and the containment check answers the question either way.
    const result = await savePublicImage('finishes', '/etc/passwd', await realPng());
    expect(result.ok).toBe(false);
  });
});

describe('savePublicImage - size', () => {
  it('refuses a file larger than the cap rather than writing it', async () => {
    // Not a real image: the size check must come first, so this never
    // reaches the sniffer. A 60 MB buffer of zeroes is cheap to make and
    // proves exactly that ordering.
    const tooBig = Buffer.alloc(60 * 1024 * 1024);

    const result = await savePublicImage('finishes', 'test-sec06', tooBig);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.detail).toMatch(/zbyt duży|za duży/i);
  });

  it('still accepts an ordinary catalogue photo', async () => {
    // The guard has to refuse the bad cases without breaking the real one -
    // a cap set too low, or a containment check that rejects every slug,
    // would pass every test above and break the admin panel.
    const result = await savePublicImage('finishes', 'test-sec06', await realPng());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toMatch(/^\/images\/finishes\/test-sec06\/[0-9a-f-]+\.(jpg|png|webp)$/);
      await deletePublicImage(result.url);
    }
  });
});

describe('deletePublicImage - unchanged, and still guarded', () => {
  it('refuses a url outside the kinds it owns', async () => {
    // No assertion beyond "it returns without throwing": the point is that it
    // does not reach the filesystem at all.
    await expect(deletePublicImage('/etc/passwd')).resolves.toBeUndefined();
    await expect(deletePublicImage('/images/../../etc')).resolves.toBeUndefined();
  });
});
