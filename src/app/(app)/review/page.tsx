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

export const metadata = { title: "Review · Kivasy" };

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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          {/* Pass 25 — workspace label clarity. Review = decision
              workspace (üretim değil, kullanıcının onay/red kararı
              verdiği yer). References/Variations = production
              workspace. İki yüzeyin görev farkı subtitle ile net. */}
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-text">Review</h1>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
              Karar Atölyesi
            </span>
          </div>
          <p className="text-sm text-text-muted">
            Üretilen ve taranan görseller hakkında onay/red kararı verin.
            Üretim için <strong>Referanslar &rsaquo; bir referans &rsaquo; Üret</strong>{" "}
            yolunu kullanın.
          </p>
        </div>
      </header>
      <ReviewTabs activeTab={activeTab} />
      {detailId ? (
        <ReviewDetailPanel id={detailId} scope={detailScope} />
      ) : null}
    </div>
  );
}
