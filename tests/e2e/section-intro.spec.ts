import 'dotenv/config';

import { expect, test } from '@playwright/test';

/*
  Three of the five only render when there is data behind them - the blog
  section needs a published post, reviews need an approved one, the FAQ teaser
  needs an entry - and the test database has no approved review at all. So the
  two that always render are required, and the rest are checked **if present**.
  Asserting a section that legitimately is not there would be a test that
  fails for a reason that has nothing to do with the layout.
*/
const ALWAYS_PRESENT = ['Kategorie', 'Nasze produkty'];
const WHEN_THERE_IS_DATA = ['Z naszego bloga', 'Opinie klientów', 'Najczęściej zadawane pytania'];
const HOME_SECTIONS = [...ALWAYS_PRESENT, ...WHEN_THERE_IS_DATA];

/**
 * Owner feedback, 2026-09-11: "something seems missing in this layout - the
 * way the sections are presented/visible", pointing at the reference they
 * already chose, `template.getbazaar.io`.
 *
 * Reading that reference rather than guessing at it: on its landing page and
 * on `/furniture-2`, **every section is a heading followed immediately by a
 * one-sentence subtitle** - "New Arrivals", "Trending Items", "Testimonial",
 * all of them. Every one of ours was a bare `<h2>` and then content. That is
 * what was missing, and it is structural: a heading says what a block is
 * called, not what it is for.
 *
 * Asserted on **every** section rather than on one, because the value here is
 * consistency - one section with a lead and four without is the state this
 * change exists to leave behind.
 */
test('every section on the home page says what it is, not just what it is called', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#tresc')).toBeVisible();

  const leads = await page.evaluate((headings) => {
    return headings.map((wanted) => {
      const heading = [...document.querySelectorAll('main h2')].find((h) => h.textContent?.trim() === wanted);
      if (heading === undefined) return { heading: wanted, found: false, lead: null };
      // The lead is the paragraph inside the same header block as the
      // heading - not merely "the next text on the page", which would pass on
      // the first card's description.
      const lead = heading.parentElement?.querySelector('p')?.textContent?.trim() ?? null;
      return { heading: wanted, found: true, lead };
    });
  }, HOME_SECTIONS);

  for (const section of leads) {
    if (ALWAYS_PRESENT.includes(section.heading)) {
      expect(section.found, `${section.heading} is on the page`).toBe(true);
    }
    if (!section.found) continue;
    expect(section.lead, `${section.heading} has a lead`).not.toBeNull();
    expect((section.lead ?? '').length, `${section.heading}'s lead says something`).toBeGreaterThan(20);
  }

  // And at least one of the data-driven sections really was exercised, so this
  // cannot quietly degrade into a two-section test.
  expect(leads.filter((section) => section.found).length).toBeGreaterThan(ALWAYS_PRESENT.length);
});

test('the two sections that continue somewhere say so in their header, once', async ({ page }) => {
  await page.goto('/');

  /*
    These links already existed, at the bottom of their sections. They moved
    into the header with the heading they qualify - moved, not added: a second
    copy would break every `getByRole('link', { name })` in the suite on a
    strict-mode violation, which is exactly what `toHaveCount(1)` pins here.
  */
  await expect(page.getByRole('link', { name: 'Zobacz wszystkie posty' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Zobacz wszystkie pytania' })).toHaveCount(1);
});

/**
 * The FAQ page was a heading and nine identical accordion bars - nothing
 * saying what it covered, and a dead end for anyone whose question was not on
 * the list. The accordion itself was fine; what it lacked was a way in and a
 * way out.
 */
test('the FAQ page introduces itself and offers a way out', async ({ page }) => {
  await page.goto('/faq');

  const lead = page.getByRole('main').locator('p').first();
  await expect(lead).toBeVisible();
  expect((await lead.innerText()).length).toBeGreaterThan(20);

  // Somewhere to go when the answer is not here.
  const contact = page.getByRole('link', { name: 'Przejdź do kontaktu' });
  await expect(contact).toBeVisible();
  await contact.click();
  await expect(page).toHaveURL('/kontakt');
});
