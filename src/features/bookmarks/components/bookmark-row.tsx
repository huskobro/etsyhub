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

import type { BookmarkStatus, RiskLevel } from "@prisma/client";
import { AssetImage } from "@/components/ui/asset-image";
import { tagColorClass } from "@/features/tags/color-map";
import { CollectionPicker } from "@/features/collections/components/collection-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";
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
        "border-b border-line-soft last:border-b-0 hover:bg-k-bg-2/40",
        selected && "bg-k-orange-soft/30",
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

      {/* Thumbnail */}
      <td className="px-3 py-3 align-middle">
        <div className="k-thumb !w-10 !aspect-square">
          <AssetImage
            assetId={bookmark.asset?.id ?? null}
            alt={title}
            frame={false}
          />
        </div>
      </td>

      {/* Title + meta row (tags / collection / product type) */}
      <td className="px-3 py-3 align-middle">
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="text-[13px] font-medium text-ink truncate"
            title={title}
          >
            {title}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {bookmark.productType ? (
              <span
                className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
              >
                {bookmark.productType.displayName}
              </span>
            ) : null}
            {onSetTags ? (
              <TagPicker
                selected={bookmark.tags.map((t) => t.tag.id)}
                onChange={(tagIds) => onSetTags(bookmark.id, tagIds)}
                disabled={updating}
              />
            ) : bookmark.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {bookmark.tags.map((t) => (
                  <span
                    key={t.tag.id}
                    className={`rounded-sm px-1.5 py-0.5 text-[10.5px] ${tagColorClass(t.tag.color)}`}
                  >
                    {t.tag.name}
                  </span>
                ))}
              </div>
            ) : null}
            {onSetCollection ? (
              <CollectionPicker
                value={bookmark.collection?.id ?? null}
                onChange={(id) => onSetCollection(bookmark.id, id)}
                disabled={updating}
              />
            ) : bookmark.collection ? (
              <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
                · {bookmark.collection.name}
              </span>
            ) : null}
          </div>
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

      {/* Row actions */}
      <td className="px-3 py-3 text-right align-middle">
        <div className="inline-flex items-center gap-1.5">
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
