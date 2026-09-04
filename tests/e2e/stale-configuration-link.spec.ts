import 'dotenv/config';

import { expect, test } from '@playwright/test';

import { prisma } from '../../src/server/db/client';

/**
 * UX-21, the last visible edge of SEC-03.
 *
 * SEC-03 made the write path refuse a configuration naming a pattern the shop
 * has retired. It did not stop the configurator pricing that configuration
 * first, so the customer met a real figure, pressed the button, and only then
 * learned they could not buy it. That is the same "showing a price you will
 * not honour" shape BUG-02 existed to remove, one screen along.
 *
 * The scenario is not hypothetical, and it needs nothing staged: the shop
 * really has retired a pattern. `wzor-podstawowy` was deactivated by BUG-03
 * and is still attached to this product, so a link that names it is exactly
 * the link a customer would still be holding - a bookmark, a shared URL, or a
 * saved project from before the change. `readSelectionsFromSearch` restores
 * it verbatim, which is the whole point of section 36's resumable
 * configuration.
 *
 * Only a browser can prove the rest. The rule is unit-tested
 * (`unavailable-selection.test.ts`) and the refusal is integration-tested
 * (`selection-availability.test.ts`); what neither can reach is whether the
 * page a customer actually sees withholds the price - on **both** surfaces
 * that show one - and refuses the button.
 *
 * Deliberately read-only: no row is created, retired or restored. Specs run
 * in parallel against one shared database, and a spec that retires a
 * catalogue row mid-run changes what every other spec's picker contains.
 */

const PRODUCT_SLUG = 'obraz-drewniany-z-grawerem';
const RETIRED_DESIGN_SLUG = 'wzor-podstawowy';

test('a link naming a retired pattern shows no price and cannot be added to the cart', async ({ page }) => {
  const product = await prisma.product.findUniqueOrThrow({
    where: { slug: PRODUCT_SLUG },
    select: {
      designs: {
        select: { designId: true, design: { select: { slug: true, isActive: true } } },
        // Prisma guarantees no row order without this, and the first run of
        // this spec picked a different "first active design" per worker.
        orderBy: { design: { sortOrder: 'asc' } },
      },
    },
  });

  const retired = product.designs.find((d) => d.design.slug === RETIRED_DESIGN_SLUG && !d.design.isActive);
  const offered = product.designs.find((d) => d.design.isActive);

  // Skipped rather than failed if the catalogue no longer looks like this:
  // re-activating `wzor-podstawowy` would be a deliberate business decision
  // (BUG-03 reversed), not a regression in the behaviour under test.
  test.skip(
    retired === undefined || offered === undefined,
    'this product no longer offers both a retired and an active design',
  );

  // Only the pattern varies. Material, size and finish are left to the
  // configurator's own defaults on purpose - naming a size here once pinned
  // the smallest preset, which `prisma/seed.ts` documents as genuinely
  // infeasible for some designs, and the control leg then failed for a
  // reason that had nothing to do with availability.
  const link = (designId: string) => `/produkt/${PRODUCT_SLUG}?d=${designId}`;
  const addToCart = page.getByRole('button', { name: 'Dodaj do koszyka' });

  // The control. The same link, differing only in which pattern it names,
  // must price and be orderable - otherwise the assertions below would pass
  // against a configurator that is simply broken.
  //
  // Enabled-first, then the price: the button starts absent and the price
  // starts absent, so waiting on the button is waiting for the island to
  // hydrate and its first snapshot to arrive, after which the price is
  // already on the page.
  await page.goto(link(offered?.designId ?? ''));
  await expect(addToCart).toBeEnabled();
  await expect(page.getByText(/^Cena: /)).toBeVisible();

  // The configurator writes its resolved selections back into the URL with
  // `router.replace` once its first snapshot lands, and that rewrite raced
  // the navigation below - WebKit failed the run with "interrupted by
  // another navigation". The link carries only `d=`, so the appearance of a
  // finish is proof the rewrite has already happened rather than a guess
  // that it has had time to.
  await page.waitForURL(/[?&]f=/, { timeout: 15_000 });

  await page.goto(link(retired?.designId ?? ''));

  // The alert comes first for the same reason, in reverse: "no price" and a
  // missing button are both true of the un-hydrated page, so asserting them
  // first would pass without proving anything. The alert only ever appears
  // once the snapshot has been resolved.
  await expect(page.getByText('Wybrany wzór, materiał lub wykończenie', { exact: false })).toBeVisible();
  await expect(addToCart).toBeDisabled();

  // Both price surfaces, not just the summary panel. The summary's figure is
  // gone entirely rather than struck through or greyed: it is real arithmetic
  // for a configuration the shop will not sell, and showing it in any styling
  // is the thing BUG-02 was about. The sticky bar - fixed to the bottom of
  // every screen, so the more prominent of the two on a phone - says why
  // rather than quietly going blank.
  await expect(page.getByText(/^Cena: /)).toHaveCount(0);
  await expect(page.getByText('Wariant niedostępny')).toBeVisible();
});
