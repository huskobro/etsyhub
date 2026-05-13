/* eslint-disable no-restricted-syntax */
// PaneStorage — R8: provider info read-only + signed URL TTL + thumbnail
// cache prefs persist (UserSetting key="storage").
//
// v6 sabit boyutlar (max-w-[680px] + text-[26px] k-display + yarı-piksel)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface StorageView {
  storage: {
    provider: string;
    bucket: string;
    assetCount: number;
    assetBytes: number;
    mockupRenderCount: number;
  };
  prefs: {
    signedUrlTtlSeconds: number;
    thumbnailCacheSeconds: number;
  };
}

const QUERY_KEY = ["settings", "storage"] as const;

function bytesLabel(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

function ttlLabel(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(seconds % 3600 === 0 ? 0 : 1)} h`;
}

export function PaneStorage() {
  const qc = useQueryClient();
  const query = useQuery<StorageView>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/settings/storage");
      if (!r.ok) throw new Error("Could not load storage info");
      return r.json();
    },
  });

  const mutation = useMutation<
    { prefs: StorageView["prefs"] },
    Error,
    Partial<StorageView["prefs"]>
  >({
    mutationFn: async (patch) => {
      const r = await fetch("/api/settings/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error(b?.error ?? `HTTP ${r.status}`);
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const remote = query.data;
  const [signedTtl, setSignedTtl] = useState<number>(3600);
  const [thumbCache, setThumbCache] = useState<number>(3600);

  useEffect(() => {
    if (remote) {
      setSignedTtl(remote.prefs.signedUrlTtlSeconds);
      setThumbCache(remote.prefs.thumbnailCacheSeconds);
    }
  }, [remote]);

  return (
    <div className="max-w-[680px] px-10 py-9">
      <div className="flex items-start justify-between gap-3">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Storage
        </h2>
        <Badge tone="neutral">PROVIDER · ENV</Badge>
      </div>
      <p className="mt-1 mb-7 text-[13px] text-ink-2">
        Local-first asset storage. Provider configuration is sourced from
        environment variables; signed URL TTL is user-tunable below.
      </p>

      {query.isLoading ? (
        <div className="flex h-32 items-center gap-2 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading storage stats…
        </div>
      ) : remote ? (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-md border border-line bg-paper">
            <div className="border-b border-line-soft px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              Provider (read-only · env)
            </div>
            <div className="grid grid-cols-1 divide-y divide-line-soft md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
                  KIND
                </div>
                <div className="mt-1 text-[15px] font-semibold tracking-tight text-ink">
                  {remote.storage.provider.toUpperCase()}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-3">
                  S3-compatible · signed URL surface
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
                  BUCKET
                </div>
                <div className="mt-1 truncate font-mono text-[13px] text-ink">
                  {remote.storage.bucket}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-3">
                  Configured via STORAGE_BUCKET env
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat
              label="USER ASSETS"
              value={String(remote.storage.assetCount)}
            />
            <Stat
              label="TOTAL SIZE"
              value={bytesLabel(remote.storage.assetBytes)}
            />
            <Stat
              label="MOCKUP RENDERS"
              value={String(remote.storage.mockupRenderCount)}
            />
          </div>

          <div className="overflow-hidden rounded-md border border-line bg-paper">
            <div className="border-b border-line-soft px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              User preferences (persist)
            </div>
            <div className="space-y-5 px-4 py-4">
              <PrefRow
                label="Signed URL TTL"
                hint="How long thumbnail / asset signed URLs stay valid (5min – 12h)."
                value={ttlLabel(signedTtl)}
              >
                <input
                  type="range"
                  min={300}
                  max={43200}
                  step={300}
                  value={signedTtl}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setSignedTtl(v);
                  }}
                  onMouseUp={() =>
                    mutation.mutate({ signedUrlTtlSeconds: signedTtl })
                  }
                  onTouchEnd={() =>
                    mutation.mutate({ signedUrlTtlSeconds: signedTtl })
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line-soft accent-k-orange"
                  data-testid="storage-ttl-slider"
                />
              </PrefRow>
              <PrefRow
                label="Thumbnail cache"
                hint="UI hint: how long browser cache holds thumbnail responses."
                value={ttlLabel(thumbCache)}
              >
                <input
                  type="range"
                  min={300}
                  max={86400}
                  step={300}
                  value={thumbCache}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setThumbCache(v);
                  }}
                  onMouseUp={() =>
                    mutation.mutate({ thumbnailCacheSeconds: thumbCache })
                  }
                  onTouchEnd={() =>
                    mutation.mutate({ thumbnailCacheSeconds: thumbCache })
                  }
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line-soft accent-k-orange"
                />
              </PrefRow>
            </div>
          </div>

          <div className="rounded-md border border-dashed border-line bg-k-bg-2/40 px-4 py-3">
            <div className="flex items-start gap-2">
              <Package className="mt-0.5 h-4 w-4 text-ink-3" aria-hidden />
              <p className="text-[12px] leading-relaxed text-ink-2">
                Remote provider switch (R2 / S3) and bucket override UI
                land post-MVP. Signed URL TTL persists today via{" "}
                <span className="font-mono text-xs">
                  UserSetting key=storage
                </span>
                .
              </p>
            </div>
          </div>

          <p className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
            {mutation.isPending
              ? "Saving…"
              : mutation.isError
                ? `Save failed: ${mutation.error?.message}`
                : "Slider release saves immediately"}
          </p>
        </div>
      ) : (
        <p className="text-sm text-danger">
          {query.error instanceof Error
            ? query.error.message
            : "Storage info okunamadı"}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-paper px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
        {label}
      </div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

function PrefRow({
  label,
  hint,
  value,
  children,
}: {
  label: string;
  hint: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <div>
          <div className="text-[12.5px] font-semibold text-ink">{label}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-3">{hint}</div>
        </div>
        <span className="font-mono text-[13px] tabular-nums text-ink-2">
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}
