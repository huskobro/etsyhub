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
  it("4 ReviewStatus için doğru badge label", () => {
    const statuses: Array<{
      status: ReviewQueueItem["reviewStatus"];
      label: string;
    }> = [
      { status: "PENDING", label: "Beklemede" },
      { status: "APPROVED", label: "Onaylandı" },
      { status: "NEEDS_REVIEW", label: "İnceleme" },
      { status: "REJECTED", label: "Reddedildi" },
    ];
    for (const { status, label } of statuses) {
      const { unmount } = renderCard({ ...baseItem, reviewStatus: status });
      expect(screen.getByTestId("status-badge")).toHaveTextContent(label);
      unmount();
    }
  });

  it("USER source => Kullanıcı rozeti görünür", () => {
    renderCard({ ...baseItem, reviewStatusSource: "USER" });
    expect(screen.getByTestId("user-badge")).toBeInTheDocument();
  });

  it("SYSTEM source => Kullanıcı rozeti görünmüyor", () => {
    renderCard({ ...baseItem, reviewStatusSource: "SYSTEM" });
    expect(screen.queryByTestId("user-badge")).toBeNull();
  });

  it("score chip score değerini gösteriyor", () => {
    renderCard({ ...baseItem, reviewScore: 87 });
    expect(screen.getByTestId("score-chip")).toHaveTextContent("87");
  });

  it("score null => chip görünmüyor", () => {
    renderCard({ ...baseItem, reviewScore: null });
    expect(screen.queryByTestId("score-chip")).toBeNull();
  });

  it("riskFlagCount > 0 => risk işaretleri satırı görünür", () => {
    renderCard({ ...baseItem, riskFlagCount: 2 });
    expect(screen.getByTestId("risk-flags")).toHaveTextContent(
      "2 risk işareti",
    );
  });

  it("riskFlagCount === 0 => risk satırı gizli", () => {
    renderCard({ ...baseItem, riskFlagCount: 0 });
    expect(screen.queryByTestId("risk-flags")).toBeNull();
  });

  it("thumbnailUrl null => 'Önizleme yok' fallback", () => {
    renderCard({ ...baseItem, thumbnailUrl: null });
    expect(screen.getByText(/Önizleme yok/)).toBeInTheDocument();
  });

  // a11y — Ö-4: thumbnail informative alt metin (decorative değil).
  it("img alt='Tasarım önizlemesi' (a11y)", () => {
    renderCard(baseItem);
    expect(screen.getByAltText("Tasarım önizlemesi")).toBeInTheDocument();
  });

  // a11y — Ö-4: score chip semantik etiket.
  it("score chip aria-label='Kalite skoru: X' (a11y)", () => {
    renderCard({ ...baseItem, reviewScore: 87 });
    expect(screen.getByLabelText("Kalite skoru: 87")).toBeInTheDocument();
  });
});
