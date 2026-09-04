/**
 * Pickup-point ("paczkomat"/punkt odbioru) picker data - 2026-08-29, owner
 * request: "powinny być wszystkie funkcjonalności które pozwalają ustalić
 * paczkomat, punkt itd na podstawie danych od dostawców" (there should be
 * all the functionality to determine a parcel locker/pickup point from
 * carrier data).
 *
 * A real, live carrier locator (InPost's "Geowidget"/Points API) needs a
 * real InPost business account (a free "Parcel Manager" registration, real
 * company details required - confirmed live: no unauthenticated public
 * endpoint exists for the Polish market) - nobody has one yet. This file
 * is honestly a static, representative sample - real street addresses in
 * real cities, but not a live, comprehensive directory - with the picker
 * UI (`CheckoutForm.tsx`) saying so directly rather than presenting it as
 * more complete than it is. Swapping this for the real API later is a
 * drop-in replacement for `searchPickupPoints` alone.
 *
 * 2026-08-29 follow-up, owner feedback: keep InPost Paczkomaty for now;
 * Poczta Polska dropped entirely (owner, verbatim: "we know that they do
 * shit and the parcels ... are often delayed by weeks-months") - not a
 * technical decision, a real business one. DPD's own pickup-point network
 * ("Punkt DPD Pickup") is a second real, separately-priced delivery
 * method (`prisma/seed.ts`'s `DELIVERY_METHOD_SEEDS`) with its own real
 * carrier value here, so a customer picking one method never sees the
 * other carrier's points mixed in - `searchPickupPoints` is carrier-scoped
 * for exactly that reason.
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
  { id: 'WAW01M', carrier: 'InPost Paczkomaty', label: 'WAW01M - Warszawa, ul. Marszałkowska 84', city: 'Warszawa', postalCode: '00-517', street: 'Marszałkowska 84' },
  { id: 'WAW23A', carrier: 'InPost Paczkomaty', label: 'WAW23A - Warszawa, ul. Puławska 145', city: 'Warszawa', postalCode: '02-715', street: 'Puławska 145' },
  { id: 'KRA05M', carrier: 'InPost Paczkomaty', label: 'KRA05M - Kraków, ul. Karmelicka 10', city: 'Kraków', postalCode: '31-133', street: 'Karmelicka 10' },
  { id: 'KRA31N', carrier: 'InPost Paczkomaty', label: 'KRA31N - Kraków, al. Pokoju 22', city: 'Kraków', postalCode: '31-548', street: 'Aleja Pokoju 22' },
  { id: 'WRO12M', carrier: 'InPost Paczkomaty', label: 'WRO12M - Wrocław, ul. Krupnicza 15', city: 'Wrocław', postalCode: '50-075', street: 'Krupnicza 15' },
  { id: 'POZ08A', carrier: 'InPost Paczkomaty', label: 'POZ08A - Poznań, ul. Św. Marcin 40', city: 'Poznań', postalCode: '61-806', street: 'Święty Marcin 40' },
  { id: 'GDA14M', carrier: 'InPost Paczkomaty', label: 'GDA14M - Gdańsk, ul. Długa 5', city: 'Gdańsk', postalCode: '80-827', street: 'Długa 5' },
  { id: 'LOD02A', carrier: 'InPost Paczkomaty', label: 'LOD02A - Łódź, ul. Piotrkowska 90', city: 'Łódź', postalCode: '90-103', street: 'Piotrkowska 90' },
  { id: 'SZC03M', carrier: 'InPost Paczkomaty', label: 'SZC03M - Szczecin, ul. Bogurodzicy 5', city: 'Szczecin', postalCode: '70-240', street: 'Bogurodzicy 5' },
  { id: 'KAT07A', carrier: 'InPost Paczkomaty', label: 'KAT07A - Katowice, ul. Mariacka 3', city: 'Katowice', postalCode: '40-014', street: 'Mariacka 3' },
  { id: 'LUB04M', carrier: 'InPost Paczkomaty', label: 'LUB04M - Lublin, ul. Krakowskie Przedmieście 12', city: 'Lublin', postalCode: '20-002', street: 'Krakowskie Przedmieście 12' },
  { id: 'BYD02A', carrier: 'InPost Paczkomaty', label: 'BYD02A - Bydgoszcz, ul. Gdańska 30', city: 'Bydgoszcz', postalCode: '85-005', street: 'Gdańska 30' },
  { id: 'DPD-WAW-01', carrier: 'DPD Pickup', label: 'Punkt DPD - Warszawa, ul. Grójecka 130', city: 'Warszawa', postalCode: '02-111', street: 'Grójecka 130' },
  { id: 'DPD-KRA-01', carrier: 'DPD Pickup', label: 'Punkt DPD - Kraków, ul. Zakopiańska 62', city: 'Kraków', postalCode: '30-418', street: 'Zakopiańska 62' },
  { id: 'DPD-WRO-01', carrier: 'DPD Pickup', label: 'Punkt DPD - Wrocław, ul. Legnicka 46', city: 'Wrocław', postalCode: '54-202', street: 'Legnicka 46' },
  { id: 'DPD-POZ-01', carrier: 'DPD Pickup', label: 'Punkt DPD - Poznań, ul. Głogowska 31', city: 'Poznań', postalCode: '60-702', street: 'Głogowska 31' },
];

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase('pl-PL');
}

/**
 * Matches on city or postal-code prefix, scoped to one carrier - a
 * customer who picked "Paczkomat" (InPost) must never be offered a DPD
 * point, and vice versa. Empty/whitespace query returns every point for
 * that carrier (the picker's initial "browse all" state).
 */
export function searchPickupPoints(carrier: string, query: string): readonly PickupPoint[] {
  const needle = normalise(query);
  const inCarrier = PICKUP_POINTS.filter((point) => point.carrier === carrier);
  if (needle.length === 0) {
    return inCarrier;
  }
  return inCarrier.filter((point) => normalise(point.city).includes(needle) || point.postalCode.startsWith(needle));
}

/** Server-side truth for "is this a real point, for this carrier?" - checkout validation never trusts an id/label pair typed or tampered with on the client, same discipline as every other id in this codebase. */
export function findPickupPointById(carrier: string, id: string): PickupPoint | null {
  return PICKUP_POINTS.find((point) => point.carrier === carrier && point.id === id) ?? null;
}
