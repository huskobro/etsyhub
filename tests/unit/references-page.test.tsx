/**
 * references-page.test.tsx
 *
 * ReferencesPage primitive entegrasyonu — v5 ReferencesPool spec doğrulaması.
 *
 * Not: R11.14 migrasyonunda ReferencesPage, v5 IA'yı uygulayan
 * ReferencePoolCard + FilterChip + FloatingBulkBar (k-fab) tabanlı
 * yeni bir yapıya geçti. Testler bu yeni yapıya göre güncellendi.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReferencesPage } from "@/features/references/components/references-page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => "/references",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  pushMock.mockReset();
  vi.unstubAllGlobals();
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

function mockFetch(
  references: unknown[],
  collectionsResponse: {
    items: { id: string; name: string; _count: { references: number } }[];
    uncategorizedReferenceCount: number;
    orphanedReferenceCount: number;
  } = {
    items: [],
    uncategorizedReferenceCount: 0,
    orphanedReferenceCount: 0,
  },
) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/references")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: references, nextCursor: null }),
      });
    }
    if (url.startsWith("/api/collections")) {
      return Promise.resolve({ ok: true, json: async () => collectionsResponse });
    }
    if (url.includes("/api/assets/")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ url: "https://example.com/img.jpg" }),
      });
    }
    if (url.startsWith("/api/tags") || url.startsWith("/api/product-types")) {
      return Promise.resolve({ ok: true, json: async () => ({ items: [] }) });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const sampleRef = (id: string, title: string) => ({
  id,
  notes: null,
  createdAt: new Date("2026-04-20").toISOString(),
  asset: { id: `asset-${id}`, storageKey: `k/${id}`, bucket: "b" },
  productType: { id: "pt", displayName: "Canvas" },
  collection: null,
  bookmark: { id: `bm-${id}`, title, sourceUrl: `https://example.com/${id}` },
  tags: [],
});

const productTypes = [{ id: "pt", displayName: "Canvas" }];

describe("ReferencesPage", () => {
  it("loading → loading state render olur (SkeletonGrid)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = wrapper(<ReferencesPage productTypes={productTypes} />);
    // SkeletonGrid'in k-card'ları animate-pulse içerir (loading indicator)
    await waitFor(() => {
      const pulsing = container.querySelectorAll(".animate-pulse");
      expect(pulsing.length).toBeGreaterThan(0);
    });
  });

  it("empty → 'No references yet' StateMessage render eder", async () => {
    mockFetch([]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    expect(await screen.findByText("No references yet")).toBeInTheDocument();
  });

  it("default → kart başlıkları görünür", async () => {
    mockFetch([sampleRef("r1", "Boho Print"), sampleRef("r2", "Çiçek")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    expect(await screen.findByText("Boho Print")).toBeInTheDocument();
    expect(screen.getByText("Çiçek")).toBeInTheDocument();
  });

  it("arama → fetch URL'i q=<term> içerir", async () => {
    const fetchMock = mockFetch([]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    // Search input data-testid="references-search"
    const searchInput = await screen.findByTestId("references-search");
    act(() => fireEvent.change(searchInput, { target: { value: "boho" } }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("q=boho"))).toBe(true);
    });
  });

  it("multi-select → BulkBar '{N} selected' + Archive butonu görünür", async () => {
    mockFetch([sampleRef("r1", "A"), sampleRef("r2", "B")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("A");
    const selectBtns = screen.getAllByRole("button", { name: "Select" });
    act(() => {
      fireEvent.click(selectBtns[0]!);
      fireEvent.click(selectBtns[1]!);
    });
    // FloatingBulkBar (k-fab)
    const bulkBar = await screen.findByTestId("references-bulk-bar");
    expect(bulkBar).toBeInTheDocument();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("bulk archive → dialog archiveReferencesBulk(2) preset'i gösterir", async () => {
    mockFetch([sampleRef("r1", "A"), sampleRef("r2", "B")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("A");
    const selectBtns = screen.getAllByRole("button", { name: "Select" });
    act(() => {
      fireEvent.click(selectBtns[0]!);
      fireEvent.click(selectBtns[1]!);
    });
    await screen.findByTestId("references-bulk-bar");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    });
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Confirm preset "Seçili referansları arşivle" hâlâ Türkçe
    expect(screen.getByText("Seçili referansları arşivle")).toBeInTheDocument();
  });

  it("dismiss → selection temizlenir, BulkBar gizlenir", async () => {
    mockFetch([sampleRef("r1", "A")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("A");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Select" }));
    });
    await screen.findByTestId("references-bulk-bar");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    });
    await waitFor(() => {
      expect(screen.queryByTestId("references-bulk-bar")).not.toBeInTheDocument();
    });
  });
});
