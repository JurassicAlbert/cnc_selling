-- The pre-publish price simulation becomes a fact in the database rather than
-- a state in one React component - `docs/AI-CHECKLIST.md` BUG-34.
--
-- ARCHITECTURE.md 16A.1 module 7: a rate change "cannot be published without
-- viewing it", and R14 names that simulator as the mitigation for "a mistyped
-- rate changes every price on the site". The rule was enforced only by
-- `disabled={result === null}` in `PricingSimulator.tsx`, so any direct call
-- to the `publishPricingVersion` server action published without it.
--
-- Two nullable columns, mirroring the `publishedAt`/`publishedByEmail` pair
-- already on this table: same shape, same reason, one row per version.
--
-- Every existing row keeps NULL, including the version that is live right
-- now, and that is deliberate rather than an oversight. Backfilling
-- `simulatedAt` from `publishedAt` was written and then removed: it would
-- assert that a review happened when no such review was ever recorded, which
-- is the one thing these columns exist to stop anyone assuming. The cost of
-- being honest is one page visit before a rollback - the simulator runs on
-- mount, so opening the version is the review.

ALTER TABLE "PricingSettings"
  ADD COLUMN "simulatedAt" TIMESTAMP(3),
  ADD COLUMN "simulatedByEmail" TEXT;
