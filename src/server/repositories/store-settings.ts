/**
 * The one real read over `StoreSettings`'s singleton row - used by the
 * checkout page, `create-order.ts`, `OrderSummary`'s bank-details display,
 * and the admin settings form. `seedStoreSettings()` (`prisma/seed.ts`)
 * guarantees the row exists, so `findUniqueOrThrow` is safe here - a
 * missing row would mean the seed never ran, a real setup bug worth
 * surfacing loudly rather than silently defaulting.
 */

import { prisma } from '@/server/db/client';

export type StoreSettingsView = {
  readonly bankAccountNumber: string | null;
  readonly bankAccountHolderPl: string | null;
  readonly shippingFlatRateGrosze: number;
  /**
   * The shop's own social profiles, for the strip above the navigation.
   * `null` for any the owner has not configured - the strip renders nothing
   * for those, rather than an icon linking to a profile nobody has claimed.
   */
  readonly facebookUrl: string | null;
  readonly instagramUrl: string | null;
  readonly tiktokUrl: string | null;
  readonly youtubeUrl: string | null;
};

export async function getStoreSettings(): Promise<StoreSettingsView> {
  const settings = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
  return {
    bankAccountNumber: settings.bankAccountNumber,
    bankAccountHolderPl: settings.bankAccountHolderPl,
    shippingFlatRateGrosze: settings.shippingFlatRateGrosze,
    facebookUrl: settings.facebookUrl,
    instagramUrl: settings.instagramUrl,
    tiktokUrl: settings.tiktokUrl,
    youtubeUrl: settings.youtubeUrl,
  };
}
