import { describe, expect, it } from 'vitest';

import { findPickupPointById, searchPickupPoints } from '@/server/delivery/pickup-points';

describe('searchPickupPoints', () => {
  it('returns every point for an empty query — the initial "browse all" state', () => {
    const all = searchPickupPoints('');
    expect(all.length).toBeGreaterThan(0);
  });

  it('matches by city, case- and diacritic-insensitively', () => {
    const results = searchPickupPoints('warszawa');
    expect(results.length).toBeGreaterThan(0);
    for (const point of results) {
      expect(point.city).toBe('Warszawa');
    }
  });

  it('matches by postal code prefix', () => {
    const results = searchPickupPoints('31-');
    expect(results.length).toBeGreaterThan(0);
    for (const point of results) {
      expect(point.postalCode.startsWith('31-')).toBe(true);
    }
  });

  it('returns nothing for a city with no seeded points', () => {
    expect(searchPickupPoints('Nieistniejące Miasto')).toEqual([]);
  });
});

describe('findPickupPointById', () => {
  it('finds a real seeded point by id', () => {
    const [first] = searchPickupPoints('');
    if (first === undefined) {
      throw new Error('expected at least one seeded pickup point');
    }
    expect(findPickupPointById(first.id)).toEqual(first);
  });

  it('returns null for an id that does not exist — checkout never trusts a client-supplied id on its own', () => {
    expect(findPickupPointById('not-a-real-point')).toBeNull();
  });
});
