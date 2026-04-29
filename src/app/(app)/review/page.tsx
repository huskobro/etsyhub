// Phase 6 Task 13 — /review sayfası shell + tab tetiklemesi.
//
// Server component: searchParams.tab ile aktif sekmeyi hesaplar
// ("ai" default) ve client tarafındaki ReviewTabs'a iletir.
//
// Karar 6: default tab "ai" — geçersiz değer geldiğinde de "ai" fallback.
//
// Next.js 14.2 paterni: searchParams direkt obje (Promise değil).

import { ReviewTabs } from "@/app/(app)/review/_components/ReviewTabs";

export const metadata = { title: "Review — EtsyHub" };

type SearchParams = { tab?: string };

export default function ReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const activeTab = searchParams.tab === "local" ? "local" : "ai";

  return (
    <div className="flex h-full flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-text">Review</h1>
        <p className="mt-1 text-sm text-text-muted">
          AI tasarımları otomatik review&apos;dan geçer; local library asset&apos;leri manuel batch ile review edilir.
        </p>
      </header>
      <ReviewTabs activeTab={activeTab} />
    </div>
  );
}
