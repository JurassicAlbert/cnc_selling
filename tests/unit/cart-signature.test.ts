import { describe, expect, it } from 'vitest';

import { cartItemSignature } from '@/domain/cart/signature';
import type { Selections } from '@/domain/configuration/steps';

/**
 * `docs/AUDIT-2026-08-30.md` P1-4. These assertions are the actual product
 * rule, not an implementation detail: what counts as "the same line" in a
 * cart. Getting it wrong in either direction is a real customer-visible
 * bug — merge too eagerly and someone who ordered two different sizes
 * receives one; merge too little and a double-click leaves a duplicate.
 */

const EMPTY: Selections = {
  designId: null,
  customUploadId: null,
  materialId: null,
  widthMm: null,
  heightMm: null,
  thicknessMm: null,
  finishId: null,
  installationVariant: null,
  personalizationText: null,
  fontId: null,
};

const BASE: Selections = {
  ...EMPTY,
  designId: 'design-1',
  materialId: 'material-1',
  finishId: 'finish-1',
  widthMm: 700,
  heightMm: 500,
  thicknessMm: 18,
  personalizationText: 'Anna',
  fontId: 'font-1',
};

describe('cartItemSignature', () => {
  it('treats two identical configurations of the same product as the same line', () => {
    expect(cartItemSignature('product-1', BASE)).toBe(cartItemSignature('product-1', { ...BASE }));
  });

  it('treats the same configuration of a different product as a different line', () => {
    expect(cartItemSignature('product-1', BASE)).not.toBe(cartItemSignature('product-2', BASE));
  });

  it.each([
    ['pattern', { designId: 'design-2' }],
    ['custom design', { customUploadId: 'upload-1' }],
    ['material', { materialId: 'material-2' }],
    ['finish', { finishId: 'finish-2' }],
    ['thickness', { thicknessMm: 25 }],
    ['width', { widthMm: 701 }],
    ['height', { heightMm: 501 }],
    ['installation variant', { installationVariant: 'BACKSPLASH' }],
    ['engraved text', { personalizationText: 'Marek' }],
    ['font', { fontId: 'font-2' }],
  ] as const)('treats a different %s as a different line', (_label, change) => {
    expect(cartItemSignature('product-1', { ...BASE, ...change })).not.toBe(cartItemSignature('product-1', BASE));
  });

  it('does not fold engraved text case — two different engravings are two different products', () => {
    expect(cartItemSignature('product-1', { ...BASE, personalizationText: 'ANNA' })).not.toBe(
      cartItemSignature('product-1', BASE),
    );
  });

  it('ignores trailing whitespace in engraved text — the engraver would too', () => {
    expect(cartItemSignature('product-1', { ...BASE, personalizationText: '  Anna  ' })).toBe(
      cartItemSignature('product-1', BASE),
    );
  });

  /**
   * Without a distinct marker for "unset", a null field and a field whose
   * value happens to be the next field's value could produce the same
   * joined string — two different configurations silently merging into one.
   */
  it('never collides an unset field with an empty-string value', () => {
    expect(cartItemSignature('p', { ...EMPTY, personalizationText: '' })).not.toBe(cartItemSignature('p', EMPTY));
  });

  it('never lets a value containing the separator shift the other fields', () => {
    expect(cartItemSignature('p', { ...EMPTY, designId: 'a|b' })).not.toBe(
      cartItemSignature('p', { ...EMPTY, designId: 'a', customUploadId: 'b' }),
    );
  });
});
