"use client";

// Phase 6 Task 14 — ReviewQueueList
//
// Aktif tabın scope'una göre /api/review/queue'dan veri çekip ReviewCard
// grid'i render eder. Loading / error / empty state'leri StateMessage
// primitive'i ile sunulur (role="status"/"alert" + aria-live, ekran
// okuyucu desteği için kritik — Phase 5 trend-feed.tsx + competitor-list-
// page.tsx carry-forward).
//
// Error state: raw error.message UI'a yansıtılmaz (PII / iç hata
// detayları kullanıcıya sızmasın). Generic mesaj + öneri.

import { useReviewQueue } from "@/features/review/queries";
import { ReviewCard } from "@/app/(app)/review/_components/ReviewCard";
import { StateMessage } from "@/components/ui/StateMessage";

type Props = { scope: "design" | "local" };

export function ReviewQueueList({ scope }: Props) {
  const { data, isLoading, error } = useReviewQueue({ scope });

  if (isLoading) {
    return <StateMessage tone="neutral" title="Yükleniyor…" />;
  }
  if (error) {
    return (
      <StateMessage
        tone="error"
        title="Yüklenemedi"
        body="Review listesi alınamadı. Sayfayı yenileyin veya birkaç saniye sonra tekrar deneyin."
      />
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <StateMessage
        tone="neutral"
        title={
          scope === "design"
            ? "Henüz review için bekleyen AI tasarımı yok"
            : "Henüz review için bekleyen local asset yok"
        }
        body={
          scope === "design"
            ? "Variations sayfasından üretim başlatın; biten tasarımlar burada görünür."
            : "Local Library'den batch review tetikleyebilirsiniz."
        }
      />
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
