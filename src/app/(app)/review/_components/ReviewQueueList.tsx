"use client";

// Phase 6 Task 14 + Dalga B (Task 16, Ö-6) — ReviewQueueList
//
// Aktif tabın scope'una göre /api/review/queue'dan veri çekip ReviewCard
// grid'i render eder. Loading / error / empty state'leri StateMessage
// primitive'i ile sunulur (role="status"/"alert" + aria-live, ekran
// okuyucu desteği için kritik — Phase 5 trend-feed.tsx + competitor-list-
// page.tsx carry-forward).
//
// Error state: raw error.message UI'a yansıtılmaz (PII / iç hata
// detayları kullanıcıya sızmasın). Generic mesaj + öneri.
//
// Dalga B:
//   - URL ?page=N pagination (Ö-6) — total > pageSize ise altta navigasyon.
//   - Selection store scope sync — tab değişiminde auto-clear.
//   - BulkActionsBar bottom (selectedIds > 0 ise görünür).

import { useEffect, useMemo } from "react";
import {
  useRouter,
  usePathname,
  useSearchParams,
} from "next/navigation";
import { MJReviewDecision } from "@prisma/client";
import { useReviewQueue } from "@/features/review/queries";
import { ReviewCard } from "@/app/(app)/review/_components/ReviewCard";
import {
  ReviewDecisionFilter,
  decisionFromParam,
  type DecisionChipValue,
} from "@/app/(app)/review/_components/ReviewDecisionFilter";
import { BulkActionsBar } from "@/app/(app)/review/_components/BulkActionsBar";
import { StateMessage } from "@/components/ui/StateMessage";
import { buildReviewUrl } from "@/features/review/lib/search-params";
import { useReviewSelection } from "@/features/review/stores/selection-store";
import { toCanonicalDecision } from "@/server/services/review/unified";

type Props = { scope: "design" | "local" };

/** Map a chip value to the canonical decision it filters by (or null = all). */
function decisionFilterTarget(
  chip: DecisionChipValue,
): MJReviewDecision | null {
  switch (chip) {
    case "undecided":
      return MJReviewDecision.UNDECIDED;
    case "kept":
      return MJReviewDecision.KEPT;
    case "rejected":
      return MJReviewDecision.REJECTED;
    case "all":
      return null;
  }
}

export function ReviewQueueList({ scope }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageRaw = searchParams.get("page");
  const pageNum = pageRaw && Number(pageRaw) > 0 ? Number(pageRaw) : 1;
  const decisionChip = decisionFromParam(searchParams.get("decision"));
  const decisionTarget = decisionFilterTarget(decisionChip);

  const { data, isLoading, error } = useReviewQueue({ scope, page: pageNum });

  // Client-side filter — keeps the React Query cache and pagination
  // contract intact. Server-side filtering is a follow-up once we are
  // confident the UX hits the right edge cases.
  const visibleItems = useMemo(() => {
    if (!data) return [];
    if (decisionTarget === null) return data.items;
    return data.items.filter(
      (it) => toCanonicalDecision(it.reviewStatus) === decisionTarget,
    );
  }, [data, decisionTarget]);

  // Selection store scope sync: scope prop değişiminde store'u güncelle
  // (auto-clear). Tab değişiminde URL'den de detail/page sıfırlanır;
  // selection state ayrı katman.
  const setScope = useReviewSelection((s) => s.setScope);
  useEffect(() => {
    setScope(scope);
  }, [scope, setScope]);

  // Selection store page sync: pageNum URL'den geldikçe store'u güncelle.
  // Farklı sayfaya geçişte selectedIds auto-clear olur — BulkApproveDialog
  // skip-on-risk hint'inin pagination boundary edge case'inde (sayfa 1'de
  // seç → sayfa 2'ye geç → cache miss → yanlış riskyCount=0) yanıltıcı
  // davranmasını engeller. Server yine doğru kararı verir.
  const setPage = useReviewSelection((s) => s.setPage);
  useEffect(() => {
    setPage(pageNum);
  }, [pageNum, setPage]);

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

  const totalPages = Math.ceil(data.total / data.pageSize);
  const showPagination = totalPages > 1;

  const goToPage = (next: number) => {
    router.push(
      buildReviewUrl(pathname, searchParams, {
        page: next === 1 ? undefined : String(next),
        // Pagination closes the drawer — the target id may not be in the
        // new page's cache. (canonical key: ?item=)
        item: undefined,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <ReviewDecisionFilter active={decisionChip} />
      {visibleItems.length === 0 ? (
        <StateMessage
          tone="neutral"
          title="Bu filtreye uyan kayıt yok"
          body="Decision filter'i değiştirin veya All ile tümünü görün."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visibleItems.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {showPagination ? (
        <nav
          aria-label="Sayfalama"
          data-testid="review-pagination"
          className="flex items-center justify-center gap-3"
        >
          <button
            type="button"
            disabled={data.page <= 1}
            onClick={() => goToPage(data.page - 1)}
            data-testid="review-pagination-prev"
            className="rounded-md border border-border bg-surface px-3 py-1 text-sm text-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Önceki
          </button>
          <span className="text-sm text-text-muted">
            Sayfa {data.page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={data.page >= totalPages}
            onClick={() => goToPage(data.page + 1)}
            data-testid="review-pagination-next"
            className="rounded-md border border-border bg-surface px-3 py-1 text-sm text-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Sonraki
          </button>
        </nav>
      ) : null}
      <BulkActionsBar scope={scope} />
    </div>
  );
}
