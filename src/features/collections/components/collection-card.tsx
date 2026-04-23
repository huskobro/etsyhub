"use client";

type CollectionLite = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  kind: "BOOKMARK" | "REFERENCE" | "MIXED";
  createdAt: string;
  _count: { bookmarks: number; references: number };
};

const KIND_LABEL: Record<CollectionLite["kind"], string> = {
  MIXED: "Karma",
  BOOKMARK: "Bookmark",
  REFERENCE: "Reference",
};

export function CollectionCard({
  collection,
  onArchive,
}: {
  collection: CollectionLite;
  onArchive?: (id: string) => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-sm font-medium text-text">
            {collection.name}
          </h3>
          <span className="text-xs text-text-muted">
            {new Date(collection.createdAt).toLocaleString("tr-TR")}
          </span>
        </div>
        <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs text-accent">
          {KIND_LABEL[collection.kind]}
        </span>
      </div>

      {collection.description ? (
        <p className="line-clamp-2 text-xs text-text-muted">
          {collection.description}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">
          {collection._count.bookmarks} bookmark ·{" "}
          {collection._count.references} referans
        </span>
        {onArchive ? (
          <button
            type="button"
            onClick={() => onArchive(collection.id)}
            className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:bg-surface-muted"
          >
            Arşivle
          </button>
        ) : null}
      </div>
    </article>
  );
}
