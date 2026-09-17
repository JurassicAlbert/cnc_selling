/**
 * Admin pricing queries - read-only. Every caller here MUST go through
 * `requireAdminSession()` first (highest-risk screen in the app,
 * `docs/ARCHITECTURE.md` §16A.1 module 7 - ADMIN only, not STAFF).
 *
 * `PricingSettings.version` is the real `@id` - there is no separate
 * surrogate key, and rows are never edited in place (see
 * `src/server/actions/admin-pricing.ts`'s header for the versioning
 * design). "Active" means `isActive: true`; exactly one row should hold
 * that at a time, enforced by `applyPublishPricingVersion`'s own
 * transaction, not a DB constraint.
 */

import { prisma } from '@/server/db/client';

export type AdminPricingVersion = {
  readonly version: number;
  readonly machineRateCncGrosze: number;
  readonly machineRateLaserGrosze: number;
  readonly moduleSurchargeGrosze: number;
  readonly vatRateBp: number;
  readonly packagingTiers: unknown;
  readonly isActive: boolean;
  readonly publishedAt: Date | null;
  readonly publishedByEmail: string | null;
  /** BUG-34: null until an admin has actually run the simulator against this version. */
  readonly simulatedAt: Date | null;
  readonly simulatedByEmail: string | null;
  readonly notePl: string | null;
  readonly createdAt: Date;
};

const SELECT = {
  version: true,
  machineRateCncGrosze: true,
  machineRateLaserGrosze: true,
  moduleSurchargeGrosze: true,
  vatRateBp: true,
  packagingTiers: true,
  isActive: true,
  publishedAt: true,
  publishedByEmail: true,
  simulatedAt: true,
  simulatedByEmail: true,
  notePl: true,
  createdAt: true,
} as const;

export async function listPricingVersions(): Promise<readonly AdminPricingVersion[]> {
  return prisma.pricingSettings.findMany({ orderBy: { version: 'desc' }, select: SELECT });
}

export async function getActivePricingVersion(): Promise<AdminPricingVersion | null> {
  return prisma.pricingSettings.findFirst({ where: { isActive: true }, select: SELECT });
}

export async function getPricingVersionByNumber(version: number): Promise<AdminPricingVersion | null> {
  return prisma.pricingSettings.findUnique({ where: { version }, select: SELECT });
}

export type PricingReferenceProduct = {
  readonly slug: string;
  readonly namePl: string;
  readonly typeCode: string;
};

/**
 * The products the pre-publish simulator prices, taken from the live
 * catalogue instead of a hard-coded list.
 *
 * **It was a hard-coded list, and it rotted twice in three weeks without a
 * sound.** `REFERENCE_PRODUCT_SLUGS` named the wall art, the loft stool and
 * the floor panel; `panele-podlogowe` was deactivated on 2026-08-28 and
 * `loft` on 2026-09-04, both at the owner's request and both entirely
 * reasonable. `getConfiguratorProductData` cascades on `category.isActive`,
 * so two of the three rows quietly became „nie można wycenić" with the raw
 * slug where a name should have been. The screen that exists to prevent a
 * mispricing was reviewing one product out of three.
 *
 * **One per `typeCode`**, because that was the real intent behind the
 * original three: different product types take different pricing paths
 * (machining rate, thickness factor, module surcharge), and a sample that is
 * three of the same type tells an admin nothing a single row would not.
 * Ordered by type then slug so the table is the same on every visit - an
 * admin comparing before and after is comparing rows, and rows that reorder
 * between two visits are worse than useless.
 *
 * `isActive` on both the product and its category, matching the cascade
 * `getConfiguratorProductData` applies, so nothing here can be unpriceable
 * for a reason this query could have seen.
 */
export async function listPricingReferenceProducts(limit: number): Promise<readonly PricingReferenceProduct[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, category: { isActive: true } },
    orderBy: [{ typeCode: 'asc' }, { slug: 'asc' }],
    select: { slug: true, namePl: true, typeCode: true },
  });

  const seenTypes = new Set<string>();
  const picked: PricingReferenceProduct[] = [];
  for (const product of products) {
    if (seenTypes.has(product.typeCode)) {
      continue;
    }
    seenTypes.add(product.typeCode);
    picked.push(product);
    if (picked.length === limit) {
      break;
    }
  }
  return picked;
}
