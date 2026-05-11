// Phase 6 Dalga A polish — ReviewQueueList UI testleri (Ö-5).
//
// ReviewTabs testleri ReviewQueueList'i mock'luyor; gerçek
// loading/error/empty/success davranışı burada doğrulanır.
//
// Önemli kontratlar:
//   - Loading => StateMessage "Yükleniyor…" + role="status".
//   - Error => StateMessage error tone + raw error.message UI'a sızmaz (PII).
//   - Empty => scope'a göre farklı action mesajı.
//   - Success => her item için ReviewCard render olur.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Phase 6 Dalga B: ReviewQueueList artık pagination URL state için
// useRouter/useSearchParams kullanıyor + ReviewCard içeriyor (BulkActionsBar
// da). Bu yüzden next/navigation mock'u zorunlu.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/review",
  useSearchParams: () => new URLSearchParams(""),
}));

const mockUseReviewQueue = vi.fn();
vi.mock("@/features/review/queries", () => ({
  useReviewQueue: (params: { scope: "design" | "local" }) =>
    mockUseReviewQueue(params),
}));

import { ReviewQueueList } from "@/app/(app)/review/_components/ReviewQueueList";

function renderWithQuery(scope: "design" | "local") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ReviewQueueList scope={scope} />
    </QueryClientProvider>,
  );
}

describe("ReviewQueueList", () => {
  beforeEach(() => mockUseReviewQueue.mockReset());

  it("isLoading=true => 'Loading…' StateMessage", () => {
    mockUseReviewQueue.mockReturnValue({
      isLoading: true,
      data: undefined,
      error: null,
    });
    renderWithQuery("design");
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("error => generic StateMessage; raw error.message UI'a sızmaz (PII)", () => {
    mockUseReviewQueue.mockReturnValue({
      isLoading: false,
      data: undefined,
      error: new Error("internal db error xyz"),
    });
    renderWithQuery("design");
    expect(screen.getByText(/Couldn't load review queue/i)).toBeInTheDocument();
    // Generic mesaj kullanıcıya gösterilir; raw error metni yansımaz.
    expect(screen.queryByText(/internal db error xyz/)).toBeNull();
  });

  it("empty design scope => 'No AI designs pending review' empty state", () => {
    mockUseReviewQueue.mockReturnValue({
      isLoading: false,
      data: { items: [], total: 0, page: 1, pageSize: 24 },
      error: null,
    });
    renderWithQuery("design");
    expect(screen.getByText(/No AI designs pending review/i)).toBeInTheDocument();
  });

  it("empty local scope => 'No local assets pending review' empty state", () => {
    mockUseReviewQueue.mockReturnValue({
      isLoading: false,
      data: { items: [], total: 0, page: 1, pageSize: 24 },
      error: null,
    });
    renderWithQuery("local");
    expect(screen.getByText(/No local assets pending review/i)).toBeInTheDocument();
  });

  it("data 2 item => 2 ReviewCard render", () => {
    mockUseReviewQueue.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "1",
            thumbnailUrl: "https://example.com/1.png",
            reviewStatus: "APPROVED",
            reviewStatusSource: "USER",
            reviewScore: 95,
            reviewSummary: null,
            riskFlagCount: 0,
            riskFlags: [],
            reviewedAt: null,
            reviewProviderSnapshot: null,
            reviewSuggestedStatus: null,
            reviewProviderRawScore: null,
            referenceId: null,
            productTypeId: null,
            jobId: null,
          },
          {
            id: "2",
            thumbnailUrl: null,
            reviewStatus: "PENDING",
            reviewStatusSource: "SYSTEM",
            reviewScore: 60,
            reviewSummary: null,
            riskFlagCount: 2,
            riskFlags: [],
            reviewedAt: null,
            reviewProviderSnapshot: null,
            reviewSuggestedStatus: "NEEDS_REVIEW" as const,
            reviewProviderRawScore: null,
            referenceId: null,
            productTypeId: null,
            jobId: null,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 24,
      },
      error: null,
    });
    renderWithQuery("design");
    expect(screen.getAllByTestId("review-card")).toHaveLength(2);
  });
});
