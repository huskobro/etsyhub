// Pass 90 — Kept Assets Workspace / Handoff Studio V1.
//
// Operatör Batch Review Studio'da KEPT verdiği asset'leri tek bir yerden
// görür, toplu seçer, sonraki iş akışına (SelectionSet/Mockup) taşır.
//
// Tasarım kararları:
//   - YENİ TABLO YOK. Mevcut zincir reuse:
//       MidjourneyAsset (KEPT)
//         → bulkPromoteMidjourneyAssets (Pass 55)
//         → GeneratedDesign (Phase 6 review queue + Phase 7 selection)
//         → createSet + addItems (Phase 7 SelectionSet)
//     Yeni "kept queue" tablosu eklemek gereksiz duplikasyon olurdu.
//
//   - Workspace = filtered view + bulk handoff orchestration. Sadece UI
//     katmanını eklemek yetmez — service-level orchestration gerek çünkü
//     promote (Reference + ProductType) → set create → addItems atomik
//     bir akış olarak gözükmeli (kısmi başarısızlık handle edilmeli).
//
//   - Filter:
//       * batchId (Job.metadata.batchId)
//       * templateId (Job.metadata.batchTemplateId)
//       * variantKind
//       * search (prompt ilike)
//   - Cursor pagination (importedAt, id) — Library/Review pattern.
//   - Group-by-batch summary: workspace üst kısmında "Hangi batch'lerden
//     kaç asset" özeti. Operatör shortlist'in dağılımını görür.

import {
  JobType,
  MJReviewDecision,
  MJVariantKind,
  type Prisma,
} from "@prisma/client";
import { db } from "@/server/db";
import {
  bulkPromoteMidjourneyAssets,
  type PromoteResult,
} from "./promote";
import { createSet } from "@/server/services/selection/sets.service";
import { addItems } from "@/server/services/selection/items.service";

export class HandoffError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NO_ASSETS"
      | "REFERENCE_NOT_FOUND"
      | "PRODUCT_TYPE_NOT_FOUND"
      | "SET_NAME_REQUIRED"
      | "FORBIDDEN",
  ) {
    super(message);
    this.name = "HandoffError";
  }
}

export type KeptAssetCard = {
  /** MidjourneyAsset id. */
  midjourneyAssetId: string;
  assetId: string;
  gridIndex: number;
  variantKind: MJVariantKind;
  mjActionLabel: string | null;
  parentAssetId: string | null;
  /** Variation bağlamı için parent asset thumb id (yoksa null). */
  parentAssetThumbId: string | null;

  midjourneyJobId: string;
  jobKind: string;
  prompt: string;
  expandedPrompt: string | null;

  batchId: string | null;
  templateId: string | null;

  /** Karar zamanı (KEPT atılma anı). */
  decidedAt: Date | null;
  importedAt: Date;

  /** Promote durumu — daha önce GeneratedDesign'a bağlandıysa. */
  alreadyPromotedDesignId: string | null;
};

export type KeptBatchGroup = {
  batchId: string;
  /** Bu batch'ten kept asset sayısı. */
  count: number;
  /** Pass 84 promptTemplate snapshot. */
  promptTemplatePreview: string | null;
  /** Pass 79/80 templateId. */
  templateId: string | null;
  /** Bu batch'in createdAt'i (ilk job). */
  createdAt: Date | null;
};

export type KeptWorkspaceFilter = {
  batchId?: string;
  templateId?: string;
  variantKind?: MJVariantKind;
  search?: string;
  /** Sayfa boyutu. Default 60. */
  limit?: number;
  cursorId?: string;
};

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

/**
 * Workspace summary — toplam kept + batch group breakdown.
 *
 * Operatör üst kısımda "şu an 23 kept asset; 3 batch'ten geliyor" özetini
 * görür ve batch chip'lerine tıklayarak filtreler.
 */
export async function getKeptWorkspaceSummary(userId: string): Promise<{
  totalKept: number;
  totalAlreadyPromoted: number;
  byBatch: KeptBatchGroup[];
}> {
  // Toplam KEPT asset sayısı (user-scope)
  const totalKept = await db.midjourneyAsset.count({
    where: {
      asset: { userId, deletedAt: null },
      reviewDecision: MJReviewDecision.KEPT,
    },
  });

  // Daha önce GeneratedDesign'a bağlanmış olanlar
  const totalAlreadyPromoted = await db.midjourneyAsset.count({
    where: {
      asset: { userId, deletedAt: null },
      reviewDecision: MJReviewDecision.KEPT,
      generatedDesignId: { not: null },
    },
  });

  // Batch breakdown — KEPT asset'lerin midjourneyJob → job → metadata.batchId
  // üzerinden grupla. Job tablosundan tek geçişte alalım.
  const keptRows = await db.midjourneyAsset.findMany({
    where: {
      asset: { userId, deletedAt: null },
      reviewDecision: MJReviewDecision.KEPT,
    },
    select: {
      midjourneyJob: {
        select: {
          job: {
            select: { metadata: true, createdAt: true },
          },
        },
      },
    },
  });

  const byBatchMap = new Map<
    string,
    {
      count: number;
      promptTemplatePreview: string | null;
      templateId: string | null;
      createdAt: Date | null;
    }
  >();
  for (const r of keptRows) {
    const md = (r.midjourneyJob.job?.metadata ?? null) as Record<
      string,
      unknown
    > | null;
    const batchId =
      md && typeof md["batchId"] === "string"
        ? (md["batchId"] as string)
        : null;
    if (!batchId) continue;
    const existing = byBatchMap.get(batchId);
    if (existing) {
      existing.count++;
    } else {
      const promptTemplate =
        md && typeof md["batchPromptTemplate"] === "string"
          ? (md["batchPromptTemplate"] as string)
          : null;
      const templateId =
        md && typeof md["batchTemplateId"] === "string"
          ? (md["batchTemplateId"] as string)
          : null;
      byBatchMap.set(batchId, {
        count: 1,
        promptTemplatePreview: promptTemplate
          ? promptTemplate.length > 80
            ? `${promptTemplate.slice(0, 80)}…`
            : promptTemplate
          : null,
        templateId,
        createdAt: r.midjourneyJob.job?.createdAt ?? null,
      });
    }
  }

  const byBatch: KeptBatchGroup[] = Array.from(byBatchMap.entries())
    .map(([batchId, v]) => ({
      batchId,
      count: v.count,
      promptTemplatePreview: v.promptTemplatePreview,
      templateId: v.templateId,
      createdAt: v.createdAt,
    }))
    .sort((a, b) => {
      const ta = a.createdAt?.getTime() ?? 0;
      const tb = b.createdAt?.getTime() ?? 0;
      return tb - ta; // recent first
    });

  return { totalKept, totalAlreadyPromoted, byBatch };
}

/**
 * Kept asset workspace listesi (filtered + paginated).
 */
export async function listKeptAssets(
  userId: string,
  filter: KeptWorkspaceFilter = {},
): Promise<{
  cards: KeptAssetCard[];
  nextCursor: string | null;
}> {
  const limit = Math.min(filter.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const where: Prisma.MidjourneyAssetWhereInput = {
    asset: { userId, deletedAt: null },
    reviewDecision: MJReviewDecision.KEPT,
  };
  if (filter.variantKind) {
    where.variantKind = filter.variantKind;
  }

  // batch/template — Job.metadata üzerinden
  const jobWhere: Prisma.MidjourneyJobWhereInput = {};
  if (filter.batchId) {
    jobWhere.job = {
      is: {
        metadata: {
          path: ["batchId"],
          equals: filter.batchId,
        } as Prisma.JsonFilter,
      },
    };
  } else if (filter.templateId) {
    jobWhere.job = {
      is: {
        metadata: {
          path: ["batchTemplateId"],
          equals: filter.templateId,
        } as Prisma.JsonFilter,
      },
    };
  }
  if (filter.search && filter.search.trim().length > 0) {
    jobWhere.prompt = { contains: filter.search.trim(), mode: "insensitive" };
  }
  if (Object.keys(jobWhere).length > 0) {
    where.midjourneyJob = { is: jobWhere };
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
      parent: {
        select: { assetId: true },
      },
    },
    orderBy: [{ reviewDecidedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(filter.cursorId
      ? { cursor: { id: filter.cursorId }, skip: 1 }
      : {}),
  });

  const sliced = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const nextCursor = hasMore ? sliced[sliced.length - 1]!.id : null;

  const cards: KeptAssetCard[] = sliced.map((r) => {
    const md = (r.midjourneyJob.job?.metadata ?? null) as Record<
      string,
      unknown
    > | null;
    const batchId =
      md && typeof md["batchId"] === "string"
        ? (md["batchId"] as string)
        : null;
    const templateId =
      md && typeof md["batchTemplateId"] === "string"
        ? (md["batchTemplateId"] as string)
        : null;
    const expandedPrompt =
      md && typeof md["prompt"] === "string"
        ? (md["prompt"] as string)
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
      batchId,
      templateId,
      decidedAt: r.reviewDecidedAt,
      importedAt: r.importedAt,
      alreadyPromotedDesignId: r.generatedDesignId,
    };
  });

  return { cards, nextCursor };
}

// ────────────────────────────────────────────────────────────
// Handoff orchestrator
// ────────────────────────────────────────────────────────────

export type HandoffInput = {
  userId: string;
  /** Hangi MJ asset'ler handoff edilecek. */
  midjourneyAssetIds: string[];
  /** Promote için Reference (zorunlu). */
  referenceId: string;
  /** Promote için ProductType (zorunlu). */
  productTypeId: string;
  /** SelectionSet adı. */
  selectionSetName: string;
};

export type HandoffResult = {
  selectionSetId: string;
  selectionSetName: string;
  /** Promote edilen (yeni GeneratedDesign yaratılan) asset sayısı. */
  promotedCreated: number;
  /** Daha önceden promote edilmiş (idempotent skip) asset sayısı. */
  promotedAlready: number;
  /** Yeni eklenen SelectionItem sayısı. */
  itemsAdded: number;
  /** Set'e zaten dahil olan (skip edilen) item sayısı. */
  itemsAlreadyInSet: number;
};

/**
 * Kept asset'leri SelectionSet'e taşıma orchestrator'ı.
 *
 * Atomik akış:
 *   1. midjourneyAssetIds'in hepsi user-scope (Asset.userId === userId)
 *      ve hepsi KEPT olmalı (defansif filtre — REJECTED/UNDECIDED bypass
 *      edilirse FORBIDDEN).
 *   2. bulkPromoteMidjourneyAssets — Reference + ProductType ile.
 *      İdempotent: zaten promote edilmiş asset'ler skip.
 *   3. createSet — yeni SelectionSet (status=draft).
 *   4. addItems — promote edilen GeneratedDesign id'lerini set'e ekle.
 *      İdempotent: aynı GeneratedDesign zaten varsa skip.
 *
 * Rollback: addItems atomik tx; createSet ondan önce committed. Eğer
 * addItems fail olursa set boş kalır — UI fail durumu bildirir, set
 * arşivlenebilir. Pass 55 promote zaten idempotent, retry safe.
 */
export async function handoffKeptAssetsToSelectionSet(
  input: HandoffInput,
): Promise<HandoffResult> {
  if (input.midjourneyAssetIds.length === 0) {
    throw new HandoffError(
      "En az bir asset seçilmeli",
      "NO_ASSETS",
    );
  }
  if (!input.selectionSetName || input.selectionSetName.trim().length === 0) {
    throw new HandoffError(
      "SelectionSet adı zorunlu",
      "SET_NAME_REQUIRED",
    );
  }

  // 1. User-scope + KEPT defansif kontrol.
  // Pass 91 — MJ origin context'i de aynı query'de toplanır
  // (sourceMetadata.mjOrigin için).
  const allowed = await db.midjourneyAsset.findMany({
    where: {
      id: { in: input.midjourneyAssetIds },
      asset: { userId: input.userId },
      reviewDecision: MJReviewDecision.KEPT,
    },
    select: {
      id: true,
      variantKind: true,
      midjourneyJob: {
        select: {
          job: {
            select: { metadata: true },
          },
        },
      },
    },
  });
  if (allowed.length === 0) {
    throw new HandoffError(
      "Seçilen asset'lerin hiçbiri user'a ait değil veya KEPT değil",
      "FORBIDDEN",
    );
  }
  const allowedIds = allowed.map((a) => a.id);

  // Pass 91 — Origin context: hangi batch'lerden ve template'lerden gelmiş
  // ve variant kind dağılımı nedir. SelectionSet.sourceMetadata.mjOrigin
  // olarak yazılır; selection sayfası bunu gösterir, geri-link kurar.
  const batchSet = new Set<string>();
  const templateSet = new Set<string>();
  const variantKindCounts: Record<string, number> = {};
  for (const a of allowed) {
    variantKindCounts[a.variantKind] =
      (variantKindCounts[a.variantKind] ?? 0) + 1;
    const md = (a.midjourneyJob.job?.metadata ?? null) as Record<
      string,
      unknown
    > | null;
    if (md && typeof md["batchId"] === "string") {
      batchSet.add(md["batchId"] as string);
    }
    if (md && typeof md["batchTemplateId"] === "string") {
      templateSet.add(md["batchTemplateId"] as string);
    }
  }

  // 2. Reference + ProductType varlığı (promote service zaten kontrol
  // ediyor ama daha clean error message için early)
  const [reference, productType] = await Promise.all([
    db.reference.findFirst({
      where: { id: input.referenceId, userId: input.userId, deletedAt: null },
      select: { id: true },
    }),
    db.productType.findUnique({
      where: { id: input.productTypeId },
      select: { id: true },
    }),
  ]);
  if (!reference) {
    throw new HandoffError(
      "Reference bulunamadı veya farklı user'a ait",
      "REFERENCE_NOT_FOUND",
    );
  }
  if (!productType) {
    throw new HandoffError("ProductType bulunamadı", "PRODUCT_TYPE_NOT_FOUND");
  }

  // 3. Promote
  const promoteResult = await bulkPromoteMidjourneyAssets({
    midjourneyAssetIds: allowedIds,
    referenceId: input.referenceId,
    productTypeId: input.productTypeId,
    actorUserId: input.userId,
  });

  const generatedDesignIds = promoteResult.results.map(
    (r: PromoteResult) => r.generatedDesignId,
  );

  // 4. SelectionSet create
  const set = await createSet({
    userId: input.userId,
    name: input.selectionSetName.trim(),
  });

  // Pass 91 — sourceMetadata.mjOrigin yazımı. Phase 7 SelectionSet zaten
  // sourceMetadata Json? alanına sahipti (quick-start için kullanılıyordu);
  // MJ handoff'lar için artık standart bir mjOrigin sub-object yazıyoruz:
  //   {
  //     kindFamily: "midjourney_kept",
  //     batchIds: string[],
  //     templateIds: string[],
  //     variantKindCounts: { GRID: N, UPSCALE: N, ... },
  //     referenceId, productTypeId,
  //     handedOffAt: ISO,
  //     keptAssetCount: N
  //   }
  // Bu blob salt-okunur kontrat; selection sayfası okuyup MJ context'i
  // gösterir.
  const mjOrigin = {
    kindFamily: "midjourney_kept" as const,
    batchIds: Array.from(batchSet),
    templateIds: Array.from(templateSet),
    variantKindCounts,
    referenceId: input.referenceId,
    productTypeId: input.productTypeId,
    handedOffAt: new Date().toISOString(),
    keptAssetCount: allowedIds.length,
  };
  await db.selectionSet.update({
    where: { id: set.id },
    data: {
      sourceMetadata: { mjOrigin } as Prisma.InputJsonValue,
    },
  });

  // 5. addItems — promote edilen GD'leri set'e ekle. items service
  // duplicate skip + cross-user guard'ı kendi içinde yapıyor.
  const addedItems = await addItems({
    userId: input.userId,
    setId: set.id,
    items: generatedDesignIds.map((id) => ({ generatedDesignId: id })),
  });

  return {
    selectionSetId: set.id,
    selectionSetName: set.name,
    promotedCreated: promoteResult.createdCount,
    promotedAlready: promoteResult.alreadyPromotedCount,
    itemsAdded: addedItems.length,
    itemsAlreadyInSet: generatedDesignIds.length - addedItems.length,
  };
}

// ────────────────────────────────────────────────────────────
// Batch-first Phase 3 — createSelectionFromMjBatch
//
// Batch detail "Create Selection" CTA'sının server tarafı. Operatör
// kept-no-selection stage'inde tek tıkla bu batch'in tüm KEPT asset'leri
// için yeni SelectionSet yaratır. handoffKeptAssetsToSelectionSet
// orchestrator'ının batch-scope thin wrapper'ıdır:
//
//   1. batchId verildiğinde tüm KEPT MidjourneyAsset'leri (bu batch'e
//      ait) bulup ID'lerini toplar.
//   2. Bu batch'in ilk MidjourneyJob'undan referenceId + productTypeId
//      resolve eder (variation creation single-reference, tüm jobları
//      aynı reference + product type taşır).
//   3. Auto-name üretir: reference.notes (varsa) veya productType
//      displayName, + bugünkü tarih.
//   4. handoffKeptAssetsToSelectionSet'i çağırır — atomik tx +
//      sourceMetadata.mjOrigin yazma + idempotent promote.
//
// Schema-zero korunur: yeni tablo veya migration yok. Mevcut
// MidjourneyAsset.reviewDecision + Job.metadata.batchId + handoff
// orchestrator yeniden kullanılır.
// ────────────────────────────────────────────────────────────

export type CreateSelectionFromMjBatchInput = {
  userId: string;
  /** Job.metadata.batchId — MJ_BRIDGE batch grouping kimliği. */
  batchId: string;
};

export class MjBatchSelectionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "BATCH_NOT_FOUND"
      | "NO_KEPT_ASSETS"
      | "REFERENCE_NOT_RESOLVED"
      | "PRODUCT_TYPE_NOT_RESOLVED",
  ) {
    super(message);
    this.name = "MjBatchSelectionError";
  }
}

const TR_MONTHS = [
  "Oca", "Şub", "Mar", "Nis", "May", "Haz",
  "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara",
];

function formatTrShortDate(d: Date): string {
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export async function createSelectionFromMjBatch(
  input: CreateSelectionFromMjBatchInput,
): Promise<HandoffResult> {
  const { userId, batchId } = input;

  // 1. Batch'in MJ jobs + KEPT asset'lerini topla. User-scoped ve
  // KEPT-only (downstream gate: CLAUDE.md Madde V'' — operator-only
  // kept zinciri).
  const jobs = await db.job.findMany({
    where: {
      type: JobType.MIDJOURNEY_BRIDGE,
      userId,
      metadata: { path: ["batchId"], equals: batchId },
    },
    select: {
      id: true,
      metadata: true,
      midjourneyJob: {
        select: {
          referenceId: true,
          productTypeId: true,
          generatedAssets: {
            where: { reviewDecision: MJReviewDecision.KEPT },
            select: { id: true },
          },
        },
      },
    },
  });

  if (jobs.length === 0) {
    throw new MjBatchSelectionError(
      "Batch bulunamadı veya size ait değil",
      "BATCH_NOT_FOUND",
    );
  }

  // 2. KEPT asset id'lerini topla.
  const keptAssetIds: string[] = [];
  for (const j of jobs) {
    for (const a of j.midjourneyJob?.generatedAssets ?? []) {
      keptAssetIds.push(a.id);
    }
  }
  if (keptAssetIds.length === 0) {
    throw new MjBatchSelectionError(
      "Bu batch'te kept asset yok — önce review'da karar verin",
      "NO_KEPT_ASSETS",
    );
  }

  // 3. Reference + productType resolve — variation creation single-reference,
  // tüm jobları aynı reference+product type taşır. İlk job'dan al; fallback
  // olarak Job.metadata.referenceId'e bak (Phase 2'de eklenen schema-zero
  // lineage, eski MJ batch'lerinde MidjourneyJob columns null olabilir).
  let referenceId: string | null = null;
  let productTypeId: string | null = null;
  for (const j of jobs) {
    if (!referenceId) {
      referenceId =
        j.midjourneyJob?.referenceId ??
        (typeof j.metadata === "object" && j.metadata !== null
          ? ((j.metadata as Record<string, unknown>)["referenceId"] as
              | string
              | undefined) ?? null
          : null);
    }
    if (!productTypeId) {
      productTypeId = j.midjourneyJob?.productTypeId ?? null;
    }
    if (referenceId && productTypeId) break;
  }
  if (!referenceId) {
    throw new MjBatchSelectionError(
      "Reference resolve edilemedi — batch reference lineage taşımıyor",
      "REFERENCE_NOT_RESOLVED",
    );
  }
  if (!productTypeId) {
    throw new MjBatchSelectionError(
      "ProductType resolve edilemedi",
      "PRODUCT_TYPE_NOT_RESOLVED",
    );
  }

  // 4. Auto-name: reference.notes (varsa) veya productType.displayName +
  // bugünkü tarih. quickStartFromBatch'in naming pattern'ı (CLAUDE.md
  // Madde AA'da tanımlı tutarlılık).
  const [reference, productType] = await Promise.all([
    db.reference.findFirst({
      where: { id: referenceId, userId, deletedAt: null },
      select: { notes: true },
    }),
    db.productType.findUnique({
      where: { id: productTypeId },
      select: { displayName: true },
    }),
  ]);
  const trimmedNotes = reference?.notes?.trim() ?? "";
  const namePrefix =
    trimmedNotes.length > 0
      ? trimmedNotes
      : productType?.displayName ?? "Selection";
  const autoName = `${namePrefix} — ${formatTrShortDate(new Date())}`;

  // 5. handoff orchestrator'ı çağır — atomik promote + createSet + addItems.
  return handoffKeptAssetsToSelectionSet({
    userId,
    midjourneyAssetIds: keptAssetIds,
    referenceId,
    productTypeId,
    selectionSetName: autoName,
  });
}
