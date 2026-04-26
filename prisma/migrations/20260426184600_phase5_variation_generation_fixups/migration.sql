/*
  Warnings:

  - The `capabilityUsed` column on the `GeneratedDesign` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "VariationCapability" AS ENUM ('IMAGE_TO_IMAGE', 'TEXT_TO_IMAGE');

-- DropForeignKey
ALTER TABLE "LocalLibraryAsset" DROP CONSTRAINT "LocalLibraryAsset_userId_fkey";

-- AlterTable
ALTER TABLE "GeneratedDesign" DROP COLUMN "capabilityUsed",
ADD COLUMN     "capabilityUsed" "VariationCapability";

-- CreateIndex
CREATE INDEX "LocalLibraryAsset_userId_isUserDeleted_deletedAt_idx" ON "LocalLibraryAsset"("userId", "isUserDeleted", "deletedAt");

-- AddForeignKey
ALTER TABLE "LocalLibraryAsset" ADD CONSTRAINT "LocalLibraryAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
