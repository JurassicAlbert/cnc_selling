import 'dotenv/config';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { registerAndPromote } from './admin-session';
import { prisma } from '../../src/server/db/client';

/**
 * INSURANCE-01, the admin half - and the half the item was actually blocked
 * on.
 *
 * The owner chose the carrier's real declared-value table over a flat fee or
 * a percentage, and neither InPost nor DPD publishes one citably. Nothing can
 * be seeded honestly, so the feature ships switched off and **this screen is
 * how it gets switched on**: whatever an admin types here is what a customer
 * is offered, through the one resolver checkout and `createOrder` share.
 *
 * The operations behind it are covered in
 * `tests/integration/admin-delivery-methods.test.ts`. What only a browser can
 * show is that the screen is reachable, says plainly why it is empty, and
 * that a band typed into the form actually lands - a rate card an owner
 * cannot enter is a feature that stays off forever.
 *
 * Deliberately does NOT clear the method's existing bands first: e2e runs
 * against the development database, and by the time this matters the owner
 * may have typed the real card in. It adds one recognisable band and removes
 * exactly that one.
 */

const BAND_LABEL = 'e2e-admin do 3000 zł';

async function signInAsAdmin(page: Page): Promise<string> {
  const email = `test-insurance-admin-${crypto.randomUUID()}@example.test`;
  await registerAndPromote(page, { name: 'E2E Insurance Admin', email, password: 'correcthorse123', role: 'ADMIN' });
  return email;
}

test('an admin can enter the carrier rate card that turns insurance on', async ({ page }) => {
  test.slow();

  const email = await signInAsAdmin(page);
  const method = await prisma.deliveryMethod.findFirstOrThrow({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });

  try {
    await page.goto(`/panel/dostawa/${method.id}`);
    const main = page.getByRole('main');

    // The screen exists and explains itself. The intro is the part that
    // matters on a method with no bands: an admin who finds an empty table
    // with no explanation reads it as broken.
    await expect(main.getByText('Ubezpieczenie przesyłki (cennik przewoźnika)')).toBeVisible({ timeout: 15_000 });

    /*
      Scoped to the insurance form rather than the page: the weight-tier
      editor above it has its own „Nazwa progu", so an unscoped label lookup
      resolves to two fields. Filtered by the one field only this form has -
      the same shape `admin-authz.spec.ts` uses to pick out the password form.
    */
    const form = page.locator('form').filter({ has: page.getByLabel('Wartość do (zł)') });
    await form.getByLabel('Nazwa progu').fill(BAND_LABEL);
    await form.getByLabel('Wartość do (zł)').fill('3000');
    await form.getByLabel('Składka (zł)').fill('7.50');
    await form.getByRole('button', { name: 'Dodaj' }).click();

    /*
      It is in the list, with the money rendered back in złoty rather than in
      the grosze it is stored as.

      `exact` because the band's name legitimately appears twice on this page:
      once as its own row, and once inside the activity timeline at the
      bottom, which renders the audit diff - `{"addInsuranceTier": {"labelPl":
      ...}}`. Both are correct and both should be there, so the locator says
      which one it means rather than the page being changed to keep it unique
      (the same call `storefront-chrome.spec.ts` made about two links named
      „Koszyk").
    */
    await expect(main.getByText(BAND_LABEL, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText('7,50 zł')).toBeVisible();

    // And it is a real row, not just something on the screen.
    const stored = await prisma.deliveryInsuranceTier.findFirstOrThrow({ where: { labelPl: BAND_LABEL } });
    expect(stored.maxValueGrosze).toBe(300_000);
    expect(stored.priceGrosze).toBe(750);
    expect(stored.deliveryMethodId).toBe(method.id);
  } finally {
    await prisma.deliveryInsuranceTier.deleteMany({ where: { labelPl: BAND_LABEL } });
    await prisma.user.deleteMany({ where: { email } });
  }
});
