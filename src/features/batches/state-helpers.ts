import type { BadgeTone } from "@/components/ui/Badge";

/**
 * Batch / Job state vocabulary helpers.
 *
 * Source: src/server/services/midjourney/bridge-client.ts +
 * legacy admin batch detail page (Pass 84). Centralised so Batches index,
 * Batch detail, Batch review and ActiveTasksPanel use the same labels and
 * tones.
 */

export type JobState =
  | "QUEUED"
  | "OPENING_BROWSER"
  | "AWAITING_LOGIN"
  | "AWAITING_CHALLENGE"
  | "SUBMITTING_PROMPT"
  | "WAITING_FOR_RENDER"
  | "COLLECTING_OUTPUTS"
  | "DOWNLOADING"
  | "IMPORTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export const JOB_STATE_LABEL_TR: Record<JobState, string> = {
  QUEUED: "Sırada",
  OPENING_BROWSER: "Browser açılıyor",
  AWAITING_LOGIN: "Login bekleniyor",
  AWAITING_CHALLENGE: "Doğrulama bekleniyor",
  SUBMITTING_PROMPT: "Prompt gönderiliyor",
  WAITING_FOR_RENDER: "Render bekleniyor",
  COLLECTING_OUTPUTS: "Çıktılar toplanıyor",
  DOWNLOADING: "İndiriliyor",
  IMPORTING: "İçeri alınıyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
  CANCELLED: "İptal",
};

/** English short labels for index tables (mono compact). */
export const JOB_STATE_LABEL_SHORT: Record<JobState, string> = {
  QUEUED: "Queued",
  OPENING_BROWSER: "Opening",
  AWAITING_LOGIN: "Login",
  AWAITING_CHALLENGE: "Challenge",
  SUBMITTING_PROMPT: "Submitting",
  WAITING_FOR_RENDER: "Rendering",
  COLLECTING_OUTPUTS: "Collecting",
  DOWNLOADING: "Downloading",
  IMPORTING: "Importing",
  COMPLETED: "Succeeded",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export function jobStateTone(state: string | null): BadgeTone {
  if (!state) return "neutral";
  if (state === "COMPLETED") return "success";
  if (state === "FAILED" || state === "CANCELLED") return "danger";
  if (state === "AWAITING_LOGIN" || state === "AWAITING_CHALLENGE")
    return "warning";
  if (state === "QUEUED") return "neutral";
  return "accent";
}

export type BatchAggregateStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "queued"
  | "mixed";

export interface BatchCounts {
  total: number;
  queued: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  awaiting: number;
}

/** Reduce a batch's per-job counts to a single status badge. */
export function batchAggregateStatus(counts: BatchCounts): BatchAggregateStatus {
  if (counts.running + counts.awaiting > 0) return "running";
  if (counts.failed > 0 && counts.completed === 0) return "failed";
  if (counts.completed === counts.total && counts.total > 0) return "succeeded";
  if (counts.queued === counts.total && counts.total > 0) return "queued";
  return "mixed";
}

export const BATCH_STATUS_LABEL: Record<BatchAggregateStatus, string> = {
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  queued: "Queued",
  mixed: "Mixed",
};

export function batchStatusTone(status: BatchAggregateStatus): BadgeTone {
  switch (status) {
    case "running":
      return "warning";
    case "succeeded":
      return "success";
    case "failed":
      return "danger";
    case "queued":
      return "neutral";
    case "mixed":
      return "info";
  }
}
