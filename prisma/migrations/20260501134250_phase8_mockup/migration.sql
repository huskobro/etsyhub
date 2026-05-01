-- CreateEnum
CREATE TYPE "MockupProviderId" AS ENUM ('LOCAL_SHARP', 'DYNAMIC_MOCKUPS');

-- CreateEnum
CREATE TYPE "MockupTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MockupBindingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MockupJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL_COMPLETE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MockupRenderStatus" AS ENUM ('PENDING', 'RENDERING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "MockupErrorClass" AS ENUM ('TEMPLATE_INVALID', 'RENDER_TIMEOUT', 'SOURCE_QUALITY', 'SAFE_AREA_OVERFLOW', 'PROVIDER_DOWN');

-- CreateEnum
CREATE TYPE "PackSelectionReason" AS ENUM ('COVER', 'TEMPLATE_DIVERSITY', 'VARIANT_ROTATION');

-- CreateTable
CREATE TABLE "MockupTemplate" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "MockupTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "thumbKey" TEXT NOT NULL,
    "aspectRatios" TEXT[],
    "tags" TEXT[],
    "estimatedRenderMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MockupTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockupTemplateBinding" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "providerId" "MockupProviderId" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "MockupBindingStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL,
    "estimatedRenderMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "MockupTemplateBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockupJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "setSnapshotId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "status" "MockupJobStatus" NOT NULL,
    "packSize" INTEGER NOT NULL,
    "actualPackSize" INTEGER NOT NULL,
    "coverRenderId" TEXT,
    "totalRenders" INTEGER NOT NULL,
    "successRenders" INTEGER NOT NULL DEFAULT 0,
    "failedRenders" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MockupJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockupRender" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "templateSnapshot" JSONB NOT NULL,
    "packPosition" INTEGER,
    "selectionReason" "PackSelectionReason" NOT NULL,
    "status" "MockupRenderStatus" NOT NULL,
    "outputKey" TEXT,
    "thumbnailKey" TEXT,
    "errorClass" "MockupErrorClass",
    "errorDetail" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MockupRender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockupTemplate_categoryId_status_idx" ON "MockupTemplate"("categoryId", "status");

-- CreateIndex
CREATE INDEX "MockupTemplateBinding_providerId_status_idx" ON "MockupTemplateBinding"("providerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MockupTemplateBinding_templateId_providerId_key" ON "MockupTemplateBinding"("templateId", "providerId");

-- CreateIndex
CREATE INDEX "MockupJob_userId_createdAt_idx" ON "MockupJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "MockupJob_setId_createdAt_idx" ON "MockupJob"("setId", "createdAt");

-- CreateIndex
CREATE INDEX "MockupJob_status_idx" ON "MockupJob"("status");

-- CreateIndex
CREATE INDEX "MockupRender_jobId_packPosition_idx" ON "MockupRender"("jobId", "packPosition");

-- CreateIndex
CREATE INDEX "MockupRender_jobId_status_idx" ON "MockupRender"("jobId", "status");

-- AddForeignKey
ALTER TABLE "MockupTemplateBinding" ADD CONSTRAINT "MockupTemplateBinding_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MockupTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockupJob" ADD CONSTRAINT "MockupJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockupJob" ADD CONSTRAINT "MockupJob_setId_fkey" FOREIGN KEY ("setId") REFERENCES "SelectionSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockupRender" ADD CONSTRAINT "MockupRender_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "MockupJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
