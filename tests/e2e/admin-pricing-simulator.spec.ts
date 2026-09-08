import 'dotenv/config';

import { expect, test } from './fixtures';
import { fillReliably } from './fill-reliably';
import { registerAccount } from './register';

import { prisma } from '../../src/server/db/client';

/**
 * `docs/AI-CHECKLIST.md` BUG-34, the half the integration tests cannot reach.
 *
 * §16A.1 module 7 calls this the highest-risk screen in the application, and
 * R14 names the pre-publish simulator as the mitigation for "a mistyped rate
 * changes every price on the site". The server rules - a version cannot be
 * published without a recorded simulation, and the table prices products from
 * the live catalogue - are pinned in `tests/integration/admin-pricing.test.ts`.
 * What only a browser can show is that the screen an admin actually looks at
 * renders those products with **names**, and that Publish is not offered until
 * it has.
 *
 * That second part is why this exists rather than being taken on trust. Before
 * 2026-09-08 the reference set was three hard-coded slugs, two of which had
 * been retired with their categories - so the table rendered two rows reading
 * „stolek-loftowy-z-grawerem" and „panel-podlogowy-z-grawerem" over „nie udało
 * się wycenić", and no test anywhere had an opinion about it. A row showing a
 * slug is the shape that failure takes on screen, so that is what is asserted.
 *
 * **It never publishes.** Publishing swaps which pricing version is live for
 * the whole test database, and a spec that failed midway through would leave
 * every later test pricing against a throwaway rate set - which is exactly the
 * wreckage the integration suite had to be repaired from on the same day. The
 * draft it creates is inert (`isActive: false`) and deleted afterwards.
 */

const PREFIX = 'e2e-pricing-sim';

test('the pre-publish simulator prices real, named products, and gates the button until it has', async ({ page }) => {
  test.slow();

  const email = `${PREFIX}-${Date.now()}@example.test`;
  const password = 'TestoweHaslo123!';
  await registerAccount(page, { name: 'Pricing Admin', email, password });
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });

  // The role claim on the session just created is stale - Better Auth read it
  // at sign-up, before the promotion above. Same dance as `admin-authz.spec.ts`.
  await page.getByRole('button', { name: 'Wyloguj się' }).click();
  await page.goto('/logowanie');
  const passwordForm = page.locator('form').filter({ has: page.getByLabel('Hasło') });
  await fillReliably(passwordForm.getByLabel('Adres e-mail'), email);
  await fillReliably(passwordForm.getByLabel('Hasło'), password);
  await passwordForm.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).toHaveURL('/panel');

  // Straight into the database rather than through the "new version" form: the
  // form is not what this spec is about, and a draft row is inert until
  // published.
  const highest = await prisma.pricingSettings.findFirst({ orderBy: { version: 'desc' }, select: { version: true } });
  const version = (highest?.version ?? 0) + 1;
  await prisma.pricingSettings.create({
    data: {
      version,
      machineRateCncGrosze: 15_000,
      machineRateLaserGrosze: 12_000,
      moduleSurchargeGrosze: 4_000,
      vatRateBp: 2_300,
      packagingTiers: [{ maxAreaM2: null, maxModules: null, priceGrosze: 1_500 }],
      isActive: false,
      notePl: `${PREFIX} draft`,
    },
  });

  try {
    await page.goto(`/panel/ceny/${version}`);

    const table = page.getByRole('table');
    await expect(table).toBeVisible();

    const names = await table.locator('tbody tr td:first-child').allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.trim().length).toBeGreaterThan(0);
      // A slug where a product name belongs is what the stale hard-coded
      // reference set looked like on screen.
      expect(name).not.toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
    }

    // The simulation has resolved, so the interlock is satisfied and the
    // button is offered. Its confirmation dialog is deliberately not opened:
    // nothing here publishes.
    const publish = page.getByRole('button', { name: 'Publikuj tę wersję' });
    await expect(publish).toBeEnabled();

    // And the server agrees that this version has now been reviewed - the
    // record the publish guard reads, written by the page simply being open.
    const reviewed = await prisma.pricingSettings.findUniqueOrThrow({
      where: { version },
      select: { simulatedAt: true, simulatedByEmail: true, isActive: true },
    });
    expect(reviewed.simulatedAt).not.toBeNull();
    expect(reviewed.simulatedByEmail).toBe(email);
    expect(reviewed.isActive).toBe(false);
  } finally {
    await prisma.pricingSettings.deleteMany({ where: { version } });
  }
});
