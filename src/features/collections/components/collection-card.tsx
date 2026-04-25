"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CollectionThumb } from "@/components/ui/CollectionThumb";

type CollectionKind = "BOOKMARK" | "REFERENCE" | "MIXED";

type CollectionLite = {
  id: string;
  name: string;
  kind: CollectionKind;
  updatedAt?: string;
  createdAt: string;
  _count: { bookmarks: number; references: number };
  thumbnailAssetIds?: string[];
};

export function CollectionCard({
  collection,
  onArchive,
}: {
  collection: CollectionLite;
  onArchive?: (id: string) => void;
}) {
  const itemCount =
    collection.kind === "REFERENCE"
      ? collection._count.references
      : collection.kind === "BOOKMARK"
        ? collection._count.bookmarks
        : collection._count.bookmarks + collection._count.references;
  const itemLabel =
    collection.kind === "BOOKMARK"
      ? "bookmark"
      : collection.kind === "REFERENCE"
        ? "referans"
        : "kayıt";
  const kindLabel =
    collection.kind === "BOOKMARK"
      ? "Bookmark"
      : collection.kind === "REFERENCE"
        ? "Referans"
        : "Karma";
  const kindTone =
    collection.kind === "BOOKMARK"
      ? "accent"
      : collection.kind === "REFERENCE"
        ? "success"
        : "neutral";
  const updated = new Date(
    collection.updatedAt ?? collection.createdAt,
  ).toLocaleDateString("tr-TR");

  return (
    <Card variant="asset" interactive>
      <CollectionThumb
        assetIds={collection.thumbnailAssetIds ?? []}
        alt={collection.name}
      />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-text">
              {collection.name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-text-subtle">
              <span className="font-mono">{`${itemCount} ${itemLabel}`}</span>
              <span aria-hidden>·</span>
              <span>{updated}</span>
            </div>
          </div>
          <Badge tone={kindTone}>{kindLabel}</Badge>
        </div>
        {onArchive ? (
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onArchive(collection.id)}
            >
              Arşivle
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
