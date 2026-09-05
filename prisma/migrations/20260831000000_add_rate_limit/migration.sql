-- Rate limiting — `docs/ARCHITECTURE.md` §16.1 requires limits on "uploads
-- per session/hour, order creation per IP, auth attempts". Only the upload
-- limiter existed (it counts real `UploadedFile` rows, which does not
-- transfer: a failed login leaves no row to count). Login, registration and
-- OTP requests were completely unthrottled — see `docs/REVIEW-DETAILED.md`
-- SEC-01 for why Better Auth's own limiter never ran for this application
-- (it lives in the HTTP router's onRequest hook, and every auth form here
-- calls `auth.api.*` directly instead).
--
-- `docs/OPEN_ITEMS.md` §6 left the storage choice to the owner; they chose
-- Postgres on 2026-08-30. No new infrastructure, and the shape is one this
-- codebase already relies on for `OrderNumberCounter`: a single atomic
-- INSERT … ON CONFLICT DO UPDATE … RETURNING, so concurrent attempts
-- compose instead of overwriting each other.
--
-- `key` carries the entire identity of what is being limited
-- ("login:email:…", "order:ip:…"), so one table serves every limiter and a
-- new one needs no migration.

CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- Only so a future prune job can find long-idle rows cheaply. Nothing in
-- the request path reads by this column — every read is by primary key.
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- A count can only ever be a real number of attempts. Same
-- belt-and-braces CHECK discipline the initial migration already applies
-- to money and dimension columns.
ALTER TABLE "RateLimit" ADD CONSTRAINT "RateLimit_count_positive" CHECK ("count" >= 0);
