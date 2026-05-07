"use client";

// Pass 52 — Admin Asset thumbnail.
//
// Sözleşme:
//   • Admin scope signed URL'i `GET /api/admin/assets/:id/signed-url`
//     ile alır, <img>'e bağlar.
//   • TTL = 300sn; bileşen mount sırasında bir defa fetch eder.
//   • Fail durumunda fallback metni gösterir (broken-image yerine
//     operatöre teşhis ipucu).
//   • `square` true ise 1:1 aspect kutu içinde object-cover.
//
// Bu bileşen MJ admin tablosunda (mini thumb) ve detay sayfasında
// (büyük preview) tek tipte kullanılabilir.

import { useEffect, useState } from "react";

type AssetThumbProps = {
  assetId: string;
  alt?: string;
  className?: string;
  /** Kare aspect zorla (object-cover). Default true. */
  square?: boolean;
};

export function AssetThumb({
  assetId,
  alt = "",
  className,
  square = true,
}: AssetThumbProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/assets/${assetId}/signed-url`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
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

  const wrapperClass =
    (square ? "aspect-square " : "") +
    "overflow-hidden rounded-md border border-border bg-surface-2 " +
    (className ?? "");

  if (error) {
    return (
      <div
        className={wrapperClass}
        title={`Thumb fail: ${error}`}
        data-testid="mj-asset-thumb-error"
      >
        <div className="flex h-full items-center justify-center text-xs text-text-muted">
          ⚠
        </div>
      </div>
    );
  }
  if (!url) {
    return (
      <div
        className={wrapperClass}
        data-testid="mj-asset-thumb-loading"
      >
        <div className="flex h-full items-center justify-center text-xs text-text-muted">
          …
        </div>
      </div>
    );
  }
  return (
    <div className={wrapperClass} data-testid="mj-asset-thumb">
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
