// IA-34 — ReviewCard scope label batch > reference dominance.
//
// AI item card primary scope label:
//   • batchShortId varsa → `batch-XXXXXX` (default deep-link batch'e gider)
//   • batchShortId yoksa → `ref-XXXXXX` (fallback)
//   • her ikisi yoksa → `—`
//
// Aynı reference farklı batch'lerde farklı variation'lar üretebilir;
// operatör review yaparken "şu batch'i temizliyorum" mantığıyla
// çalışır (CLAUDE.md Madde G — workflow tracking).

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/review",
  useSearchParams: () => new URLSearchParams(""),
}));

import { ReviewCard } from "@/app/(app)/review/_components/ReviewCard";
import type { ReviewQueueItem } from "@/features/review/queries";

const baseDesignItem: ReviewQueueItem = {
  id: "design-1",
  thumbnailUrl: "https://example.com/thumb.png",
  fullResolutionUrl: "https://example.com/thumb.png",
  reviewStatus: "PENDING",
  reviewStatusSource: "SYSTEM",
  reviewScore: 80,
  reviewSummary: null,
  riskFlagCount: 0,
  riskFlags: [],
  reviewedAt: "2026-05-11T00:00:00Z",
  reviewProviderSnapshot: "v1",
  reviewSuggestedStatus: "APPROVED",
  reviewProviderRawScore: 80,
  referenceId: "ref-abc123",
  productTypeId: "pt-1",
  jobId: "job-1",
  reviewLifecycle: "ready",
  source: {
    kind: "design",
    productTypeKey: "wall_art",
    referenceShortId: "abc123",
    batchId: null,
    batchShortId: null,
    createdAt: "2026-05-11T00:00:00Z",
    mimeType: "image/jpeg",
    fileSize: 1024,
    width: 1024,
    height: 1024,
    hasAlpha: null,
  },
};

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

describe("ReviewCard scope label — IA-34 batch > reference", () => {
  it("batch yoksa reference label gösterir (fallback)", () => {
    renderCard(baseDesignItem);
    const label = screen.getByTestId("card-scope-label");
    expect(label).toHaveTextContent("ref-abc123");
  });

  it("batch varsa batch label baskındır (reference göz ardı)", () => {
    renderCard({
      ...baseDesignItem,
      source: {
        ...baseDesignItem.source!,
        kind: "design",
        batchId: "batch-cuid-xyz789",
        batchShortId: "xyz789",
      } as never,
    });
    const label = screen.getByTestId("card-scope-label");
    expect(label).toHaveTextContent("batch-xyz789");
    expect(label).not.toHaveTextContent("ref-abc123");
  });

  it("batch + reference ikisi varsa batch dominant", () => {
    renderCard({
      ...baseDesignItem,
      source: {
        ...baseDesignItem.source!,
        kind: "design",
        referenceShortId: "ref-only-fallback",
        batchId: "batch-id-aaa111",
        batchShortId: "aaa111",
      } as never,
    });
    const label = screen.getByTestId("card-scope-label");
    expect(label).toHaveTextContent("batch-aaa111");
  });

  it("ikisi de null ise em dash", () => {
    renderCard({
      ...baseDesignItem,
      source: {
        ...baseDesignItem.source!,
        kind: "design",
        referenceShortId: null,
        batchId: null,
        batchShortId: null,
      } as never,
    });
    const label = screen.getByTestId("card-scope-label");
    expect(label).toHaveTextContent("—");
  });

  it("title attribute ile batch/reference ayrımı net", () => {
    const { rerender } = renderCard({
      ...baseDesignItem,
      source: {
        ...baseDesignItem.source!,
        kind: "design",
        batchId: "batch-xyz",
        batchShortId: "xyz",
      } as never,
    });
    expect(screen.getByTestId("card-scope-label")).toHaveAttribute(
      "title",
      expect.stringContaining("Batch"),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    rerender(
      <QueryClientProvider client={qc}>
        <ReviewCard item={baseDesignItem} />
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("card-scope-label")).toHaveAttribute(
      "title",
      expect.stringContaining("Reference"),
    );
  });
});
