-- Package insurance the customer can select - docs/OPEN_ITEMS.md 10.
--
-- Owner request, 2026-09-05, answering BUG-08. Asked how it should be priced
-- (a flat fee, a percentage of order value, or the carrier's real
-- declared-value table) the owner chose the carrier's real table.
--
-- So this creates the mechanism and deliberately seeds no rates. Neither
-- InPost nor DPD publishes a citable declared-value table, the same wall
-- Kurier GEIS hit for its weight tiers, and the owner's own instruction is
-- that "you are not allowed to lie". A method with no bands offers no
-- insurance and shows no checkbox, so no customer is quoted a price nobody
-- published. Entering the real bands at /panel/dostawa turns it on; nothing
-- in checkout or order creation changes.

CREATE TABLE "DeliveryInsuranceTier" (
  "id"               TEXT NOT NULL,
  "deliveryMethodId" TEXT NOT NULL,
  "labelPl"          TEXT NOT NULL,
  "maxValueGrosze"   INTEGER NOT NULL,
  "priceGrosze"      INTEGER NOT NULL,
  "sortOrder"        INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "DeliveryInsuranceTier_pkey" PRIMARY KEY ("id"),
  -- A band covering nothing, or one that pays the shop to insure, is not a
  -- rate card entry - and a CHECK is the only version of that rule a crafted
  -- request cannot get around.
  CONSTRAINT "DeliveryInsuranceTier_maxValueGrosze_check" CHECK ("maxValueGrosze" > 0),
  CONSTRAINT "DeliveryInsuranceTier_priceGrosze_check" CHECK ("priceGrosze" >= 0)
);

CREATE INDEX "DeliveryInsuranceTier_deliveryMethodId_sortOrder_idx"
  ON "DeliveryInsuranceTier"("deliveryMethodId", "sortOrder");

ALTER TABLE "DeliveryInsuranceTier" ADD CONSTRAINT "DeliveryInsuranceTier_deliveryMethodId_fkey"
  FOREIGN KEY ("deliveryMethodId") REFERENCES "DeliveryMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Snapshotted on the order like deliveryMethodNamePl and shippingGrosze
-- beside it: a band renamed or repriced later must not change what an old
-- order says it bought. Zero and NULL on every existing order, which is the
-- truth - none of them were offered insurance.
ALTER TABLE "Order" ADD COLUMN "insuranceGrosze" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "insuranceLabelPl" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_insuranceGrosze_check" CHECK ("insuranceGrosze" >= 0);
