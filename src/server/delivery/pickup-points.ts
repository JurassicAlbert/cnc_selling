/**
 * Pickup-point ("paczkomat"/punkt odbioru) picker data — 2026-08-29, owner
 * request: "powinny być wszystkie funkcjonalności które pozwalają ustalić
 * paczkomat, punkt itd na podstawie danych od dostawców" (there should be
 * all the functionality to determine a parcel locker/pickup point from
 * carrier data), explicitly "nie musi jeszcze działać e2e" (doesn't need to
 * actually work end-to-end yet).
 *
 * No live carrier locator API is integrated here — same §9/§15 "no fake
 * live data" discipline `Shipment`'s own header comment already states for
 * tracking. This is a real, honestly-static, representative sample of
 * pickup points (a handful of InPost Paczkomaty and courier pickup points
 * across a few major Polish cities) — enough for the real search-and-pick
 * UI/UX and server-side validation to genuinely work end-to-end against,
 * without claiming to be a live feed. Swapping this for a real locator API
 * later (InPost's "Geowidget"/points API, DPD Pickup, Poczta Polska) is a
 * drop-in replacement for `searchPickupPoints` alone — nothing else in the
 * checkout flow needs to change, since `PickupPoint` here is already the
 * shape a real API would return.
 */

export type PickupPoint = {
  readonly id: string;
  readonly carrier: string;
  readonly label: string;
  readonly city: string;
  readonly postalCode: string;
  readonly street: string;
};

const PICKUP_POINTS: readonly PickupPoint[] = [
  { id: 'WAW01M', carrier: 'InPost Paczkomaty', label: 'WAW01M — Warszawa, ul. Marszałkowska 84', city: 'Warszawa', postalCode: '00-517', street: 'Marszałkowska 84' },
  { id: 'WAW23A', carrier: 'InPost Paczkomaty', label: 'WAW23A — Warszawa, ul. Puławska 145', city: 'Warszawa', postalCode: '02-715', street: 'Puławska 145' },
  { id: 'KRA05M', carrier: 'InPost Paczkomaty', label: 'KRA05M — Kraków, ul. Karmelicka 10', city: 'Kraków', postalCode: '31-133', street: 'Karmelicka 10' },
  { id: 'KRA31N', carrier: 'InPost Paczkomaty', label: 'KRA31N — Kraków, al. Pokoju 22', city: 'Kraków', postalCode: '31-548', street: 'Aleja Pokoju 22' },
  { id: 'WRO12M', carrier: 'InPost Paczkomaty', label: 'WRO12M — Wrocław, ul. Krupnicza 15', city: 'Wrocław', postalCode: '50-075', street: 'Krupnicza 15' },
  { id: 'POZ08A', carrier: 'InPost Paczkomaty', label: 'POZ08A — Poznań, ul. Św. Marcin 40', city: 'Poznań', postalCode: '61-806', street: 'Święty Marcin 40' },
  { id: 'GDA14M', carrier: 'InPost Paczkomaty', label: 'GDA14M — Gdańsk, ul. Długa 5', city: 'Gdańsk', postalCode: '80-827', street: 'Długa 5' },
  { id: 'LOD02A', carrier: 'InPost Paczkomaty', label: 'LOD02A — Łódź, ul. Piotrkowska 90', city: 'Łódź', postalCode: '90-103', street: 'Piotrkowska 90' },
  { id: 'DPD-WAW-01', carrier: 'DPD Pickup', label: 'Punkt DPD — Warszawa, ul. Grójecka 130', city: 'Warszawa', postalCode: '02-111', street: 'Grójecka 130' },
  { id: 'DPD-KRA-01', carrier: 'DPD Pickup', label: 'Punkt DPD — Kraków, ul. Zakopiańska 62', city: 'Kraków', postalCode: '30-418', street: 'Zakopiańska 62' },
  { id: 'PP-WRO-01', carrier: 'Poczta Polska', label: 'Placówka Poczty Polskiej — Wrocław, Rynek 28', city: 'Wrocław', postalCode: '50-101', street: 'Rynek 28' },
  { id: 'PP-GDA-01', carrier: 'Poczta Polska', label: 'Placówka Poczty Polskiej — Gdańsk, ul. Wały Jagiellońskie 12', city: 'Gdańsk', postalCode: '80-887', street: 'Wały Jagiellońskie 12' },
];

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase('pl-PL');
}

/**
 * Matches on city or postal-code prefix — the two things a customer
 * actually has on hand at checkout. Empty/whitespace query returns
 * everything (used for the picker's initial "browse all" state).
 */
export function searchPickupPoints(query: string): readonly PickupPoint[] {
  const needle = normalise(query);
  if (needle.length === 0) {
    return PICKUP_POINTS;
  }
  return PICKUP_POINTS.filter(
    (point) => normalise(point.city).includes(needle) || point.postalCode.startsWith(needle),
  );
}

/** Server-side truth for "is this a real point?" — checkout validation never trusts an id/label pair typed or tampered with on the client, same discipline as every other id in this codebase. */
export function findPickupPointById(id: string): PickupPoint | null {
  return PICKUP_POINTS.find((point) => point.id === id) ?? null;
}
