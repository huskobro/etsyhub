// Phase 7 Task 38 — ReviewCard "Selection Studio'da Aç" Quick start CTA testleri.
//
// Sözleşme:
//   - jobId === null (örn. local-library asset) => Quick start buton render YOK.
//   - jobId varsa => Quick start buton render edilir.
//   - Click → POST /api/selection/sets/quick-start { source, referenceId,
//     batchId, productTypeId } gönderilir.
//   - Click sırasında kart open (detail drawer) tetiklenmez (stopPropagation).
//   - Pending state: buton disabled + label "Açılıyor..."
//   - Success: router.push(`/selection/sets/${setId}`) çağrılır.
//
// Phase 6 baseline regression: yeni alanlar opsiyonel — mevcut testler
// kırılmamalı. Bu dosya yalnız Quick start davranışını kapsar.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const pushMock = vi.fn();
const routerOpenDetailPush = vi.fn();

// next/navigation: ReviewCard hem kart click (detail drawer) hem Quick start
// için useRouter çağırır — aynı mock iki tüketiciyi de karşılar.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/review",
  useSearchParams: () => new URLSearchParams(""),
}));

import { ReviewCard } from "@/app/(app)/review/_components/ReviewCard";
import type { ReviewQueueItem } from "@/features/review/queries";

const baseItem: ReviewQueueItem = {
  id: "design-cuid-1",
  thumbnailUrl: "https://example.com/thumb.png",
  reviewStatus: "APPROVED",
  reviewStatusSource: "SYSTEM",
  reviewScore: 92,
  reviewSummary: null,
  riskFlagCount: 0,
  riskFlags: [],
  reviewedAt: "2026-04-29T00:00:00Z",
  reviewProviderSnapshot: null,
  reviewSuggestedStatus: null,
  reviewProviderRawScore: null,
  // Phase 7 Task 38 alanları:
  referenceId: "ref-cuid-1",
  productTypeId: "pt-cuid-1",
  jobId: "job-cuid-1",
};

function renderWithClient(node: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>{node}</QueryClientProvider>,
  );
}

describe("ReviewCard — Phase 7 Task 38 Quick start CTA", () => {
  beforeEach(() => {
    pushMock.mockClear();
    routerOpenDetailPush.mockClear();
    // global fetch mock — testler kendi response'unu set eder.
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("jobId null => Quick start buton render edilmiyor (local asset)", () => {
    renderWithClient(
      <ReviewCard
        item={{
          ...baseItem,
          referenceId: null,
          productTypeId: null,
          jobId: null,
        }}
      />,
    );
    expect(screen.queryByTestId("quick-start-button")).toBeNull();
  });

  it("jobId varsa Quick start buton render edilir", () => {
    renderWithClient(<ReviewCard item={baseItem} />);
    expect(screen.getByTestId("quick-start-button")).toBeInTheDocument();
  });

  it("Click → POST /api/selection/sets/quick-start canonical body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ setId: "set-cuid-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(<ReviewCard item={baseItem} />);
    fireEvent.click(screen.getByTestId("quick-start-button"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/selection/sets/quick-start");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      source: "variation-batch",
      referenceId: "ref-cuid-1",
      batchId: "job-cuid-1",
      productTypeId: "pt-cuid-1",
    });
  });

  it("Success → router.push /selection/sets/[setId]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ setId: "set-cuid-42" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(<ReviewCard item={baseItem} />);
    fireEvent.click(screen.getByTestId("quick-start-button"));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/selection/sets/set-cuid-42");
    });
  });

  it("Click stopPropagation: detail drawer push YALNIZ /selection/sets/* olmalı (kart open tetiklenmedi)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ setId: "set-cuid-99" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(<ReviewCard item={baseItem} />);
    fireEvent.click(screen.getByTestId("quick-start-button"));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/selection/sets/set-cuid-99");
    });
    // Hiçbir push çağrısı detail URL pattern'i içermemeli (?detail=...).
    for (const call of pushMock.mock.calls) {
      const arg = call[0] as string;
      expect(arg).not.toContain("?detail=");
    }
  });

  it("Pending state: buton disabled + label 'Açılıyor...'", async () => {
    type Resolver = (v: unknown) => void;
    const resolverRef: { current: Resolver | null } = { current: null };
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          resolverRef.current = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(<ReviewCard item={baseItem} />);
    const btn = screen.getByTestId("quick-start-button");
    fireEvent.click(btn);

    await waitFor(() => {
      expect(btn).toBeDisabled();
      expect(btn).toHaveTextContent("Açılıyor...");
    });

    // cleanup: pending promise'i çöz
    resolverRef.current?.({
      ok: true,
      status: 201,
      json: async () => ({ setId: "set-cuid-x" }),
    });
  });

  it("Error: HTTP fail → push çağrılmıyor (router.push redirect yok)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Empty batch" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(<ReviewCard item={baseItem} />);
    fireEvent.click(screen.getByTestId("quick-start-button"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    // Mutation reject; redirect yapılmamalı.
    expect(pushMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/selection/sets/"),
    );
  });
});
