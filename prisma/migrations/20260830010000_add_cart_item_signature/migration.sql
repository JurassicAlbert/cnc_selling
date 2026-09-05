-- docs/AUDIT-2026-08-30.md P1-4: adding the identical configuration twice
-- (a double-clicked "Dodaj do koszyka", a retried request) created two
-- identical cart rows the customer had to remove one at a time. Two
-- DIFFERENT configurations of one product stay two rows — that part was
-- always correct and is unchanged.
--
-- Backfilled from the row's own configuration id rather than a real
-- signature: every existing CartItem has its own Configuration (duplicating
-- a line deep-copies it), so this is unique by construction and satisfies
-- the index immediately. The `legacy:` prefix makes it obvious these are
-- not real signatures — they will simply never merge with a new addition,
-- which is the honest outcome for a row whose selections were never hashed.
ALTER TABLE "CartItem" ADD COLUMN "configurationSignature" TEXT;

UPDATE "CartItem" SET "configurationSignature" = 'legacy:' || "configurationId";

ALTER TABLE "CartItem" ALTER COLUMN "configurationSignature" SET NOT NULL;

CREATE UNIQUE INDEX "CartItem_cartId_configurationSignature_key"
  ON "CartItem"("cartId", "configurationSignature");
