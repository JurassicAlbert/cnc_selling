import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` UX-13 - the cart showed none of what it knows about
 * a line.
 *
 * `CartItemView` has carried `warnings`, `acknowledgedWarnings` and
 * `customDesignStatus` since P5; `CartRow` rendered none of them. So a line
 * whose custom design is still `PENDING_REVIEW` - which will hold the **whole
 * order** in `DESIGN_REVIEW` after checkout - looked exactly like any other
 * line, and the feasibility notices a customer read and accepted during
 * configuration vanished the moment they added the item.
 *
 * Both halves are a display gap and nothing else: `feasibilityMessage` and
 * `customerDesignStatusMessage` already existed and are already used
 * elsewhere. The cart simply never asked.
 *
 * The pending-design half lives in `custom-upload.spec.ts`, which is the spec
 * that genuinely uploads a file and therefore has a real `PENDING_REVIEW`
 * line to look at. This one covers the notices, which every wood
 * configuration has: `NATURAL_VARIATION` fires for the seeded wall art at its
 * default size, and it is the kind of note that matters - a customer who is
 * told at checkout that grain and shade vary should not have to remember
 * reading it two screens earlier.
 */
test('a cart line keeps the notes the customer accepted while configuring it', async ({ page }) => {
  test.slow();

  await page.goto('/produkt/obraz-drewniany-z-grawerem');
  const addToCart = page.getByRole('main').getByRole('button', { name: 'Dodaj do koszyka' });
  await expect(addToCart).toBeEnabled({ timeout: 30_000 });
  await addToCart.click();
  await expect(page).toHaveURL('/koszyk');

  // The disclosure is closed by default - the cart's job is the total, and a
  // note the customer has already read should not shout a second time.
  // Targeted by its text rather than by role: `<details>`/`<summary>` map to
  // different accessibility roles in Chromium and WebKit, and this spec runs
  // in both.
  const notes = page.getByText('Uwagi do tej pozycji', { exact: false });
  await expect(notes).toBeVisible();
  /*
    Hidden, not absent. A closed `<details>` keeps its content in the DOM, so
    `toHaveCount(0)` fails here whatever the code does - which is how this
    assertion failed on the first run after the fix, reporting a defect that
    was mine. Visibility is the property that matters anyway: the note is
    there for anyone who opens it, and out of the way for everyone else.
  */
  await expect(page.getByText('To drewno naturalne', { exact: false })).toBeHidden();

  await notes.click();

  await expect(page.getByText('To drewno naturalne', { exact: false })).toBeVisible();
});
