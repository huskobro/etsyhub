-- CreateEnum
CREATE TYPE "SelectionSetStatus" AS ENUM ('draft', 'ready', 'archived');

-- CreateEnum
CREATE TYPE "SelectionItemStatus" AS ENUM ('pending', 'selected', 'rejected');

-- CreateTable
CREATE TABLE "SelectionSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SelectionSetStatus" NOT NULL DEFAULT 'draft',
    "sourceMetadata" JSONB,
    "lastExportedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelectionSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelectionItem" (
    "id" TEXT NOT NULL,
    "selectionSetId" TEXT NOT NULL,
    "generatedDesignId" TEXT NOT NULL,
    "sourceAssetId" TEXT NOT NULL,
    "editedAssetId" TEXT,
    "lastUndoableAssetId" TEXT,
    "editHistoryJson" JSONB NOT NULL DEFAULT '[]',
    "status" "SelectionItemStatus" NOT NULL DEFAULT 'pending',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SelectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SelectionSet_userId_status_idx" ON "SelectionSet"("userId", "status");

-- CreateIndex
CREATE INDEX "SelectionItem_selectionSetId_position_idx" ON "SelectionItem"("selectionSetId", "position");

-- CreateIndex
CREATE INDEX "SelectionItem_generatedDesignId_idx" ON "SelectionItem"("generatedDesignId");

-- AddForeignKey
ALTER TABLE "SelectionSet" ADD CONSTRAINT "SelectionSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionItem" ADD CONSTRAINT "SelectionItem_selectionSetId_fkey" FOREIGN KEY ("selectionSetId") REFERENCES "SelectionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionItem" ADD CONSTRAINT "SelectionItem_generatedDesignId_fkey" FOREIGN KEY ("generatedDesignId") REFERENCES "GeneratedDesign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionItem" ADD CONSTRAINT "SelectionItem_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionItem" ADD CONSTRAINT "SelectionItem_editedAssetId_fkey" FOREIGN KEY ("editedAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelectionItem" ADD CONSTRAINT "SelectionItem_lastUndoableAssetId_fkey" FOREIGN KEY ("lastUndoableAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
