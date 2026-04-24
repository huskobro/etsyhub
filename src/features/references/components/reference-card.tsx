"use client";

import { AssetImage } from "@/components/ui/asset-image";
import { tagColorClass } from "@/features/tags/color-map";
import { CollectionPicker } from "@/features/collections/components/collection-picker";
import { TagPicker } from "@/features/tags/components/tag-picker";

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
  onSetCollection,
  onSetTags,
  updating,
}: {
  reference: ReferenceLite;
  onOpen?: (id: string) => void;
  onArchive?: (id: string) => void;
  onSetCollection?: (id: string, collectionId: string | null) => void;
  onSetTags?: (id: string, tagIds: string[]) => void;
  updating?: boolean;
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

      <AssetImage assetId={reference.asset?.id ?? null} alt={title} />

      {onSetTags ? (
        <TagPicker
          selected={reference.tags.map((t) => t.tag.id)}
          onChange={(tagIds) => onSetTags(reference.id, tagIds)}
          disabled={updating}
        />
      ) : reference.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {reference.tags.map((t) => (
            <span
              key={t.tag.id}
              className={`rounded-md px-2 py-0.5 text-xs ${tagColorClass(t.tag.color)}`}
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
            value={reference.collection?.id ?? null}
            onChange={(id) => onSetCollection(reference.id, id)}
            disabled={updating}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs text-text-muted">
          {onSetCollection
            ? reference.notes
              ? ""
              : "Not yok"
            : reference.collection?.name ?? "Koleksiyon yok"}
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
