/* eslint-disable no-restricted-syntax */
// PaneStorage — Storage provider summary (read-only).
//
// Operatörün dosya katmanına temas eden tek pane. R7'de configuration UI
// (bucket değiştirme, provider switch) yok — backend env üzerinden geliyor.
// Bu yüzden pane "read-only" badge ile dürüst sinyal verir.
//
// v6 sabit boyutlar (max-w-[680px] + text-[26px] k-display + yarı-piksel)
// canon. Whitelisted in scripts/check-tokens.ts.
"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Package } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface StorageInfoView {
  storage: {
    provider: string;
    bucket: string;
    assetCount: number;
    assetBytes: number;
    mockupRenderCount: number;
  };
}

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

export function PaneStorage() {
  const query = useQuery<StorageInfoView>({
    queryKey: ["settings", "storage"],
    queryFn: async () => {
      const r = await fetch("/api/settings/storage");
      if (!r.ok) throw new Error("Storage info yüklenemedi");
      return r.json();
    },
  });

  return (
    <div className="max-w-[680px] px-10 py-9">
      <div className="flex items-start justify-between gap-3">
        <h2 className="k-display text-[26px] font-semibold tracking-[-0.025em] text-ink">
          Storage
        </h2>
        <Badge tone="neutral">READ-ONLY</Badge>
      </div>
      <p className="mt-1 mb-7 text-[13px] text-ink-2">
        Local-first asset storage. Provider configuration is sourced from
        environment variables — provider switch / bucket change UI ships in
        R8.
      </p>

      {query.isLoading ? (
        <div className="flex h-32 items-center gap-2 text-sm text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading storage stats…
        </div>
      ) : query.data ? (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-md border border-line bg-paper">
            <div className="border-b border-line-soft px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              Provider
            </div>
            <div className="grid grid-cols-1 divide-y divide-line-soft md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-meta text-ink-3">
                  KIND
                </div>
                <div className="mt-1 text-[15px] font-semibold tracking-tight text-ink">
                  {query.data.storage.provider.toUpperCase()}
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
                  {query.data.storage.bucket}
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
              value={String(query.data.storage.assetCount)}
            />
            <Stat
              label="TOTAL SIZE"
              value={bytesLabel(query.data.storage.assetBytes)}
            />
            <Stat
              label="MOCKUP RENDERS"
              value={String(query.data.storage.mockupRenderCount)}
            />
          </div>

          <div className="rounded-md border border-dashed border-line bg-k-bg-2/40 px-4 py-3">
            <div className="flex items-start gap-2">
              <Package className="mt-0.5 h-4 w-4 text-ink-3" aria-hidden />
              <p className="text-[12px] leading-relaxed text-ink-2">
                Storage health surface, signed URL TTL tuning, and remote-
                provider switch (R2 / S3) UI ship in R8 alongside scrapers
                configuration.
              </p>
            </div>
          </div>
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
