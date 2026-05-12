// Pass 84 — MJ Batch summary services.
//
// Pass 80'de createMidjourneyJobsFromTemplateBatch ürün geldi ama batch
// identity yoktu — sayfa yenilenince result panel kayboluyordu. Pass 84:
// her batch job'una cuid `batchId` + index + total Job.metadata'ya yazıldı
// (schema değişikliği YOK). Bu service o metadata üzerinden batch'leri
// resolve eder.
//
// Tasarım:
//   - Schema-zero (Job.metadata JSON query)
//   - User-scoped (her admin kendi batch'lerini görür; cross-user yok)
//   - Aggregation: state breakdown (queued/running/completed/failed/...)
//   - Lineage: templateSnapshot, batchCreatedAt, variable counts

import { JobType, MidjourneyJobState } from "@prisma/client";
import { db } from "@/server/db";

const MJ_BATCH_METADATA_PATH = ["batchId"]; // Job.metadata.batchId

export type BatchJobRow = {
  /** Job (Kivasy Job entity) id. */
  jobId: string;
  /** MidjourneyJob id (varsa — bridge accepted ile yazıldı). */
  midjourneyJobId: string | null;
  /** MidjourneyJob state (QUEUED/COMPLETED/FAILED/...). */
  state: string | null;
  /** Bridge job uuid. */
  bridgeJobId: string | null;
  /** MJ render UUID (completion sonrası). */
  mjJobId: string | null;
  /** Job.metadata.batchIndex (sıra). */
  batchIndex: number;
  /** Pass 79 expanded prompt (Job.metadata.prompt). */
  expandedPrompt: string | null;
  /** Job.metadata.batchVariables. */
  variables: Record<string, string> | null;
  /** Asset count (output count). */
  assetCount: number;
  /**
   * Batch-first Phase 7 — Items grid thumbnail için representative asset
   * id. AI batch'lerde GeneratedDesign.assetId; MJ batch'lerde ilk
   * MidjourneyAsset (gridIndex=0). Yoksa null (henüz import edilmemiş).
   */
  assetId: string | null;
  /** Block reason (FAILED ise). */
  blockReason: string | null;
  /** Failed reason mesajı. */
  failedReason: string | null;
  createdAt: Date;
  finishedAt: Date | null;
};

/**
 * Batch-first Phase 4 — pipeline identity.
 *
 * Operatör-facing tek surface (/batches/[id]) iki ayrı altyapı job'unu
 * kapsar:
 *   - "midjourney"  → Job.type = MIDJOURNEY_BRIDGE; outputs MidjourneyAsset.
 *   - "ai-variation" → Job.type = GENERATE_VARIATIONS; outputs GeneratedDesign.
 *
 * Pipeline kimliği UI'a sızdırılır ama operatörü altyapı bilgisine
 * zorlamaz — yalnız stage CTA + handoff path resolver tarafından
 * kullanılır (selection handoff farklı service çağırır; review queue
 * scope filtresi aynı `batchId`'yi her iki pipeline için okur).
 */
export type BatchPipeline = "midjourney" | "ai-variation";

export type BatchSummary = {
  batchId: string;
  /** Batch-first Phase 4 — hangi pipeline (UI handoff kararı için). */
  pipeline: BatchPipeline;
  /** İlk job'un createdAt'i (batch oluşturulma zamanı). */
  createdAt: Date;
  /** Job'ların batchTotal field'ı (tüm batch için aynı). */
  batchTotal: number;
  /** Persisted template lineage (varsa). */
  templateId: string | null;
  /** Template metni (Job.metadata.batchPromptTemplate). */
  promptTemplate: string | null;
  /**
   * Batch-first Phase 2 — reference lineage (Job.metadata.referenceId).
   * Aynı batch'in tüm job'larında aynı; ilk geçerli değer yakalanır.
   * Variation creation single-reference olduğu için tek değer yeterli;
   * retry batch'lerinde null kalabilir (retry metadata.referenceId taşımaz).
   */
  referenceId: string | null;
  /**
   * Batch-first Phase 4 — AI variation batch'leri için productTypeId
   * resolve edilebilir (GeneratedDesign.productTypeId üzerinden).
   * `quickStartFromBatch` çağrısı için gerekli (Selection handoff
   * pipeline-aware). MJ batch'lerinde null kalabilir; createSelection
   * server kendi resolve yapar.
   */
  productTypeId: string | null;
  /**
   * Batch-first Phase 7 — provider-first production snapshot.
   *
   * Parameters tab read-only batch request snapshot'ı bu alanlardan
   * derler. Provider-aware: kullanıcı altyapı jargonu (MJ/AI) yerine
   * üretim sağlayıcısı (Midjourney / Kie / vb.) bağlamı görür.
   *
   * Tüm alanlar nullable — eski batch'ler (Phase 7 öncesi) bu metadatayı
   * taşımaz; UI null durumda "—" gösterir. Yeni batch'ler ai-generation.
   * service:189-195'te bunları Job.metadata'ya yazar.
   */
  providerId: string | null;
  providerLabel: string | null;
  capabilityUsed: string | null;
  aspectRatio: string | null;
  quality: string | null;
  /**
   * Pass 86 — Retry lineage (varsa).
   * Bu batch bir önceki batch'in retry'ı ise:
   *   - retryOfBatchId: kaynak batchId
   * Job.metadata.retryOfBatchId üzerinden resolve edilir (tüm retry
   * job'larında aynı). UI'da "Retry of <batchId>" badge'i ile gösterilir.
   */
  retryOfBatchId: string | null;
  /** State breakdown — Pass 84 V1 metricleri. */
  counts: {
    total: number; // tüm batch jobs (DB'de bulunan)
    queued: number;
    running: number; // SUBMITTING_PROMPT/WAITING_FOR_RENDER/COLLECTING_OUTPUTS/DOWNLOADING/IMPORTING
    completed: number;
    failed: number;
    cancelled: number;
    awaiting: number; // AWAITING_LOGIN + AWAITING_CHALLENGE
    other: number;
  };
  /**
   * IA Phase 11 — operator-decision review breakdown across all
   * MidjourneyAssets generated by this batch. Powers the "X
   * undecided" caption next to the BatchDetail "Open Review" CTA so
   * the operator can read the gating signal without entering the
   * focus workspace (CLAUDE.md Madde H).
   *
   * total = kept + rejected + undecided. When the batch hasn't
   * imported any assets yet (still generating) all four are 0; the
   * UI degrades to no caption.
   */
  reviewCounts: {
    total: number;
    kept: number;
    rejected: number;
    undecided: number;
  };
  /** Bu batch'in tüm job'ları (sıralı). */
  jobs: BatchJobRow[];
};

const RUNNING_STATES = new Set([
  "OPENING_BROWSER",
  "SUBMITTING_PROMPT",
  "WAITING_FOR_RENDER",
  "COLLECTING_OUTPUTS",
  "DOWNLOADING",
  "IMPORTING",
]);
const AWAITING_STATES = new Set([
  "AWAITING_LOGIN",
  "AWAITING_CHALLENGE",
]);

function bucketState(state: string | null): keyof BatchSummary["counts"] {
  if (!state) return "other";
  if (state === "QUEUED") return "queued";
  if (state === "COMPLETED") return "completed";
  if (state === "FAILED") return "failed";
  if (state === "CANCELLED") return "cancelled";
  if (RUNNING_STATES.has(state)) return "running";
  if (AWAITING_STATES.has(state)) return "awaiting";
  return "other";
}

/**
 * Tek bir batch'in özeti (jobs listesi + state breakdown).
 * User-scoped — userId verilirse sadece o user'ın batch'i resolve edilir.
 *
 * Batch-first Phase 4 — unified pipeline resolver:
 *   İki ayrı Job.type aynı `Job.metadata.batchId` cuid'sini paylaşır:
 *     - MIDJOURNEY_BRIDGE → MidjourneyJob + MidjourneyAsset zinciri
 *     - GENERATE_VARIATIONS → GeneratedDesign zinciri (1 Job = 1 design)
 *   Resolver önce GENERATE_VARIATIONS arar (AI pipeline güncel); yoksa
 *   MJ_BRIDGE fallback yapar (legacy + manuel batch'ler). Pipeline farkı
 *   `summary.pipeline` field'ında yüzeye çıkar; UI handoff kararı buna
 *   göre alır (Selection creation farklı service çağırır).
 */
export async function getBatchSummary(
  batchId: string,
  userId?: string,
): Promise<BatchSummary | null> {
  // 1) Önce AI variation pipeline'ında ara — yeni job'lar bu pipeline'da
  // üretiliyor; latency bu yola optimize.
  const aiSummary = await getAiVariationBatchSummary(batchId, userId);
  if (aiSummary) return aiSummary;

  // 2) Fallback: MIDJOURNEY_BRIDGE pipeline (legacy + manuel).
  const jobs = await db.job.findMany({
    where: {
      type: JobType.MIDJOURNEY_BRIDGE,
      ...(userId ? { userId } : {}),
      metadata: {
        path: MJ_BATCH_METADATA_PATH,
        equals: batchId,
      },
    },
    select: {
      id: true,
      metadata: true,
      createdAt: true,
      finishedAt: true,
      midjourneyJob: {
        select: {
          id: true,
          state: true,
          bridgeJobId: true,
          mjJobId: true,
          blockReason: true,
          failedReason: true,
          generatedAssets: {
            // IA Phase 11 — review decision needed for BatchSummary
            // reviewCounts (operator visibility before entering the
            // review workspace). Existing { id: true } projection
            // already populates the relation; adding reviewDecision
            // is additive and the asset list is already small (4-8
            // per MJ job).
            // Batch-first Phase 7 — assetId + gridIndex eklendi;
            // Items tab thumbnail grid render için.
            select: {
              id: true,
              assetId: true,
              gridIndex: true,
              reviewDecision: true,
            },
            orderBy: { gridIndex: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (jobs.length === 0) return null;

  const counts: BatchSummary["counts"] = {
    total: 0,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    awaiting: 0,
    other: 0,
  };
  // IA Phase 11 — review decision breakdown across all assets.
  const reviewCounts: BatchSummary["reviewCounts"] = {
    total: 0,
    kept: 0,
    rejected: 0,
    undecided: 0,
  };

  let batchTotal = 0;
  let templateId: string | null = null;
  let promptTemplate: string | null = null;
  let retryOfBatchId: string | null = null;
  // Batch-first Phase 2 — reference lineage. Aynı batch'in tüm job'larında
  // aynı; ilk geçerli değer yakalanır.
  let referenceId: string | null = null;
  // Batch-first Phase 7 — provider-first production snapshot. MJ
  // pipeline'da provider sabit "midjourney" (bridge tek provider);
  // diğer alanlar Job.metadata.promptParams üzerinden okunabilir
  // ama mevcut MJ_BRIDGE pipeline her job'a promptParams yazmıyor.
  // V1: providerId hardcoded "midjourney"; diğer alanlar null.
  let mjProviderSeen = false;
  const rows: BatchJobRow[] = [];

  for (const j of jobs) {
    counts.total += 1;
    const md = (j.metadata as Record<string, unknown> | null) ?? {};
    const idx = typeof md["batchIndex"] === "number" ? (md["batchIndex"] as number) : 0;
    const total = typeof md["batchTotal"] === "number" ? (md["batchTotal"] as number) : 0;
    if (total > batchTotal) batchTotal = total;
    if (typeof md["batchTemplateId"] === "string" && !templateId) {
      templateId = md["batchTemplateId"] as string;
    }
    if (typeof md["batchPromptTemplate"] === "string" && !promptTemplate) {
      promptTemplate = md["batchPromptTemplate"] as string;
    }
    // Pass 86 — Retry lineage (Job.metadata.retryOfBatchId)
    if (typeof md["retryOfBatchId"] === "string" && !retryOfBatchId) {
      retryOfBatchId = md["retryOfBatchId"] as string;
    }
    // Batch-first Phase 2 — reference lineage (Job.metadata.referenceId).
    if (typeof md["referenceId"] === "string" && !referenceId) {
      referenceId = md["referenceId"] as string;
    }
    if (!mjProviderSeen) mjProviderSeen = true;
    const state = j.midjourneyJob?.state ?? null;
    counts[bucketState(state)] += 1;
    // IA Phase 11 — aggregate review decisions for all assets.
    for (const a of j.midjourneyJob?.generatedAssets ?? []) {
      reviewCounts.total += 1;
      if (a.reviewDecision === "KEPT") reviewCounts.kept += 1;
      else if (a.reviewDecision === "REJECTED") reviewCounts.rejected += 1;
      else reviewCounts.undecided += 1;
    }
    // Phase 7 — representative assetId (gridIndex 0 tercih) Items tab
    // thumbnail için.
    const firstAsset = j.midjourneyJob?.generatedAssets[0] ?? null;
    rows.push({
      jobId: j.id,
      midjourneyJobId: j.midjourneyJob?.id ?? null,
      state,
      bridgeJobId: j.midjourneyJob?.bridgeJobId ?? null,
      mjJobId: j.midjourneyJob?.mjJobId ?? null,
      batchIndex: idx,
      expandedPrompt:
        typeof md["prompt"] === "string" ? (md["prompt"] as string) : null,
      variables:
        md["batchVariables"] && typeof md["batchVariables"] === "object"
          ? (md["batchVariables"] as Record<string, string>)
          : null,
      assetCount: j.midjourneyJob?.generatedAssets.length ?? 0,
      assetId: firstAsset?.assetId ?? null,
      blockReason: j.midjourneyJob?.blockReason ?? null,
      failedReason: j.midjourneyJob?.failedReason ?? null,
      createdAt: j.createdAt,
      finishedAt: j.finishedAt,
    });
  }

  // batchIndex'e göre sırala (createdAt zaten yakın ama batch içinde
  // index daha kullanışlı)
  rows.sort((a, b) => a.batchIndex - b.batchIndex);

  return {
    batchId,
    pipeline: "midjourney",
    createdAt: jobs[0]!.createdAt,
    batchTotal,
    templateId,
    promptTemplate,
    referenceId,
    // MJ pipeline'da productTypeId Job.metadata içinde değil; MidjourneyJob
    // row'unda persist. Phase 3 createSelectionFromMjBatch zaten kendi
    // resolve yapıyor. Burada null bırakıyoruz — UI handoff'u summary.pipeline
    // üzerinden farklı service'e yönlendirir.
    productTypeId: null,
    // Batch-first Phase 7 — provider-first snapshot. MJ pipeline tek
    // provider (Midjourney browser bridge); kullanıcı-facing label sabit.
    // Diğer alanlar (aspectRatio/quality/capability) MJ_BRIDGE
    // Job.metadata'sında yazılmıyor — null kalır, UI "—" gösterir.
    providerId: mjProviderSeen ? "midjourney" : null,
    providerLabel: mjProviderSeen ? "Midjourney" : null,
    capabilityUsed: null,
    aspectRatio: null,
    quality: null,
    retryOfBatchId,
    counts,
    reviewCounts,
    jobs: rows,
  };
}

// ────────────────────────────────────────────────────────────
// Batch-first Phase 4 — AI variation pipeline resolver.
//
// GENERATE_VARIATIONS job'larından `BatchSummary` derler. Output asset model
// `GeneratedDesign`; review decision `GeneratedDesign.reviewStatus` +
// `reviewStatusSource` (CLAUDE.md Madde V — operator-only kept zinciri).
//
// MidjourneyJob.generatedAssets relation'ı AI batch'lerde N/A — onun yerine
// her job için ilişkili `GeneratedDesign.state` ile counts.* dolar.
// reviewCounts.kept = APPROVED + USER source (Madde V).
// ────────────────────────────────────────────────────────────

async function getAiVariationBatchSummary(
  batchId: string,
  userId?: string,
): Promise<BatchSummary | null> {
  const jobs = await db.job.findMany({
    where: {
      type: JobType.GENERATE_VARIATIONS,
      ...(userId ? { userId } : {}),
      metadata: {
        path: MJ_BATCH_METADATA_PATH,
        equals: batchId,
      },
    },
    select: {
      id: true,
      status: true,
      metadata: true,
      createdAt: true,
      finishedAt: true,
      error: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (jobs.length === 0) return null;

  // Each job has one related GeneratedDesign — bulk fetch by jobId.
  // Batch-first Phase 7 — provider snapshot fields eklendi
  // (assetId, providerId, aspectRatio, quality, capabilityUsed,
  // promptSnapshot). Parameters tab + Items thumbnail grid bu
  // alanlardan beslenir.
  const designs = await db.generatedDesign.findMany({
    where: {
      jobId: { in: jobs.map((j) => j.id) },
      ...(userId ? { userId } : {}),
    },
    select: {
      id: true,
      jobId: true,
      state: true,
      assetId: true,
      productTypeId: true,
      referenceId: true,
      providerId: true,
      capabilityUsed: true,
      aspectRatio: true,
      quality: true,
      promptSnapshot: true,
      briefSnapshot: true,
      reviewStatus: true,
      reviewStatusSource: true,
    },
  });
  const designByJobId = new Map<string, (typeof designs)[number]>();
  for (const d of designs) {
    if (d.jobId) designByJobId.set(d.jobId, d);
  }

  const counts: BatchSummary["counts"] = {
    total: 0,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    awaiting: 0,
    other: 0,
  };
  const reviewCounts: BatchSummary["reviewCounts"] = {
    total: 0,
    kept: 0,
    rejected: 0,
    undecided: 0,
  };

  let batchTotal = 0;
  let referenceId: string | null = null;
  let productTypeId: string | null = null;
  // Batch-first Phase 7 — provider-first snapshot fields. AI variation
  // batch'inde tüm job'lar aynı providerId/aspectRatio/quality paylaşır
  // (createVariationJobs single submit). İlk geçerli değer yakalanır.
  let providerId: string | null = null;
  let capabilityUsed: string | null = null;
  let aspectRatio: string | null = null;
  let quality: string | null = null;
  let promptSnapshot: string | null = null;
  const rows: BatchJobRow[] = [];

  for (const j of jobs) {
    counts.total += 1;
    const md = (j.metadata as Record<string, unknown> | null) ?? {};
    const idx =
      typeof md["batchIndex"] === "number" ? (md["batchIndex"] as number) : 0;
    const total =
      typeof md["batchTotal"] === "number" ? (md["batchTotal"] as number) : 0;
    if (total > batchTotal) batchTotal = total;
    if (typeof md["referenceId"] === "string" && !referenceId) {
      referenceId = md["referenceId"] as string;
    }
    // Phase 7 — Job.metadata.providerId (Phase 7+ writes); design row
    // fallback below.
    if (typeof md["providerId"] === "string" && !providerId) {
      providerId = md["providerId"] as string;
    }
    if (typeof md["aspectRatio"] === "string" && !aspectRatio) {
      aspectRatio = md["aspectRatio"] as string;
    }
    if (typeof md["quality"] === "string" && !quality) {
      quality = md["quality"] as string;
    }
    if (typeof md["capabilityUsed"] === "string" && !capabilityUsed) {
      capabilityUsed = md["capabilityUsed"] as string;
    }

    // Job state mapping: Job.status (QUEUED/RUNNING/SUCCEEDED/FAILED) →
    // BatchSummary.counts bucket.
    if (j.status === "QUEUED") counts.queued += 1;
    else if (j.status === "RUNNING") counts.running += 1;
    else if (j.status === "SUCCESS") counts.completed += 1;
    else if (j.status === "FAILED") counts.failed += 1;
    else if (j.status === "CANCELLED") counts.cancelled += 1;
    else counts.other += 1;

    const design = designByJobId.get(j.id);
    if (design) {
      if (!productTypeId) productTypeId = design.productTypeId;
      if (!referenceId) referenceId = design.referenceId;
      // Phase 7 — design fallback: legacy batch (Phase 6 öncesi) metadata
      // taşımaz; design row'undan provider/aspect/quality oku.
      if (!providerId && design.providerId) providerId = design.providerId;
      if (!aspectRatio && design.aspectRatio) aspectRatio = design.aspectRatio;
      if (!quality && design.quality) quality = design.quality;
      if (!capabilityUsed && design.capabilityUsed) {
        capabilityUsed = design.capabilityUsed;
      }
      if (!promptSnapshot && design.promptSnapshot) {
        promptSnapshot = design.promptSnapshot;
      }
      // CLAUDE.md Madde V: kept = APPROVED + reviewStatusSource = USER.
      // Worker-written advisory (`SYSTEM` source) "undecided" bucket'ına
      // düşer — operatör henüz karar vermedi.
      reviewCounts.total += 1;
      if (
        design.reviewStatus === "APPROVED" &&
        design.reviewStatusSource === "USER"
      ) {
        reviewCounts.kept += 1;
      } else if (
        design.reviewStatus === "REJECTED" &&
        design.reviewStatusSource === "USER"
      ) {
        reviewCounts.rejected += 1;
      } else {
        reviewCounts.undecided += 1;
      }
    }

    rows.push({
      jobId: j.id,
      midjourneyJobId: null, // AI pipeline'da MJ relation yok
      state: j.status,
      bridgeJobId: null,
      mjJobId: null,
      batchIndex: idx,
      expandedPrompt: design?.promptSnapshot ?? null,
      variables: null,
      assetCount: design ? 1 : 0,
      // Phase 7 — AI batch'inde 1 job = 1 design = 1 asset; design.assetId
      // Items tab thumbnail için kullanılır.
      assetId: design?.assetId ?? null,
      blockReason: null,
      failedReason: j.error ?? null,
      createdAt: j.createdAt,
      finishedAt: j.finishedAt,
    });
  }

  rows.sort((a, b) => a.batchIndex - b.batchIndex);

  return {
    batchId,
    pipeline: "ai-variation",
    createdAt: jobs[0]!.createdAt,
    batchTotal,
    // AI pipeline'da template/prompt template snapshot Job.metadata'da yok;
    // GeneratedDesign.promptSnapshot var ama ayrı row, batch detail için
    // representative job'dan okuma future enhancement.
    templateId: null,
    promptTemplate: promptSnapshot,
    referenceId,
    productTypeId,
    // Batch-first Phase 7 — provider-first production snapshot.
    providerId,
    providerLabel: formatProviderLabel(providerId),
    capabilityUsed,
    aspectRatio,
    quality,
    retryOfBatchId: null,
    counts,
    reviewCounts,
    jobs: rows,
  };
}

/**
 * Batch-first Phase 7 — providerId → kullanıcı-facing label.
 * Provider registry hardcoded id'leri (`kie-gpt-image-1.5`,
 * `kie-z-image`) operatöre uygun isimle gösterilir. Bilinmeyen id ise
 * id'nin kendisi gösterilir (fallback). MJ pipeline'da label sabit
 * "Midjourney" (getBatchSummary MJ branch'inde literal).
 */
function formatProviderLabel(providerId: string | null): string | null {
  if (!providerId) return null;
  const PROVIDER_LABELS: Record<string, string> = {
    "kie-gpt-image-1.5": "Kie · GPT Image 1.5",
    "kie-z-image": "Kie · Z-Image",
    midjourney: "Midjourney",
  };
  return PROVIDER_LABELS[providerId] ?? providerId;
}

export type RecentBatchSummary = {
  batchId: string;
  /** Batch-first Phase 4 — pipeline identity (UI handoff için). */
  pipeline: BatchPipeline;
  createdAt: Date;
  batchTotal: number;
  templateId: string | null;
  promptTemplatePreview: string | null;
  counts: BatchSummary["counts"];
  /** R11.14 — Representative MidjourneyAsset.assetId (visual context için
   *  Batches index'te thumbnail). Yoksa null (henüz tamamlanmış asset yok). */
  representativeAssetId: string | null;
  /**
   * Batch-first Phase 2 — reference lineage. Job.metadata.referenceId
   * üzerinden batch'i üreten kaynak reference. Aynı batch'in tüm job'larında
   * aynı (variation creation single-reference, ai-generation.service:179).
   * null → metadata yazılmamış (legacy) veya retry batch (reference taşımaz).
   */
  referenceId: string | null;
  /**
   * Batch-first Phase 2 — review decision breakdown for Batches index.
   * BatchSummary.reviewCounts ile aynı şekil; "şu batch için ne kadar
   * iş kaldı?" sorusunu Batches grid'inden cevap vermek için.
   * total = kept + rejected + undecided. Henüz asset yoksa hepsi 0.
   */
  reviewCounts: BatchSummary["reviewCounts"];
};

/**
 * Son batch'leri özet listesi (max N). Aggregation Job.metadata'dan.
 * User-scoped.
 *
 * Batch-first Phase 2 — opsiyonel `referenceId` filter:
 *   - Job.metadata.referenceId üzerinden Prisma JSON path query.
 *   - ai-generation.service:179'da yazılan field; schema-zero.
 *   - null/undefined → tüm batch'ler (default behavior korunur).
 */
export async function listRecentBatches(
  userId: string,
  limit = 30,
  options?: { referenceId?: string },
): Promise<RecentBatchSummary[]> {
  // Tüm MJ_BRIDGE jobları al (batchId metadata'sı olanlar)
  // Pass 84 V1: Prisma JSON path "isSet" filter desteklemiyor; tüm jobs
  // alınıp client-side group yapılır. Bu kullanıcı bazlı küçük cardinality
  // (admin başına bir-kaç bin job). Pass 85+ büyük scale için indexed
  // batchId field'ı ayrı tabloya çıkarılabilir.
  //
  // Batch-first Phase 2 — opsiyonel referenceId filter:
  //   Job.metadata.referenceId üzerinden Prisma JSON path equals query.
  //   ai-generation.service:179'da yazıldığı için tüm yeni AI variation
  //   batch'lerinde mevcut; legacy/retry batch'lerinde null kalır.
  const referenceIdFilter = options?.referenceId;
  const jobs = await db.job.findMany({
    where: {
      type: JobType.MIDJOURNEY_BRIDGE,
      userId,
      ...(referenceIdFilter
        ? {
            metadata: {
              path: ["referenceId"],
              equals: referenceIdFilter,
            },
          }
        : {}),
    },
    select: {
      id: true,
      metadata: true,
      createdAt: true,
      midjourneyJob: {
        select: {
          state: true,
          generatedAssets: {
            // Batch-first Phase 2 — review decision aggregation for
            // Batches index reviewCounts (operator gating signal).
            // Same shape as getBatchSummary; asset list per MJ job
            // is small (4-8) so additive load is bounded.
            select: { reviewDecision: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 2000, // limit DB load (Pass 85+ index'lenebilir)
  });

  // Group by batchId
  const byBatch = new Map<
    string,
    {
      batchId: string;
      createdAt: Date;
      batchTotal: number;
      templateId: string | null;
      promptTemplate: string | null;
      referenceId: string | null;
      counts: BatchSummary["counts"];
      reviewCounts: BatchSummary["reviewCounts"];
    }
  >();

  for (const j of jobs) {
    const md = (j.metadata as Record<string, unknown> | null) ?? {};
    const batchId = md["batchId"];
    if (typeof batchId !== "string" || batchId.length === 0) continue;
    let entry = byBatch.get(batchId);
    if (!entry) {
      entry = {
        batchId,
        createdAt: j.createdAt,
        batchTotal:
          typeof md["batchTotal"] === "number" ? (md["batchTotal"] as number) : 0,
        templateId:
          typeof md["batchTemplateId"] === "string"
            ? (md["batchTemplateId"] as string)
            : null,
        promptTemplate:
          typeof md["batchPromptTemplate"] === "string"
            ? (md["batchPromptTemplate"] as string)
            : null,
        referenceId:
          typeof md["referenceId"] === "string"
            ? (md["referenceId"] as string)
            : null,
        counts: {
          total: 0,
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          awaiting: 0,
          other: 0,
        },
        reviewCounts: {
          total: 0,
          kept: 0,
          rejected: 0,
          undecided: 0,
        },
      };
      byBatch.set(batchId, entry);
    }
    // En eski createdAt batch oluşturma anı
    if (j.createdAt < entry.createdAt) entry.createdAt = j.createdAt;
    // Batch-first Phase 2 — referenceId fallback (ilk job henüz yazmamış
    // olabilir; sonraki job'da var ise yakala).
    if (!entry.referenceId && typeof md["referenceId"] === "string") {
      entry.referenceId = md["referenceId"] as string;
    }
    entry.counts.total += 1;
    const state = j.midjourneyJob?.state ?? null;
    entry.counts[bucketState(state)] += 1;
    // Batch-first Phase 2 — aggregate review decisions for all assets.
    for (const a of j.midjourneyJob?.generatedAssets ?? []) {
      entry.reviewCounts.total += 1;
      if (a.reviewDecision === "KEPT") entry.reviewCounts.kept += 1;
      else if (a.reviewDecision === "REJECTED") entry.reviewCounts.rejected += 1;
      else entry.reviewCounts.undecided += 1;
    }
  }

  const summaries = Array.from(byBatch.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  // R11.14 — representative asset thumbnail aggregation. Her batch için
  // batchId metadata'sı olan ilk completed MidjourneyJob'un asset'ini
  // (gridIndex 0 tercih). Reverse relation: MidjourneyJob → job → metadata.batchId
  const representatives = new Map<string, string>();
  if (summaries.length > 0) {
    const completedJobs = await db.midjourneyJob.findMany({
      where: {
        userId,
        state: "COMPLETED",
      },
      select: {
        job: { select: { metadata: true } },
        generatedAssets: {
          select: { assetId: true, gridIndex: true },
          orderBy: { gridIndex: "asc" },
          take: 1,
        },
      },
      orderBy: { completedAt: "desc" },
      take: 500,
    });
    for (const mj of completedJobs) {
      const md = (mj.job?.metadata as Record<string, unknown> | null) ?? {};
      const bid = md["batchId"];
      if (typeof bid !== "string") continue;
      if (representatives.has(bid)) continue;
      const asset = mj.generatedAssets[0];
      if (asset) representatives.set(bid, asset.assetId);
    }
  }

  const mjSummaries: RecentBatchSummary[] = summaries.map((b) => ({
    batchId: b.batchId,
    pipeline: "midjourney" as BatchPipeline,
    createdAt: b.createdAt,
    batchTotal: b.batchTotal,
    templateId: b.templateId,
    promptTemplatePreview: b.promptTemplate
      ? b.promptTemplate.slice(0, 120)
      : null,
    counts: b.counts,
    representativeAssetId: representatives.get(b.batchId) ?? null,
    referenceId: b.referenceId,
    reviewCounts: b.reviewCounts,
  }));

  // Batch-first Phase 4 — AI variation batch'leri (GENERATE_VARIATIONS)
  // unified surface'e merge edilir. Operatör Batches index'te iki ayrı
  // pipeline ayrımını altyapı bilgisi olarak görmez; aynı grid'de gözlemler.
  const aiSummaries = await listAiVariationBatches(userId, referenceIdFilter);

  // Merge by createdAt desc, limit'i son anda uygula.
  const merged = [...mjSummaries, ...aiSummaries]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  return merged;
}

// ────────────────────────────────────────────────────────────
// Batch-first Phase 4 — AI variation batch listing.
//
// `Job.metadata.batchId` üzerinden GENERATE_VARIATIONS job'larını group by
// yapar. Her batch için: counts (queued/running/completed/failed),
// reviewCounts (kept = APPROVED + USER), referenceId, batchTotal.
// Representative thumbnail için GeneratedDesign.assetId ilk completed
// design'dan resolve edilir.
// ────────────────────────────────────────────────────────────

async function listAiVariationBatches(
  userId: string,
  referenceIdFilter?: string,
): Promise<RecentBatchSummary[]> {
  const jobs = await db.job.findMany({
    where: {
      type: JobType.GENERATE_VARIATIONS,
      userId,
      ...(referenceIdFilter
        ? {
            metadata: {
              path: ["referenceId"],
              equals: referenceIdFilter,
            },
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  if (jobs.length === 0) return [];

  // Group by batchId.
  type Entry = {
    batchId: string;
    createdAt: Date;
    batchTotal: number;
    referenceId: string | null;
    counts: BatchSummary["counts"];
    reviewCounts: BatchSummary["reviewCounts"];
    jobIds: string[];
  };
  const byBatch = new Map<string, Entry>();
  for (const j of jobs) {
    const md = (j.metadata as Record<string, unknown> | null) ?? {};
    const batchId = md["batchId"];
    if (typeof batchId !== "string" || batchId.length === 0) continue;
    let entry = byBatch.get(batchId);
    if (!entry) {
      entry = {
        batchId,
        createdAt: j.createdAt,
        batchTotal:
          typeof md["batchTotal"] === "number"
            ? (md["batchTotal"] as number)
            : 0,
        referenceId:
          typeof md["referenceId"] === "string"
            ? (md["referenceId"] as string)
            : null,
        counts: {
          total: 0,
          queued: 0,
          running: 0,
          completed: 0,
          failed: 0,
          cancelled: 0,
          awaiting: 0,
          other: 0,
        },
        reviewCounts: { total: 0, kept: 0, rejected: 0, undecided: 0 },
        jobIds: [],
      };
      byBatch.set(batchId, entry);
    }
    if (j.createdAt < entry.createdAt) entry.createdAt = j.createdAt;
    if (!entry.referenceId && typeof md["referenceId"] === "string") {
      entry.referenceId = md["referenceId"] as string;
    }
    entry.counts.total += 1;
    if (j.status === "QUEUED") entry.counts.queued += 1;
    else if (j.status === "RUNNING") entry.counts.running += 1;
    else if (j.status === "SUCCESS") entry.counts.completed += 1;
    else if (j.status === "FAILED") entry.counts.failed += 1;
    else if (j.status === "CANCELLED") entry.counts.cancelled += 1;
    else entry.counts.other += 1;
    entry.jobIds.push(j.id);
  }

  const summaries = Array.from(byBatch.values());
  if (summaries.length === 0) return [];

  // Bulk fetch GeneratedDesigns for all job ids → reviewCounts + representative
  // thumbnail. Per-job small projection.
  const allJobIds = summaries.flatMap((s) => s.jobIds);
  const designs = await db.generatedDesign.findMany({
    where: { jobId: { in: allJobIds }, userId },
    select: {
      jobId: true,
      assetId: true,
      state: true,
      reviewStatus: true,
      reviewStatusSource: true,
    },
  });
  const designsByJobId = new Map<string, (typeof designs)[number]>();
  for (const d of designs) {
    if (d.jobId) designsByJobId.set(d.jobId, d);
  }

  for (const s of summaries) {
    let representativeAssetId: string | null = null;
    for (const jobId of s.jobIds) {
      const d = designsByJobId.get(jobId);
      if (!d) continue;
      s.reviewCounts.total += 1;
      if (
        d.reviewStatus === "APPROVED" &&
        d.reviewStatusSource === "USER"
      ) {
        s.reviewCounts.kept += 1;
      } else if (
        d.reviewStatus === "REJECTED" &&
        d.reviewStatusSource === "USER"
      ) {
        s.reviewCounts.rejected += 1;
      } else {
        s.reviewCounts.undecided += 1;
      }
      if (!representativeAssetId && d.state === "SUCCESS" && d.assetId) {
        representativeAssetId = d.assetId;
      }
    }
    // attach representative onto entry shape (use any-shaped local extension
    // via a wrapper map outside, but here re-shape on map return below).
    (s as Entry & { representativeAssetId: string | null }).representativeAssetId =
      representativeAssetId;
  }

  return summaries.map((s) => ({
    batchId: s.batchId,
    pipeline: "ai-variation" as BatchPipeline,
    createdAt: s.createdAt,
    batchTotal: s.batchTotal,
    templateId: null,
    promptTemplatePreview: null,
    counts: s.counts,
    representativeAssetId:
      (s as Entry & { representativeAssetId: string | null })
        .representativeAssetId ?? null,
    referenceId: s.referenceId,
    reviewCounts: s.reviewCounts,
  }));
}

// ============================================================================
// Pass 87 — Operator Control Center quick stats.
//
// Ana sayfa header'da "şu an ne durumda?" sorusuna tek-bakışta yanıt.
// Job + MidjourneyJob aggregations user-scoped. Lightweight count
// query'leri (DB index dostu).
// ============================================================================

export type ControlCenterStats = {
  /** Bugün enqueue edilen MJ jobs (00:00 — şimdi). */
  enqueuedToday: number;
  /** Şu an running (SUBMITTING/WAITING/COLLECTING/DOWNLOADING/IMPORTING). */
  running: number;
  /** Bugün COMPLETED. */
  completedToday: number;
  /** Bugün FAILED. */
  failedToday: number;
  /** Toplam aktif MJ Templates (taskType=midjourney_generate, ACTIVE versiyonlu). */
  templates: number;
  /** Son 7 gün içindeki batch sayısı. */
  batchesLast7d: number;
};

export async function getControlCenterStats(
  userId: string,
): Promise<ControlCenterStats> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);

  const RUNNING_DB_STATES: MidjourneyJobState[] = [
    MidjourneyJobState.OPENING_BROWSER,
    MidjourneyJobState.SUBMITTING_PROMPT,
    MidjourneyJobState.WAITING_FOR_RENDER,
    MidjourneyJobState.COLLECTING_OUTPUTS,
    MidjourneyJobState.DOWNLOADING,
    MidjourneyJobState.IMPORTING,
  ];

  const [enqueuedToday, running, completedToday, failedToday, templatesCount, recentBatches] =
    await Promise.all([
      db.midjourneyJob.count({
        where: { userId, enqueuedAt: { gte: startOfDay } },
      }),
      db.midjourneyJob.count({
        where: { userId, state: { in: RUNNING_DB_STATES } },
      }),
      db.midjourneyJob.count({
        where: { userId, state: "COMPLETED", completedAt: { gte: startOfDay } },
      }),
      db.midjourneyJob.count({
        where: { userId, state: "FAILED", failedAt: { gte: startOfDay } },
      }),
      db.promptTemplate.count({
        where: {
          taskType: "midjourney_generate",
          versions: { some: { status: "ACTIVE" } },
        },
      }),
      // Son 7 gün batch sayımı listRecentBatches reuse (limit yüksek tut)
      listRecentBatches(userId, 200).then((all) =>
        all.filter((b) => b.createdAt >= sevenDaysAgo).length,
      ),
    ]);

  return {
    enqueuedToday,
    running,
    completedToday,
    failedToday,
    templates: templatesCount,
    batchesLast7d: recentBatches,
  };
}

/**
 * Pass 87 — "Needs Attention" failed jobs strip için.
 *
 * Son 24 saat içinde FAILED jobs (max 10), retry için doğrudan
 * batch detail page'e götürür. Tek bir job FAILED ise (single job),
 * kullanıcı job detail'e gider.
 */
export type AttentionFailedJob = {
  jobId: string;
  midjourneyJobId: string;
  prompt: string;
  blockReason: string | null;
  failedReason: string | null;
  failedAt: Date | null;
  /** Pass 84 batch context (varsa retry batch'a yönlendirir). */
  batchId: string | null;
};

export async function listFailedJobsNeedingAttention(
  userId: string,
  limit = 10,
): Promise<AttentionFailedJob[]> {
  const since = new Date();
  since.setHours(since.getHours() - 24);
  const rows = await db.midjourneyJob.findMany({
    where: {
      userId,
      state: "FAILED",
      failedAt: { gte: since },
    },
    select: {
      id: true,
      prompt: true,
      blockReason: true,
      failedReason: true,
      failedAt: true,
      job: {
        select: { id: true, metadata: true },
      },
    },
    orderBy: { failedAt: "desc" },
    take: limit,
  });
  return rows.map((r) => {
    const md = (r.job?.metadata as Record<string, unknown> | null) ?? {};
    const batchId =
      typeof md["batchId"] === "string" ? (md["batchId"] as string) : null;
    return {
      jobId: r.job?.id ?? "",
      midjourneyJobId: r.id,
      prompt: r.prompt,
      blockReason: r.blockReason,
      failedReason: r.failedReason,
      failedAt: r.failedAt,
      batchId,
    };
  });
}

/**
 * Pass 85 — Template run history.
 *
 * Belirli bir template id'sine bağlı tüm batch'leri listeler. Template
 * detail page'de "Bu template kaç kez koştu, ne zaman, ne sonuçlar?"
 * sorusuna yanıt verir.
 *
 * Aynı `listRecentBatches` pattern'ini kullanır — ek tablo yok;
 * Job.metadata.batchTemplateId üzerinden client-side group by batchId.
 */
export async function listBatchesByTemplate(
  userId: string,
  templateId: string,
  limit = 20,
): Promise<RecentBatchSummary[]> {
  const all = await listRecentBatches(userId, 200);
  return all
    .filter((b) => b.templateId === templateId)
    .slice(0, limit);
}

/**
 * Pass 86 — Retry-failed-only V1.
 *
 * Bir batch'in failed jobs'ları toplanır, aynı template + variables ile
 * yeni bir batch oluşturulur. Eski batch state intact kalır (tarihsel
 * kanıt); yeni batch'in metadata'sında retry lineage tutulur:
 *   - Job.metadata.retryOfBatchId = source batchId
 *   - Job.metadata.retrySourceJobId = retry edilen eski Job entity id
 *
 * Sözleşme:
 *   - Source batch user-scoped (cross-user retry yok)
 *   - Source batch'te FAILED job yoksa NoFailedJobsError throw
 *   - Source batch templateId varsa persisted template reuse;
 *     yoksa promptTemplate snapshot'tan inline retry
 *   - Aspect ratio + diğer generate params source'tan korunmaz
 *     (V1 scope: sadece prompt + variables; aspect/strategy yeni
 *     batch'te override'lanabilir; default 1:1 + auto)
 *   - Yeni batch maximum 50 job (mevcut Pass 80 limit)
 *
 * V1 sınır: source jobs'ın aspect/version/sref/oref/cref params'ı
 * Job.metadata'da SAKLI DEĞİL (Pass 84 sadece batchId/index/total/
 * template/variables yazıyor). V2'de bu params da metadata'ya alınıp
 * retry'da forward edilebilir. V1: sadece template + variables retry.
 */

export class NoFailedJobsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoFailedJobsError";
  }
}

export class BatchTemplateMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BatchTemplateMissingError";
  }
}

export type RetryFailedJobsResult = {
  newBatchId: string;
  newBatchCreatedAt: Date;
  retryOfBatchId: string;
  totalRetried: number;
  totalSubmitted: number;
  totalFailed: number;
  /** Her bir retry job için sonuç (Pass 80 BatchPerJobResult ile aynı tip). */
  results: Array<
    | {
        ok: true;
        index: number;
        midjourneyJobId: string;
        jobId: string;
        bridgeJobId: string;
        expandedPrompt: string;
        variables: Record<string, string>;
        retrySourceJobId: string;
      }
    | {
        ok: false;
        index: number;
        error: string;
        variables: Record<string, string>;
        retrySourceJobId: string;
      }
  >;
};

/**
 * Batch-first Phase 1 — batch → selection set lineage resolver.
 *
 * SelectionSet.sourceMetadata iki format taşır:
 *   1. MJ kept handoff: { mjOrigin: { batchIds: [batchId, ...] } }
 *   2. variation-batch quickStart: { kind: "variation-batch", batchId }
 *
 * Her iki path'i de kontrol eder; bulunan ilk set döner.
 * Schema migration yok — Prisma JSON path query.
 */
export async function findSelectionSetForBatch(
  userId: string,
  batchId: string,
): Promise<{ id: string; name: string } | null> {
  const [mjKept, variation] = await Promise.all([
    db.selectionSet.findFirst({
      where: {
        userId,
        sourceMetadata: {
          path: ["mjOrigin", "batchIds"],
          array_contains: batchId,
        },
      },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    db.selectionSet.findFirst({
      where: {
        userId,
        sourceMetadata: {
          path: ["batchId"],
          equals: batchId,
        },
      },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return mjKept ?? variation ?? null;
}

export async function retryFailedJobsFromBatch(input: {
  userId: string;
  sourceBatchId: string;
  /**
   * Yeni batch için aspect ratio. Source jobs'tan resolve edilemiyor
   * (Pass 84 metadata'da yok); V1: caller default verir veya UI'da
   * aspect/strategy override eder.
   */
  aspectRatio?: "1:1" | "2:3" | "3:2" | "4:3" | "3:4" | "16:9" | "9:16";
  /** V1: caller varsayılanı belirler (UI'da operator select). */
  submitStrategy?: "auto" | "api-first" | "dom-first";
}): Promise<RetryFailedJobsResult> {
  // 1) Source batch summary (user-scoped) — failed jobs'ları çıkar
  const summary = await getBatchSummary(input.sourceBatchId, input.userId);
  if (!summary) {
    throw new NoFailedJobsError(
      `Batch bulunamadı veya cross-user: ${input.sourceBatchId}`,
    );
  }
  const failedJobs = summary.jobs.filter((j) => j.state === "FAILED");
  if (failedJobs.length === 0) {
    throw new NoFailedJobsError(
      `Batch ${input.sourceBatchId.slice(0, 12)}... içinde FAILED job yok (${summary.counts.failed} failed)`,
    );
  }
  if (failedJobs.length > 50) {
    throw new NoFailedJobsError(
      `Retry V1 max 50 job (failed: ${failedJobs.length}). İki batch'a böl.`,
    );
  }

  // 2) Template resolve — Pass 84'te templateId varsa persisted reuse;
  //    yoksa promptTemplate snapshot'tan inline retry
  const templateId = summary.templateId ?? null;
  const promptTemplate = summary.promptTemplate ?? null;
  if (!templateId && !promptTemplate) {
    throw new BatchTemplateMissingError(
      `Batch ${input.sourceBatchId.slice(0, 12)}... templateId veya promptTemplate snapshot yok — retry yapılamıyor (V1 sınırı)`,
    );
  }

  // 3) Variable sets toplam — failed jobs'tan
  const variableSets: Array<Record<string, string>> = [];
  const retrySourceJobIds: string[] = [];
  for (const j of failedJobs) {
    if (!j.variables || Object.keys(j.variables).length === 0) {
      // Pass 86 V1: variables yoksa retry edilemez (template variables zorunlu)
      throw new BatchTemplateMissingError(
        `Failed Job ${j.jobId.slice(0, 8)}... için variables snapshot yok — retry yapılamıyor`,
      );
    }
    variableSets.push(j.variables);
    retrySourceJobIds.push(j.jobId);
  }

  // 4) Yeni batch enqueue — Pass 80 createMidjourneyJobsFromTemplateBatch
  //    + Pass 86 retryLineage
  const { createMidjourneyJobsFromTemplateBatch } = await import(
    "./midjourney.service"
  );
  const newBatch = await createMidjourneyJobsFromTemplateBatch({
    userId: input.userId,
    ...(templateId
      ? { templateId }
      : { promptTemplate: promptTemplate ?? "" }),
    variableSets,
    aspectRatio: input.aspectRatio ?? "1:1",
    submitStrategy: input.submitStrategy ?? "auto",
    retryLineage: {
      retryOfBatchId: input.sourceBatchId,
      retrySourceJobIds,
    },
  });

  return {
    newBatchId: newBatch.batchId,
    newBatchCreatedAt: newBatch.batchCreatedAt,
    retryOfBatchId: input.sourceBatchId,
    totalRetried: failedJobs.length,
    totalSubmitted: newBatch.totalSubmitted,
    totalFailed: newBatch.totalFailed,
    results: newBatch.results.map((r, i) => {
      const sourceJobId = retrySourceJobIds[i] ?? "";
      if (r.ok) {
        return {
          ok: true as const,
          index: r.index,
          midjourneyJobId: r.midjourneyJobId,
          jobId: r.jobId,
          bridgeJobId: r.bridgeJobId,
          expandedPrompt: r.expandedPrompt,
          variables: r.variables,
          retrySourceJobId: sourceJobId,
        };
      }
      return {
        ok: false as const,
        index: r.index,
        error: r.error,
        variables: r.variables,
        retrySourceJobId: sourceJobId,
      };
    }),
  };
}
