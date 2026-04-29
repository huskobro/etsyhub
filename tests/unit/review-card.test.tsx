// Phase 6 Task 14 — ReviewCard UI testleri.
//
// Sözleşme:
//   - 4 ReviewStatus (PENDING/APPROVED/NEEDS_REVIEW/REJECTED) badge label.
//   - reviewStatusSource === "USER" => "Kullanıcı" rozeti görünür (sticky kontrat).
//   - reviewScore null => score chip gizli.
//   - riskFlagCount === 0 => risk satırı gizli.
//   - thumbnailUrl null => "Önizleme yok" fallback metni görünür.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReviewCard } from "@/app/(app)/review/_components/ReviewCard";
import type { ReviewQueueItem } from "@/features/review/queries";

const baseItem: ReviewQueueItem = {
  id: "test-id",
  thumbnailUrl: "https://example.com/thumb.png",
  reviewStatus: "APPROVED",
  reviewStatusSource: "SYSTEM",
  reviewScore: 95,
  riskFlagCount: 0,
  reviewedAt: "2026-04-29T00:00:00Z",
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
      const { unmount } = render(
        <ReviewCard item={{ ...baseItem, reviewStatus: status }} />,
      );
      expect(screen.getByTestId("status-badge")).toHaveTextContent(label);
      unmount();
    }
  });

  it("USER source => Kullanıcı rozeti görünür", () => {
    render(
      <ReviewCard item={{ ...baseItem, reviewStatusSource: "USER" }} />,
    );
    expect(screen.getByTestId("user-badge")).toBeInTheDocument();
  });

  it("SYSTEM source => Kullanıcı rozeti görünmüyor", () => {
    render(
      <ReviewCard item={{ ...baseItem, reviewStatusSource: "SYSTEM" }} />,
    );
    expect(screen.queryByTestId("user-badge")).toBeNull();
  });

  it("score chip score değerini gösteriyor", () => {
    render(<ReviewCard item={{ ...baseItem, reviewScore: 87 }} />);
    expect(screen.getByTestId("score-chip")).toHaveTextContent("87");
  });

  it("score null => chip görünmüyor", () => {
    render(<ReviewCard item={{ ...baseItem, reviewScore: null }} />);
    expect(screen.queryByTestId("score-chip")).toBeNull();
  });

  it("riskFlagCount > 0 => risk işaretleri satırı görünür", () => {
    render(<ReviewCard item={{ ...baseItem, riskFlagCount: 2 }} />);
    expect(screen.getByTestId("risk-flags")).toHaveTextContent(
      "2 risk işareti",
    );
  });

  it("riskFlagCount === 0 => risk satırı gizli", () => {
    render(<ReviewCard item={{ ...baseItem, riskFlagCount: 0 }} />);
    expect(screen.queryByTestId("risk-flags")).toBeNull();
  });

  it("thumbnailUrl null => 'Önizleme yok' fallback", () => {
    render(<ReviewCard item={{ ...baseItem, thumbnailUrl: null }} />);
    expect(screen.getByText(/Önizleme yok/)).toBeInTheDocument();
  });

  // a11y — Ö-4: thumbnail informative alt metin (decorative değil).
  it("img alt='Tasarım önizlemesi' (a11y)", () => {
    render(<ReviewCard item={baseItem} />);
    expect(screen.getByAltText("Tasarım önizlemesi")).toBeInTheDocument();
  });

  // a11y — Ö-4: score chip semantik etiket.
  it("score chip aria-label='Kalite skoru: X' (a11y)", () => {
    render(<ReviewCard item={{ ...baseItem, reviewScore: 87 }} />);
    expect(screen.getByLabelText("Kalite skoru: 87")).toBeInTheDocument();
  });
});
