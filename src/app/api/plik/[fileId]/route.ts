/**
 * The authorizing file-serving route - §16.1, verbatim: "authorizes
 * before touching storage, returns 404 (not 403) on failure so file
 * existence isn't probeable, and streams via the storage adapter.
 * Storage keys are never exposed. No public bucket." Also §16.1's SVG
 * rule: "user SVGs are served as attachments or rasterized previews,
 * never inlined into the document" - an SVG response always gets
 * `Content-Disposition: attachment` even though it was already
 * sanitized on upload; defense in depth against ever rendering a
 * customer-supplied SVG as this origin's own document.
 *
 * `?preview=1` serves the EXIF-stripped preview instead of the original
 * (raster only - PDF has no preview, see `inspect-file.ts`'s header).
 *
 * P7a: staff/admin can fetch ANY file (the design-review queue needs the
 * original, not just the owner's own copy) - checked first, since a real
 * session role read is cheaper than the owner query and most panel
 * requests will hit it. Falls back to the owner check for every
 * non-staff request, unchanged from P4.
 */

import { NextResponse } from 'next/server';

import { prisma } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { requireOwnedUploadedFile } from '@/server/repositories/design-review';
import { storage } from '@/server/storage/local-disk';

type RouteContext = {
  readonly params: Promise<{ readonly fileId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { fileId } = await context.params;
  const session = await getSession();
  const file =
    session !== null && session.role !== 'CUSTOMER'
      ? await prisma.uploadedFile.findUnique({
          where: { id: fileId },
          select: { id: true, storageKey: true, mimeType: true, originalName: true },
        })
      : await requireOwnedUploadedFile(fileId);
  if (file === null) {
    return new NextResponse(null, { status: 404 });
  }

  const wantsPreview = new URL(request.url).searchParams.get('preview') === '1';
  const key = wantsPreview ? await previewKeyFor(fileId) : file.storageKey;
  if (key === null) {
    return new NextResponse(null, { status: 404 });
  }

  /*
    SEC-09. This was `storage.get(key)` - a `Buffer` - so every request pulled
    the whole file into the process before writing a byte of the response.
    Uploads are capped at 25 MB (`domain/upload/inspect.ts`), so a handful of
    concurrent downloads was tens of megabytes of resident memory holding data
    that was only being copied to a socket. 16.1 always said this route
    "streams via the storage adapter"; now it does.

    Backpressure comes with it: a slow client throttles the disk read instead
    of filling memory with bytes it has not collected.
  */
  const stream = await storage.getStream(key);
  if (stream === null) {
    return new NextResponse(null, { status: 404 });
  }

  const contentType = wantsPreview ? 'image/jpeg' : file.mimeType;
  const disposition = contentType === 'image/svg+xml' ? 'attachment' : 'inline';

  return new NextResponse(stream.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      // Known without reading anything, because `getStream` stats the file it
      // is about to open. A 25 MB PDF downloads with a real progress bar
      // rather than a spinner of unknown length.
      'Content-Length': String(stream.sizeBytes),
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(file.originalName)}"`,
      'Cache-Control': 'private, no-store',
      // Set here as well as site-wide (`next.config.ts` -> `baseSecurityHeaders`)
      // because this is the one route that streams bytes a customer chose:
      // `Content-Type` comes from `inspect-file.ts`'s sniffed type, and
      // `disposition` is `inline` for PDFs and rasters. Without `nosniff` a
      // browser may content-sniff those bytes as HTML and run them as this
      // origin's own document. Duplicated deliberately - the site-wide entry
      // is a config file one matcher edit away from not covering `/api`.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function previewKeyFor(fileId: string): Promise<string | null> {
  const row = await prisma.uploadedFile.findUnique({ where: { id: fileId }, select: { previewKey: true } });
  return row?.previewKey ?? null;
}
