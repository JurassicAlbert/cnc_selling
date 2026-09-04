import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { inspectUploadedFile } from '@/server/upload/inspect-file';

/**
 * The real file-inspection pipeline (`src/server/upload/inspect-file.ts`)
 * against real bytes - `ARCHITECTURE.md` §21.3's "file upload validation"
 * and "file type/size restrictions" rows: wrong magic bytes, oversize,
 * corrupted, zero-byte, SVG with script, PDF with JS, each allowed type,
 * exact boundary sizes. No DB or `next/headers` involved - this is the
 * highest-severity part of the whole feature (§13.1.3: "an unsanitized
 * customer SVG rendered in a preview is stored XSS"), and it's testable
 * in complete isolation.
 */

async function realJpegBytes(): Promise<Buffer> {
  return readFileSync(path.resolve(process.cwd(), 'public/images/photos/loft.jpg'));
}

async function realPngBytes(): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 100, g: 80, b: 60 } } })
    .png()
    .toBuffer();
}

async function realPdfBytes(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  return Buffer.from(await doc.save());
}

const cleanSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100" fill="blue" /></svg>';

const hostileSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <script>alert('xss')</script>
  <rect width="100" height="100" fill="red" onclick="alert('click')" />
  <image href="https://evil.example/track.png" />
  <a xlink:href="javascript:alert(1)"><text>click</text></a>
  <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">html</div></foreignObject>
</svg>`;

describe('accepted types - each real file is inspected correctly', () => {
  it('a real JPEG', async () => {
    const result = await inspectUploadedFile({ bytes: await realJpegBytes(), target: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.widthPx).toBeGreaterThan(0);
      expect(result.previewBytes).not.toBeNull();
    }
  });

  it('a real PNG', async () => {
    const result = await inspectUploadedFile({ bytes: await realPngBytes(), target: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe('image/png');
      expect(result.widthPx).toBe(40);
      expect(result.heightPx).toBe(30);
    }
  });

  it('a real, clean SVG', async () => {
    const result = await inspectUploadedFile({ bytes: Buffer.from(cleanSvg), target: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe('image/svg+xml');
      expect(result.widthPx).toBe(200);
      expect(result.heightPx).toBe(100);
    }
  });

  it('a real, minimal PDF', async () => {
    const result = await inspectUploadedFile({ bytes: await realPdfBytes(), target: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe('application/pdf');
      expect(result.pageCount).toBe(1);
      expect(result.previewBytes).toBeNull(); // documented gap - see inspect-file.ts's header
    }
  });
});

describe('SVG sanitization - the highest-severity check in the pipeline', () => {
  it('accepts a hostile SVG but strips every dangerous construct rather than rejecting outright', async () => {
    const result = await inspectUploadedFile({ bytes: Buffer.from(hostileSvg), target: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sanitized = result.storedBytes.toString('utf8');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('evil.example');
    expect(sanitized).not.toContain('foreignObject');
    // The harmless content survives.
    expect(sanitized).toContain('<rect');
  });
});

describe('wrong magic bytes / unsupported type', () => {
  it('rejects a plain text file even if it were named/declared as an image', async () => {
    const result = await inspectUploadedFile({ bytes: Buffer.from('just some plain text, not an image'), target: null });
    expect(result).toEqual({ ok: false, code: 'UNSUPPORTED_TYPE' });
  });

  it('rejects a GIF - a real image format, just not one this pipeline accepts', async () => {
    // GIF87a header, enough for file-type to sniff it correctly.
    const gifBytes = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00]);
    const result = await inspectUploadedFile({ bytes: gifBytes, target: null });
    expect(result).toEqual({ ok: false, code: 'UNSUPPORTED_TYPE' });
  });
});

describe('corrupted and zero-byte files', () => {
  it('rejects a zero-byte file before even sniffing its type', async () => {
    const result = await inspectUploadedFile({ bytes: Buffer.alloc(0), target: null });
    expect(result).toEqual({ ok: false, code: 'EMPTY_FILE' });
  });

  it('rejects a file with a real JPEG signature but garbage body', async () => {
    // Real JPEG magic bytes (FF D8 FF), enough for file-type to sniff
    // "image/jpeg", followed by bytes sharp cannot actually decode.
    const corrupted = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('not a real jpeg body')]);
    const result = await inspectUploadedFile({ bytes: corrupted, target: null });
    expect(result).toEqual({ ok: false, code: 'CORRUPTED_FILE' });
  });
});

describe('PDF active-content rejection (§13.1.4)', () => {
  it('rejects a PDF containing a /JavaScript token', async () => {
    const withJs = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.from('1 0 obj << /Type /Catalog /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >> endobj\n'),
    ]);
    const result = await inspectUploadedFile({ bytes: withJs, target: null });
    expect(result).toEqual({ ok: false, code: 'PDF_CONTAINS_ACTIVE_CONTENT' });
  });

  it('rejects a PDF containing a /Launch action', async () => {
    const withLaunch = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.from('1 0 obj << /Type /Action /S /Launch /F (calc.exe) >> endobj\n'),
    ]);
    const result = await inspectUploadedFile({ bytes: withLaunch, target: null });
    expect(result).toEqual({ ok: false, code: 'PDF_CONTAINS_ACTIVE_CONTENT' });
  });

  it('a clean PDF with none of those tokens is accepted', async () => {
    const result = await inspectUploadedFile({ bytes: await realPdfBytes(), target: null });
    expect(result.ok).toBe(true);
  });
});

describe('size boundaries (§13.1.1: SVG capped at 5MB)', () => {
  function paddedSvg(totalBytes: number): Buffer {
    const prefix = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><!--';
    const suffix = '--><rect width="10" height="10" fill="red"/></svg>';
    const padding = 'x'.repeat(Math.max(0, totalBytes - prefix.length - suffix.length));
    return Buffer.from(prefix + padding + suffix);
  }

  it('accepts an SVG exactly at the 5MB cap', async () => {
    const bytes = paddedSvg(5 * 1024 * 1024);
    expect(bytes.length).toBe(5 * 1024 * 1024);
    const result = await inspectUploadedFile({ bytes, target: null });
    expect(result.ok).toBe(true);
  });

  it('rejects an SVG one byte over the 5MB cap, naming the real actual/max sizes', async () => {
    const bytes = paddedSvg(5 * 1024 * 1024 + 1);
    const result = await inspectUploadedFile({ bytes, target: null });
    expect(result).toEqual({
      ok: false,
      code: 'FILE_TOO_LARGE',
      params: { actualBytes: 5 * 1024 * 1024 + 1, maxBytes: 5 * 1024 * 1024 },
    });
  });
});

describe('DPI / aspect-mismatch warnings, when a target size is known', () => {
  it('warns on low resolution against a large target', async () => {
    const result = await inspectUploadedFile({
      bytes: await realPngBytes(),
      target: { widthMm: 500, heightMm: 375 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.code === 'VERY_LOW_RESOLUTION' || w.code === 'LOW_RESOLUTION')).toBe(
        true,
      );
    }
  });

  it('produces no warnings when target is null - the real CUSTOM_UPLOAD flow (upload precedes SIZE)', async () => {
    const result = await inspectUploadedFile({ bytes: await realPngBytes(), target: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([]);
    }
  });
});
