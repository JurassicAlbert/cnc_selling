import { afterEach, describe, expect, it } from 'vitest';

import {
  applyCreatePaymentMethodConfig,
  applySetPaymentMethodConfigActive,
  applyUpdatePaymentMethodConfig,
} from '@/server/actions/admin-payment-methods';
import { listPaymentMethodConfigsForAdmin } from '@/server/repositories/admin-payment-methods';
import { listActivePaymentMethods } from '@/server/repositories/payment-methods';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-payment-methods-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

function validInput(overrides: Partial<{ namePl: string; descPl: string; provider: 'BANK_TRANSFER' | 'CONTACT_ARRANGED' | 'PRZELEWY24'; sortOrder: number }> = {}) {
  return {
    namePl: `${PREFIX}metoda`,
    descPl: 'Opis testowej metody płatności.',
    provider: 'BANK_TRANSFER' as const,
    sortOrder: 0,
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'PaymentMethodConfig', actorEmail: { startsWith: PREFIX } } });
  await prisma.paymentMethodConfig.deleteMany({ where: { namePl: { startsWith: PREFIX } } });
});

describe('applyCreatePaymentMethodConfig', () => {
  it('creates a real row, always starting isConnected: false, and audits it', async () => {
    const staff = staffActor();

    const result = await applyCreatePaymentMethodConfig(staff, validInput());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const created = await prisma.paymentMethodConfig.findUniqueOrThrow({ where: { id: result.id } });
    expect(created.isConnected).toBe(false);
    expect(created.isActive).toBe(true);
    expect(await prisma.auditLog.count({ where: { entity: 'PaymentMethodConfig', action: 'create', actorEmail: staff.email } })).toBe(1);
  });

  it('never appears in the real public checkout listing while isConnected is false — a new row is never accidentally live', async () => {
    const result = await applyCreatePaymentMethodConfig(staffActor(), validInput({ namePl: `${PREFIX}nowa` }));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    expect((await listActivePaymentMethods()).some((m) => m.id === result.id)).toBe(false);
  });

  it('rejects a missing name', async () => {
    const result = await applyCreatePaymentMethodConfig(staffActor(), validInput({ namePl: '  ' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a missing description', async () => {
    const result = await applyCreatePaymentMethodConfig(staffActor(), validInput({ descPl: '  ' }));
    expect(result.ok).toBe(false);
  });
});

describe('applyUpdatePaymentMethodConfig', () => {
  it('updates fields but leaves isConnected untouched — the form has no way to set it', async () => {
    const staff = staffActor();
    const created = await applyCreatePaymentMethodConfig(staff, validInput());
    if (!created.ok) throw new Error('setup failed');

    const updated = await applyUpdatePaymentMethodConfig(staff, created.id, validInput({ namePl: `${PREFIX}zmieniona` }));
    expect(updated.ok).toBe(true);

    const row = await prisma.paymentMethodConfig.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.namePl).toBe(`${PREFIX}zmieniona`);
    expect(row.isConnected).toBe(false);
  });

  it('returns a failure result for a non-existent method', async () => {
    const result = await applyUpdatePaymentMethodConfig(staffActor(), 'does-not-exist', validInput());
    expect(result.ok).toBe(false);
  });
});

describe('applySetPaymentMethodConfigActive', () => {
  it('deactivating an already-unconnected row keeps it out of the public listing (it never was in it)', async () => {
    const staff = staffActor();
    const created = await applyCreatePaymentMethodConfig(staff, validInput());
    if (!created.ok) throw new Error('setup failed');

    await applySetPaymentMethodConfigActive(staff, created.id, false);

    expect((await listActivePaymentMethods()).some((m) => m.id === created.id)).toBe(false);
    expect((await listPaymentMethodConfigsForAdmin()).some((m) => m.id === created.id)).toBe(true);
    expect(await prisma.paymentMethodConfig.findUnique({ where: { id: created.id } })).not.toBeNull();
  });

  it('deactivating a real connected method removes it from the public checkout listing', async () => {
    const staff = staffActor();
    const created = await applyCreatePaymentMethodConfig(staff, validInput());
    if (!created.ok) throw new Error('setup failed');
    // Simulate a real integration going live — only ever done by real code, never this form.
    await prisma.paymentMethodConfig.update({ where: { id: created.id }, data: { isConnected: true } });

    expect((await listActivePaymentMethods()).some((m) => m.id === created.id)).toBe(true);

    await applySetPaymentMethodConfigActive(staff, created.id, false);

    expect((await listActivePaymentMethods()).some((m) => m.id === created.id)).toBe(false);
  });
});
