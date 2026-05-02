// Phase 9 V1 — Listing types (foundation slice).
//
// K1 onaylandı: Listing modelini additive extend; bu type'lar Phase 8
// köprü alanları üzerine inşa edilir. Legacy alanlar (generatedDesignId,
// mockups[], etsyDraftId) view'da expose edilmez.
//
// K3 onaylandı: ReadinessCheck soft warn (severity "warn" V1, "error" V1.1).
// Spec §6.3 + §7.

import type { ListingStatus } from "@prisma/client";

export type ListingStatusValue = ListingStatus;

/**
 * imageOrderJson içindeki tek entry — handoff anında MockupRender'dan
 * snapshot alınır (Phase 8 packPosition ASC + success render only).
 */
export type ListingImageOrderEntry = {
  packPosition: number;
  renderId: string;
  outputKey: string;
  templateName: string;
  isCover: boolean;
};

/**
 * Readiness check item — Spec §7.1 (V1 6 check, soft warn).
 *
 * V1 implementation: Task 8 (readiness service) + Task 24 (UI checklist).
 * Foundation slice'ta sadece type tanımı; gerçek check fonksiyonu sonraki
 * task.
 */
export type ReadinessCheck = {
  field: "title" | "description" | "tags" | "category" | "price" | "cover";
  pass: boolean;
  severity: "warn" | "error";
  message: string;
};
