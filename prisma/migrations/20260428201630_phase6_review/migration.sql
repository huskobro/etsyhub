-- CreateEnum
CREATE TYPE "ReviewStatusSource" AS ENUM ('SYSTEM', 'USER');

-- AlterTable
ALTER TABLE "DesignReview" ADD COLUMN     "model" TEXT,
ADD COLUMN     "promptSnapshot" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "responseSnapshot" JSONB;

-- AlterTable
ALTER TABLE "GeneratedDesign" ADD COLUMN     "reviewPromptSnapshot" TEXT,
ADD COLUMN     "reviewProviderSnapshot" TEXT,
ADD COLUMN     "reviewRiskFlags" JSONB,
ADD COLUMN     "reviewScore" INTEGER,
ADD COLUMN     "reviewStatusSource" "ReviewStatusSource" NOT NULL DEFAULT 'SYSTEM';

-- AlterTable
ALTER TABLE "LocalLibraryAsset" ADD COLUMN     "reviewIssues" JSONB,
ADD COLUMN     "reviewPromptSnapshot" TEXT,
ADD COLUMN     "reviewProviderSnapshot" TEXT,
ADD COLUMN     "reviewRiskFlags" JSONB,
ADD COLUMN     "reviewScore" INTEGER,
ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewStatusSource" "ReviewStatusSource" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "reviewSummary" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3);
