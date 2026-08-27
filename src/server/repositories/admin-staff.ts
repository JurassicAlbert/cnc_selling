/**
 * Staff/admin account queries. Scoped to `role IN ('STAFF', 'ADMIN')` — the
 * inverse of `admin-customers.ts`'s `role: 'CUSTOMER'` scoping — so a
 * `CUSTOMER` row is never returned here, matching the `invite`/`role
 * change` actions' own restriction to genuine staff accounts.
 */

import { prisma } from '@/server/db/client';
import type { UserRole } from '@/generated/prisma/enums';

export type StaffListItem = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: UserRole;
  readonly createdAt: Date;
};

export async function listStaffUsers(): Promise<readonly StaffListItem[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'ADMIN'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return users;
}
