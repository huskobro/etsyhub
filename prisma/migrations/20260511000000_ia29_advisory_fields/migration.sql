-- IA-29 (CLAUDE.md Madde V) — AI advisory fields.
--
-- Worker no longer writes reviewStatus (operator truth).
-- AI outcome lives in reviewSuggestedStatus (advisory, non-binding).
-- reviewProviderRawScore is raw provider value for debug/audit only.
-- Both columns are nullable — legacy rows are unaffected, no backfill needed.
--
-- Applied to: GeneratedDesign, LocalLibraryAsset

ALTER TABLE "GeneratedDesign"
  ADD COLUMN "reviewSuggestedStatus" "ReviewStatus",
  ADD COLUMN "reviewProviderRawScore" INTEGER;

ALTER TABLE "LocalLibraryAsset"
  ADD COLUMN "reviewSuggestedStatus" "ReviewStatus",
  ADD COLUMN "reviewProviderRawScore" INTEGER;
