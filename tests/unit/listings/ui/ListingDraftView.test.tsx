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

// Mock hook
vi.mock("@/features/listings/hooks/useListingDraft", () => ({
  useListingDraft: vi.fn(),
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

  it("should render listing detail with all metadata", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // Title should display
    expect(screen.getByText("Beautiful Canvas Wall Art")).toBeTruthy();

    // Status
    expect(screen.getByText(/Status: DRAFT/i)).toBeTruthy();

    // Price
    expect(screen.getByText(/\$29.99/)).toBeTruthy();

    // Tags (should show count and at least one tag)
    expect(screen.getByText(/13\/13/)).toBeTruthy();
    expect(screen.getByText("wall art")).toBeTruthy();
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
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByText("Tags")).toBeTruthy();
    expect(screen.getByText("Category")).toBeTruthy();
    expect(screen.getByText("Price")).toBeTruthy();
    expect(screen.getByText("Cover")).toBeTruthy();

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

  it("should render metadata summary as read-only (no input fields)", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    // Verify displayed as text, not as input fields
    const descriptionText = screen.getByText(/Modern abstract design/);
    expect(descriptionText).toBeTruthy();

    // Should NOT have input fields (Task 20)
    const inputs = screen.queryAllByRole("textbox");
    expect(inputs.length).toBe(0);
  });

  it("should render disabled action buttons (Task 20+ placeholder)", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    const editBtn = screen.getByRole("button", { name: /Düzenle/ });
    const submitBtn = screen.getByRole("button", { name: /Taslak Gönder/ });

    expect(editBtn).toHaveAttribute("disabled");
    expect(submitBtn).toHaveAttribute("disabled");
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

    // Should show "etiket yok" — check that empty tag placeholder renders
    expect(screen.getByText(/0\/13/)).toBeTruthy(); // tag count badge
    const placeholder = screen.getByText(/etiket yok/);
    expect(placeholder).toBeTruthy();
  });

  it("should display correct cover image with isCover=true", () => {
    (useListingDraft as any).mockReturnValue({
      data: mockListingDraft,
      isLoading: false,
      error: null,
    });

    renderWithProvider(<ListingDraftView id="clxywzk3f0000gl6h7k5j" />);

    const coverImg = screen.getByAltText("cover");
    expect(coverImg).toHaveAttribute("src", "s3://bucket/render-1.jpg");
  });
});
