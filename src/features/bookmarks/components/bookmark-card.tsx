"use client";

import type { BookmarkStatus, RiskLevel } from "@prisma/client";

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

export function BookmarkCard({
  bookmark,
  onOpen,
  onArchive,
}: {
  bookmark: BookmarkLite;
  onOpen?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-sm font-medium text-text">
            {bookmark.title ?? bookmark.sourceUrl ?? "İsimsiz"}
          </h3>
          <span className="text-xs text-text-muted">
            {new Date(bookmark.createdAt).toLocaleString("tr-TR")} ·{" "}
            {bookmark.sourcePlatform ?? "OTHER"}
          </span>
        </div>
        <span
          className={
            bookmark.status === "RISKY"
              ? "rounded-md bg-danger/15 px-2 py-0.5 text-xs text-danger"
              : bookmark.status === "REFERENCED"
                ? "rounded-md bg-success/15 px-2 py-0.5 text-xs text-success"
                : bookmark.status === "ARCHIVED"
                  ? "rounded-md bg-surface-muted px-2 py-0.5 text-xs text-text-muted"
                  : "rounded-md bg-accent/15 px-2 py-0.5 text-xs text-accent"
          }
        >
          {bookmark.status}
        </span>
      </div>

      {bookmark.asset ? (
        <div className="aspect-[4/3] overflow-hidden rounded-md bg-surface-muted text-xs text-text-muted">
          <span className="flex h-full items-center justify-center">
            Asset: {bookmark.asset.id.slice(0, 8)}…
          </span>
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-surface-muted text-xs text-text-muted">
          Görsel yok
        </div>
      )}

      {bookmark.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {bookmark.tags.map((t) => (
            <span
              key={t.tag.id}
              className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-text-muted"
            >
              {t.tag.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          {bookmark.productType?.displayName ?? "Tip yok"} ·{" "}
          {bookmark.collection?.name ?? "Koleksiyon yok"}
        </span>
        <div className="flex gap-2">
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(bookmark.id)}
              className="rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface-muted"
            >
              Aç
            </button>
          ) : null}
          {onArchive && bookmark.status !== "ARCHIVED" ? (
            <button
              type="button"
              onClick={() => onArchive(bookmark.id)}
              className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:bg-surface-muted"
            >
              Arşivle
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
