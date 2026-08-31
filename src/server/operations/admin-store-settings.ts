/**
 * Store settings mutation — same `applyXxx`/`xxx` split as every other
 * staff mutation. Bank fields are trimmed to `null` when left blank (so
 * clearing a field genuinely un-configures it, not stores an empty
 * string), matching `StoreSettings`'s own nullable-means-not-configured
 * contract.
 *
 * **`ADMIN`, not `STAFF`** — changed 2026-08-31, `docs/REVIEW-DETAILED.md`
 * SEC-04. `bankAccountNumber` is the account number every bank-transfer
 * customer is told to pay into, on the confirmation page and in the
 * confirmation email; a `STAFF` account able to write it can redirect all
 * incoming payments. ARCHITECTURE.md §16.3 already assigned settings to
 * `ADMIN` — the code simply did not honour it.
 *
 * The gate is asserted twice on purpose: `requireAdminSession()` in the
 * wrapper is what a real request meets, and `refuseUnlessAdmin` in the
 * `apply` is the same rule somewhere a test can actually reach it (see
 * `admin-only.ts`).
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { refuseUnlessAdmin } from './admin-only';

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
  admin: CurrentSession,
  input: UpdateStoreSettingsInput,
): Promise<UpdateStoreSettingsResult> {
  const refusal = refuseUnlessAdmin(admin);
  if (refusal !== null) {
    return refusal;
  }

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
      updatedByEmail: admin.email,
    },
  });
  await writeAuditLog({
    actor: admin,
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
  const admin = await requireAdminSession();
  const result = await applyUpdateStoreSettings(admin, input);
  if (result.ok) {
    revalidatePath('/panel/ustawienia');
    revalidatePath('/koszyk/zamowienie');
  }
  return result;
}
