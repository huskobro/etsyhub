"use client";

// Phase 6 Task 14 — ReviewQueueList
//
// Aktif tabın scope'una göre /api/review/queue'dan veri çekip ReviewCard
// grid'i render eder. Loading / error / empty state ayrı StateMessage gibi
// minimal placeholder ile sunulur.

import { useReviewQueue } from "@/features/review/queries";
import { ReviewCard } from "@/app/(app)/review/_components/ReviewCard";

type Props = { scope: "design" | "local" };

export function ReviewQueueList({ scope }: Props) {
  const { data, isLoading, error } = useReviewQueue({ scope });

  if (isLoading) {
    return (
      <div className="text-sm text-text-muted">Yükleniyor...</div>
    );
  }
  if (error) {
    return (
      <div className="text-sm text-danger">
        Hata: {(error as Error).message}
      </div>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-text-muted">
        {scope === "design"
          ? "Henüz review için bekleyen AI tasarımı yok."
          : "Henüz review için bekleyen local asset yok. Local Library'den batch tetikleyebilirsiniz."}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {data.items.map((item) => (
        <ReviewCard key={item.id} item={item} />
      ))}
    </div>
  );
}
