"use client";

// Phase 6 Dalga B (Task 15) — ReviewDetailPanel (drawer)
//
// Karar 1: Detay panel = sağ slide-over drawer. Mevcut Radix Dialog primitive
// (confirm-dialog.tsx) merkez modal için; drawer ayrı yapı — `<aside
// role="dialog" aria-modal="true">` + backdrop + ESC + click-outside.
//
// URL state (Karar 7): ?detail=<cuid>. Açma/kapama URL transition'ı
// buildReviewUrl ile yapılır; mevcut tab+page korunur (Not 3).
//
// Veri kaynağı: queue cache. useReviewQueue zaten tüm detail alanlarını
// (reviewSummary, riskFlags full, reviewProviderSnapshot) çekiyor — ayrı GET
// endpoint gereksiz. Kart click → drawer cache'ten okuyup render eder.
//
// A11y:
//   - role="dialog" aria-modal="true"
//   - aria-labelledby title elementine bağlı
//   - useFocusTrap ile Tab boundary ve initial focus close butonuna
//   - ESC key ile kapatma
//   - backdrop click ile kapatma
//   - close button aria-label "Kapat"

import { useEffect, useRef } from "react";
import {
  useRouter,
  usePathname,
  useSearchParams,
} from "next/navigation";
import { buildReviewUrl } from "@/features/review/lib/search-params";
import {
  useReviewQueue,
  type ReviewQueueItem,
} from "@/features/review/queries";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { useFocusTrap } from "@/components/ui/use-focus-trap";
import { ReviewRiskFlagList } from "./ReviewRiskFlagList";
import { ReviewDetailActions } from "./ReviewDetailActions";

type Props = {
  id: string;
  scope: "design" | "local";
};

const STATUS_LABEL: Record<ReviewQueueItem["reviewStatus"], string> = {
  PENDING: "Beklemede",
  APPROVED: "Onaylandı",
  NEEDS_REVIEW: "İnceleme",
  REJECTED: "Reddedildi",
};

const STATUS_TONE: Record<ReviewQueueItem["reviewStatus"], BadgeTone> = {
  PENDING: "neutral",
  APPROVED: "success",
  NEEDS_REVIEW: "warning",
  REJECTED: "danger",
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    // Türkçe tarih formatı (kısa, görünür)
    return d.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export function ReviewDetailPanel({ id, scope }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Queue cache'inden item'ı bul. ReviewQueueList aynı sayfada zaten fetch
  // ettiği için cache hit; navigate olmuşsa fetch tetiklenir.
  const { data, isLoading } = useReviewQueue({ scope });
  const item = data?.items.find((it) => it.id === id) ?? null;

  const containerRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    router.push(
      buildReviewUrl(pathname, searchParams, { detail: undefined }),
    );
  };

  // ESC key — close. searchParams object referansı her render'da değişebilir;
  // close fonksiyonu deps'e eklenmiyor (effect handler'ı stale closure ile
  // çalışsa bile en güncel router.push kullanılır — fonksiyonlar referans
  // stable; değişen sadece pathname/searchParams).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        router.push(
          buildReviewUrl(pathname, searchParams, { detail: undefined }),
        );
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, pathname, searchParams]);

  // Focus trap: drawer açık iken Tab boundary; initial focus close butonuna
  // (kullanıcı ESC olmadan da klavye ile kapatabilsin).
  useFocusTrap(containerRef, true, closeBtnRef);

  const reviewedAtFormatted = formatDate(item?.reviewedAt ?? null);

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={close}
        className="fixed inset-0 z-30 bg-text/40 backdrop-blur-sm"
        data-testid="review-detail-backdrop"
      />
      {/* Panel */}
      <aside
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-detail-title"
        data-testid="review-detail-panel"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-6 shadow-popover"
      >
        <header className="flex items-center justify-between">
          <h2
            id="review-detail-title"
            className="text-lg font-semibold text-text"
          >
            Review Detayı
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={close}
            aria-label="Kapat"
            data-testid="review-detail-close"
            className="rounded-md p-1 text-text-muted hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {!item ? (
          <p className="text-sm text-text-muted" data-testid="review-detail-empty">
            {isLoading
              ? "Yükleniyor…"
              : "Kayıt bulunamadı veya silinmiş olabilir."}
          </p>
        ) : (
          <>
            {/* Thumbnail */}
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl}
                alt="Tasarım önizlemesi"
                className="aspect-square w-full rounded-md border border-border object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-md border border-border bg-surface-muted text-xs text-text-muted">
                Önizleme yok
              </div>
            )}

            {/* Status row */}
            <section
              aria-label="Durum bilgileri"
              className="flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={STATUS_TONE[item.reviewStatus]}
                  data-testid="detail-status-badge"
                >
                  {STATUS_LABEL[item.reviewStatus]}
                </Badge>
                {item.reviewStatusSource === "USER" ? (
                  <Badge tone="accent" data-testid="detail-user-badge">
                    Kullanıcı kararı
                  </Badge>
                ) : (
                  <Badge tone="neutral" data-testid="detail-system-badge">
                    SYSTEM
                  </Badge>
                )}
                {item.reviewScore !== null ? (
                  <span
                    data-testid="detail-score"
                    aria-label={`Kalite skoru: ${item.reviewScore}`}
                    className="rounded-sm bg-text px-2 py-0.5 font-mono text-xs text-bg"
                  >
                    {item.reviewScore}
                  </span>
                ) : null}
              </div>
              {reviewedAtFormatted ? (
                <p className="text-xs text-text-muted">
                  Karar zamanı: {reviewedAtFormatted}
                </p>
              ) : null}
            </section>

            {/* Summary */}
            {item.reviewSummary ? (
              <section
                aria-label="Provider özeti"
                className="flex flex-col gap-1"
              >
                <h3 className="text-sm font-medium text-text">Özet</h3>
                <p className="text-sm text-text-muted">{item.reviewSummary}</p>
              </section>
            ) : null}

            {/* Risk flags */}
            <ReviewRiskFlagList flags={item.riskFlags} />

            {/* Provider snapshot — audit trail görünürlüğü */}
            {item.reviewProviderSnapshot ? (
              <section
                aria-label="Provider snapshot"
                className="flex flex-col gap-1 border-t border-border pt-3"
              >
                <p className="text-xs text-text-muted">
                  Provider:{" "}
                  <span className="font-mono">
                    {item.reviewProviderSnapshot}
                  </span>
                </p>
              </section>
            ) : null}

            {/* Actions */}
            <ReviewDetailActions item={item} scope={scope} />
          </>
        )}
      </aside>
    </>
  );
}
