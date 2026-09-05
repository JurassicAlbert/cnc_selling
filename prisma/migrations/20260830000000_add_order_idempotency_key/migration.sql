-- docs/AUDIT-2026-08-30.md P0-2: checkout had no idempotency mechanism at
-- all, so a double-submitted (or retried, or two-tab) checkout created two
-- real orders for one purchase. `idempotencyKey` is one checkout render's
-- own submission id; the unique index is the actual enforcement.
--
-- Nullable on purpose: every order that already exists predates this
-- column and must stay valid. Postgres unique indexes treat NULLs as
-- distinct, so any number of historical rows can keep a NULL here without
-- colliding — only real, non-null keys are deduplicated.
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
