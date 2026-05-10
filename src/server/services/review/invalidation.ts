// IA Phase 16 — review score invalidation helper.
//
// CLAUDE.md Madde N (scoring cost disiplini) gereği: bir asset'in
// sistem skoru, image-content'i anlamlı bir şekilde değişmediği sürece
// korunur. Background remove, crop, upscale, remaster, re-export gibi
// işlemler ise score'u **invalid** kılar; review state'i sıfırlanmalı
// ve item operatörün önüne yeniden düşmeli (undecided olarak).
//
// Bu helper invalidation'a sebep olan **anlamlı değişiklikleri** sabit
// bir sözlükten okur (drift koruması). Caller (edit / regenerate /
// transform endpoint'i) helper'ı tek satırla çağırır; helper hem
// state'i resetler hem rerun'ı kuyruğa atar (best-effort).
//
// Kapsam dışı (ad-hoc kullanım yasak):
//   • Operator karar (keep / reject) — score'u etkilemez.
//   • Sadece label / metadata güncellemesi — image-content sabit.
//   • Sadece thumbnail regen — preview, pipeline değil.
//   • Taxonomy değişikliği (productType reassign) — content sabit.
//
// Bu kurallar code-level invariant; ad-hoc reset path'i açılırsa
// CLAUDE.md Madde N'i ihlal eder.

import { JobType, Prisma, ReviewStatus, ReviewStatusSource } from "@prisma/client";
import { db } from "@/server/db";
import { enqueue } from "@/server/queue";
import { logger } from "@/lib/logger";

/**
 * Image-content değişikliği türleri. Yeni transform tipi eklenince
 * buraya kayıt edilir; helper otomatik olarak invalidation kapsamına
 * alır. UI / endpoint kodunda bu enum dışında reset reason yazılmaz.
 */
export const REVIEW_INVALIDATION_REASONS = [
  "background_removed",
  "cropped",
  "upscaled",
  "remastered",
  "re_exported",
  "color_edited",
] as const;
export type ReviewInvalidationReason =
  (typeof REVIEW_INVALIDATION_REASONS)[number];

type ResetCommonInput = {
  userId: string;
  reason: ReviewInvalidationReason;
  /** Caller görselin değişmesini sağlamış olmalı (Sharp pipeline,
   *  S3 yeniden upload vb.). Helper yalnız state'i resetler. */
};

/**
 * GeneratedDesign için image-content invalidation. State sıfırlanır,
 * REVIEW_DESIGN job'u rerun için enqueue olur (best-effort). Caller
 * USER override ettiği item'lar için de invalidation tetiklerse —
 * review snapshot temizlenir, rerun job'da sticky guard tarafından
 * skip edilir (USER kararı kalır), ama state PENDING'e döner; bu
 * tutarsız bir durum olduğu için caller invalidation'ı yalnız
 * SYSTEM kayıtlar için çağırmalı (defansif kontrol burada da var).
 */
export async function invalidateGeneratedDesignReview(
  args: ResetCommonInput & { generatedDesignId: string },
): Promise<{ reset: boolean; rerunEnqueued: boolean }> {
  const { generatedDesignId, userId, reason } = args;

  // Ownership + USER override defansif. Cross-user invalidation
  // engelle.
  const design = await db.generatedDesign.findFirst({
    where: { id: generatedDesignId, userId, deletedAt: null },
    select: { id: true, reviewStatusSource: true },
  });
  if (!design) return { reset: false, rerunEnqueued: false };
  if (design.reviewStatusSource === ReviewStatusSource.USER) {
    logger.info(
      { generatedDesignId, userId, reason },
      "review invalidation skipped — USER source (sticky)",
    );
    return { reset: false, rerunEnqueued: false };
  }

  await db.generatedDesign.update({
    where: { id: generatedDesignId },
    data: {
      reviewStatus: ReviewStatus.PENDING,
      reviewStatusSource: ReviewStatusSource.SYSTEM,
      reviewScore: null,
      reviewSummary: null,
      reviewRiskFlags: Prisma.DbNull,
      textDetected: false,
      gibberishDetected: false,
      reviewedAt: null,
      reviewProviderSnapshot: null,
      reviewPromptSnapshot: null,
    },
  });

  let rerunEnqueued = true;
  try {
    await enqueue(JobType.REVIEW_DESIGN, {
      scope: "design" as const,
      generatedDesignId,
      userId,
    });
  } catch (err) {
    rerunEnqueued = false;
    logger.error(
      {
        generatedDesignId,
        userId,
        reason,
        err: err instanceof Error ? err.message : String(err),
      },
      "review invalidation: rerun enqueue failed (state reset committed)",
    );
  }

  logger.info(
    { generatedDesignId, userId, reason, rerunEnqueued },
    "review invalidation: design state reset + rerun enqueued",
  );
  return { reset: true, rerunEnqueued };
}

/**
 * LocalLibraryAsset için image-content invalidation. productTypeKey
 * caller tarafından bilinmek zorunda (worker payload zorunlu alanı —
 * sessiz default YASAK / Phase 6 Karar 3).
 */
export async function invalidateLocalAssetReview(
  args: ResetCommonInput & {
    localAssetId: string;
    productTypeKey: string;
  },
): Promise<{ reset: boolean; rerunEnqueued: boolean }> {
  const { localAssetId, userId, reason, productTypeKey } = args;

  const asset = await db.localLibraryAsset.findFirst({
    where: {
      id: localAssetId,
      userId,
      deletedAt: null,
      isUserDeleted: false,
    },
    select: { id: true, reviewStatusSource: true },
  });
  if (!asset) return { reset: false, rerunEnqueued: false };
  if (asset.reviewStatusSource === ReviewStatusSource.USER) {
    logger.info(
      { localAssetId, userId, reason },
      "review invalidation skipped — USER source (sticky)",
    );
    return { reset: false, rerunEnqueued: false };
  }

  await db.localLibraryAsset.update({
    where: { id: localAssetId },
    data: {
      reviewStatus: ReviewStatus.PENDING,
      reviewStatusSource: ReviewStatusSource.SYSTEM,
      reviewScore: null,
      reviewSummary: null,
      reviewIssues: Prisma.DbNull,
      reviewRiskFlags: Prisma.DbNull,
      reviewedAt: null,
      reviewProviderSnapshot: null,
      reviewPromptSnapshot: null,
    },
  });

  let rerunEnqueued = true;
  try {
    await enqueue(JobType.REVIEW_DESIGN, {
      scope: "local" as const,
      localAssetId,
      userId,
      productTypeKey,
    });
  } catch (err) {
    rerunEnqueued = false;
    logger.error(
      {
        localAssetId,
        userId,
        reason,
        err: err instanceof Error ? err.message : String(err),
      },
      "review invalidation: rerun enqueue failed (state reset committed)",
    );
  }

  logger.info(
    { localAssetId, userId, reason, rerunEnqueued },
    "review invalidation: local state reset + rerun enqueued",
  );
  return { reset: true, rerunEnqueued };
}
