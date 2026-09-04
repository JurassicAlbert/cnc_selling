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
      bankAccountHolderPl: 'RYT Sp. z o.o.',
      shippingFlatRateGrosze: 2_500,
    });
    expect(result.ok).toBe(true);

    const after = await getStoreSettings();
    expect(after.bankAccountNumber).toBe('PL61 1090 1014 0000 0712 1981 2874');
    expect(after.bankAccountHolderPl).toBe('RYT Sp. z o.o.');
    expect(after.shippingFlatRateGrosze).toBe(2_500);

    await applyUpdateStoreSettings(staff, { ...BLANK_SOCIALS, bankAccountNumber: '   ', bankAccountHolderPl: '', shippingFlatRateGrosze: 2_000 });
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
      bankAccountHolderPl: '',
      shippingFlatRateGrosze: 2_000,
    });

    expect(result.ok).toBe(true);
    expect((await getStoreSettings()).facebookUrl).toBeNull();
  });
});
