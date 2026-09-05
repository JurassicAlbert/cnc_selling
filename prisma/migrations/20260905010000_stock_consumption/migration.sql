-- WAREHOUSE-01: consume stock when an order enters production.
--
-- Owner decisions, 2026-09-05: oldest batch first, and consumption measured
-- by area rather than by whole boards. The second is why this adds a column
-- instead of just decrementing MaterialStock.quantity - one 2000x1250 board
-- yields 240 coasters at 100x100, so a board per order item would be wrong by
-- a factor of 240 within days. quantity keeps meaning "boards bought"; the new
-- column records how much of them has been cut.

ALTER TABLE "MaterialStock" ADD COLUMN "consumedAreaMm2" INTEGER NOT NULL DEFAULT 0;

-- The operational pointer from a sold line back to the live catalogue
-- material. Nullable on purpose: every order placed before today has no link,
-- and a CUSTOM_UPLOAD line need not name a catalogue material at all.
-- ON DELETE SET NULL rather than RESTRICT - retiring a material must not be
-- blocked by an order from two years ago, and the snapshot is what makes that
-- order still readable.
ALTER TABLE "OrderItem" ADD COLUMN "materialId" TEXT;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OrderItem_materialId_idx" ON "OrderItem"("materialId");

-- The audit trail behind consumedAreaMm2: the running total is what the
-- warehouse screen reads, and these rows are what it is made of.
CREATE TABLE "StockConsumption" (
  "id"              TEXT NOT NULL,
  "orderId"         TEXT NOT NULL,
  "orderItemId"     TEXT NOT NULL,
  "materialStockId" TEXT NOT NULL,
  "areaMm2"         INTEGER NOT NULL,
  "costGrosze"      INTEGER NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockConsumption_pkey" PRIMARY KEY ("id"),
  -- Neither is a quantity that can sensibly be negative, and a CHECK is the
  -- only version of that rule a crafted request cannot get around.
  CONSTRAINT "StockConsumption_areaMm2_check" CHECK ("areaMm2" > 0),
  CONSTRAINT "StockConsumption_costGrosze_check" CHECK ("costGrosze" >= 0)
);

-- An item draws from a given batch at most once per plan, so this doubles as
-- the guard against a repeated transition consuming the shelf twice.
CREATE UNIQUE INDEX "StockConsumption_orderItemId_materialStockId_key"
  ON "StockConsumption"("orderItemId", "materialStockId");
CREATE INDEX "StockConsumption_orderId_idx" ON "StockConsumption"("orderId");
CREATE INDEX "StockConsumption_materialStockId_idx" ON "StockConsumption"("materialStockId");

ALTER TABLE "StockConsumption" ADD CONSTRAINT "StockConsumption_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockConsumption" ADD CONSTRAINT "StockConsumption_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- RESTRICT, unlike the two above: deleting a batch that an order has already
-- drawn from would erase the evidence behind that order's recorded cost.
-- /panel/magazyn's delete is for correcting a mistyped delivery, and a batch
-- something was cut from is no longer that.
ALTER TABLE "StockConsumption" ADD CONSTRAINT "StockConsumption_materialStockId_fkey"
  FOREIGN KEY ("materialStockId") REFERENCES "MaterialStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
