import { describe, expect, it } from 'vitest';

import { findPickupPointById, searchPickupPoints } from '@/server/delivery/pickup-points';

const INPOST = 'InPost Paczkomaty';
const DPD = 'DPD Pickup';

describe('searchPickupPoints', () => {
  it('returns every point for the given carrier on an empty query - the initial "browse all" state', () => {
    const all = searchPickupPoints(INPOST, '');
    expect(all.length).toBeGreaterThan(0);
    for (const point of all) {
      expect(point.carrier).toBe(INPOST);
    }
  });

  it('never mixes carriers - a DPD search never returns an InPost point and vice versa', () => {
    expect(searchPickupPoints(DPD, '').every((point) => point.carrier === DPD)).toBe(true);
    expect(searchPickupPoints(INPOST, '').every((point) => point.carrier === INPOST)).toBe(true);
  });

  it('matches by city, case- and diacritic-insensitively', () => {
    const results = searchPickupPoints(INPOST, 'warszawa');
    expect(results.length).toBeGreaterThan(0);
    for (const point of results) {
      expect(point.city).toBe('Warszawa');
    }
  });

  it('matches by postal code prefix', () => {
    const results = searchPickupPoints(INPOST, '31-');
    expect(results.length).toBeGreaterThan(0);
    for (const point of results) {
      expect(point.postalCode.startsWith('31-')).toBe(true);
    }
  });

  it('returns nothing for a city with no seeded points', () => {
    expect(searchPickupPoints(INPOST, 'Nieistniejące Miasto')).toEqual([]);
  });

  it('returns nothing for an unknown carrier', () => {
    expect(searchPickupPoints('Poczta Polska', '')).toEqual([]);
  });
});

describe('findPickupPointById', () => {
  it('finds a real seeded point by id, scoped to its own carrier', () => {
    const [first] = searchPickupPoints(INPOST, '');
    if (first === undefined) {
      throw new Error('expected at least one seeded pickup point');
    }
    expect(findPickupPointById(INPOST, first.id)).toEqual(first);
  });

  it('returns null when the id is real but for a different carrier', () => {
    const [inpostPoint] = searchPickupPoints(INPOST, '');
    if (inpostPoint === undefined) {
      throw new Error('expected at least one seeded pickup point');
    }
    expect(findPickupPointById(DPD, inpostPoint.id)).toBeNull();
  });

  it('returns null for an id that does not exist - checkout never trusts a client-supplied id on its own', () => {
    expect(findPickupPointById(INPOST, 'not-a-real-point')).toBeNull();
  });
});
