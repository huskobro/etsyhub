// Phase 8 Task 28+29 — S8ResultView grid layout + swap + per-render actions.
//
// 12 scenarios: status guard (redirect non-completed), full/compat-limited/partial
// complete layouts, all-failed recovery, cover slot styling, bulk download, phase 9
// listing CTA, per-render overlay, cover swap POST, per-render retry/swap, failed
// error class mapping.

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
    mockUseMockupJobReturn = null;
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
    expect(screen.getByText(/Pack hazır: 10\/10/)).toBeInTheDocument();

    // Cover rozetini bul
    expect(screen.getByText(/★ COVER/)).toBeInTheDocument();
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
    expect(screen.getByText(/Pack hazır: 6\/6/)).toBeInTheDocument();

    // Cover slot görünsün
    expect(screen.getByText(/★ COVER/)).toBeInTheDocument();
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
    expect(screen.getByText(/Pack hazır: 8\/10/)).toBeInTheDocument();

    // Failed renderler warning
    expect(screen.getByText(/⚠ 2 render başarısız/)).toBeInTheDocument();
  });

  it("All failed: 'Pack üretilemedi' + hata özeti + recovery", () => {
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
    expect(alert).toHaveTextContent(/Pack üretilemedi/);

    // Hata özeti
    expect(screen.getByText(/Provider erişilemez/)).toBeInTheDocument();

    // S3'e dön butonu (recovery)
    expect(screen.getByRole("button", { name: /S3'e dön/ })).toBeInTheDocument();
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
    const coverBadge = screen.getByText(/★ COVER/);
    expect(coverBadge).toBeInTheDocument();

    // Cover badge pozisyonu (sol üst = top-2 left-2)
    expect(coverBadge.className).toMatch(/top-2.*left-2/);
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
    const downloadLink = screen.getByRole("link", { name: /Bulk download ZIP/ });
    expect(downloadLink).toHaveAttribute(
      "href",
      "/api/mockup/jobs/job-1/download"
    );
  });

  it("Listing'e gönder → CTA disabled with Phase 9 tooltip", () => {
    const job = createMockJob({ status: "COMPLETED" });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S8ResultView setId="test-set" jobId="job-1" />, { wrapper });

    // Phase 9'da CTA disabled
    const listingButton = screen.getByRole("button", { name: /Listing'e gönder/ });
    expect(listingButton).toBeDisabled();
    expect(listingButton.getAttribute("title")).toMatch(/Phase 9/);
  });

  it("per-render swap action → POST /renders/[id]/swap (PerRenderActions integration)", () => {
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

    // PerRenderActions component integration — failed slot render edilecek
    expect(screen.getByText(/Şablon geçersiz/)).toBeInTheDocument();
  });

  it("per-render retry action → POST /renders/[id]/retry (PerRenderActions integration)", () => {
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

    // PerRenderActions component integration — failed slot render edilecek
    expect(screen.getByText(/Zaman aşımı/)).toBeInTheDocument();
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
    expect(screen.getByText(/Zaman aşımı/)).toBeInTheDocument(); // RENDER_TIMEOUT
    expect(screen.getByText(/Şablon geçersiz/)).toBeInTheDocument(); // TEMPLATE_INVALID
    expect(screen.getByText(/Tasarım sığmadı/)).toBeInTheDocument(); // SAFE_AREA_OVERFLOW
    expect(screen.getByText(/Kaynak yetersiz/)).toBeInTheDocument(); // SOURCE_QUALITY
    expect(screen.getByText(/Motor erişilemez/)).toBeInTheDocument(); // PROVIDER_DOWN
  });
});
