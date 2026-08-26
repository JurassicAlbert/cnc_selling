/**
 * The authorizing file-serving route — §16.1, verbatim: "authorizes
 * before touching storage, returns 404 (not 403) on failure so file
 * existence isn't probeable, and streams via the storage adapter.
 * Storage keys are never exposed. No public bucket." Also §16.1's SVG
 * rule: "user SVGs are served as attachments or rasterized previews,
 * never inlined into the document" — an SVG response always gets
 * `Content-Disposition: attachment` even though it was already
 * sanitized on upload; defense in depth against ever rendering a
 * customer-supplied SVG as this origin's own document.
 *
 * `?preview=1` serves the EXIF-stripped preview instead of the original
 * (raster only — PDF has no preview, see `inspect-file.ts`'s header).
 */

import { NextResponse } from 'next/server';

import { prisma } from '@/server/db/client';
import { requireOwnedUploadedFile } from '@/server/repositories/design-review';
import { storage } from '@/server/storage/local-disk';

type RouteContext = {
  readonly params: Promise<{ readonly fileId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { fileId } = await context.params;
  const file = await requireOwnedUploadedFile(fileId);
  if (file === null) {
    return new NextResponse(null, { status: 404 });
  }

  const wantsPreview = new URL(request.url).searchParams.get('preview') === '1';
  const key = wantsPreview ? await previewKeyFor(fileId) : file.storageKey;
  if (key === null) {
    return new NextResponse(null, { status: 404 });
  }

  const bytes = await storage.get(key);
  if (bytes === null) {
    return new NextResponse(null, { status: 404 });
  }

  const contentType = wantsPreview ? 'image/jpeg' : file.mimeType;
  const disposition = contentType === 'image/svg+xml' ? 'attachment' : 'inline';

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.originalName)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

async function previewKeyFor(fileId: string): Promise<string | null> {
  const row = await prisma.uploadedFile.findUnique({ where: { id: fileId }, select: { previewKey: true } });
  return row?.previewKey ?? null;
}
