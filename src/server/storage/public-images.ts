/**
 * Public catalogue-photo storage - deliberately separate from
 * `local-disk.ts`'s `LocalDiskStorage`. That one backs customer uploads,
 * gated behind the authorizing `/api/plik/[fileId]` route, "no public
 * bucket" (§16.1). Product/category photos are the opposite: they must be
 * plain, publicly reachable URLs a browser loads directly. Writing into
 * `public/images/...` at runtime works because this project's actual
 * deployment target is a long-running Node server (Docker + Postgres, not
 * a serverless/immutable-build platform) - `next dev`/`next start` both
 * serve `public/` straight off disk on every request. Same "dev/MVP, real
 * disk writes, not production-grade (no CDN/redundancy)" honesty
 * `LocalDiskStorage`'s own header already applies to the private path.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { fileTypeFromBuffer } from 'file-type';

const PUBLIC_IMAGES_ROOT = path.resolve(process.cwd(), 'public', 'images');

const ALLOWED_MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type PublicImageKind = 'products' | 'categories' | 'materials' | 'finishes' | 'designs';

/**
 * SEC-06. Customer uploads cap JPEG/PNG at 25 MB (`maxUploadSizeBytes`);
 * catalogue photos had no cap at all, so one mis-dropped file could write
 * anything into `public/`.
 *
 * The same 25 MB rather than a new number, so an admin photographing a
 * product is held to the limit a customer already is. Deliberately a local
 * constant instead of reusing `maxUploadSizeBytes`: that function returns
 * `null` for `image/webp`, which this module accepts and customer uploads do
 * not, so sharing it would either refuse every WebP here or silently widen
 * what customers may upload.
 */
const MAX_PUBLIC_IMAGE_BYTES = 25 * 1024 * 1024;

export type SavePublicImageResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly detail: string };

/**
 * The directory this `ownerId` resolves to, or `null` if that is anywhere
 * other than inside `public/images/{kind}` - SEC-06.
 *
 * `path.resolve` and a prefix comparison rather than a `..` substring test.
 * The substring version is what `deletePublicImage` uses and it is fine for a
 * URL this module produced, but here `ownerId` reaches the filesystem, and
 * resolving is the only check that answers the actual question - "does this
 * end up where I meant" - rather than enumerating the ways it might not.
 *
 * The trailing separator matters: without it, `finishes-evil` would pass a
 * prefix test against `finishes`.
 */
function resolveOwnerDir(kind: PublicImageKind, ownerId: string): string | null {
  const kindRoot = path.join(PUBLIC_IMAGES_ROOT, kind);
  const resolved = path.resolve(kindRoot, ownerId);

  if (resolved === kindRoot || !resolved.startsWith(kindRoot + path.sep)) {
    return null;
  }
  return resolved;
}

/** Sniffs real magic bytes (never the client's declared type) - same discipline as customer uploads, `inspect-file.ts`'s own header. */
export async function savePublicImage(
  kind: PublicImageKind,
  ownerId: string,
  bytes: Buffer,
): Promise<SavePublicImageResult> {
  /*
    SEC-06, and the order is deliberate. Size first, because it is the
    cheapest check and refusing a 60 MB buffer should not require sniffing it;
    containment next, because it decides whether anything touches the disk at
    all; the format sniff last.
  */
  if (bytes.length > MAX_PUBLIC_IMAGE_BYTES) {
    return { ok: false, detail: 'Plik jest zbyt duży - maksymalny rozmiar to 25 MB.' };
  }

  const dir = resolveOwnerDir(kind, ownerId);
  if (dir === null) {
    /*
      Not reachable today: every caller validates the slug against
      `/^[a-z0-9]+(-[a-z0-9]+)*$/` first, in all six create and update paths.
      This is the guard at the layer that actually resolves the path, because
      that validation lives in another module - a caller added later, or one
      whose checks get reordered, would otherwise escape silently. The same
      reasoning `deletePublicImage` below has always applied to its own input.
    */
    return { ok: false, detail: 'Nieprawidłowy identyfikator pliku.' };
  }

  const sniffed = await fileTypeFromBuffer(bytes);
  const extension = sniffed !== undefined ? ALLOWED_MIME_EXTENSIONS[sniffed.mime] : undefined;
  if (extension === undefined) {
    return { ok: false, detail: 'Nieobsługiwany format pliku - dozwolone są JPEG, PNG i WebP.' };
  }

  await mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}.${extension}`;
  await writeFile(path.join(dir, fileName), bytes);

  return { ok: true, url: `/images/${kind}/${ownerId}/${fileName}` };
}

/** `url` must be one this module produced (`/images/{kind}/{ownerId}/...`) - refuses anything else, same defense-in-depth `local-disk.ts`'s `resolveKeyPath` applies. */
const DELETABLE_PREFIXES: readonly PublicImageKind[] = ['products', 'categories', 'materials', 'finishes', 'designs'];

export async function deletePublicImage(url: string): Promise<void> {
  if (!DELETABLE_PREFIXES.some((kind) => url.startsWith(`/images/${kind}/`))) {
    return;
  }
  const relative = url.slice('/images/'.length);
  if (relative.includes('..')) {
    return;
  }
  await rm(path.join(PUBLIC_IMAGES_ROOT, relative), { force: true });
}
