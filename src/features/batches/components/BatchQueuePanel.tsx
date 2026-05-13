"use client";

/**
 * Phase 45 — Batch Queue Panel.
 *
 * References sayfasının sağında yer alan staging surface. Operatör
 * Pool'dan Add to Draft tıkladığında bu panel'in items listesine
 * yeni referans eklenir; "Open Create Similar (N)" CTA panel'i kapatıp
 * compose page'ine (/batches/[id]/compose) götürür.
 *
 * Tasarım kararları (Phase 45):
 *   - Sticky right side panel (w-80) — Pool grid bozulmaz, browse
 *     context korunur. Sadece operator'ün aktif DRAFT batch'i varsa
 *     görünür; yoksa panel render edilmez (Pool tam genişliği alır).
 *   - Polling: 5s React Query refetchInterval, mutations invalidate
 *     queue key. Pool aksiyonları sonrası queue canlı güncellenir.
 *   - "Create Similar (N)" wording — Midjourney'in "vary subtle/strong"
 *     ile karışan "Variation" dilinden kaçınır; doğru anlam:
 *     "reference'lardan yola çıkarak benzer yeni üretimler".
 *   - Item remove: küçük X button (server side endpoint Phase 45+
 *     candidate; şu an UI yer tutucu — operatör için item'ı yanlış
 *     eklemeden silmek "yeni draft başlat" alternatifiyle çözülebilir).
 *
 * v4 A6 source-reference rail buradaki items listesi ile aynı görsel
 * dile sahip (thumb + title + meta + chip).
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import { AssetImage } from "@/components/ui/asset-image";

type DraftBatchItem = {
  id: string;
  position: number;
  reference: {
    id: string;
    asset: { id: string; sourceUrl: string | null } | null;
    bookmark: { title: string | null } | null;
    productType: { displayName: string } | null;
  };
};

type DraftBatch = {
  id: string;
  label: string | null;
  state: string;
  updatedAt: string;
  items: DraftBatchItem[];
};

export function BatchQueuePanel() {
  const query = useQuery<{ batch: DraftBatch | null }>({
    queryKey: ["batches", "current-draft"],
    queryFn: async () => {
      const res = await fetch("/api/batches/current-draft", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load draft");
      return res.json();
    },
    refetchInterval: 5_000,
  });

  const batch = query.data?.batch;

  if (!batch || batch.items.length === 0) {
    // No active draft → panel hidden. Pool grid stretches full width.
    // Operator's first "Add to Draft" click creates the panel.
    return null;
  }

  const referencesWithoutPublicUrl = batch.items.filter(
    (item) => !item.reference.asset?.sourceUrl,
  ).length;

  return (
    <aside
      className="sticky top-0 flex h-screen w-80 flex-shrink-0 flex-col border-l border-line bg-paper"
      data-testid="batch-queue-panel"
      data-batch-id={batch.id}
    >
      <div className="border-b border-line bg-paper px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13.5px] font-semibold text-ink">
            Draft batch
          </h2>
          <span
            className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3"
            data-testid="batch-queue-count"
          >
            {batch.items.length} reference{batch.items.length === 1 ? "" : "s"}
          </span>
        </div>
        <p
          className="mt-1 truncate font-mono text-[10.5px] tracking-wider text-ink-3"
          title={batch.label ?? ""}
        >
          {batch.label ?? "Untitled batch"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-2" data-testid="batch-queue-items">
          {batch.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-md border border-line-soft bg-paper p-2"
              data-testid="batch-queue-item"
              data-reference-id={item.reference.id}
            >
              <div className="k-thumb !aspect-square !w-12 flex-shrink-0 overflow-hidden rounded-md">
                {item.reference.asset ? (
                  <AssetImage
                    assetId={item.reference.asset.id}
                    alt={item.reference.bookmark?.title ?? "Reference"}
                    frame={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-3">
                    —
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium leading-tight text-ink">
                  {item.reference.bookmark?.title ?? "Untitled"}
                </div>
                {item.reference.productType ? (
                  <div className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-meta text-ink-3">
                    {item.reference.productType.displayName}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Phase 45 — honest warning when references lack public URL.
        * Compose/Launch will reject these on the server side; surface
        * the constraint here so operator can adjust before navigating
        * to the compose page. */}
      {referencesWithoutPublicUrl > 0 ? (
        <div
          className="border-t border-warning/40 bg-warning-soft/40 px-4 py-2 text-[11.5px] text-ink"
          data-testid="batch-queue-warning"
        >
          {referencesWithoutPublicUrl} reference
          {referencesWithoutPublicUrl === 1 ? "" : "s"} without a public URL —
          AI launch needs URL-sourced references.
        </div>
      ) : null}

      <div className="border-t border-line bg-paper px-3 py-3">
        <Link
          href={`/batches/${batch.id}/compose`}
          className="k-btn k-btn--primary w-full"
          data-size="sm"
          data-testid="batch-queue-open-compose"
          title="Open the Create Similar compose page for this draft batch"
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          Create Similar ({batch.items.length})
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </aside>
  );
}
