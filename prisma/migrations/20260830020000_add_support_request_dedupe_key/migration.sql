-- 2026-08-30 duplicate sweep. The support form is a zero-JS `<form action>`,
-- so nothing on the client disables it while the Server Action runs: a
-- double-click, an impatient second click, or a browser retry after a
-- dropped connection each filed a second identical request, and staff saw
-- the same question twice with no way to tell whether the customer had
-- really asked twice.
--
-- The value is a hash of (email, subject, message, order, five-minute
-- bucket) — see `server/operations/support-requests.ts`. The bucket is what
-- keeps this a duplicate guard rather than a permanent ban on ever asking
-- the same thing again.
--
-- Nullable: every request that already exists predates this column, and
-- Postgres treats NULLs as distinct in a unique index, so any number of
-- historical rows coexist without colliding.
ALTER TABLE "SupportRequest" ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "SupportRequest_dedupeKey_key" ON "SupportRequest"("dedupeKey");
