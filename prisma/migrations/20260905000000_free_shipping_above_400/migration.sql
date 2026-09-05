-- Owner, 2026-09-05, answering BUG-08's second half: "free above 400 zl the
-- method is still decide by the size - like we can't use paczkomat for to big
-- package".
--
-- Data, not schema. The seed carries 40000 so a fresh database agrees, but the
-- seed is idempotent and leaves existing rows alone, so an already-seeded
-- database needs this.
--
-- Conditional on the old value rather than a blanket UPDATE. Three seeded
-- methods carried 50000 and two carried NULL (never free), and an admin may
-- since have set a figure of their own at /panel/dostawa - overwriting a
-- deliberate choice because it happens to be in the same column is how a data
-- migration does damage. Rows already at 40000 are left alone too, so this is
-- re-runnable.
--
-- The size half of the instruction needed no data change: DeliveryWeightTier
-- already carries per-tier dimension limits and evaluateDeliveryMethod already
-- refused an oversized parcel. What it did NOT do was check that before
-- applying the threshold, so a cart over the threshold was offered a locker
-- the parcel could not fit. Fixed in src/domain/checkout/delivery.ts in the
-- same change as this file - and lowering the threshold is what would have
-- made it fire on more carts.

UPDATE "DeliveryMethod"
SET "freeShippingThresholdGrosze" = 40000
WHERE "freeShippingThresholdGrosze" = 50000;
