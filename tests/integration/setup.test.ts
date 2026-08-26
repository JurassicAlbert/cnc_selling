import { describe, expect, it } from 'vitest';

import { testPrisma, withTestTransaction } from './setup';

/**
 * Guards the integration-test infrastructure itself: if
 * `withTestTransaction` stopped actually rolling back, every other
 * integration test's isolation guarantee would silently break — this is
 * the one test in this tier that verifies the tier's own foundation.
 */
describe('withTestTransaction', () => {
  it('returns the callback\'s own result', async () => {
    const result = await withTestTransaction(async () => 42);
    expect(result).toBe(42);
  });

  it('really rolls back — a row written inside it does not persist after', async () => {
    const email = `rollback-check-${Date.now()}@example.test`;

    await withTestTransaction(async (tx) => {
      const admin = await tx.user.create({ data: { email, role: 'ADMIN' } });
      expect(admin.email).toBe(email);
    });

    const afterRollback = await testPrisma.user.findUnique({ where: { email } });
    expect(afterRollback).toBeNull();
  });
});
