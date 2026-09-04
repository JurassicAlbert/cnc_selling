/**
 * Store settings mutation - same `applyXxx`/`xxx` split as every other
 * staff mutation. Bank fields are trimmed to `null` when left blank (so
 * clearing a field genuinely un-configures it, not stores an empty
 * string), matching `StoreSettings`'s own nullable-means-not-configured
 * contract.
 *
 * **`ADMIN`, not `STAFF`** - changed 2026-08-31, `docs/REVIEW-DETAILED.md`
 * SEC-04. `bankAccountNumber` is the account number every bank-transfer
 * customer is told to pay into, on the confirmation page and in the
 * confirmation email; a `STAFF` account able to write it can redirect all
 * incoming payments. ARCHITECTURE.md §16.3 already assigned settings to
 * `ADMIN` - the code simply did not honour it.
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
  /** Blank means "no profile", which is the honest default for all four. */
  readonly facebookUrl: string;
  readonly instagramUrl: string;
  readonly tiktokUrl: string;
  readonly youtubeUrl: string;
};

const SOCIAL_FIELDS = ['facebookUrl', 'instagramUrl', 'tiktokUrl', 'youtubeUrl'] as const;

export type UpdateStoreSettingsResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * A social profile link ends up as an `href` on every page of the
 * storefront, which makes this field the widest-rendered piece of
 * admin-editable content in the shop. `javascript:` there is stored XSS
 * everywhere at once; `data:` is the same thing wearing a different scheme;
 * and a bare `facebook.com/rytpl` would resolve as a path on our own domain
 * and 404, which looks like a broken shop rather than a typo.
 *
 * So: absolute, and https. Not http - these are all https-only platforms,
 * and accepting a downgrade would put a mixed-content warning on every page.
 * Blank stays blank, because "no profile" is a legitimate answer for all
 * four and must not read as an error.
 */
function isUsableProfileUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return true;
  }
  try {
    return new URL(trimmed).protocol === 'https:';
  } catch {
    return false;
  }
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

  if (SOCIAL_FIELDS.some((field) => !isUsableProfileUrl(input[field]))) {
    return {
      ok: false,
      detail: 'Adres profilu musi być pełnym adresem zaczynającym się od https:// albo pozostać pusty.',
    };
  }

  const before = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
  const after = await prisma.storeSettings.update({
    where: { id: 1 },
    data: {
      bankAccountNumber: blankToNull(input.bankAccountNumber),
      bankAccountHolderPl: blankToNull(input.bankAccountHolderPl),
      shippingFlatRateGrosze: input.shippingFlatRateGrosze,
      facebookUrl: blankToNull(input.facebookUrl),
      instagramUrl: blankToNull(input.instagramUrl),
      tiktokUrl: blankToNull(input.tiktokUrl),
      youtubeUrl: blankToNull(input.youtubeUrl),
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
    // The social strip is part of the storefront chrome, so a change to it
    // has to reach every page, not just the two above.
    revalidatePath('/', 'layout');
  }
  return result;
}
