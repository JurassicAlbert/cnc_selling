-- BUG-15. Keep a replaced design file as review history, and stop the
-- customer's old link working.
--
-- Owner decision, 2026-09-05: keep the file and show it in the review history,
-- over deleting it on re-upload. Being able to see every version the customer
-- sent is what settles a "but I sent the right one" dispute. The loose end
-- that leaves - the old link staying live for a file the customer thinks is
-- gone - was put to the owner separately: staff keep access, the customer
-- loses it, and there is deliberately no expiry.
--
-- Before this, a re-upload simply moved CustomerDesign.fileId to the new row
-- and left the old one pointing at nothing: on disk forever, invisible to
-- staff, still fetchable by its owner.
--
-- Two columns rather than one relation. `supersededAt` is what the file route
-- checks on every fetch and wants to be a plain column read; the foreign key
-- is what the review screen lists. Existing rows get NULL, which is correct:
-- nothing has been superseded before now.
--
-- ON DELETE SET NULL, not CASCADE: deleting a design must not take the
-- evidence of its own history with it. The file row survives as an ordinary
-- orphan, which is what it was before this migration anyway.

ALTER TABLE "UploadedFile" ADD COLUMN "supersededAt" TIMESTAMP(3);
ALTER TABLE "UploadedFile" ADD COLUMN "supersededForDesignId" TEXT;

CREATE INDEX "UploadedFile_supersededForDesignId_idx"
  ON "UploadedFile"("supersededForDesignId");

ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_supersededForDesignId_fkey"
  FOREIGN KEY ("supersededForDesignId") REFERENCES "CustomerDesign"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
