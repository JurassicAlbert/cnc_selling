import { createHash } from 'node:crypto';

import createDOMPurify from 'dompurify';
import { fileTypeFromBuffer } from 'file-type';
import { JSDOM } from 'jsdom';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

import { evaluateAspectMismatch, evaluateResolution, maxUploadSizeBytes } from '@/domain/upload/inspect';
import type { UploadWarning } from '@/domain/upload/inspect';

/**
 * The real, I/O-heavy half of `ARCHITECTURE.md` §13.1's validation
 * pipeline — magic-byte sniffing, SVG sanitization, PDF inspection,
 * `sharp` raster inspection/EXIF-stripped preview generation. The pure
 * math (DPI/aspect thresholds) lives in `domain/upload/inspect.ts` and is
 * called from here once real pixel dimensions are known; this file owns
 * everything that needs an actual file, network, or native module.
 *
 * **PDF preview gap, documented rather than silent:** this pipeline
 * gets a PDF's page count and rejects anything that looks like it embeds
 * JavaScript, but does NOT rasterize a preview image for PDFs — that
 * needs a PDF *rendering* engine (`pdf-lib` only reads/writes PDF
 * structure, it doesn't rasterize), which is a materially bigger
 * dependency than this pass takes on. A PDF upload's `previewKey` stays
 * `null`; the customer still sees their filename and page count. Revisit
 * if PDF uploads turn out to be common enough to justify the extra
 * dependency.
 *
 * **PDF JavaScript detection is a heuristic, not a full PDF interpreter:**
 * a raw scan for `/JavaScript`, `/JS`, `/OpenAction`, `/AA`, and
 * `/Launch` object-dictionary tokens in the file's bytes. A PDF library
 * capable of walking the full object graph and resolving indirect
 * references would be more precise, but this catches the overwhelmingly
 * common case (these tokens appear as literal PDF syntax even when
 * referenced indirectly) at a fraction of the complexity, and errs
 * toward rejecting a borderline file rather than accepting a malicious
 * one.
 */

const SVG_MIME_TYPE = 'image/svg+xml';
const ACCEPTED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  SVG_MIME_TYPE,
  'application/pdf',
]);

const PDF_SUSPICIOUS_TOKENS = ['/JavaScript', '/JS', '/OpenAction', '/AA', '/Launch'];

const MAX_PREVIEW_DIMENSION_PX = 1600;

export type InspectFileErrorCode =
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'CORRUPTED_FILE'
  | 'PDF_CONTAINS_ACTIVE_CONTENT';

export type InspectFileResult =
  | {
      readonly ok: true;
      readonly mimeType: string;
      readonly sizeBytes: number;
      readonly checksumSha256: string;
      readonly widthPx: number | null;
      readonly heightPx: number | null;
      readonly pageCount: number | null;
      /** The bytes to actually store — sanitized for SVG, unchanged otherwise. */
      readonly storedBytes: Buffer;
      /** EXIF-stripped, max 1600px on the long edge. `null` for PDF (see file header) and for anything `sharp` couldn't rasterize. */
      readonly previewBytes: Buffer | null;
      readonly warnings: UploadWarning[];
    }
  | { readonly ok: false; readonly code: InspectFileErrorCode };

export type InspectFileInput = {
  readonly bytes: Buffer;
  /** The target product's real size, for the DPI/aspect checks (§13.1.6–7). `null` skips both — used when no size is known yet. */
  readonly target: { readonly widthMm: number; readonly heightMm: number } | null;
};

export async function inspectUploadedFile(input: InspectFileInput): Promise<InspectFileResult> {
  const { bytes, target } = input;

  if (bytes.length === 0) {
    return { ok: false, code: 'EMPTY_FILE' };
  }

  const mimeType = await sniffMimeType(bytes);
  if (mimeType === null || !ACCEPTED_MIME_TYPES.has(mimeType)) {
    return { ok: false, code: 'UNSUPPORTED_TYPE' };
  }

  const maxBytes = maxUploadSizeBytes(mimeType);
  if (maxBytes === null || bytes.length > maxBytes) {
    return { ok: false, code: 'FILE_TOO_LARGE' };
  }

  if (mimeType === SVG_MIME_TYPE) {
    return inspectSvg(bytes, target);
  }
  if (mimeType === 'application/pdf') {
    return inspectPdf(bytes);
  }
  return inspectRaster(bytes, mimeType, target);
}

/**
 * The client's declared `type`/filename extension is never trusted for
 * any security decision (§13.1.2) — `file-type` reads the actual magic
 * bytes. SVG is the one accepted format `file-type` cannot sniff (it's
 * plain XML text with no fixed byte signature), so it's detected
 * separately by checking the content actually parses as an `<svg>` root
 * element — still real content inspection, not the declared MIME type.
 */
async function sniffMimeType(bytes: Buffer): Promise<string | null> {
  const sniffed = await fileTypeFromBuffer(bytes);
  if (sniffed !== undefined) {
    return sniffed.mime;
  }
  return looksLikeSvg(bytes) ? SVG_MIME_TYPE : null;
}

function looksLikeSvg(bytes: Buffer): boolean {
  // Only the first few KB matter for this check; SVGs can be large, but
  // the root element always appears near the start.
  const head = bytes.subarray(0, 4096).toString('utf8');
  return /<svg[\s>]/i.test(head);
}

function checksumOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

type SharpMetadata = Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;

async function inspectRaster(
  bytes: Buffer,
  mimeType: string,
  target: InspectFileInput['target'],
): Promise<InspectFileResult> {
  let metadata: SharpMetadata;
  try {
    metadata = await sharp(bytes).metadata();
  } catch {
    return { ok: false, code: 'CORRUPTED_FILE' };
  }

  const widthPx = metadata.width ?? null;
  const heightPx = metadata.height ?? null;
  if (widthPx === null || heightPx === null) {
    return { ok: false, code: 'CORRUPTED_FILE' };
  }

  const previewBytes = await generateRasterPreview(bytes);
  const warnings = target === null ? [] : warningsFor(widthPx, heightPx, target);

  return {
    ok: true,
    mimeType,
    sizeBytes: bytes.length,
    checksumSha256: checksumOf(bytes),
    widthPx,
    heightPx,
    pageCount: null,
    storedBytes: bytes,
    previewBytes,
    warnings,
  };
}

/**
 * `sharp` strips EXIF (including GPS) by default on re-encode — this
 * only avoids the metadata-preserving `.withMetadata()` call, it doesn't
 * need to do anything extra to achieve "stripped of EXIF including GPS"
 * (§13.1.9).
 */
async function generateRasterPreview(bytes: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      .rotate()
      .resize(MAX_PREVIEW_DIMENSION_PX, MAX_PREVIEW_DIMENSION_PX, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return null;
  }
}

async function inspectSvg(
  bytes: Buffer,
  target: InspectFileInput['target'],
): Promise<InspectFileResult> {
  const original = bytes.toString('utf8');
  const sanitized = sanitizeSvg(original);
  const sanitizedBytes = Buffer.from(sanitized, 'utf8');

  const dimensions = readSvgDimensions(sanitized);
  const previewBytes = await generateRasterPreview(sanitizedBytes);
  const warnings =
    target === null || dimensions === null ? [] : warningsFor(dimensions.widthPx, dimensions.heightPx, target);

  return {
    ok: true,
    mimeType: SVG_MIME_TYPE,
    sizeBytes: sanitizedBytes.length,
    checksumSha256: checksumOf(sanitizedBytes),
    widthPx: dimensions?.widthPx ?? null,
    heightPx: dimensions?.heightPx ?? null,
    pageCount: null,
    storedBytes: sanitizedBytes,
    previewBytes,
    warnings,
  };
}

const purifyWindow = new JSDOM('').window;
// biome-ignore lint/suspicious/noExplicitAny: DOMPurify's factory expects a real browser `Window`; jsdom's is structurally compatible but not the same type declaration.
const purify = createDOMPurify(purifyWindow as any);

purify.addHook('afterSanitizeAttributes', (node) => {
  // §13.1.3: strip xlink:href/href to anything other than a same-document
  // fragment reference (e.g. `<use href="#local-id">`, which is
  // legitimate and harmless) — this is what actually blocks a reference
  // to an external or `data:` URL, since DOMPurify's own SVG profile
  // allows href/xlink:href to exist at all (it's valid SVG).
  for (const attr of ['href', 'xlink:href']) {
    if (node.hasAttribute(attr)) {
      const value = node.getAttribute(attr) ?? '';
      if (!value.startsWith('#')) {
        node.removeAttribute(attr);
      }
    }
  }
});

/**
 * DOMPurify's SVG profile already excludes `<script>` and event-handler
 * attributes; `FORBID_TAGS` names `script`/`foreignObject` explicitly
 * anyway so that's true by inspection of this file, not just by trusting
 * the profile's defaults. External XML entity expansion (XXE) is not
 * separately guarded here because DOMPurify parses its input with an
 * HTML parser (via jsdom), and HTML parsing has no DTD/entity-expansion
 * step at all — the class of attack doesn't apply to this parsing path,
 * unlike a full XML parser that resolves `<!ENTITY>` declarations.
 *
 * Verified against a real hostile SVG (`<script>`, an `onclick` handler,
 * an external `<image href>`, a `javascript:` URI, `<foreignObject>`):
 * every one of those is stripped. One side effect worth knowing about,
 * not a bug: DOMPurify's default SVG profile doesn't include `<use>` at
 * all (it's simply absent from the library's own tag allowlist), so an
 * uploaded SVG using `<use href="#local-id">` — a legitimate icon-sprite
 * pattern — loses that element entirely rather than keeping it. Left
 * as-is: customer engraving artwork essentially never uses `<use>`, and
 * widening the allowlist for it would trade away margin on a rare case.
 */
function sanitizeSvg(svgText: string): string {
  return purify.sanitize(svgText, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ['script', 'foreignObject'],
  });
}

function readSvgDimensions(svgText: string): { widthPx: number; heightPx: number } | null {
  const viewBoxMatch = svgText.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  const viewBoxWidth = viewBoxMatch?.[1];
  const viewBoxHeight = viewBoxMatch?.[2];
  if (viewBoxWidth !== undefined && viewBoxHeight !== undefined) {
    return { widthPx: Number.parseFloat(viewBoxWidth), heightPx: Number.parseFloat(viewBoxHeight) };
  }

  const widthMatch = svgText.match(/\bwidth=["']([\d.]+)/i)?.[1];
  const heightMatch = svgText.match(/\bheight=["']([\d.]+)/i)?.[1];
  if (widthMatch !== undefined && heightMatch !== undefined) {
    return { widthPx: Number.parseFloat(widthMatch), heightPx: Number.parseFloat(heightMatch) };
  }

  return null;
}

async function inspectPdf(bytes: Buffer): Promise<InspectFileResult> {
  if (containsSuspiciousPdfTokens(bytes)) {
    return { ok: false, code: 'PDF_CONTAINS_ACTIVE_CONTENT' };
  }

  let pageCount: number;
  try {
    const document = await PDFDocument.load(bytes, { updateMetadata: false });
    pageCount = document.getPageCount();
  } catch {
    return { ok: false, code: 'CORRUPTED_FILE' };
  }

  return {
    ok: true,
    mimeType: 'application/pdf',
    sizeBytes: bytes.length,
    checksumSha256: checksumOf(bytes),
    widthPx: null,
    heightPx: null,
    pageCount,
    storedBytes: bytes,
    previewBytes: null,
    warnings: [],
  };
}

function containsSuspiciousPdfTokens(bytes: Buffer): boolean {
  // latin1 keeps a 1:1 byte-to-character mapping, so this matches the
  // literal PDF-syntax tokens regardless of any binary stream content
  // elsewhere in the file.
  const text = bytes.toString('latin1');
  return PDF_SUSPICIOUS_TOKENS.some((token) => text.includes(token));
}

function warningsFor(
  widthPx: number,
  heightPx: number,
  target: { readonly widthMm: number; readonly heightMm: number },
): UploadWarning[] {
  return [
    ...evaluateResolution(widthPx, target.widthMm),
    ...evaluateAspectMismatch(widthPx, heightPx, target.widthMm, target.heightMm),
  ];
}
