/**
 * Real Przelewy24 REST API v1 integration — 2026-08-29, owner request:
 * "dodaj łączenie z przelewy24 ... oraz przejście do przelewy24 z podaną
 * ceną" (add a connection with Przelewy24 ... and a transition to
 * Przelewy24 with the given price), explicitly "nie musi jeszcze działać
 * e2e" (doesn't need to actually work end-to-end yet).
 *
 * This is real, spec-accurate code against P24's actual `/transaction/
 * register` endpoint and their actual SHA384 signature algorithm — not a
 * simulation. What makes it honestly "not yet connected" (§9/§15's "no
 * fake payment" rule, and `PaymentMethodConfig`'s own schema comment: "Only
 * ever set `true` by real code once a real provider exists") is that
 * nobody has a real Przelewy24 merchant account yet: `isConfigured()`
 * reads `P24_MERCHANT_ID`/`P24_POS_ID`/`P24_API_KEY`/`P24_CRC` from the
 * environment, all currently unset, so `registerPayment` always short-
 * circuits before any network call. The moment a real merchant account
 * exists, setting those four env vars is the ENTIRE remaining step — no
 * code here needs to change, and `listActivePaymentMethods()` gaining this
 * provider is then just the seed's `isConnected` flag flipping to `true`
 * once someone has actually verified it against P24's real sandbox.
 *
 * Registration flow (P24's own documented contract):
 *  1. POST the transaction fields + a SHA384 `sign` to `/api/v1/transaction/register`.
 *  2. P24 returns `{ data: { token } }`.
 *  3. The customer's browser is sent to `{baseUrl}/trnRequest/{token}` — that's the "transition to Przelewy24 with the given price."
 */

import { createHash } from 'node:crypto';

import type { PaymentProvider, RegisterPaymentInput, RegisterPaymentResult } from './provider';

type Przelewy24Config = {
  readonly merchantId: string;
  readonly posId: string;
  readonly apiKey: string;
  readonly crc: string;
  readonly sandbox: boolean;
};

function readConfig(): Przelewy24Config | null {
  const merchantId = process.env.P24_MERCHANT_ID;
  const posId = process.env.P24_POS_ID ?? merchantId;
  const apiKey = process.env.P24_API_KEY;
  const crc = process.env.P24_CRC;
  if (
    merchantId === undefined || merchantId.length === 0 ||
    posId === undefined || posId.length === 0 ||
    apiKey === undefined || apiKey.length === 0 ||
    crc === undefined || crc.length === 0
  ) {
    return null;
  }
  return { merchantId, posId, apiKey, crc, sandbox: process.env.P24_SANDBOX !== 'false' };
}

function baseUrl(sandbox: boolean): string {
  return sandbox ? 'https://sandbox.przelewy24.pl' : 'https://secure.przelewy24.pl';
}

/**
 * P24's documented `sign` field: SHA384 of a JSON string with EXACTLY
 * these five keys, in this order — order and key set both matter, this
 * isn't "any JSON containing these values." Pure and exported so it's
 * unit-testable without a live account or a network call.
 */
export function buildRegisterSign(params: {
  readonly sessionId: string;
  readonly merchantId: string;
  readonly amountGrosze: number;
  readonly currency: string;
  readonly crc: string;
}): string {
  const payload = JSON.stringify({
    sessionId: params.sessionId,
    merchantId: Number(params.merchantId),
    amount: params.amountGrosze,
    currency: params.currency,
    crc: params.crc,
  });
  return createHash('sha384').update(payload, 'utf8').digest('hex');
}

export type Przelewy24RegisterPayload = {
  readonly merchantId: number;
  readonly posId: number;
  readonly sessionId: string;
  readonly amount: number;
  readonly currency: string;
  readonly description: string;
  readonly email: string;
  readonly country: 'PL';
  readonly language: 'pl';
  readonly urlReturn: string;
  readonly urlStatus: string;
  readonly sign: string;
};

/** Pure payload builder — separated from `registerPayment` so its shape can be asserted in a unit test without mocking `fetch`. */
export function buildRegisterPayload(config: Przelewy24Config, input: RegisterPaymentInput): Przelewy24RegisterPayload {
  const sessionId = input.orderNumber;
  return {
    merchantId: Number(config.merchantId),
    posId: Number(config.posId),
    sessionId,
    amount: input.amountGrosze,
    currency: input.currency,
    description: input.description,
    email: input.customerEmail,
    country: 'PL',
    language: 'pl',
    urlReturn: input.returnUrl,
    urlStatus: input.statusCallbackUrl,
    sign: buildRegisterSign({
      sessionId,
      merchantId: config.merchantId,
      amountGrosze: input.amountGrosze,
      currency: input.currency,
      crc: config.crc,
    }),
  };
}

/** `{ data: { token: string } }` — P24's real response shape, narrowed without an `as` cast. */
function extractToken(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || !('data' in body)) {
    return null;
  }
  const data = (body as { data: unknown }).data;
  if (data === null || typeof data !== 'object' || !('token' in data)) {
    return null;
  }
  const token = (data as { token: unknown }).token;
  return typeof token === 'string' ? token : null;
}

export class Przelewy24Provider implements PaymentProvider {
  readonly name = 'PRZELEWY24';

  isConfigured(): boolean {
    return readConfig() !== null;
  }

  async registerPayment(input: RegisterPaymentInput): Promise<RegisterPaymentResult> {
    const config = readConfig();
    if (config === null) {
      return {
        ok: false,
        reason: 'Przelewy24 nie jest skonfigurowane (brak P24_MERCHANT_ID/P24_POS_ID/P24_API_KEY/P24_CRC).',
      };
    }

    const payload = buildRegisterPayload(config, input);
    const url = `${baseUrl(config.sandbox)}/api/v1/transaction/register`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${config.posId}:${config.apiKey}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      });
    } catch {
      return { ok: false, reason: 'Nie udało się połączyć z Przelewy24.' };
    }

    if (!response.ok) {
      return { ok: false, reason: `Przelewy24 zwróciło błąd (HTTP ${response.status}).` };
    }

    const body: unknown = await response.json().catch(() => null);
    const token = extractToken(body);
    if (token === null) {
      return { ok: false, reason: 'Przelewy24 nie zwróciło poprawnego tokenu transakcji.' };
    }

    return { ok: true, redirectUrl: `${baseUrl(config.sandbox)}/trnRequest/${token}`, providerToken: token };
  }
}

export const przelewy24Provider = new Przelewy24Provider();
