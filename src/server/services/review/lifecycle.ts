// IA Phase 18 — review scoring lifecycle resolver.
//
// CLAUDE.md Madde N — sistem skoru lifecycle taşır. Bu modül
// her asset için **dürüst** lifecycle değerini Job tablosundan
// türev olarak hesaplar. UI buna güvenir; "waiting for AI" gibi
// belirsiz tek-state kabul edilmez.
//
// Backend ayrımı:
//   • not_queued — Job tablosunda asset id'si için REVIEW_DESIGN row yok.
//   • queued    — en son REVIEW_DESIGN row durumu QUEUED.
//   • running   — en son REVIEW_DESIGN row durumu RUNNING (provider
//                 yanıtı bekleniyor).
//   • failed    — en son REVIEW_DESIGN row durumu FAILED (audit'te neden).
//   • ready     — asset'te reviewedAt + reviewProviderSnapshot dolu.
//                 (Job state'i SUCCESS olsa da asset persisted olmadıysa
//                 ready demeyiz — asset row tek doğruluk kaynağı.)
//   • na        — gelecek kullanım; şu an helper bu state'i resolve etmez.
//
// Lifecycle sırası:
//   1. Asset reviewedAt + provider snapshot dolu ⇒ ready (en güçlü
//      sinyal; provider gerçekten cevap verdi ve persist'ledi)
//   2. Job tablosunda en son REVIEW_DESIGN row state'ine göre
//      mapping (QUEUED|RUNNING|FAILED).
//   3. Job tablosunda satır yok ⇒ not_queued.
//
// Query verimi: tek round-trip. Caller `assetIds` listesini geçer,
// helper Job tablosundan tek `findMany` ile en son row'ları çeker
// (per-asset metadata path). Her asset için en son createdAt'lı
// row'u alır.

import { JobStatus, JobType } from "@prisma/client";
import { db } from "@/server/db";

export type ReviewLifecycleState =
  | "not_queued"
  | "queued"
  | "running"
  | "failed"
  | "ready";

/**
 * Tüm asset'ler için lifecycle'ı resolve eder. `readyIds` set'i
 * ready kabul edilenleri içerir (caller'ın asset row'u üzerinden
 * türev: reviewedAt && reviewProviderSnapshot). Geri kalanlar
 * için Job tablosu metadata path'i ile en son REVIEW_DESIGN
 * row'unu okur.
 */
export async function resolveReviewLifecycle(args: {
  userId: string;
  scope: "design" | "local";
  assetIds: ReadonlyArray<string>;
  readyIds: ReadonlySet<string>;
}): Promise<Map<string, ReviewLifecycleState>> {
  const { userId, scope, assetIds, readyIds } = args;
  const out = new Map<string, ReviewLifecycleState>();
  if (assetIds.length === 0) return out;

  // Step 1: ready'leri işaretle
  for (const id of assetIds) {
    if (readyIds.has(id)) out.set(id, "ready");
  }
  const remaining = assetIds.filter((id) => !readyIds.has(id));
  if (remaining.length === 0) return out;

  // Step 2: Job tablosundan REVIEW_DESIGN row'larını çek + client-
  // side metadata filtresi. Prisma JSON path filter Postgres'te
  // ekstra path/in kombinasyonu desteklemediği için (ve kullanıcı
  // başına row sayısı zaten sınırlı), bu defansif yaklaşım.
  // Performans: N=remaining (max queue page size 24), Job tablosu
  // userId+type indexli — round-trip ucuz.
  const idField = scope === "design" ? "generatedDesignId" : "localAssetId";
  const jobs = await db.job.findMany({
    where: {
      userId,
      type: JobType.REVIEW_DESIGN,
    },
    select: {
      id: true,
      status: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    // Bound the scan; recent rows are enough for the visible queue
    // window. Older Job rows (succeeded long ago) anyway resolve
    // through the readyIds set (asset row truth), not through this
    // path.
    take: 1000,
  });
  const remainingSet = new Set<string>(remaining);

  // Group by asset id; her asset için en son (orderBy desc gereği
  // ilk gelen) state alınır. Yalnız remaining set'inde olanlara
  // bakarız — diğer asset'leri okumayız.
  const seen = new Set<string>();
  for (const j of jobs) {
    const md = j.metadata as Record<string, unknown> | null;
    const assetIdRaw = md && typeof md === "object" ? md[idField] : null;
    if (typeof assetIdRaw !== "string") continue;
    if (!remainingSet.has(assetIdRaw)) continue;
    if (seen.has(assetIdRaw)) continue;
    if (out.has(assetIdRaw)) continue; // ready already set
    seen.add(assetIdRaw);
    out.set(assetIdRaw, mapJobStatus(j.status));
  }

  // Step 3: kalanlar (Job satırı bile yok) ⇒ not_queued
  for (const id of remaining) {
    if (!out.has(id)) out.set(id, "not_queued");
  }
  return out;
}

function mapJobStatus(status: JobStatus): ReviewLifecycleState {
  switch (status) {
    case JobStatus.QUEUED:
      return "queued";
    case JobStatus.RUNNING:
      return "running";
    case JobStatus.FAILED:
      return "failed";
    case JobStatus.SUCCESS:
      // SUCCESS ama asset reviewedAt yoksa pratikte race penceresi —
      // defansif olarak "running" diyoruz; ready ayrı set'te
      // işaretleniyor.
      return "running";
    case JobStatus.CANCELLED:
      return "failed";
  }
}

/**
 * Operasyonel sayaç — review pipeline'ın canlı durumu.
 * Admin pane "review operations" bölümü buradan beslenir.
 */
export type ReviewOpsCounts = {
  queued: number;
  running: number;
  failed: number;
  /** Last enqueue time (any REVIEW_DESIGN row, this user). */
  lastEnqueueAt: string | null;
  /** Last successful local scan (SCAN_LOCAL_FOLDER row, this user). */
  lastLocalScanAt: string | null;
};

export async function getReviewOpsCounts(userId: string): Promise<ReviewOpsCounts> {
  const [queued, running, failed, lastEnqueue, lastScan] = await Promise.all([
    db.job.count({
      where: {
        userId,
        type: JobType.REVIEW_DESIGN,
        status: JobStatus.QUEUED,
      },
    }),
    db.job.count({
      where: {
        userId,
        type: JobType.REVIEW_DESIGN,
        status: JobStatus.RUNNING,
      },
    }),
    db.job.count({
      where: {
        userId,
        type: JobType.REVIEW_DESIGN,
        status: JobStatus.FAILED,
      },
    }),
    db.job.findFirst({
      where: { userId, type: JobType.REVIEW_DESIGN },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    db.job.findFirst({
      where: {
        userId,
        type: JobType.SCAN_LOCAL_FOLDER,
        status: JobStatus.SUCCESS,
      },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);
  return {
    queued,
    running,
    failed,
    lastEnqueueAt: lastEnqueue?.createdAt.toISOString() ?? null,
    lastLocalScanAt: lastScan?.finishedAt?.toISOString() ?? null,
  };
}
