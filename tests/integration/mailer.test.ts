import { afterEach, describe, expect, it, vi } from 'vitest';

import { mailer } from '@/server/mail/mailer';
import { prisma } from '@/server/db/client';

/**
 * `mailer` resolves to `UnconfiguredMailer` here (RESEND_API_KEY/EMAIL_FROM
 * unset), so nothing is delivered.
 *
 * **These tests used to read the console.** `UnconfiguredMailer` logged the
 * fully resolved subject, and every assertion below inspected a
 * `console.log` spy for it. That was a convenient observation channel and
 * also the vulnerability: the OTP subject line contained the code, so every
 * login code landed in the application log in plaintext, with no production
 * guard (`docs/REVIEW-DETAILED.md` SEC-02).
 *
 * `send()` now returns the resolved subject instead, so the same
 * template-rendering assertions are made against the real API rather than a
 * side effect - and the log assertions below are inverted: they check that
 * the secret is *absent*.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function capturedLog(): { readonly lines: () => string } {
  const spies = [
    vi.spyOn(console, 'log').mockImplementation(() => undefined),
    vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
  ];
  return {
    lines: () => spies.flatMap((spy) => spy.mock.calls.map((call) => String(call[0]))).join('\n'),
  };
}

describe('mailer - never logs a credential (SEC-02)', () => {
  it('does not put the one-time code in the log, at any level', async () => {
    const log = capturedLog();

    await mailer.send('verification-otp', 'customer@example.test', {
      otp: '123456',
      purpose: 'sign-in',
    });

    expect(log.lines()).not.toContain('123456');
  });

  it('does not put the one-time code in the subject line either', async () => {
    const result = await mailer.send('verification-otp', 'customer@example.test', {
      otp: '654321',
      purpose: 'sign-in',
    });

    expect(result.subject).not.toContain('654321');
  });

  /**
   * A subject is what a phone shows on a lock screen before anyone
   * unlocks it. Keeping the code out of it is worth having even once the
   * logging is fixed.
   */
  it('still says what the message is about', async () => {
    const result = await mailer.send('verification-otp', 'customer@example.test', {
      otp: '111222',
      purpose: 'sign-in',
    });

    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.subject).toContain('logowania');
  });

  it('does not log the recipient address in cleartext', async () => {
    const log = capturedLog();

    await mailer.send('order-status-update', 'ala.kowalska@example.test', {
      orderNumber: '2026/08/9995',
      statusPl: 'Wysłane',
    });

    expect(log.lines()).not.toContain('ala.kowalska@example.test');
  });

  /**
   * An admin can put `{{otp}}` anywhere they like in a DB-stored template
   * - the seeded row did exactly that. The guarantee has to hold whatever
   * the template says, which is why it is enforced by never logging the
   * rendered text rather than by trusting the default copy.
   */
  it('holds even when a DB template puts the code back into the subject', async () => {
    const original = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: 'verification-otp' } });
    await prisma.emailTemplate.update({
      where: { key: 'verification-otp' },
      data: { subjectPl: 'Kod: {{otp}}' },
    });

    try {
      const log = capturedLog();
      await mailer.send('verification-otp', 'customer@example.test', { otp: '999888', purpose: 'sign-in' });
      expect(log.lines()).not.toContain('999888');
    } finally {
      await prisma.emailTemplate.update({
        where: { key: 'verification-otp' },
        data: { subjectPl: original.subjectPl },
      });
    }
  });

  it('reports honestly that nothing was sent', async () => {
    const result = await mailer.send('verification-otp', 'customer@example.test', {
      otp: '333444',
      purpose: 'sign-in',
    });

    expect(result.sent).toBe(false);
  });
});

describe('mailer - EmailTemplate DB override', () => {
  it('uses the DB-stored template text when a row exists for the key, interpolating real placeholder values', async () => {
    const original = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: 'order-confirmation' } });
    await prisma.emailTemplate.update({
      where: { key: 'order-confirmation' },
      data: { subjectPl: 'TEST-OVERRIDE {{orderNumber}} / {{totalGrossZloty}}' },
    });

    try {
      const result = await mailer.send('order-confirmation', 'customer@example.test', {
        orderNumber: '2026/08/9999',
        totalGrossGrosze: 12_345,
        paymentMethod: 'BANK_TRANSFER',
      });
      expect(result.subject).toContain('TEST-OVERRIDE 2026/08/9999');
      expect(result.subject).toContain('123,45');
    } finally {
      await prisma.emailTemplate.update({ where: { key: 'order-confirmation' }, data: { subjectPl: original.subjectPl } });
    }
  });

  it('falls back to the hardcoded default when no EmailTemplate row exists for the key', async () => {
    const original = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: 'order-confirmation' } });
    await prisma.emailTemplate.delete({ where: { key: 'order-confirmation' } });

    try {
      const result = await mailer.send('order-confirmation', 'customer@example.test', {
        orderNumber: '2026/08/9998',
        totalGrossGrosze: 5_000,
        paymentMethod: 'BANK_TRANSFER',
      });
      expect(result.subject).toContain('Potwierdzenie zamówienia 2026/08/9998');
    } finally {
      await prisma.emailTemplate.create({
        data: { key: original.key, subjectPl: original.subjectPl, bodyPl: original.bodyPl },
      });
    }
  });
});

describe('mailer - order-status-update (P6, staff order transitions)', () => {
  it('renders the real customer-facing status label, not the admin one', async () => {
    const result = await mailer.send('order-status-update', 'customer@example.test', {
      orderNumber: '2026/08/9997',
      statusPl: 'W produkcji',
    });

    expect(result.subject).toContain('Zamówienie 2026/08/9997: W produkcji');
  });

  it('uses the DB-stored template text when a row exists for the key, interpolating real placeholder values', async () => {
    const original = await prisma.emailTemplate.findUniqueOrThrow({ where: { key: 'order-status-update' } });
    await prisma.emailTemplate.update({
      where: { key: 'order-status-update' },
      data: { subjectPl: 'TEST-OVERRIDE {{orderNumber}} / {{statusPl}}' },
    });

    try {
      const result = await mailer.send('order-status-update', 'customer@example.test', {
        orderNumber: '2026/08/9996',
        statusPl: 'Wysłane',
      });
      expect(result.subject).toContain('TEST-OVERRIDE 2026/08/9996 / Wysłane');
    } finally {
      await prisma.emailTemplate.update({ where: { key: 'order-status-update' }, data: { subjectPl: original.subjectPl } });
    }
  });
});
