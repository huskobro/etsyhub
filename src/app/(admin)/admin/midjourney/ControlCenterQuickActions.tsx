// Pass 87 — Operator Control Center: Production Quick Actions.
//
// Section A — günlük operatör için en sık yapılan 3 iş:
//   1. Yeni Batch Run (template + variables → N job)
//   2. Templates (CRUD + run history)
//   3. Test Render (tek-shot, advanced/aşağıda da var ama hızlı erişim)
//
// Sade primary card grid; her card hover'da accent border.

import Link from "next/link";

type ActionCardProps = {
  href: string;
  title: string;
  description: string;
  emoji?: string;
  primary?: boolean;
};

function ActionCard({ href, title, description, emoji, primary }: ActionCardProps) {
  return (
    <Link
      href={href}
      className={
        "flex flex-col gap-2 rounded-md border p-4 transition " +
        (primary
          ? "border-accent bg-accent-soft hover:bg-accent-soft/80"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2")
      }
      data-testid={`mj-cc-action-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center gap-2">
        {emoji ? <span className="text-lg">{emoji}</span> : null}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-text-muted">{description}</p>
    </Link>
  );
}

export function ControlCenterQuickActions() {
  return (
    <section
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="mj-cc-quick-actions"
      aria-label="Production quick actions"
    >
      <ActionCard
        href="/admin/midjourney/batch-run"
        title="Yeni Batch"
        description="Template + variable sets → çoklu render. CSV/JSON ile toplu giriş."
        emoji="⚡"
        primary
      />
      <ActionCard
        href="/admin/midjourney/templates"
        title="Templates"
        description="Prompt şablonları + run history. Yeniden kullanılabilir üretim formülleri."
        emoji="📋"
      />
      <ActionCard
        href="/admin/midjourney/batches"
        title="Batches"
        description="Batch run geçmişi + retry + lineage. Son 50 batch tek listede."
        emoji="📦"
      />
      {/* Pass 88 — Asset Library V1 entry */}
      <ActionCard
        href="/admin/midjourney/library"
        title="Library"
        description="Üretilen tüm görseller. Tür/tarih/batch/template ile filtrele, lineage&apos;da gez."
        emoji="🖼️"
      />
    </section>
  );
}
