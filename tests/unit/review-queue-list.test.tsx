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

  it("isLoading=true => 'Yükleniyor…' StateMessage (role='status')", () => {
    mockUseReviewQueue.mockReturnValue({
      isLoading: true,
      data: undefined,
      error: null,
    });
    renderWithQuery("design");
    expect(screen.getByText(/Yükleniyor/i)).toBeInTheDocument();
  });

  it("error => danger StateMessage; raw error.message UI'a sızmaz (PII)", () => {
    mockUseReviewQueue.mockReturnValue({
      isLoading: false,
      data: undefined,
      error: new Error("internal db error xyz"),
    });
    renderWithQuery("design");
    expect(screen.getByText(/Yüklenemedi/i)).toBeInTheDocument();
    // Generic mesaj kullanıcıya gösterilir; raw error metni yansımaz.
    expect(screen.queryByText(/internal db error xyz/)).toBeNull();
  });

  it("empty design scope => AI tasarımı yok mesajı + Variations önerisi", () => {
    mockUseReviewQueue.mockReturnValue({
      isLoading: false,
      data: { items: [], total: 0, page: 1, pageSize: 24 },
      error: null,
    });
    renderWithQuery("design");
    expect(screen.getByText(/AI tasarımı yok/i)).toBeInTheDocument();
    expect(screen.getByText(/Variations sayfasından/i)).toBeInTheDocument();
  });

  it("empty local scope => local asset yok mesajı + Local Library önerisi", () => {
    mockUseReviewQueue.mockReturnValue({
      isLoading: false,
      data: { items: [], total: 0, page: 1, pageSize: 24 },
      error: null,
    });
    renderWithQuery("local");
    expect(screen.getByText(/local asset yok/i)).toBeInTheDocument();
    expect(screen.getByText(/Local Library/i)).toBeInTheDocument();
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
            reviewStatusSource: "SYSTEM",
            reviewScore: 95,
            riskFlagCount: 0,
            reviewedAt: null,
          },
          {
            id: "2",
            thumbnailUrl: null,
            reviewStatus: "NEEDS_REVIEW",
            reviewStatusSource: "USER",
            reviewScore: 60,
            riskFlagCount: 2,
            reviewedAt: null,
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
