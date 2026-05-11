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
  fullResolutionUrl: "https://example.com/thumb.png",
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
  // IA-37 — risk indicator applicability-aware buildEvaluation
  // çıktısına yaslı. composeContext kurabilmek için source.productTypeKey
  // gerekli; aksi halde compose çalışmaz ve risk indicator gizli kalır.
  source: {
    kind: "design",
    productTypeKey: "wall_art",
    referenceShortId: null,
    batchId: null,
    batchShortId: null,
    createdAt: "2026-04-29T00:00:00Z",
    mimeType: "image/png",
    fileSize: 1024,
    width: 1024,
    height: 1024,
    hasAlpha: false,
  },
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

  // IA-31 — score chip tone'u threshold-aware ve 5 kademe (critical/poor/
  // warning/caution/success/neutral). Risk indicator AYRI badge; score
  // rengini EZMEZ. Default thresholds 60/90 — midpoint 75, halfLow 30.

  it("score 87 → caution (band içi, midpoint=75 üstü)", () => {
    renderCard({ ...baseItem, reviewScore: 87 });
    const chip = screen.getByTestId("score-chip");
    expect(chip).toHaveTextContent("87");
    expect(chip).toHaveAttribute("data-tone", "caution");
  });

  it("score 65 → warning (band içi, midpoint=75 altı)", () => {
    renderCard({ ...baseItem, reviewScore: 65 });
    expect(screen.getByTestId("score-chip")).toHaveAttribute("data-tone", "warning");
  });

  it("score 45 → poor (band altı, halfLow=30 üstü)", () => {
    renderCard({ ...baseItem, reviewScore: 45 });
    expect(screen.getByTestId("score-chip")).toHaveAttribute("data-tone", "poor");
  });

  it("score 5 → critical (band altı, halfLow=30 altı)", () => {
    renderCard({ ...baseItem, reviewScore: 5 });
    expect(screen.getByTestId("score-chip")).toHaveAttribute("data-tone", "critical");
  });

  it("score 95 → success (high üstü)", () => {
    renderCard({ ...baseItem, reviewScore: 95, riskFlagCount: 0 });
    expect(screen.getByTestId("score-chip")).toHaveAttribute("data-tone", "success");
  });

  it("score yüksek + risk flag → score chip success kalır (risk ayrı badge)", () => {
    // IA-37 — risk indicator artık applicability-aware buildEvaluation
    // çıktısından hesaplanır; fixture gerçek riskFlags array entries
    // ile gelir. Eski "yalnız riskFlagCount" davranışı kaldırıldı.
    renderCard({
      ...baseItem,
      reviewScore: 95,
      riskFlagCount: 1,
      riskFlags: [{ kind: "text_detected", severity: "warning" }] as never,
    });
    // IA-31 sözleşmesi: risk score rengini EZMEZ.
    expect(screen.getByTestId("score-chip")).toHaveAttribute("data-tone", "success");
    // Risk indicator AYRI badge olarak görünür.
    expect(screen.getByTestId("risk-indicator")).toBeInTheDocument();
  });

  it("score null => chip görünmüyor", () => {
    renderCard({ ...baseItem, reviewScore: null });
    expect(screen.queryByTestId("score-chip")).toBeNull();
  });

  // IA-31 + IA-37 — risk indicator: ayrı badge, score chip rengini
  // ezmez. Yeni sözleşme: indicator applicability-aware buildEvaluation
  // failed check sayımından beslenir. Fixture gerçek riskFlags entries
  // taşımalı.
  it("riskFlags > 0 (blocker yok) => warning tone risk indicator", () => {
    // IA-37: severity criteria katalogundan resolve edilir; warning-only
    // bir set kullanmak için `text_detected` seçildi (criteria.ts'de
    // severity=warning). watermark_detected = blocker olduğu için
    // bu test'te kullanılmaz.
    renderCard({
      ...baseItem,
      riskFlagCount: 1,
      riskFlags: [
        { kind: "text_detected", severity: "warning" },
      ] as never,
    });
    const indicator = screen.getByTestId("risk-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-tone", "warning");
  });

  it("riskFlags blocker severity => critical tone risk indicator", () => {
    renderCard({
      ...baseItem,
      riskFlagCount: 1,
      riskFlags: [
        { kind: "gibberish_text_detected", severity: "blocker" },
      ] as never,
    });
    expect(screen.getByTestId("risk-indicator")).toHaveAttribute("data-tone", "critical");
  });

  it("riskFlagCount === 0 => risk indicator gizli", () => {
    renderCard({ ...baseItem, riskFlagCount: 0 });
    expect(screen.queryByTestId("risk-indicator")).toBeNull();
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
