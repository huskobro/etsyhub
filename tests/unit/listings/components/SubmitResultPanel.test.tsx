// Phase 9 V1 — SubmitResultPanel component test (jsdom env).
//
// Mocks: useSubmitListingDraft + useResetListingToDraft (separately stubbed).
//
// Senaryolar (~10):
// - DRAFT (no warn): submit button enabled, banner yok
// - DRAFT + readiness warn: sarı uyarı görünür, submit hâlâ enabled
// - PUBLISHED + etsyListingId + etsyShop: yeşil banner + shopName + Etsy
//   listing ID + "Etsy'de Aç" link href + "Mağazaya Git" link
// - PUBLISHED + etsyShop null: banner var ama "Mağazaya Git" link YOK
// - PUBLISHED + failedReason (partial): "Not: ..." mesajı
// - FAILED + failedReason: kırmızı banner + "Yeniden DRAFT'a çevir" button +
//   reset mutation çağrısı
// - FAILED + etsyListingId: "Orphan'ı Aç" link
// - Submit isPending: button "Gönderiliyor…" + disabled
// - Submit isSuccess (taze): green panel + ImageUploadDiagnostics expand/collapse +
//   provider snapshot
// - Submit isError (taze): red panel + error message
// - Reset mutation isError: "Sıfırlama başarısız: ..."

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { SubmitResultPanel } from "@/features/listings/components/SubmitResultPanel";
import type { ListingDraftView } from "@/features/listings/types";

vi.mock("@/features/listings/hooks/useSubmitListingDraft", () => ({
  useSubmitListingDraft: vi.fn(),
}));

vi.mock("@/features/listings/hooks/useResetListingToDraft", () => ({
  useResetListingToDraft: vi.fn(),
}));

import { useSubmitListingDraft } from "@/features/listings/hooks/useSubmitListingDraft";
import { useResetListingToDraft } from "@/features/listings/hooks/useResetListingToDraft";

const baseListing: ListingDraftView = {
  id: "clxywzk3f0000gl6h7k5j",
  status: "DRAFT",
  mockupJobId: "job-1",
  coverRenderId: "render-1",
  imageOrder: [],
  title: "Test Listing",
  description: "Test desc",
  tags: ["a"],
  category: "wall_art",
  priceCents: 2999,
  materials: [],
  submittedAt: null,
  publishedAt: null,
  etsyListingId: null,
  failedReason: null,
  readiness: [
    { field: "title", pass: true, severity: "warn", message: "ok" },
    { field: "description", pass: true, severity: "warn", message: "ok" },
    { field: "tags", pass: true, severity: "warn", message: "ok" },
    { field: "category", pass: true, severity: "warn", message: "ok" },
    { field: "price", pass: true, severity: "warn", message: "ok" },
    { field: "cover", pass: true, severity: "warn", message: "ok" },
  ],
  etsyShop: null,
  createdAt: "2026-05-02T10:00:00Z",
  updatedAt: "2026-05-02T10:05:00Z",
};

function defaultSubmitMock(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    error: null,
    data: undefined,
    status: "idle" as const,
    reset: vi.fn(),
    variables: undefined,
    context: undefined,
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    ...overrides,
  };
}

function defaultResetMock(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    error: null,
    data: undefined,
    status: "idle" as const,
    reset: vi.fn(),
    variables: undefined,
    context: undefined,
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    ...overrides,
  };
}

function renderWithProvider(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("<SubmitResultPanel>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useSubmitListingDraft as any).mockReturnValue(defaultSubmitMock());
    (useResetListingToDraft as any).mockReturnValue(defaultResetMock());
  });

  it("DRAFT (no warn): submit button enabled, banner yok", () => {
    renderWithProvider(<SubmitResultPanel listing={baseListing} />);

    const btn = screen.getByRole("button", { name: /Taslak Gönder/i });
    expect(btn).not.toHaveAttribute("disabled");

    expect(screen.queryByText(/hazırlık kontrolleri eksik/i)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("DRAFT + readiness warn: sarı uyarı görünür, submit hâlâ enabled", () => {
    const listing = {
      ...baseListing,
      readiness: [
        ...baseListing.readiness.slice(0, 1),
        {
          field: "description" as const,
          pass: false,
          severity: "warn" as const,
          message: "x",
        },
        ...baseListing.readiness.slice(2),
      ],
    };

    renderWithProvider(<SubmitResultPanel listing={listing} />);

    expect(
      screen.getByText(/Bazı hazırlık kontrolleri eksik/i),
    ).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /Taslak Gönder/i });
    expect(btn).not.toHaveAttribute("disabled");
  });

  it("PUBLISHED + etsyListingId + etsyShop: yeşil banner + Etsy'de Aç href + Mağazaya Git link", () => {
    const listing: ListingDraftView = {
      ...baseListing,
      status: "PUBLISHED",
      etsyListingId: "12345",
      etsyShop: { shopId: "55555", shopName: "EtsyHubStore" },
      submittedAt: "2026-05-03T10:00:00Z",
      publishedAt: "2026-05-03T10:00:00Z",
    };

    renderWithProvider(<SubmitResultPanel listing={listing} />);

    expect(screen.getByText(/Etsy'ye gönderildi/i)).toBeInTheDocument();
    expect(screen.getByText(/EtsyHubStore/)).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();

    const etsyLink = screen.getByRole("link", { name: /Etsy'de Aç/i });
    expect(etsyLink).toHaveAttribute(
      "href",
      "https://www.etsy.com/your/shops/me/tools/listings/12345",
    );

    const shopLink = screen.getByRole("link", { name: /Mağazaya Git/i });
    expect(shopLink).toHaveAttribute(
      "href",
      "https://www.etsy.com/shop/EtsyHubStore",
    );
  });

  it("PUBLISHED + etsyShop null: banner var ama 'Mağazaya Git' link YOK", () => {
    const listing: ListingDraftView = {
      ...baseListing,
      status: "PUBLISHED",
      etsyListingId: "12345",
      etsyShop: null,
    };

    renderWithProvider(<SubmitResultPanel listing={listing} />);

    expect(screen.getByText(/Etsy'ye gönderildi/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Etsy'de Aç/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mağazaya Git/i })).toBeNull();
  });

  it("PUBLISHED + failedReason (partial): 'Not: ...' mesajı", () => {
    const listing: ListingDraftView = {
      ...baseListing,
      status: "PUBLISHED",
      etsyListingId: "12345",
      failedReason: "Image upload kısmen başarısız: 2/3",
    };

    renderWithProvider(<SubmitResultPanel listing={listing} />);

    expect(screen.getByText(/Not: Image upload kısmen başarısız/)).toBeInTheDocument();
  });

  it("FAILED + failedReason: kırmızı banner + 'Yeniden DRAFT'a çevir' button + reset mutation çağrısı", () => {
    const resetMock = defaultResetMock();
    (useResetListingToDraft as any).mockReturnValue(resetMock);

    const listing: ListingDraftView = {
      ...baseListing,
      status: "FAILED",
      failedReason: "Etsy V3 reddetti: taxonomy_id required",
      submittedAt: "2026-05-03T10:00:00Z",
    };

    renderWithProvider(<SubmitResultPanel listing={listing} />);

    expect(screen.getByText(/Önceki gönderim başarısız/)).toBeInTheDocument();
    expect(screen.getByText(/taxonomy_id required/)).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", {
      name: /Yeniden DRAFT'a çevir/i,
    });
    fireEvent.click(resetBtn);
    expect(resetMock.mutate).toHaveBeenCalledTimes(1);
  });

  it("FAILED + etsyListingId: 'Orphan'ı Aç' link doğru href", () => {
    const listing: ListingDraftView = {
      ...baseListing,
      status: "FAILED",
      failedReason: "Image upload all failed",
      etsyListingId: "L-ORPHAN-77777",
    };

    renderWithProvider(<SubmitResultPanel listing={listing} />);

    const orphanLink = screen.getByRole("link", { name: /Etsy'de Orphan'ı Aç/i });
    expect(orphanLink).toHaveAttribute(
      "href",
      "https://www.etsy.com/your/shops/me/tools/listings/L-ORPHAN-77777",
    );
  });

  it("Submit isPending: button 'Gönderiliyor…' + disabled", () => {
    (useSubmitListingDraft as any).mockReturnValue(
      defaultSubmitMock({ isPending: true, isIdle: false, status: "pending" }),
    );

    renderWithProvider(<SubmitResultPanel listing={baseListing} />);

    const btn = screen.getByRole("button", { name: /Gönderiliyor…/i });
    expect(btn).toHaveAttribute("disabled");
  });

  it("Submit isSuccess (taze): green panel + ImageUploadDiagnostics expand + provider snapshot", () => {
    (useSubmitListingDraft as any).mockReturnValue(
      defaultSubmitMock({
        isSuccess: true,
        isIdle: false,
        status: "success",
        data: {
          status: "PUBLISHED",
          etsyListingId: "9999",
          failedReason: null,
          providerSnapshot: "etsy-api-v3@2026-05-03",
          imageUpload: {
            successCount: 2,
            failedCount: 1,
            partial: true,
            attempts: [
              {
                rank: 1,
                packPosition: 0,
                renderId: "r0",
                isCover: true,
                ok: true,
                etsyImageId: "i-1",
              },
              {
                rank: 2,
                packPosition: 1,
                renderId: "r1",
                isCover: false,
                ok: false,
                error: "503 maintenance",
              },
              {
                rank: 3,
                packPosition: 2,
                renderId: "r2",
                isCover: false,
                ok: true,
                etsyImageId: "i-3",
              },
            ],
          },
        },
      }),
    );

    renderWithProvider(<SubmitResultPanel listing={baseListing} />);

    expect(screen.getByText(/Etsy taslağı oluşturuldu/i)).toBeInTheDocument();
    expect(screen.getByText("9999")).toBeInTheDocument();

    // Diagnostics summary
    expect(
      screen.getByText(/Görsel yükleme: 2\/3 başarılı/),
    ).toBeInTheDocument();
    expect(screen.getByText(/\(1 başarısız\)/)).toBeInTheDocument();

    // Expand details
    const toggleBtn = screen.getByRole("button", { name: /Detayı göster/i });
    fireEvent.click(toggleBtn);

    // Detail entries appear (rank=1 cover ok, rank=2 fail, rank=3 ok)
    expect(screen.getByText(/Etsy image ID: i-1/)).toBeInTheDocument();
    expect(screen.getByText(/503 maintenance/)).toBeInTheDocument();
    expect(screen.getByText(/Etsy image ID: i-3/)).toBeInTheDocument();

    // Collapse
    const collapseBtn = screen.getByRole("button", { name: /Detayı gizle/i });
    expect(collapseBtn).toBeInTheDocument();

    // Provider snapshot
    expect(screen.getByText(/Provider: etsy-api-v3@2026-05-03/)).toBeInTheDocument();

    // Etsy URL pattern
    const etsyLink = screen.getByRole("link", { name: /Etsy'de Aç/i });
    expect(etsyLink).toHaveAttribute(
      "href",
      expect.stringMatching(
        /^https:\/\/www\.etsy\.com\/your\/shops\/me\/tools\/listings\/9999$/,
      ),
    );
  });

  it("Submit isError (taze): red panel + error message", () => {
    (useSubmitListingDraft as any).mockReturnValue(
      defaultSubmitMock({
        isError: true,
        isIdle: false,
        status: "error",
        error: new Error("Etsy entegrasyonu yapılandırılmamış"),
      }),
    );

    renderWithProvider(<SubmitResultPanel listing={baseListing} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Gönderme başarısız");
    expect(alert.textContent).toContain("Etsy entegrasyonu yapılandırılmamış");
  });

  it("Reset mutation isError: 'Sıfırlama başarısız: ...'", () => {
    (useResetListingToDraft as any).mockReturnValue(
      defaultResetMock({
        isError: true,
        isIdle: false,
        status: "error",
        error: new Error("Sunucu hatası"),
      }),
    );

    const listing: ListingDraftView = {
      ...baseListing,
      status: "FAILED",
      failedReason: "Test",
    };

    renderWithProvider(<SubmitResultPanel listing={listing} />);

    expect(screen.getByText(/Sıfırlama başarısız: Sunucu hatası/)).toBeInTheDocument();
  });
});
