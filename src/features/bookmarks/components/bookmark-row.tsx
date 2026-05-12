"use client";

// BookmarkRow — Kivasy v5 B1.Inbox table row (Phase 21 canonical layout).
//
// Phase 20 toolbar/filter k-input + k-chip parity yapmıştı ama Inbox
// canonical layout'u **table/list** olduğu için grid → table refactor
// gerekiyordu. B1 SubInbox (screens-b1.jsx:218-260) 6-column table
// + ghost row-action "Promote to Pool" pattern'i kullanıyor; biz
// "Promote to Reference" diyoruz (ürün dili). Bookmark-specific
// metadata (tags, collection, productType, status) row içinde
// inline meta-line + Source cell badge'i ile korunur — workflow
// bozulmaz.
//
// Phase 23 — Inbox triage micro-interaction polish:
//   * Row hover artık DS-tone (`hover:bg-k-bg` full, paper→warm cream)
//     — eski `hover:bg-k-bg-2/40` neredeyse görünmüyordu. DS B1
//     screens-b1.jsx:242 `hover:bg-[var(--k-bg)]` ile birebir aynı.
//   * `cursor-pointer` row interactivity hissi (DS B1 pattern).
//   * Thumbnail hover/focus → 256×256 popover preview (`BookmarkRowThumb`
//     alt-component). 40×40 thumb triage için yetersiz: kullanıcı
//     Etsy/Pinterest/upload görselini promote öncesi net görmek ister.
//     Detail page yerine hover preview seçildi — triage hızı korunur,
//     yeni route gerekmez (CLAUDE.md Phase 23 notu).

import { useEffect, useRef, useState } from "react";
import type { BookmarkStatus, RiskLevel } from "@prisma/client";
import { AssetImage } from "@/components/ui/asset-image";
import { tagColorClass } from "@/features/tags/color-map";
import { cn } from "@/lib/cn";

type BookmarkLite = {
  id: string;
  title: string | null;
  sourceUrl: string | null;
  sourcePlatform: string | null;
  status: BookmarkStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  asset: { id: string; storageKey: string; bucket: string } | null;
  productType: { id: string; displayName: string } | null;
  collection: { id: string; name: string } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

const SOURCE_TONE: Record<string, string> = {
  ETSY: "warning",
  PINTEREST: "danger",
  AMAZON: "warning",
  INSTAGRAM: "purple",
  URL: "info",
  OTHER: "neutral",
};

const STATUS_TONE: Record<BookmarkStatus, string> = {
  INBOX: "accent",
  REFERENCED: "success",
  RISKY: "danger",
  ARCHIVED: "neutral",
};

const STATUS_LABEL: Record<BookmarkStatus, string> = {
  INBOX: "Inbox",
  REFERENCED: "Reference",
  RISKY: "Risky",
  ARCHIVED: "Archived",
};

function relativeAdded(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function BookmarkRow({
  bookmark,
  selected = false,
  onToggleSelect,
  onArchive,
  onPromote,
  onSetCollection,
  onSetTags,
  updating,
}: {
  bookmark: BookmarkLite;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onArchive?: (id: string) => void;
  onPromote?: (id: string) => void;
  onSetCollection?: (id: string, collectionId: string | null) => void;
  onSetTags?: (id: string, tagIds: string[]) => void;
  updating?: boolean;
}) {
  const title = bookmark.title ?? bookmark.sourceUrl ?? "Untitled";
  const sourcePlatform = bookmark.sourcePlatform ?? "OTHER";
  const sourceTone = SOURCE_TONE[sourcePlatform] ?? "neutral";
  const sourceLabel =
    sourcePlatform === "ETSY"
      ? "Etsy"
      : sourcePlatform === "PINTEREST"
        ? "Pinterest"
        : sourcePlatform === "AMAZON"
          ? "Amazon"
          : sourcePlatform === "INSTAGRAM"
            ? "Instagram"
            : sourcePlatform === "URL"
              ? "URL"
              : "Other";
  const isPromotable =
    !!bookmark.asset && bookmark.status !== "REFERENCED";

  return (
    <tr
      className={cn(
        // Phase 23 — DS B1 SubInbox row tone (screens-b1.jsx:242).
        // `hover:bg-k-bg-2/40` çok zayıftı (paper üzerine alpha blend,
        // neredeyse görünmüyordu). Full `hover:bg-k-bg` = paper→warm
        // cream (#FFFFFF → #F7F5EF) → fark edilir, sakin kalır.
        // `cursor-pointer` row interactivity hissi.
        "group/row cursor-pointer border-b border-line-soft last:border-b-0 transition-colors hover:bg-k-bg",
        selected && "bg-k-orange-soft/30 hover:bg-k-orange-soft/40",
      )}
      data-testid="bookmark-row"
      data-bookmark-id={bookmark.id}
    >
      {/* Checkbox */}
      <td className="px-3 py-3 align-middle">
        {onToggleSelect ? (
          <button
            type="button"
            onClick={() => onToggleSelect(bookmark.id)}
            aria-pressed={selected}
            aria-label={selected ? "Deselect" : "Select"}
            className="k-checkbox"
            data-checked={selected || undefined}
          >
            {selected ? (
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
        ) : null}
      </td>

      {/* Thumbnail — Phase 23 hover preview popover + Phase 29 metadata
       *   (tags + collection görünür artık satırdan kalktığı için
       *   popover'da yaşar). */}
      <td className="px-3 py-3 align-middle">
        <BookmarkRowThumb
          assetId={bookmark.asset?.id ?? null}
          alt={title}
          sourceLabel={sourceLabel}
          title={title}
          tags={bookmark.tags}
          collectionName={bookmark.collection?.name ?? null}
        />
      </td>

      {/* Title cell — Phase 30 B1 canonical scan layout.
       *
       * Phase 29 sub-line: productType displayName + · collection +
       * · N tags. Phase 30: yalnız productType displayName (en kritik
       * triage bilgisi — promote öncesi karar). Collection ve tag
       * count tamamen hover preview popover'a taşındı (BookmarkRowThumb
       * Phase 29'da zaten enriched). Bu DS B1 SubInbox mock'una
       * (screens-b1.jsx:240-251) daha yakın — operatör title scan'inde
       * yalnız bir extra meta satırı görür. */}
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span
            className="text-[13px] font-medium text-ink truncate"
            title={title}
          >
            {title}
          </span>
          {bookmark.productType ? (
            <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              {bookmark.productType.displayName}
            </span>
          ) : null}
        </div>
      </td>

      {/* Source badge */}
      <td className="px-3 py-3 align-middle">
        <span className="k-badge" data-tone={sourceTone}>
          {sourceLabel}
        </span>
      </td>

      {/* Status badge — Inbox-canon adds status visibility (riskLevel + status) */}
      <td className="px-3 py-3 align-middle">
        <span className="k-badge" data-tone={STATUS_TONE[bookmark.status]}>
          {STATUS_LABEL[bookmark.status]}
        </span>
      </td>

      {/* Added (relative time) */}
      <td className="px-3 py-3 align-middle">
        <span className="font-mono text-[12px] tabular-nums tracking-wider text-ink-2">
          {relativeAdded(bookmark.createdAt)}
        </span>
      </td>

      {/* Row actions — Phase 23: sönük→parlak hover cue (default
       *   opacity-80, group-hover:opacity-100). DS B1 her zaman görünür
       *   tutuyor; bilgiyi gizlemiyoruz, sadece "active row" sinyali
       *   güçleniyor. focus-within'da da %100 → klavye gezintisi sönük
       *   takılmaz. */}
      <td className="px-3 py-3 text-right align-middle">
        <div className="inline-flex items-center gap-1.5 opacity-80 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
          {onPromote && isPromotable ? (
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--secondary"
              onClick={() => onPromote(bookmark.id)}
              disabled={updating}
              data-testid="bookmark-row-promote"
            >
              Promote to Reference
            </button>
          ) : null}
          {onArchive && bookmark.status !== "ARCHIVED" ? (
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--ghost"
              onClick={() => onArchive(bookmark.id)}
              disabled={updating}
            >
              Archive
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

/**
 * BookmarkRowThumb — Phase 23 hover-preview thumbnail.
 *
 * Inbox triage akışında 40×40 küçük thumb operatöre yetersiz: kullanıcı
 * promote öncesi "bu mu benim ref?" sorusuna görsel cevap arar. Detail
 * page eklemek triage hızını bozardı (extra route + back/exit + bakım
 * yükü). Bunun yerine hover/focus ile **256×256 popover** açıyoruz —
 * tıklamadan, sakin, sağa yaslı, viewport-clipped.
 *
 * Davranışlar:
 *   - mouse enter / focus → 120ms gecikmeli aç (jitter yok)
 *   - mouse leave / blur → hemen kapat
 *   - Escape → kapat
 *   - viewport sağ kenara çok yakınsa otomatik sola taşır
 *   - popover sağa konumlanır (left = thumb.right + 12px); altta vurgu
 *     için thumb caption mevcut değilse de title + source line gösterir
 *   - reduced-motion saygılı (transition CSS, ek motion yok)
 *   - asset null → preview popover açılmaz (asset olmayan bookmark için
 *     büyütmek anlamsız; mevcut 40×40 placeholder yeterli sinyal)
 */
function BookmarkRowThumb({
  assetId,
  alt,
  sourceLabel,
  title,
  tags,
  collectionName,
}: {
  assetId: string | null;
  alt: string;
  sourceLabel: string;
  title: string;
  tags: { tag: { id: string; name: string; color: string | null } }[];
  collectionName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    placement: "right" | "left";
  } | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const computePosition = () => {
    const el = thumbRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const previewSize = 256;
    const gap = 12;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    // Sağa yerleşmeye çalış; viewport sağa sığmıyorsa sola al.
    const wantsRightLeft = rect.right + gap;
    const fitsRight = wantsRightLeft + previewSize + 8 <= viewportW;
    const left = fitsRight
      ? wantsRightLeft
      : Math.max(8, rect.left - previewSize - gap);
    // Top: thumb merkez hizasından preview yüksekliğini sığdır.
    const desiredTop = rect.top + rect.height / 2 - previewSize / 2;
    const top = Math.min(
      Math.max(8, desiredTop),
      viewportH - previewSize - 8,
    );
    setPosition({ top, left, placement: fitsRight ? "right" : "left" });
  };

  const scheduleOpen = () => {
    if (!assetId) return;
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      computePosition();
      setOpen(true);
    }, 120);
  };

  const cancelOpen = () => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScrollOrResize = () => computePosition();
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const interactive = !!assetId;

  return (
    <>
      <div
        ref={thumbRef}
        className={cn(
          "k-thumb !w-10 !aspect-square",
          interactive &&
            "ring-1 ring-transparent transition-shadow hover:ring-line focus-visible:ring-line",
        )}
        tabIndex={interactive ? 0 : -1}
        aria-label={interactive ? `Preview ${title}` : undefined}
        onMouseEnter={scheduleOpen}
        onMouseLeave={cancelOpen}
        onFocus={scheduleOpen}
        onBlur={cancelOpen}
        data-preview-open={open || undefined}
        data-testid="bookmark-thumb"
      >
        <AssetImage assetId={assetId} alt={alt} frame={false} />
      </div>
      {open && position && interactive ? (
        <div
          role="tooltip"
          aria-label={`Preview of ${title}`}
          className="pointer-events-none fixed z-50 w-64 rounded-md border border-line bg-paper p-2 shadow-popover"
          // Phase 23 — Runtime-computed position for fixed popover.
          // viewport-aware placement (sağa sığmıyorsa sola düşer); dinamik
          // top/left Tailwind class ile ifade edilemez. CSS variable
          // pattern de aynı runtime hesabı taşır, ek katman değer
          // getirmez.
          // eslint-disable-next-line no-restricted-syntax
          style={{ top: position.top, left: position.left }}
          data-placement={position.placement}
          data-testid="bookmark-thumb-preview"
        >
          <div className="aspect-square w-full overflow-hidden rounded-sm bg-k-bg-2">
            <AssetImage assetId={assetId} alt={alt} frame={false} />
          </div>
          <div className="mt-2 flex flex-col gap-1 px-0.5">
            <span
              className="truncate text-[12px] font-medium text-ink"
              title={title}
            >
              {title}
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              {sourceLabel}
            </span>
            {/* Phase 29 — row'dan kalkan tag chip'leri + collection adı
             * popover içinde görünür hale geldi. */}
            {collectionName ? (
              <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
                in {collectionName}
              </span>
            ) : null}
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-0.5 pt-0.5">
                {tags.slice(0, 6).map((t) => (
                  <span
                    key={t.tag.id}
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[10.5px]",
                      tagColorClass(t.tag.color),
                    )}
                  >
                    {t.tag.name}
                  </span>
                ))}
                {tags.length > 6 ? (
                  <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
                    +{tags.length - 6}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
