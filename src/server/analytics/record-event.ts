/**
 * `AnalyticsEvent` writes - P6 Part E, `docs/ARCHITECTURE.md` §"AnalyticsEvent
 * is first-party... written only for consented sessions". The table and its
 * 12-month pruning/dashboard belong to P8 (`docs/CHECKLIST.md`'s own
 * phasing) - this is only the write path, real and consent-gated, for the
 * subset of §_.4's named events that have a natural SERVER-side trigger
 * already (`product_view`, `add_to_cart`, `checkout_started`, `purchase`).
 * The remaining named events (`configurator_step_completed`,
 * `design_selected`, etc.) are fired from client-side state changes deep
 * inside `Configurator.tsx` - instrumenting those means adding a
 * client-to-server event channel, a materially bigger change than this
 * polish pass scopes; the infrastructure here (this file, the consent
 * cookie, the gate) is what P8 or a later pass wires them into, unchanged.
 *
 * Never throws: an analytics write must never break the real action it's
 * attached to (adding to cart, placing an order) - failures are logged and
 * swallowed, same contract as `mailer.ts`'s `send`.
 */

import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import { logger } from '@/server/logging/logger';
import { readConsentChoice } from '@/server/session/consent';

/** Same intentional double-cast as `cart.ts`/`upload.ts`'s own `toJsonInput` - a single, named, auditable spot. */
function toJsonInput(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

export type AnalyticsEventName = 'product_view' | 'add_to_cart' | 'checkout_started' | 'purchase';

export type AnalyticsEventInput = {
  readonly name: AnalyticsEventName;
  readonly sessionToken: string | null;
  readonly userId: string | null;
  readonly productId?: string | null;
  readonly payload?: Record<string, unknown>;
};

/** Only callable from a request scope (reads the consent cookie) - same constraint as `ensureGuestSessionToken`/`getSession`. */
export async function recordAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  try {
    const consent = await readConsentChoice();
    if (consent !== 'accepted') {
      return;
    }
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        sessionToken: input.sessionToken,
        userId: input.userId,
        productId: input.productId ?? null,
        payload: input.payload === undefined ? undefined : toJsonInput(input.payload),
      },
    });
  } catch (error) {
    logger.error('analytics.record_event_failed', { eventName: input.name, error });
  }
}
