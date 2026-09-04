/**
 * The delivery details a customer can fill in on the cart page - owner
 * request, 2026-09-04: the cart should allow "podania pełnego adresu razem z
 * komentarzem", the way the reference layout's cart carries a comments box
 * and a shipping panel.
 *
 * The whole point of these tests is that the form is **not decoration**. A
 * cart page that collects an address and then makes the customer type it
 * again on the next page is worse than not asking: it looks like progress
 * and produces none. So what is pinned here is that the draft persists
 * against the real cart and comes back, that clearing a field genuinely
 * clears it, and that the draft belongs to one cart rather than leaking
 * between customers.
 *
 * Nothing here validates the address. That is deliberate and worth stating:
 * this is a draft someone is part-way through typing, and refusing to save
 * a half-finished postcode would defeat the purpose. The binding validation
 * is `createOrder`'s, unchanged, and it runs on what is actually submitted
 * at checkout.
 */

import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { applySaveCartDeliveryDraft } from '@/server/operations/cart-delivery-draft';
import { findCartForRequest } from '@/server/repositories/cart';

const PREFIX = 'test-cart-draft-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

const BLANK = {
  email: '',
  phone: '',
  firstName: '',
  lastName: '',
  street: '',
  postalCode: '',
  city: '',
  courierNotePl: '',
} as const;

let sessionToken: string;

beforeEach(async () => {
  sessionToken = uid();
  await prisma.cart.create({ data: { sessionToken } });
});

afterAll(async () => {
  await prisma.cart.deleteMany({ where: { sessionToken: { startsWith: PREFIX } } });
});

async function draftFor(token: string) {
  return (await findCartForRequest({ userId: null, sessionToken: token })).deliveryDraft;
}

describe('applySaveCartDeliveryDraft', () => {
  it('saves what was typed and hands it back on the next read', async () => {
    const result = await applySaveCartDeliveryDraft(
      { userId: null, sessionToken },
      {
        ...BLANK,
        email: 'ala@example.test',
        phone: '600 100 200',
        firstName: 'Ala',
        lastName: 'Kowalska',
        street: 'Kwiatowa 5/2',
        postalCode: '30-001',
        city: 'Kraków',
        courierNotePl: 'Proszę zostawić u sąsiada.',
      },
    );
    expect(result.ok).toBe(true);

    const draft = await draftFor(sessionToken);
    expect(draft.firstName).toBe('Ala');
    expect(draft.street).toBe('Kwiatowa 5/2');
    expect(draft.postalCode).toBe('30-001');
    expect(draft.city).toBe('Kraków');
    expect(draft.courierNotePl).toBe('Proszę zostawić u sąsiada.');
  });

  it('trims, and treats a blank field as genuinely cleared', async () => {
    const actor = { userId: null, sessionToken };
    await applySaveCartDeliveryDraft(actor, { ...BLANK, city: '  Kraków  ', courierNotePl: 'Kod do bramy 1234.' });
    expect((await draftFor(sessionToken)).city).toBe('Kraków');

    // Someone removing a note must see it removed, not kept because an empty
    // string was read as "no change".
    await applySaveCartDeliveryDraft(actor, { ...BLANK, city: 'Kraków', courierNotePl: '   ' });
    const draft = await draftFor(sessionToken);
    expect(draft.courierNotePl).toBeNull();
    expect(draft.city).toBe('Kraków');
  });

  it('accepts a half-finished address without complaint', async () => {
    // A draft is exactly that. Rejecting an incomplete postcode while the
    // customer is still typing would make the form unusable; `createOrder`
    // is where the binding validation lives, and it is unchanged.
    const result = await applySaveCartDeliveryDraft(
      { userId: null, sessionToken },
      { ...BLANK, postalCode: '30-', city: 'Kra' },
    );

    expect(result.ok).toBe(true);
    expect((await draftFor(sessionToken)).postalCode).toBe('30-');
  });

  it('keeps one cart draft out of another cart', async () => {
    const otherToken = uid();
    await prisma.cart.create({ data: { sessionToken: otherToken } });

    await applySaveCartDeliveryDraft({ userId: null, sessionToken }, { ...BLANK, city: 'Kraków' });

    expect((await draftFor(otherToken)).city).toBeNull();
  });

  it('refuses when the caller has no cart of their own', async () => {
    // No session token and no user: nothing to attach a draft to. Creating a
    // cart here would mint one from a page that never adds an item to it.
    const result = await applySaveCartDeliveryDraft({ userId: null, sessionToken: null }, { ...BLANK, city: 'Kraków' });

    expect(result.ok).toBe(false);
  });

  it('reads back as all-null for a cart nobody has filled in', async () => {
    const draft = await draftFor(sessionToken);

    expect(draft.email).toBeNull();
    expect(draft.city).toBeNull();
    expect(draft.courierNotePl).toBeNull();
  });
});
