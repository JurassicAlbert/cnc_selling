-- P6: replace the Auth.js-shaped Account/Session/VerificationToken tables with
-- Better Auth's expected shape. No real rows exist in these three tables yet
-- (nothing used them before this migration), so they are dropped and
-- recreated rather than altered in place. Hand-authored (not `prisma migrate
-- dev`) specifically to avoid touching `OrderNumberCounter`, which has no
-- corresponding Prisma model and would otherwise be flagged for deletion by
-- the auto-diff. This migration does not reference `OrderNumberCounter`.

-- Drop the old Auth.js tables (CASCADE drops their own indexes/constraints/FKs).
DROP TABLE "Account" CASCADE;
DROP TABLE "Session" CASCADE;
DROP TABLE "VerificationToken" CASCADE;

-- User: Better Auth requires `name` and `emailVerified` to be non-null.
-- The one existing row (`Admin`) already has `name` set. `emailVerified` has
-- no existing meaningful value (nothing ever set it), so it becomes `false`
-- for all existing rows.
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "User"
    ALTER COLUMN "emailVerified" DROP DEFAULT,
    ALTER COLUMN "emailVerified" TYPE BOOLEAN USING false,
    ALTER COLUMN "emailVerified" SET DEFAULT false,
    ALTER COLUMN "emailVerified" SET NOT NULL;

-- Account: one row per sign-in method. [issuer, accountId] is the natural key.
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Account_issuer_accountId_key" ON "Account"("issuer", "accountId");
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Session
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Verification (replaces VerificationToken)
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");
