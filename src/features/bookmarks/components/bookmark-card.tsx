"use client";

import type { BookmarkStatus, RiskLevel } from "@prisma/client";
import { AssetImage } from "@/components/ui/asset-image";
import { Card, AssetCardMeta } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { tagColorClass } from "@/features/tags/color-map";
import { CollectionPicker } from "@/features/collections/components/collection-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";

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
  REFERENCED: "Referans",
  RISKY: "Riskli",
  ARCHIVED: "Arşiv",
};

const STATUS_TONE: Record<BookmarkStatus, BadgeTone> = {
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
  return (
    <Card variant="asset" interactive selected={selected}>
      <div className="relative">
        <AssetImage
          assetId={bookmark.asset?.id ?? null}
          alt={bookmark.title ?? bookmark.sourceUrl ?? "Bookmark görseli"}
        />
        {onToggleSelect ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(bookmark.id);
            }}
            aria-pressed={selected}
            aria-label={selected ? "Seçimi kaldır" : "Seç"}
            className={
              selected
                ? "absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-sm bg-accent text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                : "absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-sm border border-border-subtle bg-surface/80 text-transparent transition-colors duration-fast ease-out hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            }
          >
            <CheckIcon />
          </button>
        ) : null}
      </div>

      <AssetCardMeta>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-text">
            {bookmark.title ?? bookmark.sourceUrl ?? "İsimsiz"}
          </h3>
          <Badge tone={STATUS_TONE[bookmark.status]}>
            {STATUS_LABEL[bookmark.status]}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-text-subtle">
          <span className="font-mono">{bookmark.sourcePlatform ?? "OTHER"}</span>
          <span aria-hidden>·</span>
          <span>{new Date(bookmark.createdAt).toLocaleDateString("tr-TR")}</span>
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
                className={`rounded-sm px-2 py-0.5 text-xs ${tagColorClass(t.tag.color)}`}
              >
                {t.tag.name}
              </span>
            ))}
          </div>
        ) : null}

        {onSetCollection ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Koleksiyon</span>
            <CollectionPicker
              value={bookmark.collection?.id ?? null}
              onChange={(id) => onSetCollection(bookmark.id, id)}
              disabled={updating}
            />
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="truncate text-xs text-text-muted">
            {bookmark.productType?.displayName ?? "Tip yok"}
            {onSetCollection
              ? null
              : ` · ${bookmark.collection?.name ?? "Koleksiyon yok"}`}
          </span>
          <div className="flex gap-1">
            {onOpen ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpen(bookmark.id)}
              >
                Aç
              </Button>
            ) : null}
            {onPromote && bookmark.asset && bookmark.status !== "REFERENCED" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onPromote(bookmark.id)}
              >
                Referansa Taşı
              </Button>
            ) : null}
            {onArchive && bookmark.status !== "ARCHIVED" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(bookmark.id)}
              >
                Arşivle
              </Button>
            ) : null}
          </div>
        </div>
      </AssetCardMeta>
    </Card>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.5L5 9L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
