// Phase 8 Task 28+29 + Phase 9 Task 19 — S8ResultView grid layout + swap + per-render actions + listing CTA.
//
// 15 scenarios: status guard (redirect non-completed), full/compat-limited/partial
// complete layouts, all-failed recovery, cover slot styling, bulk download,
// per-render overlay, cover swap POST, per-render retry/swap, failed error class mapping,
// listing CTA (Phase 9 integration), listing creation success/error.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { S8ResultView } from "@/features/mockups/components/S8ResultView";
import type { MockupJobView, MockupRenderView } from "@/features/mockups/hooks/useMockupJob";

const mockRouter = {
  replace: vi.fn(),
  push: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/selection/sets/test-set/mockup/jobs/job-1/result",
}));

// useMockupJob mock — her test içinde override edilecek
let mockUseMockupJobReturn: any = null;

vi.mock("@/features/mockups/hooks/useMockupJob", () => ({
  useMockupJob: vi.fn(() => mockUseMockupJobReturn || {
    data: null,
    isLoading: true,
    error: null,
  }),
  mockupJobQueryKey: (jobId: string) => ["mockup-job", jobId],
}));

// Phase 9 Task 19: useCreateListingDraft mock
let mockUseCreateListingDraftReturn: any = null;

vi.mock("@/features/listings/hooks/useCreateListingDraft", () => ({
  useCreateListingDraft: vi.fn(() => mockUseCreateListingDraftReturn || {
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

function createMockRender(overrides?: Partial<MockupRenderView>): MockupRenderView {
  return {
    id: "render-1",
    packPosition: 0,
    selectionReason: "selected",
    status: "SUCCESS",
    outputKey: "https://example.com/r1.png",
    thumbnailKey: "https://example.com/r1-thumb.png",
    errorClass: null,
    errorDetail: null,
    templateSnapshot: { templateName: "Template A", aspectRatios: ["2:3"] },
    variantId: "var-1-abcdef",
    retryCount: 0,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockJob(overrides?: Partial<MockupJobView>): MockupJobView {
  return {
    id: "job-1",
    status: "COMPLETED",
    packSize: 10,
    actualPackSize: 10,
    totalRenders: 10,
    successRenders: 10,
    failedRenders: 0,
    coverRenderId: "render-1",
    errorSummary: null,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    estimatedCompletionAt: null,
    renders: [
      createMockRender({ id: "render-1" }),
      createMockRender({ id: "render-2", packPosition: 1 }),
      createMockRender({ id: "render-3", packPosition: 2 }),
      createMockRender({ id: "render-4", packPosition: 3 }),
      createMockRender({ id: "render-5", packPosition: 4 }),
      createMockRender({ id: "render-6", packPosition: 5 }),
      createMockRender({ id: "render-7", packPosition: 6 }),
      createMockRender({ id: "render-8", packPosition: 7 }),
      createMockRender({ id: "render-9", packPosition: 8 }),
      createMockRender({ id: "render-10", packPosition: 9 }),
    ],
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("<S8ResultView>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.replace.mockClear();
    mockRouter.push.mockClear();
    mockUseMockupJobReturn = null;
    mockUseCreateListingDraftReturn = null;
  });

  it("redirects to S7 if status not in {COMPLETED, PARTIAL_COMPLETE}", async () => {
    const job = createMockJob({ status: "RUNNING" });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/selection/sets/test-set/mockup/jobs/job-1"
      );
    });
  });

  it("Completed full (10/10): standart grid, cover first", () => {
    const job = createMockJob({ status: "COMPLETED", successRenders: 10 });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // Başlık
    expect(screen.getByText(/10 of 10 renders succeeded/)).toBeInTheDocument();

    // Cover rozetini bul
    expect(screen.getByText(/★ Cover/)).toBeInTheDocument();
  });

  it("Completed compat-limited (6/10): dürüst sayım + standart grid (6 slot)", () => {
    const renders = [
      createMockRender({ id: "render-1" }),
      createMockRender({ id: "render-2", packPosition: 1 }),
      createMockRender({ id: "render-3", packPosition: 2 }),
      createMockRender({ id: "render-4", packPosition: 3 }),
      createMockRender({ id: "render-5", packPosition: 4 }),
      createMockRender({ id: "render-6", packPosition: 5 }),
    ];

    const job = createMockJob({
      status: "COMPLETED",
      actualPackSize: 6,
      successRenders: 6,
      failedRenders: 0,
      totalRenders: 6,
      renders,
    });

    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // Başlık dürüst sayım
    expect(screen.getByText(/Mockup pack ready/)).toBeInTheDocument();

    // Cover slot görünsün
    expect(screen.getByText(/★ Cover/)).toBeInTheDocument();
  });

  it("Partial complete (8/10): grid + failed slot rozet + retry/swap", () => {
    const renders = [
      createMockRender({ id: "render-1" }),
      createMockRender({ id: "render-2", packPosition: 1 }),
      createMockRender({ id: "render-3", packPosition: 2 }),
      createMockRender({ id: "render-4", packPosition: 3 }),
      createMockRender({ id: "render-5", packPosition: 4 }),
      createMockRender({ id: "render-6", packPosition: 5 }),
      createMockRender({ id: "render-7", packPosition: 6 }),
      createMockRender({ id: "render-8", packPosition: 7 }),
      createMockRender({
        id: "render-9",
        packPosition: 8,
        status: "FAILED",
        errorClass: "PROVIDER_DOWN",
        errorDetail: "API timeout",
      }),
      createMockRender({
        id: "render-10",
        packPosition: 9,
        status: "FAILED",
        errorClass: "RENDER_TIMEOUT",
        errorDetail: "15s timeout",
      }),
    ];

    const job = createMockJob({
      status: "PARTIAL_COMPLETE",
      successRenders: 8,
      failedRenders: 2,
      totalRenders: 10,
      renders,
    });

    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // Başlık
    expect(screen.getByText(/8 of 10 renders succeeded/)).toBeInTheDocument();

    // Phase 53 — partial warning data-testid (copy text split across <strong> + text nodes)
    expect(
      screen.getByTestId("mockup-result-partial-warning"),
    ).toBeInTheDocument();
  });

  it("All failed: 'Pack failed to render' + hata özeti + recovery", () => {
    const renders = [
      createMockRender({
        id: "render-1",
        status: "FAILED",
        errorClass: "PROVIDER_DOWN",
      }),
      createMockRender({
        id: "render-2",
        status: "FAILED",
        errorClass: "PROVIDER_DOWN",
      }),
    ];

    const job = createMockJob({
      status: "PARTIAL_COMPLETE", // All failed view için status PARTIAL_COMPLETE + successRenders=0
      successRenders: 0,
      failedRenders: 2,
      totalRenders: 2,
      errorSummary: "Provider erişilemez",
      renders,
    });

    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // All failed view başlığı
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/Pack failed to render/);

    // Hata özeti
    expect(screen.getByText(/Provider erişilemez/)).toBeInTheDocument();

    // Back to Mockup Studio butonu (recovery)
    expect(screen.getByRole("button", { name: /Back to Mockup Studio/ })).toBeInTheDocument();
  });

  it("cover slot has ★ Cover badge + büyük thumbnail (sol üst)", () => {
    const job = createMockJob({
      status: "COMPLETED",
      successRenders: 3,
      renders: [
        createMockRender({ id: "render-1", outputKey: "https://example.com/cover.png" }),
        createMockRender({ id: "render-2", packPosition: 1 }),
        createMockRender({ id: "render-3", packPosition: 2 }),
      ],
    });

    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // Cover badge
    const coverBadge = screen.getByText(/★ Cover/);
    expect(coverBadge).toBeInTheDocument();

    // Cover badge pozisyonu (sol üst = top-2 left-2)
    expect(coverBadge.className).toMatch(/left-2.*top-2/);
  });

  it("Bulk download ZIP triggers /download endpoint", () => {
    const job = createMockJob({ status: "COMPLETED" });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // Download link
    const downloadLink = screen.getByRole("link", { name: /Download ZIP/ });
    expect(downloadLink).toHaveAttribute(
      "href",
      "/api/mockup/jobs/job-1/download"
    );
  });

  // Removed: Phase 8 test "Listing'e gönder → CTA disabled with Phase 9 tooltip"
  // Phase 9 Task 19: CTA is now ENABLED (see Phase 9 tests below)

  it("per-render swap action → POST /jobs/[jobId]/renders/[renderId]/swap (gerçek fetch)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ newRenderId: "render-new", status: "PENDING" }),
    } as Response);

    const job = createMockJob({
      status: "PARTIAL_COMPLETE",
      successRenders: 8,
      failedRenders: 1,
      renders: [
        createMockRender({ id: "render-1" }),
        createMockRender({ id: "render-2", packPosition: 1 }),
        createMockRender({
          id: "render-3",
          packPosition: 2,
          status: "FAILED",
          errorClass: "TEMPLATE_INVALID",
        }),
      ],
    });

    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // 5-class hata rozet görünür
    expect(screen.getByText(/Template invalid/)).toBeInTheDocument();

    // Swap butonu görünür (TEMPLATE_INVALID swap-only, retry yok)
    const swapButtons = screen.getAllByRole("button", { name: /^Swap$/i });
    expect(swapButtons.length).toBeGreaterThan(0);

    // Click → gerçek POST /jobs/[jobId]/renders/[renderId]/swap
    fireEvent.click(swapButtons[0]!);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/mockup/jobs/job-1/renders/render-3/swap",
        expect.objectContaining({ method: "POST" }),
      );
    });

    fetchSpy.mockRestore();
  });

  it("per-render retry action → POST /jobs/[jobId]/renders/[renderId]/retry (gerçek fetch, RENDER_TIMEOUT)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        renderId: "render-3",
        status: "PENDING",
        retryCount: 1,
      }),
    } as Response);

    const job = createMockJob({
      status: "PARTIAL_COMPLETE",
      successRenders: 9,
      failedRenders: 1,
      renders: [
        createMockRender({ id: "render-1" }),
        createMockRender({ id: "render-2", packPosition: 1 }),
        createMockRender({
          id: "render-3",
          packPosition: 2,
          status: "FAILED",
          errorClass: "RENDER_TIMEOUT",
        }),
      ],
    });

    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // 5-class hata rozet görünür
    expect(screen.getByText(/Render timeout/)).toBeInTheDocument();

    // RENDER_TIMEOUT retryable → Retry butonu görünür
    const retryButtons = screen.getAllByRole("button", { name: /^Retry$/i });
    expect(retryButtons.length).toBeGreaterThan(0);

    fireEvent.click(retryButtons[0]!);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/mockup/jobs/job-1/renders/render-3/retry",
        expect.objectContaining({ method: "POST" }),
      );
    });

    fetchSpy.mockRestore();
  });

  it("non-retryable error class (TEMPLATE_INVALID) → Retry butonu YOK, sadece Swap", () => {
    const job = createMockJob({
      status: "PARTIAL_COMPLETE",
      successRenders: 9,
      failedRenders: 1,
      renders: [
        createMockRender({ id: "render-1" }),
        createMockRender({
          id: "render-2",
          packPosition: 1,
          status: "FAILED",
          errorClass: "TEMPLATE_INVALID",
        }),
      ],
    });

    mockUseMockupJobReturn = { data: job, isLoading: false, error: null };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // Retry butonu YOK (TEMPLATE_INVALID retryable değil)
    expect(
      screen.queryByRole("button", { name: /^Retry$/i }),
    ).not.toBeInTheDocument();

    // Swap butonu VAR
    expect(screen.getAllByRole("button", { name: /^Swap$/i }).length).toBeGreaterThan(0);
  });

  it("failed slot UI per error class (5 mappings)", () => {
    const renders = [
      createMockRender({ id: "render-1" }),
      createMockRender({
        id: "render-2",
        packPosition: 1,
        status: "FAILED",
        errorClass: "RENDER_TIMEOUT",
        errorDetail: "15s timeout",
      }),
      createMockRender({
        id: "render-3",
        packPosition: 2,
        status: "FAILED",
        errorClass: "TEMPLATE_INVALID",
        errorDetail: "Template not found",
      }),
      createMockRender({
        id: "render-4",
        packPosition: 3,
        status: "FAILED",
        errorClass: "SAFE_AREA_OVERFLOW",
        errorDetail: "Content overflows safe area",
      }),
      createMockRender({
        id: "render-5",
        packPosition: 4,
        status: "FAILED",
        errorClass: "SOURCE_QUALITY",
        errorDetail: "Source image too small",
      }),
      createMockRender({
        id: "render-6",
        packPosition: 5,
        status: "FAILED",
        errorClass: "PROVIDER_DOWN",
        errorDetail: "API error",
      }),
    ];

    const job = createMockJob({
      status: "PARTIAL_COMPLETE",
      successRenders: 1,
      failedRenders: 5,
      totalRenders: 6,
      renders,
    });

    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // ERROR_LABELS mapping kontrolü
    expect(screen.getByText(/Render timeout/)).toBeInTheDocument(); // RENDER_TIMEOUT
    expect(screen.getByText(/Template invalid/)).toBeInTheDocument(); // TEMPLATE_INVALID
    expect(screen.getByText(/Design didn't fit/)).toBeInTheDocument(); // SAFE_AREA_OVERFLOW
    expect(screen.getByText(/Source quality too low/)).toBeInTheDocument(); // SOURCE_QUALITY
    expect(screen.getByText(/Provider unreachable/)).toBeInTheDocument(); // PROVIDER_DOWN
  });

  // ────────────────────────────────────────────────────────────
  // Phase 9 Task 19 — Listing CTA tests (3 scenarios)
  // ────────────────────────────────────────────────────────────

  it("Phase 9: Listing CTA button visible and clickable on successful pack", async () => {
    const job = createMockJob({ status: "COMPLETED", successRenders: 10 });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    const mockMutateAsync = vi.fn().mockResolvedValue({ listingId: "clxywzk3f0000gl6h7k5j" });
    mockUseCreateListingDraftReturn = {
      mutateAsync: mockMutateAsync,
      isPending: false,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // CTA butonu aktif olmalı (disabled değil)
    const ctaBtn = screen.getByRole("button", { name: /Create listing draft/i });
    expect(ctaBtn).toBeInTheDocument();
    expect(ctaBtn).not.toHaveAttribute("disabled");
  });

  it("Phase 9: clicking Listing CTA calls createListingDraft mutation with jobId", async () => {
    const job = createMockJob({ status: "COMPLETED", successRenders: 10 });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    const mockMutateAsync = vi.fn().mockResolvedValue({ listingId: "clxywzk3f0000gl6h7k5j" });
    mockUseCreateListingDraftReturn = {
      mutateAsync: mockMutateAsync,
      isPending: false,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    const ctaBtn = screen.getByRole("button", { name: /Create listing draft/i });
    fireEvent.click(ctaBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        mockupJobId: "job-1",
      });
    });
  });

  it("Phase 9: successful listing creation navigates to /listings/draft/[id]", async () => {
    const job = createMockJob({ status: "COMPLETED", successRenders: 10 });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    const listingId = "clxywzk3f0000gl6h7k5j";
    const mockMutateAsync = vi.fn().mockResolvedValue({ listingId });
    mockUseCreateListingDraftReturn = {
      mutateAsync: mockMutateAsync,
      isPending: false,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    const ctaBtn = screen.getByRole("button", { name: /Create listing draft/i });
    fireEvent.click(ctaBtn);

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith(`/products/${listingId}`);
    });
  });

  it("Phase 9: CTA button shows loading state while mutation pending", async () => {
    const job = createMockJob({ status: "COMPLETED", successRenders: 10 });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    const mockMutateAsync = vi.fn();
    mockUseCreateListingDraftReturn = {
      mutateAsync: mockMutateAsync,
      isPending: true, // Simulate pending state
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    const ctaBtn = screen.getByRole("button", { name: /Creating listing draft/i });
    expect(ctaBtn).toHaveAttribute("disabled");
  });
});
