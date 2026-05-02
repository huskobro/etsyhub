-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "mockupJobId" TEXT;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_mockupJobId_fkey" FOREIGN KEY ("mockupJobId") REFERENCES "MockupJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
