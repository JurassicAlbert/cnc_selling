-- CreateTable
CREATE TABLE "ExternalPatternResource" (
    "id" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "descPl" TEXT,
    "sourceLabel" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalPatternResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalPatternResource_isActive_sortOrder_idx" ON "ExternalPatternResource"("isActive", "sortOrder");
