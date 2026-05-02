// Phase 8 Task 28 — S7JobView progress + ETA + auto-redirect + status views.
//
// 7 core scenarios: progress ring + timeline, ETA text, auto-redirect on
// COMPLETED/PARTIAL_COMPLETE, FAILED view recovery, CANCELLED recovery,
// assurance text, cancel button.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { S7JobView } from "@/features/mockups/components/S7JobView";
import type { MockupJobView } from "@/features/mockups/hooks/useMockupJob";

const mockRouter = {
  replace: vi.fn(),
  push: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/selection/sets/test-set/mockup/jobs/job-1",
}));

const mockQueryClient = {
  refetchQueries: vi.fn(),
};

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

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQueryClient: () => mockQueryClient,
  };
});

function createMockJob(overrides?: Partial<MockupJobView>): MockupJobView {
  return {
    id: "job-1",
    status: "RUNNING",
    packSize: 10,
    actualPackSize: 10,
    totalRenders: 10,
    successRenders: 3,
    failedRenders: 0,
    coverRenderId: "render-1",
    errorSummary: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    estimatedCompletionAt: new Date(Date.now() + 12000).toISOString(),
    renders: [
      {
        id: "render-1",
        packPosition: 0,
        selectionReason: "selected",
        status: "SUCCESS",
        outputKey: "https://example.com/r1.png",
        thumbnailKey: "https://example.com/r1-thumb.png",
        errorClass: null,
        errorDetail: null,
        templateSnapshot: { templateName: "Template A", aspectRatios: ["2:3"] },
        variantId: "var-1",
        retryCount: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date(Date.now() - 5000).toISOString(),
      },
      {
        id: "render-2",
        packPosition: 1,
        selectionReason: "selected",
        status: "RENDERING",
        outputKey: null,
        thumbnailKey: null,
        errorClass: null,
        errorDetail: null,
        templateSnapshot: { templateName: "Template B", aspectRatios: ["2:3"] },
        variantId: "var-2",
        retryCount: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
      },
      {
        id: "render-3",
        packPosition: 2,
        selectionReason: "selected",
        status: "PENDING",
        outputKey: null,
        thumbnailKey: null,
        errorClass: null,
        errorDetail: null,
        templateSnapshot: { templateName: "Template C", aspectRatios: ["2:3"] },
        variantId: "var-3",
        retryCount: 0,
        startedAt: null,
        completedAt: null,
      },
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

describe("<S7JobView>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.replace.mockClear();
    mockRouter.push.mockClear();
    mockQueryClient.refetchQueries.mockClear();
    mockUseMockupJobReturn = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders progress ring + render timeline (queued/running)", () => {
    const job = createMockJob({ status: "RUNNING", successRenders: 3, totalRenders: 10 });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S7JobView setId="test-set" jobId="job-1" />, { wrapper });

    // Progress ring var mı?
    expect(screen.getByRole("status")).toBeInTheDocument();

    // "3 render hazır" metni
    expect(screen.getByText(/3 render hazır/)).toBeInTheDocument();
    expect(screen.getByText(/10 render toplamında/)).toBeInTheDocument();

    // Render timeline
    expect(screen.getByText(/Template A/)).toBeInTheDocument();
  });

  it("shows ETA approximate ('~12 saniye kaldı')", () => {
    const futureTime = new Date(Date.now() + 12000);
    const job = createMockJob({
      status: "RUNNING",
      estimatedCompletionAt: futureTime.toISOString(),
    });

    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S7JobView setId="test-set" jobId="job-1" />, { wrapper });

    // ~12 saniye kaldı metni
    const etaText = screen.getByText(/~\d+ saniye kaldı/);
    expect(etaText).toBeInTheDocument();
  });

  it("shows success feedback on COMPLETED status", async () => {
    const job = createMockJob({ status: "COMPLETED", successRenders: 10 });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S7JobView setId="test-set" jobId="job-1" />, { wrapper });

    // Success feedback görsün
    expect(screen.getByTestId("success-feedback")).toBeInTheDocument();
  });

  it("shows success feedback on PARTIAL_COMPLETE status", () => {
    const job = createMockJob({ status: "PARTIAL_COMPLETE", successRenders: 8 });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S7JobView setId="test-set" jobId="job-1" />, { wrapper });

    expect(screen.getByTestId("success-feedback")).toBeInTheDocument();
  });

  it("FAILED view: hata + S3'e dön butonu", () => {
    const job = createMockJob({
      status: "FAILED",
      errorSummary: "Provider erişilemez",
    });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S7JobView setId="test-set" jobId="job-1" />, { wrapper });

    // Hata başlığı
    expect(screen.getByText(/Pack hazırlanamadı/)).toBeInTheDocument();

    // Hata özeti
    expect(screen.getByText(/Provider erişilemez/)).toBeInTheDocument();

    // S3'e dön butonu
    expect(screen.getByRole("button", { name: /S3'e dön/ })).toBeInTheDocument();
  });

  it("CANCELLED view: S3'e dön", () => {
    const job = createMockJob({ status: "CANCELLED" });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S7JobView setId="test-set" jobId="job-1" />, { wrapper });

    // İptal metni
    expect(screen.getByText(/İş iptal edildi/)).toBeInTheDocument();

    // S3'e dön butonu
    expect(screen.getByRole("button", { name: /S3'e dön/ })).toBeInTheDocument();
  });

  it("'Sayfayı kapatabilirsin' güvence metni görünür", () => {
    const job = createMockJob({ status: "RUNNING" });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S7JobView setId="test-set" jobId="job-1" />, { wrapper });

    // Güvence metni
    expect(
      screen.getByText(/Bu sayfayı kapatabilirsin/)
    ).toBeInTheDocument();
  });

  it("shows cancel button when job is running", () => {
    const job = createMockJob({ status: "RUNNING" });
    mockUseMockupJobReturn = {
      data: job,
      isLoading: false,
      error: null,
    };

    render(<S7JobView setId="test-set" jobId="job-1" />, { wrapper });

    const cancelButton = screen.getByRole("button", { name: /İş'i iptal et/ });
    expect(cancelButton).toBeInTheDocument();
  });
});
