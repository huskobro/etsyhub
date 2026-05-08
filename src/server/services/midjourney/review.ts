// Pass 89 — Batch Review Studio V1.
//
// Operatör batch ölçeğinde KARAR verir:
//   - KEPT     → shortlist'e dahil
//   - REJECTED → elendi
//   - UNDECIDED → henüz karar yok (default)
//
// Library = bul/tara; Review = karar ver/ayıkla. İkisi farklı kullanım.
//
// Tasarım kararları:
//   - Schema-zero değil — MidjourneyAsset.reviewDecision/At/By eklendi
//     (Pass 89 migration). Default UNDECIDED.
//   - Phase 6/7 GeneratedDesign.reviewStatus pipeline'ı PARALEL çalışır
//     (otomatik AI quality review). Bu modül operatör manuel kararı; iki
//     state birbirini bypass etmez. Promote akışında "KEPT" tercih edilir.
//   - User-scope: setReview için MidjourneyAsset → Asset.userId kontrolü.
//     getBatchReview için Job.userId kontrolü.
//   - Batch identity: Pass 84 Job.metadata.batchId üzerinden — schema-zero
//     join.

import {
  JobType,
  MJReviewDecision,
  MJVariantKind,
  type Prisma,
} from "@prisma/client";
import { db } from "@/server/db";

export class ReviewError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ASSET_NOT_FOUND"
      | "BATCH_NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_DECISION",
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

export type ReviewItem = {
  /** MidjourneyAsset id (stable key). */
  midjourneyAssetId: string;
  /** Asset id — AssetThumb için. */
  assetId: string;
  gridIndex: number;
  variantKind: MJVariantKind;
  mjActionLabel: string | null;
  /** Lineage parent (varsa). */
  parentAssetId: string | null;
  /** Parent asset thumb için (variation child'ı parent'la birlikte göstermek için). */
  parentAssetThumbId: string | null;

  midjourneyJobId: string;
  jobKind: string;
  prompt: string;
  /** Pass 79 expanded prompt (Job.metadata.prompt). */
  expandedPrompt: string | null;
  /** Pass 79 batch variables. */
  variables: Record<string, string> | null;

  /** Mevcut karar. */
  decision: MJReviewDecision;
  /** Karar zamanı. */
  decidedAt: Date | null;

  importedAt: Date;
};

export type BatchReviewSummary = {
  batchId: string;
  batchTotal: number;
  /** Toplam asset (review edilebilir). */
  total: number;
  /** State breakdown. */
  counts: {
    undecided: number;
    kept: number;
    rejected: number;
  };
  /** İlk job createdAt. */
  createdAt: Date | null;
  /** Pass 84 templateId (varsa). */
  templateId: string | null;
  /** Pass 84 promptTemplate snapshot. */
  promptTemplate: string | null;
};

export type BatchReviewFilter = {
  /** Hangi state'leri göster. Default ["UNDECIDED","KEPT","REJECTED"]. */
  decisions?: MJReviewDecision[];
  /** Variant kind filter (örn. sadece GRID). */
  variantKind?: MJVariantKind;
  /** Sayfa boyutu. Default 60. */
  limit?: number;
  /** Cursor: önceki sayfanın son card id'si. */
  cursorId?: string;
};

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

/**
 * Batch'in review özeti (sayaçlar + meta).
 *
 * @param batchId Pass 84 batch identity.
 * @param userId  Owner — cross-user erişim engeli için zorunlu.
 */
export async function getBatchReviewSummary(
  batchId: string,
  userId: string,
): Promise<BatchReviewSummary | null> {
  // Job.metadata.batchId üzerinden join — Pass 84/88 pattern.
  const jobs = await db.job.findMany({
    where: {
      type: JobType.MIDJOURNEY_BRIDGE,
      userId,
      metadata: {
        path: ["batchId"],
        equals: batchId,
      } as Prisma.JsonFilter,
    },
    select: {
      id: true,
      metadata: true,
      createdAt: true,
      midjourneyJob: {
        select: {
          generatedAssets: {
            select: { reviewDecision: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (jobs.length === 0) return null;

  const counts = { undecided: 0, kept: 0, rejected: 0 };
  let total = 0;
  for (const job of jobs) {
    const assets = job.midjourneyJob?.generatedAssets ?? [];
    for (const a of assets) {
      total++;
      if (a.reviewDecision === MJReviewDecision.KEPT) counts.kept++;
      else if (a.reviewDecision === MJReviewDecision.REJECTED) counts.rejected++;
      else counts.undecided++;
    }
  }

  // Pass 84 templateId + promptTemplate (ilk job'dan)
  const firstMd = (jobs[0]!.metadata ?? {}) as Record<string, unknown>;
  const batchTotal =
    typeof firstMd["batchTotal"] === "number"
      ? (firstMd["batchTotal"] as number)
      : jobs.length;
  const templateId =
    typeof firstMd["batchTemplateId"] === "string"
      ? (firstMd["batchTemplateId"] as string)
      : null;
  const promptTemplate =
    typeof firstMd["batchPromptTemplate"] === "string"
      ? (firstMd["batchPromptTemplate"] as string)
      : null;

  return {
    batchId,
    batchTotal,
    total,
    counts,
    createdAt: jobs[0]!.createdAt ?? null,
    templateId,
    promptTemplate,
  };
}

/**
 * Batch'in review item'lerini listeler (filtered + paginated).
 */
export async function listBatchReviewItems(
  batchId: string,
  userId: string,
  filter: BatchReviewFilter = {},
): Promise<{
  items: ReviewItem[];
  nextCursor: string | null;
}> {
  const limit = Math.min(filter.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const decisions = filter.decisions && filter.decisions.length > 0
    ? filter.decisions
    : [
        MJReviewDecision.UNDECIDED,
        MJReviewDecision.KEPT,
        MJReviewDecision.REJECTED,
      ];

  // Önce bu batch'e ait MidjourneyJob id'lerini topla (Job.metadata.batchId).
  // userId kontrolü Job tablosunda.
  const jobs = await db.job.findMany({
    where: {
      type: JobType.MIDJOURNEY_BRIDGE,
      userId,
      metadata: {
        path: ["batchId"],
        equals: batchId,
      } as Prisma.JsonFilter,
    },
    select: {
      midjourneyJob: {
        select: { id: true },
      },
    },
  });
  const mjJobIds = jobs
    .map((j) => j.midjourneyJob?.id)
    .filter((id): id is string => !!id);
  if (mjJobIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  const where: Prisma.MidjourneyAssetWhereInput = {
    midjourneyJobId: { in: mjJobIds },
    reviewDecision: { in: decisions },
  };
  if (filter.variantKind) {
    where.variantKind = filter.variantKind;
  }

  const rows = await db.midjourneyAsset.findMany({
    where,
    include: {
      midjourneyJob: {
        select: {
          id: true,
          kind: true,
          prompt: true,
          job: {
            select: { metadata: true },
          },
        },
      },
      // Pass 89 — variation child'ı parent thumbnail ile birlikte
      // göstermek için parent.assetId al.
      parent: {
        select: { assetId: true },
      },
    },
    orderBy: [
      // UNDECIDED'i öne al; sonra importedAt asc (üretim sırasıyla)
      { reviewDecision: "asc" }, // UNDECIDED < KEPT < REJECTED (alfabetik değil — enum)
      { importedAt: "asc" },
      { id: "asc" },
    ],
    take: limit + 1,
    ...(filter.cursorId
      ? { cursor: { id: filter.cursorId }, skip: 1 }
      : {}),
  });

  const sliced = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const nextCursor = hasMore ? sliced[sliced.length - 1]!.id : null;

  const items: ReviewItem[] = sliced.map((r) => {
    const md = (r.midjourneyJob.job?.metadata ?? null) as Record<
      string,
      unknown
    > | null;
    const expandedPrompt =
      md && typeof md["prompt"] === "string"
        ? (md["prompt"] as string)
        : null;
    const variables =
      md && typeof md["batchVariables"] === "object" && md["batchVariables"] !== null
        ? (md["batchVariables"] as Record<string, string>)
        : null;

    return {
      midjourneyAssetId: r.id,
      assetId: r.assetId,
      gridIndex: r.gridIndex,
      variantKind: r.variantKind,
      mjActionLabel: r.mjActionLabel,
      parentAssetId: r.parentAssetId,
      parentAssetThumbId: r.parent?.assetId ?? null,
      midjourneyJobId: r.midjourneyJob.id,
      jobKind: r.midjourneyJob.kind,
      prompt: r.midjourneyJob.prompt,
      expandedPrompt,
      variables,
      decision: r.reviewDecision,
      decidedAt: r.reviewDecidedAt,
      importedAt: r.importedAt,
    };
  });

  return { items, nextCursor };
}

/**
 * Tek asset için karar set/reset eder.
 *
 * @param midjourneyAssetId Hedef asset.
 * @param userId Owner check (Asset.userId üzerinden).
 * @param decision Yeni karar.
 */
export async function setMidjourneyAssetReview(
  midjourneyAssetId: string,
  userId: string,
  decision: MJReviewDecision,
): Promise<{ midjourneyAssetId: string; decision: MJReviewDecision; decidedAt: Date | null }> {
  // Owner check + varlık kontrolü
  const existing = await db.midjourneyAsset.findFirst({
    where: { id: midjourneyAssetId, asset: { userId } },
    select: { id: true },
  });
  if (!existing) {
    throw new ReviewError(
      `Asset bulunamadı veya erişim yok: ${midjourneyAssetId}`,
      "ASSET_NOT_FOUND",
    );
  }

  const decidedAt = decision === MJReviewDecision.UNDECIDED ? null : new Date();
  const decidedBy = decision === MJReviewDecision.UNDECIDED ? null : userId;

  const updated = await db.midjourneyAsset.update({
    where: { id: midjourneyAssetId },
    data: {
      reviewDecision: decision,
      reviewDecidedAt: decidedAt,
      reviewDecidedBy: decidedBy,
    },
    select: {
      id: true,
      reviewDecision: true,
      reviewDecidedAt: true,
    },
  });

  return {
    midjourneyAssetId: updated.id,
    decision: updated.reviewDecision,
    decidedAt: updated.reviewDecidedAt,
  };
}

/**
 * Bulk decision — bir batch'in tüm asset'lerinin kararını tek seferde
 * UNDECIDED'a sıfırlar (operatör "yeniden bak" senaryosu).
 *
 * @returns Sıfırlanan asset sayısı.
 */
export async function resetBatchReviewDecisions(
  batchId: string,
  userId: string,
): Promise<{ batchId: string; resetCount: number }> {
  // Owner check + batch lookup
  const jobs = await db.job.findMany({
    where: {
      type: JobType.MIDJOURNEY_BRIDGE,
      userId,
      metadata: {
        path: ["batchId"],
        equals: batchId,
      } as Prisma.JsonFilter,
    },
    select: {
      midjourneyJob: { select: { id: true } },
    },
  });
  const mjJobIds = jobs
    .map((j) => j.midjourneyJob?.id)
    .filter((id): id is string => !!id);
  if (mjJobIds.length === 0) {
    throw new ReviewError(
      `Batch bulunamadı veya erişim yok: ${batchId}`,
      "BATCH_NOT_FOUND",
    );
  }

  const result = await db.midjourneyAsset.updateMany({
    where: {
      midjourneyJobId: { in: mjJobIds },
      reviewDecision: { not: MJReviewDecision.UNDECIDED },
    },
    data: {
      reviewDecision: MJReviewDecision.UNDECIDED,
      reviewDecidedAt: null,
      reviewDecidedBy: null,
    },
  });

  return { batchId, resetCount: result.count };
}
