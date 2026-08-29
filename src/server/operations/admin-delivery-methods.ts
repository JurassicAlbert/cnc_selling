/**
 * Staff `DeliveryMethod` mutations — same `applyXxx(staff, ...)` /
 * `xxx(...)` split, same `FormData`-reading shape as `admin-finishes.ts`
 * (name/desc/price/two numeric bounds/boolean/sortOrder). No `slug` — a
 * delivery method has no public URL, only ever referenced by id from
 * checkout and from `Order.deliveryMethodId`. No delete — a real FK
 * target of `Order`; `isActive` toggle only.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type DeliveryMethodMutationResult = { readonly ok: true; readonly id: string } | { readonly ok: false; readonly detail: string };

type DeliveryMethodFields = {
  readonly namePl: string;
  readonly descPl: string;
  readonly priceGrosze: number;
  readonly freeShippingThresholdGrosze: number | null;
  readonly estimatedDaysMin: number;
  readonly estimatedDaysMax: number;
  readonly carrier: string | null;
  readonly trackingAvailable: boolean;
  readonly requiresPickupPoint: boolean;
  readonly sortOrder: number;
};

function readDeliveryMethodFields(formData: FormData): DeliveryMethodFields {
  const carrierRaw = String(formData.get('carrier') ?? '').trim();
  const thresholdRaw = String(formData.get('freeShippingThresholdPln') ?? '').trim();
  return {
    namePl: String(formData.get('namePl') ?? ''),
    descPl: String(formData.get('descPl') ?? ''),
    priceGrosze: Math.round(Number(formData.get('pricePln') ?? 0) * 100),
    freeShippingThresholdGrosze: thresholdRaw.length > 0 ? Math.round(Number(thresholdRaw) * 100) : null,
    estimatedDaysMin: Number(formData.get('estimatedDaysMin') ?? 0),
    estimatedDaysMax: Number(formData.get('estimatedDaysMax') ?? 0),
    carrier: carrierRaw.length > 0 ? carrierRaw : null,
    trackingAvailable: formData.get('trackingAvailable') === 'on',
    requiresPickupPoint: formData.get('requiresPickupPoint') === 'on',
    sortOrder: Number(formData.get('sortOrder') ?? 0),
  };
}

function validateDeliveryMethodFields(fields: DeliveryMethodFields): string | null {
  if (fields.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  if (fields.priceGrosze < 0) {
    return 'Cena nie może być ujemna.';
  }
  if (fields.freeShippingThresholdGrosze !== null && fields.freeShippingThresholdGrosze < 0) {
    return 'Próg darmowej dostawy nie może być ujemny.';
  }
  if (fields.estimatedDaysMin > fields.estimatedDaysMax) {
    return `Minimalny czas dostawy (${fields.estimatedDaysMin} dni) nie może być dłuższy od maksymalnego (${fields.estimatedDaysMax} dni).`;
  }
  return null;
}

export async function applyCreateDeliveryMethod(staff: CurrentSession, formData: FormData): Promise<DeliveryMethodMutationResult> {
  const fields = readDeliveryMethodFields(formData);
  const issue = validateDeliveryMethodFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const method = await prisma.deliveryMethod.create({ data: fields });
  await writeAuditLog({ actor: staff, entity: 'DeliveryMethod', entityId: method.id, action: 'create', diff: fields });
  return { ok: true, id: method.id };
}

export async function createDeliveryMethod(formData: FormData): Promise<DeliveryMethodMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreateDeliveryMethod(staff, formData);
  if (result.ok) {
    revalidatePath('/panel/dostawa');
    revalidatePath('/koszyk/zamowienie');
  }
  return result;
}

export async function applyUpdateDeliveryMethod(staff: CurrentSession, id: string, formData: FormData): Promise<DeliveryMethodMutationResult> {
  const fields = readDeliveryMethodFields(formData);
  const issue = validateDeliveryMethodFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const current = await prisma.deliveryMethod.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Metoda dostawy nie istnieje.' };
  }
  await prisma.deliveryMethod.update({ where: { id }, data: fields });
  await writeAuditLog({ actor: staff, entity: 'DeliveryMethod', entityId: id, action: 'update', diff: { before: current, after: fields } });
  return { ok: true, id };
}

export async function updateDeliveryMethod(id: string, formData: FormData): Promise<DeliveryMethodMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateDeliveryMethod(staff, id, formData);
  if (result.ok) {
    revalidatePath('/panel/dostawa');
    revalidatePath(`/panel/dostawa/${id}`);
    revalidatePath('/koszyk/zamowienie');
  }
  return result;
}

export async function applySetDeliveryMethodActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.deliveryMethod.findUnique({ where: { id }, select: { isActive: true } });
  if (current === null) {
    return;
  }
  await prisma.deliveryMethod.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'DeliveryMethod',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });
}

export async function setDeliveryMethodActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetDeliveryMethodActive(staff, id, isActive);
  revalidatePath('/panel/dostawa');
  revalidatePath(`/panel/dostawa/${id}`);
  revalidatePath('/koszyk/zamowienie');
}

// --- Weight tiers -------------------------------------------------------

/**
 * A carrier's real published price brackets — `docs/AUDIT-2026-08-30.md`
 * §20. These decide what a customer is actually charged for any method that
 * has them (`domain/checkout/delivery.ts`'s `evaluateDeliveryMethod`); the
 * method's own `priceGrosze` is only the fallback for a method with none.
 * Until now the panel had no way to see or change them, so an admin editing
 * "Cena" on the InPost or DPD methods would have seen no effect on the real
 * charge at all.
 *
 * Deletable outright, like the product sub-resources in
 * `admin-product-catalogue.ts` and for the same reason: no order joins to a
 * tier. `Order.shippingGrosze` and `deliveryMethodNamePl` are snapshotted at
 * checkout, so changing or removing a tier can never alter what a past order
 * says it was charged.
 *
 * Audited against entity `'DeliveryMethod'`, not a separate entity — these
 * are edits to one method's pricing, and staff reading the method's activity
 * timeline should see them there.
 */
export type DeliveryWeightTierInput = {
  readonly labelPl: string;
  readonly maxWeightGrams: number;
  readonly priceGrosze: number;
  /** Only set for a genuine physical limit (a parcel locker's real door size) — `null` for a courier with no such constraint in its published data. */
  readonly maxWidthMm: number | null;
  readonly maxHeightMm: number | null;
  readonly maxDepthMm: number | null;
};

function validateWeightTier(input: DeliveryWeightTierInput): string | null {
  if (input.labelPl.trim().length === 0) {
    return 'Nazwa progu jest wymagana.';
  }
  // A 0 g (or negative) bracket would match every cart including an empty
  // one, and being the lightest it would win on price — silently becoming
  // the price of everything.
  if (!Number.isFinite(input.maxWeightGrams) || input.maxWeightGrams <= 0) {
    return 'Maksymalna waga musi być większa od zera.';
  }
  if (!Number.isFinite(input.priceGrosze) || input.priceGrosze < 0) {
    return 'Cena nie może być ujemna.';
  }
  for (const value of [input.maxWidthMm, input.maxHeightMm, input.maxDepthMm]) {
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      return 'Wymiary maksymalne muszą być dodatnie albo puste.';
    }
  }
  return null;
}

export async function applyAddDeliveryWeightTier(
  staff: CurrentSession,
  deliveryMethodId: string,
  input: DeliveryWeightTierInput,
): Promise<DeliveryMethodMutationResult> {
  const issue = validateWeightTier(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const method = await prisma.deliveryMethod.findUnique({ where: { id: deliveryMethodId }, select: { id: true } });
  if (method === null) {
    return { ok: false, detail: 'Metoda dostawy nie istnieje.' };
  }
  await prisma.deliveryWeightTier.create({
    data: {
      deliveryMethodId,
      labelPl: input.labelPl.trim(),
      maxWeightGrams: input.maxWeightGrams,
      priceGrosze: input.priceGrosze,
      maxWidthMm: input.maxWidthMm,
      maxHeightMm: input.maxHeightMm,
      maxDepthMm: input.maxDepthMm,
      // `sortOrder` mirrors the bracket, so a tier added out of order still
      // reads correctly anywhere the raw `sortOrder` is used.
      sortOrder: input.maxWeightGrams,
    },
  });
  await writeAuditLog({
    actor: staff,
    entity: 'DeliveryMethod',
    entityId: deliveryMethodId,
    action: 'update',
    diff: { addWeightTier: input },
  });
  return { ok: true, id: deliveryMethodId };
}

export async function addDeliveryWeightTier(
  deliveryMethodId: string,
  input: DeliveryWeightTierInput,
): Promise<DeliveryMethodMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyAddDeliveryWeightTier(staff, deliveryMethodId, input);
  if (result.ok) {
    revalidatePath(`/panel/dostawa/${deliveryMethodId}`);
    // Checkout renders every method's real evaluated price, so a changed
    // rate card must not keep serving the old one from cache.
    revalidatePath('/koszyk/zamowienie');
  }
  return result;
}

export async function applyRemoveDeliveryWeightTier(
  staff: CurrentSession,
  deliveryMethodId: string,
  tierId: string,
): Promise<void> {
  // `deleteMany` scoped to the method, not `delete` by id: it makes the
  // parent id part of the authorization check rather than trusting the tier
  // id alone, and a double-clicked remove is a no-op instead of a throw.
  const removed = await prisma.deliveryWeightTier.deleteMany({ where: { id: tierId, deliveryMethodId } });
  if (removed.count === 0) {
    return;
  }
  await writeAuditLog({
    actor: staff,
    entity: 'DeliveryMethod',
    entityId: deliveryMethodId,
    action: 'update',
    diff: { removeWeightTier: tierId },
  });
}

export async function removeDeliveryWeightTier(deliveryMethodId: string, tierId: string): Promise<void> {
  const staff = await requireStaffSession();
  await applyRemoveDeliveryWeightTier(staff, deliveryMethodId, tierId);
  revalidatePath(`/panel/dostawa/${deliveryMethodId}`);
  revalidatePath('/koszyk/zamowienie');
}
