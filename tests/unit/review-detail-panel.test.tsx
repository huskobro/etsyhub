// Phase 6 Dalga B polish (A1) — ReviewDetailPanel UI testleri.
//
// Kontratlar:
//   - role="dialog" + aria-modal="true" (Karar 1: drawer modal semantiği).
//   - ESC tuşu URL'den ?detail siliyor (drawer kapatma).
//   - Kapat butonu URL'den ?detail siliyor.
//   - Cache'te item yok ⇒ "bulunamadı" fallback gösterilir.
//   - Risk flag listesi (count > 0 + flags array) görünür.
//   - reviewProviderSnapshot dolu ⇒ snapshot satırı render olur.
//
// Mock pattern: review-card.test.tsx + review-queue-list.test.tsx ile
// uyumlu — next/navigation router.push capture, useReviewQueue mock.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/review",
  useSearchParams: () => new URLSearchParams("tab=ai&detail=test-id"),
}));

const mockUseReviewQueue = vi.fn();
vi.mock("@/features/review/queries", () => ({
  useReviewQueue: (params: { scope: "design" | "local" }) =>
    mockUseReviewQueue(params),
}));

import { ReviewDetailPanel } from "@/app/(app)/review/_components/ReviewDetailPanel";

const baseItem = {
  id: "test-id",
  thumbnailUrl: "https://example.com/x.png",
  reviewStatus: "NEEDS_REVIEW" as const,
  reviewStatusSource: "SYSTEM" as const,
  reviewScore: 70,
  reviewSummary: "watermark detected",
  riskFlagCount: 1,
  riskFlags: [
    {
      type: "watermark_detected" as const,
      confidence: 0.9,
      reason: "köşede silik imza",
    },
  ],
  reviewedAt: "2026-04-29T00:00:00Z",
  reviewProviderSnapshot: "gemini-2-5-flash@2026-04-29",
};

function renderPanel(item: typeof baseItem | null = baseItem) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mockUseReviewQueue.mockReturnValue({
    data: {
      items: item ? [item] : [],
      total: item ? 1 : 0,
      page: 1,
      pageSize: 24,
    },
    isLoading: false,
    error: null,
  });
  return render(
    <QueryClientProvider client={client}>
      <ReviewDetailPanel id="test-id" scope="design" />
    </QueryClientProvider>,
  );
}

describe("ReviewDetailPanel", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseReviewQueue.mockReset();
  });

  it("dialog role + aria-modal=true (Karar 1 drawer modal semantiği)", () => {
    renderPanel();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "review-detail-title");
  });

  it("ESC tuşu URL'den detail param'ını siler (mevcut tab korunur)", () => {
    renderPanel();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockPush).toHaveBeenCalledWith("/review?tab=ai");
  });

  it("Kapat butonu URL'den detail param'ını siler", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("review-detail-close"));
    expect(mockPush).toHaveBeenCalledWith("/review?tab=ai");
  });

  it("Backdrop tıklamasında drawer kapanır (URL'den detail silinir)", () => {
    renderPanel();
    fireEvent.click(screen.getByTestId("review-detail-backdrop"));
    expect(mockPush).toHaveBeenCalledWith("/review?tab=ai");
  });

  it("Item cache'te yok ⇒ 'bulunamadı' fallback mesajı görünür", () => {
    renderPanel(null);
    expect(screen.getByTestId("review-detail-empty")).toBeInTheDocument();
    expect(screen.getByText(/bulunamadı/i)).toBeInTheDocument();
  });

  it("Risk flag listesi görünür (count > 0 + flag detayı)", () => {
    renderPanel();
    expect(screen.getByText(/Risk işaretleri/i)).toBeInTheDocument();
    // FLAG_LABEL → "Watermark"
    expect(screen.getByText(/Watermark/)).toBeInTheDocument();
  });

  it("Provider snapshot satırı render olur (audit trail)", () => {
    renderPanel();
    expect(screen.getByText(/gemini-2-5-flash/i)).toBeInTheDocument();
  });

  it("reviewSummary dolu ⇒ Özet bölümü görünür", () => {
    renderPanel();
    expect(screen.getByText(/Özet/)).toBeInTheDocument();
    expect(screen.getByText(/watermark detected/)).toBeInTheDocument();
  });
});
