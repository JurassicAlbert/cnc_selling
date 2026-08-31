-- `docs/REVIEW-DETAILED.md` BUG-02.
--
-- The catalogue advertised `Product.minPriceGrosze` as "od X zł". That
-- column is the NET clamp inside `calculatePrice`, while every other price
-- on the site is gross — and for several seeded products it was also below
-- anything that could actually be built (the wall art advertised 150,00
-- against a real cheapest of ≈190,40 gross; the chessboard 150,00 against
-- ≈220,85). The same figure was emitted as the Schema.org `Offer.price`.
--
-- Owner, 2026-08-31: "we should show the brutto - gross price and the price
-- should depend on what user pick."
--
-- Nullable with no default and no backfill here on purpose: the value is
-- the result of running the real pricing engine over a product's whole
-- option graph, which SQL cannot do. `refreshAllStartingPrices()`
-- (`src/server/pricing/starting-price.ts`) populates it, `prisma/seed.ts`
-- calls that at the end of a seed, and NULL renders as no price rather than
-- as zero — an honest gap instead of a wrong number.

ALTER TABLE "Product" ADD COLUMN "startingPriceGrossGrosze" INTEGER;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_startingPriceGrossGrosze_positive"
  CHECK ("startingPriceGrossGrosze" IS NULL OR "startingPriceGrossGrosze" > 0);
