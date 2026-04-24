"use client";

import { Folder } from "lucide-react";
import { AssetImage } from "@/components/ui/asset-image";
import { cn } from "@/lib/cn";

/**
 * EtsyHub CollectionThumb — koleksiyon kartı için görsel yüzey.
 *
 * Davranış matrisi:
 * - 0 asset → placeholder (folder icon) + `aspect-video` çerçeve.
 * - 1–3 asset → tek `AssetImage` (single fallback). Yarı-mozaik yok, çünkü
 *   2/3 görselle simetrik bir düzen yapılamıyor; tek görsel her zaman daha
 *   okunabilir.
 * - 4+ asset → 2×2 mosaic (`grid-cols-2 grid-rows-2`). Fazlası atılır; ilk 4
 *   asset render edilir.
 *
 * `assetIds` T-17'de backend aggregate'i (`thumbnailAssetIds`) ile dolacak;
 * primitive'in sözleşmesi o sırada değişmeyecek.
 */

export interface CollectionThumbProps {
  assetIds: string[];
  alt?: string;
  className?: string;
}

export function CollectionThumb({
  assetIds,
  alt,
  className,
}: CollectionThumbProps) {
  if (assetIds.length === 0) {
    return (
      <div
        data-testid="collection-thumb-placeholder"
        className={cn(
          "flex aspect-video items-center justify-center rounded-md border border-border-subtle bg-surface-muted text-text-subtle",
          className,
        )}
        aria-label={alt}
      >
        <Folder className="h-8 w-8" aria-hidden />
      </div>
    );
  }

  if (assetIds.length < 4) {
    const first = assetIds[0]!;
    return (
      <div
        className={cn(
          "aspect-video overflow-hidden rounded-md",
          className,
        )}
      >
        <AssetImage assetId={first} alt={alt ?? ""} unstyled />
      </div>
    );
  }

  const slots = assetIds.slice(0, 4);
  return (
    <div
      data-testid="collection-thumb-mosaic"
      className={cn(
        "grid aspect-video grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-md bg-border-subtle",
        className,
      )}
      aria-label={alt}
    >
      {slots.map((id) => (
        <AssetImage key={id} assetId={id} alt="" unstyled />
      ))}
    </div>
  );
}
