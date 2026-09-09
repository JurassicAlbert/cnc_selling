import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` UX-11 - removing a cart line was instant and
 * irreversible.
 *
 * `ARCHITECTURE.md` §16A.5's rule is undo rather than a dialog, and dialogs
 * only for what genuinely cannot be taken back. A removal is not one of
 * those: `applyRemoveCartItem` only ever deleted the `CartItem`, so nothing
 * about the item was destroyed - there was just no way back to it.
 *
 * Driven through the browser because the whole mechanism is a cookie the
 * server sets on one request and reads on the next. The integration suite
 * pins what restoring does; only a real round trip shows that the offer
 * appears, survives, and works.
 *
 * **The empty cart is the case that matters most.** Removing your only line
 * switches the page to a different branch entirely, and that is precisely
 * the removal a customer wants back - so it is what this test does.
 */
test('a removed line can be taken back, including when it was the only one', async ({ page }) => {
  test.slow();

  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const addToCart = page.getByRole('main').getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCart).toBeEnabled({ timeout: 30_000 });
  await addToCart.click();
  await expect(page).toHaveURL('/koszyk');

  // Two of them, so the restore has a quantity to get wrong.
  await page.getByRole('button', { name: 'Zwiększ ilość' }).click();
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible();

  await expect(page.getByText('Pozycja została usunięta z koszyka')).toHaveCount(0);

  await page.getByRole('button', { name: 'Usuń', exact: true }).click();

  // The cart is now empty - the branch where `CartContents` does not render
  // at all - and the offer is still there.
  await expect(page.getByText('Twój koszyk jest pusty', { exact: false })).toBeVisible();
  const undo = page.getByRole('button', { name: 'Cofnij' });
  await expect(undo).toBeVisible();

  // It survives a reload: the offer is a cookie, not a piece of client state
  // that a refresh throws away.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Cofnij' })).toBeVisible();

  await page.getByRole('button', { name: 'Cofnij' }).click();

  await expect(page.getByRole('heading', { name: 'Obraz drewniany z grawerem' })).toBeVisible();
  // The quantity it had, not one.
  await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
  // And the offer is spent - a second „Cofnij" would restore the line twice.
  await expect(page.getByRole('button', { name: 'Cofnij' })).toHaveCount(0);
});
