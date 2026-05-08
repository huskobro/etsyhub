// Pass 87 — Operator Control Center: Needs Attention.
//
// Section C — son 24 saat içinde FAILED jobs strip.
// Operatör için: "neyi düzeltmem lazım, nereden retry başlatabilirim".
//
// Failed job'a tıklayınca:
//   - Batch context varsa → batch detail (Pass 86 retry button orada)
//   - Yoksa → job detail (manuel inceleme)

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { AttentionFailedJob } from "@/server/services/midjourney/batches";

type AttentionProps = {
  failedJobs: AttentionFailedJob[];
};

function relTime(date: Date | null): string {
  if (!date) return "—";
  const ms = Date.now() - date.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "şimdi";
  if (min < 60) return `${min}dk önce`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}sa önce`;
  const day = Math.floor(hr / 24);
  return `${day}g önce`;
}

export function ControlCenterAttention({ failedJobs }: AttentionProps) {
  if (failedJobs.length === 0) {
    return (
      <section
        className="rounded-md border border-success bg-success-soft p-3"
        data-testid="mj-cc-attention-empty"
      >
        <p className="text-sm text-success-text">
          ✓ Son 24 saatte fail eden job yok.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-md border border-danger bg-danger-soft/30 p-3"
      data-testid="mj-cc-attention"
      aria-label="Needs attention"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-danger">
          Dikkat Gerektiren ({failedJobs.length})
        </h3>
        <span className="text-xs text-text-muted">son 24 saat</span>
      </div>
      <ul
        className="flex flex-col gap-1.5"
        data-testid="mj-cc-attention-list"
      >
        {failedJobs.map((j) => {
          // Batch context varsa retry için batch detail page'e yönlendir
          const href = j.batchId
            ? `/admin/midjourney/batches/${j.batchId}`
            : `/admin/midjourney/${j.midjourneyJobId}`;
          return (
            <li key={j.midjourneyJobId}>
              <Link
                href={href}
                className="flex items-start gap-2 rounded border border-border bg-bg p-2 transition hover:border-danger"
              >
                <Badge tone="danger">FAIL</Badge>
                <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                  <span
                    className="truncate text-xs text-text"
                    title={j.prompt}
                  >
                    {j.prompt.slice(0, 90)}
                    {j.prompt.length > 90 ? "…" : ""}
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    {j.blockReason ? (
                      <code className="rounded bg-surface-2 px-1 font-mono">
                        {j.blockReason}
                      </code>
                    ) : null}
                    <span>{relTime(j.failedAt)}</span>
                    {j.batchId ? (
                      <span className="text-accent">
                        batch {j.batchId.slice(0, 8)} →
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
