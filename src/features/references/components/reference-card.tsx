"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { Card, AssetCardMeta } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";

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
  selected,
  onToggleSelect,
  onArchive,
}: {
  reference: ReferenceLite;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const title =
    reference.bookmark?.title ?? reference.bookmark?.sourceUrl ?? "Referans";
  const createdLabel = new Date(reference.createdAt).toLocaleDateString("tr-TR");
  const source = (() => {
    if (!reference.bookmark?.sourceUrl) return "—";
    try {
      return new URL(reference.bookmark.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      return reference.bookmark.sourceUrl;
    }
  })();

  return (
    <Card variant="asset" interactive selected={selected}>
      <div className="relative">
        {reference.asset ? (
          <AssetImage assetId={reference.asset.id} alt={title} />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-surface-muted text-xs text-text-subtle">
            Görsel yok
          </div>
        )}
        {onToggleSelect ? (
          <button
            type="button"
            aria-label="Seç"
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(reference.id);
            }}
            className={cn(
              "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-sm border",
              selected
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface/80 text-text-subtle hover:text-text",
            )}
          >
            {selected ? <Check className="h-4 w-4" aria-hidden /> : null}
          </button>
        ) : null}
      </div>
      <AssetCardMeta>
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
            {title}
          </h3>
          {reference.productType ? (
            <Badge tone="accent">{reference.productType.displayName}</Badge>
          ) : null}
        </div>
        <div className="text-xs text-text-subtle">
          {source} · {createdLabel}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="truncate text-xs text-text-subtle">
            {reference.collection?.name ?? "Koleksiyon yok"}
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={`/references/${reference.id}/variations`}
              className={cn(
                "inline-flex h-control-sm items-center justify-center gap-1.5",
                "rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-text",
                "transition-colors duration-fast ease-out hover:border-border-strong",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              )}
            >
              Benzerini yap
            </Link>
            {onArchive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onArchive(reference.id)}
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
