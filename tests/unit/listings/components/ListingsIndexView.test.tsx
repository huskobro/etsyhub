// Phase 9 V1 — ListingsIndexView component test (jsdom env).
//
// Senaryolar:
// - Loading state
// - Error state
// - Empty state (no listings)
// - Empty state with status filter
// - Listings grid (3 listings)
// - Status badge render per listing
// - Filter button click → URL update
// - Active filter highlight (aria-pressed)
// - Listing card → Link to /listings/draft/[id]

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ListingsIndexView } from "@/features/listings/components/ListingsIndexView";
import type { ListingIndexView } from "@/features/listings/types";

const mockRouter = { push: vi.fn(), replace: vi.fn() };
let mockSearchParams = new URLSearchParams("");

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/listings",
}));

let mockUseListingsReturn: any = { data: [], isLoading: false, error: null };

vi.mock("@/features/listings/hooks/useListings", () => ({
  useListings: vi.fn(() => mockUseListingsReturn),
}));

function makeListing(overrides?: Partial<ListingIndexView>): ListingIndexView {
  return {
    id: "listing-1",
    status: "DRAFT",
    mockupJobId: "job-1",
    coverRenderId: "render-1",
    title: "Test Listing",
    priceCents: 1999,
    submittedAt: null,
    publishedAt: null,
    etsyListingId: null,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
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

describe("<ListingsIndexView>", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter.push.mockClear();
    mockSearchParams = new URLSearchParams("");
    mockUseListingsReturn = { data: [], isLoading: false, error: null };
  });

  it("loading state görünür", () => {
    mockUseListingsReturn = { data: undefined, isLoading: true, error: null };
    render(<ListingsIndexView />, { wrapper });
    expect(screen.getByRole("status")).toHaveTextContent(/yükleniyor/i);
  });

  it("error state görünür", () => {
    mockUseListingsReturn = {
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
    };
    render(<ListingsIndexView />, { wrapper });
    expect(screen.getByRole("alert")).toHaveTextContent(/Network error/);
  });

  it("empty state — listing yok mesajı", () => {
    mockUseListingsReturn = { data: [], isLoading: false, error: null };
    render(<ListingsIndexView />, { wrapper });
    expect(screen.getByText(/Henüz listing yok/i)).toBeInTheDocument();
  });

  it("empty state with status filter", () => {
    mockSearchParams = new URLSearchParams("status=PUBLISHED");
    mockUseListingsReturn = { data: [], isLoading: false, error: null };
    render(<ListingsIndexView />, { wrapper });
    expect(screen.getByText(/Yayınlanmış durumda listing yok/i)).toBeInTheDocument();
  });

  it("listings grid render edilir (3 listing)", () => {
    mockUseListingsReturn = {
      data: [
        makeListing({ id: "l1", title: "Birinci", status: "DRAFT" }),
        makeListing({ id: "l2", title: "İkinci", status: "PUBLISHED" }),
        makeListing({ id: "l3", title: "Üçüncü", status: "FAILED" }),
      ],
      isLoading: false,
      error: null,
    };
    render(<ListingsIndexView />, { wrapper });
    expect(screen.getByText("Birinci")).toBeInTheDocument();
    expect(screen.getByText("İkinci")).toBeInTheDocument();
    expect(screen.getByText("Üçüncü")).toBeInTheDocument();
  });

  it("status badge per listing render edilir", () => {
    mockUseListingsReturn = {
      data: [makeListing({ id: "l1", status: "DRAFT" })],
      isLoading: false,
      error: null,
    };
    render(<ListingsIndexView />, { wrapper });
    expect(screen.getByTestId("listing-status-l1")).toHaveTextContent(/Taslak/);
  });

  it("listing card → /listings/draft/[id] link'e bağlı", () => {
    mockUseListingsReturn = {
      data: [makeListing({ id: "abc123" })],
      isLoading: false,
      error: null,
    };
    render(<ListingsIndexView />, { wrapper });
    const link = screen.getByRole("link", { name: /Test Listing/ });
    expect(link).toHaveAttribute("href", "/listings/draft/abc123");
  });

  it("filter button click → router.push çağrılır", () => {
    render(<ListingsIndexView />, { wrapper });
    const draftButton = screen.getByRole("button", { name: /Taslak/ });
    fireEvent.click(draftButton);
    expect(mockRouter.push).toHaveBeenCalledWith(
      "/listings?status=DRAFT",
      { scroll: false },
    );
  });

  it("active filter aria-pressed highlight", () => {
    mockSearchParams = new URLSearchParams("status=PUBLISHED");
    render(<ListingsIndexView />, { wrapper });
    const publishedButton = screen.getByRole("button", { name: /Yayınlanmış/ });
    expect(publishedButton).toHaveAttribute("aria-pressed", "true");
  });

  // Phase 9 V1 — Submit sonrası UX paketi: PUBLISHED card'da Etsy admin link.
  it("PUBLISHED card'da 'Etsy'de Aç' link doğru href ile render edilir", () => {
    mockUseListingsReturn = {
      data: [
        makeListing({
          id: "lpub",
          title: "Published Listing",
          status: "PUBLISHED",
          etsyListingId: "12345",
        }),
      ],
      isLoading: false,
      error: null,
    };
    render(<ListingsIndexView />, { wrapper });

    const etsyLink = screen.getByRole("link", { name: /Etsy'de Aç/i });
    expect(etsyLink).toHaveAttribute(
      "href",
      "https://www.etsy.com/your/shops/me/tools/listings/12345",
    );
    expect(etsyLink).toHaveAttribute("target", "_blank");
  });

  it("DRAFT card'da 'Etsy'de Aç' link YOK", () => {
    mockUseListingsReturn = {
      data: [
        makeListing({
          id: "ldraft",
          title: "Draft Listing",
          status: "DRAFT",
          etsyListingId: null,
        }),
      ],
      isLoading: false,
      error: null,
    };
    render(<ListingsIndexView />, { wrapper });

    expect(screen.queryByRole("link", { name: /Etsy'de Aç/i })).toBeNull();
  });
});
