import { prisma } from '@/server/db/client';
import type { PaymentMethod } from '@/generated/prisma/enums';

/**
 * Public `PaymentMethodConfig` reads - P9 phase 6. `isConnected: true` is
 * the honest gate: a row can be real, active, and admin-visible while
 * still never appearing here, because "real DB row" and "actually wired
 * to a working payment flow" are deliberately different facts (§15's "no
 * fake payment" rule). Only bank transfer / contact-arranged are
 * connected today - a Przelewy24 row can exist and be seen by staff
 * without ever being selectable at checkout.
 */

export type ActivePaymentMethod = {
  readonly id: string;
  readonly namePl: string;
  readonly descPl: string;
  readonly provider: PaymentMethod;
};

export async function listActivePaymentMethods(): Promise<readonly ActivePaymentMethod[]> {
  return prisma.paymentMethodConfig.findMany({
    where: { isActive: true, isConnected: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, namePl: true, descPl: true, provider: true },
  });
}
