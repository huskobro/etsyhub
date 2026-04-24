"use client";

import { useQuery } from "@tanstack/react-query";

export type AssetImageProps = {
  assetId: string | null | undefined;
  alt: string;
  /**
   * Varsayılan (true) → aspect-card (4/3) Frame wrapper uygulanır; mevcut
   * tüketiciler (BookmarkCard, ReferenceCard vb.) için backward-compatible
   * (prop geçirmeyen çağırıcılar aynı davranışı görür).
   *
   * false → Frame wrapper atlanır; sadece inner content (loading skeleton /
   * empty state / <img>) `h-full w-full` olarak render edilir. Outer aspect
   * ratio kontrolü çağıran bileşenin sorumluluğundadır (örn. CollectionThumb
   * `aspect-video` container'ı).
   */
  frame?: boolean;
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

const frameClass = "aspect-card w-full overflow-hidden rounded-md bg-surface-muted";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div data-slot="asset-image-frame" className={frameClass}>
      {children}
    </div>
  );
}

function EmptyContent({ label = "Görsel yok" }: { label?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-full items-center justify-center text-xs text-text-muted"
    >
      Görsel yok
    </div>
  );
}

function LoadingContent() {
  return (
    <div
      role="status"
      aria-label="Görsel yükleniyor"
      aria-busy="true"
      className="h-full w-full animate-pulse motion-reduce:animate-none"
    />
  );
}

export function AssetImage({
  assetId,
  alt,
  frame = true,
}: AssetImageProps): JSX.Element {
  const query = useQuery({
    queryKey: ["asset-signed-url", assetId],
    queryFn: () => fetchSignedUrl(assetId!),
    staleTime: 4 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: (failureCount, error) => {
      const httpStatus = (error as { status?: number })?.status;
      if (httpStatus !== undefined && httpStatus < 500) return false;
      return failureCount < 2;
    },
    retryDelay: (i) => Math.min(1000 * 2 ** i, 4000),
    enabled: Boolean(assetId),
  });

  const content = !assetId ? (
    <EmptyContent />
  ) : query.isError ? (
    <EmptyContent label="Görsel yüklenemedi" />
  ) : query.isPending ? (
    <LoadingContent />
  ) : query.data ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed URL'ler dinamik; next/image remotePatterns genişletmesi scope dışı
    <img
      src={query.data}
      alt={alt}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : (
    <EmptyContent />
  );

  return frame ? <Frame>{content}</Frame> : content;
}
