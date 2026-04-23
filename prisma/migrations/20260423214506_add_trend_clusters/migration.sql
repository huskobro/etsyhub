-- CreateEnum
CREATE TYPE "TrendClusterStatus" AS ENUM ('ACTIVE', 'STALE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Bookmark" ADD COLUMN     "trendClusterId" TEXT,
ADD COLUMN     "trendClusterLabelSnapshot" TEXT,
ADD COLUMN     "trendWindowDaysSnapshot" INTEGER;

-- CreateTable
CREATE TABLE "TrendCluster" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "productTypeId" TEXT,
    "productTypeSource" TEXT,
    "productTypeConfidence" INTEGER,
    "windowDays" INTEGER NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "storeCount" INTEGER NOT NULL DEFAULT 0,
    "totalReviewCount" INTEGER NOT NULL DEFAULT 0,
    "latestMemberSeenAt" TIMESTAMP(3),
    "heroListingId" TEXT,
    "seasonalTag" TEXT,
    "status" "TrendClusterStatus" NOT NULL DEFAULT 'ACTIVE',
    "clusterScore" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendClusterMember" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendClusterMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrendCluster_userId_status_latestMemberSeenAt_idx" ON "TrendCluster"("userId", "status", "latestMemberSeenAt" DESC);

-- CreateIndex
CREATE INDEX "TrendCluster_userId_windowDays_clusterScore_idx" ON "TrendCluster"("userId", "windowDays", "clusterScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TrendCluster_userId_signature_windowDays_key" ON "TrendCluster"("userId", "signature", "windowDays");

-- CreateIndex
CREATE INDEX "TrendClusterMember_listingId_idx" ON "TrendClusterMember"("listingId");

-- CreateIndex
CREATE INDEX "TrendClusterMember_userId_clusterId_idx" ON "TrendClusterMember"("userId", "clusterId");

-- CreateIndex
CREATE INDEX "TrendClusterMember_userId_listingId_idx" ON "TrendClusterMember"("userId", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "TrendClusterMember_clusterId_listingId_key" ON "TrendClusterMember"("clusterId", "listingId");

-- CreateIndex
CREATE INDEX "Bookmark_trendClusterId_idx" ON "Bookmark"("trendClusterId");

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_trendClusterId_fkey" FOREIGN KEY ("trendClusterId") REFERENCES "TrendCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendCluster" ADD CONSTRAINT "TrendCluster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendCluster" ADD CONSTRAINT "TrendCluster_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendCluster" ADD CONSTRAINT "TrendCluster_heroListingId_fkey" FOREIGN KEY ("heroListingId") REFERENCES "CompetitorListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendClusterMember" ADD CONSTRAINT "TrendClusterMember_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "TrendCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrendClusterMember" ADD CONSTRAINT "TrendClusterMember_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "CompetitorListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
