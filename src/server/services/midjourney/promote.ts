// Pass 55 — MidjourneyAsset → GeneratedDesign promote (Review handoff).
//
// Sözleşme:
//   • Schema'da `MidjourneyAsset.generatedDesignId String? @unique` zaten
//     var; Pass 55'e kadar hiç doldurulmuyordu. Promote bu bağı kurar
//     ve aynı `assetId`'yi kullanır (yeni asset KOPYASI yok — MinIO'ya
//     ikinci upload yapma).
//   • GeneratedDesign zorunlu alanlar: userId, referenceId, productTypeId,
//     assetId. MJ job'da kullanıcı zaten var; reference + productType
//     operatör tarafından seçilir (MJ test render formunda yoksa).
//   • Idempotent: aynı MidjourneyAsset için ikinci promote → mevcut
//     GeneratedDesign id'sini döner, yeni row yaratmaz.
//   • Default `reviewStatus: PENDING` → Review queue'ya otomatik düşer.
//   • Audit log caller (API route) tarafında atılır; service sadece DB
//     işini yapar.

import { JobType, ReviewStatus } from "@prisma/client";
import { db } from "@/server/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { enqueueReviewDesign } from "@/server/services/review/enqueue";
import { getResolvedReviewConfig } from "@/server/services/settings/review.service";
import { logger } from "@/lib/logger";

export type PromoteInput = {
  midjourneyAssetId: string;
  /** Reference seçimi — MJ job referenceId'liyse o, yoksa operatör seçer. */
  referenceId: string;
  /** ProductType seçimi — Reference üzerinden de gelir; ama explicit override mümkün. */
  productTypeId: string;
  /** Promote'i tetikleyen kullanıcı (genelde admin). */
  actorUserId: string;
};

export type PromoteResult = {
  generatedDesignId: string;
  /** True ise yeni row, false ise mevcut row geri döndü (idempotent). */
  created: boolean;
  midjourneyAssetId: string;
  gridIndex: number;
};

export async function promoteMidjourneyAssetToGeneratedDesign(
  input: PromoteInput,
): Promise<PromoteResult> {
  const mjAsset = await db.midjourneyAsset.findUnique({
    where: { id: input.midjourneyAssetId },
    select: {
      id: true,
      gridIndex: true,
      assetId: true,
      generatedDesignId: true,
      midjourneyJob: {
        select: {
          userId: true,
          // IA-38 — MJ promote sırasında batch lineage taşınır.
          // MidjourneyJob.job (BullMQ Job row) metadata.batchId'sini
          // GeneratedDesign.jobId'ye eşliyoruz; review queue endpoint
          // bu jobId üzerinden batch'i resolve eder ve UI primary
          // lineage (batch-XXXXXX) gösterir.
          job: { select: { id: true } },
        },
      },
    },
  });
  if (!mjAsset) {
    throw new NotFoundError("MidjourneyAsset bulunamadı");
  }

  // Idempotent — zaten promote edildiyse mevcut id'yi dön.
  if (mjAsset.generatedDesignId) {
    return {
      generatedDesignId: mjAsset.generatedDesignId,
      created: false,
      midjourneyAssetId: mjAsset.id,
      gridIndex: mjAsset.gridIndex,
    };
  }

  // Reference + ProductType doğrula (cross-user kontrol için).
  const [reference, productType] = await Promise.all([
    db.reference.findFirst({
      where: { id: input.referenceId, deletedAt: null },
      select: { id: true, userId: true, productTypeId: true },
    }),
    db.productType.findUnique({
      where: { id: input.productTypeId },
      select: { id: true },
    }),
  ]);
  if (!reference) {
    throw new NotFoundError("Reference bulunamadı veya silindi");
  }
  if (!productType) {
    throw new NotFoundError("ProductType bulunamadı");
  }

  // GeneratedDesign'ın userId'si MidjourneyJob'un userId'si olur (asset
  // sahibi). Reference de aynı user'a ait olmalı (cross-user erişim engel).
  const designUserId = mjAsset.midjourneyJob.userId;
  if (reference.userId !== designUserId) {
    throw new ValidationError(
      "Reference farklı kullanıcıya ait — MJ job sahibi ile eşleşmiyor",
    );
  }

  // Transactional create + bağ.
  const result = await db.$transaction(async (tx) => {
    const design = await tx.generatedDesign.create({
      data: {
        userId: designUserId,
        referenceId: reference.id,
        productTypeId: productType.id,
        assetId: mjAsset.assetId,
        reviewStatus: ReviewStatus.PENDING,
        // IA-38 — Batch lineage. MJ job'un BullMQ Job row id'sine
        // bağla; queue endpoint Job.metadata.batchId'yi resolve
        // edip review primary lineage olarak gösterir. Job yoksa
        // (eski MJ asset'ler) null kalır — UI reference fallback'i
        // gösterir.
        jobId: mjAsset.midjourneyJob.job?.id ?? null,
        // similarity/qualityScore/promptSnapshot Pass 55'te boş;
        // Phase 6 review job çalıştığında doldurur.
      },
      select: { id: true },
    });
    await tx.midjourneyAsset.update({
      where: { id: mjAsset.id },
      data: { generatedDesignId: design.id },
    });
    return design;
  });

  // IA-29 (CLAUDE.md Madde V) — promote sonrası AI advisory pipeline'ı
  // otomatik tetikle. variation-worker + generate-variations worker ile
  // tutarlı: operatör manual scope-trigger çekmek zorunda kalmaz.
  // IA-39 (CLAUDE.md Madde U) — aiAutoEnqueue toggle'ına uyar; disabled
  // ise enqueue yapılmaz, info log düşer. Promote başarılı kalır.
  // Best-effort: enqueue fail olursa promote başarılı kalır.
  try {
    const reviewConfig = await getResolvedReviewConfig(designUserId);
    if (!reviewConfig.automation.aiAutoEnqueue) {
      logger.info(
        { designId: result.id, userId: designUserId },
        "MJ promote: review auto-enqueue skipped: aiAutoEnqueue disabled in Settings → Review",
      );
    } else {
      await enqueueReviewDesign({
        userId: designUserId,
        payload: { scope: "design", generatedDesignId: result.id },
      });
    }
  } catch (err) {
    logger.error(
      {
        designId: result.id,
        userId: designUserId,
        err: err instanceof Error ? err.message : String(err),
      },
      "MJ promote: REVIEW_DESIGN auto-enqueue failed (promote committed)",
    );
  }

  return {
    generatedDesignId: result.id,
    created: true,
    midjourneyAssetId: mjAsset.id,
    gridIndex: mjAsset.gridIndex,
  };
}

export type BulkPromoteInput = {
  midjourneyAssetIds: string[];
  referenceId: string;
  productTypeId: string;
  actorUserId: string;
};

export async function bulkPromoteMidjourneyAssets(
  input: BulkPromoteInput,
): Promise<{
  results: PromoteResult[];
  createdCount: number;
  alreadyPromotedCount: number;
}> {
  if (input.midjourneyAssetIds.length === 0) {
    throw new ValidationError("En az bir asset gerekli");
  }
  const results: PromoteResult[] = [];
  for (const id of input.midjourneyAssetIds) {
    const r = await promoteMidjourneyAssetToGeneratedDesign({
      midjourneyAssetId: id,
      referenceId: input.referenceId,
      productTypeId: input.productTypeId,
      actorUserId: input.actorUserId,
    });
    results.push(r);
  }
  return {
    results,
    createdCount: results.filter((r) => r.created).length,
    alreadyPromotedCount: results.filter((r) => !r.created).length,
  };
}
