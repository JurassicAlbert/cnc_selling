-- CreateEnum
CREATE TYPE "JoineryTechniqueCode" AS ENUM ('YATO_YANE_SPLINE');

-- AlterTable
-- Additive only: every new column is defaulted or nullable, so every
-- existing Product row (and every existing query) is unaffected.
ALTER TABLE "Product"
  ADD COLUMN "supportsPanelJoinery" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "joineryTechniqueCode" "JoineryTechniqueCode",
  ADD COLUMN "joinedMaxWidthMm" INTEGER,
  ADD COLUMN "joinedMaxHeightMm" INTEGER;
