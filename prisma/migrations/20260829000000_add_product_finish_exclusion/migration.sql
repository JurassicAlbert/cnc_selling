-- CreateTable
CREATE TABLE "ProductFinishExclusion" (
    "productId" TEXT NOT NULL,
    "finishId" TEXT NOT NULL,

    CONSTRAINT "ProductFinishExclusion_pkey" PRIMARY KEY ("productId","finishId")
);

-- CreateIndex
CREATE INDEX "ProductFinishExclusion_finishId_idx" ON "ProductFinishExclusion"("finishId");

-- AddForeignKey
ALTER TABLE "ProductFinishExclusion" ADD CONSTRAINT "ProductFinishExclusion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFinishExclusion" ADD CONSTRAINT "ProductFinishExclusion_finishId_fkey" FOREIGN KEY ("finishId") REFERENCES "Finish"("id") ON DELETE CASCADE ON UPDATE CASCADE;
