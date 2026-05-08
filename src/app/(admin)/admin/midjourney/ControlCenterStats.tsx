// Pass 87 — Operator Control Center: Quick Stats Header.
//
// Server component. "Şu an ne durumda?" sorusuna tek bakışta yanıt:
// 6 stat tile (enqueued today / running / completed today / failed today
// / templates / batches last 7d). Renk kodlu tone'lar:
//   - running → accent (canlı)
//   - completed → success
//   - failed → danger (vurgulu)
//   - templates / batches → neutral

import Link from "next/link";
import type { ControlCenterStats } from "@/server/services/midjourney/batches";

type StatTileProps = {
  label: string;
  value: number;
  href?: string;
  tone?: "neutral" | "accent" | "success" | "danger";
  hint?: string;
};

function StatTile({ label, value, href, tone, hint }: StatTileProps) {
  const valueClass =
    tone === "accent"
      ? "text-accent"
      : tone === "success"
        ? "text-success"
        : tone === "danger"
          ? "text-danger"
          : "text-text";
  const content = (
    <div
      className="flex flex-col gap-1 rounded-md border border-border bg-surface p-3 transition hover:border-border-strong"
      data-testid={`mj-cc-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="text-xs font-medium text-text-muted">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
      {hint ? <div className="text-xs text-text-subtle">{hint}</div> : null}
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export function ControlCenterStats({ stats }: { stats: ControlCenterStats }) {
  return (
    <section
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      data-testid="mj-cc-stats"
      aria-label="Midjourney Control Center stats"
    >
      <StatTile
        label="Bugün Üretildi"
        value={stats.enqueuedToday}
        hint="başlatılan job"
      />
      <StatTile
        label="Çalışıyor"
        value={stats.running}
        tone="accent"
        hint="canlı"
      />
      <StatTile
        label="Tamamlandı"
        value={stats.completedToday}
        tone="success"
        hint="bugün"
      />
      <StatTile
        label="Başarısız"
        value={stats.failedToday}
        tone="danger"
        hint="bugün"
      />
      <StatTile
        label="Templates"
        value={stats.templates}
        href="/admin/midjourney/templates"
        hint="aktif"
      />
      <StatTile
        label="Batches (7g)"
        value={stats.batchesLast7d}
        href="/admin/midjourney/batches"
        hint="son 7 gün"
      />
    </section>
  );
}
