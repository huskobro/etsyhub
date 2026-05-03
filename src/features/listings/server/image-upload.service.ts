/**
 * Phase 9 V1 — Listing image upload pipeline (foundation).
 *
 * Submit service `createDraftListing` başarılı olduktan sonra çağrılır:
 *   1. Listing.imageOrderJson'dan render listesini al (cover-first)
 *   2. Her render için storage'tan buffer download
 *   3. Etsy V3 uploadListingImage (rank 1-N, sıralı)
 *   4. Tek bir image upload başarısız olursa partial uyarı + remaining
 *      upload'ları dene (cover öncelik); tümü başarısız olursa full fail
 *
 * V1 sözleşmesi:
 *   - Cover (packPosition=0) rank=1 olarak ilk upload edilir
 *   - Diğer renderlar packPosition ASC sırasıyla rank=2..N
 *   - Etsy listing'e maksimum 10 image (V1 cap)
 *   - mimeType MockupRender storage'tan inferred edilemiyorsa "image/png" varsayılır
 *     (Phase 8 sharp local renderer PNG üretir — production'da güvenli varsayım)
 *
 * Hata stratejisi:
 *   - Tüm upload'lar başarılı → success array
 *   - Bazıları başarısız → partial=true (typed error YOK; caller listing'i
 *     PUBLISHED işaretleyebilir, failedReason'a partial info düşer)
 *   - Hepsi başarısız (cover dahil) → ListingImageUploadAllFailedError —
 *     caller listing FAILED + Etsy taraf cleanup endişesi (V1.1+: orphan
 *     listing detection)
 *
 * Re-use:
 *   - getStorage() download
 *   - etsyV3Provider.uploadListingImage (mevcut; URL kind reject)
 *   - cover invariant packPosition=0 (Phase 8 emsali)
 */

import { AppError } from "@/lib/errors";
import { getStorage } from "@/providers/storage";
import { getEtsyProvider, DEFAULT_ETSY_PROVIDER_ID } from "@/providers/etsy";
import type { ListingImageOrderEntry } from "@/features/listings/types";

// V1 cap (Etsy listing image limit)
const MAX_LISTING_IMAGES = 10;

// V1 default mimeType — Phase 8 sharp local renderer PNG üretir.
// MockupRender'da explicit mimeType field'ı yok; storage object metadata
// güvenilir değil (S3/MinIO bazen content-type set edilmez).
const DEFAULT_RENDER_MIMETYPE = "image/png";

// ────────────────────────────────────────────────────────────
// Custom error classes
// ────────────────────────────────────────────────────────────

export class ListingImageUploadAllFailedError extends AppError {
  constructor(
    message: string,
    public readonly failedRanks: number[],
  ) {
    super(
      `Listing image upload tamamen başarısız: ${message}`,
      "LISTING_IMAGE_UPLOAD_ALL_FAILED",
      502,
      { failedRanks },
    );
  }
}

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type ImageUploadAttempt = {
  rank: number;
  packPosition: number;
  renderId: string;
  isCover: boolean;
} & (
  | { ok: true; etsyImageId: string }
  | { ok: false; error: string }
);

export type ImageUploadResult = {
  successCount: number;
  failedCount: number;
  attempts: ImageUploadAttempt[];
  /** Partial fail: hiçbir attempt başarılıysa "partial"; tümü başarısızsa caller AllFailedError throw eder. */
  partial: boolean;
};

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

/**
 * Cover-first ordering — packPosition=0 cover, rank=1.
 *
 * imageOrder zaten packPosition ASC sıralı (handoff snapshot disipline);
 * extra defensive sort (eğer JSON manuel düzenlenmişse).
 */
function orderForUpload(imageOrder: ListingImageOrderEntry[]): ListingImageOrderEntry[] {
  const sorted = [...imageOrder].sort((a, b) => a.packPosition - b.packPosition);
  // Etsy 10 image cap
  return sorted.slice(0, MAX_LISTING_IMAGES);
}

/**
 * Listing image upload — foundation pipeline.
 *
 * @param opts.etsyListingId Etsy V3 listing_id (createDraftListing sonucu)
 * @param opts.imageOrder Listing.imageOrderJson (snapshot, packPosition ASC)
 * @param opts.accessToken Decrypted Etsy access token
 * @param opts.shopId Etsy shop_id
 * @returns Upload sonuçları + partial flag
 *
 * Throw:
 *   - ListingImageUploadAllFailedError: hiçbir image upload başarılı olmadıysa
 *
 * Caller (submit service) partial durumu listing.failedReason'a not düşer
 * ama listing.status'u PUBLISHED olarak işaretleyebilir (Etsy listing var).
 */
export async function uploadListingImages(opts: {
  etsyListingId: string;
  imageOrder: ListingImageOrderEntry[];
  accessToken: string;
  shopId: string;
}): Promise<ImageUploadResult> {
  const { etsyListingId, accessToken, shopId } = opts;
  const ordered = orderForUpload(opts.imageOrder);

  if (ordered.length === 0) {
    // imageOrder boş — listing image'sız oluşturuldu; image upload skip
    return {
      successCount: 0,
      failedCount: 0,
      attempts: [],
      partial: false,
    };
  }

  const storage = getStorage();
  const provider = getEtsyProvider(DEFAULT_ETSY_PROVIDER_ID);
  const attempts: ImageUploadAttempt[] = [];

  // Sequential upload (Etsy rate limit + cover öncelik garantisi).
  // V1 foundation: paralel upload yok; image sayısı genelde küçük (cap 10).
  for (let i = 0; i < ordered.length; i++) {
    const entry = ordered[i]!;
    const rank = i + 1; // Etsy rank 1-indexed

    try {
      const buffer = await storage.download(entry.outputKey);
      const result = await provider.uploadListingImage(
        {
          etsyListingId,
          imageSource: {
            kind: "buffer",
            data: buffer,
            mimeType: DEFAULT_RENDER_MIMETYPE,
          },
          rank,
        },
        { accessToken, shopId },
      );
      attempts.push({
        rank,
        packPosition: entry.packPosition,
        renderId: entry.renderId,
        isCover: entry.isCover,
        ok: true,
        etsyImageId: result.etsyImageId,
      });
    } catch (err) {
      attempts.push({
        rank,
        packPosition: entry.packPosition,
        renderId: entry.renderId,
        isCover: entry.isCover,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const successCount = attempts.filter((a) => a.ok).length;
  const failedCount = attempts.filter((a) => !a.ok).length;

  if (successCount === 0) {
    const failedRanks = attempts.filter((a) => !a.ok).map((a) => a.rank);
    const errors = attempts
      .filter((a): a is ImageUploadAttempt & { ok: false; error: string } => !a.ok)
      .map((a) => `rank=${a.rank}: ${a.error}`)
      .join("; ");
    throw new ListingImageUploadAllFailedError(errors.slice(0, 400), failedRanks);
  }

  return {
    successCount,
    failedCount,
    attempts,
    partial: failedCount > 0,
  };
}
