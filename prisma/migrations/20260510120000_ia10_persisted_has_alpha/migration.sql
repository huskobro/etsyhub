-- IA Phase 11 — persisted hasAlpha signal for the review focus rail.
--
-- Adds a nullable Boolean column to both LocalLibraryAsset and Asset
-- so the scan worker (LocalLibraryAsset) and Midjourney import path
-- (Asset) can persist the real Sharp `metadata.hasAlpha` probe instead
-- of relying on the format-level mimeType hint. Nullable so legacy
-- rows fall back to the format hint until they are re-scanned or
-- re-imported.
--
-- Both ALTER statements are additive + nullable — backward compatible
-- on production data. No backfill required (UI degrades to format hint
-- when the column is null).

ALTER TABLE "LocalLibraryAsset" ADD COLUMN "hasAlpha" BOOLEAN;
ALTER TABLE "Asset" ADD COLUMN "hasAlpha" BOOLEAN;
