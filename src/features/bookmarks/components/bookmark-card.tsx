"use client";

import type { BookmarkStatus, RiskLevel } from "@prisma/client";
import { AssetImage } from "@/components/ui/asset-image";
import { tagColorClass } from "@/features/tags/color-map";
import { CollectionPicker } from "@/features/collections/components/collection-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";
import { cn } from "@/lib/cn";

/**
 * BookmarkCard — Kivasy v5 B1.Inbox sub-view recipe (R11.14.12).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b1.jsx
 *   → SubInbox kart bloğu paritesi.
 *
 * R11.14.12 — Eski legacy `Card variant="asset"` + `AssetCardMeta` +
 * `Button` + `Badge` primitive kompozisyonu yerine v5 SubInbox k-card
 * pattern'a geçirildi (Library + References Pool + Competitor card
 * paritesiyle birebir):
 *   - .k-card overflow-hidden group + data-interactive
 *   - thumbnail wrapper p-2 pb-0 + k-thumb data-aspect="square"
 *   - top-left always-on k-checkbox (k-orange filled when selected)
 *   - meta block: title 13px font-medium + status badge tone-mapped +
 *     source mono caption 10.5px
 *   - hover bottom-overlay: primary "Promote to Reference" k-btn--primary
 *     (single primary action — Inbox sub-view canon)
 *   - footer ghost actions: Open / Archive (low-emphasis)
 *
 * Tüm copy EN'e normalize edildi (Status labels, picker label, button copy).
 */

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

const STATUS_LABEL: Record<BookmarkStatus, string> = {
  INBOX: "Inbox",
  REFERENCED: "Reference",
  RISKY: "Risky",
  ARCHIVED: "Archived",
};

const STATUS_TONE: Record<BookmarkStatus, string> = {
  INBOX: "accent",
  REFERENCED: "success",
  RISKY: "danger",
  ARCHIVED: "neutral",
};

export function BookmarkCard({
  bookmark,
  selected = false,
  onToggleSelect,
  onOpen,
  onArchive,
  onPromote,
  onSetCollection,
  onSetTags,
  updating,
}: {
  bookmark: BookmarkLite;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onOpen?: (id: string) => void;
  onArchive?: (id: string) => void;
  onPromote?: (id: string) => void;
  onSetCollection?: (id: string, collectionId: string | null) => void;
  onSetTags?: (id: string, tagIds: string[]) => void;
  updating?: boolean;
}) {
  const title = bookmark.title ?? bookmark.sourceUrl ?? "Untitled";
  const createdLabel = new Date(bookmark.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  return (
    <article
      className={cn(
        "k-card overflow-hidden group flex flex-col",
        selected && "k-ring-selected",
      )}
      data-interactive="true"
      data-testid="bookmark-card"
    >
      <div className="relative p-2 pb-0">
        <div className="k-thumb" data-aspect="square">
          <AssetImage
            assetId={bookmark.asset?.id ?? null}
            alt={title}
            frame={false}
          />
        </div>

        {onToggleSelect ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(bookmark.id);
            }}
            aria-pressed={selected}
            aria-label={selected ? "Deselect" : "Select"}
            className="k-checkbox absolute left-3 top-3 z-10"
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
      </div>

      <div className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight text-ink">
            {title}
          </h3>
          <span className="k-badge" data-tone={STATUS_TONE[bookmark.status]}>
            {STATUS_LABEL[bookmark.status]}
          </span>
        </div>

        <div className="font-mono text-[10.5px] tracking-wider text-ink-3">
          {bookmark.sourcePlatform ?? "OTHER"} · {createdLabel}
        </div>

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
                className={`rounded-sm px-2 py-0.5 text-[10.5px] ${tagColorClass(t.tag.color)}`}
              >
                {t.tag.name}
              </span>
            ))}
          </div>
        ) : null}

        {onSetCollection ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              Collection
            </span>
            <CollectionPicker
              value={bookmark.collection?.id ?? null}
              onChange={(id) => onSetCollection(bookmark.id, id)}
              disabled={updating}
            />
          </div>
        ) : null}

        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[10.5px] tracking-wider text-ink-3">
            {bookmark.productType?.displayName ?? "No type"}
            {onSetCollection
              ? null
              : ` · ${bookmark.collection?.name ?? "No collection"}`}
          </span>
          <div className="flex gap-1">
            {onOpen ? (
              <button
                type="button"
                data-size="sm"
                className="k-btn k-btn--ghost"
                onClick={() => onOpen(bookmark.id)}
              >
                Open
              </button>
            ) : null}
            {onPromote && bookmark.asset && bookmark.status !== "REFERENCED" ? (
              <button
                type="button"
                data-size="sm"
                className="k-btn k-btn--secondary"
                onClick={() => onPromote(bookmark.id)}
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
              >
                Archive
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
