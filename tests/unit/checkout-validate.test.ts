import { describe, expect, it } from 'vitest';

import { validateNip, validatePhone, validatePostalCode } from '@/domain/checkout/validate';

describe('validateNip', () => {
  it('accepts a NIP whose checksum digit is correct', () => {
    // Verified by hand: weights [6,5,7,2,3,4,5,6,7] over "526025027" sum to
    // 169; 169 % 11 === 4, matching the tenth digit.
    expect(validateNip('5260250274')).toBe(true);
  });

  it('rejects a NIP with a wrong checksum digit', () => {
    expect(validateNip('5260250270')).toBe(false);
  });

  it('rejects anything that is not exactly ten digits', () => {
    expect(validateNip('526025027')).toBe(false);
    expect(validateNip('52602502744')).toBe(false);
    expect(validateNip('526-025-02-74')).toBe(false);
    expect(validateNip('')).toBe(false);
  });

  it('rejects a NIP whose weighted sum is 10 mod 11 - defined invalid, not wrapped', () => {
    // 1111111111: sum = 1*(6+5+7+2+3+4+5+6+7) = 1*45 = 45; 45 % 11 = 1 - not
    // the case we want. Construct one whose control digit would be 10:
    // digits 1-9 = 000000004 -> sum = 4*7 = 28, 28 % 11 = 6, not 10 either.
    // Simplest reliable case: use the known-valid NIP's first 9 digits but
    // pick a prefix whose sum % 11 is genuinely 10.
    // "888888888": sum = 8*(6+5+7+2+3+4+5+6+7) = 8*45 = 360; 360 % 11 = 3.
    // Direct construction: find digits summing (mod 11) to 10 by weight 6
    // alone on digit 1, rest 0: 6*d1 % 11 = 10 -> d1=9 (6*9=54, 54%11=10).
    expect(validateNip('9000000000')).toBe(false);
  });
});

describe('validatePostalCode', () => {
  it('accepts the Polish NN-NNN format', () => {
    expect(validatePostalCode('00-001')).toBe(true);
    expect(validatePostalCode('90-001')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(validatePostalCode('00001')).toBe(false);
    expect(validatePostalCode('0-0001')).toBe(false);
    expect(validatePostalCode('AB-123')).toBe(false);
    expect(validatePostalCode('')).toBe(false);
  });
});

describe('validatePhone', () => {
  it('accepts common real-world written forms', () => {
    expect(validatePhone('600123456')).toBe(true);
    expect(validatePhone('+48 600 123 456')).toBe(true);
    expect(validatePhone('600-123-456')).toBe(true);
  });

  it('rejects obvious garbage', () => {
    expect(validatePhone('123')).toBe(false);
    expect(validatePhone('not a phone number')).toBe(false);
    expect(validatePhone('')).toBe(false);
  });
});
