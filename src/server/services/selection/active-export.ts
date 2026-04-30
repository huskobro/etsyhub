// Phase 7 Task 14 — getActiveExport retrieval (Set GET payload helper).
//
// Sözleşme (design Section 6.6):
//   Set GET payload'ında `activeExport` alanı, kullanıcının bu set için en son
//   `EXPORT_SELECTION_SET` job'unun durumunu döndürür. UI bu objeye bakarak
//   "İndir hazır" / "İşleniyor" / "Tekrar dene" butonlarını render eder.
//
// Output shape:
//   {
//     jobId: string,
//     status: "queued" | "running" | "completed" | "failed",
//     downloadUrl?: string,    // yalnız completed && expiresAt > now
//     expiresAt?: string,      // ISO; signed URL TTL (24h)
//     failedReason?: string,   // BullMQ otomatik error.message
//   } | null
//
// Akış:
//   1. queues[EXPORT_SELECTION_SET] üzerinden ALL relevant state'lerden
//      job listesi çek (waiting/delayed/active/completed/failed).
//   2. Filter: job.data.userId === userId && job.data.setId === setId
//      (cross-user/cross-set izolasyon — queue içindeki payload üstünden;
//      `getJobs` kendi başına filter yapmaz).
//   3. En son job seçilir — `timestamp desc` (BullMQ enqueue zamanı; aynı
//      anda push olsa bile millisecond resolution genellikle yeterli).
//   4. State mapping:
//        waiting | delayed → "queued"
//        active           → "running"
//        completed        → "completed"
//        failed           → "failed"
//   5. Completed:
//        - Job result'tan storageKey oku (`job.returnvalue.storageKey`).
//        - finishedOn + 24h vs now: expired ise downloadUrl/expiresAt
//          UNDEFINED, status hala "completed".
//        - Geçerli ise generateExportSignedUrl(storageKey) çağır → URL ve
//          expiresAt populate et.
//   6. Failed: failedReason populate (job.failedReason; BullMQ otomatik set).
//   7. Queued/running: yalnız jobId + status.
//
// Risk notları:
//   - getJobs(types, 0, 100): Phase 7 v1 sınırı; queue `removeOnComplete:1000`
//     paterniyle korunur. Bottleneck olursa carry-forward
//     `selection-studio-active-export-db-index`.
//   - returnvalue defensive parse — worker handler return shape değişirse
//     undefined döner (silent fallback yerine status=completed ama URL yok).

import type { Job } from "bullmq";
import { JobType } from "@prisma/client";
import { queues } from "@/server/queue";
import {
  EXPORT_SIGNED_URL_TTL_SECONDS,
  generateExportSignedUrl,
} from "./export/signed-url";

// ────────────────────────────────────────────────────────────
// Output type
// ────────────────────────────────────────────────────────────

export type ActiveExport = {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  downloadUrl?: string;
  expiresAt?: string;
  failedReason?: string;
};

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/**
 * BullMQ JobState (waiting/delayed/active/completed/failed) → ActiveExport
 * status mapping. Bilinmeyen state → null (caller'da defensive olarak
 * yok sayılır — pratikte BullMQ getJobs'a verdiğimiz state'lerin dışına
 * çıkmaz).
 */
function mapJobState(
  state: string,
): ActiveExport["status"] | null {
  switch (state) {
    case "waiting":
    case "delayed":
      return "queued";
    case "active":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

/**
 * Job'un `returnvalue.storageKey`'ini defensive parse eder.
 * Worker handler `{ storageKey, jobId }` döndürür; ama BullMQ JSON serialize
 * ettiği için tip garantisi yok → runtime check.
 */
function extractStorageKey(returnvalue: unknown): string | null {
  if (
    returnvalue &&
    typeof returnvalue === "object" &&
    "storageKey" in returnvalue &&
    typeof (returnvalue as { storageKey: unknown }).storageKey === "string"
  ) {
    return (returnvalue as { storageKey: string }).storageKey;
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Set'in en son export job'unun durumunu BullMQ'dan çeker.
 *
 * Output:
 *   - Job yoksa null.
 *   - Varsa ActiveExport objesi (status'a göre alanlar populate/undefined).
 *
 * Cross-user/cross-set: queue payload'undaki `userId` ve `setId` tutmuyorsa
 * filter'da elenir; getActiveExport hiçbir zaman caller dışındaki bir
 * kullanıcının job'unu döndürmez.
 */
export async function getActiveExport(input: {
  userId: string;
  setId: string;
}): Promise<ActiveExport | null> {
  const queue = queues[JobType.EXPORT_SELECTION_SET];

  // 1+2) Tüm state'lerdeki job'ları çek + payload filter.
  const jobs = (await queue.getJobs(
    ["waiting", "delayed", "active", "completed", "failed"],
    0,
    100,
  )) as Job<{ userId?: string; setId?: string }>[];

  const owned = jobs.filter((j) => {
    const data = j.data;
    return (
      data &&
      typeof data === "object" &&
      data.userId === input.userId &&
      data.setId === input.setId
    );
  });
  if (owned.length === 0) {
    return null;
  }

  // 3) En son enqueue edilen seçilir (timestamp desc).
  owned.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  const job = owned[0]!;
  const jobId = job.id;
  if (!jobId) {
    // BullMQ pratikte job.id daima atar; defansif fallback.
    return null;
  }

  // 4) State.
  const state = await job.getState();
  const status = mapJobState(state);
  if (!status) {
    return null;
  }

  // 5) Completed branch — storageKey + TTL kontrolü.
  if (status === "completed") {
    const storageKey = extractStorageKey(job.returnvalue);
    const finishedOn = job.finishedOn;
    if (storageKey && typeof finishedOn === "number") {
      const expiresAtMs = finishedOn + EXPORT_SIGNED_URL_TTL_SECONDS * 1000;
      if (expiresAtMs > Date.now()) {
        // Hala geçerli → fresh signed URL üret (TTL = 24h, expiresAt now+24h).
        const { url, expiresAt } = await generateExportSignedUrl(storageKey);
        return {
          jobId,
          status,
          downloadUrl: url,
          expiresAt: expiresAt.toISOString(),
        };
      }
      // Expired → status hala "completed" ama URL/expiresAt UNDEFINED.
      return { jobId, status };
    }
    // returnvalue yok / shape bozuk: completed ama URL üretemiyoruz.
    return { jobId, status };
  }

  // 6) Failed branch.
  if (status === "failed") {
    return {
      jobId,
      status,
      failedReason: job.failedReason || undefined,
    };
  }

  // 7) Queued / running.
  return { jobId, status };
}
