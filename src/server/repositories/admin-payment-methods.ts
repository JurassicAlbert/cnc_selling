/** Admin `PaymentMethodConfig` queries - unscoped, unlike the real public `isConnected`-gated read. Every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';
import type { PaymentMethod } from '@/generated/prisma/enums';

export type AdminPaymentMethodListItem = {
  readonly id: string;
  readonly namePl: string;
  readonly provider: PaymentMethod;
  readonly isConnected: boolean;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export async function listPaymentMethodConfigsForAdmin(): Promise<readonly AdminPaymentMethodListItem[]> {
  return prisma.paymentMethodConfig.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, namePl: true, provider: true, isConnected: true, isActive: true, sortOrder: true },
  });
}

export type AdminPaymentMethodDetail = {
  readonly id: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly provider: PaymentMethod;
  readonly isConnected: boolean;
  readonly isActive: boolean;
  readonly sortOrder: number;
};

export async function findPaymentMethodConfigForAdmin(id: string): Promise<AdminPaymentMethodDetail | null> {
  return prisma.paymentMethodConfig.findUnique({
    where: { id },
    select: { id: true, namePl: true, descPl: true, provider: true, isConnected: true, isActive: true, sortOrder: true },
  });
}
