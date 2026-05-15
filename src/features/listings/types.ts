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
/**
 * Pass 36 — `signedUrl` opsiyonel alan eklendi. Pre-Pass 36: AssetSection
 * `<img src={img.outputKey}>` ile raw storage key kullanıyordu (mockup-renders/...png)
 * → 404 broken image. JSON snapshot legacy entry'lerinde signedUrl yok
 * (`undefined`); UI fallback olarak görseli gizler. Yeni listingler route
 * tarafında signed URL hesaplar.
 *
 * outputKey raw kalır (ZIP download endpoint hâlâ kullanır).
 */
/**
 * Phase 100 — kind discriminator (sözleşme #11 + #13.F).
 *
 * Phase 9 baseline yalnız "mockup-render" entry kabul ediyordu
 * (MockupJob → MockupRender → Listing handoff). Phase 100'de Frame
 * mode export persistence (FrameExport row) eklenince Listing'e
 * "frame-export" entry kind'ı geldi: operator Frame Studio'da
 * ürettiği PNG'yi Product detail listing'e doğal olarak yansıtır.
 *
 * Backward-compat: legacy entry'ler `kind` field'ı taşımayacak
 * (Phase 9 öncesi imageOrderJson row'ları). UI helper'ları
 * `kind === "frame-export"` ile ayırt eder; eksik kind → "mockup-render"
 * default (legacy parity). */
export type ListingImageOrderEntry =
  | {
      kind?: "mockup-render";
      packPosition: number;
      renderId: string;
      outputKey: string;
      templateName: string;
      isCover: boolean;
      signedUrl?: string | null;
    }
  | {
      kind: "frame-export";
      packPosition: number;
      /** Phase 100 — FrameExport.id reference */
      frameExportId: string;
      /** MinIO storageKey (Phase 100 — signedUrl refresh için kalıcı kaynak) */
      outputKey: string;
      /** Operator-facing label (frame aspect + scene mode özeti) */
      templateName: string;
      isCover: boolean;
      signedUrl?: string | null;
      /** Frame aspect (1:1 / 4:5 / 9:16 / 16:9 / 3:4) — UI badge için */
      frameAspect?: string;
    };

/**
 * Phase 100 — Helper: entry'nin stable id'i (UI key + log için).
 *
 * mockup-render → renderId; frame-export → frameExportId.
 * Discriminated union narrow yardımcısı; legacy entry'ler (kind
 * undefined) → renderId fallback. */
export function imageOrderEntryId(entry: ListingImageOrderEntry): string {
  if (entry.kind === "frame-export") return entry.frameExportId;
  return entry.renderId;
}

/** Phase 100 — Helper: mockup-render guard (renderId narrow için). */
export function isMockupRenderEntry(
  entry: ListingImageOrderEntry,
): entry is Extract<ListingImageOrderEntry, { renderId: string }> {
  return entry.kind !== "frame-export";
}

/** Phase 100 — Helper: frame-export guard. */
export function isFrameExportEntry(
  entry: ListingImageOrderEntry,
): entry is Extract<ListingImageOrderEntry, { kind: "frame-export" }> {
  return entry.kind === "frame-export";
}

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
 *
 * Pass 35 — coverThumbnailUrl alan eklendi. Server `/api/listings` route'u
 * cover render → thumbnailKey/outputKey → storage signed URL (1h TTL)
 * üretir. Render SUCCESS değilse veya storage fail olursa null. UI
 * thumbnail-yoksa fallback (placeholder + ImageOff icon) render eder.
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
  coverThumbnailUrl: string | null;
};

