-- CreateTable
CREATE TABLE "FrameExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectionSetId" TEXT,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "frameAspect" TEXT NOT NULL,
    "sceneSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FrameExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrameExport_userId_createdAt_idx" ON "FrameExport"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FrameExport_userId_selectionSetId_idx" ON "FrameExport"("userId", "selectionSetId");

-- CreateIndex
CREATE INDEX "FrameExport_deletedAt_idx" ON "FrameExport"("deletedAt");

-- AddForeignKey
ALTER TABLE "FrameExport" ADD CONSTRAINT "FrameExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrameExport" ADD CONSTRAINT "FrameExport_selectionSetId_fkey" FOREIGN KEY ("selectionSetId") REFERENCES "SelectionSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

┌─────────────────────────────────────────────────────────┐
│  Update available 5.20.0 -> 7.8.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
