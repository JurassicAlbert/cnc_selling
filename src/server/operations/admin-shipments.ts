/**
 * Staff `Shipment` mutations - one upsert per order (1:1, no separate
 * create/update/list like the catalogue entities: a shipment has no
 * standalone admin page, it's always nested on that order's detail page).
 * Manual only - nothing here ever calls a carrier API, because none is
 * integrated anywhere in this project (§9/§15's "no fake carrier
 * tracking" rule): every field is exactly what a staff member typed.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import type { ShipmentStatus } from '@/generated/prisma/enums';

export type ShipmentMutationResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

const VALID_STATUSES: readonly ShipmentStatus[] = ['PREPARING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'ISSUE', 'RETURNED'];

type ShipmentFields = {
  readonly carrier: string | null;
  readonly trackingNumber: string | null;
  readonly status: ShipmentStatus;
  readonly shippedAt: Date | null;
  readonly estimatedDeliveryAt: Date | null;
  readonly deliveredAt: Date | null;
  readonly issueDescriptionPl: string | null;
  readonly issueResolutionPl: string | null;
  readonly internalNotesPl: string | null;
  readonly customerNotesPl: string | null;
};

function parseDateField(formData: FormData, name: string): Date | null {
  const raw = formData.get(name);
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function textOrNull(formData: FormData, name: string): string | null {
  const raw = formData.get(name);
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }
  return raw.trim();
}

function readShipmentFields(formData: FormData): ShipmentFields {
  return {
    carrier: textOrNull(formData, 'carrier'),
    trackingNumber: textOrNull(formData, 'trackingNumber'),
    status: String(formData.get('status') ?? 'PREPARING') as ShipmentStatus,
    shippedAt: parseDateField(formData, 'shippedAt'),
    estimatedDeliveryAt: parseDateField(formData, 'estimatedDeliveryAt'),
    deliveredAt: parseDateField(formData, 'deliveredAt'),
    issueDescriptionPl: textOrNull(formData, 'issueDescriptionPl'),
    issueResolutionPl: textOrNull(formData, 'issueResolutionPl'),
    internalNotesPl: textOrNull(formData, 'internalNotesPl'),
    customerNotesPl: textOrNull(formData, 'customerNotesPl'),
  };
}

function validateShipmentFields(fields: ShipmentFields): string | null {
  if (!VALID_STATUSES.includes(fields.status)) {
    return 'Nieprawidłowy status przesyłki.';
  }
  return null;
}

export async function applyUpsertShipment(staff: CurrentSession, orderId: string, formData: FormData): Promise<ShipmentMutationResult> {
  const fields = readShipmentFields(formData);
  const issue = validateShipmentFields(fields);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true } });
  if (order === null) {
    return { ok: false, detail: 'Zamówienie nie istnieje.' };
  }

  const existing = await prisma.shipment.findUnique({ where: { orderId } });
  await prisma.shipment.upsert({
    where: { orderId },
    create: { orderId, ...fields },
    update: fields,
  });
  await writeAuditLog({
    actor: staff,
    entity: 'Shipment',
    entityId: orderId,
    action: existing === null ? 'create' : 'update',
    diff: existing === null ? fields : { before: existing, after: fields },
  });

  return { ok: true };
}

export async function upsertShipment(orderNumber: string, orderId: string, formData: FormData): Promise<ShipmentMutationResult> {
  const staff = await requireAdminSession();
  const result = await applyUpsertShipment(staff, orderId, formData);
  if (result.ok) {
    revalidatePath(`/panel/zamowienia/${orderNumber}`);
    revalidatePath(`/moje-konto/zamowienia/${orderNumber}`);
    revalidatePath(`/zamowienie/${orderNumber}`);
  }
  return result;
}
