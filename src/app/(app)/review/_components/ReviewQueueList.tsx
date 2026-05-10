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
// IA Phase 4: server-side decision filter
//   - chip URL `?decision=` üzerinden okunur, hook'a canonical decision
//     parametresi olarak geçer; hook bunu server'ın anladığı
//     `?status=ReviewStatus`'a map eder (queries.ts → decisionToStatus).
//   - Bu sayede pagination (total + page count) gerçek filtrelenmiş
//     veri üzerinden hesaplanır; eski client-side filter pagination'ı
//     kirletiyordu.

import { useEffect } from "react";
import {
  useRouter,
  usePathname,
  useSearchParams,
} from "next/navigation";
import { useReviewQueue } from "@/features/review/queries";
import { ReviewCard } from "@/app/(app)/review/_components/ReviewCard";
import { decisionFromParam } from "@/app/(app)/review/_components/ReviewDecisionFilter";
import { ReviewQueueToolbar } from "@/app/(app)/review/_components/ReviewQueueToolbar";
import { BulkActionsBar } from "@/app/(app)/review/_components/BulkActionsBar";
import { StateMessage } from "@/components/ui/StateMessage";
import { buildReviewUrl } from "@/features/review/lib/search-params";
import { useReviewSelection } from "@/features/review/stores/selection-store";

type Props = { scope: "design" | "local" };

export function ReviewQueueList({ scope }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageRaw = searchParams.get("page");
  const pageNum = pageRaw && Number(pageRaw) > 0 ? Number(pageRaw) : 1;
  const decisionChip = decisionFromParam(searchParams.get("decision"));
  // chip "all" ⇒ undefined ⇒ server tüm decision'ları döner.
  const decisionParam = decisionChip === "all" ? undefined : decisionChip;
  // IA Phase 15 — server-side search.
  const queryRaw = searchParams.get("q") ?? "";

  const { data, isLoading, error } = useReviewQueue({
    scope,
    decision: decisionParam,
    page: pageNum,
    q: queryRaw,
  });

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
    return (
      <div className="flex flex-col gap-4">
        <ReviewQueueToolbar
          source={scope === "design" ? "ai" : "local"}
          decision={decisionChip}
          initialQuery={searchParams.get("q") ?? ""}
        />
        <StateMessage tone="neutral" title="Loading…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <ReviewQueueToolbar
          source={scope === "design" ? "ai" : "local"}
          decision={decisionChip}
          initialQuery={searchParams.get("q") ?? ""}
        />
        <StateMessage
          tone="error"
          title="Couldn't load review queue"
          body="Refresh the page or try again in a few seconds."
        />
      </div>
    );
  }
  if (!data || data.items.length === 0) {
    // Decision filter aktif ve sonuç boşsa filter-aware mesaj göster;
    // aksi halde scope-spesifik "henüz review yok" mesajı.
    const filterActive = decisionParam !== undefined;
    return (
      <div className="flex flex-col gap-4">
        <ReviewQueueToolbar
          source={scope === "design" ? "ai" : "local"}
          decision={decisionChip}
          initialQuery={searchParams.get("q") ?? ""}
        />
        {filterActive ? (
          <StateMessage
            tone="neutral"
            title="No items match this filter"
            body="Change the decision filter or click All to see everything."
          />
        ) : (
          <StateMessage
            tone="neutral"
            title={
              scope === "design"
                ? "No AI designs pending review"
                : "No local assets pending review"
            }
            body={
              scope === "design"
                ? "Start generation from References → Variations; finished designs land here."
                : "Trigger a batch review from Local Library."
            }
          />
        )}
      </div>
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
      <ReviewQueueToolbar
        source={scope === "design" ? "ai" : "local"}
        decision={decisionChip}
        initialQuery={searchParams.get("q") ?? ""}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {data.items.map((item) => (
          <ReviewCard key={item.id} item={item} />
        ))}
      </div>
      {showPagination ? (
        <nav
          aria-label="Pagination"
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
            Previous
          </button>
          <span className="text-sm text-text-muted">
            Page {data.page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={data.page >= totalPages}
            onClick={() => goToPage(data.page + 1)}
            data-testid="review-pagination-next"
            className="rounded-md border border-border bg-surface px-3 py-1 text-sm text-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Next
          </button>
        </nav>
      ) : null}
      <BulkActionsBar scope={scope} />
    </div>
  );
}
