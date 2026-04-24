/**
 * references-page.test.tsx
 *
 * ReferencesPage primitive entegrasyonu — T-16 spec doğrulaması.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReferencesPage } from "@/features/references/components/references-page";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
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
  it("loading → SkeletonCardGrid (role=status)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    wrapper(<ReferencesPage productTypes={productTypes} />);
    const skeletons = await screen.findAllByRole("status");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("empty → StateMessage + Referans ekle CTA (disabled)", async () => {
    mockFetch([]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    expect(await screen.findByText("Henüz referans yok")).toBeInTheDocument();
  });

  it("default → kart başlıkları görünür, üst özet 'N referans'", async () => {
    mockFetch([sampleRef("r1", "Boho Print"), sampleRef("r2", "Çiçek")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    expect(await screen.findByText("Boho Print")).toBeInTheDocument();
    expect(screen.getByText(/2 referans/)).toBeInTheDocument();
  });

  it("chip filter: specific cuid → fetch URL'i collectionId=<cuid> içerir", async () => {
    const fetchMock = mockFetch([sampleRef("r1", "Boho")], {
      items: [
        { id: "cksnbp3sf0000abcdzxvmn123", name: "Boho", _count: { references: 1 } },
      ],
      uncategorizedReferenceCount: 0,
      orphanedReferenceCount: 0,
    });
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("Boho");
    const chip = await screen.findByRole("button", { name: /Boho · 1/ });
    act(() => fireEvent.click(chip));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("collectionId=cksnbp3sf0000abcdzxvmn123"))).toBe(true);
    });
  });

  it("chip filter: uncategorized → fetch URL'i collectionId=uncategorized içerir", async () => {
    const fetchMock = mockFetch([], {
      items: [],
      uncategorizedReferenceCount: 4,
      orphanedReferenceCount: 0,
    });
    wrapper(<ReferencesPage productTypes={productTypes} />);
    const chip = await screen.findByRole("button", { name: /Koleksiyonsuz · 4/ });
    act(() => fireEvent.click(chip));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("collectionId=uncategorized"))).toBe(true);
    });
  });

  it("Tümü · N sayacı = Σ _count.references + uncategorized + orphan", async () => {
    mockFetch([], {
      items: [
        { id: "c1", name: "A", _count: { references: 3 } },
        { id: "c2", name: "B", _count: { references: 5 } },
      ],
      uncategorizedReferenceCount: 4,
      orphanedReferenceCount: 2,
    });
    wrapper(<ReferencesPage productTypes={productTypes} />);
    expect(await screen.findByRole("button", { name: /Tümü · 14/ })).toBeInTheDocument();
    expect(screen.queryByText(/Arşivli koleksiyondan/)).not.toBeInTheDocument();
  });

  it("multi-select → BulkActionBar 'N referans seçildi' + Arşivle", async () => {
    mockFetch([sampleRef("r1", "A"), sampleRef("r2", "B")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("A");
    const selectBtns = screen.getAllByRole("button", { name: "Seç" });
    act(() => {
      fireEvent.click(selectBtns[0]!);
      fireEvent.click(selectBtns[1]!);
    });
    const region = await screen.findByRole("region");
    expect(within(region).getByText("2 referans seçildi")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Arşivle" })).toBeInTheDocument();
  });

  it("bulk archive → dialog archiveReferencesBulk(2) preset'i gösterir", async () => {
    mockFetch([sampleRef("r1", "A"), sampleRef("r2", "B")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("A");
    const selectBtns = screen.getAllByRole("button", { name: "Seç" });
    act(() => {
      fireEvent.click(selectBtns[0]!);
      fireEvent.click(selectBtns[1]!);
    });
    const region = await screen.findByRole("region");
    act(() => {
      fireEvent.click(within(region).getByRole("button", { name: "Arşivle" }));
    });
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Seçili referansları arşivle")).toBeInTheDocument();
    expect(within(dialog).getByText(/2 referans arşivlenecek/)).toBeInTheDocument();
  });

  it("dismiss → selection temizlenir, BulkActionBar gizlenir", async () => {
    mockFetch([sampleRef("r1", "A")]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    await screen.findByText("A");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Seç" }));
    });
    const region = await screen.findByRole("region");
    const dismiss = within(region).getByRole("button", { name: /Seçimi temizle/ });
    act(() => fireEvent.click(dismiss));
    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });
  });

  it("Yeni koleksiyon → router.push('/collections?intent=create')", async () => {
    mockFetch([]);
    wrapper(<ReferencesPage productTypes={productTypes} />);
    const btn = await screen.findByRole("button", { name: /Yeni koleksiyon/ });
    act(() => fireEvent.click(btn));
    expect(pushMock).toHaveBeenCalledWith("/collections?intent=create");
  });
});
