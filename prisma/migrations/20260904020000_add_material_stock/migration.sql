-- A batch of physical boards actually held in the workshop. Owner request,
-- 2026-09-04: "save materials what we have on magazine".
--
-- This is the first place the shop records what it PAID for a material, as
-- opposed to what it charges for one (Material.pricePerM2Grosze, which drives
-- domain/pricing). The two together are what make a minimum viable price
-- computable; see src/domain/stock/board.ts.
--
-- One row is one batch of identically sized boards, not one board, because
-- that is how they are bought and how a delivery note reads.

CREATE TABLE "MaterialStock" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "thicknessMm" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "purchasePriceGrosze" INTEGER NOT NULL,
    "supplierNamePl" TEXT,
    "supplierUrl" TEXT,
    "notePl" TEXT,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialStock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaterialStock_materialId_idx" ON "MaterialStock"("materialId");
CREATE INDEX "MaterialStock_purchasedAt_idx" ON "MaterialStock"("purchasedAt");

ALTER TABLE "MaterialStock"
    ADD CONSTRAINT "MaterialStock_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The invariants the domain relies on, enforced where they cannot be bypassed
-- rather than trusted to the operations layer. A zero dimension would make
-- boardCostPerM2Grosze divide by zero; a negative quantity or price is not a
-- state the warehouse can be in.
ALTER TABLE "MaterialStock" ADD CONSTRAINT "MaterialStock_dimensions_positive"
    CHECK ("widthMm" > 0 AND "heightMm" > 0 AND "thicknessMm" > 0);
ALTER TABLE "MaterialStock" ADD CONSTRAINT "MaterialStock_quantity_non_negative"
    CHECK ("quantity" >= 0);
ALTER TABLE "MaterialStock" ADD CONSTRAINT "MaterialStock_price_non_negative"
    CHECK ("purchasePriceGrosze" >= 0);
