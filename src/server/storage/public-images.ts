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

export type SavePublicImageResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly detail: string };

/** Sniffs real magic bytes (never the client's declared type) - same discipline as customer uploads, `inspect-file.ts`'s own header. */
export async function savePublicImage(
  kind: PublicImageKind,
  ownerId: string,
  bytes: Buffer,
): Promise<SavePublicImageResult> {
  const sniffed = await fileTypeFromBuffer(bytes);
  const extension = sniffed !== undefined ? ALLOWED_MIME_EXTENSIONS[sniffed.mime] : undefined;
  if (extension === undefined) {
    return { ok: false, detail: 'Nieobsługiwany format pliku - dozwolone są JPEG, PNG i WebP.' };
  }

  const dir = path.join(PUBLIC_IMAGES_ROOT, kind, ownerId);
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
