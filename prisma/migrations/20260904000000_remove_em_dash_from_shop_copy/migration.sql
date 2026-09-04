-- Replace the em-dash in shop-authored Polish copy that lives in the
-- database rather than in the repository.
--
-- The owner asked on 2026-09-04 that the character never appear anywhere.
-- Editing src/content/pl and prisma/seed.ts covers the copy that ships in the
-- code, but most customer-visible text is DB rows written by an earlier seed
-- run, and the seed is idempotent: it leaves existing rows alone. Without
-- this migration a fresh database would be clean and every existing one would
-- not, which is the sort of divergence nobody notices until a customer sees
-- it.
--
-- Deliberately excluded, and this is the important part: every column holding
-- text a CUSTOMER or a staff member wrote rather than shop copy. Rewriting
-- someone's own words is not a formatting fix.
--   CustomerDesign.titlePl, CustomerDesign.ipDeclarationTextPl
--   DesignReviewComment.bodyPl
--   Order.courierNotePl, Order.internalShipmentNotePl,
--     Order.deliveryMethodNamePl, Order.withdrawalExemptionTextPl
--     (the last two are order SNAPSHOTS, immutable by design - ARCHITECTURE
--      §6.8 - and must not be edited even to fix punctuation)
--   OrderEvent.notePl, PricingSettings.notePl
--   Review.authorNamePl, Review.bodyPl
--   Shipment.customerNotesPl, Shipment.internalNotesPl,
--     Shipment.issueDescriptionPl, Shipment.issueResolutionPl
--   SupportRequest.messagePl, SupportRequest.namePl, SupportRequest.subjectPl,
--     SupportRequest.adminNotesPl
--
-- Idempotent: the WHERE clause means re-running touches nothing.

UPDATE "BlogPost" SET
  "bodyPl" = replace("bodyPl", '—', '-'),
  "seoDescPl" = replace("seoDescPl", '—', '-'),
  "seoTitlePl" = replace("seoTitlePl", '—', '-'),
  "shortDescPl" = replace("shortDescPl", '—', '-'),
  "titlePl" = replace("titlePl", '—', '-')
WHERE "bodyPl" LIKE '%—%' OR "seoDescPl" LIKE '%—%' OR "seoTitlePl" LIKE '%—%' OR "shortDescPl" LIKE '%—%' OR "titlePl" LIKE '%—%';

UPDATE "Category" SET
  "descPl" = replace("descPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-'),
  "seoDescPl" = replace("seoDescPl", '—', '-'),
  "seoTitlePl" = replace("seoTitlePl", '—', '-')
WHERE "descPl" LIKE '%—%' OR "namePl" LIKE '%—%' OR "seoDescPl" LIKE '%—%' OR "seoTitlePl" LIKE '%—%';

UPDATE "DeliveryMethod" SET
  "descPl" = replace("descPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-')
WHERE "descPl" LIKE '%—%' OR "namePl" LIKE '%—%';

UPDATE "DeliveryWeightTier" SET
  "labelPl" = replace("labelPl", '—', '-')
WHERE "labelPl" LIKE '%—%';

UPDATE "Design" SET
  "descPl" = replace("descPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-')
WHERE "descPl" LIKE '%—%' OR "namePl" LIKE '%—%';

UPDATE "DesignCollection" SET
  "descPl" = replace("descPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-')
WHERE "descPl" LIKE '%—%' OR "namePl" LIKE '%—%';

UPDATE "EmailTemplate" SET
  "bodyPl" = replace("bodyPl", '—', '-'),
  "subjectPl" = replace("subjectPl", '—', '-')
WHERE "bodyPl" LIKE '%—%' OR "subjectPl" LIKE '%—%';

UPDATE "ExternalPatternResource" SET
  "descPl" = replace("descPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-')
WHERE "descPl" LIKE '%—%' OR "namePl" LIKE '%—%';

UPDATE "Faq" SET
  "answerPl" = replace("answerPl", '—', '-'),
  "questionPl" = replace("questionPl", '—', '-')
WHERE "answerPl" LIKE '%—%' OR "questionPl" LIKE '%—%';

UPDATE "Finish" SET
  "descPl" = replace("descPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-')
WHERE "descPl" LIKE '%—%' OR "namePl" LIKE '%—%';

UPDATE "Font" SET
  "namePl" = replace("namePl", '—', '-')
WHERE "namePl" LIKE '%—%';

UPDATE "InstallationVariant" SET
  "descPl" = replace("descPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-'),
  "receivesPl" = replace("receivesPl", '—', '-')
WHERE "descPl" LIKE '%—%' OR "namePl" LIKE '%—%' OR "receivesPl" LIKE '%—%';

UPDATE "Material" SET
  "characteristicsPl" = replace("characteristicsPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-'),
  "shortDescPl" = replace("shortDescPl", '—', '-')
WHERE "characteristicsPl" LIKE '%—%' OR "namePl" LIKE '%—%' OR "shortDescPl" LIKE '%—%';

UPDATE "PaymentMethodConfig" SET
  "descPl" = replace("descPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-')
WHERE "descPl" LIKE '%—%' OR "namePl" LIKE '%—%';

UPDATE "Product" SET
  "careInstructionsPl" = replace("careInstructionsPl", '—', '-'),
  "installationInfoPl" = replace("installationInfoPl", '—', '-'),
  "longDescPl" = replace("longDescPl", '—', '-'),
  "materialNotesPl" = replace("materialNotesPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-'),
  "seoDescPl" = replace("seoDescPl", '—', '-'),
  "seoTitlePl" = replace("seoTitlePl", '—', '-'),
  "shortDescPl" = replace("shortDescPl", '—', '-')
WHERE "careInstructionsPl" LIKE '%—%' OR "installationInfoPl" LIKE '%—%' OR "longDescPl" LIKE '%—%' OR "materialNotesPl" LIKE '%—%' OR "namePl" LIKE '%—%' OR "seoDescPl" LIKE '%—%' OR "seoTitlePl" LIKE '%—%' OR "shortDescPl" LIKE '%—%';

UPDATE "ProductCollection" SET
  "descPl" = replace("descPl", '—', '-'),
  "namePl" = replace("namePl", '—', '-')
WHERE "descPl" LIKE '%—%' OR "namePl" LIKE '%—%';

UPDATE "ProductImage" SET
  "altPl" = replace("altPl", '—', '-')
WHERE "altPl" LIKE '%—%';

UPDATE "ProductPresetSize" SET
  "labelPl" = replace("labelPl", '—', '-')
WHERE "labelPl" LIKE '%—%';

UPDATE "ProductThickness" SET
  "labelPl" = replace("labelPl", '—', '-')
WHERE "labelPl" LIKE '%—%';

UPDATE "StaticPage" SET
  "bodyPl" = replace("bodyPl", '—', '-'),
  "seoDescPl" = replace("seoDescPl", '—', '-'),
  "seoTitlePl" = replace("seoTitlePl", '—', '-'),
  "titlePl" = replace("titlePl", '—', '-')
WHERE "bodyPl" LIKE '%—%' OR "seoDescPl" LIKE '%—%' OR "seoTitlePl" LIKE '%—%' OR "titlePl" LIKE '%—%';

UPDATE "StoreSettings" SET
  "bankAccountHolderPl" = replace("bankAccountHolderPl", '—', '-')
WHERE "bankAccountHolderPl" LIKE '%—%';
