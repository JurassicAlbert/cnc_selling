-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProductTypeCode" AS ENUM ('WALL_ART', 'TABLE_TOP', 'KITCHEN_TILE', 'FLOOR_ELEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MaterialFamily" AS ENUM ('SOLID_WOOD', 'PLYWOOD', 'MDF', 'CERAMIC', 'LEATHER', 'OTHER');

-- CreateEnum
CREATE TYPE "GrainDirection" AS ENUM ('NONE', 'LENGTHWISE');

-- CreateEnum
CREATE TYPE "FinishKind" AS ENUM ('NATURAL', 'OIL', 'HARDWAX_OIL', 'STAIN', 'VARNISH');

-- CreateEnum
CREATE TYPE "DesignRightsStatus" AS ENUM ('APPROVED_COMMERCIAL', 'REQUIRES_PERMISSION', 'PUBLIC_DOMAIN', 'CUSTOMER_SUPPLIED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ProductionMethod" AS ENUM ('CNC_CARVE', 'CNC_ENGRAVE', 'LASER_ENGRAVE', 'MIXED', 'MANUAL_PREP');

-- CreateEnum
CREATE TYPE "InstallationVariantCode" AS ENUM ('ON_TOP', 'OVERLAY', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'AWAITING_PAYMENT', 'DESIGN_REVIEW', 'CONFIRMED', 'IN_PRODUCTION', 'FINISHING', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CONTACT_ARRANGED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('AWAITING', 'UNDERPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "UploadKind" AS ENUM ('CUSTOMER_DESIGN', 'REFERENCE_PHOTO');

-- CreateEnum
CREATE TYPE "DesignReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'NEEDS_CHANGES', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "descPl" TEXT NOT NULL,
    "seoTitlePl" TEXT NOT NULL,
    "seoDescPl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "typeCode" "ProductTypeCode" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "shortDescPl" TEXT NOT NULL,
    "longDescPl" TEXT NOT NULL,
    "careInstructionsPl" TEXT NOT NULL,
    "installationInfoPl" TEXT,
    "materialNotesPl" TEXT,
    "seoTitlePl" TEXT NOT NULL,
    "seoDescPl" TEXT NOT NULL,
    "basePriceGrosze" INTEGER NOT NULL,
    "minPriceGrosze" INTEGER NOT NULL,
    "productionDaysMin" INTEGER NOT NULL,
    "productionDaysMax" INTEGER NOT NULL,
    "minWidthMm" INTEGER NOT NULL,
    "maxWidthMm" INTEGER NOT NULL,
    "minHeightMm" INTEGER NOT NULL,
    "maxHeightMm" INTEGER NOT NULL,
    "minAspectRatioBp" INTEGER,
    "maxAspectRatioBp" INTEGER,
    "allowsCustomSize" BOOLEAN NOT NULL DEFAULT true,
    "requiresExactSize" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPresetSize" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "labelPl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductPresetSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altPl" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "family" "MaterialFamily" NOT NULL,
    "shortDescPl" TEXT NOT NULL,
    "characteristicsPl" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "pricePerM2Grosze" INTEGER NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "maxSheetWidthMm" INTEGER NOT NULL,
    "maxSheetHeightMm" INTEGER NOT NULL,
    "minLineWidthUm" INTEGER NOT NULL,
    "minDetailSpacingUm" INTEGER NOT NULL,
    "minTextHeightUm" INTEGER NOT NULL,
    "grainDirection" "GrainDirection" NOT NULL DEFAULT 'NONE',
    "supportsCnc" BOOLEAN NOT NULL DEFAULT true,
    "supportsLaser" BOOLEAN NOT NULL DEFAULT true,
    "isNaturalVariable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMaterial" (
    "productId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "priceFactorBp" INTEGER NOT NULL DEFAULT 10000,

    CONSTRAINT "ProductMaterial_pkey" PRIMARY KEY ("productId","materialId")
);

-- CreateTable
CREATE TABLE "ProductThickness" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "thicknessMm" INTEGER NOT NULL,
    "priceFactorBp" INTEGER NOT NULL DEFAULT 10000,
    "labelPl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductThickness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finish" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "kind" "FinishKind" NOT NULL,
    "descPl" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "pricePerM2Grosze" INTEGER NOT NULL,
    "setupFeeGrosze" INTEGER NOT NULL DEFAULT 0,
    "extraDaysMin" INTEGER NOT NULL DEFAULT 0,
    "extraDaysMax" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialFinish" (
    "materialId" TEXT NOT NULL,
    "finishId" TEXT NOT NULL,

    CONSTRAINT "MaterialFinish_pkey" PRIMARY KEY ("materialId","finishId")
);

-- CreateTable
CREATE TABLE "DesignCollection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "descPl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DesignCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "descPl" TEXT,
    "collectionId" TEXT,
    "tags" TEXT[],
    "thumbnailUrl" TEXT NOT NULL,
    "previewUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "referenceWidthMm" INTEGER NOT NULL,
    "minLineWidthUm" INTEGER NOT NULL,
    "minDetailSpacingUm" INTEGER NOT NULL,
    "minEngraveDepthUm" INTEGER,
    "recommendedMethod" "ProductionMethod" NOT NULL,
    "minRecommendedWidthMm" INTEGER NOT NULL,
    "maxRecommendedWidthMm" INTEGER,
    "detailLevel" INTEGER NOT NULL,
    "machiningMilliMinutesPerM2" INTEGER NOT NULL,
    "rightsStatus" "DesignRightsStatus" NOT NULL DEFAULT 'REQUIRES_PERMISSION',
    "sourceArtist" TEXT,
    "sourceTitle" TEXT,
    "sourceYear" INTEGER,
    "artistDeathYear" INTEGER,
    "sourceRef" TEXT,
    "rightsNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDesign" (
    "productId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "surchargeGrosze" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductDesign_pkey" PRIMARY KEY ("productId","designId")
);

-- CreateTable
CREATE TABLE "DesignMaterial" (
    "designId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,

    CONSTRAINT "DesignMaterial_pkey" PRIMARY KEY ("designId","materialId")
);

-- CreateTable
CREATE TABLE "InstallationVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "code" "InstallationVariantCode" NOT NULL,
    "namePl" TEXT NOT NULL,
    "descPl" TEXT NOT NULL,
    "receivesPl" TEXT NOT NULL,
    "diagramUrl" TEXT NOT NULL,
    "maxThicknessMm" INTEGER,
    "priceFactorBp" INTEGER NOT NULL DEFAULT 10000,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InstallationVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalizationSpec" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxCharacters" INTEGER NOT NULL DEFAULT 40,
    "maxLines" INTEGER NOT NULL DEFAULT 2,
    "minTextHeightUm" INTEGER NOT NULL DEFAULT 6000,
    "pricePerCharGrosze" INTEGER NOT NULL DEFAULT 0,
    "flatFeeGrosze" INTEGER NOT NULL DEFAULT 0,
    "allowedFontIds" TEXT[],

    CONSTRAINT "PersonalizationSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Font" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "namePl" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "minHeightUm" INTEGER NOT NULL,
    "coveredCodePointRanges" JSONB NOT NULL,
    "supportsPolishDiacritics" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Font_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSettings" (
    "version" INTEGER NOT NULL,
    "machineRateCncGrosze" INTEGER NOT NULL,
    "machineRateLaserGrosze" INTEGER NOT NULL,
    "moduleSurchargeGrosze" INTEGER NOT NULL,
    "packagingTiers" JSONB NOT NULL,
    "vatRateBp" INTEGER NOT NULL DEFAULT 2300,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "publishedByEmail" TEXT,
    "notePl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "MachineSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "usableWidthMm" INTEGER NOT NULL,
    "usableHeightMm" INTEGER NOT NULL,
    "minModuleMm" INTEGER NOT NULL,
    "jointAllowanceMm" INTEGER NOT NULL DEFAULT 0,
    "weeklyCapacityMinutes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MachineSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuration" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionToken" TEXT,
    "productId" TEXT NOT NULL,
    "designId" TEXT,
    "customDesignId" TEXT,
    "materialId" TEXT,
    "finishId" TEXT,
    "thicknessMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "installVariant" "InstallationVariantCode",
    "personalizationText" TEXT,
    "fontId" TEXT,
    "moduleCount" INTEGER,
    "moduleLayout" JSONB,
    "priceBreakdown" JSONB,
    "priceGrossGrosze" INTEGER,
    "warnings" JSONB,
    "acknowledgedWarnings" TEXT[],
    "pricingVersion" INTEGER,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT,
    "accessToken" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'NEW',
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'AWAITING',
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "companyName" TEXT,
    "nip" TEXT,
    "street" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'PL',
    "subtotalNetGrosze" INTEGER NOT NULL,
    "vatGrosze" INTEGER NOT NULL,
    "shippingGrosze" INTEGER NOT NULL,
    "totalGrossGrosze" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "termsVersion" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "withdrawalExemptionTextPl" TEXT NOT NULL,
    "withdrawalAcknowledgedAt" TIMESTAMP(3) NOT NULL,
    "productionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitNetGrosze" INTEGER NOT NULL,
    "unitGrossGrosze" INTEGER NOT NULL,
    "vatRateBp" INTEGER NOT NULL DEFAULT 2300,
    "lineNetGrosze" INTEGER NOT NULL,
    "lineVatGrosze" INTEGER NOT NULL,
    "lineGrossGrosze" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "pricingVersion" INTEGER NOT NULL,
    "customerDesignId" TEXT,
    "productionMethod" "ProductionMethod",
    "moduleCount" INTEGER,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "notePl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionToken" TEXT,
    "kind" "UploadKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "widthPx" INTEGER,
    "heightPx" INTEGER,
    "pageCount" INTEGER,
    "previewKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDesign" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionToken" TEXT,
    "status" "DesignReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "productionMethod" "ProductionMethod",
    "autoWarnings" JSONB,
    "ipConfirmedAt" TIMESTAMP(3),
    "ipDeclarationVersion" TEXT,
    "ipDeclarationTextPl" TEXT,
    "ipConfirmedIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignReviewComment" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT,
    "bodyPl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "phone" TEXT,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sessionToken" TEXT,
    "userId" TEXT,
    "productId" TEXT,
    "step" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_categoryId_isActive_idx" ON "Product"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Product_typeCode_isActive_idx" ON "Product"("typeCode", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPresetSize_productId_widthMm_heightMm_key" ON "ProductPresetSize"("productId", "widthMm", "heightMm");

-- CreateIndex
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Material_slug_key" ON "Material"("slug");

-- CreateIndex
CREATE INDEX "Material_isAvailable_sortOrder_idx" ON "Material"("isAvailable", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductMaterial_materialId_idx" ON "ProductMaterial"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductThickness_productId_thicknessMm_key" ON "ProductThickness"("productId", "thicknessMm");

-- CreateIndex
CREATE UNIQUE INDEX "Finish_slug_key" ON "Finish"("slug");

-- CreateIndex
CREATE INDEX "Finish_isAvailable_sortOrder_idx" ON "Finish"("isAvailable", "sortOrder");

-- CreateIndex
CREATE INDEX "MaterialFinish_finishId_idx" ON "MaterialFinish"("finishId");

-- CreateIndex
CREATE UNIQUE INDEX "DesignCollection_slug_key" ON "DesignCollection"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Design_slug_key" ON "Design"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Design_code_key" ON "Design"("code");

-- CreateIndex
CREATE INDEX "Design_isActive_rightsStatus_idx" ON "Design"("isActive", "rightsStatus");

-- CreateIndex
CREATE INDEX "Design_collectionId_idx" ON "Design"("collectionId");

-- CreateIndex
CREATE INDEX "ProductDesign_designId_idx" ON "ProductDesign"("designId");

-- CreateIndex
CREATE INDEX "DesignMaterial_materialId_idx" ON "DesignMaterial"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationVariant_productId_code_key" ON "InstallationVariant"("productId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalizationSpec_productId_key" ON "PersonalizationSpec"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Font_slug_key" ON "Font"("slug");

-- CreateIndex
CREATE INDEX "PricingSettings_isActive_idx" ON "PricingSettings"("isActive");

-- CreateIndex
CREATE INDEX "Configuration_userId_idx" ON "Configuration"("userId");

-- CreateIndex
CREATE INDEX "Configuration_sessionToken_idx" ON "Configuration"("sessionToken");

-- CreateIndex
CREATE INDEX "Configuration_productId_idx" ON "Configuration"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_sessionToken_key" ON "Cart"("sessionToken");

-- CreateIndex
CREATE INDEX "CartItem_cartId_idx" ON "CartItem"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_customerDesignId_idx" ON "OrderItem"("customerDesignId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedFile_storageKey_key" ON "UploadedFile"("storageKey");

-- CreateIndex
CREATE INDEX "UploadedFile_userId_idx" ON "UploadedFile"("userId");

-- CreateIndex
CREATE INDEX "UploadedFile_sessionToken_idx" ON "UploadedFile"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerDesign_fileId_key" ON "CustomerDesign"("fileId");

-- CreateIndex
CREATE INDEX "CustomerDesign_status_idx" ON "CustomerDesign"("status");

-- CreateIndex
CREATE INDEX "CustomerDesign_userId_idx" ON "CustomerDesign"("userId");

-- CreateIndex
CREATE INDEX "CustomerDesign_sessionToken_idx" ON "CustomerDesign"("sessionToken");

-- CreateIndex
CREATE INDEX "DesignReviewComment_designId_createdAt_idx" ON "DesignReviewComment"("designId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_name_createdAt_idx" ON "AnalyticsEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionToken_idx" ON "AnalyticsEvent"("sessionToken");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPresetSize" ADD CONSTRAINT "ProductPresetSize_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaterial" ADD CONSTRAINT "ProductMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMaterial" ADD CONSTRAINT "ProductMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductThickness" ADD CONSTRAINT "ProductThickness_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialFinish" ADD CONSTRAINT "MaterialFinish_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialFinish" ADD CONSTRAINT "MaterialFinish_finishId_fkey" FOREIGN KEY ("finishId") REFERENCES "Finish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Design" ADD CONSTRAINT "Design_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "DesignCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDesign" ADD CONSTRAINT "ProductDesign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDesign" ADD CONSTRAINT "ProductDesign_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignMaterial" ADD CONSTRAINT "DesignMaterial_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignMaterial" ADD CONSTRAINT "DesignMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallationVariant" ADD CONSTRAINT "InstallationVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalizationSpec" ADD CONSTRAINT "PersonalizationSpec_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_customDesignId_fkey" FOREIGN KEY ("customDesignId") REFERENCES "CustomerDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_finishId_fkey" FOREIGN KEY ("finishId") REFERENCES "Finish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_fontId_fkey" FOREIGN KEY ("fontId") REFERENCES "Font"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_pricingVersion_fkey" FOREIGN KEY ("pricingVersion") REFERENCES "PricingSettings"("version") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "Configuration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_customerDesignId_fkey" FOREIGN KEY ("customerDesignId") REFERENCES "CustomerDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDesign" ADD CONSTRAINT "CustomerDesign_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerDesign" ADD CONSTRAINT "CustomerDesign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignReviewComment" ADD CONSTRAINT "DesignReviewComment_designId_fkey" FOREIGN KEY ("designId") REFERENCES "CustomerDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written additions. Prisma cannot express these; they are part of the
-- initial migration on purpose, so a fresh database has them from the start.
-- ---------------------------------------------------------------------------

-- Diacritic-insensitive search: „dab" must find „dąb" (ARCHITECTURE.md §17.3).
-- Also created by docker/postgres-init for local development; repeated here so
-- that a hosted database provisioned only by `prisma migrate deploy` is not
-- missing it.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- At most one published rate set. `PricingSettings` is append-only: every save
-- writes a new version and flips the active flag, so "two active rate sets"
-- would silently price half the site differently. A partial unique index makes
-- that state impossible rather than merely discouraged.
CREATE UNIQUE INDEX "PricingSettings_single_active"
  ON "PricingSettings" ("isActive")
  WHERE "isActive";

-- MachineSettings is a true singleton: exactly one row, id = 1.
ALTER TABLE "MachineSettings"
  ADD CONSTRAINT "MachineSettings_singleton" CHECK ("id" = 1);

-- Guard rails on the values that decide what a customer is charged. These are
-- invariants the domain layer already enforces; duplicating them in the
-- database means a bad seed script or a hand-written UPDATE cannot create a
-- row the domain would reject.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_prices_non_negative" CHECK ("basePriceGrosze" >= 0 AND "minPriceGrosze" >= 0),
  ADD CONSTRAINT "Product_envelope_ordered" CHECK ("minWidthMm" > 0 AND "minHeightMm" > 0 AND "maxWidthMm" >= "minWidthMm" AND "maxHeightMm" >= "minHeightMm");

ALTER TABLE "Material"
  ADD CONSTRAINT "Material_price_non_negative" CHECK ("pricePerM2Grosze" >= 0),
  ADD CONSTRAINT "Material_tolerances_positive" CHECK ("minLineWidthUm" > 0 AND "minDetailSpacingUm" > 0 AND "minTextHeightUm" > 0),
  ADD CONSTRAINT "Material_sheet_positive" CHECK ("maxSheetWidthMm" > 0 AND "maxSheetHeightMm" > 0);

ALTER TABLE "Design"
  ADD CONSTRAINT "Design_detail_level_range" CHECK ("detailLevel" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Design_reference_width_positive" CHECK ("referenceWidthMm" > 0),
  ADD CONSTRAINT "Design_machining_non_negative" CHECK ("machiningMilliMinutesPerM2" >= 0);

ALTER TABLE "MachineSettings"
  ADD CONSTRAINT "MachineSettings_positive" CHECK ("usableWidthMm" > 0 AND "usableHeightMm" > 0 AND "minModuleMm" >= 0);

ALTER TABLE "PricingSettings"
  ADD CONSTRAINT "PricingSettings_rates_non_negative" CHECK ("machineRateCncGrosze" >= 0 AND "machineRateLaserGrosze" >= 0 AND "moduleSurchargeGrosze" >= 0),
  ADD CONSTRAINT "PricingSettings_vat_range" CHECK ("vatRateBp" >= 0 AND "vatRateBp" <= 10000);

ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_quantity_positive" CHECK ("quantity" > 0);
