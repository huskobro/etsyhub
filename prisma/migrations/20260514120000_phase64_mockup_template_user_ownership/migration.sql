-- AlterTable
ALTER TABLE "MockupTemplate" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "MockupTemplate_userId_idx" ON "MockupTemplate"("userId");

-- AddForeignKey
ALTER TABLE "MockupTemplate" ADD CONSTRAINT "MockupTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

