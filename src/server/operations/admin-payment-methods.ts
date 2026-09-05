/**
 * Staff `PaymentMethodConfig` mutations. Same `applyXxx(staff, ...)` /
 * `xxx(...)` split as every other admin action file. Deliberately does
 * NOT expose `isConnected` as an editable field anywhere in this file -
 * see the model's own schema comment: whether a provider is really wired
 * up is a code fact, not admin-togglable data, or an admin could silently
 * "enable" a payment method with no real integration behind it (§15's "no
 * fake payment" rule). No delete - real FK target of `Order`; `isActive`
 * toggle only, same as every other panel entity.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import type { PaymentMethod } from '@/generated/prisma/enums';

export type PaymentMethodConfigFormInput = {
  readonly namePl: string;
  readonly descPl: string;
  readonly provider: PaymentMethod;
  readonly sortOrder: number;
};

export type PaymentMethodConfigMutationResult = { readonly ok: true; readonly id: string } | { readonly ok: false; readonly detail: string };

const VALID_PROVIDERS: readonly PaymentMethod[] = ['BANK_TRANSFER', 'CONTACT_ARRANGED', 'PRZELEWY24', 'CARD', 'PAYPAL'];

function validateInput(input: PaymentMethodConfigFormInput): string | null {
  if (input.namePl.trim().length === 0) {
    return 'Nazwa jest wymagana.';
  }
  if (input.descPl.trim().length === 0) {
    return 'Opis jest wymagany.';
  }
  if (!VALID_PROVIDERS.includes(input.provider)) {
    return 'Nieprawidłowy dostawca płatności.';
  }
  return null;
}

export async function applyCreatePaymentMethodConfig(staff: CurrentSession, input: PaymentMethodConfigFormInput): Promise<PaymentMethodConfigMutationResult> {
  const issue = validateInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  // isConnected always starts false - a real integration is a code change
  // (a real PaymentProvider implementation), never a value this form sets.
  const config = await prisma.paymentMethodConfig.create({ data: { ...input, isConnected: false } });
  await writeAuditLog({ actor: staff, entity: 'PaymentMethodConfig', entityId: config.id, action: 'create', diff: input });
  return { ok: true, id: config.id };
}

export async function createPaymentMethodConfig(input: PaymentMethodConfigFormInput): Promise<PaymentMethodConfigMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyCreatePaymentMethodConfig(staff, input);
  if (result.ok) {
    revalidatePath('/panel/platnosci');
    revalidatePath('/koszyk/zamowienie');
  }
  return result;
}

export async function applyUpdatePaymentMethodConfig(
  staff: CurrentSession,
  id: string,
  input: PaymentMethodConfigFormInput,
): Promise<PaymentMethodConfigMutationResult> {
  const issue = validateInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }
  const current = await prisma.paymentMethodConfig.findUnique({ where: { id } });
  if (current === null) {
    return { ok: false, detail: 'Metoda płatności nie istnieje.' };
  }
  await prisma.paymentMethodConfig.update({ where: { id }, data: input });
  await writeAuditLog({ actor: staff, entity: 'PaymentMethodConfig', entityId: id, action: 'update', diff: { before: current, after: input } });
  return { ok: true, id };
}

export async function updatePaymentMethodConfig(id: string, input: PaymentMethodConfigFormInput): Promise<PaymentMethodConfigMutationResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdatePaymentMethodConfig(staff, id, input);
  if (result.ok) {
    revalidatePath('/panel/platnosci');
    revalidatePath(`/panel/platnosci/${id}`);
    revalidatePath('/koszyk/zamowienie');
  }
  return result;
}

export async function applySetPaymentMethodConfigActive(staff: CurrentSession, id: string, isActive: boolean): Promise<void> {
  const current = await prisma.paymentMethodConfig.findUnique({ where: { id }, select: { isActive: true } });
  if (current === null) {
    return;
  }
  await prisma.paymentMethodConfig.update({ where: { id }, data: { isActive } });
  await writeAuditLog({
    actor: staff,
    entity: 'PaymentMethodConfig',
    entityId: id,
    action: 'update',
    diff: { isActive: { from: current.isActive, to: isActive } },
  });
}

export async function setPaymentMethodConfigActive(id: string, isActive: boolean): Promise<void> {
  const staff = await requireStaffSession();
  await applySetPaymentMethodConfigActive(staff, id, isActive);
  revalidatePath('/panel/platnosci');
  revalidatePath(`/panel/platnosci/${id}`);
  revalidatePath('/koszyk/zamowienie');
}
