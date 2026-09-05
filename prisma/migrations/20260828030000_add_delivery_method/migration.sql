-- CreateTable
CREATE TABLE "DeliveryMethod" (
    "id" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "descPl" TEXT NOT NULL,
    "priceGrosze" INTEGER NOT NULL,
    "freeShippingThresholdGrosze" INTEGER,
    "estimatedDaysMin" INTEGER NOT NULL,
    "estimatedDaysMax" INTEGER NOT NULL,
    "carrier" TEXT,
    "trackingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryMethod_isActive_sortOrder_idx" ON "DeliveryMethod"("isActive", "sortOrder");

-- AlterTable: existing orders predate DeliveryMethod, so backfill with an
-- honest generic label (the single flat-rate shipping every order used
-- before this migration) rather than inventing a specific method name for
-- history that never recorded one. New orders always set a real name.
ALTER TABLE "Order" ADD COLUMN "deliveryMethodId" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryMethodNamePl" TEXT NOT NULL DEFAULT 'Dostawa standardowa';
ALTER TABLE "Order" ALTER COLUMN "deliveryMethodNamePl" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryMethodId_fkey" FOREIGN KEY ("deliveryMethodId") REFERENCES "DeliveryMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
