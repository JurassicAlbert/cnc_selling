-- CreateTable
CREATE TABLE "DesignFavorite" (
    "userId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignFavorite_pkey" PRIMARY KEY ("userId","designId")
);

-- CreateIndex
CREATE INDEX "DesignFavorite_designId_idx" ON "DesignFavorite"("designId");

-- AddForeignKey
ALTER TABLE "DesignFavorite" ADD CONSTRAINT "DesignFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignFavorite" ADD CONSTRAINT "DesignFavorite_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
