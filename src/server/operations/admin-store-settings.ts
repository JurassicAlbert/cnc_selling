/**
 * Store settings mutation — same `applyXxx`/`xxx` split as every other
 * staff mutation. Bank fields are trimmed to `null` when left blank (so
 * clearing a field genuinely un-configures it, not stores an empty
 * string), matching `StoreSettings`'s own nullable-means-not-configured
 * contract.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';

export type UpdateStoreSettingsInput = {
  readonly bankAccountNumber: string;
  readonly bankAccountHolderPl: string;
  readonly shippingFlatRateGrosze: number;
};

export type UpdateStoreSettingsResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function applyUpdateStoreSettings(
  staff: CurrentSession,
  input: UpdateStoreSettingsInput,
): Promise<UpdateStoreSettingsResult> {
  if (!Number.isInteger(input.shippingFlatRateGrosze) || input.shippingFlatRateGrosze < 0) {
    return { ok: false, detail: 'Stawka wysyłki musi być liczbą całkowitą, nie mniejszą niż 0.' };
  }

  const before = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
  const after = await prisma.storeSettings.update({
    where: { id: 1 },
    data: {
      bankAccountNumber: blankToNull(input.bankAccountNumber),
      bankAccountHolderPl: blankToNull(input.bankAccountHolderPl),
      shippingFlatRateGrosze: input.shippingFlatRateGrosze,
      updatedByEmail: staff.email,
    },
  });
  await writeAuditLog({
    actor: staff,
    entity: 'StoreSettings',
    entityId: '1',
    action: 'update',
    diff: {
      before: { bankAccountNumber: before.bankAccountNumber, shippingFlatRateGrosze: before.shippingFlatRateGrosze },
      after: { bankAccountNumber: after.bankAccountNumber, shippingFlatRateGrosze: after.shippingFlatRateGrosze },
    },
  });

  return { ok: true };
}

export async function updateStoreSettings(input: UpdateStoreSettingsInput): Promise<UpdateStoreSettingsResult> {
  const staff = await requireStaffSession();
  const result = await applyUpdateStoreSettings(staff, input);
  if (result.ok) {
    revalidatePath('/panel/ustawienia');
    revalidatePath('/koszyk/zamowienie');
  }
  return result;
}
