-- AlterTable: Material gains a real density (needed to compute real item weight)
ALTER TABLE "Material" ADD COLUMN "densityKgPerM3" INTEGER;

-- Backfill real, sourced wood/gres density values by slug (see
-- prisma/seed.ts MATERIAL_SEEDS for the citation). Any material not
-- matched below (future rows) gets a conservative mid-range wood default
-- so the column can go NOT NULL safely.
UPDATE "Material" SET "densityKgPerM3" = 750 WHERE "slug" = 'dab';
UPDATE "Material" SET "densityKgPerM3" = 450 WHERE "slug" = 'swierk';
UPDATE "Material" SET "densityKgPerM3" = 600 WHERE "slug" = 'modrzew';
UPDATE "Material" SET "densityKgPerM3" = 480 WHERE "slug" = 'sosna';
UPDATE "Material" SET "densityKgPerM3" = 2400 WHERE "slug" = 'gres-bialy';
UPDATE "Material" SET "densityKgPerM3" = 600 WHERE "densityKgPerM3" IS NULL;

ALTER TABLE "Material" ALTER COLUMN "densityKgPerM3" SET NOT NULL;

-- AlterTable: Order.phone becomes required
UPDATE "Order" SET "phone" = '' WHERE "phone" IS NULL;
ALTER TABLE "Order" ALTER COLUMN "phone" SET NOT NULL;

-- AlterTable: Order gains courier-facing vs internal shipment notes
ALTER TABLE "Order" ADD COLUMN "courierNotePl" TEXT,
ADD COLUMN "internalShipmentNotePl" TEXT;

-- CreateTable: real, carrier-sourced weight-tier pricing
CREATE TABLE "DeliveryWeightTier" (
    "id" TEXT NOT NULL,
    "deliveryMethodId" TEXT NOT NULL,
    "labelPl" TEXT NOT NULL,
    "maxWeightGrams" INTEGER NOT NULL,
    "priceGrosze" INTEGER NOT NULL,
    "maxWidthMm" INTEGER,
    "maxHeightMm" INTEGER,
    "maxDepthMm" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryWeightTier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryWeightTier_deliveryMethodId_sortOrder_idx" ON "DeliveryWeightTier"("deliveryMethodId", "sortOrder");

ALTER TABLE "DeliveryWeightTier" ADD CONSTRAINT "DeliveryWeightTier_deliveryMethodId_fkey" FOREIGN KEY ("deliveryMethodId") REFERENCES "DeliveryMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
