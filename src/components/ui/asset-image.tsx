"use client";

import { useQuery } from "@tanstack/react-query";

export type AssetImageProps = {
  assetId: string | null | undefined;
  alt: string;
  /** Varsayılan: "card" (4:3). İleride daha fazla oran eklenebilir. */
  aspect?: "card";
};

async function fetchSignedUrl(assetId: string): Promise<string> {
  const res = await fetch(`/api/assets/${assetId}/signed-url`);
  if (!res.ok) {
    const err = new Error(
      `Signed URL alınamadı: ${res.status}`,
    ) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export function AssetImage({
  assetId,
  alt,
  aspect = "card",
}: AssetImageProps): JSX.Element {
  // aspect prop şu an sadece "card" destekliyor; ileride genişleyebilir
  void aspect;

  const { data: url, status } = useQuery({
    queryKey: ["asset-signed-url", assetId],
    queryFn: () => fetchSignedUrl(assetId!),
    staleTime: 4 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: (failureCount: number, error: unknown) => {
      const httpStatus = (error as { status?: number })?.status;
      if (httpStatus !== undefined && httpStatus < 500) return false;
      return failureCount < 2;
    },
    retryDelay: (i: number) => Math.min(1000 * 2 ** i, 4000),
    enabled: Boolean(assetId),
  });

  if (!assetId) {
    return (
      <div className="aspect-card w-full overflow-hidden rounded-md bg-surface-muted">
        <div className="flex h-full items-center justify-center text-xs text-text-muted">
          Görsel yok
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="aspect-card w-full overflow-hidden rounded-md bg-surface-muted">
        <div
          role="status"
          aria-busy="true"
          className="h-full w-full animate-pulse motion-reduce:animate-none"
        />
      </div>
    );
  }

  if (status === "error" || !url) {
    return (
      <div className="aspect-card w-full overflow-hidden rounded-md bg-surface-muted">
        <div
          aria-label="Görsel yüklenemedi"
          className="flex h-full items-center justify-center text-xs text-text-muted"
        >
          Görsel yok
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-card w-full overflow-hidden rounded-md bg-surface-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL'ler dinamik; next/image remotePatterns genişletmesi scope dışı */}
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
