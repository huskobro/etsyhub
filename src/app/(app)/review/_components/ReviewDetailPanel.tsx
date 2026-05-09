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
  PENDING: "Pending",
  APPROVED: "Approved",
  NEEDS_REVIEW: "Needs review",
  REJECTED: "Rejected",
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

  // Pass 27 — Bug 1 fix: page=2 + detail kombinasyonunda detail panel
  // "Kayıt bulunamadı" hatası alıyordu. Root cause: useReviewQueue page
  // parametresi geçirmiyordu (default page=1 fetch); ReviewQueueList
  // ise URL'den page okuyor. Detail page'in cache'inde page 1 items
  // varken, kullanıcının detail=... id'si page 2'den geliyordu —
  // items.find null döndürüyordu.
  //
  // Fix: aynı page parametresini ReviewDetailPanel da URL'den okusun.
  // React Query cache key'i {scope, page} ile eşleşecek; ReviewQueueList
  // zaten fetch ettiği için drawer cache hit (double fetch yok).
  const pageRaw = searchParams.get("page");
  const pageNum = pageRaw && Number(pageRaw) > 0 ? Number(pageRaw) : 1;

  const { data, isLoading } = useReviewQueue({ scope, page: pageNum });
  const items = data?.items ?? [];
  const idx = items.findIndex((it) => it.id === id);
  const item = idx >= 0 ? (items[idx] ?? null) : null;
  const total = items.length;

  const containerRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    router.push(
      buildReviewUrl(pathname, searchParams, { detail: undefined }),
    );
  };

  // Pass 26 — Prev/Next navigation (decision workspace ergonomi).
  // Local QuickLook emsali; aynı page içinde wraparound (son → ilk).
  const navTo = (offset: number) => {
    if (total === 0 || idx < 0) return;
    const next = (idx + offset + total) % total;
    const target = items[next];
    if (!target) return;
    router.push(
      buildReviewUrl(pathname, searchParams, { detail: target.id }),
    );
  };

  // ESC + Pass 26: ←/→ navigation. searchParams object referansı her
  // render'da değişebilir; effect re-mount kabul.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Input/textarea içindeyken kısayolları yutma — kullanıcı yazıyor.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        router.push(
          buildReviewUrl(pathname, searchParams, { detail: undefined }),
        );
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        navTo(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navTo(1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, pathname, searchParams, idx, total]);

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
      {/* Panel — Pass 26: drawer width max-w-md → max-w-2xl (decision
          workspace için büyük preview alanı; local QuickLook fullscreen
          ile aynı yapı değil, drawer karakteri korundu). */}
      {/* Pass 27 — Bug 2 fix: drawer 3-zone layout (header / scroll
          content / sticky action bar). Önceden tüm aside overflow-y-auto
          idi → action bar listenin altında scroll-içinde kayboluyordu.
          Yeni: aside overflow-hidden, content alanı flex-1 + overflow-y-auto,
          action bar her zaman alt sabit görünür. */}
      <aside
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-detail-title"
        data-testid="review-detail-panel"
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-2xl flex-col overflow-hidden border-l border-border bg-surface shadow-popover"
      >
        <header className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <h2
              id="review-detail-title"
              className="text-lg font-semibold text-text"
            >
              Review Detayı
            </h2>
            {/* Pass 26 — Index pill: kullanıcı kaç review arasında
                navigasyon yaptığını anlık görsün. Local QuickLook emsali. */}
            {total > 0 && idx >= 0 ? (
              <span
                className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted"
                data-testid="review-detail-index"
              >
                {idx + 1}/{total}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {/* Pass 26 — Prev/Next butonları decision workspace ergonomi.
                Klavye: ←/→ aynı işi yapar (Tab focus trap içinde de
                erişilebilir). */}
            {total > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => navTo(-1)}
                  aria-label="Önceki review"
                  title="Önceki (←)"
                  data-testid="review-detail-prev"
                  className="rounded-md p-1 text-text-muted hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => navTo(1)}
                  aria-label="Sonraki review"
                  title="Sonraki (→)"
                  data-testid="review-detail-next"
                  className="rounded-md p-1 text-text-muted hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  ›
                </button>
              </>
            ) : null}
            <button
              ref={closeBtnRef}
              type="button"
              onClick={close}
              aria-label="Kapat"
              title="Kapat (Esc)"
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
          </div>
        </header>

        {!item ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <p className="text-sm text-text-muted" data-testid="review-detail-empty">
              {isLoading
                ? "Yükleniyor…"
                : "Kayıt bulunamadı veya silinmiş olabilir."}
            </p>
          </div>
        ) : (
          <>
            {/* Pass 27 — Scrollable content area (flex-1 overflow-y-auto)
                + sticky footer (action bar + hint). Action bar artık
                drawer altında her zaman görünür. */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
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

            {/* Pass 24 — Source / Path. Kullanıcı "bu görsel hangi
                kaynaktan geldi?" sorusunu detail panel'de açık olarak
                görür. Local: full folder + file path. Design: product
                type + reference deep-link. */}
            {item.source?.kind === "local-library" ? (
              <section
                aria-label="Kaynak"
                className="flex flex-col gap-1 border-t border-border pt-3"
                data-testid="source-section"
              >
                <h3 className="text-sm font-medium text-text">Kaynak</h3>
                <div className="rounded-md bg-accent-soft px-2 py-1 text-xs">
                  <span className="font-medium text-accent-text">
                    Lokal kütüphane
                  </span>
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-text-muted">Dosya</dt>
                  <dd
                    className="break-all font-mono text-text"
                    data-testid="source-filename"
                  >
                    {item.source.fileName}
                  </dd>
                  <dt className="text-text-muted">Klasör</dt>
                  <dd className="break-all font-mono text-text">
                    {item.source.folderName}
                  </dd>
                  <dt className="text-text-muted">Tam yol</dt>
                  <dd className="break-all font-mono text-text-muted">
                    {item.source.folderPath}
                  </dd>
                  <dt className="text-text-muted">Çözünürlük</dt>
                  <dd className="text-text">
                    {item.source.width}×{item.source.height}
                    {item.source.dpi ? ` · ${item.source.dpi}dpi` : ""}
                  </dd>
                  {item.source.qualityScore !== null ? (
                    <>
                      <dt className="text-text-muted">Kalite</dt>
                      <dd className="text-text">
                        {item.source.qualityScore}/100
                      </dd>
                    </>
                  ) : null}
                </dl>
              </section>
            ) : item.source?.kind === "design" ? (
              <section
                aria-label="Kaynak"
                className="flex flex-col gap-1 border-t border-border pt-3"
                data-testid="source-section"
              >
                <h3 className="text-sm font-medium text-text">Kaynak</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md bg-surface-muted px-2 py-0.5 font-medium text-text">
                    AI Variation
                  </span>
                  {item.source.productTypeKey ? (
                    <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-accent-text">
                      {item.source.productTypeKey}
                    </span>
                  ) : null}
                </div>
                {item.referenceId ? (
                  <a
                    href={`/references/${item.referenceId}/variations`}
                    className="text-xs text-accent underline hover:text-accent-hover"
                  >
                    Referans variations sayfasını aç →
                  </a>
                ) : null}
                {item.source.referenceShortId ? (
                  <span className="font-mono text-xs text-text-muted">
                    ref-{item.source.referenceShortId}
                  </span>
                ) : null}
              </section>
            ) : null}

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

            </div>

            {/* Pass 27 — Sticky footer: Actions + keyboard hint her
                zaman drawer altında görünür (scroll'la kaybolmaz). */}
            <footer className="flex flex-shrink-0 flex-col gap-2 border-t border-border bg-surface px-6 py-3">
              <ReviewDetailActions item={item} scope={scope} />
              {/* Pass 26 — Keyboard shortcuts hint. Decision workspace
                  ergonomi: kullanıcı klavye ile hızlı karar verebilsin. */}
              <p className="text-xs text-text-muted">
                ←/→ önceki/sonraki · Esc kapat
              </p>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
