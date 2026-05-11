// IA Phase 18 — review scoring lifecycle resolver.
// IA-39 / IA-39+ — not_queued reason codes: operatöre neden asset henüz
//   scoring'e alınmadığı açıklanır.
//
// CLAUDE.md Madde N — sistem skoru lifecycle taşır. Bu modül
// her asset için **dürüst** lifecycle değerini Job tablosundan
// türev olarak hesaplar. UI buna güvenir; "waiting for AI" gibi
// belirsiz tek-state kabul edilmez.
//
// Backend ayrımı:
//   • not_queued — Job tablosunda asset id'si için REVIEW_DESIGN row yok.
//     Reason alt-kodu (NotQueuedReason):
//       - pending_mapping: local asset için folder mapping atanmamış.
//       - ignored: folder __ignore__ işaretli.
//       - auto_enqueue_disabled: ayarlardan auto-enqueue devre dışı.
//       - discovery_not_run: local asset hiç scan/watcher tetiklenmemiş;
//           operatör "Scan now" ile manuel tetiklemeli veya watcher beklemeli.
//       - legacy: IA-29 öncesi oluşturulmuş, henüz hiç job tetiklenmedi.
//       - design_pending_worker: AI design için variation worker henüz
//         tamamlanmamış (design QUEUED/RUNNING state).
//       - unknown: diğer durumlar.
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
//   3. Job tablosunda satır yok ⇒ not_queued (+ reason).
//
// Query verimi: tek round-trip. Caller `assetIds` listesini geçer,
// helper Job tablosundan tek `findMany` ile en son row'ları çeker
// (per-asset metadata path). Her asset için en son createdAt'lı
// row'u alır.

import { JobStatus, JobType, VariationState } from "@prisma/client";
import { db } from "@/server/db";

export type ReviewLifecycleState =
  | "not_queued"
  | "queued"
  | "running"
  | "failed"
  | "ready";

/**
 * IA-39 — why is the asset not queued? UI copy differs per reason
 * so the operator can take targeted action.
 */
export type NotQueuedReason =
  | "pending_mapping"         // local: folder has no productType mapping
  | "ignored"                 // local: folder is __ignore__
  | "auto_enqueue_disabled"   // settings: local or AI auto-enqueue turned off
  | "discovery_not_run"       // local: scan/watcher has never run; trigger manually
  | "design_pending_worker"   // AI design: variation job not finished yet
  | "legacy"                  // pre-IA-29 row, never had a review job
  | "unknown";

/** Full lifecycle result including optional not_queued reason. */
export type ReviewLifecycleResult =
  | { state: Exclude<ReviewLifecycleState, "not_queued"> }
  | { state: "not_queued"; reason: NotQueuedReason };

/**
 * IA-39 — extended lifecycle map with not_queued reason codes.
 *
 * Tüm asset'ler için lifecycle'ı resolve eder. `readyIds` set'i
 * ready kabul edilenleri içerir (caller'ın asset row'u üzerinden
 * türev: reviewedAt && reviewProviderSnapshot). Geri kalanlar
 * için Job tablosu metadata path'i ile en son REVIEW_DESIGN
 * row'unu okur.
 *
 * `notQueuedReasons` map: asset id → reason. Caller'ın not_queued
 * için operatöre ayrıntılı mesaj vermesini sağlar.
 */
export async function resolveReviewLifecycle(args: {
  userId: string;
  scope: "design" | "local";
  assetIds: ReadonlyArray<string>;
  readyIds: ReadonlySet<string>;
  /** IA-39 — per-asset reason hints for not_queued classification.
   *  local: { [assetId]: "pending_mapping" | "ignored" | "unknown" }
   *  design: { [assetId]: "design_pending_worker" | "unknown" }
   *  Absent entry → "legacy" (pre-IA-29, never had a job). */
  notQueuedHints?: ReadonlyMap<string, NotQueuedReason>;
  /** IA-39 — if auto-enqueue is globally disabled, all not_queued
   *  items get "auto_enqueue_disabled" reason unless a more specific
   *  hint overrides it. */
  autoEnqueueDisabled?: boolean;
}): Promise<Map<string, ReviewLifecycleResult>> {
  const { userId, scope, assetIds, readyIds, notQueuedHints, autoEnqueueDisabled } = args;
  const out = new Map<string, ReviewLifecycleResult>();
  if (assetIds.length === 0) return out;

  // Step 1: ready'leri işaretle
  for (const id of assetIds) {
    if (readyIds.has(id)) out.set(id, { state: "ready" });
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
    out.set(assetIdRaw, { state: mapJobStatus(j.status) });
  }

  // Step 3: kalanlar (Job satırı bile yok) ⇒ not_queued + reason
  for (const id of remaining) {
    if (!out.has(id)) {
      // Reason resolution order:
      // 1. Specific hint from caller (e.g. pending_mapping, ignored, design_pending_worker)
      // 2. Global auto-enqueue disabled
      // 3. "legacy" (no hint = pre-IA-29 row that never triggered a job)
      const hintReason = notQueuedHints?.get(id);
      const reason: NotQueuedReason =
        hintReason ??
        (autoEnqueueDisabled ? "auto_enqueue_disabled" : "legacy");
      out.set(id, { state: "not_queued", reason });
    }
  }
  return out;
}

function mapJobStatus(status: JobStatus): Exclude<ReviewLifecycleState, "not_queued"> {
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
  /**
   * True if a REVIEW_DESIGN or SCAN_LOCAL_FOLDER job finished within the
   * last 5 minutes. This is a recent-activity proxy for worker liveness —
   * more reliable than BullMQ getWorkersCount() (which can return stale
   * Redis CLIENT LIST entries). Safe to call from Next.js; no chokidar.
   *
   * Known gap: a freshly started worker with no recent completions shows
   * false until its first job finishes (~seconds for an active queue).
   * Acceptable for ops display; not a real-time liveness guarantee.
   */
  workerRunning: boolean;
  /**
   * IA-39+ — local discovery mode visible to admin:
   *   "event+periodic" — watcher active AND periodic scan interval > 0
   *   "event_only"     — watcher active, no periodic scan
   *   "periodic_only"  — no watcher, periodic scan interval > 0
   *   "manual_only"    — neither watcher nor periodic scan active
   */
  discoveryMode: "event+periodic" | "event_only" | "periodic_only" | "manual_only";
  /** True if the chokidar file watcher is running for this user. */
  watcherActive: boolean;
  /** Trigger count from watcher since last startup (null if watcher not active). */
  watcherTriggerCount: number | null;
  /** Last time watcher triggered a scan (null if none). */
  watcherLastTriggerAt: string | null;
};

export async function getReviewOpsCounts(
  userId: string,
  opts?: {
    /** Resolved from ReviewSettings.automation.localScanIntervalMinutes */
    localScanIntervalMinutes?: number;
    /**
     * IA-39+ — watcher state injected by the caller (worker process only).
     * API routes running in Next.js must NOT import the watcher module
     * (chokidar native binary incompatible with webpack bundling). When
     * omitted, watcherActive defaults to false and watcher fields are null.
     */
    watcherInfo?: {
      active: boolean;
      triggerCount: number;
      lastTriggerAt: Date | null;
    };
  },
): Promise<ReviewOpsCounts> {
  const [queued, running, failed, lastEnqueue, lastScan, workerCheck] = await Promise.all([
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
    // Worker liveness: did any REVIEW_DESIGN or SCAN_LOCAL_FOLDER job
    // finish within the last 5 minutes? If yes, the worker process was
    // active recently. This is more reliable than BullMQ getWorkersCount()
    // (which can have stale Redis CLIENT LIST entries). Not a real-time
    // signal — a freshly started worker with no recent completions shows
    // false until its first job finishes. Acceptable for ops display.
    db.job.findFirst({
      where: {
        type: { in: [JobType.REVIEW_DESIGN, JobType.SCAN_LOCAL_FOLDER] },
        finishedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        status: { in: [JobStatus.SUCCESS, JobStatus.FAILED] },
      },
      select: { id: true },
    }).catch(() => null),
  ]);

  // IA-39+ — watcher state injected by caller (worker context only).
  // API routes in Next.js omit this; watcher fields default to inactive.
  const watcherActive = opts?.watcherInfo?.active ?? false;
  const watcherTriggerCount = watcherActive ? (opts?.watcherInfo?.triggerCount ?? 0) : null;
  const watcherLastTriggerAt = opts?.watcherInfo?.lastTriggerAt?.toISOString() ?? null;

  const recentJob = workerCheck as { id: string } | null;
  // workerRunning = true if a job finished within the last 5 minutes.
  // Caveat: false for a freshly started worker with no completions yet.
  const workerRunning = recentJob !== null;
  const hasPeriodic = (opts?.localScanIntervalMinutes ?? 0) > 0;
  // discoveryMode reflects what is ACTUALLY running, not what is configured.
  // Both watcher and periodic require the worker process; if worker is not
  // running neither is active regardless of settings.
  const discoveryMode: ReviewOpsCounts["discoveryMode"] =
    !workerRunning
      ? "manual_only"
      : watcherActive && hasPeriodic
        ? "event+periodic"
        : watcherActive
          ? "event_only"
          : hasPeriodic
            ? "periodic_only"
            : "manual_only";

  return {
    queued,
    running,
    failed,
    lastEnqueueAt: lastEnqueue?.createdAt.toISOString() ?? null,
    lastLocalScanAt: lastScan?.finishedAt?.toISOString() ?? null,
    workerRunning,
    discoveryMode,
    watcherActive,
    watcherTriggerCount,
    watcherLastTriggerAt,
  };
}
