-- `docs/REVIEW-DETAILED.md` BUG-03, the data half. Owner decision,
-- 2026-08-31: "we should not have pattern selection for now — its disabled
-- fields in the products — for now we will rather propose ready products or
-- show product with already existing pattern."
--
-- Pattern selection is switched off in the UI, but the configurator still
-- auto-selects a design, and that design goes into the cart, the immutable
-- `OrderItem.snapshot` and the printed production sheet. The one it picked
-- was `wzor-podstawowy` — literally named "Wzór podstawowy — do zastąpienia"
-- ("basic pattern — to be replaced"), and the only design whose artwork
-- still lives in `public/images/placeholders/` rather than
-- `public/images/patterns/`. Customers were being shown, and would have been
-- sold, a placeholder.
--
-- Deactivated rather than deleted: §16A.2's soft-delete invariant. Existing
-- orders keep their snapshot regardless, and any `Configuration` still
-- naming it stays resolvable — it simply stops being sellable, which
-- `priceAndValidateSelections` now enforces (SEC-03). The row continuing to
-- exist also preserves the "this was a placeholder" signal.

UPDATE "Design"
SET "isActive" = false,
    "updatedAt" = now()
WHERE "slug" = 'wzor-podstawowy';

-- Every design shipped with sortOrder 0, so "the first offered design" —
-- which is what the configurator takes as its default — was decided by
-- whatever order Postgres happened to return. Because
-- `machiningMilliMinutesPerM2` and `ProductDesign.surchargeGrosze` are
-- pricing inputs, that made the same visible configuration capable of
-- costing two different amounts on two page loads. Ordering by `code` gives
-- the existing catalogue a stable, human-meaningful sequence; staff can
-- reorder freely from /panel/wzory afterwards.
UPDATE "Design" d
SET "sortOrder" = ranked.position,
    "updatedAt" = now()
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "code") AS position
  FROM "Design"
) AS ranked
WHERE d."id" = ranked."id"
  AND d."sortOrder" = 0;
