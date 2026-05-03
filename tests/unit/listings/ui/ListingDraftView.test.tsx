/**
 * Phase 9 V1 Task 19 — ListingDraftView UI test (foundation slice).
 *
 * Spec §8.1.1 — Render detail view: images (cover + position badges),
 * readiness checklist (soft warn green/yellow), metadata summary (read-only).
 *
 * V1 scope: layout + data binding test. Edit form + actions test Task 20+.
 * Mock useListingDraft hook (server-side logic tested separately).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ListingDraftView } from "@/features/listings/ui/ListingDraftView";
import type { ListingDraftView as ListingDraftViewType } from "@/features/listings/types";

// Support both old and new ListingDraftView type name
type ListingDraft = ListingDraftViewType;

// Mock hooks
vi.mock("@/features/listings/hooks/useListingDraft", () => ({
  useListingDraft: vi.fn(),
}));

vi.mock("@/features/listings/hooks/useSubmitListingDraft", () => ({
  useSubmitListingDraft: vi.fn(),
}));

import { useListingDraft } from "@/features/listings/hooks/useListingDraft";
import { useSubmitListingDraft } from "@/features/listings/hooks/useSubmitListingDraft";

// Test fixture data
const mockListingDraft: ListingDraftViewType = {
  id: "clxywzk3f0000gl6h7k5j",
  status: "DRAFT",
  mockupJobId: "clxywzj9c0000a6h7k5j",
  coverRenderId: "render-1",
  imageOrder: [
    {
      packPosition: 0,
      renderId: "render-1",
      outputKey: "s3://bucket/render-1.jpg",
      templateName: "canvas_a4",
      isCover: true,
    },
    {
      packPosition: 1,
      renderId: "render-2",
      outputKey: "s3://bucket/render-2.jpg",
      templateName: "canvas_a4",
      isCover: false,
    },
    {
      packPosition: 2,
      renderId: "render-3",
      outputKey: "s3://bucket/render-3.jpg",
      templateName: "canvas_a4",
      isCover: false,
    },
  ],
  title: "Beautiful Canvas Wall Art",
  description: "Modern abstract design perfect for living rooms",
  tags: [
    "wall art",
    "canvas",
    "modern",
    "abstract",
    "home decor",
    "minimalist",
    "interior design",
    "contemporary",
    "trendy",
    "art print",
    "decoration",
    "living room",
    "gift",
  ],
  category: "wall art",
  priceCents: 2999,
  materials: ["canvas", "ink"],
  submittedAt: null,
  publishedAt: null,
  etsyListingId: null,
  failedReason: null,
  readiness: [
    {
      field: "title",
      pass: true,
      severity: "warn",
      message: "Başlık hazır",
    },
    {
      field: "description",
      pass: true,
      severity: "warn",
      message: "Açıklama hazır",
    },
    {
      field: "tags",
      pass: true,
      severity: "warn",
      message: "13 tag tamam",
    },
    {
      field: "category",
      pass: true,
      severity: "warn",
      message: "Kategori belirtildi",
    },
    {
      field: "price",
      pass: true,
      severity: "warn",
      message: "Fiyat belirtildi",
    },
    {
      field: "cover",
      pass: true,
      severity: "warn",
      message: "Cover görsel mevcut",
    },
  ],
  createdAt: "2026-05-02T10:00:00Z",
  updatedAt: "2026-05-02T10:05:00Z",
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithProvider(component: React.ReactNode) {
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
}

// Default submit mutation mock — idle state.
function defaultSubmitMutationMock(overrides: Record<string, unknown> = {}) {
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

describe("ListingDraftView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    // Default: idle submit mutation (not pending/success/error).
    (useSubmitListingDraft as any).mockReturnValue(defaultSubmitMutationMock());
  });

  it("should render loading state while fetching", () => {
    (useListingDraft as any).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);
    expect(screen.getByText(/Listing yükleniyor/i)).toBeTruthy();
  });

  it("should render error state on fetch failure", () => {
    const error = new Error("Network error");
    (useListingDraft as any).mockReturnValue({
      data: null,
      isLoading: false,
      error,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);
    expect(screen.getByText(/Listing yüklenemedi/i)).toBeTruthy();
    expect(screen.getByText(/Network error/i)).toBeTruthy();
  });

  it("should render listing detail with all metadata (Task 20: editable forms)", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // Title in input value (MetadataSection Task 20)
    expect(screen.getByDisplayValue("Beautiful Canvas Wall Art")).toBeTruthy();

    // Status (Turkish label via LISTING_STATUS_LABELS map)
    expect(screen.getByText(/Status: Taslak/i)).toBeTruthy();

    // Price in PricingSection input (Task 20: editable form)
    const priceInput = screen.getByLabelText("Fiyat (USD)") as HTMLInputElement;
    expect(priceInput.value).toBe("29.99");

    // Tags in MetadataSection input
    const tagsInput = screen.getByLabelText("Etiketler (maksimum 13)") as HTMLInputElement;
    expect(tagsInput.value).toContain("wall art");
  });

  it("should render image gallery with cover badge", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // Cover badge
    expect(screen.getByText(/★ COVER/)).toBeTruthy();

    // Position badges for other images
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.getByText("#3")).toBeTruthy();
  });

  it("should render 6 readiness checks with pass/fail indicators", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // Check title, description, tags, category, price, cover checks appear
    // (visible label + sr-only "geçti/uyarı" suffix → function matcher
    //  combines text content across elements within the same <p>)
    const expectFieldLabel = (label: string) => {
      expect(
        screen.getByText((_content, element) => {
          if (!element || element.tagName !== "P") return false;
          const text = element.textContent ?? "";
          return text.startsWith(`${label}:`);
        }),
      ).toBeTruthy();
    };
    expectFieldLabel("Title");
    expectFieldLabel("Description");
    expectFieldLabel("Tags");
    expectFieldLabel("Category");
    expectFieldLabel("Price");
    expectFieldLabel("Cover");

    // Check pass indicators (all pass = all ✓)
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks.length).toBe(6);
  });

  it("should render fail indicator (⚠) when readiness check fails", () => {
    const failingListing = {
      ...mockListingDraft,
      readiness: [
        ...mockListingDraft.readiness.slice(0, 1),
        { field: "description", pass: false, severity: "warn", message: "Açıklama girilmeli" },
        ...mockListingDraft.readiness.slice(2),
      ],
    };

    (useListingDraft as any).mockReturnValue({
      data: failingListing,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // Should have 1 warning indicator
    const warnings = screen.getAllByText("⚠");
    expect(warnings.length).toBeGreaterThan(0);

    // Check failing check message
    expect(screen.getByText("Açıklama girilmeli")).toBeTruthy();
  });

  it("should render editable metadata forms (Task 20: input fields visible)", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // MetadataSection + PricingSection inputs visible (Task 20)
    const inputs = screen.queryAllByRole("textbox");
    expect(inputs.length).toBeGreaterThan(0);

    // Verify description input contains the text
    expect(screen.getByDisplayValue(/Modern abstract design/)).toBeTruthy();
  });

  // Phase 9 V1 Task 22 — submit button activation (real endpoint binding).
  describe("submit button (Task 22)", () => {
    it("renders enabled submit button on DRAFT status by default", () => {
      (useListingDraft as any).mockReturnValue({
        data: mockListingDraft,
        isLoading: false,
        error: null,
      });

      renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

      const submitBtn = screen.getByRole("button", { name: /Taslak Gönder/i });
      expect(submitBtn).not.toHaveAttribute("disabled");
    });

    it("invokes submit mutation when button clicked", () => {
      const mutateSpy = vi.fn();
      (useListingDraft as any).mockReturnValue({
        data: mockListingDraft,
        isLoading: false,
        error: null,
      });
      (useSubmitListingDraft as any).mockReturnValue(
        defaultSubmitMutationMock({ mutate: mutateSpy }),
      );

      renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

      const submitBtn = screen.getByRole("button", { name: /Taslak Gönder/i });
      submitBtn.click();
      expect(mutateSpy).toHaveBeenCalledTimes(1);
    });

    it("shows pending label and disables button while submitting", () => {
      (useListingDraft as any).mockReturnValue({
        data: mockListingDraft,
        isLoading: false,
        error: null,
      });
      (useSubmitListingDraft as any).mockReturnValue(
        defaultSubmitMutationMock({ isPending: true, isIdle: false, status: "pending" }),
      );

      renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

      const submitBtn = screen.getByRole("button", { name: /Gönderiliyor…/i });
      expect(submitBtn).toHaveAttribute("disabled");
    });

    it("renders role=alert with error message on submit failure", () => {
      (useListingDraft as any).mockReturnValue({
        data: mockListingDraft,
        isLoading: false,
        error: null,
      });
      (useSubmitListingDraft as any).mockReturnValue(
        defaultSubmitMutationMock({
          isError: true,
          isIdle: false,
          status: "error",
          error: new Error("Etsy entegrasyonu yapılandırılmamış"),
        }),
      );

      renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toContain("Gönderme başarısız");
      expect(alert.textContent).toContain("Etsy entegrasyonu yapılandırılmamış");
    });

    it("renders role=status with Etsy listing ID on submit success", () => {
      (useListingDraft as any).mockReturnValue({
        data: mockListingDraft,
        isLoading: false,
        error: null,
      });
      (useSubmitListingDraft as any).mockReturnValue(
        defaultSubmitMutationMock({
          isSuccess: true,
          isIdle: false,
          status: "success",
          data: {
            status: "PUBLISHED" as const,
            etsyListingId: "1234567890",
            failedReason: null,
            providerSnapshot: "etsy-mock@v3-2026-05-03",
          },
        }),
      );

      renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

      // role=status banner: success message + Etsy listing ID
      const statuses = screen.getAllByRole("status");
      const successBanner = statuses.find((el) =>
        el.textContent?.includes("Etsy taslağı oluşturuldu"),
      );
      expect(successBanner).toBeTruthy();
      expect(successBanner?.textContent).toContain("1234567890");
    });

    it("disables button + shows status banner when listing is PUBLISHED (terminal)", () => {
      const publishedListing = {
        ...mockListingDraft,
        status: "PUBLISHED" as const,
        etsyListingId: "etsy-99999",
        publishedAt: "2026-05-03T10:00:00Z",
        submittedAt: "2026-05-03T10:00:00Z",
      };
      (useListingDraft as any).mockReturnValue({
        data: publishedListing,
        isLoading: false,
        error: null,
      });

      renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

      const submitBtn = screen.getByRole("button", { name: /Taslak Gönder/i });
      expect(submitBtn).toHaveAttribute("disabled");

      // PUBLISHED green banner with Etsy listing ID
      const statuses = screen.getAllByRole("status");
      const publishedBanner = statuses.find((el) =>
        el.textContent?.includes("Bu listing Etsy'ye gönderildi"),
      );
      expect(publishedBanner).toBeTruthy();
      expect(publishedBanner?.textContent).toContain("etsy-99999");

      // Disabled hint visible
      expect(screen.getByText(/Bu durumda yeniden gönderilemez/i)).toBeTruthy();
    });

    it("renders FAILED red banner with failedReason when listing previously failed", () => {
      const failedListing = {
        ...mockListingDraft,
        status: "FAILED" as const,
        failedReason: "Etsy V3 reddetti: taxonomy_id required",
        submittedAt: "2026-05-03T10:00:00Z",
      };
      (useListingDraft as any).mockReturnValue({
        data: failedListing,
        isLoading: false,
        error: null,
      });

      renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

      const statuses = screen.getAllByRole("status");
      const failedBanner = statuses.find((el) =>
        el.textContent?.includes("Önceki gönderim başarısız"),
      );
      expect(failedBanner).toBeTruthy();
      expect(failedBanner?.textContent).toContain(
        "Etsy V3 reddetti: taxonomy_id required",
      );

      // FAILED is terminal — submit button disabled
      const submitBtn = screen.getByRole("button", { name: /Taslak Gönder/i });
      expect(submitBtn).toHaveAttribute("disabled");
    });

    it("shows soft readiness warning text on DRAFT when readiness fails (does not block submit)", () => {
      const failingReadinessListing = {
        ...mockListingDraft,
        readiness: [
          ...mockListingDraft.readiness.slice(0, 1),
          {
            field: "description" as const,
            pass: false,
            severity: "warn" as const,
            message: "Açıklama girilmeli",
          },
          ...mockListingDraft.readiness.slice(2),
        ],
      };
      (useListingDraft as any).mockReturnValue({
        data: failingReadinessListing,
        isLoading: false,
        error: null,
      });

      renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

      // Soft warn text visible (does not block)
      expect(
        screen.getByText(/Bazı hazırlık kontrolleri eksik/i),
      ).toBeTruthy();

      // Submit button still ENABLED — soft warn, K3 lock
      const submitBtn = screen.getByRole("button", { name: /Taslak Gönder/i });
      expect(submitBtn).not.toHaveAttribute("disabled");
    });
  });

  it("should handle null/empty title gracefully", () => {
    const emptyTitleListing = {
      ...mockListingDraft,
      title: null,
    };

    (useListingDraft as any).mockReturnValue({
      data: emptyTitleListing,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // Should show placeholder
    expect(screen.getByText(/başlıksız/i)).toBeTruthy();
  });

  it("should handle empty tags array", () => {
    const noTagsListing = {
      ...mockListingDraft,
      tags: [],
    };

    (useListingDraft as any).mockReturnValue({
      data: noTagsListing,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // Should show "0/13 etiket" in MetadataSection counter
    expect(screen.getByText(/0\/13 etiket/)).toBeTruthy();
  });

  it("should display correct cover image with isCover=true", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    const coverImg = screen.getByAltText(/Kapak görseli/);
    expect(coverImg).toHaveAttribute("src", "s3://bucket/render-1.jpg");
  });

  // Task 20 slice tests: AssetSection mounted
  it("should render AssetSection with image gallery and ZIP download", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // AssetSection header "Görseller & Dosyalar"
    expect(screen.getByText("Görseller & Dosyalar")).toBeTruthy();

    // ZIP download link (all images ready)
    const zipLink = screen.getByRole("link", { name: /ZIP İndir/i });
    expect(zipLink).toBeTruthy();
    expect(zipLink).toHaveAttribute("href", `/api/listings/draft/${mockListingDraft.id}/assets/download`);

    // Mockup count badge (AssetSection mockupJobId check)
    expect(screen.getByText(/1 mockup/i)).toBeTruthy();
  });

  // Task 20 slice tests: MetadataSection mounted
  it("should render MetadataSection with title/description/tags inputs", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // MetadataSection header
    expect(screen.getByText("Başlık & Açıklama")).toBeTruthy();

    // Input fields now visible (not read-only)
    const titleInput = screen.getByLabelText("Başlık");
    const descInput = screen.getByLabelText("Açıklama");
    const tagsInput = screen.getByLabelText("Etiketler (maksimum 13)");

    expect(titleInput).toHaveValue("Beautiful Canvas Wall Art");
    expect(descInput).toHaveValue("Modern abstract design perfect for living rooms");
    expect(tagsInput).toHaveValue("wall art, canvas, modern, abstract, home decor, minimalist, interior design, contemporary, trendy, art print, decoration, living room, gift");

    // Save button visible
    const saveMetadataBtn = screen.getAllByRole("button", { name: /Kaydet/i })[0];
    expect(saveMetadataBtn).toBeTruthy();
  });

  // Task 20 slice tests: PricingSection mounted
  it("should render PricingSection with price and materials inputs", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // PricingSection header
    expect(screen.getByText("Fiyat & Malzemeler")).toBeTruthy();

    // Price input (converted from cents)
    const priceInput = screen.getByLabelText("Fiyat (USD)") as HTMLInputElement;
    expect(priceInput.value).toBe("29.99");

    // Materials input
    const materialsInput = screen.getByLabelText("Malzemeler");
    expect(materialsInput).toBeTruthy();

    // Save button visible
    const savePricingBtn = screen.getAllByRole("button", { name: /Kaydet/i })[1];
    expect(savePricingBtn).toBeTruthy();
  });
});
