// Phase 9 V1 Task 9 — Listing metadata generation service (foundation slice).
//
// generateListingMeta(listingId, userId, options?):
//   1. listing fetch (cross-user 404)
//   2. settings fetch (getUserAiModeSettings)
//   3. NOT_CONFIGURED guard (kieApiKey yoksa)
//   4. provider resolve (registry default)
//   5. input derle (productType bilinmiyorsa "wall_art" placeholder DEĞİL —
//      explicit error: V1'de productType henüz Listing'de yok; carry-forward
//      Task 6/Phase 9.1: ProductType binding via mockupJob.setId.productType.
//      V1 foundation: input.productType "generic" sabit; çağıran taraf
//      override edebilir.)
//   6. provider.generate çağrısı
//   7. snapshot (buildProviderSnapshot model + date)
//   8. result + snapshot döner
//
// Bu turda endpoint ve UI YOK — sadece service. Caller test edilir.
//
// Phase 6 emsali: review-design.worker.ts orchestration; ama burada
// queue/job kullanmıyoruz (V1 foundation: sync call).

import { ProviderKind } from "@prisma/client";
import { db } from "@/server/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getUserAiModeSettings } from "@/features/settings/ai-mode/service";
import {
  getListingMetaAIProvider,
  DEFAULT_LISTING_META_PROVIDER_ID,
} from "@/providers/listing-meta-ai/registry";
import { buildProviderSnapshot } from "@/providers/review/snapshot";
import { LISTING_META_PROMPT_VERSION } from "@/providers/listing-meta-ai/prompt";
import { LISTING_META_KIE_COST_ESTIMATE_CENTS } from "@/providers/listing-meta-ai/kie-gemini-flash";
import { recordCostUsage } from "@/server/services/cost/track-usage";
import type { ListingMetaOutput } from "@/providers/listing-meta-ai/types";

// ────────────────────────────────────────────────────────────
// Custom errors (AppError extend, withErrorHandling auto-map)
// ────────────────────────────────────────────────────────────

export class ListingMetaListingNotFoundError extends AppError {
  constructor() {
    super("Listing bulunamadı", "LISTING_META_LISTING_NOT_FOUND", 404);
  }
}

export class ListingMetaProviderNotConfiguredError extends AppError {
  constructor() {
    super(
      "AI provider configured değil — Settings → AI Mode'dan KIE anahtarı ekleyin",
      "LISTING_META_PROVIDER_NOT_CONFIGURED",
      400,
    );
  }
}

export class ListingMetaProviderError extends AppError {
  constructor(message: string) {
    super(`AI listing metadata üretimi başarısız: ${message}`, "LISTING_META_PROVIDER_ERROR", 502);
  }
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

export type GenerateListingMetaResult = {
  output: ListingMetaOutput;
  /** Provider snapshot — "{model}@{YYYY-MM-DD}". Audit/log için. */
  providerSnapshot: string;
  /** Prompt version — "{version}". Audit için. */
  promptVersion: string;
};

export type GenerateListingMetaOptions = {
  /** Provider id override (default: DEFAULT_LISTING_META_PROVIDER_ID). */
  providerId?: string;
  /** Tone hint forwarded to prompt builder. */
  toneHint?: string | null;
  /** Product type override — V1 default "generic" (Listing model'de henüz yok). */
  productType?: string;
};

/**
 * Generate listing metadata via AI provider.
 *
 * Cross-user disipline: listing.userId !== userId ⇒ NotFound (information disclosure prevent).
 * Honest fail: KIE key yoksa NotConfigured AppError; provider hatası ⇒ ProviderError 502.
 *
 * @param listingId Listing id (cuid)
 * @param userId Calling user id
 * @param options optional provider/tone overrides
 */
export async function generateListingMeta(
  listingId: string,
  userId: string,
  options: GenerateListingMetaOptions = {},
): Promise<GenerateListingMetaResult> {
  // 1. Listing fetch + ownership guard
  const listing = await db.listing.findUnique({ where: { id: listingId } });
  if (!listing || listing.userId !== userId) {
    throw new ListingMetaListingNotFoundError();
  }

  // 2. Settings + API key resolve
  const { kieApiKey } = await getUserAiModeSettings(userId);
  if (!kieApiKey || kieApiKey.trim() === "") {
    throw new ListingMetaProviderNotConfiguredError();
  }

  // 3. Provider resolve
  const providerId = options.providerId ?? DEFAULT_LISTING_META_PROVIDER_ID;
  const provider = getListingMetaAIProvider(providerId);

  // 4. Input derle
  const productType = options.productType ?? "generic";
  const input = {
    productType,
    currentTitle: listing.title,
    currentDescription: listing.description,
    currentTags: listing.tags,
    category: listing.category,
    materials: listing.materials,
    toneHint: options.toneHint ?? null,
  };

  // 5. Provider call (errors → ProviderError wrap)
  let output: ListingMetaOutput;
  try {
    output = await provider.generate(input, { apiKey: kieApiKey });
  } catch (err) {
    throw new ListingMetaProviderError(
      err instanceof Error ? err.message : String(err),
    );
  }

  // 6. Snapshot
  const providerSnapshot = buildProviderSnapshot(provider.modelId, new Date());

  // 7. Cost recording (best-effort — Phase 6 review.worker emsali).
  // Primary truth = output; cost write fail caller'ı 502'ye düşürmesin.
  // V1 conservative estimate: 1 cent per call (LISTING_META_KIE_COST_ESTIMATE_CENTS).
  try {
    await recordCostUsage({
      userId,
      providerKind: ProviderKind.AI,
      providerKey: provider.id,
      model: provider.modelId,
      units: 1,
      costCents: LISTING_META_KIE_COST_ESTIMATE_CENTS,
    });
  } catch (err) {
    logger.warn(
      { userId, listingId, providerKey: provider.id, err: (err as Error).message },
      "listing-meta cost recording failed (best-effort, primary path unaffected)",
    );
  }

  return {
    output,
    providerSnapshot,
    promptVersion: LISTING_META_PROMPT_VERSION,
  };
}
