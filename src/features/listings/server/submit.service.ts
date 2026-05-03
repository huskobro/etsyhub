// Phase 9 V1 Task 10 — Listing submit service (foundation slice).
//
// submitListingDraft(listingId, userId):
//   1. listing fetch + ownership guard (productType include)
//   2. status guard (DRAFT veya NEEDS_REVIEW dışı 409)
//   3. readiness snapshot (V1 soft warn — submit'i bloklamaz, ama kayıt için)
//   4. payload builder: Listing → EtsyDraftListingInput (taxonomyId resolve)
//   5. connection resolve (resolveEtsyConnection — typed throw)
//   6. taxonomy resolve (resolveEtsyTaxonomyId — env-based; eksikse 422)
//   7. provider.createDraftListing
//   8. image upload pipeline (uploadListingImages — packPosition ASC, cover-first)
//   9. listing'i SUBMITTED state'e ÇEKMEDEN, etsyListingId + submittedAt
//      yaz; status 'PUBLISHED'a (V1 sözleşmesi: Etsy draft = listingHub
//      teslim noktası; gerçek "publish" Etsy admin panelinden manuel).
//
// V1 sözleşmesi: bizim Listing.status için "submit" sonrası nereye gidecek?
// - Etsy draft create + image upload başarılı → bizim DB'de status: PUBLISHED
//   (Etsy draft = "yayınlamak için hazır" anlamı, kullanıcı Etsy admin'de
//   manual publish yapacak — bu V1 sınırı).
// - Image upload PARTIAL → status PUBLISHED + failedReason mesajı (Etsy
//   listing var, sadece bazı image'lar eksik; kullanıcı Etsy admin'den
//   tamamlayabilir).
// - HATA (draft create veya tüm image upload başarısız) → status: FAILED
//   + failedReason (typed error message). Image upload all-failed durumunda
//   etsyListingId persist edilir (orphan listing kullanıcı Etsy admin'de
//   yönetebilir).
//
// state.ts'e DRAFT → PUBLISHED transition'ı eklenmesi GEREKLİ. Ama state.ts
// dokunulmaz; bunun yerine submit service kendi `assertSubmittable` guard'ını
// yapar ve Prisma direct update kullanır (state.ts current invariant: V1
// "no transitions" ama bu submit için PHASE 9 carry-forward; V1 lock'a
// dokunmamak için service-local guard).
//
// V1 LOCK: provider çağrısı V1 foundation; ETSY_CLIENT_ID yoksa
// EtsyNotConfiguredError. Connection yoksa EtsyConnectionNotFoundError.
// Taxonomy mapping yoksa EtsyTaxonomyMissingError 422.

import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { isListingEditable } from "./state";
import { computeReadiness, allReadinessPass } from "./readiness.service";
import {
  getEtsyProvider,
  resolveEtsyConnectionWithRefresh,
  DEFAULT_ETSY_PROVIDER_ID,
  isEtsyConfigured,
  EtsyNotConfiguredError,
  resolveEtsyTaxonomyId,
  EtsyTaxonomyMissingError,
} from "@/providers/etsy";
import type { EtsyDraftListingInput } from "@/providers/etsy";
import { buildProviderSnapshot } from "@/providers/review/snapshot";
import type { ListingStatus } from "@prisma/client";
import {
  uploadListingImages,
  ListingImageUploadAllFailedError,
  type ImageUploadResult,
} from "./image-upload.service";
import type { ListingImageOrderEntry } from "@/features/listings/types";

// ────────────────────────────────────────────────────────────
// Submit-specific errors
// ────────────────────────────────────────────────────────────

export class ListingSubmitNotFoundError extends AppError {
  constructor() {
    super("Listing bulunamadı", "LISTING_SUBMIT_NOT_FOUND", 404);
  }
}

export class ListingSubmitNotEditableError extends AppError {
  constructor() {
    super(
      "Listing bu durumda gönderilemez (sadece DRAFT/NEEDS_REVIEW)",
      "LISTING_SUBMIT_NOT_EDITABLE",
      409,
    );
  }
}

export class ListingSubmitMissingFieldsError extends AppError {
  constructor(missing: string[]) {
    super(
      `Listing zorunlu alanları eksik: ${missing.join(", ")}`,
      "LISTING_SUBMIT_MISSING_FIELDS",
      422,
      { missing },
    );
  }
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

export type SubmitListingResult = {
  /** Listing'in yeni durumu (PUBLISHED on success / partial-image, FAILED on caught error). */
  status: "PUBLISHED" | "FAILED";
  /** Etsy listing_id (success path veya partial / image-all-failed path), yoksa null. */
  etsyListingId: string | null;
  /** Hata mesajı veya partial info (FAILED path / partial image upload). */
  failedReason: string | null;
  /** Provider snapshot, audit için. */
  providerSnapshot: string;
  /** Image upload sonucu (success path) — partial varsa attempts array'i ile dürüst raporla. */
  imageUpload?: {
    successCount: number;
    failedCount: number;
    partial: boolean;
  };
};

/**
 * V1 Listing → EtsyDraftListingInput payload builder.
 *
 * Hardcoded V1 defaults (caller değiştiremez):
 *   - whoMade: "i_did"
 *   - whenMade: "made_to_order"
 *   - quantity: 1
 *   - isDigital: true (printable/digital download odak)
 *
 * taxonomyId artık caller (submit pipeline) tarafından resolve edilir
 * (resolveEtsyTaxonomyId — env mapping, foundation slice). Geçilen değer
 * pozitif tam sayı; null kabul etmiyor.
 */
export function buildEtsyDraftPayload(
  listing: {
    title: string | null;
    description: string | null;
    tags: string[];
    materials: string[];
    priceCents: number | null;
  },
  taxonomyId: number,
): EtsyDraftListingInput {
  // Zorunlu alan check'i — burada throw etmiyoruz; üst seviye assertSubmittable yapıyor.
  const title = listing.title ?? "";
  const description = listing.description ?? "";
  const priceCents = listing.priceCents ?? 0;

  return {
    title,
    description,
    priceUsd: priceCents / 100,
    tags: listing.tags,
    materials: listing.materials,
    taxonomyId,                // V1 foundation: caller resolve etti
    isDigital: true,           // V1 default
    quantity: 1,               // V1 lock
    whoMade: "i_did",          // V1 lock
    whenMade: "made_to_order", // V1 lock
  };
}

/**
 * V1 minimal submit guard — DRAFT/NEEDS_REVIEW + zorunlu alanlar dolu.
 * Soft-warn readiness check'i submit'i BLOKLAMAZ (K3 lock); ama tamamen
 * boş alanları (title null, price null) zorunlu olarak ister.
 */
export function assertSubmittable(listing: {
  status: ListingStatus;
  title: string | null;
  description: string | null;
  priceCents: number | null;
}): void {
  if (!isListingEditable(listing.status)) {
    throw new ListingSubmitNotEditableError();
  }
  const missing: string[] = [];
  if (!listing.title || listing.title.trim().length === 0) missing.push("title");
  if (!listing.description || listing.description.trim().length === 0) missing.push("description");
  if (!listing.priceCents || listing.priceCents <= 0) missing.push("price");
  if (missing.length > 0) {
    throw new ListingSubmitMissingFieldsError(missing);
  }
}

/**
 * ProductType key resolver — submit pipeline'da taxonomy lookup için.
 *
 * Öncelik:
 *   1. listing.productType?.key (Listing.productTypeId join)
 *   2. listing.category fallback (free-form string → normalize: lowercase + underscore)
 *      Örn. "Wall Art" → "wall_art"; ProductType seed key'leriyle örtüşmesi
 *      umulur. Örtüşmezse caller `resolveEtsyTaxonomyId` MissingError fırlatır.
 *
 * İkisi de yoksa MissingError 422 (sistem yöneticisine honest sinyal).
 */
function resolveProductTypeKey(listing: {
  productType: { key: string } | null;
  category: string | null;
}): string {
  if (listing.productType?.key) return listing.productType.key;
  if (listing.category && listing.category.trim().length > 0) {
    return listing.category.trim().toLowerCase().replace(/\s+/g, "_");
  }
  throw new EtsyTaxonomyMissingError("(productType ve category boş)");
}

export async function submitListingDraft(
  listingId: string,
  userId: string,
): Promise<SubmitListingResult> {
  // 1. Listing fetch + ownership + productType include
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    include: { productType: true },
  });
  if (!listing || listing.userId !== userId) {
    throw new ListingSubmitNotFoundError();
  }

  // 2. Status + zorunlu alan guard
  assertSubmittable(listing);

  // 3. Readiness snapshot (V1 soft warn — log'a yazıyoruz, blocking değil)
  const readiness = computeReadiness(listing);
  // V1 lock K3: readiness submit'i bloklamaz.
  // Phase 9.1+: hard gate (severity "error" check'leri).
  void allReadinessPass(readiness);

  // 4. Etsy config guard
  if (!isEtsyConfigured()) {
    throw new EtsyNotConfiguredError();
  }

  // 5. Connection resolve + opportunistic token refresh
  // (resolveEtsyConnectionWithRefresh — typed throw: NotFound / TokenMissing /
  // TokenRefreshFailed; refresh başarılı ise sessizce yeni token döner).
  const { accessToken, shopId } = await resolveEtsyConnectionWithRefresh(userId);

  // 6. Taxonomy resolve (B+C entegrasyon — env mapping, foundation)
  const productTypeKey = resolveProductTypeKey(listing);
  const taxonomyId = resolveEtsyTaxonomyId(productTypeKey); // throws MissingError 422

  // 7. Provider call — draft create
  const provider = getEtsyProvider(DEFAULT_ETSY_PROVIDER_ID);
  const payload = buildEtsyDraftPayload(listing, taxonomyId);

  // Provider snapshot — Phase 6 buildProviderSnapshot reuse
  const providerSnapshot = buildProviderSnapshot(
    `${provider.id}-${provider.apiVersion}`,
    new Date(),
  );

  let createResult: { etsyListingId: string; state: "draft" };
  try {
    createResult = await provider.createDraftListing(payload, {
      accessToken,
      shopId,
    });
  } catch (err) {
    // Draft create fail — listing FAILED, image upload denenmedi
    const failedReason =
      err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
    await db.listing.update({
      where: { id: listingId },
      data: {
        status: "FAILED",
        failedReason,
        submittedAt: new Date(),
      },
    });
    throw err;
  }

  // 8. Image upload pipeline (B entegrasyon — packPosition ASC, cover-first)
  let imageUploadResult: ImageUploadResult | null = null;
  let imageUploadFailedReason: string | null = null;
  try {
    const imageOrder =
      (listing.imageOrderJson as ListingImageOrderEntry[] | null) ?? [];
    imageUploadResult = await uploadListingImages({
      etsyListingId: createResult.etsyListingId,
      imageOrder,
      accessToken,
      shopId,
    });
    if (imageUploadResult.partial) {
      const failedRanks = imageUploadResult.attempts
        .filter((a) => !a.ok)
        .map((a) => `rank=${a.rank}`);
      imageUploadFailedReason = `Image upload kısmen başarısız: ${imageUploadResult.successCount}/${imageUploadResult.attempts.length} yüklendi (başarısızlar: ${failedRanks.join(", ")})`;
    }
  } catch (err) {
    // ListingImageUploadAllFailedError — listing draft Etsy'de var ama image yok.
    // V1 sözleşmesi: bunu listing FAILED'a çek ama etsyListingId persist et
    // (orphan listing kullanıcı Etsy admin'den yönetebilir).
    const failedReason =
      err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
    await db.listing.update({
      where: { id: listingId },
      data: {
        status: "FAILED",
        etsyListingId: createResult.etsyListingId, // Etsy tarafı listing yaratıldı
        failedReason,
        submittedAt: new Date(),
      },
    });
    throw err;
  }

  // 9. Listing PUBLISHED (Etsy draft = bizim PUBLISHED V1 sözleşmesi)
  // Partial image upload varsa failedReason'a not düşeriz ama status PUBLISHED
  // (Etsy listing var; kullanıcı Etsy admin'de eksik image'ları manuel ekleyebilir).
  await db.listing.update({
    where: { id: listingId },
    data: {
      status: "PUBLISHED",
      etsyListingId: createResult.etsyListingId,
      submittedAt: new Date(),
      publishedAt: new Date(),
      failedReason: imageUploadFailedReason, // Partial varsa not, tam başarıda null
    },
  });

  return {
    status: "PUBLISHED",
    etsyListingId: createResult.etsyListingId,
    failedReason: imageUploadFailedReason,
    providerSnapshot,
    imageUpload: imageUploadResult
      ? {
          successCount: imageUploadResult.successCount,
          failedCount: imageUploadResult.failedCount,
          partial: imageUploadResult.partial,
        }
      : undefined,
  };
}

// Re-export for downstream consumers (image upload error class).
export { ListingImageUploadAllFailedError };
