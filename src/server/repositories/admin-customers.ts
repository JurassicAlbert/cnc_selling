/**
 * Admin customer queries - scoped to `role: 'CUSTOMER'` throughout. Staff
 * and admin accounts are out of reach of this tool on purpose: they're
 * "Settings: staff users" (`docs/CHECKLIST.md`), a still-unbuilt slice, and
 * this module's own anonymize action would be actively dangerous if it
 * could ever be pointed at a staff account by mistake.
 *
 * Order history and saved configurations are NOT rebuilt here - reused
 * directly from the customer-facing repositories that already return
 * exactly this shape: `listOrdersForUser` (`repositories/orders.ts`) and
 * `listConfigurationsForUser` (`repositories/cart.ts`).
 */

import { prisma } from '@/server/db/client';
import type { UploadKind } from '@/generated/prisma/enums';
import { listOrdersForUser } from '@/server/repositories/orders';
import type { OrderSummaryView } from '@/server/repositories/orders';
import { listConfigurationsForUser } from '@/server/repositories/cart';
import type { SavedConfigurationView } from '@/server/repositories/cart';

export type AdminCustomerListItem = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;
  readonly orderCount: number;
  readonly anonymizedAt: Date | null;
};

const ADMIN_CUSTOMER_LIST_LIMIT = 100;

export async function listCustomersForAdmin(search?: string): Promise<readonly AdminCustomerListItem[]> {
  const customers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      ...(search !== undefined && search.length > 0
        ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_LIST_LIMIT,
    select: { id: true, name: true, email: true, createdAt: true, anonymizedAt: true, _count: { select: { orders: true } } },
  });
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    createdAt: customer.createdAt,
    orderCount: customer._count.orders,
    anonymizedAt: customer.anonymizedAt,
  }));
}

export type AdminCustomerDetail = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly createdAt: Date;
  readonly anonymizedAt: Date | null;
};

export async function findCustomerForAdmin(userId: string): Promise<AdminCustomerDetail | null> {
  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, email: true, phone: true, createdAt: true, anonymizedAt: true },
  });
  if (customer === null || customer.role !== 'CUSTOMER') {
    return null;
  }
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    createdAt: customer.createdAt,
    anonymizedAt: customer.anonymizedAt,
  };
}

export type UploadedFileSummary = {
  readonly id: string;
  readonly kind: UploadKind;
  readonly originalName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
};

/**
 * Metadata only - no `storageKey`, no preview link. There is no admin
 * route that authorizes viewing an arbitrary customer's raw file outside
 * the design-review queue's own owned-file check, and building one is out
 * of scope here.
 */
export async function listUploadedFilesForCustomer(userId: string): Promise<readonly UploadedFileSummary[]> {
  const files = await prisma.uploadedFile.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, kind: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  return files;
}

export type CustomerExport = {
  readonly profile: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly phone: string | null;
    readonly createdAt: Date;
  };
  readonly orders: readonly OrderSummaryView[];
  readonly configurations: readonly SavedConfigurationView[];
  readonly files: readonly UploadedFileSummary[];
};

/** RODO Art. 15 access-request export - real data only, assembled from the same reads the admin detail page renders. */
export async function buildCustomerExport(userId: string): Promise<CustomerExport | null> {
  const customer = await findCustomerForAdmin(userId);
  if (customer === null) {
    return null;
  }
  const [orders, configurations, files] = await Promise.all([
    listOrdersForUser(userId),
    listConfigurationsForUser(userId),
    listUploadedFilesForCustomer(userId),
  ]);
  return {
    profile: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, createdAt: customer.createdAt },
    orders,
    configurations,
    files,
  };
}
