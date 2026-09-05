import { afterEach, describe, expect, it } from 'vitest';

import { applyUpdateStoreSettings } from '@/server/operations/admin-store-settings';
import { getStoreSettings } from '@/server/repositories/store-settings';
import type { CurrentSession } from '@/server/auth/session';
import { prisma } from '@/server/db/client';

const PREFIX = 'test-admin-store-settings-';

function uid(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

/**
 * ADMIN, not STAFF - changed 2026-08-31 for docs/REVIEW-DETAILED.md SEC-04.
 * This operation now refuses a STAFF actor (ARCHITECTURE.md §16.3), so an
 * actor built here has to be one that is genuinely allowed to perform it;
 * the refusal itself is covered by tests/integration/admin-authorization.test.ts.
 * The name is kept as `staffActor` because every call site below reads as
 * "the acting member of staff", which an ADMIN still is.
 */
function staffActor(): CurrentSession {
  return { userId: uid(), role: 'ADMIN', name: 'Test Admin', email: `${uid()}@example.test` };
}

// StoreSettings is a real singleton shared with the rest of the app (and
// every other test in this run) - snapshot it before mutating and restore
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
        facebookUrl: snapshot.facebookUrl,
        instagramUrl: snapshot.instagramUrl,
        tiktokUrl: snapshot.tiktokUrl,
        youtubeUrl: snapshot.youtubeUrl,
        updatedByEmail: snapshot.updatedByEmail,
      },
    });
    snapshot = null;
  }
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
});

/**
 * Owner request, 2026-09-04: the strip above the navigation is for social
 * profiles, "fb insta itd", not for links to our own subpages.
 *
 * Which meant they had to become real data. Hard-coding a Facebook or
 * Instagram URL would be inventing a profile that may not exist, and a
 * social icon linking nowhere is worse than no icon - so they are settings
 * the owner fills in, and the strip renders only what is actually
 * configured.
 */
const BLANK_SOCIALS = {
  facebookUrl: '',
  instagramUrl: '',
  tiktokUrl: '',
  youtubeUrl: '',
} as const;

/**
 * UX-22 requires the account number to be re-typed, but only when it
 * changes. The cases below that are not about the bank field pass the same
 * value they are setting, so they keep testing what they were written to
 * test.
 */
const CONFIRMING = (bankAccountNumber: string) => ({ bankAccountNumberConfirmation: bankAccountNumber });

describe('getStoreSettings', () => {
  it('returns the real singleton row', async () => {
    const settings = await getStoreSettings();
    expect(typeof settings.shippingFlatRateGrosze).toBe('number');
  });
});

describe('applyUpdateStoreSettings', () => {
  it('rejects a negative shipping rate', async () => {
    const result = await applyUpdateStoreSettings(staffActor(), {
      ...BLANK_SOCIALS,
      bankAccountNumber: '',
      ...CONFIRMING(''),
      bankAccountHolderPl: '',
      shippingFlatRateGrosze: -1,
    });
    expect(result.ok).toBe(false);
  });

  it('persists real values, treats a blank string as un-configuring a field, and audits the change', async () => {
    snapshot = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
    const staff = staffActor();

    const result = await applyUpdateStoreSettings(staff, {
      ...BLANK_SOCIALS,
      bankAccountNumber: 'PL61 1090 1014 0000 0712 1981 2874',
      ...CONFIRMING('PL61 1090 1014 0000 0712 1981 2874'),
      bankAccountHolderPl: 'RYT Sp. z o.o.',
      shippingFlatRateGrosze: 2_500,
    });
    expect(result.ok).toBe(true);

    const after = await getStoreSettings();
    expect(after.bankAccountNumber).toBe('PL61 1090 1014 0000 0712 1981 2874');
    expect(after.bankAccountHolderPl).toBe('RYT Sp. z o.o.');
    expect(after.shippingFlatRateGrosze).toBe(2_500);

    await applyUpdateStoreSettings(staff, { ...BLANK_SOCIALS, bankAccountNumber: '   ', ...CONFIRMING('   '), bankAccountHolderPl: '', shippingFlatRateGrosze: 2_000 });
    const cleared = await getStoreSettings();
    expect(cleared.bankAccountNumber).toBeNull();
    expect(cleared.bankAccountHolderPl).toBeNull();

    expect(await prisma.auditLog.count({ where: { entity: 'StoreSettings', actorEmail: staff.email } })).toBe(2);
  });
});

describe('applyUpdateStoreSettings - social profiles', () => {
  it('stores the profiles the owner configured and leaves the rest unset', async () => {
    snapshot = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });

    const result = await applyUpdateStoreSettings(staffActor(), {
      ...BLANK_SOCIALS,
      bankAccountNumber: '',
      ...CONFIRMING(''),
      bankAccountHolderPl: '',
      shippingFlatRateGrosze: 2_000,
      facebookUrl: 'https://www.facebook.com/rytpl',
      instagramUrl: '  https://www.instagram.com/rytpl  ',
    });
    expect(result.ok).toBe(true);

    const after = await getStoreSettings();
    expect(after.facebookUrl).toBe('https://www.facebook.com/rytpl');
    // Trimmed, like every other text field here.
    expect(after.instagramUrl).toBe('https://www.instagram.com/rytpl');
    // Never a guess. An unconfigured profile is null, and the strip shows
    // nothing for it rather than a link to a page nobody has claimed.
    expect(after.tiktokUrl).toBeNull();
    expect(after.youtubeUrl).toBeNull();
  });

  it('refuses anything that is not an absolute https URL', async () => {
    // A social icon is a link the shop puts its name behind. `javascript:`
    // in an admin-editable href is a stored-XSS vector on every page of the
    // storefront, and a bare `facebook.com/rytpl` would resolve as a path on
    // our own domain and 404.
    for (const facebookUrl of [
      'javascript:alert(1)',
      'facebook.com/rytpl',
      '/facebook',
      'http://www.facebook.com/rytpl',
      'data:text/html,<script>',
    ]) {
      const result = await applyUpdateStoreSettings(staffActor(), {
        ...BLANK_SOCIALS,
        bankAccountNumber: '',
        ...CONFIRMING(''),
        bankAccountHolderPl: '',
        shippingFlatRateGrosze: 2_000,
        facebookUrl,
      });
      expect(result.ok, facebookUrl).toBe(false);
    }
  });

  it('accepts a blank field as "no profile", not as an error', async () => {
    snapshot = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });

    const result = await applyUpdateStoreSettings(staffActor(), {
      ...BLANK_SOCIALS,
      bankAccountNumber: '',
      ...CONFIRMING(''),
      bankAccountHolderPl: '',
      shippingFlatRateGrosze: 2_000,
    });

    expect(result.ok).toBe(true);
    expect((await getStoreSettings()).facebookUrl).toBeNull();
  });
});

/**
 * `docs/AI-CHECKLIST.md` UX-22 - a second confirmation on the bank-account
 * field.
 *
 * This is the number every bank-transfer customer is told to pay into. A
 * transposed digit sends real money elsewhere, and nothing about the wrong
 * number looks wrong. Two guards, because neither is sufficient alone:
 * the checksum rejects a mistyped Polish account outright, and the re-typed
 * confirmation catches what a checksum cannot.
 *
 * The confirmation is required **only when the number actually changes**.
 * Demanding it to edit the shipping rate would train whoever uses this page
 * to paste the same value twice without reading it, which is how a
 * confirmation stops being one.
 */
describe('applyUpdateStoreSettings - the bank account number', () => {
  const VALID = 'PL61 1090 1014 0000 0712 1981 2874';

  /**
   * `StoreSettings` is a singleton every test in this run shares, and this
   * rule is about a *change* - so each case states the number it is starting
   * from rather than inheriting whatever the previous one left. The first
   * version of these tests did inherit, and one passed for the wrong reason.
   */
  async function startingFrom(bankAccountNumber: string | null): Promise<void> {
    snapshot = snapshot ?? (await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } }));
    await prisma.storeSettings.update({ where: { id: 1 }, data: { bankAccountNumber } });
  }

  function input(overrides: Record<string, unknown> = {}) {
    return {
      ...BLANK_SOCIALS,
      bankAccountNumber: '',
      bankAccountHolderPl: '',
      shippingFlatRateGrosze: 2_000,
      bankAccountNumberConfirmation: '',
      ...overrides,
    };
  }

  it('saves a valid number when it is confirmed', async () => {
    await startingFrom(null);

    const result = await applyUpdateStoreSettings(
      staffActor(),
      input({ bankAccountNumber: VALID, bankAccountNumberConfirmation: VALID }),
    );

    expect(result.ok).toBe(true);
    expect((await getStoreSettings()).bankAccountNumber).toBe(VALID);
  });

  it('refuses a mistyped number outright, confirmed or not', async () => {
    // Last digit changed. The check digits exist precisely to catch this,
    // and confirming it twice would not make it right.
    const mistyped = 'PL61 1090 1014 0000 0712 1981 2875';
    await startingFrom(null);

    const result = await applyUpdateStoreSettings(
      staffActor(),
      input({ bankAccountNumber: mistyped, bankAccountNumberConfirmation: mistyped }),
    );

    expect(result.ok).toBe(false);
  });

  it('refuses a new number that was not re-typed identically', async () => {
    await startingFrom(null);

    const result = await applyUpdateStoreSettings(
      staffActor(),
      input({ bankAccountNumber: VALID, bankAccountNumberConfirmation: '' }),
    );

    expect(result.ok).toBe(false);
  });

  it('ignores how the two were spaced', async () => {
    // Nobody groups digits the same way twice. Refusing a real match over a
    // space would teach whoever uses this page to paste rather than read.
    await startingFrom(null);

    const result = await applyUpdateStoreSettings(
      staffActor(),
      input({ bankAccountNumber: VALID, bankAccountNumberConfirmation: 'PL61109010140000071219812874' }),
    );

    expect(result.ok).toBe(true);
  });

  it('accepts a foreign account it cannot verify, provided it is confirmed', async () => {
    // "We cannot check this" is not "this is wrong". The shop is not required
    // to refuse a non-Polish account, and the confirmation still applies.
    await startingFrom(null);
    const german = 'DE89 3704 0044 0532 0130 00';

    const result = await applyUpdateStoreSettings(
      staffActor(),
      input({ bankAccountNumber: german, bankAccountNumberConfirmation: german }),
    );

    expect(result.ok).toBe(true);
  });

  it('needs no confirmation to change something else', async () => {
    /*
      The rule that keeps the confirmation meaningful. If editing the
      shipping rate demanded the account number be re-typed, whoever uses
      this page would learn to paste it twice without looking - and a
      confirmation nobody reads is not a confirmation.
    */
    await startingFrom(VALID);

    const result = await applyUpdateStoreSettings(
      staffActor(),
      input({ bankAccountNumber: VALID, shippingFlatRateGrosze: 3_000 }),
    );

    expect(result.ok).toBe(true);
    expect((await getStoreSettings()).shippingFlatRateGrosze).toBe(3_000);
  });

  it('needs no confirmation to clear the field', async () => {
    // Clearing it un-configures the account; the confirmation page then says
    // so honestly rather than printing a number. Nothing is misdirected by
    // an absence.
    await startingFrom(VALID);

    const result = await applyUpdateStoreSettings(staffActor(), input({ bankAccountNumber: '' }));

    expect(result.ok).toBe(true);
    expect((await getStoreSettings()).bankAccountNumber).toBeNull();
  });
});
