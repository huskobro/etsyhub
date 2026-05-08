// Pass 87 — Operator Control Center: Active Operations.
//
// Section B — şu an "canlı" olan iki şeritte:
//   1. Running Jobs strip — non-terminal MJ Job'lar (max 6)
//   2. Recent Batches strip — son 5 batch (Pass 84 listRecentBatches)
//
// Server component. Tıklanan job → /[id], tıklanan batch → /batches/[batchId].

import Link from "next/link";
import { MidjourneyJobState } from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { db } from "@/server/db";
import type { RecentBatchSummary } from "@/server/services/midjourney/batches";

const NON_TERMINAL_STATES: MidjourneyJobState[] = [
  MidjourneyJobState.QUEUED,
  MidjourneyJobState.OPENING_BROWSER,
  MidjourneyJobState.AWAITING_LOGIN,
  MidjourneyJobState.AWAITING_CHALLENGE,
  MidjourneyJobState.SUBMITTING_PROMPT,
  MidjourneyJobState.WAITING_FOR_RENDER,
  MidjourneyJobState.COLLECTING_OUTPUTS,
  MidjourneyJobState.DOWNLOADING,
  MidjourneyJobState.IMPORTING,
];

const STATE_TONE: Record<string, BadgeTone> = {
  QUEUED: "neutral",
  OPENING_BROWSER: "accent",
  AWAITING_LOGIN: "warning",
  AWAITING_CHALLENGE: "warning",
  SUBMITTING_PROMPT: "accent",
  WAITING_FOR_RENDER: "accent",
  COLLECTING_OUTPUTS: "accent",
  DOWNLOADING: "accent",
  IMPORTING: "accent",
};

const STATE_LABELS: Record<string, string> = {
  QUEUED: "Sırada",
  OPENING_BROWSER: "Browser",
  AWAITING_LOGIN: "Login bekleniyor",
  AWAITING_CHALLENGE: "Doğrulama",
  SUBMITTING_PROMPT: "Submit",
  WAITING_FOR_RENDER: "Render",
  COLLECTING_OUTPUTS: "Çıktı topla",
  DOWNLOADING: "İndiriliyor",
  IMPORTING: "İçeri al",
};

type ActiveOpsProps = {
  userId: string;
  recentBatches: RecentBatchSummary[];
};

export async function ControlCenterActiveOps({
  userId,
  recentBatches,
}: ActiveOpsProps) {
  // Running jobs (non-terminal, son 6)
  const runningJobs = await db.midjourneyJob.findMany({
    where: {
      userId,
      state: { in: NON_TERMINAL_STATES },
    },
    select: {
      id: true,
      kind: true,
      state: true,
      prompt: true,
      enqueuedAt: true,
      mjJobId: true,
    },
    orderBy: { enqueuedAt: "desc" },
    take: 6,
  });

  return (
    <section
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      data-testid="mj-cc-active-ops"
      aria-label="Active operations"
    >
      {/* Running jobs */}
      <div className="rounded-md border border-border bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Çalışan İşler</h3>
          <span className="text-xs text-text-muted">
            {runningJobs.length} canlı
          </span>
        </div>
        {runningJobs.length === 0 ? (
          <p className="rounded border border-dashed border-border bg-surface-2 p-3 text-center text-xs text-text-muted">
            Şu an çalışan iş yok. Yeni bir batch başlat.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5" data-testid="mj-cc-running-list">
            {runningJobs.map((j) => (
              <li
                key={j.id}
                className="flex items-center gap-2 rounded border border-border bg-bg p-2"
              >
                <Badge tone={STATE_TONE[j.state] ?? "accent"}>
                  {STATE_LABELS[j.state] ?? j.state}
                </Badge>
                <Link
                  href={`/admin/midjourney/${j.id}`}
                  className="flex-1 truncate text-xs text-text hover:text-accent"
                  title={j.prompt}
                >
                  {j.prompt.slice(0, 80)}
                  {j.prompt.length > 80 ? "…" : ""}
                </Link>
                {j.kind !== "GENERATE" ? (
                  <span className="rounded bg-surface-2 px-1 py-0.5 font-mono text-xs text-text-muted">
                    {j.kind.toLowerCase()}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent batches strip (last 5) */}
      <div className="rounded-md border border-border bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Son Batch&apos;ler</h3>
          <Link
            href="/admin/midjourney/batches"
            className="text-xs text-accent underline hover:no-underline"
          >
            Hepsini gör →
          </Link>
        </div>
        {recentBatches.length === 0 ? (
          <p className="rounded border border-dashed border-border bg-surface-2 p-3 text-center text-xs text-text-muted">
            Henüz batch yok.{" "}
            <Link
              href="/admin/midjourney/batch-run"
              className="text-accent underline"
            >
              İlk batch&apos;i başlat
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5" data-testid="mj-cc-batches-list">
            {recentBatches.slice(0, 5).map((b) => {
              const completed = b.counts.completed;
              const failed = b.counts.failed;
              const pending = b.counts.queued + b.counts.running;
              return (
                <li key={b.batchId}>
                  <Link
                    href={`/admin/midjourney/batches/${b.batchId}`}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-bg p-2 transition hover:border-border-strong"
                  >
                    <div className="flex flex-1 items-center gap-2 min-w-0">
                      <code className="font-mono text-xs text-text-muted">
                        {b.batchId.slice(0, 8)}
                      </code>
                      {b.promptTemplatePreview ? (
                        <span className="truncate text-xs text-text">
                          {b.promptTemplatePreview}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">
                          (inline)
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {completed > 0 ? (
                        <Badge tone="success">{completed}</Badge>
                      ) : null}
                      {pending > 0 ? (
                        <Badge tone="accent">{pending}</Badge>
                      ) : null}
                      {failed > 0 ? (
                        <Badge tone="danger">{failed}</Badge>
                      ) : null}
                      {completed === 0 && pending === 0 && failed === 0 ? (
                        <span className="text-xs text-text-muted">—</span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
