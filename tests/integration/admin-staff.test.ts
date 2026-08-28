import { afterEach, describe, expect, it } from 'vitest';

import { applyChangeStaffRole, applyInviteStaffUser } from '@/server/actions/admin-staff';
import { listStaffUsers } from '@/server/repositories/admin-staff';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-staff-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function adminActor(userId: string): CurrentSession {
  return { userId, role: 'ADMIN', name: 'Test Admin', email: `${PREFIX}admin-${crypto.randomUUID()}@example.test` };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('applyInviteStaffUser', () => {
  it('creates a real User row with the given role, no password needed', async () => {
    const admin = adminActor(uid());
    const email = `${uid()}@example.test`;

    const result = await applyInviteStaffUser(admin, { name: 'Nowy Pracownik', email, role: 'STAFF' });
    expect(result.ok).toBe(true);

    const created = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(created.role).toBe('STAFF');
    expect(created.emailVerified).toBe(true);
    expect(await prisma.account.count({ where: { userId: created.id } })).toBe(0);

    expect(await prisma.auditLog.count({ where: { entity: 'User', entityId: created.id, action: 'create' } })).toBe(1);
  });

  it('rejects an implausible email — a garbage invite must never create a permanently unreachable staff account', async () => {
    const admin = adminActor(uid());

    const result = await applyInviteStaffUser(admin, { name: 'Zły e-mail', email: 'nie-jest-adresem-email', role: 'STAFF' });
    expect(result.ok).toBe(false);
    expect(await prisma.user.count({ where: { name: 'Zły e-mail' } })).toBe(0);
  });

  it('rejects a duplicate email', async () => {
    const admin = adminActor(uid());
    const email = `${uid()}@example.test`;
    await applyInviteStaffUser(admin, { name: 'A', email, role: 'STAFF' });

    const second = await applyInviteStaffUser(admin, { name: 'B', email, role: 'ADMIN' });
    expect(second.ok).toBe(false);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });
});

describe('applyChangeStaffRole', () => {
  it('rejects changing your own role', async () => {
    const admin = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Self', role: 'ADMIN' } });
    const result = await applyChangeStaffRole(adminActor(admin.id), admin.id, 'CUSTOMER');
    expect(result.ok).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe('ADMIN');
  });

  it('rejects a target that is not currently STAFF/ADMIN', async () => {
    const customer = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Cust', role: 'CUSTOMER' } });
    const result = await applyChangeStaffRole(adminActor(uid()), customer.id, 'STAFF');
    expect(result.ok).toBe(false);
  });

  it('revokes access (STAFF -> CUSTOMER) and audits it', async () => {
    const staff = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'Staffer', role: 'STAFF' } });
    const admin = adminActor(uid());

    const result = await applyChangeStaffRole(admin, staff.id, 'CUSTOMER');
    expect(result.ok).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).role).toBe('CUSTOMER');
    expect(await prisma.auditLog.count({ where: { entity: 'User', entityId: staff.id, action: 'update' } })).toBe(1);
  });
});

describe('listStaffUsers', () => {
  it('returns STAFF and ADMIN rows, never CUSTOMER', async () => {
    const staff = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'S', role: 'STAFF' } });
    const admin = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'A', role: 'ADMIN' } });
    const customer = await prisma.user.create({ data: { email: `${uid()}@example.test`, name: 'C', role: 'CUSTOMER' } });

    const list = await listStaffUsers();
    const ids = list.map((u) => u.id);
    expect(ids).toContain(staff.id);
    expect(ids).toContain(admin.id);
    expect(ids).not.toContain(customer.id);
  });
});
