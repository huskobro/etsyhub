"use client";

import { useState } from "react";
import type { WindowDays } from "@/features/trend-stories/constants";
import { WindowTabs } from "./window-tabs";
import { TrendClusterRail } from "./trend-cluster-rail";
import { TrendFeed } from "./trend-feed";
import { TrendClusterDrawer } from "./trend-cluster-drawer";

type ToastState = { kind: "success" | "error"; message: string } | null;

/**
 * Trend Stories kullanıcı sayfasının kökü.
 *
 * - Pencere seçimi (`windowDays`) state'i rail + feed'e iletir.
 * - Drawer, hem cluster rail kartından hem de feed membership badge'inden
 *   açılabilir (tek kaynak `openClusterId`).
 * - Bookmark mutation toast'u feed'den buraya bubble eder.
 */
export function TrendStoriesPage() {
  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-text">Trend Akışı</h1>
        <p className="text-sm text-text-muted">
          Rakip mağazalardaki yeni listing&apos;leri pencere bazında izle,
          kümelenmiş trendleri gör ve beğendiklerini Bookmark Inbox&apos;a at.
        </p>
      </div>

      <WindowTabs value={windowDays} onChange={setWindowDays} />

      {toast ? (
        <div
          role="status"
          className={
            toast.kind === "success"
              ? "rounded-md border border-border bg-success/10 px-3 py-2 text-xs text-success"
              : "rounded-md border border-border bg-danger/10 px-3 py-2 text-xs text-danger"
          }
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Kapat
          </button>
        </div>
      ) : null}

      <TrendClusterRail
        windowDays={windowDays}
        onOpenCluster={(id) => setOpenClusterId(id)}
      />

      <TrendFeed
        key={`feed-${windowDays}`}
        windowDays={windowDays}
        onOpenCluster={(id) => setOpenClusterId(id)}
        onToast={setToast}
      />

      {openClusterId ? (
        <TrendClusterDrawer
          clusterId={openClusterId}
          onClose={() => setOpenClusterId(null)}
        />
      ) : null}
    </div>
  );
}
