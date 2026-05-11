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
import {
  AlertCircle,
  Clock,
  Folder,
  Hourglass,
  Image as ImageIcon,
  Layers,
  MinusCircle,
} from "lucide-react";
import type { ReviewQueueItem } from "@/features/review/queries";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { buildReviewUrl } from "@/features/review/lib/search-params";
import { useReviewSelection } from "@/features/review/stores/selection-store";
import { buildEvaluation, type NotQueuedReason } from "@/features/review/lib/evaluation";
import {
  getOperatorDecision,
  operatorDecisionLabel,
  getAiScoreTone,
  getRiskTone,
  riskIndicatorLabel,
  type OperatorDecision,
  type AiScoreTone,
  type RiskTone,
} from "@/features/review/lib/operator-decision";

/** IA-39 — compact tooltip title for card icon. */
function notQueuedCardTitle(reason?: NotQueuedReason): string {
  switch (reason) {
    case "pending_mapping":
      return "Not queued — folder has no product type mapping. Open Settings → Review to assign one.";
    case "ignored":
      return "Not queued — folder is ignored. Open Settings → Review to change.";
    case "auto_enqueue_disabled":
      return "Not queued — auto-scoring is disabled. Open Settings → Review → Automation.";
    case "discovery_not_run":
      return "Not queued — scan has never run. Use \"Scan now\" in Settings → Review.";
    case "design_pending_worker":
      return "Variation generation in progress — review will start automatically.";
    case "legacy":
      return "Not scored yet (legacy asset). Open focus mode to enqueue.";
    default:
      return "Not queued yet — open focus mode to manually enqueue.";
  }
}

type Props = {
  item: ReviewQueueItem;
  /** IA-31 — decision policy thresholds from queue response.
   *  Score chip tone'u threshold'a göre dinamik hesaplar. */
  thresholds?: { low: number; high: number };
};

// IA-30 (CLAUDE.md Madde V) — operator decision badge SADECE USER
// damgalı item'lar için Kept/Rejected gösterir; AI advisory hiçbir
// koşulda kart üstündeki final badge'i kontrol etmez. AI ton ayrı
// score chip'inde yaşar.
const DECISION_TONE: Record<OperatorDecision, BadgeTone> = {
  KEPT: "success",
  REJECTED: "danger",
  UNDECIDED: "neutral",
};

// IA-31 — AI score chip 5-kademe tone class'ları. Tailwind palette
// tokens (hardcoded hex YASAK). Kademe sırası: critical < poor <
// warning < caution < success. Risk indicator AYRI; bu sadece
// system score'un threshold'a uzaklığını anlatır.
const AI_SCORE_TONE_CLASS: Record<AiScoreTone, string> = {
  critical: "bg-rose-600 text-white ring-rose-800/40",
  poor: "bg-orange-500 text-white ring-orange-700/40",
  warning: "bg-amber-500 text-ink ring-amber-700/30",
  caution: "bg-yellow-300 text-ink ring-yellow-600/30",
  success: "bg-emerald-500 text-white ring-emerald-700/40",
  neutral: "bg-text text-bg ring-bg/30",
};

// IA-31 — Risk indicator tone class'ları. Score chip'inden bağımsız
// renk dili: critical = dolu kırmızı, warning = amber outline.
const RISK_TONE_CLASS: Record<RiskTone, string> = {
  critical: "bg-rose-600 text-white",
  warning: "bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/40",
  none: "",
};

export function ReviewCard({ item, thresholds }: Props) {
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
      aria-label={(() => {
        const d = getOperatorDecision(item);
        const label = operatorDecisionLabel(d);
        return bulkModeActive
          ? `Toggle selection (${label})`
          : `Open review detail: ${label}`;
      })()}
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
            // IA-32 — Object-fit asset content type'a göre:
            //   • Alpha kanalı varsa (clipart / transparent PNG / sticker) →
            //     `object-contain`: kenarlar kesilmesin, full asset görünsün.
            //     Container'ın boş kalan kısmı surface-muted ile dolar
            //     (checker pattern istenirse ileride eklenebilir).
            //   • Aksi halde (fotografik wall art, vb.) → `object-cover`:
            //     kart aspect-square'i tam doldursun.
            // AI Designs ve Local Library aynı kurala uyar; kaynak farkı
            // gerekçesi YOK — operatör clipart'ı her iki tarafta da tam
            // görür, fotografik içerik her iki tarafta da tam dolar.
            className={cn(
              "h-full w-full",
              item.source?.hasAlpha === true ? "object-contain" : "object-cover",
            )}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-text-muted">
            No preview
          </div>
        )}
        {/* IA Phase 20 — Score + lifecycle birleşik gösterim
         *   (CLAUDE.md Madde Q — information density). Sağ üstteki
         *   tek slot: lifecycle "ready" ise sayı; aksi halde icon.
         *   Score chip'inin okunabilirliği iyileştirildi: kalın font,
         *   yüksek-kontrast bg/text + ince halka. */}
        {(() => {
          const evalResult = buildEvaluation({
            reviewedAt: item.reviewedAt,
            reviewScore: item.reviewScore,
            reviewSummary: item.reviewSummary,
            reviewProviderSnapshot: item.reviewProviderSnapshot,
            riskFlags: item.riskFlags,
            operatorOverride: false,
            backendLifecycle: item.reviewLifecycle,
            notQueuedReason: item.reviewNotQueuedReason,
          });
          const evalLifecycle = evalResult.lifecycle;

          if (evalLifecycle === "ready" && item.reviewScore !== null) {
            // IA-31 — AI score chip tone, threshold-aware ve 5 kademe.
            // Risk indicator score rengini EZMEZ; risk ayrı badge'de
            // (aşağıdaki render block'unda).
            const tone = getAiScoreTone({
              score: item.reviewScore,
              thresholds,
            });
            return (
              <span
                data-testid="score-chip"
                data-tone={tone}
                aria-label={`AI suggestion score: ${item.reviewScore}`}
                title="AI advisory score — not a final decision"
                className={cn(
                  "absolute right-2 top-2 inline-flex h-6 min-w-[28px] items-center justify-center rounded-md px-1.5 font-mono text-[13px] font-semibold tabular-nums shadow-md ring-1",
                  AI_SCORE_TONE_CLASS[tone],
                )}
              >
                {item.reviewScore}
              </span>
            );
          }

          // Non-ready lifecycle → icon (her durum farklı şekil).
          const config: Record<
            string,
            { icon: typeof Clock; title: string; tone: string; bg: string }
          > = {
            queued: {
              icon: Clock,
              title: "Queued for review",
              tone: "text-text",
              bg: "bg-bg/85 ring-text/20",
            },
            running: {
              icon: Hourglass,
              title: "Waiting for AI response",
              tone: "text-text",
              bg: "bg-bg/85 ring-text/20",
            },
            scoring: {
              icon: Hourglass,
              title: "Waiting for AI response",
              tone: "text-text",
              bg: "bg-bg/85 ring-text/20",
            },
            failed: {
              icon: AlertCircle,
              title: "Review failed",
              tone: "text-white",
              bg: "bg-danger ring-danger/40",
            },
            error: {
              icon: AlertCircle,
              title: "Review failed",
              tone: "text-white",
              bg: "bg-danger ring-danger/40",
            },
            pending: {
              icon: MinusCircle,
              title: notQueuedCardTitle(evalResult.notQueuedReason),
              tone: "text-text-muted",
              bg: "bg-bg/85 ring-text/20",
            },
            not_queued: {
              icon: MinusCircle,
              title: notQueuedCardTitle(evalResult.notQueuedReason),
              tone: "text-text-muted",
              bg: "bg-bg/85 ring-text/20",
            },
            na: {
              icon: MinusCircle,
              title: "Not applicable",
              tone: "text-text-muted",
              bg: "bg-bg/85 ring-text/20",
            },
          };
          const c = config[evalLifecycle] ?? config.not_queued!;
          const Icon = c.icon;
          return (
            <span
              data-testid="card-eval-state"
              data-state={evalLifecycle}
              title={c.title}
              aria-label={c.title}
              className={cn(
                "absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md ring-1 shadow-md",
                c.bg,
                c.tone,
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
          );
        })()}
      </div>
      <div className="flex flex-col gap-1 p-2">
        <div className="flex items-center justify-between gap-2">
          {(() => {
            const d = getOperatorDecision(item);
            return (
              <Badge tone={DECISION_TONE[d]} data-testid="status-badge">
                {operatorDecisionLabel(d)}
              </Badge>
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
            <span
              className="flex items-center gap-1 truncate font-mono"
              data-testid="card-scope-label"
              title={
                item.source.batchShortId
                  ? `Batch ${item.source.batchId ?? ""}`
                  : item.source.referenceShortId
                    ? `Reference ${item.source.referenceShortId}`
                    : undefined
              }
            >
              <Layers className="h-3 w-3 shrink-0" aria-hidden />
              {/* IA-34 — scope priority on the card: batch > reference.
                  Same priority as focus mode (page loader). Reference
                  short id surfaces only when there is no batch lineage
                  for this item. */}
              {item.source.batchShortId
                ? `batch-${item.source.batchShortId}`
                : item.source.referenceShortId
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
        {(() => {
          // IA-37 — Risk indicator artık **applicability-aware** sayım
          // kullanır (CLAUDE.md cross-surface metric consistency).
          // Eski davranış: kart `item.riskFlagCount` (DB array length)
          // kullanıyordu — detail panel ise `composeContext` sonrası
          // failed check sayısını gösteriyordu. İki yer farklı sayı
          // veriyordu (ör. DB'de 4 risk, detail'de 2 failed). Kart
          // artık `buildEvaluation` çıktısından applicable + failed
          // sayımını alır; detail panel aynı kaynaktan beslenir.
          const productType =
            item.source?.kind === "design"
              ? item.source.productTypeKey ?? null
              : item.source?.kind === "local-library"
                ? item.source.productTypeKey
                : null;
          const format =
            item.source?.mimeType
              ? item.source.mimeType.replace("image/", "").toLowerCase()
              : "png";
          const hasAlpha = item.source?.hasAlpha ?? null;
          const sourceKind: "design" | "local-library" =
            item.source?.kind === "local-library" ? "local-library" : "design";
          const evaluation = buildEvaluation({
            reviewedAt: item.reviewedAt,
            reviewScore: item.reviewScore,
            reviewSummary: item.reviewSummary,
            reviewProviderSnapshot: item.reviewProviderSnapshot,
            riskFlags: item.riskFlags,
            operatorOverride: false,
            backendLifecycle: item.reviewLifecycle,
            thresholds,
            composeContext:
              productType !== null
                ? {
                    productType,
                    format,
                    hasAlpha,
                    sourceKind,
                    transformsApplied: [],
                  }
                : undefined,
          });
          const failedApplicable = evaluation.checks.filter(
            (c) => c.state === "failed",
          );
          const failedCount = failedApplicable.length;
          const hasBlocker = failedApplicable.some(
            (c) => c.severity === "blocker",
          );
          const riskTone = getRiskTone({
            count: failedCount,
            hasBlocker,
          });
          if (riskTone === "none") return null;
          const label = riskIndicatorLabel({
            count: failedCount,
            hasBlocker,
          });
          return (
            <span
              data-testid="risk-indicator"
              data-tone={riskTone}
              className={cn(
                "inline-flex w-fit items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium",
                RISK_TONE_CLASS[riskTone],
              )}
            >
              <AlertCircle className="h-3 w-3" aria-hidden />
              {label}
            </span>
          );
        })()}
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
