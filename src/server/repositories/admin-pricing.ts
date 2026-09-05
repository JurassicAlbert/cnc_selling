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
