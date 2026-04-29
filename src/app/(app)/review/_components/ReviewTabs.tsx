"use client";

// Phase 6 Task 13 — ReviewTabs (AI tasarımları / Local Library)
//
// Tab geçişini URL ?tab=ai|local üzerinden yönetir; default "ai".
// Server component (page.tsx) hangi tabın aktif olduğunu searchParams'tan
// hesaplar ve activeTab prop'u ile yollar. Burada client tarafında sadece
// router.push ile URL güncellenir — Next.js Server Components yeniden
// render yapacak.
//
// WAI-ARIA tablist (Phase 5 carry-forward — competitor-detail-page.tsx +
// window-tabs.tsx paterni):
//   - role="tablist" / role="tab" / role="tabpanel"
//   - Roving tabIndex (active=0, inactive=-1)
//   - aria-controls + tabpanel id eşleştirmesi
//   - ArrowLeft/ArrowRight (wrap), Home/End klavye gezinmesi
//   - focus-visible:ring-2 ring-accent (klavye fokusu görünür, WCAG 2.4.7)
// WCAG 2.1.1 Keyboard ve 4.1.2 Name/Role/Value uyumluluğu.

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import { ReviewQueueList } from "@/app/(app)/review/_components/ReviewQueueList";
import { buildReviewUrl } from "@/features/review/lib/search-params";

type TabValue = "ai" | "local";
type Props = { activeTab: TabValue };

const TABS: { value: TabValue; label: string }[] = [
  { value: "ai", label: "AI Tasarımları" },
  { value: "local", label: "Local Library" },
];

const TABPANEL_ID = "review-tabpanel";
const tabId = (value: TabValue) => `review-tab-${value}`;

export function ReviewTabs({ activeTab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabRefs = useRef<Map<TabValue, HTMLButtonElement | null>>(new Map());

  // Ö-3: Tab değişimi mevcut diğer query param'ları korumalı; ancak page ve
  // detail tab-specific olduğu için sıfırlanır (yeni tab'da o page/detail
  // anlamsız).
  const switchTab = (tab: TabValue) => {
    router.push(
      buildReviewUrl(pathname, searchParams, {
        tab,
        page: undefined,
        detail: undefined,
      }),
    );
  };

  // Klavye gezinmesi (WAI-ARIA tablist paterni — wrap'li):
  // ArrowLeft/Right wrap, Home ilk, End son. Active tab değişince navigate
  // edip yeni tab butonuna fokus aktarıyoruz; rAF Server Components yeniden
  // render fırsatı bulduktan sonra fokus verir.
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = TABS.findIndex((t) => t.value === activeTab);
    let nextIndex: number | null = null;
    switch (e.key) {
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        break;
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % TABS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = TABS.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const nextTab = TABS[nextIndex]!.value;
    switchTab(nextTab);
    requestAnimationFrame(() => {
      tabRefs.current.get(nextTab)?.focus();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Review queue tabs"
        className="flex gap-2 border-b border-border"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                tabRefs.current.set(tab.value, el);
              }}
              type="button"
              role="tab"
              id={tabId(tab.value)}
              aria-selected={isActive}
              aria-controls={TABPANEL_ID}
              tabIndex={isActive ? 0 : -1}
              onClick={() => switchTab(tab.value)}
              onKeyDown={handleKeyDown}
              className={
                isActive
                  ? "border-b-2 border-accent px-4 py-2 text-sm font-medium text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  : "px-4 py-2 text-sm font-medium text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id={TABPANEL_ID}
        role="tabpanel"
        aria-labelledby={tabId(activeTab)}
      >
        <ReviewQueueList scope={activeTab === "ai" ? "design" : "local"} />
      </div>
    </div>
  );
}
