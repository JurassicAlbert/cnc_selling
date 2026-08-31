/**
 * `docs/REVIEW-DETAILED.md` BUG-06 and BUG-07 — the two halves of "an input
 * the write path never looked at".
 *
 * BUG-06: `checkStepAppliesToProductType` had existed with 30 passing unit
 * tests since P3 and **nothing had ever called it**, while
 * `docs/CHECKLIST.md:81` claimed as a completed item that it "rejects e.g. a
 * THICKNESS selection on WALL_ART". `findSelectionOutsideProductType` is the
 * function the write path now calls, so those older tests finally guard
 * something.
 *
 * BUG-07: `zod` was a declared dependency that nothing imported, alongside a
 * §2 that named it as the validation layer.
 *
 * The tests here are pure. That they pass proves the rule is *correct*, not
 * that anything enforces it — which is exactly the trap both bugs came from,
 * so `tests/integration/step-and-input-validation.test.ts` drives the same
 * rules through `applyAddToCart` against a real database.
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_ACKNOWLEDGED_WARNINGS,
  MAX_PERSONALIZATION_TEXT_LENGTH,
  parseAcknowledgedWarnings,
  parseSelections,
} from '@/domain/configuration/input-schema';
import { EMPTY_SELECTIONS, findSelectionOutsideProductType, stepsForProductType } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { FEASIBILITY_CODES } from '@/domain/feasibility/rules';

function selections(overrides: Partial<Selections>): Selections {
  return { ...EMPTY_SELECTIONS, ...overrides };
}

describe('findSelectionOutsideProductType', () => {
  it('accepts a selection whose step the product type has', () => {
    // TABLE_TOP: DESIGN, MATERIAL, SIZE, THICKNESS, FINISH, PERSONALIZATION.
    const steps = stepsForProductType('TABLE_TOP');
    const chosen = selections({
      designId: 'd1',
      materialId: 'm1',
      widthMm: 400,
      heightMm: 400,
      thicknessMm: 18,
      finishId: 'f1',
      personalizationText: 'Ala',
      fontId: 'font1',
    });

    expect(findSelectionOutsideProductType(steps, chosen)).toBeNull();
  });

  it.each([
    // The exact cases named in the audit's acceptance criteria, plus every
    // other selection field a product type can lack.
    ['WALL_ART', 'thicknessMm', { thicknessMm: 18 }, 'THICKNESS'],
    ['WALL_ART', 'installationVariant', { installationVariant: 'FULL_WALL' }, 'INSTALLATION_VARIANT'],
    ['WALL_ART', 'customUploadId', { customUploadId: 'u1' }, 'CUSTOM_UPLOAD'],
    ['FLOOR_ELEMENT', 'personalizationText', { personalizationText: 'Ala' }, 'PERSONALIZATION'],
    ['FLOOR_ELEMENT', 'fontId', { fontId: 'font1' }, 'PERSONALIZATION'],
    ['KITCHEN_TILE', 'personalizationText', { personalizationText: 'Ala' }, 'PERSONALIZATION'],
    ['JEWELRY', 'finishId', { finishId: 'f1' }, 'FINISH'],
    ['JEWELRY', 'thicknessMm', { thicknessMm: 3 }, 'THICKNESS'],
    ['CUSTOM', 'designId', { designId: 'd1' }, 'DESIGN'],
  ] as const)('rejects %s + %s', (productType, field, override, expectedStep) => {
    const violation = findSelectionOutsideProductType(
      stepsForProductType(productType),
      selections(override),
    );

    expect(violation).toEqual({ selection: field, step: expectedStep });
  });

  it('never rejects MATERIAL or SIZE, which every product type has', () => {
    const chosen = selections({ materialId: 'm1', widthMm: 100, heightMm: 100 });

    for (const productType of ['WALL_ART', 'TABLE_TOP', 'KITCHEN_TILE', 'FLOOR_ELEMENT', 'CUSTOM', 'LOFT_FURNITURE', 'JEWELRY'] as const) {
      expect(findSelectionOutsideProductType(stepsForProductType(productType), chosen)).toBeNull();
    }
  });

  it('ignores fields left unset', () => {
    expect(findSelectionOutsideProductType(stepsForProductType('JEWELRY'), EMPTY_SELECTIONS)).toBeNull();
  });

  it('treats an empty string as set — it still reaches the database', () => {
    // `null` means "not chosen"; "" is a value someone sent.
    const violation = findSelectionOutsideProductType(
      stepsForProductType('FLOOR_ELEMENT'),
      selections({ personalizationText: '' }),
    );

    expect(violation).toEqual({ selection: 'personalizationText', step: 'PERSONALIZATION' });
  });
});

describe('parseSelections', () => {
  it('accepts the empty selection set', () => {
    expect(parseSelections(EMPTY_SELECTIONS)).toEqual(EMPTY_SELECTIONS);
  });

  it('accepts a fully populated, plausible selection set', () => {
    const chosen = selections({
      designId: 'cmt7e1h7v0001bo0jhz19l49o',
      materialId: 'cmt7e1h900003bo0jlgamkffh',
      widthMm: 700,
      heightMm: 700,
      thicknessMm: 18,
      personalizationText: 'Ala ma kota',
    });

    expect(parseSelections(chosen)).toEqual(chosen);
  });

  it('rejects engraved text longer than the hard ceiling', () => {
    // The real limit is `PersonalizationSpec.maxCharacters`, but
    // `evaluatePersonalization` returns no issues at all when a product has
    // no spec row — which is how unbounded text reached the order snapshot.
    expect(parseSelections(selections({ personalizationText: 'x'.repeat(MAX_PERSONALIZATION_TEXT_LENGTH) }))).not.toBeNull();
    expect(parseSelections(selections({ personalizationText: 'x'.repeat(MAX_PERSONALIZATION_TEXT_LENGTH + 1) }))).toBeNull();
  });

  it('rejects an unbounded id', () => {
    expect(parseSelections(selections({ designId: 'x'.repeat(65) }))).toBeNull();
  });

  it.each([
    ['a non-integer width', { widthMm: 12.5 }],
    ['a negative height', { heightMm: -1 }],
    ['a zero dimension', { widthMm: 0 }],
    ['an absurd dimension', { thicknessMm: 100_001 }],
  ])('rejects %s', (_label, override) => {
    expect(parseSelections({ ...EMPTY_SELECTIONS, ...override })).toBeNull();
  });

  it.each([
    ['a number where an id belongs', { designId: 42 }],
    ['a string where a number belongs', { widthMm: '700' }],
    ['an object where a string belongs', { personalizationText: { toString: 1 } }],
    ['an array', { materialId: ['m1'] }],
  ])('rejects %s rather than letting Prisma throw a 500', (_label, override) => {
    expect(parseSelections({ ...EMPTY_SELECTIONS, ...override })).toBeNull();
  });

  it('rejects a missing field rather than defaulting it', () => {
    const { materialId: _dropped, ...withoutMaterial } = EMPTY_SELECTIONS;
    expect(parseSelections(withoutMaterial)).toBeNull();
  });

  it.each([[null], [undefined], ['a string'], [42], [[]]])('rejects %s as the whole payload', (value) => {
    expect(parseSelections(value)).toBeNull();
  });
});

describe('parseAcknowledgedWarnings', () => {
  it('accepts an empty list', () => {
    expect(parseAcknowledgedWarnings([])).toEqual([]);
  });

  it('accepts every real feasibility code', () => {
    // Derived from the same array the rules use, so a new code cannot be
    // added without this staying true.
    expect(parseAcknowledgedWarnings([...FEASIBILITY_CODES])).toEqual([...FEASIBILITY_CODES]);
  });

  it('rejects a code that does not exist', () => {
    expect(parseAcknowledgedWarnings(['NATURAL_VARIATION', 'NOT_A_REAL_CODE'])).toBeNull();
  });

  it('rejects more entries than any configuration can produce', () => {
    const tooMany = Array.from({ length: MAX_ACKNOWLEDGED_WARNINGS + 1 }, () => 'NATURAL_VARIATION');
    expect(parseAcknowledgedWarnings(tooMany)).toBeNull();
  });

  it('rejects a long string used as storage', () => {
    expect(parseAcknowledgedWarnings(['x'.repeat(10_000)])).toBeNull();
  });

  it.each([[null], [undefined], ['NATURAL_VARIATION'], [{ 0: 'NATURAL_VARIATION' }]])(
    'rejects %s as the whole payload',
    (value) => {
      expect(parseAcknowledgedWarnings(value)).toBeNull();
    },
  );
});
