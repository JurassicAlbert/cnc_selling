import { afterEach, describe, expect, it } from 'vitest';

import { applyUpdateStoreSettings } from '@/server/actions/admin-store-settings';
import { getStoreSettings } from '@/server/repositories/store-settings';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-store-settings-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

function staffActor(): CurrentSession {
  return { userId: uid(), role: 'STAFF', name: 'Test Staff', email: `${uid()}@example.test` };
}

// StoreSettings is a real singleton shared with the rest of the app (and
// every other test in this run) — snapshot it before mutating and restore
// it afterward, rather than deleting a row the whole app expects to exist.
let snapshot: Awaited<ReturnType<typeof prisma.storeSettings.findUniqueOrThrow>> | null = null;

afterEach(async () => {
  if (snapshot !== null) {
    await prisma.storeSettings.update({
      where: { id: 1 },
      data: {
        bankAccountNumber: snapshot.bankAccountNumber,
        bankAccountHolderPl: snapshot.bankAccountHolderPl,
        shippingFlatRateGrosze: snapshot.shippingFlatRateGrosze,
        updatedByEmail: snapshot.updatedByEmail,
      },
    });
    snapshot = null;
  }
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

describe('getStoreSettings', () => {
  it('returns the real singleton row', async () => {
    const settings = await getStoreSettings();
    expect(typeof settings.shippingFlatRateGrosze).toBe('number');
  });
});

describe('applyUpdateStoreSettings', () => {
  it('rejects a negative shipping rate', async () => {
    const result = await applyUpdateStoreSettings(staffActor(), {
      bankAccountNumber: '',
      bankAccountHolderPl: '',
      shippingFlatRateGrosze: -1,
    });
    expect(result.ok).toBe(false);
  });

  it('persists real values, treats a blank string as un-configuring a field, and audits the change', async () => {
    snapshot = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
    const staff = staffActor();

    const result = await applyUpdateStoreSettings(staff, {
      bankAccountNumber: 'PL61 1090 1014 0000 0712 1981 2874',
      bankAccountHolderPl: 'RYT Sp. z o.o.',
      shippingFlatRateGrosze: 2_500,
    });
    expect(result.ok).toBe(true);

    const after = await getStoreSettings();
    expect(after.bankAccountNumber).toBe('PL61 1090 1014 0000 0712 1981 2874');
    expect(after.bankAccountHolderPl).toBe('RYT Sp. z o.o.');
    expect(after.shippingFlatRateGrosze).toBe(2_500);

    await applyUpdateStoreSettings(staff, { bankAccountNumber: '   ', bankAccountHolderPl: '', shippingFlatRateGrosze: 2_000 });
    const cleared = await getStoreSettings();
    expect(cleared.bankAccountNumber).toBeNull();
    expect(cleared.bankAccountHolderPl).toBeNull();

    expect(await prisma.auditLog.count({ where: { entity: 'StoreSettings', actorEmail: staff.email } })).toBe(2);
  });
});
