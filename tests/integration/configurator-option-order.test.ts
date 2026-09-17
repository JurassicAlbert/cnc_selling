import { describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { getProductBySlugForPreview } from '@/server/repositories/products';
import { readsActivePricing } from './pricing-fixture';

/*
  Prices things through `getConfiguratorProductData`, so it takes the shared
  pricing lock like every other reader (T-32).
*/
readsActivePricing();

/**
 * `docs/AI-CHECKLIST.md` BUG-32, and it is BUG-03's mechanism again.
 *
 * BUG-03 established the rule: without an `ORDER BY`, Postgres makes no
 * promise about row order, and the configurator takes `[0]` as its default -
 * so an unordered list means the default option, and therefore the price, can
 * differ between two loads of the same page, surfacing later as an
 * unexplained `PRICE_CHANGED` at checkout. That was fixed for materials and
 * designs, both of which now order by `(sortOrder, tie-break)`.
 *
 * **The finishes were missed.** Their select carried no `orderBy` at all, and
 * every seeded `Finish` has `sortOrder: 0`, so there was nothing making the
 * order stable even in principle. A different default finish is a different
 * `setupFeeGrosze` and `pricePerM2Grosze` - this moves money.
 *
 * Asserted as **"the order is the one the data asks for"** rather than by
 * calling twice and comparing. Two calls agreeing proves nothing: Postgres
 * will happily return a small table in the same order all day and then change
 * its mind after a vacuum, an index, or a row update. Comparing against the
 * total order `(sortOrder, slug)` is a statement about what the query
 * promises.
 *
 * **This is a guard, not a red test, and it is worth saying so.** It passed
 * before the `orderBy` was added, because the rows happen to come back in an
 * order that matches today - which is precisely the reason the missing clause
 * survived review in the first place, and precisely why "it works when I try
 * it" is not evidence here. What the test buys is the next time: drop the
 * clause and the day the physical order shifts, this says so instead of a
 * customer seeing a price move.
 */
const PRICEABLE_PRODUCT_SLUG = 'obraz-drewniany-z-grawerem';

describe('configurator option order', () => {
  it('offers finishes in a total order, not whatever the database returns', async () => {
    const data = await getConfiguratorProductData(PRICEABLE_PRODUCT_SLUG);
    expect(data).not.toBeNull();
    if (data === null) return;

    const offered = [...data.finishesById.keys()];
    expect(offered.length).toBeGreaterThan(0);

    const expectedOrder = await prisma.finish.findMany({
      where: { id: { in: offered } },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      select: { id: true },
    });

    expect(offered).toEqual(expectedOrder.map((finish) => finish.id));
  });
});

/**
 * **Owner decision, 2026-09-13: „Cheapest first."**
 *
 * BUG-32 left this explicitly open: it made the order *stable*, and said so -
 * „whether it is the order the owner wants them shown in is a content
 * decision". All six materials and all four finishes still share
 * `sortOrder: 0`, so every one of them fell through to the alphabetical
 * tie-break. Alphabetical was never chosen by anybody; it is just what a
 * total order needed as its last term.
 *
 * **`sortOrder` still comes first**, and that matters: it is the column staff
 * actually edit at `/panel/materialy` and `/panel/wykonczenia`, so an
 * explicit choice still wins. What changed is only the accident underneath
 * it. `slug` stays as the final term, because price is not a total order
 * either - two materials can cost the same, and Postgres promises nothing
 * about ties.
 *
 * **This moves the default selection, which is the point rather than a side
 * effect.** `computeDefaultSelections` takes the first *selectable* option,
 * so the configurator now opens on the cheapest material and the cheapest
 * finish. The advertised „od X zł" is already the cheapest combination -
 * `starting-price.ts` searches for it exhaustively - so the configurator now
 * opens on the same *material* that price was quoted from, instead of on
 * whichever one happened to sort first.
 *
 * **Not the same number, and worth being exact about it.** The default size
 * is still the median preset, deliberately, so the opening price stays well
 * above the „od" figure: verified in a browser at „od 190,40 zł" against
 * 648,89 zł at 70×70 cm. What closes is the part that read as a
 * contradiction - a card quoting the cheapest wood and a configurator
 * opening on the dearest one.
 *
 * **One honest limit, stated rather than papered over.** A finish costs
 * `setupFeeGrosze + pricePerM2Grosze × area`, so „cheapest" depends on the
 * piece. Prisma cannot order by that sum, and there is no area to compute it
 * against at the moment the list is built. Per-m² leads because it is the
 * term that dominates at every size the catalogue actually sells, with the
 * setup fee as the tie-break; every seeded finish has a setup fee of 0 today,
 * so nothing is being approximated yet. If a finish ever arrives with a large
 * setup fee and a low rate, this ordering will be wrong for small pieces and
 * the fix is a `sortOrder` on that row, which is exactly what the column is
 * for.
 */
const MULTI_FINISH_PRODUCT_SLUG = 'szachownica-z-grawerem';

describe('cheapest first', () => {
  it('offers materials cheapest first, under whatever staff set as sortOrder', async () => {
    const data = await getConfiguratorProductData(PRICEABLE_PRODUCT_SLUG);
    expect(data).not.toBeNull();
    if (data === null) return;

    const offered = data.options.materials.map((material) => material.id);
    expect(offered.length).toBeGreaterThan(1);

    const expectedOrder = await prisma.material.findMany({
      where: { id: { in: offered } },
      orderBy: [{ sortOrder: 'asc' }, { pricePerM2Grosze: 'asc' }, { slug: 'asc' }],
      select: { id: true },
    });

    expect(offered).toEqual(expectedOrder.map((material) => material.id));
  });

  it('offers finishes cheapest first too', async () => {
    /*
      A different product, and finding out why is worth recording: BUG-32's
      own finish guard runs against `obraz-drewniany-z-grawerem`, which
      **excludes two of the three finishes**, so it has been asserting the
      order of a one-element list ever since it was written. It is not wrong,
      it just cannot fail. `szachownica-z-grawerem` is active, is WALL_ART so
      it genuinely has a FINISH step, and excludes nothing - three rows, which
      is the smallest number that can tell two orderings apart.
    */
    const data = await getConfiguratorProductData(MULTI_FINISH_PRODUCT_SLUG);
    expect(data).not.toBeNull();
    if (data === null) return;

    const offered = [...data.finishesById.keys()];
    expect(offered.length).toBeGreaterThan(1);

    const expectedOrder = await prisma.finish.findMany({
      where: { id: { in: offered } },
      orderBy: [
        { sortOrder: 'asc' },
        { pricePerM2Grosze: 'asc' },
        { setupFeeGrosze: 'asc' },
        { slug: 'asc' },
      ],
      select: { id: true },
    });

    expect(offered).toEqual(expectedOrder.map((finish) => finish.id));
  });

  it('really is a different order from the alphabetical one it replaced', async () => {
    /*
      Without this the two tests above would keep passing if somebody restored
      the alphabetical tie-break on a catalogue where the two happen to agree
      - the same "it works when I try it" trap BUG-32's own guard was written
      to avoid. On the seeded catalogue they genuinely disagree: cheapest puts
      Sosna at 80 zł/m² first, alphabetical puts Dąb at 180 zł/m² first.
    */
    const data = await getConfiguratorProductData(PRICEABLE_PRODUCT_SLUG);
    expect(data).not.toBeNull();
    if (data === null) return;

    const offered = data.options.materials.map((material) => material.id);
    const alphabetical = await prisma.material.findMany({
      where: { id: { in: offered } },
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
      select: { id: true },
    });

    expect(offered).not.toEqual(alphabetical.map((material) => material.id));
  });

  it('opens the configurator on the cheapest material there is', async () => {
    // The consequence a customer actually sees, asserted as a price rather
    // than as a position: `computeDefaultSelections` takes the first
    // selectable option, so "first" and "default" are the same decision.
    const data = await getConfiguratorProductData(PRICEABLE_PRODUCT_SLUG);
    expect(data).not.toBeNull();
    if (data === null) return;

    const prices = await prisma.material.findMany({
      where: { id: { in: data.options.materials.map((material) => material.id) } },
      select: { id: true, pricePerM2Grosze: true },
    });
    const byId = new Map(prices.map((row) => [row.id, row.pricePerM2Grosze]));
    const firstOffered = data.options.materials[0];
    expect(firstOffered).toBeDefined();

    const cheapest = Math.min(...prices.map((row) => row.pricePerM2Grosze));
    expect(byId.get(firstOffered?.id ?? '')).toBe(cheapest);
  });
});

/**
 * The same ordering question, one layer out, and it was a genuine hole.
 *
 * `src/server/repositories/products.ts` lists a product's materials in three
 * places - the category listing, the "all products" listing and the product
 * detail - and **not one of them carried an `orderBy`**. That is BUG-03's
 * rule again: Postgres promises nothing about the order of an unordered
 * select.
 *
 * It does not move money the way the configurator's list does, which is
 * presumably why it survived. It is still customer-visible: the product page
 * joins these names into one line („Dąb, Świerk, Modrzew, Sosna"), and
 * `summariseMaterials` takes `materials[0]` for the name it shows when a
 * product offers exactly one - so for those products the name on the card
 * came out of a list with no defined order at all.
 *
 * Found on 2026-09-13 by looking at the product page in a browser after
 * changing the configurator: the picker said „Sosna, Świerk, Modrzew, Dąb"
 * and the chip above it said „Dąb, Świerk, Modrzew, Sosna". Two lists of the
 * same four materials, in different orders, six centimetres apart.
 */
describe('the product page lists materials in the same order the configurator offers them', () => {
  it('orders a product detail page cheapest first', async () => {
    const product = await getProductBySlugForPreview(PRICEABLE_PRODUCT_SLUG);
    expect(product).not.toBeNull();
    if (product === null) return;

    const names = product.materials.map((material) => material.namePl);
    expect(names.length).toBeGreaterThan(1);

    /*
      Asserted as **non-decreasing**, not against a re-queried list, and the
      first draft did it the other way and was racy. `ProductDetail.materials`
      carries only `namePl` and `family`, so re-deriving the expected order
      means matching on name - and `starting-price.test.ts` attaches its own
      „Materiał testowy ceny" to this very product while this file is running,
      so the two queries can legitimately see different sets a moment apart.
      Monotonicity is the property the ordering actually promises, and it is
      true of whatever set happens to be attached.
    */
    const priced = await prisma.material.findMany({
      where: { namePl: { in: names } },
      select: { namePl: true, sortOrder: true, pricePerM2Grosze: true },
    });
    const byName = new Map(priced.map((row) => [row.namePl, row]));
    const keys = names.map((name) => byName.get(name)).filter((row) => row !== undefined);
    expect(keys.length).toBe(names.length);

    for (let i = 1; i < keys.length; i += 1) {
      const previous = keys[i - 1];
      const current = keys[i];
      if (previous === undefined || current === undefined) continue;
      const inOrder =
        previous.sortOrder < current.sortOrder ||
        (previous.sortOrder === current.sortOrder && previous.pricePerM2Grosze <= current.pricePerM2Grosze);
      expect(
        inOrder,
        `${previous.namePl} (sort ${previous.sortOrder}, ${previous.pricePerM2Grosze}) came before ${current.namePl} (sort ${current.sortOrder}, ${current.pricePerM2Grosze})`,
      ).toBe(true);
    }
  });

  it('agrees with the configurator, which is the point', async () => {
    // The defect, stated as the contradiction a customer could see rather
    // than as a missing clause: two lists of the same materials, on one page.
    const [product, configurator] = await Promise.all([
      getProductBySlugForPreview(PRICEABLE_PRODUCT_SLUG),
      getConfiguratorProductData(PRICEABLE_PRODUCT_SLUG),
    ]);
    expect(product).not.toBeNull();
    expect(configurator).not.toBeNull();
    if (product === null || configurator === null) return;

    expect(product.materials.map((material) => material.namePl)).toEqual(
      configurator.options.materials.map((material) => material.namePl),
    );
  });
});
