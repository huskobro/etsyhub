"use client";

import { useId, useMemo, useState } from "react";
import { WINDOW_DAYS, type WindowDays } from "@/features/trend-stories/constants";
import { WindowTabs } from "./window-tabs";
import { TrendClusterRail } from "./trend-cluster-rail";
import { TrendFeed } from "./trend-feed";
import { TrendClusterDrawer } from "./trend-cluster-drawer";
import { PageShell } from "@/components/ui/PageShell";
import { Toast } from "@/components/ui/Toast";

type ToastState = { kind: "success" | "error"; message: string } | null;

/**
 * Trend Stories kullanıcı sayfasının kökü.
 *
 * T-36 spec — docs/design/implementation-notes/trend-stories-screens.md
 * - PageShell variant=default tüketildi: title="Trend Akışı" + subtitle.
 *   actions slot boş; toolbar slot WindowTabs.
 * - WindowTabs: tabIds + panelIds prop'ları ile aria-controls + aria-labelledby
 *   bağı kurulur. Rail + feed birlikte tek `role="tabpanel"` içine alınır
 *   (T-35 doc: "rail + feed birlikte panel içeriği oluşturur").
 * - Drawer hem cluster rail kartından hem de feed membership badge'inden
 *   açılabilir (tek kaynak `openClusterId`).
 *
 * T-38: Toast primitive terfisi tamamlandı — T-36'da kısmen kurulan
 * aria-live ton ayrımı (success/info → role=status + polite; error →
 * role=alert + assertive) primitive içine kilitlendi.
 */
export function TrendStoriesPage() {
  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Tab/panel id'leri: aria-controls ↔ aria-labelledby bağı için stabil.
  const tabIdBase = useId();
  const { tabIds, panelIds } = useMemo(() => {
    const tabIdsMap = {} as Record<WindowDays, string>;
    const panelIdsMap = {} as Record<WindowDays, string>;
    for (const w of WINDOW_DAYS) {
      tabIdsMap[w] = `${tabIdBase}-tab-${w}`;
      panelIdsMap[w] = `${tabIdBase}-panel-${w}`;
    }
    return { tabIds: tabIdsMap, panelIds: panelIdsMap };
  }, [tabIdBase]);

  const activeTabId = tabIds[windowDays];
  const activePanelId = panelIds[windowDays];

  const subtitle = (
    <span>
      Rakip mağazalardaki yeni listing&apos;leri pencere bazında izle,
      kümelenmiş trendleri gör ve beğendiklerini Bookmark Inbox&apos;a at.
    </span>
  );

  return (
    <PageShell
      title="Trend Akışı"
      subtitle={subtitle}
      toolbar={
        <WindowTabs
          value={windowDays}
          onChange={setWindowDays}
          tabIds={tabIds}
          panelIds={panelIds}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {/* T-38: Toast primitive tüketildi. aria-live ton ayrımı primitive
            içinde sabit; Kapat trigger'ı dış wrapper'da kalır. */}
        {toast ? (
          <div className="flex items-start gap-2">
            <Toast
              tone={toast.kind === "success" ? "success" : "error"}
              message={toast.message}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Kapat
            </button>
          </div>
        ) : null}

        <div
          role="tabpanel"
          id={activePanelId}
          aria-labelledby={activeTabId}
          tabIndex={0}
          className="flex flex-col gap-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
        >
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
        </div>

        {openClusterId ? (
          <TrendClusterDrawer
            clusterId={openClusterId}
            onClose={() => setOpenClusterId(null)}
          />
        ) : null}
      </div>
    </PageShell>
  );
}
