import { afterEach, describe, expect, it } from 'vitest';

import { Przelewy24Provider, buildRegisterPayload, buildRegisterSign } from '@/server/services/payment/przelewy24';

const ENV_KEYS = ['P24_MERCHANT_ID', 'P24_POS_ID', 'P24_API_KEY', 'P24_CRC', 'P24_SANDBOX'] as const;
const original: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};
for (const key of ENV_KEYS) {
  original[key] = process.env[key];
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original[key];
    }
  }
});

/**
 * 2026-08-29, owner request: real Przelewy24 code, honestly gated by
 * missing merchant credentials — see `przelewy24.ts`'s own header comment
 * for why `isConfigured()` is the whole story of "not yet connected" here.
 * These tests never make a real network call (no credentials are ever set
 * to anything a real sandbox would accept) — they assert the gating logic
 * and the exact request shape P24's real API expects.
 */
describe('Przelewy24Provider.isConfigured', () => {
  it('is false with no credentials set at all', () => {
    delete process.env.P24_MERCHANT_ID;
    delete process.env.P24_POS_ID;
    delete process.env.P24_API_KEY;
    delete process.env.P24_CRC;
    expect(new Przelewy24Provider().isConfigured()).toBe(false);
  });

  it('is false when only some credentials are set', () => {
    process.env.P24_MERCHANT_ID = '12345';
    process.env.P24_API_KEY = 'test-key';
    delete process.env.P24_CRC;
    expect(new Przelewy24Provider().isConfigured()).toBe(false);
  });

  it('is true once every required credential is set', () => {
    process.env.P24_MERCHANT_ID = '12345';
    process.env.P24_POS_ID = '12345';
    process.env.P24_API_KEY = 'test-key';
    process.env.P24_CRC = 'test-crc';
    expect(new Przelewy24Provider().isConfigured()).toBe(true);
  });
});

describe('Przelewy24Provider.registerPayment — not configured', () => {
  it('short-circuits with a clear reason and makes no network call', async () => {
    delete process.env.P24_MERCHANT_ID;
    delete process.env.P24_POS_ID;
    delete process.env.P24_API_KEY;
    delete process.env.P24_CRC;

    const result = await new Przelewy24Provider().registerPayment({
      orderNumber: '2026/08/0001',
      amountGrosze: 12_345,
      currency: 'PLN',
      customerEmail: 'test@example.test',
      description: 'Zamówienie 2026/08/0001',
      returnUrl: 'https://example.test/powrot',
      statusCallbackUrl: 'https://example.test/status',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/nie jest skonfigurowane/i);
    }
  });
});

describe('buildRegisterSign', () => {
  it('is deterministic — the same input always produces the same signature', () => {
    const params = { sessionId: '2026/08/0001', merchantId: '12345', amountGrosze: 12_345, currency: 'PLN', crc: 'test-crc' };
    expect(buildRegisterSign(params)).toBe(buildRegisterSign(params));
  });

  it('changes when the amount changes — a tampered price never signs the same', () => {
    const base = { sessionId: '2026/08/0001', merchantId: '12345', currency: 'PLN', crc: 'test-crc' };
    const signA = buildRegisterSign({ ...base, amountGrosze: 12_345 });
    const signB = buildRegisterSign({ ...base, amountGrosze: 99_999 });
    expect(signA).not.toBe(signB);
  });

  it('produces a 96-character lowercase hex string (SHA384)', () => {
    const sign = buildRegisterSign({ sessionId: 'x', merchantId: '1', amountGrosze: 100, currency: 'PLN', crc: 'y' });
    expect(sign).toMatch(/^[0-9a-f]{96}$/);
  });
});

describe('buildRegisterPayload', () => {
  it('builds the exact field set Przelewy24 documents for /transaction/register', () => {
    const config = { merchantId: '12345', posId: '12345', apiKey: 'test-key', crc: 'test-crc', sandbox: true };
    const payload = buildRegisterPayload(config, {
      orderNumber: '2026/08/0001',
      amountGrosze: 12_345,
      currency: 'PLN',
      customerEmail: 'test@example.test',
      description: 'Zamówienie 2026/08/0001',
      returnUrl: 'https://example.test/powrot',
      statusCallbackUrl: 'https://example.test/status',
    });

    expect(payload).toEqual({
      merchantId: 12_345,
      posId: 12_345,
      sessionId: '2026/08/0001',
      amount: 12_345,
      currency: 'PLN',
      description: 'Zamówienie 2026/08/0001',
      email: 'test@example.test',
      country: 'PL',
      language: 'pl',
      urlReturn: 'https://example.test/powrot',
      urlStatus: 'https://example.test/status',
      sign: buildRegisterSign({ sessionId: '2026/08/0001', merchantId: '12345', amountGrosze: 12_345, currency: 'PLN', crc: 'test-crc' }),
    });
  });
});
