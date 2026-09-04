/**
 * Pure upload-inspection math. Everything here is `ARCHITECTURE.md`
 * §13.1's numeric rules, extracted so they're testable without touching
 * a file, `sharp`, or the network - the actual I/O (magic-byte sniffing,
 * SVG sanitization, PDF inspection, `sharp` calls) lives in
 * `src/server/upload/inspect-file.ts` and calls into this module for the
 * DPI/aspect decisions once it has real pixel dimensions.
 *
 * `UploadWarning` copies `domain/feasibility`'s `FeasibilityFinding`
 * shape exactly (`code`, `severity`, `requiresAcknowledgement`,
 * `params`) - `CustomerDesign.autoWarnings`'s schema comment already
 * describes it as "UploadWarning[] from the upload inspector," the same
 * pattern, not a new one.
 */

import type { Severity } from '@/domain/feasibility/rules';

export type UploadWarningCode = 'LOW_RESOLUTION' | 'VERY_LOW_RESOLUTION' | 'ASPECT_MISMATCH';

export type UploadWarning = {
  readonly code: UploadWarningCode;
  readonly severity: Severity;
  readonly requiresAcknowledgement: boolean;
  readonly params: Readonly<Record<string, number | string>>;
};

/** §13.1.1's size caps, keyed by the magic-byte-sniffed MIME type - never the client's declared type or the file extension. `null` means this MIME type is not accepted at all. */
export function maxUploadSizeBytes(mimeType: string): number | null {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/png':
    case 'application/pdf':
      return 25 * 1024 * 1024;
    case 'image/svg+xml':
      return 5 * 1024 * 1024;
    default:
      return null;
  }
}

/** §13.1.6: `effectiveDpi = widthPx / (targetWidthMm / 25.4)`. */
export function effectiveDpi(widthPx: number, targetWidthMm: number): number {
  return widthPx / (targetWidthMm / 25.4);
}

const LOW_DPI_THRESHOLD = 150;
const VERY_LOW_DPI_THRESHOLD = 100;

/** §13.1.6: warn below 150 DPI, warn harder below 100 - neither blocks the upload, both need the customer's acknowledgement before continuing. */
export function evaluateResolution(widthPx: number, targetWidthMm: number): UploadWarning[] {
  const dpi = effectiveDpi(widthPx, targetWidthMm);

  if (dpi < VERY_LOW_DPI_THRESHOLD) {
    return [
      {
        code: 'VERY_LOW_RESOLUTION',
        severity: 'warning',
        requiresAcknowledgement: true,
        params: { effectiveDpi: round1(dpi), thresholdDpi: VERY_LOW_DPI_THRESHOLD },
      },
    ];
  }

  if (dpi < LOW_DPI_THRESHOLD) {
    return [
      {
        code: 'LOW_RESOLUTION',
        severity: 'warning',
        requiresAcknowledgement: true,
        params: { effectiveDpi: round1(dpi), thresholdDpi: LOW_DPI_THRESHOLD },
      },
    ];
  }

  return [];
}

/**
 * §13.1.7: "aspect mismatch between the upload and the target product
 * proportions → warning with a crop preview." The crop preview itself is
 * a server/UI concern; this only decides whether the mismatch is real
 * enough to warn about. A 5% relative tolerance on the aspect ratio is
 * this project's own threshold (not specified further) - small enough
 * that ordinary photo/scan variance doesn't trigger it, large enough
 * that a genuinely different shape (e.g. square art on an oblong panel)
 * does.
 */
const ASPECT_TOLERANCE_RATIO = 0.05;

export function evaluateAspectMismatch(
  uploadWidthPx: number,
  uploadHeightPx: number,
  targetWidthMm: number,
  targetHeightMm: number,
): UploadWarning[] {
  const uploadRatio = uploadWidthPx / uploadHeightPx;
  const targetRatio = targetWidthMm / targetHeightMm;
  const relativeDifference = Math.abs(uploadRatio - targetRatio) / targetRatio;

  if (relativeDifference <= ASPECT_TOLERANCE_RATIO) {
    return [];
  }

  return [
    {
      code: 'ASPECT_MISMATCH',
      severity: 'warning',
      requiresAcknowledgement: true,
      params: { uploadRatio: round2(uploadRatio), targetRatio: round2(targetRatio) },
    },
  ];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const MAX_DISPLAY_FILENAME_LENGTH = 100;
const MIN_PRINTABLE_CODE_POINT = 32;
const DELETE_CODE_POINT = 127;

/**
 * §13.1.8: "filename sanitization for display; the storage key is a
 * generated opaque id and never derived from user input." This is purely
 * about what's safe to *show* the customer/staff later (strip path
 * separators and control characters, cap length) - it plays no role in
 * where the file is actually written, which always uses a
 * `crypto.randomUUID()` storage key regardless of what this returns.
 * Filtered by character code rather than a regex control-character
 * class deliberately - those classes are easy to get subtly wrong.
 */
export function sanitizeFilenameForDisplay(rawName: string): string {
  const withoutPath = rawName.replace(/^.*[/\\]/, '');
  const withoutControlChars = Array.from(withoutPath)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= MIN_PRINTABLE_CODE_POINT && code !== DELETE_CODE_POINT;
    })
    .join('');
  const trimmed = withoutControlChars.trim();
  const safe = trimmed.length === 0 ? 'plik' : trimmed;
  return safe.length > MAX_DISPLAY_FILENAME_LENGTH ? safe.slice(0, MAX_DISPLAY_FILENAME_LENGTH) : safe;
}
