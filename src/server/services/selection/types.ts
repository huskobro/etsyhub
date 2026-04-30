// Phase 7 — Task 2: Selection types + zod schemas
//
// Bu dosya **yalnız** tip sözleşmesi + runtime input validation içerir.
// Service ve route implementasyonu YOK (sonraki task'ler).
//
// Bağlam:
//   - Spec: docs/plans/2026-04-30-phase7-selection-studio-design.md
//     Section 4 (veri modeli) + Section 7.2 (API kontratları)
//   - Plan: docs/plans/2026-04-30-phase7-selection-studio-plan.md Task 2
//   - Phase 6 zod paterni: src/features/settings/ai-mode/schemas.ts (kısa,
//     temiz; .strict() ve discriminated union kullanım emsali)
//   - TypingConfirmation sentinel: src/components/ui/TypingConfirmation.tsx
//     phrase = "SİL" (Türkçe büyük İ; case-sensitive; trim YOK).
//     `BulkDeleteInputSchema.confirmation` aynı sözleşmeyi server-side
//     enforce eder (design Section 7.2 — "TypingConfirmation enforcement").
//
// Tasarım notları:
//   - `EditOpInputSchema` discriminated union — daha iyi error mesajı
//     (`zod` "invalid_union_discriminator" vs generic union failure).
//   - `FinalizeInputSchema` ve `ArchiveInputSchema` body'i `.strict()` ile
//     boş zorunlu — extra alan reject. Endpoint kontratı no-op body bekler;
//     yanlışlıkla "force" gibi alanlar gelirse fail-fast (CLAUDE.md kuralı).
//   - `ReviewView` placeholder — Phase 6 mapper layer Task 16'da implement
//     edilecek; bu task'te yalnız tip yüzeyi tanımlanır.
//   - `SelectionItemView.review` opsiyonel — review'sız item'lar için
//     `undefined` (Phase 6 köprüsü read-only, design Section 7.4).

import { z } from "zod";

// ────────────────────────────────────────────────────────────
// View types — service/mapper output shape (route'lara akan payload)
// ────────────────────────────────────────────────────────────

/**
 * Phase 6 review mapper output (Task 16'da implement edilecek).
 * Burada placeholder — route ve UI tarafları sözleşmeye karşı tip
 * doğrulaması yapabilsin diye. Mapper kendi katmanında zod ile
 * doğrulayacak; bu tip sade view-model.
 */
export type ReviewView = {
  score: number;
  status: string;
  signals: {
    resolution: string;
    textDetection: string;
    artifactCheck: string;
    trademarkRisk: string;
  };
};

/** Quick-start kaynak metadata'sı (design Section 4.1 `sourceMetadata`). */
export type SourceMetadata = {
  kind: "variation-batch";
  referenceId: string;
  batchId: string;
  productTypeId: string;
  batchCreatedAt: string;
  originalCount: number;
};

/**
 * SelectionSet GET payload (mapper output). DB row değil, view-model —
 * `userId` gibi internal alanlar dışarı sızmaz.
 */
export type SelectionSetView = {
  id: string;
  name: string;
  status: "draft" | "ready" | "archived";
  sourceMetadata: SourceMetadata | null;
  lastExportedAt: string | null;
  finalizedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** SelectionItem view (mapper output) — review opsiyonel embed. */
export type SelectionItemView = {
  id: string;
  generatedDesignId: string;
  sourceAssetId: string;
  editedAssetId: string | null;
  lastUndoableAssetId: string | null;
  editHistoryJson: EditOpRecord[];
  status: "pending" | "selected" | "rejected";
  position: number;
  createdAt: string;
  updatedAt: string;
  review?: ReviewView;
};

/**
 * `editHistoryJson` array elementi — audit log entry.
 *
 * `failed: true` olduğunda `reason` doldurulur (örn. transparent-check
 * fail). Başarılı op'larda her ikisi de undefined.
 */
export type EditOpRecord = {
  op: "crop" | "transparent-check" | "background-remove";
  params?: Record<string, unknown>;
  at: string;
  failed?: boolean;
  reason?: string;
};

/**
 * Set GET payload'ında "şu an çalışan export job" alanı (design Section
 * 6.6). Yoksa null.
 */
export type ActiveExport =
  | {
      jobId: string;
      status: "queued" | "running" | "completed" | "failed";
      downloadUrl?: string;
      expiresAt?: string;
      failedReason?: string;
    }
  | null;

// ────────────────────────────────────────────────────────────
// Zod input schemas — runtime validation (route handler boundary)
// ────────────────────────────────────────────────────────────

/**
 * Manuel set create — design Section 7.2:
 * "body `{ name: string }` (zorunlu, trim sonrası non-empty)"
 */
export const CreateSelectionSetInputSchema = z.object({
  name: z.string().trim().min(1),
});
export type CreateSelectionSetInput = z.infer<
  typeof CreateSelectionSetInputSchema
>;

/**
 * Quick-start (batch-level auto-create) — design Section 2.1.
 * `source` Phase 7 v1'de tek literal: "variation-batch".
 */
export const QuickStartInputSchema = z.object({
  source: z.literal("variation-batch"),
  referenceId: z.string().min(1),
  batchId: z.string().min(1),
  productTypeId: z.string().min(1),
});
export type QuickStartInput = z.infer<typeof QuickStartInputSchema>;

/** Drawer ile çoklu item ekleme — design Section 2.2. */
export const AddItemsInputSchema = z.object({
  items: z
    .array(z.object({ generatedDesignId: z.string().min(1) }))
    .min(1),
});
export type AddItemsInput = z.infer<typeof AddItemsInputSchema>;

/** Tek item status değişimi — design Section 4.4. */
export const UpdateItemStatusInputSchema = z.object({
  status: z.enum(["pending", "selected", "rejected"]),
});
export type UpdateItemStatusInput = z.infer<
  typeof UpdateItemStatusInputSchema
>;

/** Bulk status değişimi — design Section 7.2 (`PATCH /items/bulk`). */
export const BulkUpdateStatusInputSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
  status: z.enum(["pending", "selected", "rejected"]),
});
export type BulkUpdateStatusInput = z.infer<typeof BulkUpdateStatusInputSchema>;

/**
 * Bulk hard-delete — TypingConfirmation server-side enforcement.
 *
 * `confirmation` literal `"SİL"` (Türkçe büyük İ; U+0130 dotted I).
 * Phase 6 TypingConfirmation primitive sözleşmesi:
 *   - case-sensitive
 *   - trim YOK (`" SİL "` reject)
 *   - tam string compare
 * Server-side aynı sözleşme — `z.literal` zaten case-sensitive ve
 * whitespace-strict.
 */
export const BulkDeleteInputSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
  confirmation: z.literal("SİL"),
});
export type BulkDeleteInput = z.infer<typeof BulkDeleteInputSchema>;

/**
 * Edit op input — discriminated union over `op` field.
 *
 * - `crop` zorunlu `params.ratio` ile (whitelist enum).
 * - `transparent-check` ve `background-remove` params yok.
 *
 * Heavy endpoint (`/edit/heavy`) ayrı route — fakat input shape
 * paylaşılır: client `{ op: "background-remove" }` yollar; route
 * içinde "instant mi heavy mi" path bazlı belirlenir, schema değil.
 */
export const EditOpInputSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("crop"),
    params: z.object({
      ratio: z.enum(["2:3", "4:5", "1:1", "3:4"]),
    }),
  }),
  z.object({
    op: z.literal("transparent-check"),
  }),
  z.object({
    op: z.literal("background-remove"),
  }),
]);
export type EditOpInput = z.infer<typeof EditOpInputSchema>;

/** Reorder — bulk position update (atomik). */
export const ReorderInputSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
});
export type ReorderInput = z.infer<typeof ReorderInputSchema>;

/**
 * Finalize action — body BOŞ zorunlu.
 *
 * `.strict()` extra alanları reject eder. State geçişi `draft → ready`
 * gate kontrolü service katmanında (Phase 7 Task 4+); schema yalnız
 * input shape'i kilitler — yanlışlıkla `{ force: true }` gibi alanlar
 * fail-fast.
 */
export const FinalizeInputSchema = z.object({}).strict();
export type FinalizeInput = z.infer<typeof FinalizeInputSchema>;

/** Archive action — body BOŞ zorunlu (FinalizeInputSchema ile aynı disiplin). */
export const ArchiveInputSchema = z.object({}).strict();
export type ArchiveInput = z.infer<typeof ArchiveInputSchema>;
