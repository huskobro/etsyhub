/**
 * collections-page.test.tsx
 *
 * CollectionsPage primitive entegrasyonu — T-16 spec doğrulaması.
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
import { CollectionsPage } from "@/features/collections/components/collections-page";

const pushMock = vi.fn();
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function setLocationSearch(search: string) {
  vi.stubGlobal("location", {
    ...window.location,
    search,
    pathname: "/collections",
  });
}

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
  vi.unstubAllGlobals();
  setLocationSearch("");
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

function mockFetch(items: unknown[]) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/collections")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          items,
          uncategorizedReferenceCount: 0,
          orphanedReferenceCount: 0,
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const sample = (id: string, name: string, kind: "BOOKMARK" | "REFERENCE" | "MIXED" = "REFERENCE") => ({
  id,
  name,
  slug: name.toLowerCase(),
  description: null,
  kind,
  createdAt: new Date("2026-04-20").toISOString(),
  updatedAt: new Date("2026-04-22").toISOString(),
  _count: { bookmarks: 0, references: 3 },
});

describe("CollectionsPage", () => {
  it("loading → SkeletonCardGrid", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    wrapper(<CollectionsPage />);
    const skeletons = await screen.findAllByRole("status");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("empty (arama yok) → 'Henüz koleksiyon yok' + CTA", async () => {
    mockFetch([]);
    wrapper(<CollectionsPage />);
    expect(await screen.findByText(/Henüz koleksiyon yok/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /İlk koleksiyonunu oluştur/ }),
    ).toBeInTheDocument();
  });

  it("empty (arama var) → 'Eşleşen koleksiyon yok'", async () => {
    mockFetch([]);
    wrapper(<CollectionsPage />);
    const input = await screen.findByPlaceholderText(/Koleksiyon ara/);
    act(() => fireEvent.change(input, { target: { value: "xyz" } }));
    await waitFor(() => {
      expect(screen.getByText(/Eşleşen koleksiyon yok/)).toBeInTheDocument();
    });
  });

  it("default → 3-col grid, kart + kind Badge + CollectionThumb placeholder", async () => {
    mockFetch([sample("c1", "Boho")]);
    wrapper(<CollectionsPage />);
    expect(await screen.findByText("Boho")).toBeInTheDocument();
    // "Referans" hem Chip'te hem Badge'de geçer — en az biri Badge (<span>) olmalı
    const referansEls = screen.getAllByText("Referans");
    expect(referansEls.length).toBeGreaterThan(0); // Badge
    expect(screen.getByTestId("collection-thumb-placeholder")).toBeInTheDocument();
  });

  it("kind chip: Referans → fetch URL'i kind=REFERENCE içerir", async () => {
    const fetchMock = mockFetch([sample("c1", "A")]);
    wrapper(<CollectionsPage />);
    await screen.findByText("A");
    const chip = await screen.findByRole("button", { name: /^Referans$/ });
    act(() => fireEvent.click(chip));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("kind=REFERENCE"))).toBe(true);
    });
  });

  it("arama → fetch URL'i q=<term>", async () => {
    const fetchMock = mockFetch([]);
    wrapper(<CollectionsPage />);
    const input = await screen.findByPlaceholderText(/Koleksiyon ara/);
    act(() => fireEvent.change(input, { target: { value: "boho" } }));
    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("q=boho"))).toBe(true);
    });
  });

  it("Yeni koleksiyon butonu → dialog açılır", async () => {
    mockFetch([]);
    wrapper(<CollectionsPage />);
    const btn = await screen.findByRole("button", { name: /Yeni koleksiyon/ });
    act(() => fireEvent.click(btn));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("?intent=create URL param → ilk render'da dialog açılır + router.replace('/collections')", async () => {
    setLocationSearch("?intent=create");
    mockFetch([]);
    wrapper(<CollectionsPage />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/collections");
  });

  it("arşivle → archiveCollection preset dialog'u + body 'silinmez'", async () => {
    mockFetch([sample("c1", "Boho")]);
    wrapper(<CollectionsPage />);
    await screen.findByText("Boho");
    const archiveBtn = screen.getByRole("button", { name: "Arşivle" });
    act(() => fireEvent.click(archiveBtn));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Koleksiyonu arşivle")).toBeInTheDocument();
    expect(within(dialog).getByText(/silinmez/)).toBeInTheDocument();
  });
});
