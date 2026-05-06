import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import {
  JOB_STATUS_LABELS,
  jobTypeLabel,
} from "@/features/jobs/labels";

/**
 * RecentJobsCard — T-31.
 *
 * Son işler kartı. Mevcut `recentJobs` (5 satır) listesini Card içinde render eder.
 * Status badge tone matrisi: QUEUED neutral · RUNNING accent · SUCCESS success ·
 * FAILED danger · CANCELLED neutral (dashboard-widgets.md kilitli karar).
 *
 * Pass 38 — Türkçe label.
 * Pre-Pass 38: raw enum ("SCRAPE_COMPETITOR", "QUEUED") gösteriyordu —
 * ürün-içi tutarsızlık (Bookmark/Selection/Listings hep Türkçe). Şimdi:
 *   - JobType enum → TR label (sık kullanılan 14 type; bilinmeyen raw fallback)
 *   - JobStatus → TR label (5 status)
 *   - Raw type/status/id title attr (debug için fare ile görünür)
 *
 * Row tıklanmaz — `/admin/jobs/[id]` detail page yok ve `/admin/jobs`
 * index page mevcut codebase'de build error veriyor (Table primitive
 * createContext + server component karışımı). Detail link
 * carry-forward: `dashboard-recent-jobs-detail-link`.
 */

export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export interface DashboardJob {
  id: string;
  type: string;
  status: JobStatus;
  createdAt: Date;
}

const statusTone: Record<JobStatus, BadgeTone> = {
  QUEUED: "neutral",
  RUNNING: "accent",
  SUCCESS: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

// Pass 40 — JOB_TYPE_LABELS + STATUS_LABELS shared modüle taşındı
// (`@/features/jobs/labels`). Admin /admin/jobs aynı kaynaktan tüketir.

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.round(hours / 24);
  return `${days} gün önce`;
}

export function RecentJobsCard({ jobs }: { jobs: DashboardJob[] }) {
  return (
    <Card
      variant="list"
      className="flex flex-col items-stretch gap-3 p-5"
      data-testid="recent-jobs-card"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Son işler</h2>
        <span className="font-mono text-xs text-text-muted">son 5 iş</span>
      </div>
      {jobs.length === 0 ? (
        <p className="text-sm text-text-muted">Henüz job çalışmadı.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {jobs.map((job) => {
            const label = jobTypeLabel(job.type);
            const isUnmapped = label === job.type;
            const statusLabelText = JOB_STATUS_LABELS[job.status];
            return (
              <li
                key={job.id}
                title={`${job.type} · ${job.status} · ${job.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2 text-sm"
                data-testid="recent-jobs-row"
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={
                      isUnmapped
                        ? "truncate font-mono text-text"
                        : "truncate text-text"
                    }
                  >
                    {label}
                  </p>
                  <p className="text-xs text-text-muted">
                    {relativeTime(job.createdAt)}
                  </p>
                </div>
                <Badge tone={statusTone[job.status]}>{statusLabelText}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
