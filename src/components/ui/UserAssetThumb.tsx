"use client";

/**
 * UserAssetThumb — user-scope counterpart of admin/midjourney/AssetThumb.
 *
 * Same TTL + signed URL pattern, but hits `/api/assets/:id/signed-url`
 * (already exists, user-scoped) instead of the admin endpoint. Used by
 * the Kivasy `/library` Library grid (rollout-2).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/base.jsx → asset
 * thumbnails. We keep aspect-square by default to match v4 grid recipe.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface UserAssetThumbProps {
  assetId: string;
  alt?: string;
  className?: string;
  /** 1:1 aspect (object-cover). Default true. */
  square?: boolean;
}

export function UserAssetThumb({
  assetId,
  alt = "",
  className,
  square = true,
}: UserAssetThumbProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/assets/${assetId}/signed-url`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { url?: string };
        if (!data.url) throw new Error("URL boş");
        if (!cancelled) setUrl(data.url);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "fetch fail");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const wrapperClass = cn(
    square ? "aspect-square" : "",
    "overflow-hidden rounded-md border border-border bg-surface-2",
    className,
  );

  if (error) {
    return (
      <div
        className={wrapperClass}
        title={`Thumb fail: ${error}`}
        data-testid="user-asset-thumb-error"
      >
        <div className="flex h-full items-center justify-center text-xs text-text-muted">
          ⚠
        </div>
      </div>
    );
  }
  if (!url) {
    return (
      <div className={wrapperClass} data-testid="user-asset-thumb-loading">
        <div className="flex h-full items-center justify-center text-xs text-text-muted">
          …
        </div>
      </div>
    );
  }
  return (
    <div className={wrapperClass} data-testid="user-asset-thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
