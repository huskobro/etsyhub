// Phase 6 Task 14 — ReviewCard
//
// Review queue grid hücresi. Thumbnail + status badge + score chip + risk
// flag count + USER/SYSTEM rozeti.
//
// Sticky kontrat (R12): reviewStatusSource === "USER" ise rozet zorunlu —
// kullanıcı kararının görünür olması "Approve anyway" UX'inin omurgası.
//
// Tasarım tokenları (CLAUDE.md): hardcoded renk yasak. Tailwind alias'ları
// (text-text, text-text-muted, border-border, vb.) tema sisteminden gelir.

import type { ReviewQueueItem, ReviewStatusEnum } from "@/features/review/queries";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

type Props = { item: ReviewQueueItem };

const STATUS_LABEL: Record<ReviewStatusEnum, string> = {
  PENDING: "Beklemede",
  APPROVED: "Onaylandı",
  NEEDS_REVIEW: "İnceleme",
  REJECTED: "Reddedildi",
};

const STATUS_TONE: Record<ReviewStatusEnum, BadgeTone> = {
  PENDING: "neutral",
  APPROVED: "success",
  NEEDS_REVIEW: "warning",
  REJECTED: "danger",
};

export function ReviewCard({ item }: Props) {
  return (
    <article
      data-testid="review-card"
      className="flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-card"
    >
      <div className="relative aspect-square bg-surface-2">
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
        {item.riskFlagCount > 0 ? (
          <span
            data-testid="risk-flags"
            className="text-xs text-text-muted"
          >
            {item.riskFlagCount} risk işareti
          </span>
        ) : null}
      </div>
    </article>
  );
}
