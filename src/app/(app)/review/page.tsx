// Phase 6 Task 13 + Dalga B (Task 15) — /review sayfası shell.
//
// Server component: searchParams.tab ile aktif sekmeyi, searchParams.detail
// ile drawer'ı render eder.
//
// Karar 6: default tab "ai" — geçersiz değer geldiğinde de "ai" fallback.
// Karar 7: detay panel URL state ?detail=<cuid>. Drawer scope'u aktif tab'a
// bağlı (ai → design, local → local). Tab değişiminde detail temizlenir
// (helper'da otomatik).
//
// Next.js 14.2 paterni: searchParams direkt obje (Promise değil).

import { ReviewTabs } from "@/app/(app)/review/_components/ReviewTabs";
import { ReviewDetailPanel } from "@/app/(app)/review/_components/ReviewDetailPanel";

export const metadata = { title: "Review — EtsyHub" };

type SearchParams = { tab?: string; detail?: string; page?: string };

export default function ReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const activeTab = searchParams.tab === "local" ? "local" : "ai";
  const detailId = searchParams.detail;
  const detailScope = activeTab === "ai" ? "design" : "local";

  return (
    <div className="flex h-full flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-text">Review</h1>
        <p className="mt-1 text-sm text-text-muted">
          AI tasarımları otomatik review&apos;dan geçer; local library asset&apos;leri manuel batch ile review edilir.
        </p>
      </header>
      <ReviewTabs activeTab={activeTab} />
      {detailId ? (
        <ReviewDetailPanel id={detailId} scope={detailScope} />
      ) : null}
    </div>
  );
}
