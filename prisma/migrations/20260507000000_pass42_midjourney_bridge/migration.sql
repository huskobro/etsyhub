-- Pass 42 — Midjourney Web Bridge integration.
-- New JobType enum value + MidjourneyJob + MidjourneyAsset tables.
-- Detail: docs/plans/2026-05-06-midjourney-web-bridge-design.md

-- Step 1: JobType enum extension (additive; backward-compatible).
ALTER TYPE "JobType" ADD VALUE 'MIDJOURNEY_BRIDGE';

-- Step 2: New enums for MJ-specific lifecycle/kind/variant.
CREATE TYPE "MidjourneyJobState" AS ENUM (
  'QUEUED',
  'OPENING_BROWSER',
  'AWAITING_LOGIN',
  'AWAITING_CHALLENGE',
  'SUBMITTING_PROMPT',
  'WAITING_FOR_RENDER',
  'COLLECTING_OUTPUTS',
  'DOWNLOADING',
  'IMPORTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "MidjourneyJobKind" AS ENUM (
  'GENERATE',
  'DESCRIBE',
  'UPSCALE',
  'VARIATION'
);

CREATE TYPE "MJVariantKind" AS ENUM (
  'GRID',
  'UPSCALE',
  'VARIATION',
  'DESCRIBE'
);

-- Step 3: MidjourneyJob table.
CREATE TABLE "MidjourneyJob" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "jobId"           TEXT,
  "referenceId"     TEXT,
  "productTypeId"   TEXT,
  "bridgeJobId"     TEXT NOT NULL,
  "kind"            "MidjourneyJobKind" NOT NULL DEFAULT 'GENERATE',
  "state"           "MidjourneyJobState" NOT NULL DEFAULT 'QUEUED',
  "blockReason"     TEXT,
  "prompt"          TEXT NOT NULL,
  "promptParams"    JSONB NOT NULL,
  "referenceUrls"   TEXT[] NOT NULL DEFAULT '{}',
  "mjJobId"         TEXT,
  "mjGridUrl"       TEXT,
  "mjMetadata"      JSONB,
  "enqueuedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt"     TIMESTAMP(3),
  "renderedAt"      TIMESTAMP(3),
  "completedAt"     TIMESTAMP(3),
  "failedAt"        TIMESTAMP(3),
  "failedReason"    TEXT,

  CONSTRAINT "MidjourneyJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MidjourneyJob_jobId_key" ON "MidjourneyJob"("jobId");
CREATE UNIQUE INDEX "MidjourneyJob_bridgeJobId_key" ON "MidjourneyJob"("bridgeJobId");
CREATE INDEX "MidjourneyJob_userId_state_idx" ON "MidjourneyJob"("userId", "state");
CREATE INDEX "MidjourneyJob_bridgeJobId_idx" ON "MidjourneyJob"("bridgeJobId");
CREATE INDEX "MidjourneyJob_userId_enqueuedAt_idx" ON "MidjourneyJob"("userId", "enqueuedAt");

ALTER TABLE "MidjourneyJob" ADD CONSTRAINT "MidjourneyJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MidjourneyJob" ADD CONSTRAINT "MidjourneyJob_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MidjourneyJob" ADD CONSTRAINT "MidjourneyJob_referenceId_fkey"
  FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MidjourneyJob" ADD CONSTRAINT "MidjourneyJob_productTypeId_fkey"
  FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: MidjourneyAsset table.
CREATE TABLE "MidjourneyAsset" (
  "id"                 TEXT NOT NULL,
  "midjourneyJobId"    TEXT NOT NULL,
  "gridIndex"          INTEGER NOT NULL,
  "variantKind"        "MJVariantKind" NOT NULL DEFAULT 'GRID',
  "parentAssetId"      TEXT,
  "assetId"            TEXT NOT NULL,
  "generatedDesignId"  TEXT,
  "mjActionLabel"      TEXT,
  "mjImageUrl"         TEXT,
  "importedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MidjourneyAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MidjourneyAsset_assetId_key" ON "MidjourneyAsset"("assetId");
CREATE UNIQUE INDEX "MidjourneyAsset_generatedDesignId_key" ON "MidjourneyAsset"("generatedDesignId");
CREATE INDEX "MidjourneyAsset_midjourneyJobId_idx" ON "MidjourneyAsset"("midjourneyJobId");
CREATE INDEX "MidjourneyAsset_variantKind_idx" ON "MidjourneyAsset"("variantKind");
CREATE INDEX "MidjourneyAsset_assetId_idx" ON "MidjourneyAsset"("assetId");

ALTER TABLE "MidjourneyAsset" ADD CONSTRAINT "MidjourneyAsset_midjourneyJobId_fkey"
  FOREIGN KEY ("midjourneyJobId") REFERENCES "MidjourneyJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MidjourneyAsset" ADD CONSTRAINT "MidjourneyAsset_parentAssetId_fkey"
  FOREIGN KEY ("parentAssetId") REFERENCES "MidjourneyAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MidjourneyAsset" ADD CONSTRAINT "MidjourneyAsset_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MidjourneyAsset" ADD CONSTRAINT "MidjourneyAsset_generatedDesignId_fkey"
  FOREIGN KEY ("generatedDesignId") REFERENCES "GeneratedDesign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
