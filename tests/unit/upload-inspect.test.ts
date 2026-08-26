import { describe, expect, it } from 'vitest';

import {
  effectiveDpi,
  evaluateAspectMismatch,
  evaluateResolution,
  maxUploadSizeBytes,
  sanitizeFilenameForDisplay,
} from '@/domain/upload/inspect';

function codesOf(warnings: ReturnType<typeof evaluateResolution>) {
  return warnings.map((w) => w.code);
}

describe('maxUploadSizeBytes', () => {
  it('caps JPG/PNG/PDF at 25MB', () => {
    expect(maxUploadSizeBytes('image/jpeg')).toBe(25 * 1024 * 1024);
    expect(maxUploadSizeBytes('image/png')).toBe(25 * 1024 * 1024);
    expect(maxUploadSizeBytes('application/pdf')).toBe(25 * 1024 * 1024);
  });

  it('caps SVG at 5MB — the smaller cap for a text-based, sanitization-sensitive format', () => {
    expect(maxUploadSizeBytes('image/svg+xml')).toBe(5 * 1024 * 1024);
  });

  it('rejects any other MIME type outright — null means "not accepted"', () => {
    expect(maxUploadSizeBytes('image/gif')).toBeNull();
    expect(maxUploadSizeBytes('application/octet-stream')).toBeNull();
    expect(maxUploadSizeBytes('text/html')).toBeNull();
  });
});

describe('effectiveDpi', () => {
  it('matches §13.1.6\'s formula exactly: widthPx / (targetWidthMm / 25.4)', () => {
    // A 1200px-wide image targeting a 300mm-wide product: 300mm = 11.811in, 1200/11.811 = ~101.6 DPI.
    expect(effectiveDpi(1200, 300)).toBeCloseTo(101.6, 1);
  });

  it('a print-quality image at its reference size is comfortably above the warning thresholds', () => {
    // 300 DPI at a common target width.
    expect(effectiveDpi(3543, 300)).toBeCloseTo(300, 0);
  });
});

describe('evaluateResolution', () => {
  it('warns nothing at or above 150 DPI', () => {
    expect(evaluateResolution(effectiveDpiToWidthPx(150, 300), 300)).toEqual([]);
    expect(evaluateResolution(effectiveDpiToWidthPx(300, 300), 300)).toEqual([]);
  });

  it('warns LOW_RESOLUTION just under 150 DPI', () => {
    const warnings = evaluateResolution(effectiveDpiToWidthPx(149, 300), 300);
    expect(codesOf(warnings)).toEqual(['LOW_RESOLUTION']);
    expect(warnings[0]?.requiresAcknowledgement).toBe(true);
  });

  it('warns VERY_LOW_RESOLUTION just under 100 DPI, not LOW_RESOLUTION', () => {
    const warnings = evaluateResolution(effectiveDpiToWidthPx(99, 300), 300);
    expect(codesOf(warnings)).toEqual(['VERY_LOW_RESOLUTION']);
  });

  it('the 100 DPI boundary itself is not VERY_LOW — only strictly below', () => {
    // 254mm = 10in exactly, so 1000px / 10in = exactly 100 DPI with no
    // float round-trip error (unlike effectiveDpiToWidthPx against 300mm).
    const warnings = evaluateResolution(1000, 254);
    expect(codesOf(warnings)).toEqual(['LOW_RESOLUTION']);
  });
});

describe('evaluateAspectMismatch', () => {
  it('warns nothing when the upload matches the target proportions', () => {
    expect(evaluateAspectMismatch(1200, 800, 300, 200)).toEqual([]);
  });

  it('warns nothing within the 5% tolerance', () => {
    // Target ratio 1.5; upload ratio 1.55 is ~3.3% off.
    expect(evaluateAspectMismatch(1550, 1000, 300, 200)).toEqual([]);
  });

  it('warns ASPECT_MISMATCH once the difference exceeds 5%', () => {
    // Target ratio 1.5; a square upload (ratio 1.0) is 33% off.
    const warnings = evaluateAspectMismatch(1000, 1000, 300, 200);
    expect(codesOf(warnings)).toEqual(['ASPECT_MISMATCH']);
    expect(warnings[0]?.requiresAcknowledgement).toBe(true);
  });
});

describe('sanitizeFilenameForDisplay', () => {
  it('leaves an ordinary filename with spaces and hyphens untouched', () => {
    expect(sanitizeFilenameForDisplay('mój wzor-final.svg')).toBe('mój wzor-final.svg');
  });

  it('strips a path prefix, keeping only the filename', () => {
    expect(sanitizeFilenameForDisplay('/etc/passwd')).toBe('passwd');
    expect(sanitizeFilenameForDisplay('C:\\Users\\name\\project.svg')).toBe('project.svg');
  });

  it('strips control characters without touching printable ones around them', () => {
    expect(sanitizeFilenameForDisplay('bad\u0000name\u0007.svg')).toBe('badname.svg');
  });

  it('falls back to a placeholder if nothing printable remains', () => {
    expect(sanitizeFilenameForDisplay('\u0000\u0001\u0002')).toBe('plik');
  });

  it('caps length at 100 characters', () => {
    const long = `${'a'.repeat(150)}.svg`;
    const result = sanitizeFilenameForDisplay(long);
    expect(result.length).toBe(100);
  });
});

/** Inverse of `effectiveDpi`, so tests can express intent in DPI rather than raw pixels. */
function effectiveDpiToWidthPx(dpi: number, targetWidthMm: number): number {
  return Math.round(dpi * (targetWidthMm / 25.4));
}
