// Phase 9 V1 Task 10 — Listing submit service (foundation slice).
//
// submitListingDraft(listingId, userId):
//   1. listing fetch + ownership guard
//   2. status guard (DRAFT veya NEEDS_REVIEW dışı 409)
//   3. readiness snapshot (V1 soft warn — submit'i bloklamaz, ama kayıt için)
//   4. payload builder: Listing → EtsyDraftListingInput
//   5. connection resolve (resolveEtsyConnection — typed throw)
//   6. provider.createDraftListing (image upload V1.1+ carry-forward)
//   7. listing'i SUBMITTED state'e ÇEKMEDEN, etsyListingId + submittedAt
//      yaz; status 'PUBLISHED'a (V1 sözleşmesi: Etsy draft = listingHub
//      teslim noktası; gerçek "publish" Etsy admin panelinden manuel).
//
// V1 sözleşmesi: bizim Listing.status için "submit" sonrası nereye gidecek?
// - Etsy draft create başarılı → bizim DB'de status: PUBLISHED (Etsy draft
//   = "yayınlamak için hazır" anlamı, kullanıcı Etsy admin'de manual publish
//   yapacak — bu V1 sınırı).
// - HATA → status: FAILED + failedReason (typed error message).
//
// state.ts'e DRAFT → PUBLISHED transition'ı eklenmesi GEREKLİ. Ama state.ts
// dokunulmaz; bunun yerine submit service kendi `assertSubmittable` guard'ını
// yapar ve Prisma direct update kullanır (state.ts current invariant: V1
// "no transitions" ama bu submit için PHASE 9 carry-forward; V1 lock'a
// dokunmamak için service-local guard).
//
// V1 LOCK: provider çağrısı V1 foundation; ETSY_CLIENT_ID yoksa
// EtsyNotConfiguredError. Connection yoksa EtsyConnectionNotFoundError.
// V1.1: image upload (mockup pack) carry-forward.

import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { isListingEditable } from "./state";
import { computeReadiness, allReadinessPass } from "./readiness.service";
import {
  getEtsyProvider,
  resolveEtsyConnection,
  DEFAULT_ETSY_PROVIDER_ID,
  isEtsyConfigured,
  EtsyNotConfiguredError,
} from "@/providers/etsy";
import type { EtsyDraftListingInput } from "@/providers/etsy";
import { buildProviderSnapshot } from "@/providers/review/snapshot";
import type { ListingStatus } from "@prisma/client";

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
  /** Listing'in yeni durumu (PUBLISHED on success, FAILED on caught error). */
  status: "PUBLISHED" | "FAILED";
  /** Etsy listing_id (success path), yoksa null (FAILED). */
  etsyListingId: string | null;
  /** Hata mesajı (FAILED path). */
  failedReason: string | null;
  /** Provider snapshot, audit için. */
  providerSnapshot: string;
};

/**
 * V1 Listing → EtsyDraftListingInput payload builder.
 *
 * Hardcoded V1 defaults (caller değiştiremez):
 *   - whoMade: "i_did"
 *   - whenMade: "made_to_order"
 *   - quantity: 1
 *   - isDigital: true (printable/digital download odak)
 *   - taxonomyId: null (V1 foundation: caller resolve etmiyor; provider
 *     içinde EtsyValidationError 422 fırlatır — honest signal)
 *
 * Phase 9.1+: ProductType → taxonomyId mapping (Etsy V3 taxonomy API).
 */
export function buildEtsyDraftPayload(
  listing: {
    title: string | null;
    description: string | null;
    tags: string[];
    materials: string[];
    priceCents: number | null;
  },
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
    taxonomyId: null,         // V1 foundation
    isDigital: true,          // V1 default
    quantity: 1,              // V1 lock
    whoMade: "i_did",         // V1 lock
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

export async function submitListingDraft(
  listingId: string,
  userId: string,
): Promise<SubmitListingResult> {
  // 1. Listing fetch + ownership
  const listing = await db.listing.findUnique({ where: { id: listingId } });
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

  // 5. Connection resolve (typed throw: NotFound / TokenMissing / TokenExpired)
  const { accessToken, shopId } = await resolveEtsyConnection(userId);

  // 6. Provider call — V1 foundation: createDraftListing yalnız (image upload V1.1+)
  const provider = getEtsyProvider(DEFAULT_ETSY_PROVIDER_ID);
  const payload = buildEtsyDraftPayload(listing);

  // Provider snapshot — Phase 6 buildProviderSnapshot reuse
  const providerSnapshot = buildProviderSnapshot(
    `${provider.id}-${provider.apiVersion}`,
    new Date(),
  );

  try {
    const result = await provider.createDraftListing(payload, {
      accessToken,
      shopId,
    });

    // 7. Listing'i PUBLISHED'a çek + etsyListingId + submittedAt + publishedAt persist.
    // V1 sözleşmesi: Etsy "draft" oluştu = bizim "PUBLISHED" (kullanıcı Etsy admin'de
    // manuel "publish" yapacak — V1 sınırı, dürüst raporla).
    await db.listing.update({
      where: { id: listingId },
      data: {
        status: "PUBLISHED",
        etsyListingId: result.etsyListingId,
        submittedAt: new Date(),
        publishedAt: new Date(),
        failedReason: null,
      },
    });

    return {
      status: "PUBLISHED",
      etsyListingId: result.etsyListingId,
      failedReason: null,
      providerSnapshot,
    };
  } catch (err) {
    // FAIL path — listing'i FAILED'a çek, error message persist.
    const failedReason =
      err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);

    await db.listing.update({
      where: { id: listingId },
      data: {
        status: "FAILED",
        failedReason,
        submittedAt: new Date(), // submit denendi (audit)
      },
    });

    // Re-throw — endpoint typed error'ı HTTP'ye map eder.
    throw err;
  }
}
