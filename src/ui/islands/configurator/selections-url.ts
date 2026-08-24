/**
 * The `Selections` <-> URL query-string mapping — extracted out of
 * `Configurator.tsx` (a `'use client'` file) into its own plain module.
 * Next.js treats every export of a `'use client'` file as a client
 * reference, even a pure non-component function — so a Server Component
 * (the cart page's "Edytuj" link) cannot import `writeSelectionsToSearch`
 * from `Configurator.tsx` directly, only render it. This file has no
 * directive at all, so both the client island and server pages can import
 * it safely.
 *
 * The two functions stay next to each other on purpose, same as before:
 * a field added to one and not the other is exactly how a refresh silently
 * drops data.
 */

import type { Selections } from '@/domain/configuration/steps';

function intOrNull(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function readSelectionsFromSearch(search: string): Selections {
  const params = new URLSearchParams(search);
  return {
    designId: params.get('d'),
    customUploadId: null,
    materialId: params.get('m'),
    widthMm: intOrNull(params.get('w')),
    heightMm: intOrNull(params.get('h')),
    thicknessMm: intOrNull(params.get('t')),
    finishId: params.get('f'),
    installationVariant: params.get('i'),
    personalizationText: params.get('p'),
    fontId: params.get('ft'),
  };
}

export function writeSelectionsToSearch(selections: Selections): string {
  const params = new URLSearchParams();
  if (selections.designId !== null) params.set('d', selections.designId);
  if (selections.materialId !== null) params.set('m', selections.materialId);
  if (selections.widthMm !== null) params.set('w', String(selections.widthMm));
  if (selections.heightMm !== null) params.set('h', String(selections.heightMm));
  if (selections.thicknessMm !== null) params.set('t', String(selections.thicknessMm));
  if (selections.finishId !== null) params.set('f', selections.finishId);
  if (selections.installationVariant !== null) params.set('i', selections.installationVariant);
  if (selections.personalizationText !== null && selections.personalizationText !== '') {
    params.set('p', selections.personalizationText);
  }
  if (selections.fontId !== null) params.set('ft', selections.fontId);
  return params.toString();
}
