/**
 * bookmarks-page.test.tsx
 *
 * BookmarksPage primitive entegrasyonu — T-15 + T-39 spec doğrulaması.
 *
 * Testler primitive kompozisyonun üç temel durumunu (loading / empty / default)
 * ve multi-select + bulk archive akışını doğrular. Gerçek useQuery / fetch
 * akışı kullanılır — BookmarkCard ve ConfirmDialog alt çağrıları mock'lanmaz.
 *
 * Senaryolar (T-15):
 *   1. loading → SkeletonCardGrid (role="status") render olur
 *   2. empty → StateMessage ("Henüz bookmark yok") + CTA buton
 *   3. default → 4-col grid + BookmarkCard listesi
 *   4. seçim yap → BulkActionBar sayaç + Arşivle butonu görünür
 *   5. bulk arşivle → confirmPresets.archiveBookmarksBulk preset'i dialog'a düşer
 *   6. dismiss → selection temizlenir, BulkActionBar gizlenir
 *
 * Senaryolar (T-39 — PromoteDialog disclosure pattern + a11y):
 *   7. promote butonu → role="dialog" + aria-modal + aria-labelledby render
 *   8. submit → mutation çağrılır, dialog kapanır
 *   9. Escape → dialog kapanır
 *  10. backdrop click → dialog kapanır
 *  11. dialog içi click → dialog kapanmaz
 *  12. Vazgeç butonu → dialog kapanır
 *  13. isPending=true iken Escape → dialog kapanmaz (busy guard)
 *  14. isPending=true iken backdrop click → dialog kapanmaz (busy guard)
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
    expect(screen.getByPlaceholderText(/Search by title, source or note/)).toBeInTheDocument();

    // SkeletonCardGrid role="status" ile tarafsız canlı bölge açar
    const skeletons = await screen.findAllByRole("status");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("empty → StateMessage + CTA buton görünür", async () => {
    vi.stubGlobal("fetch", mockFetch([]));

    wrapper(<BookmarksPage productTypes={productTypes} />);

    expect(await screen.findByText("No bookmarks yet")).toBeInTheDocument();
    // CTA — "Add your first bookmark"
    expect(
      screen.getByRole("button", { name: /Add your first bookmark/ }),
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
  });

  it("kart seçilince BulkActionBar sayaç + Arşivle butonu görünür", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch([sampleBookmark("bm1", "Boho Poster")]),
    );

    wrapper(<BookmarksPage productTypes={productTypes} />);

    await screen.findByText("Boho Poster");

    // BookmarkCard içindeki "Select" butonu (aria-label)
    const selectBtn = screen.getByRole("button", { name: "Select" });
    act(() => {
      fireEvent.click(selectBtn);
    });

    // BulkActionBar region görünür olmalı
    const region = await screen.findByRole("region");
    expect(within(region).getByText("1 bookmark(s) selected")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Archive" })).toBeInTheDocument();
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
    const selectBtns = screen.getAllByRole("button", { name: "Select" });
    act(() => {
      fireEvent.click(selectBtns[0]!);
      fireEvent.click(selectBtns[1]!);
    });

    const region = await screen.findByRole("region");
    expect(within(region).getByText("2 bookmark(s) selected")).toBeInTheDocument();

    // Bulk "Arşivle"ye bas
    act(() => {
      fireEvent.click(within(region).getByRole("button", { name: "Archive" }));
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
      fireEvent.click(screen.getByRole("button", { name: "Select" }));
    });

    const region = await screen.findByRole("region");
    expect(within(region).getByText("1 bookmark(s) selected")).toBeInTheDocument();

    // Dismiss (X) → seçim sıfırlanır
    const dismiss = within(region).getByRole("button", { name: /Clear selection/ });
    act(() => {
      fireEvent.click(dismiss);
    });

    await waitFor(() => {
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    });
  });
});

/**
 * T-39 — PromoteDialog disclosure pattern + a11y alignment
 *
 * AddCompetitorDialog + PromoteToReferenceDialog ile aynı manuel disclosure
 * pattern'ine hizalama doğrulaması. ConfirmDialog primitive KULLANILMAZ;
 * promote akışı confirmation değil productType picker disclosure'ıdır.
 *
 * Karar dokümanı: docs/design/implementation-notes/cp9-stabilization-wave.md
 * (T-39 bölümü, 2026-04-25 yeniden çerçeveleme).
 */
describe("BookmarksPage — T-39 PromoteDialog a11y disclosure", () => {
  /**
   * "Move to reference" akışını tetikleyen yardımcı: bir bookmark üret, kart
   * üzerindeki "Taşı" butonuna basıp dialog'u aç.
   */
  async function openPromoteDialog() {
    vi.stubGlobal(
      "fetch",
      mockFetch([sampleBookmark("bm1", "Boho Poster")]),
    );

    wrapper(<BookmarksPage productTypes={productTypes} />);

    await screen.findByText("Boho Poster");

    // BookmarkCard içinde "Promote to Reference" aksiyonu — kart bileşeni
    // butonu görünür olarak render eder (ya hover-gated bir overlay'de ya da
    // doğrudan); button name'i regex ile yakalanır.
    const promoteBtn = screen.getByRole("button", {
      name: /^Promote to Reference$/i,
    });
    act(() => {
      fireEvent.click(promoteBtn);
    });

    return await screen.findByRole("dialog", {
      name: /Move to reference/i,
    });
  }

  it("promote butonu → role=dialog + aria-modal=true + aria-labelledby render eder", async () => {
    const dialog = await openPromoteDialog();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "promote-dialog-title");
    const titleId = dialog.getAttribute("aria-labelledby")!;
    // labelledby hedefi gerçekten dialog içinde var ve "Move to reference" başlığı
    const labelEl = document.getElementById(titleId);
    expect(labelEl).not.toBeNull();
    expect(labelEl).toHaveTextContent(/Move to reference/i);
  });

  it("ProductType select dialog içinde render edilir", async () => {
    const dialog = await openPromoteDialog();
    // productTypes prop'u: Canvas + Printable
    const select = within(dialog).getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Canvas" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Printable" })).toBeInTheDocument();
  });

  it("Escape tuşu basıldığında dialog kapanır", async () => {
    await openPromoteDialog();
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Move to reference/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("backdrop (overlay) tıklamasında dialog kapanır", async () => {
    const dialog = await openPromoteDialog();
    act(() => {
      // Overlay = dialog elementinin kendisi (target === currentTarget)
      fireEvent.click(dialog);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Move to reference/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("dialog içi (başlık) tıklaması dialog'u kapatmaz", async () => {
    const dialog = await openPromoteDialog();
    const heading = within(dialog).getByRole("heading", { name: "Move to reference" });
    act(() => {
      fireEvent.click(heading);
    });
    // Dialog hâlâ açık olmalı
    expect(
      screen.getByRole("dialog", { name: /Move to reference/i }),
    ).toBeInTheDocument();
  });

  it("Vazgeç butonu → dialog kapanır", async () => {
    const dialog = await openPromoteDialog();
    const cancelBtn = within(dialog).getByRole("button", { name: /^Cancel$/i });
    act(() => {
      fireEvent.click(cancelBtn);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Move to reference/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("Kapat (header) butonu → dialog kapanır", async () => {
    const dialog = await openPromoteDialog();
    const closeBtn = within(dialog).getByRole("button", { name: /^Close$/i });
    act(() => {
      fireEvent.click(closeBtn);
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Move to reference/i }),
      ).not.toBeInTheDocument();
    });
  });

  it("submit (Referansa Taşı) → /api/references/promote POST tetiklenir", async () => {
    // Dedicated fetch spy: hem listeyi karşılar hem de promote POST'u sayar.
    const fetchSpy = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "/api/references/promote" && init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true }),
          });
        }
        if (url.startsWith("/api/bookmarks")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [sampleBookmark("bm1", "Boho Poster")],
              nextCursor: null,
            }),
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
      },
    );
    vi.stubGlobal("fetch", fetchSpy);

    wrapper(<BookmarksPage productTypes={productTypes} />);
    await screen.findByText("Boho Poster");

    const promoteBtn = screen.getByRole("button", {
      name: /^Promote to Reference$/i,
    });
    act(() => {
      fireEvent.click(promoteBtn);
    });

    const dialog = await screen.findByRole("dialog", {
      name: /Move to reference/i,
    });
    const submitBtn = within(dialog).getByRole("button", {
      name: /Move to reference/i,
    });
    act(() => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      const promoteCall = fetchSpy.mock.calls.find(
        ([u]) => typeof u === "string" && u === "/api/references/promote",
      );
      expect(promoteCall).toBeDefined();
    });

    // Spec sat. 215: "Submit → mutation çağrılır + dialog kapanır".
    // Mutation onSuccess setPromoteId(null) çağırır → dialog unmount olur.
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /Move to reference/i }),
      ).not.toBeInTheDocument();
    });
  });

  /**
   * Spec sat. 218 (cp9-stabilization-wave.md T-39): "isPending true iken
   * Escape + backdrop → iptal edilmez."
   *
   * isPending state'i, promote mutation in-flight olduğunda true olur.
   * Test stratejisi: /api/references/promote endpoint'ini never-resolving
   * promise döndürecek şekilde mock'la → submit sonrası mutation pending
   * kalır → "Taşınıyor…" buton metni görünür → Escape/backdrop dispatch et
   * → dialog hâlâ açık olduğu doğrulanır.
   *
   * Kod davranışı (bookmarks-page.tsx:382-385 ve 396-400) zaten doğru;
   * burada sadece sözleşmeyi test koşumuyla pinliyoruz.
   */
  async function openDialogWithPendingPromote() {
    // /api/references/promote → never resolves; diğer endpoint'ler normal.
    const fetchSpy = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url === "/api/references/promote" && init?.method === "POST") {
          return new Promise(() => {
            /* never resolves — mutation in-flight kalır */
          });
        }
        if (url.startsWith("/api/bookmarks")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [sampleBookmark("bm1", "Boho Poster")],
              nextCursor: null,
            }),
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
      },
    );
    vi.stubGlobal("fetch", fetchSpy);

    wrapper(<BookmarksPage productTypes={productTypes} />);
    await screen.findByText("Boho Poster");

    const promoteBtn = screen.getByRole("button", {
      name: /^Promote to Reference$/i,
    });
    act(() => {
      fireEvent.click(promoteBtn);
    });

    const dialog = await screen.findByRole("dialog", {
      name: /Move to reference/i,
    });
    const submitBtn = within(dialog).getByRole("button", {
      name: /Move to reference/i,
    });
    act(() => {
      fireEvent.click(submitBtn);
    });

    // Mutation in-flight'a girdi → submit butonu "Taşınıyor…" oldu.
    await within(dialog).findByRole("button", { name: /Moving…/i });

    return dialog;
  }

  it("isPending true iken Escape → dialog kapanmaz", async () => {
    const dialog = await openDialogWithPendingPromote();

    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    // isPending guard (bookmarks-page.tsx:382-385) Escape'i swallow eder.
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: /Move to reference/i }),
    ).toBeInTheDocument();
  });

  it("isPending true iken backdrop click → dialog kapanmaz", async () => {
    const dialog = await openDialogWithPendingPromote();

    act(() => {
      // Overlay = dialog elementinin kendisi (target === currentTarget)
      fireEvent.click(dialog);
    });

    // isPending guard (bookmarks-page.tsx:396-400) overlay click'i swallow eder.
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: /Move to reference/i }),
    ).toBeInTheDocument();
  });
});
