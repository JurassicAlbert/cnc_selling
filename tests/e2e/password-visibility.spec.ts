import 'dotenv/config';

import { expect, test } from '@playwright/test';

/**
 * `docs/AI-CHECKLIST.md` RWD-03 - no way to see the password you are typing.
 *
 * The owner's reference puts an eye toggle inside the field on both sign-in
 * and registration. On a phone, with a small keyboard and autocorrect in the
 * way, typing a password blind is where people give up and reset it instead -
 * and a reset costs us an email and them a detour.
 *
 * Asserted on the input's `type`, because that is the property that actually
 * decides whether the characters are readable. An icon that changes and a
 * field that does not would pass any test written against the icon.
 *
 * Phone width, where it matters most, though the control is there at every
 * size - there is no reason to withhold it from a desktop.
 */

test.use({ viewport: { width: 375, height: 812 } });

const FORMS: ReadonlyArray<readonly [string, string]> = [
  ['/logowanie', 'sign-in'],
  ['/rejestracja', 'registration'],
];

for (const [path, what] of FORMS) {
  test(`the ${what} password can be revealed and hidden again`, async ({ page }) => {
    await page.goto(path);

    const password = page.locator('input[name="password"]');
    await expect(password).toBeVisible();
    await password.fill('tajne-haslo-123');

    // Hidden to start with. A field that starts revealed would be a different
    // and worse bug than the one being fixed.
    await expect(password).toHaveAttribute('type', 'password');

    const reveal = page.getByRole('button', { name: 'Pokaż hasło' });
    await expect(reveal).toBeVisible();
    await reveal.click();

    await expect(password).toHaveAttribute('type', 'text');
    // What the customer typed survives the toggle - a control that revealed
    // an empty field would be worse than none.
    await expect(password).toHaveValue('tajne-haslo-123');

    // And back, with the name changing to say what the button now does.
    const hide = page.getByRole('button', { name: 'Ukryj hasło' });
    await expect(hide).toBeVisible();
    await hide.click();
    await expect(password).toHaveAttribute('type', 'password');
  });
}
