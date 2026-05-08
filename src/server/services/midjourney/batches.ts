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

import { JobType } from "@prisma/client";
import { db } from "@/server/db";

const MJ_BATCH_METADATA_PATH = ["batchId"]; // Job.metadata.batchId

export type BatchJobRow = {
  /** Job (EtsyHub Job entity) id. */
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
  /** Block reason (FAILED ise). */
  blockReason: string | null;
  /** Failed reason mesajı. */
  failedReason: string | null;
  createdAt: Date;
  finishedAt: Date | null;
};

export type BatchSummary = {
  batchId: string;
  /** İlk job'un createdAt'i (batch oluşturulma zamanı). */
  createdAt: Date;
  /** Job'ların batchTotal field'ı (tüm batch için aynı). */
  batchTotal: number;
  /** Persisted template lineage (varsa). */
  templateId: string | null;
  /** Template metni (Job.metadata.batchPromptTemplate). */
  promptTemplate: string | null;
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
 */
export async function getBatchSummary(
  batchId: string,
  userId?: string,
): Promise<BatchSummary | null> {
  // Job.metadata.batchId üzerinden query (Prisma JSON path filter)
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
          generatedAssets: { select: { id: true } },
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

  let batchTotal = 0;
  let templateId: string | null = null;
  let promptTemplate: string | null = null;
  let retryOfBatchId: string | null = null;
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
    const state = j.midjourneyJob?.state ?? null;
    counts[bucketState(state)] += 1;
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
    createdAt: jobs[0]!.createdAt,
    batchTotal,
    templateId,
    promptTemplate,
    retryOfBatchId,
    counts,
    jobs: rows,
  };
}

export type RecentBatchSummary = {
  batchId: string;
  createdAt: Date;
  batchTotal: number;
  templateId: string | null;
  promptTemplatePreview: string | null;
  counts: BatchSummary["counts"];
};

/**
 * Son batch'leri özet listesi (max N). Aggregation Job.metadata'dan.
 * User-scoped.
 */
export async function listRecentBatches(
  userId: string,
  limit = 30,
): Promise<RecentBatchSummary[]> {
  // Tüm MJ_BRIDGE jobları al (batchId metadata'sı olanlar)
  // Pass 84 V1: Prisma JSON path "isSet" filter desteklemiyor; tüm jobs
  // alınıp client-side group yapılır. Bu kullanıcı bazlı küçük cardinality
  // (admin başına bir-kaç bin job). Pass 85+ büyük scale için indexed
  // batchId field'ı ayrı tabloya çıkarılabilir.
  const jobs = await db.job.findMany({
    where: {
      type: JobType.MIDJOURNEY_BRIDGE,
      userId,
    },
    select: {
      id: true,
      metadata: true,
      createdAt: true,
      midjourneyJob: { select: { state: true } },
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
      counts: BatchSummary["counts"];
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
      };
      byBatch.set(batchId, entry);
    }
    // En eski createdAt batch oluşturma anı
    if (j.createdAt < entry.createdAt) entry.createdAt = j.createdAt;
    entry.counts.total += 1;
    const state = j.midjourneyJob?.state ?? null;
    entry.counts[bucketState(state)] += 1;
  }

  return Array.from(byBatch.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((b) => ({
      batchId: b.batchId,
      createdAt: b.createdAt,
      batchTotal: b.batchTotal,
      templateId: b.templateId,
      promptTemplatePreview: b.promptTemplate
        ? b.promptTemplate.slice(0, 120)
        : null,
      counts: b.counts,
    }));
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
