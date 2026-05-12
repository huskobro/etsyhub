/**
 * Phase 9 V1 — ListingDraftView UI test (kompozisyon slice).
 *
 * Spec §8.1.1 — Render detail view: images (cover + position badges),
 * readiness checklist (soft warn green/yellow), metadata summary (read-only).
 *
 * V1 (Submit sonrası UX paketi): submit panel SubmitResultPanel'e delegate.
 * Bu test sadece kompozisyon + early returns + readiness + AssetSection /
 * MetadataSection / PricingSection mount'unu doğrular. Submit pipeline
 * davranışı SubmitResultPanel.test.tsx'te ayrı ele alınır.
 *
 * Mocks: useListingDraft (server-side logic) + SubmitResultPanel (delegate
 * bileşen, sadece mount kontrolü).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ListingDraftView } from "@/features/listings/ui/ListingDraftView";
import type { ListingDraftView as ListingDraftViewType } from "@/features/listings/types";

// Mock hooks
vi.mock("@/features/listings/hooks/useListingDraft", () => ({
  useListingDraft: vi.fn(),
}));

// Mock SubmitResultPanel — bu bileşenin davranışı ayrı testte; burada
// sadece doğru listing ile mount edildiğini doğrularız.
vi.mock("@/features/listings/components/SubmitResultPanel", () => ({
  SubmitResultPanel: ({ listing }: { listing: { id: string } }) => (
    <div data-testid="submit-result-panel">SubmitResultPanel({listing.id})</div>
  ),
}));

import { useListingDraft } from "@/features/listings/hooks/useListingDraft";

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
      // Pass 36 — signedUrl UI display için (outputKey raw key, ZIP için).
      signedUrl: "s3://bucket/render-1.jpg",
      templateName: "canvas_a4",
      isCover: true,
    },
    {
      packPosition: 1,
      renderId: "render-2",
      outputKey: "s3://bucket/render-2.jpg",
      signedUrl: "s3://bucket/render-2.jpg",
      templateName: "canvas_a4",
      isCover: false,
    },
    {
      packPosition: 2,
      renderId: "render-3",
      outputKey: "s3://bucket/render-3.jpg",
      signedUrl: "s3://bucket/render-3.jpg",
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
      message: "Title ready",
    },
    {
      field: "description",
      pass: true,
      severity: "warn",
      message: "Description ready",
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
  etsyShop: null,
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

describe("ListingDraftView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("should render loading state while fetching", () => {
    (useListingDraft as any).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);
    expect(screen.getByText(/Loading listing/i)).toBeTruthy();
  });

  it("should render error state on fetch failure", () => {
    const error = new Error("Network error");
    (useListingDraft as any).mockReturnValue({
      data: null,
      isLoading: false,
      error,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);
    expect(screen.getByText(/Failed to load listing/i)).toBeTruthy();
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

    // Status (label via LISTING_STATUS_LABELS map)
    expect(screen.getByText(/Status: Draft/i)).toBeTruthy();

    // Price in PricingSection input (Task 20: editable form)
    const priceInput = screen.getByLabelText("Price (USD)") as HTMLInputElement;
    expect(priceInput.value).toBe("29.99");

    // Tags in MetadataSection input
    const tagsInput = screen.getByLabelText("Tags (max 13)") as HTMLInputElement;
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
        { field: "description", pass: false, severity: "warn", message: "Description required" },
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
    expect(screen.getByText("Description required")).toBeTruthy();
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

  // Phase 9 V1 — submit panel artık SubmitResultPanel'e delegated.
  it("renders SubmitResultPanel mounted with current listing", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    const panel = screen.getByTestId("submit-result-panel");
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain(mockListingDraft.id);
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
    expect(screen.getByText(/untitled/i)).toBeTruthy();
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
    expect(screen.getByText(/0\/13 tags/)).toBeTruthy();
  });

  it("should display correct cover image with isCover=true", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    const coverImg = screen.getByAltText(/Cover image/);
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

    // AssetSection header "Images & Files"
    expect(screen.getByText("Images & Files")).toBeTruthy();

    // ZIP download link (all images ready)
    const zipLink = screen.getByRole("link", { name: /Download ZIP/i });
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
    expect(screen.getByText("Title & Description")).toBeTruthy();

    // Input fields now visible (not read-only)
    const titleInput = screen.getByLabelText("Title");
    const descInput = screen.getByLabelText("Description");
    const tagsInput = screen.getByLabelText("Tags (max 13)");

    expect(titleInput).toHaveValue("Beautiful Canvas Wall Art");
    expect(descInput).toHaveValue("Modern abstract design perfect for living rooms");
    expect(tagsInput).toHaveValue("wall art, canvas, modern, abstract, home decor, minimalist, interior design, contemporary, trendy, art print, decoration, living room, gift");

    // Save button visible
    const saveMetadataBtn = screen.getAllByRole("button", { name: /Save/i })[0];
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
    expect(screen.getByText("Price & Materials")).toBeTruthy();

    // Price input (converted from cents)
    const priceInput = screen.getByLabelText("Price (USD)") as HTMLInputElement;
    expect(priceInput.value).toBe("29.99");

    // Materials input
    const materialsInput = screen.getByLabelText("Materials");
    expect(materialsInput).toBeTruthy();

    // Save button visible
    const savePricingBtn = screen.getAllByRole("button", { name: /Save/i })[1];
    expect(savePricingBtn).toBeTruthy();
  });
});
