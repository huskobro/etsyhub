"use client";

// Phase 6 Task 14 + Dalga B (Task 15+16) — ReviewCard
//
// Review queue grid hücresi. Thumbnail + status badge + score chip + risk
// flag count + USER/SYSTEM rozeti.
//
// Sticky kontrat (R12): reviewStatusSource === "USER" ise rozet zorunlu —
// kullanıcı kararının görünür olması "Approve anyway" UX'inin omurgası.
//
// Dalga B (Task 15): kart click → detay drawer açar (URL ?detail=<cuid>).
// Klavye için Enter/Space de drawer'ı tetikler. Card'ın kendisi `role="button"
// tabIndex={0}` — interaktif element.
//
// Dalga B (Task 16): hover/select için checkbox sol üstte. Checkbox click
// `e.stopPropagation()` ile kart open'ı tetiklemez. Selection store
// (Zustand) içinde tutulur — bulk action bar bu store'u dinler.
//
// Tasarım tokenları (CLAUDE.md): hardcoded renk yasak. Tailwind alias'ları
// (text-text, text-text-muted, border-border, vb.) tema sisteminden gelir.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import type { ReviewQueueItem, ReviewStatusEnum } from "@/features/review/queries";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { buildReviewUrl } from "@/features/review/lib/search-params";
import { useReviewSelection } from "@/features/review/stores/selection-store";

type Props = { item: ReviewQueueItem };

// Canonical decision-axis wording (matches the batch workspace chips).
// PENDING and NEEDS_REVIEW are pipeline-side signals; we project both to
// the operator-facing labels:
//   PENDING       → "Undecided" (no operator action yet)
//   NEEDS_REVIEW  → "Needs review" (auto-flag — operator should look)
//   APPROVED      → "Kept"
//   REJECTED      → "Rejected"
const STATUS_LABEL: Record<ReviewStatusEnum, string> = {
  PENDING: "Undecided",
  APPROVED: "Kept",
  NEEDS_REVIEW: "Needs review",
  REJECTED: "Rejected",
};

const STATUS_TONE: Record<ReviewStatusEnum, BadgeTone> = {
  PENDING: "neutral",
  APPROVED: "success",
  NEEDS_REVIEW: "warning",
  REJECTED: "danger",
};

export function ReviewCard({ item }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isSelected = useReviewSelection((s) => s.selectedIds.has(item.id));
  const toggle = useReviewSelection((s) => s.toggle);

  const openDetail = () => {
    router.push(
      buildReviewUrl(pathname, searchParams, { item: item.id }),
    );
  };

  // Phase 7 Task 38 — Quick start canonical entry point.
  // ReviewCard'dan tek tıkla SelectionSet oluşturup /selection/sets/[id]'ye
  // redirect eder. Yalnız scope === "design" item'larında render edilir
  // (jobId !== null). Local-library asset'leri için anlamlı değil.
  const quickStart = useMutation({
    mutationFn: async () => {
      if (!item.referenceId || !item.productTypeId || !item.jobId) {
        // UI guard: buton zaten gizli; defansif fallback.
        throw new Error("Quick start için gerekli alanlar yok");
      }
      const res = await fetch("/api/selection/sets/quick-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "variation-batch",
          referenceId: item.referenceId,
          batchId: item.jobId,
          productTypeId: item.productTypeId,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
        );
      }
      return (await res.json()) as { setId: string };
    },
    onSuccess: (data) => {
      router.push(`/selection/sets/${data.setId}`);
    },
  });

  return (
    <article
      data-testid="review-card"
      data-selected={isSelected ? "true" : "false"}
      role="button"
      tabIndex={0}
      aria-label={`Review detayını aç: ${STATUS_LABEL[item.reviewStatus]}`}
      onClick={openDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
      className={`relative flex cursor-pointer flex-col overflow-hidden rounded-md border bg-surface shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        isSelected ? "border-accent ring-2 ring-accent" : "border-border"
      }`}
    >
      {/* Selection checkbox — kart open'ı tetiklememesi için stopPropagation */}
      <div className="absolute left-2 top-2 z-10">
        <input
          type="checkbox"
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            e.stopPropagation();
            toggle(item.id);
          }}
          onKeyDown={(e) => {
            // Space checkbox üzerindeyken kart open'ını tetiklemesin
            if (e.key === " ") e.stopPropagation();
          }}
          aria-label={`Seç`}
          data-testid="review-card-checkbox"
          className="h-5 w-5 cursor-pointer rounded border-border accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <div className="relative aspect-square bg-surface-muted">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            // a11y (Ö-4): tasarım önizlemesi içerik niteliğinde — kart başlığı
            // ayrı text yok, ekran okuyucu için informative alt metin gerekli.
            alt="Tasarım önizlemesi"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
            Önizleme yok
          </div>
        )}
        {item.reviewScore !== null ? (
          <span
            data-testid="score-chip"
            // a11y (Ö-4): "87" tek başına anlamsız; ekran okuyucu için
            // semantik etiket. Görsel olarak chip rakamı korunuyor.
            aria-label={`Kalite skoru: ${item.reviewScore}`}
            className="absolute right-2 top-2 rounded-sm bg-text px-2 py-0.5 font-mono text-xs text-bg"
          >
            {item.reviewScore}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 p-2">
        <div className="flex items-center justify-between gap-2">
          <Badge
            tone={STATUS_TONE[item.reviewStatus]}
            data-testid="status-badge"
          >
            {STATUS_LABEL[item.reviewStatus]}
          </Badge>
          {item.reviewStatusSource === "USER" ? (
            <Badge
              tone="accent"
              data-testid="user-badge"
              title="Kullanıcı kararı (Approve anyway)"
            >
              Kullanıcı
            </Badge>
          ) : null}
        </div>
        {/* Pass 24 — Source meta. Kullanıcının "bu görsel nereden geldi?"
            sorusunu kart üzerinden cevaplar. Local: dosya adı + klasör
            (truncate). Design: ProductType key + reference kısa id. */}
        {item.source?.kind === "local-library" ? (
          <div
            className="flex flex-col gap-0.5 text-xs text-text-muted"
            data-testid="source-meta"
          >
            <span
              className="truncate font-medium text-text"
              title={item.source.fileName}
            >
              {item.source.fileName}
            </span>
            <span className="truncate" title={item.source.folderName}>
              📁 {item.source.folderName}
            </span>
            <span>
              {item.source.width}×{item.source.height}
              {item.source.dpi ? ` · ${item.source.dpi}dpi` : ""}
            </span>
          </div>
        ) : item.source?.kind === "design" ? (
          <div
            className="flex flex-wrap items-center gap-1 text-xs text-text-muted"
            data-testid="source-meta"
          >
            {item.source.productTypeKey ? (
              <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-medium text-text">
                {item.source.productTypeKey}
              </span>
            ) : null}
            {item.source.referenceShortId ? (
              <span className="font-mono text-text-muted">
                ref-{item.source.referenceShortId}
              </span>
            ) : null}
          </div>
        ) : null}
        {item.riskFlagCount > 0 ? (
          <span
            data-testid="risk-flags"
            className="text-xs text-text-muted"
          >
            {item.riskFlagCount} risk işareti
          </span>
        ) : null}
        {item.jobId ? (
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              data-testid="quick-start-button"
              onClick={(e) => {
                // Kart click (detail drawer) tetiklenmesin — Quick start
                // bağımsız primary action'dur (Phase 7 canonical entry).
                e.stopPropagation();
                quickStart.mutate();
              }}
              onKeyDown={(e) => {
                // Space/Enter de kart open'ını tetiklemesin.
                if (e.key === " " || e.key === "Enter") e.stopPropagation();
              }}
              disabled={quickStart.isPending}
              aria-label="Selection Studio'da aç"
              title="Selection Studio'da aç"
              className="flex items-center gap-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs text-text-muted hover:border-border-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Layers className="h-3 w-3" aria-hidden="true" />
              {quickStart.isPending ? "Açılıyor..." : "Studio"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
