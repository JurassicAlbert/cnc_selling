-- AlterTable
ALTER TABLE "MachineSettings" ADD COLUMN     "maxWorkpieceThicknessMm" INTEGER NOT NULL;

-- D7 resolved 2026-08-23: the machine's real Z-axis limit. Guarded the same
-- way as the other columns that decide what a customer is charged or told is
-- possible.
ALTER TABLE "MachineSettings"
  ADD CONSTRAINT "MachineSettings_thickness_positive" CHECK ("maxWorkpieceThicknessMm" > 0);
