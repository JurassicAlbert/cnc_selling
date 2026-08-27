import { afterEach, describe, expect, it, vi } from 'vitest';

import { mailer } from '@/server/mail/mailer';
import { prisma } from '@/server/db/client';

// `mailer` resolves to `UnconfiguredMailer` in the test environment
// (RESEND_API_KEY/EMAIL_FROM unset) — `send()` logs the resolved subject
// instead of actually delivering, which is exactly what these tests
// inspect via a console.log spy.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mailer — EmailTemplate DB override', () => {
  it('uses the DB-stored template text when a row exists for the key, interpolating real placeholder values', async () => {
    const original = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: 'order-confirmation' } });
    await prisma.emailTemplate.update({
      where: { key: 'order-confirmation' },
      data: { subjectPl: 'TEST-OVERRIDE {{orderNumber}} / {{totalGrossZloty}}' },
    });

    try {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await mailer.send('order-confirmation', 'customer@example.test', {
        orderNumber: '2026/08/9999',
        totalGrossGrosze: 12_345,
        paymentMethod: 'BANK_TRANSFER',
      });
      const logged = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).toContain('TEST-OVERRIDE 2026/08/9999');
      expect(logged).toContain('123,45');
    } finally {
      await prisma.emailTemplate.update({ where: { key: 'order-confirmation' }, data: { subjectPl: original.subjectPl } });
    }
  });

  it('falls back to the hardcoded default when no EmailTemplate row exists for the key', async () => {
    const original = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: 'order-confirmation' } });
    await prisma.emailTemplate.delete({ where: { key: 'order-confirmation' } });

    try {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      await mailer.send('order-confirmation', 'customer@example.test', {
        orderNumber: '2026/08/9998',
        totalGrossGrosze: 5_000,
        paymentMethod: 'BANK_TRANSFER',
      });
      const logged = logSpy.mock.calls.map((call) => String(call[0])).join('\n');
      expect(logged).toContain('Potwierdzenie zamówienia 2026/08/9998');
    } finally {
      await prisma.emailTemplate.create({
        data: { key: original.key, subjectPl: original.subjectPl, bodyPl: original.bodyPl },
      });
    }
  });
});
