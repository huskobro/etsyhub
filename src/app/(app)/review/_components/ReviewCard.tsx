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
import { Folder, Image as ImageIcon, Layers } from "lucide-react";
import type { ReviewQueueItem, ReviewStatusEnum } from "@/features/review/queries";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { buildReviewUrl } from "@/features/review/lib/search-params";
import { useReviewSelection } from "@/features/review/stores/selection-store";
import { buildEvaluation } from "@/features/review/lib/evaluation";

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
  // IA Phase 8 — bulk-mode click pivot (Library parity). When at least
  // one card is already selected we treat plain card clicks as toggles
  // so the operator can rake through items without aiming for the
  // checkbox; with no selection the click opens detail as before.
  const bulkModeActive = useReviewSelection((s) => s.selectedIds.size > 0);

  const openDetail = () => {
    router.push(
      buildReviewUrl(pathname, searchParams, { item: item.id }),
    );
  };

  const handleCardClick = () => {
    if (bulkModeActive) {
      toggle(item.id);
    } else {
      openDetail();
    }
  };

  // Phase 7 Task 38 — Quick start canonical entry point.
  // ReviewCard'dan tek tıkla SelectionSet oluşturup canonical
  // /selections/[id] detail sayfasına redirect eder (IA Phase 4: kullanıcı
  // önce canonical Selection detail'e iner; oradan Edits tab'ı Edit
  // Studio'ya köprülenir). Yalnız scope === "design" item'larında render
  // edilir (jobId !== null). Local-library asset'leri için anlamlı değil.
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
      router.push(`/selections/${data.setId}`);
    },
  });

  return (
    <article
      data-testid="review-card"
      data-selected={isSelected ? "true" : "false"}
      data-bulk-mode={bulkModeActive ? "true" : "false"}
      role="button"
      tabIndex={0}
      aria-label={
        bulkModeActive
          ? `Toggle selection (${STATUS_LABEL[item.reviewStatus]})`
          : `Open review detail: ${STATUS_LABEL[item.reviewStatus]}`
      }
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      className={cn(
        "k-card relative flex cursor-pointer flex-col overflow-hidden",
        isSelected && "k-ring-selected",
      )}
    >
      {/* Selection checkbox — k-checkbox recipe (Library parity). Click
       *   stops propagation so it never doubles up with the card
       *   handler in bulk mode (the card click would also toggle). */}
      <div className="absolute left-3 top-3 z-10">
        <button
          type="button"
          aria-label="Select"
          aria-pressed={isSelected}
          data-testid="review-card-checkbox"
          data-checked={isSelected || undefined}
          onClick={(e) => {
            e.stopPropagation();
            toggle(item.id);
          }}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") e.stopPropagation();
          }}
          className="k-checkbox"
        >
          {isSelected ? (
            <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
              <path
                d="M5 12l5 5L20 7"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </button>
      </div>

      <div className="relative aspect-square bg-surface-muted">
        {item.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnailUrl}
            // a11y (Ö-4): tasarım önizlemesi içerik niteliğinde — kart başlığı
            // ayrı text yok, ekran okuyucu için informative alt metin gerekli.
            alt="Design preview"
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
            aria-label={`Quality score: ${item.reviewScore}`}
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
          {/* IA Phase 16 — scoring lifecycle hint. CLAUDE.md sistem
           *   skor contract'ı: lifecycle pending/scoring/error iken
           *   operatör sahte skor görmemeli. Kart "..." veya "—"
           *   rozeti ile dürüstçe işaretler; ready iken sayı zaten
           *   üstteki score chip'inde. Operator override sinyali
           *   kart üzerinde değil — info-rail'de.
           */}
          {(() => {
            const evalLifecycle = buildEvaluation({
              reviewedAt: item.reviewedAt,
              reviewScore: item.reviewScore,
              reviewSummary: item.reviewSummary,
              reviewProviderSnapshot: item.reviewProviderSnapshot,
              riskFlags: item.riskFlags,
              operatorOverride: false,
            }).lifecycle;
            if (evalLifecycle === "ready") return null;
            return (
              <span
                data-testid="card-eval-state"
                data-state={evalLifecycle}
                className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-meta text-text-muted"
              >
                {evalLifecycle === "pending"
                  ? "not yet scored"
                  : evalLifecycle === "scoring"
                    ? "scoring…"
                    : "score error"}
              </span>
            );
          })()}
        </div>
        {/* Pass 24 — Source meta. Kullanıcının "bu görsel nereden geldi?"
            sorusunu kart üzerinden cevaplar. Local: dosya adı + klasör
            (truncate). Design: ProductType key + reference kısa id. */}
        {/* IA Phase 13 — final card parity. Both source variants now
         *   share a uniform 3-row metadata block:
         *     1. Title (filename for local, productType chip for AI)
         *     2. Origin (folder name for local, ref short id for AI)
         *     3. Format · Dimensions
         *   Lucide icons replace the emoji/glyph used in earlier phases
         *   (📁 / ✦) so the two cards line up at the icon column. */}
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
            <span
              className="flex items-center gap-1 truncate"
              title={item.source.folderName}
            >
              <Folder className="h-3 w-3 shrink-0" aria-hidden />
              {item.source.folderName}
            </span>
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3 shrink-0" aria-hidden />
              {item.source.mimeType.replace("image/", "").toUpperCase()}
              {" · "}
              {item.source.width}×{item.source.height}
              {item.source.dpi ? ` · ${item.source.dpi}dpi` : ""}
            </span>
          </div>
        ) : item.source?.kind === "design" ? (
          <div
            className="flex flex-col gap-0.5 text-xs text-text-muted"
            data-testid="source-meta"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {item.source.productTypeKey ? (
                <span className="truncate rounded-sm bg-surface-muted px-1.5 py-0.5 font-medium text-text">
                  {item.source.productTypeKey}
                </span>
              ) : null}
            </div>
            <span className="flex items-center gap-1 truncate font-mono">
              <Layers className="h-3 w-3 shrink-0" aria-hidden />
              {item.source.referenceShortId
                ? `ref-${item.source.referenceShortId}`
                : "—"}
            </span>
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3 shrink-0" aria-hidden />
              {item.source.mimeType.replace("image/", "").toUpperCase()}
              {item.source.width != null && item.source.height != null
                ? ` · ${item.source.width}×${item.source.height}`
                : ""}
            </span>
          </div>
        ) : null}
        {item.riskFlagCount > 0 ? (
          <span
            data-testid="risk-flags"
            className="text-xs text-text-muted"
          >
            {item.riskFlagCount} risk {item.riskFlagCount === 1 ? "flag" : "flags"}
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
              aria-label="Open in Selection Studio"
              title="Open in Selection Studio"
              className="flex items-center gap-1 rounded-md border border-border bg-transparent px-2 py-1 text-xs text-text-muted hover:border-border-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Layers className="h-3 w-3" aria-hidden="true" />
              {quickStart.isPending ? "Opening…" : "Studio"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
