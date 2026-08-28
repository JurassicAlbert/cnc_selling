'use server';

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
