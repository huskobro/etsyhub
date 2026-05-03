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

/**
 * Phase 9 V1 — Listing draft detay view (GET /api/listings/draft/[id], PATCH response).
 *
 * Provider-agnostik: legacy alanlar (generatedDesignId, etsyDraftId,
 * productTypeId, mockups[], deletedAt) expose edilmiyor — K6 lock.
 *
 * imageOrder PARSED — handoff sırasında JSON snapshot alındı, view'da
 * tipli array.
 *
 * readiness server-side compute (computeReadiness — Task 8 readiness
 * service); UI checklist render eder, V1 soft warn (K3 lock).
 */
export type ListingDraftView = {
  id: string;
  status: ListingStatus;
  mockupJobId: string | null;
  coverRenderId: string | null;
  imageOrder: ListingImageOrderEntry[];
  title: string | null;
  description: string | null;
  tags: string[];
  category: string | null;
  priceCents: number | null;
  materials: string[];
  submittedAt: string | null;
  publishedAt: string | null;
  etsyListingId: string | null;
  failedReason: string | null;
  readiness: ReadinessCheck[];
  /**
   * Phase 9 V1 — Submit sonrası UX paketi.
   *
   * Listing'in sahibi olan store'un Etsy bağlantısı varsa shop bilgisi.
   * UI "Etsy'de Aç" + "Mağazaya Git" linkleri için kullanır.
   * Connection yoksa null (kullanıcı henüz Etsy bağlantısı kurmadı).
   */
  etsyShop: {
    shopId: string;
    shopName: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Phase 9 V1 — Listing compact index view (GET /api/listings).
 *
 * readiness DÖNMEZ (perf — UI detail view'da çağrılır).
 */
export type ListingIndexView = {
  id: string;
  status: ListingStatus;
  mockupJobId: string | null;
  coverRenderId: string | null;
  title: string | null;
  priceCents: number | null;
  submittedAt: string | null;
  publishedAt: string | null;
  etsyListingId: string | null;
  createdAt: string;
  updatedAt: string;
};

