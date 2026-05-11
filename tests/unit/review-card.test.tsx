// Phase 6 Task 14 — ReviewCard UI testleri.
//
// Sözleşme:
//   - 4 ReviewStatus (PENDING/APPROVED/NEEDS_REVIEW/REJECTED) badge label.
//   - reviewStatusSource === "USER" => "Kullanıcı" rozeti görünür (sticky kontrat).
//   - reviewScore null => score chip gizli.
//   - riskFlagCount === 0 => risk satırı gizli.
//   - thumbnailUrl null => "Önizleme yok" fallback metni görünür.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Phase 6 Dalga B: ReviewCard artık useRouter / useSearchParams kullanıyor
// (kart click → drawer URL'e ?detail=cuid yazar). next/navigation mock'u
// olmadan invariant hatası alır.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/review",
  useSearchParams: () => new URLSearchParams(""),
}));

// ReviewCard `renderCard` helper içinde kullanılıyor.
import { ReviewCard } from "@/app/(app)/review/_components/ReviewCard";
import type { ReviewQueueItem } from "@/features/review/queries";

// Phase 7 Task 38: ReviewCard useMutation kullanıyor (Quick start CTA);
// QueryClientProvider olmadan render hata verir. Bu suite Quick start
// davranışını test etmiyor — yalnız wrapper sağlar.
function renderCard(item: ReviewQueueItem) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ReviewCard item={item} />
    </QueryClientProvider>,
  );
}


const baseItem: ReviewQueueItem = {
  id: "test-id",
  thumbnailUrl: "https://example.com/thumb.png",
  reviewStatus: "APPROVED",
  reviewStatusSource: "SYSTEM",
  reviewScore: 95,
  reviewSummary: null,
  riskFlagCount: 0,
  riskFlags: [],
  reviewedAt: "2026-04-29T00:00:00Z",
  reviewProviderSnapshot: null,
  reviewSuggestedStatus: null,
  reviewProviderRawScore: null,
  // Phase 7 Task 38 alanları — bu suite Quick start davranışı test etmiyor;
  // null vererek baseline render testlerinde CTA gizli kalır.
  referenceId: null,
  productTypeId: null,
  jobId: null,
};

describe("ReviewCard", () => {
  it("IA-29 operator decision: source-aware badge labels", () => {
    // IA-29 sözleşmesi: kept/rejected SADECE USER source iken; SYSTEM
    // source veya PENDING → "Undecided".
    const cases: Array<{
      status: ReviewQueueItem["reviewStatus"];
      source: ReviewQueueItem["reviewStatusSource"];
      label: string;
    }> = [
      { status: "PENDING", source: "SYSTEM", label: "Undecided" },
      { status: "APPROVED", source: "SYSTEM", label: "Undecided" }, // advisory, not operator
      { status: "APPROVED", source: "USER", label: "Kept" },
      { status: "REJECTED", source: "USER", label: "Rejected" },
      { status: "NEEDS_REVIEW", source: "SYSTEM", label: "Undecided" },
    ];
    for (const { status, source, label } of cases) {
      const { unmount } = renderCard({
        ...baseItem,
        reviewStatus: status,
        reviewStatusSource: source,
      });
      expect(screen.getByTestId("status-badge")).toHaveTextContent(label);
      unmount();
    }
  });

  it("score chip — score değerini ve tone'u gösteriyor", () => {
    renderCard({ ...baseItem, reviewScore: 87 });
    const chip = screen.getByTestId("score-chip");
    expect(chip).toHaveTextContent("87");
    // 87 — risk yok, threshold 60/90 → warning
    expect(chip).toHaveAttribute("data-tone", "warning");
  });

  it("score 95 + risk yok => success tone", () => {
    renderCard({ ...baseItem, reviewScore: 95, riskFlagCount: 0 });
    expect(screen.getByTestId("score-chip")).toHaveAttribute("data-tone", "success");
  });

  it("score yüksek ama risk flag varsa destructive tone", () => {
    renderCard({ ...baseItem, reviewScore: 95, riskFlagCount: 1 });
    expect(screen.getByTestId("score-chip")).toHaveAttribute("data-tone", "destructive");
  });

  it("score null => chip görünmüyor", () => {
    renderCard({ ...baseItem, reviewScore: null });
    expect(screen.queryByTestId("score-chip")).toBeNull();
  });

  it("riskFlagCount > 0 => risk işaretleri satırı görünür", () => {
    renderCard({ ...baseItem, riskFlagCount: 2 });
    expect(screen.getByTestId("risk-flags")).toBeInTheDocument();
  });

  it("riskFlagCount === 0 => risk satırı gizli", () => {
    renderCard({ ...baseItem, riskFlagCount: 0 });
    expect(screen.queryByTestId("risk-flags")).toBeNull();
  });

  it("thumbnailUrl null => 'No preview' fallback", () => {
    renderCard({ ...baseItem, thumbnailUrl: null });
    expect(screen.getByText(/No preview/)).toBeInTheDocument();
  });

  // a11y — thumbnail informative alt text (decorative değil).
  it("img alt='Design preview' (a11y)", () => {
    renderCard(baseItem);
    expect(screen.getByAltText("Design preview")).toBeInTheDocument();
  });

  // a11y — score chip semantic label (AI suggestion, not final decision).
  it("score chip aria-label vurgular AI suggestion (a11y)", () => {
    renderCard({ ...baseItem, reviewScore: 87 });
    expect(screen.getByLabelText("AI suggestion score: 87")).toBeInTheDocument();
  });
});
