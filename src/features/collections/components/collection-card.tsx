"use client";

import { CollectionThumb } from "@/components/ui/CollectionThumb";

/**
 * CollectionCard — Kivasy v5 B1.Collections sub-view recipe (R11.14.12).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b1.jsx
 *   → SubCollections kart bloğu paritesi.
 *
 * R11.14.12 — Eski legacy `Card variant="asset"` + `Button` + `Badge`
 * primitive kompozisyonu yerine v5 SubCollections k-card pattern'a
 * geçirildi (Library + References Pool + Competitor + Bookmark
 * paritesiyle birebir):
 *   - .k-card overflow-hidden + data-interactive
 *   - thumbnail wrapper p-2 pb-0 + CollectionThumb (3-up composite)
 *   - meta block: name 13px font-semibold + kind k-badge tone +
 *     count·updated mono caption 10.5px
 *   - footer ghost Archive (low-emphasis)
 *
 * Tüm copy EN'e normalize edildi (kind labels, item label, button copy,
 * date locale en-US).
 */

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
      ? "bookmarks"
      : collection.kind === "REFERENCE"
        ? "references"
        : "items";
  const kindLabel =
    collection.kind === "BOOKMARK"
      ? "Bookmark"
      : collection.kind === "REFERENCE"
        ? "Reference"
        : "Mixed";
  const kindTone =
    collection.kind === "BOOKMARK"
      ? "accent"
      : collection.kind === "REFERENCE"
        ? "success"
        : "neutral";
  const updated = new Date(
    collection.updatedAt ?? collection.createdAt,
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  return (
    <article
      className="k-card overflow-hidden flex flex-col"
      data-interactive="true"
      data-testid="collection-card"
    >
      <div className="p-2 pb-0">
        <CollectionThumb
          assetIds={collection.thumbnailAssetIds ?? []}
          alt={collection.name}
        />
      </div>
      <div className="flex flex-col gap-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13px] font-semibold leading-tight text-ink">
              {collection.name}
            </h3>
            <div className="mt-1 font-mono text-[10.5px] tracking-wider text-ink-3">
              {itemCount} {itemLabel} · {updated}
            </div>
          </div>
          <span className="k-badge" data-tone={kindTone}>
            {kindLabel}
          </span>
        </div>
        {onArchive ? (
          <div className="mt-1 flex justify-end">
            <button
              type="button"
              data-size="sm"
              className="k-btn k-btn--ghost"
              onClick={() => onArchive(collection.id)}
            >
              Archive
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
