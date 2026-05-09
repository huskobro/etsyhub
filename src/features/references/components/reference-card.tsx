"use client";

import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";

/**
 * ReferenceCard — Kivasy v5 B1.Pool kart recipe.
 *
 * R11.14.2 — Legacy `Card variant="asset"` + inline "Üret" CTA pattern,
 * v5 SubPool HTML target'a göre yenilendi:
 *   - `k-card overflow-hidden group` çerçevesi (rounded-md border + hover
 *     line-strong)
 *   - thumbnail wrapper'ı 2px padding ile (HTML: `p-2 pb-0`)
 *   - top-left checkbox (always visible) + selection ring
 *   - hover-only full-width bottom overlay: `k-btn--primary` "Create
 *     Variations" (full gradient parity, design-system canon CTA)
 *   - meta block: title (13px) + source badge + tip · tarih (10.5px mono)
 *   - "Arşivle" inline CTA hover'da meta üst hizalı kalır (operatör
 *     destruct path).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b1.jsx
 *   → SubPool kart bloğu (lines 124-150).
 */

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
    reference.bookmark?.title ?? reference.bookmark?.sourceUrl ?? "Reference";
  const createdLabel = new Date(reference.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
  const source = (() => {
    if (!reference.bookmark?.sourceUrl) return null;
    try {
      return new URL(reference.bookmark.sourceUrl).hostname.replace(/^www\./, "");
    } catch {
      return reference.bookmark.sourceUrl;
    }
  })();

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-md border border-line bg-paper transition-colors hover:border-line-strong",
        selected && "k-ring-selected",
      )}
      data-interactive="true"
      data-testid="reference-card"
    >
      <div className="relative p-2 pb-0">
        {reference.asset ? (
          <AssetImage assetId={reference.asset.id} alt={title} />
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-sm bg-paper text-xs text-ink-3">
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
              "absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-sm border shadow-card",
              selected
                ? "border-k-orange bg-k-orange text-white"
                : "border-line bg-paper/95 text-ink-3 hover:text-ink",
            )}
          >
            {selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
          </button>
        ) : null}

        {/* Hover-only full-width primary CTA (v5 SubPool parity).
         * Tek primary aksiyon: "Create Variations" — Üretim atölyesini
         * açar; geri akış değil, tek yönlü hand-off (Reference → Batch). */}
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Link
            href={`/references/${reference.id}/variations`}
            data-size="sm"
            className="k-btn k-btn--primary pointer-events-auto w-full"
            title="Open the production workspace (pick from local library or generate AI variants)"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            Create Variations
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-1 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight text-ink">
            {title}
          </h3>
          {reference.productType ? (
            <Badge tone="accent">{reference.productType.displayName}</Badge>
          ) : null}
        </div>
        <div className="font-mono text-[10.5px] tracking-wider text-ink-3">
          {source ? `${source} · ` : ""}
          {createdLabel}
          {reference.collection?.name
            ? ` · ${reference.collection.name}`
            : ""}
        </div>
        {onArchive ? (
          <div className="mt-1 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onArchive(reference.id)}
            >
              Archive
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
