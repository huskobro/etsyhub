-- Phase 9 V1 — Listing extend (additive, K1 lock).
-- New columns: mockupJobId, coverRenderId, imageOrderJson, submittedAt, publishedAt, etsyListingId, failedReason.
-- Legacy columns untouched: generatedDesignId, mockups[], etsyDraftId, productTypeId.

ALTER TABLE "Listing" ADD COLUMN "mockupJobId" TEXT;
ALTER TABLE "Listing" ADD COLUMN "coverRenderId" TEXT;
ALTER TABLE "Listing" ADD COLUMN "imageOrderJson" JSONB;
ALTER TABLE "Listing" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN "etsyListingId" TEXT;
ALTER TABLE "Listing" ADD COLUMN "failedReason" TEXT;

-- Foreign key: Listing.mockupJobId -> MockupJob.id (SetNull on delete).
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_mockupJobId_fkey" FOREIGN KEY ("mockupJobId") REFERENCES "MockupJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for efficient Listing lookup by mockupJobId.
CREATE INDEX "Listing_mockupJobId_idx" ON "Listing"("mockupJobId");
