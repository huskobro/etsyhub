// Phase 7 — Task 11: Manifest schema v1 (zod)
//
// Bu schema Phase 8 Mockup Studio handoff'unun sigortasıdır.
// `tests/contract/manifest-schema-v1.test.ts` bu schema'yı runtime
// validation ile doğrular.
//
// PII disiplini: `exportedBy` `.strict()` ile kilitli — yalnız `userId`.
// `userEmail`, `role` veya başka alan eklenirse zod reject eder. Bu
// disiplin Phase 7 Task 11 tarafından korunur ve forward-compat'la
// (yeni v2 ekleme; v1 destek korunur) genişletilir.
//
// Sözleşme: docs/plans/2026-04-30-phase7-selection-studio-design.md
// Section 6.3 (manifest schema) + Section 10.3 (sözleşme test rehberi)

import { z } from "zod";

const ReviewSchema = z.object({
  score: z.number(),
  status: z.string(),
  signals: z.object({
    resolution: z.string(),
    textDetection: z.string(),
    artifactCheck: z.string(),
    trademarkRisk: z.string(),
  }),
});

export const ManifestV1Schema = z.object({
  schemaVersion: z.literal("1"),
  exportedAt: z.string().datetime(),
  // PII disiplini: strict — yalnız userId. userEmail/role gibi alanlar reject.
  exportedBy: z.object({ userId: z.string().min(1) }).strict(),
  set: z.object({
    id: z.string().min(1),
    name: z.string(),
    status: z.enum(["draft", "ready", "archived"]),
    createdAt: z.string().datetime(),
    sourceMetadata: z.record(z.unknown()).nullable(),
  }),
  items: z.array(
    z.object({
      filename: z.string().min(1),
      originalFilename: z.string().min(1).optional(),
      generatedDesignId: z.string().min(1),
      sourceAssetId: z.string().min(1),
      editedAssetId: z.string().min(1).optional(),
      editHistory: z.array(z.unknown()),
      review: ReviewSchema.optional(),
      status: z.enum(["pending", "selected", "rejected"]),
      metadata: z.object({
        width: z.number().int().nonnegative(),
        height: z.number().int().nonnegative(),
        mimeType: z.string().min(1),
      }),
    }),
  ),
});

export type ManifestV1 = z.infer<typeof ManifestV1Schema>;
