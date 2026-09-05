/**
 * `docs/AI-CHECKLIST.md` ARCH-02 - `Configurator.tsx` was 1 632 lines, three
 * times the next largest file in the repository, with no test of its own
 * except through e2e.
 *
 * These cover the pure helpers that came out of it. They are worth having
 * for their own sake, not merely as refactor cover: `mergeWithDefaults` in
 * particular encodes a rule nothing else stated, and it is the rule a
 * careless edit would quietly reverse.
 *
 * They also remove a smell. `computeDefaultSelections` was exported from a
 * `'use client'` file purely so a unit test could reach it, which makes a
 * client-component module part of the test surface; Next treats every export
 * of such a file as a client reference. In a plain module it is simply a
 * function.
 */

import { describe, expect, it } from 'vitest';

import { EMPTY_SELECTIONS } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { cmInputFor, mergeWithDefaults } from '@/ui/islands/configurator/selections';

function selections(overrides: Partial<Selections>): Selections {
  return { ...EMPTY_SELECTIONS, ...overrides };
}

describe('cmInputFor', () => {
  it('renders millimetres as the centimetres a customer types', () => {
    expect(cmInputFor(700)).toBe('70');
  });

  it('leaves the field empty rather than showing a zero', () => {
    // An unset dimension is not 0 cm. A field pre-filled with "0" reads as a
    // value somebody chose, and on a `requiresExactSize` product it is the
    // one field the customer genuinely has to supply.
    expect(cmInputFor(null)).toBe('');
  });
});

describe('mergeWithDefaults', () => {
  const defaults = selections({
    designId: 'default-design',
    materialId: 'default-material',
    finishId: 'default-finish',
    widthMm: 700,
    heightMm: 700,
    thicknessMm: 27,
    installationVariant: 'FULL_WALL',
    fontId: 'default-font',
    personalizationText: 'default text',
    customUploadId: 'default-upload',
  });

  it('keeps every value the URL actually carries', () => {
    // A shared link, a cart "Edytuj" link or a saved project always carries
    // every field, so for those this is a no-op - which is the point.
    const fromUrl = selections({ designId: 'link-design', materialId: 'link-material', widthMm: 200 });

    const merged = mergeWithDefaults(fromUrl, defaults);

    expect(merged.designId).toBe('link-design');
    expect(merged.materialId).toBe('link-material');
    expect(merged.widthMm).toBe(200);
  });

  it('fills only what the URL left unset', () => {
    const merged = mergeWithDefaults(EMPTY_SELECTIONS, defaults);

    expect(merged.designId).toBe('default-design');
    expect(merged.materialId).toBe('default-material');
    expect(merged.finishId).toBe('default-finish');
    expect(merged.heightMm).toBe(700);
  });

  it.each(['thicknessMm', 'installationVariant', 'personalizationText', 'fontId', 'customUploadId'] as const)(
    'never defaults %s, even when the URL is silent about it',
    (field) => {
      /*
        The asymmetry this file exists to pin, and the reason it is not an
        oversight:

        - `thicknessMm` and `installationVariant` are constrained by each
          other (an OVERLAY variant caps thickness), so guessing one can put
          the configuration into a combination the customer never chose and
          the feasibility rules then refuse.
        - `personalizationText` is the customer's own words. Inventing them
          is not a default, it is authorship.
        - `fontId` only means anything alongside that text.
        - `customUploadId` names a file belonging to a specific person;
          defaulting it would attach somebody else's upload.

        Reversing any of these looks like a tidy-up - "why are these five
        treated differently?" - which is exactly why it needs to be a test
        rather than a comment.
      */
      expect(mergeWithDefaults(EMPTY_SELECTIONS, defaults)[field]).toBeNull();
    },
  );

  it('returns a complete Selections, with no field left undefined', () => {
    // It is fed straight into `setSelections` and then to the server. A
    // missing key would reach `parseSelections` as `undefined` rather than
    // `null` and be rejected as a malformed payload (BUG-07).
    const merged = mergeWithDefaults(EMPTY_SELECTIONS, defaults);

    for (const key of Object.keys(EMPTY_SELECTIONS) as (keyof Selections)[]) {
      expect(merged[key], key).not.toBeUndefined();
    }
  });
});
