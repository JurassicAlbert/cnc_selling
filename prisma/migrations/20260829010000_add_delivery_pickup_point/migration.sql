-- AlterTable
ALTER TABLE "DeliveryMethod" ADD COLUMN     "requiresPickupPoint" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupPointId" TEXT,
ADD COLUMN     "pickupPointLabel" TEXT;
