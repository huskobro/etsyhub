-- CreateEnum
CREATE TYPE "CompetitorListingStatus" AS ENUM ('ACTIVE', 'SOLD_OUT', 'DELETED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CompetitorScanType" AS ENUM ('INITIAL_FULL', 'INCREMENTAL_NEW', 'MANUAL_REFRESH');

-- CreateEnum
CREATE TYPE "CompetitorScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- AlterTable
ALTER TABLE "CompetitorStore" ADD COLUMN     "autoScanEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "platform" "SourcePlatform" NOT NULL DEFAULT 'ETSY',
ADD COLUMN     "shopUrl" TEXT,
ADD COLUMN     "totalListings" INTEGER,
ADD COLUMN     "totalReviews" INTEGER;

-- CreateTable
CREATE TABLE "CompetitorListing" (
    "id" TEXT NOT NULL,
    "competitorStoreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "platform" "SourcePlatform" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceCents" INTEGER,
    "currency" TEXT,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "favoritesCount" INTEGER,
    "listingCreatedAt" TIMESTAMP(3),
    "latestReviewAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parserSource" TEXT,
    "parserConfidence" INTEGER,
    "parseWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CompetitorListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitorListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorScan" (
    "id" TEXT NOT NULL,
    "competitorStoreId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT,
    "type" "CompetitorScanType" NOT NULL,
    "status" "CompetitorScanStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT NOT NULL,
    "listingsFound" INTEGER NOT NULL DEFAULT 0,
    "listingsNew" INTEGER NOT NULL DEFAULT 0,
    "listingsUpdated" INTEGER NOT NULL DEFAULT 0,
    "listingsRemoved" INTEGER NOT NULL DEFAULT 0,
    "parseWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitorListing_userId_idx" ON "CompetitorListing"("userId");

-- CreateIndex
CREATE INDEX "CompetitorListing_competitorStoreId_reviewCount_idx" ON "CompetitorListing"("competitorStoreId", "reviewCount" DESC);

-- CreateIndex
CREATE INDEX "CompetitorListing_competitorStoreId_lastSeenAt_idx" ON "CompetitorListing"("competitorStoreId", "lastSeenAt" DESC);

-- CreateIndex
CREATE INDEX "CompetitorListing_competitorStoreId_latestReviewAt_idx" ON "CompetitorListing"("competitorStoreId", "latestReviewAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CompetitorListing_competitorStoreId_externalId_key" ON "CompetitorListing"("competitorStoreId", "externalId");

-- CreateIndex
CREATE INDEX "CompetitorScan_competitorStoreId_createdAt_idx" ON "CompetitorScan"("competitorStoreId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "CompetitorScan_userId_idx" ON "CompetitorScan"("userId");

-- CreateIndex
CREATE INDEX "CompetitorStore_userId_idx" ON "CompetitorStore"("userId");

-- AddForeignKey
ALTER TABLE "CompetitorListing" ADD CONSTRAINT "CompetitorListing_competitorStoreId_fkey" FOREIGN KEY ("competitorStoreId") REFERENCES "CompetitorStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorListing" ADD CONSTRAINT "CompetitorListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorScan" ADD CONSTRAINT "CompetitorScan_competitorStoreId_fkey" FOREIGN KEY ("competitorStoreId") REFERENCES "CompetitorStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorScan" ADD CONSTRAINT "CompetitorScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
