-- Pass 89 — Batch Review Studio V1: asset-level decision state.
--
-- MJReviewDecision enum (UNDECIDED/KEPT/REJECTED) ve MidjourneyAsset
-- tablosuna 3 alan + 1 index. Eski rowlar otomatik UNDECIDED kabul.

-- CreateEnum
CREATE TYPE "MJReviewDecision" AS ENUM ('UNDECIDED', 'KEPT', 'REJECTED');

-- AlterTable
ALTER TABLE "MidjourneyAsset" ADD COLUMN     "reviewDecidedAt" TIMESTAMP(3),
ADD COLUMN     "reviewDecidedBy" TEXT,
ADD COLUMN     "reviewDecision" "MJReviewDecision" NOT NULL DEFAULT 'UNDECIDED';

-- CreateIndex
CREATE INDEX "MidjourneyAsset_reviewDecision_idx" ON "MidjourneyAsset"("reviewDecision");
