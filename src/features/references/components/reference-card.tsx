"use client";

type ReferenceLite = {
  id: string;
  notes: string | null;
  createdAt: string;
  asset: { id: string; storageKey: string; bucket: string } | null;
  productType: { id: string; displayName: string } | null;
  collection: { id: string; name: string } | null;
  bookmark: { id: string; title: string | null; sourceUrl: string | null } | null;
  tags: { tag: { id: string; name: string; color: string | null } }[];
};

export function ReferenceCard({
  reference,
  onOpen,
  onArchive,
}: {
  reference: ReferenceLite;
  onOpen?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const title =
    reference.bookmark?.title ??
    reference.bookmark?.sourceUrl ??
    reference.productType?.displayName ??
    "Referans";

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-sm font-medium text-text">{title}</h3>
          <span className="text-xs text-text-muted">
            {new Date(reference.createdAt).toLocaleString("tr-TR")}
          </span>
        </div>
        {reference.productType ? (
          <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs text-accent">
            {reference.productType.displayName}
          </span>
        ) : null}
      </div>

      {reference.asset ? (
        <div className="aspect-[4/3] overflow-hidden rounded-md bg-surface-muted text-xs text-text-muted">
          <span className="flex h-full items-center justify-center">
            Asset: {reference.asset.id.slice(0, 8)}…
          </span>
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-surface-muted text-xs text-text-muted">
          Görsel yok
        </div>
      )}

      {reference.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {reference.tags.map((t) => (
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
        <span className="truncate text-xs text-text-muted">
          {reference.collection?.name ?? "Koleksiyon yok"}
        </span>
        <div className="flex gap-2">
          {onOpen ? (
            <button
              type="button"
              onClick={() => onOpen(reference.id)}
              className="rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface-muted"
            >
              Aç
            </button>
          ) : null}
          {onArchive ? (
            <button
              type="button"
              onClick={() => onArchive(reference.id)}
              className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:bg-surface-muted"
            >
              Arşivle
            </button>
          ) : null}
        </div>
      </div>

      {reference.notes ? (
        <p className="line-clamp-2 text-xs text-text-muted">{reference.notes}</p>
      ) : null}
    </article>
  );
}
