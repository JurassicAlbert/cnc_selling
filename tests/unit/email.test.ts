import { describe, expect, it } from 'vitest';

import { isPlausibleEmail } from '@/domain/text/email';

describe('isPlausibleEmail - a loose shape check, not full RFC 5322', () => {
  it('accepts real-looking addresses', () => {
    expect(isPlausibleEmail('staff@example.com')).toBe(true);
    expect(isPlausibleEmail('first.last+tag@sub.example.co.uk')).toBe(true);
  });

  it('rejects values with no @, no domain, or no TLD dot', () => {
    expect(isPlausibleEmail('not-an-email')).toBe(false);
    expect(isPlausibleEmail('admin')).toBe(false);
    expect(isPlausibleEmail('admin@')).toBe(false);
    expect(isPlausibleEmail('@example.com')).toBe(false);
    expect(isPlausibleEmail('admin@example')).toBe(false);
  });

  it('rejects whitespace and empty string', () => {
    expect(isPlausibleEmail('')).toBe(false);
    expect(isPlausibleEmail('  ')).toBe(false);
    expect(isPlausibleEmail('a b@example.com')).toBe(false);
  });
});
