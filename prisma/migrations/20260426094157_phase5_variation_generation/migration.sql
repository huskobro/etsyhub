-- CreateEnum
CREATE TYPE "VariationState" AS ENUM ('QUEUED', 'PROVIDER_PENDING', 'PROVIDER_RUNNING', 'SUCCESS', 'FAIL');

-- AlterEnum
ALTER TYPE "JobType" ADD VALUE 'SCAN_LOCAL_FOLDER';

-- AlterTable
ALTER TABLE "GeneratedDesign" ADD COLUMN     "briefSnapshot" TEXT,
ADD COLUMN     "capabilityUsed" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "promptSnapshot" TEXT,
ADD COLUMN     "providerId" TEXT,
ADD COLUMN     "providerTaskId" TEXT,
ADD COLUMN     "resultUrl" TEXT,
ADD COLUMN     "state" "VariationState";

-- CreateTable
CREATE TABLE "LocalLibraryAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "folderPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "dpi" INTEGER,
    "thumbnailPath" TEXT,
    "qualityScore" INTEGER,
    "qualityReasons" JSONB,
    "isNegative" BOOLEAN NOT NULL DEFAULT false,
    "negativeReason" TEXT,
    "isUserDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalLibraryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocalLibraryAsset_userId_folderName_idx" ON "LocalLibraryAsset"("userId", "folderName");

-- CreateIndex
CREATE INDEX "LocalLibraryAsset_userId_isNegative_idx" ON "LocalLibraryAsset"("userId", "isNegative");

-- CreateIndex
CREATE UNIQUE INDEX "LocalLibraryAsset_userId_hash_key" ON "LocalLibraryAsset"("userId", "hash");

-- AddForeignKey
ALTER TABLE "LocalLibraryAsset" ADD CONSTRAINT "LocalLibraryAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
