/**
 * bookmarks-page.test.tsx
 *
 * BookmarksPage primitive entegrasyonu — T-15 spec doğrulaması.
 *
 * Testler primitive kompozisyonun üç temel durumunu (loading / empty / default)
 * ve multi-select + bulk archive akışını doğrular. Gerçek useQuery / fetch
 * akışı kullanılır — BookmarkCard ve ConfirmDialog alt çağrıları mock'lanmaz.
 *
 * Senaryolar:
 *   1. loading → SkeletonCardGrid (role="status") render olur
 *   2. empty → StateMessage ("Henüz bookmark yok") + CTA buton
 *   3. default → 4-col grid + BookmarkCard listesi
 *   4. seçim yap → BulkActionBar sayaç + Arşivle butonu görünür
 *   5. bulk arşivle → confirmPresets.archiveBookmarksBulk preset'i dialog'a düşer
 *   6. dismiss → selection temizlenir, BulkActionBar gizlenir
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
import { BookmarksPage } from "@/features/bookmarks/components/bookmarks-page";

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

// Radix Dialog (ConfirmDialog) / usePortal mounts için matchMedia mock gerekir.
beforeEach(() => {
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

/**
 * Fetch mock helper — BookmarksPage'in tüm network bağımlılıklarını karşılar.
 *
 * URL matcher'lar:
 *   - /api/bookmarks?...    → list endpoint, `bookmarks` argüman
 *   - /api/assets/:id/url   → AssetImage içi URL çözümü
 *   - /api/tags             → TagPicker varsayılan boş liste
 *   - /api/collections      → CollectionPicker varsayılan boş liste
 */
function mockFetch(bookmarks: unknown[]) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/bookmarks")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: bookmarks, nextCursor: null }),
      });
    }
    if (url.includes("/api/assets/")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ url: "https://example.com/img.jpg" }),
      });
    }
    if (url.startsWith("/api/tags") || url.startsWith("/api/collections")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items: [] }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

const sampleBookmark = (id: string, title: string) => ({
  id,
  title,
  sourceUrl: `https://example.com/${id}`,
  sourcePlatform: "ETSY",
  status: "INBOX" as const,
  riskLevel: "LOW" as const,
  createdAt: new Date("2026-04-20").toISOString(),
  asset: { id: `asset-${id}`, storageKey: `k/${id}`, bucket: "b" },
  productType: null,
  collection: null,
  tags: [],
});

const productTypes = [
  { id: "pt-canvas", displayName: "Canvas" },
  { id: "pt-printable", displayName: "Printable" },
];

describe("BookmarksPage", () => {
  it("loading → SkeletonCardGrid render olur (role=status)", async () => {
    // Never-resolving promise ile pending state kalıcı olur
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    wrapper(<BookmarksPage productTypes={productTypes} />);

    // Toolbar + FilterBar zaten render olmuş olmalı
    expect(screen.getByPlaceholderText(/Başlık, kaynak veya not ara/)).toBeInTheDocument();

    // SkeletonCardGrid role="status" ile tarafsız canlı bölge açar
    const skeletons = await screen.findAllByRole("status");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("empty → StateMessage + CTA buton görünür", async () => {
    vi.stubGlobal("fetch", mockFetch([]));

    wrapper(<BookmarksPage productTypes={productTypes} />);

    expect(await screen.findByText("Henüz bookmark yok")).toBeInTheDocument();
    // CTA — "İlk bookmark'ını ekle"
    expect(
      screen.getByRole("button", { name: /İlk bookmark'ını ekle/ }),
    ).toBeInTheDocument();
  });

  it("default → kart listesi render olur, card başlıklar görünür", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([
        sampleBookmark("bm1", "Boho Poster"),
        sampleBookmark("bm2", "Çiçek Baskı"),
      ]),
    );

    wrapper(<BookmarksPage productTypes={productTypes} />);

    expect(await screen.findByText("Boho Poster")).toBeInTheDocument();
    expect(screen.getByText("Çiçek Baskı")).toBeInTheDocument();

    // Üst özet: "2 kayıt · URL veya görsel ekleyerek fikir topla"
    expect(screen.getByText(/2 kayıt/)).toBeInTheDocument();
  });

  it("kart seçilince BulkActionBar sayaç + Arşivle butonu görünür", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([sampleBookmark("bm1", "Boho Poster")]),
    );

    wrapper(<BookmarksPage productTypes={productTypes} />);

    await screen.findByText("Boho Poster");

    // BookmarkCard içindeki "Seç" butonu (aria-label)
    const selectBtn = screen.getByRole("button", { name: "Seç" });
    act(() => {
      fireEvent.click(selectBtn);
    });

    // BulkActionBar region görünür olmalı
    const region = await screen.findByRole("region");
    expect(within(region).getByText("1 bookmark seçildi")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Arşivle" })).toBeInTheDocument();
  });

  it("bulk arşivle → archiveBookmarksBulk preset'i dialog'a düşer", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([
        sampleBookmark("bm1", "Boho Poster"),
        sampleBookmark("bm2", "Çiçek Baskı"),
      ]),
    );

    wrapper(<BookmarksPage productTypes={productTypes} />);

    await screen.findByText("Boho Poster");

    // İki kartı da seç
    const selectBtns = screen.getAllByRole("button", { name: "Seç" });
    act(() => {
      fireEvent.click(selectBtns[0]!);
      fireEvent.click(selectBtns[1]!);
    });

    const region = await screen.findByRole("region");
    expect(within(region).getByText("2 bookmark seçildi")).toBeInTheDocument();

    // Bulk "Arşivle"ye bas
    act(() => {
      fireEvent.click(within(region).getByRole("button", { name: "Arşivle" }));
    });

    // Confirm dialog açılmalı — archiveBookmarksBulk(2) preset'i
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Seçili bookmark'ları arşivle"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/2 bookmark arşivlenecek/),
    ).toBeInTheDocument();
  });

  it("dismiss → selection temizlenir, BulkActionBar gizlenir", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([sampleBookmark("bm1", "Boho Poster")]),
    );

    wrapper(<BookmarksPage productTypes={productTypes} />);

    await screen.findByText("Boho Poster");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Seç" }));
    });

    const region = await screen.findByRole("region");
    expect(within(region).getByText("1 bookmark seçildi")).toBeInTheDocument();

    // Dismiss (X) → seçim sıfırlanır
    const dismiss = within(region).getByRole("button", { name: /Seçimi temizle/ });
    act(() => {
      fireEvent.click(dismiss);
    });

    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });
  });
});
