import { describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
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
