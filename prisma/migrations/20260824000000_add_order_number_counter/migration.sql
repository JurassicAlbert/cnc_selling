-- Order numbers must be collision-safe under concurrency, per year-month
-- (docs/ARCHITECTURE.md §15: "a Postgres sequence per year-month, not
-- count() + 1"). A real CREATE SEQUENCE object cannot reset itself on a
-- schedule, so this counter table is the correct implementation of that
-- requirement: one row per "YYYY-MM", incremented via
-- `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` inside the same
-- transaction as the order it numbers. That single atomic statement takes
-- the row lock as part of executing it — two concurrent orders in the same
-- month serialize on Postgres itself, never on application code — and,
-- unlike a real sequence's nextval(), the increment rolls back together
-- with the order if the transaction fails, so a failed checkout never
-- burns a number.
--
-- Deliberately NOT a Prisma model: the only access pattern is one raw
-- upsert-and-read inside src/server/orders/create-order.ts's transaction,
-- via tx.$queryRaw. An ORM model would invite ordinary CRUD access that
-- would defeat the row-locking this table exists for.
CREATE TABLE "OrderNumberCounter" (
  "yearMonth" TEXT PRIMARY KEY,
  "lastValue" INTEGER NOT NULL DEFAULT 0
);
