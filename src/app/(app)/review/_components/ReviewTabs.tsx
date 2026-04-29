"use client";

// Phase 6 Task 13 — ReviewTabs (AI tasarımları / Local Library)
//
// Tab geçişini URL ?tab=ai|local üzerinden yönetir; default "ai".
// Server component (page.tsx) hangi tabın aktif olduğunu searchParams'tan
// hesaplar ve activeTab prop'u ile yollar. Burada client tarafında sadece
// router.push ile URL güncellenir — Next.js Server Components yeniden
// render yapacak.

import { useRouter, usePathname } from "next/navigation";
import { ReviewQueueList } from "@/app/(app)/review/_components/ReviewQueueList";

type Props = { activeTab: "ai" | "local" };

export function ReviewTabs({ activeTab }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const switchTab = (tab: "ai" | "local") => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Review queue tabs"
        className="flex gap-2 border-b border-border"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "ai"}
          onClick={() => switchTab("ai")}
          className={
            activeTab === "ai"
              ? "border-b-2 border-accent px-4 py-2 text-sm font-medium text-text"
              : "px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
          }
        >
          AI Tasarımları
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "local"}
          onClick={() => switchTab("local")}
          className={
            activeTab === "local"
              ? "border-b-2 border-accent px-4 py-2 text-sm font-medium text-text"
              : "px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
          }
        >
          Local Library
        </button>
      </div>
      <div role="tabpanel">
        <ReviewQueueList scope={activeTab === "ai" ? "design" : "local"} />
      </div>
    </div>
  );
}
