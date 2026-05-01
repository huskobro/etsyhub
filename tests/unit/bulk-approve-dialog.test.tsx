// Phase 6 Dalga B polish (A3) — BulkApproveDialog UI testleri.
//
// Kontratlar:
//   - Confirm butonu POST /api/review/decisions/bulk action=approve gönderir.
//   - Skip-on-risk hint cache'ten hesaplanır (riskyCount/safeCount mesajı).
//     Server tek doğru kaynak; UI sadece önceden bilgi (sessiz fallback YOK).
//   - Success ⇒ onSuccess({ approved, skippedRisky, ... }) callback çağrılır.
//   - Vazgeç butonu onClose çağırır.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReviewQueueItem } from "@/features/review/queries";

// Radix Dialog Portal animasyonları için matchMedia mock — confirm-dialog
// testindeki pattern.
beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const mockUseReviewQueue = vi.fn();
vi.mock("@/features/review/queries", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/review/queries")
  >("@/features/review/queries");
  return {
    ...actual,
    useReviewQueue: (params: { scope: "design" | "local" }) =>
      mockUseReviewQueue(params),
  };
});

import { BulkApproveDialog } from "@/app/(app)/review/_components/BulkApproveDialog";

function makeItem(
  id: string,
  riskFlagCount: number,
): ReviewQueueItem {
  return {
    id,
    thumbnailUrl: null,
    reviewStatus: "NEEDS_REVIEW",
    reviewStatusSource: "SYSTEM",
    reviewScore: 60,
    reviewSummary: null,
    riskFlagCount,
    riskFlags: [],
    reviewedAt: null,
    reviewProviderSnapshot: null,
    // Phase 7 Task 38: alanlar additive — bulk dialog ile alakasız, null.
    referenceId: null,
    productTypeId: null,
    jobId: null,
  };
}

function renderDialog(props: {
  ids: string[];
  onSuccess?: ReturnType<typeof vi.fn>;
  onClose?: ReturnType<typeof vi.fn>;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <BulkApproveDialog
        scope="design"
        ids={props.ids}
        open
        onClose={props.onClose ?? vi.fn()}
        onSuccess={props.onSuccess ?? vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe("BulkApproveDialog", () => {
  beforeEach(() => {
    mockUseReviewQueue.mockReset();
    // fetch mock — her testte temiz.
    vi.spyOn(global, "fetch").mockReset?.();
  });

  it("Skip-on-risk hint cache'ten hesaplanır (riskyCount + safeCount görünür)", () => {
    mockUseReviewQueue.mockReturnValue({
      data: {
        items: [
          makeItem("a", 0), // safe
          makeItem("b", 0), // safe
          makeItem("c", 2), // risky
        ],
        total: 3,
        page: 1,
        pageSize: 24,
      },
      isLoading: false,
      error: null,
    });
    renderDialog({ ids: ["a", "b", "c"] });
    // Description: "Risk işareti taşıyan 1 ... 2 temiz tasarım..."
    expect(screen.getByText(/1/)).toBeInTheDocument();
    expect(screen.getByText(/2/)).toBeInTheDocument();
    expect(screen.getByText(/risk işareti taşıyan/i)).toBeInTheDocument();
    expect(screen.getByText(/temiz tasarım/i)).toBeInTheDocument();
  });

  it("Confirm butonu ⇒ POST /api/review/decisions/bulk action=approve gönderilir", async () => {
    mockUseReviewQueue.mockReturnValue({
      data: { items: [makeItem("a", 0)], total: 1, page: 1, pageSize: 24 },
      isLoading: false,
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requested: 1,
        approved: 1,
        skippedRisky: 0,
        skippedRiskyIds: [],
        skippedNotFound: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderDialog({ ids: ["a"] });
    fireEvent.click(screen.getByRole("button", { name: /^Onayla$/ }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const call = fetchMock.mock.calls[0]!;
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe("/api/review/decisions/bulk");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ action: "approve", scope: "design", ids: ["a"] });
  });

  it("Success ⇒ onSuccess({ approved, skippedRisky }) callback çağrılır", async () => {
    mockUseReviewQueue.mockReturnValue({
      data: {
        items: [makeItem("a", 0), makeItem("b", 1)],
        total: 2,
        page: 1,
        pageSize: 24,
      },
      isLoading: false,
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requested: 2,
        approved: 1,
        skippedRisky: 1,
        skippedRiskyIds: ["b"],
        skippedNotFound: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onSuccess = vi.fn();

    renderDialog({ ids: ["a", "b"], onSuccess });
    fireEvent.click(screen.getByRole("button", { name: /^Onayla$/ }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    expect(onSuccess.mock.calls[0]![0]).toMatchObject({
      approved: 1,
      skippedRisky: 1,
    });
  });

  it("Vazgeç butonu onClose çağırır", () => {
    mockUseReviewQueue.mockReturnValue({
      data: { items: [makeItem("a", 0)], total: 1, page: 1, pageSize: 24 },
      isLoading: false,
      error: null,
    });
    const onClose = vi.fn();
    renderDialog({ ids: ["a"], onClose });
    fireEvent.click(screen.getByRole("button", { name: /^Vazgeç$/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
