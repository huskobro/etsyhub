/**
 * admin-product-types-page.test.tsx
 *
 * Admin Product Types tablo migrasyonu — T-25 spec doğrulaması.
 *
 * Senaryolar:
 *   1. Loading → "Yükleniyor…" görünür, Table render edilmez
 *   2. Default render → Table primitive (Tip / Slug / Aspect / Recipe / Usage / Durum / —) head'de
 *   3. Subtitle → "7 tip" formatında gösterilir
 *   4. Chip filtreleri → 3 chip (Tümü·7, Sistem·X, Custom·Y) doğru sayılarla
 *   5. "Sistem" chip → yalnızca isSystem=true satırlar kalır
 *   6. Toggle → her satırda role="switch" var ve disabled
 *   7. Toggle click no-op (data değişmez — disabled)
 *   8. "Yeni tip" CTA → form açılır/gizlenir; create akışı korunur
 *   9. Sil akışı korunur → ConfirmDialog flow
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
import { ProductTypesManager } from "@/features/admin/product-types/product-types-manager";

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

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

type SampleType = {
  id: string;
  key: string;
  displayName: string;
  aspectRatio: string | null;
  description: string | null;
  isSystem: boolean;
};

const sample: SampleType[] = [
  { id: "p1", key: "wall_art", displayName: "Wall Art", aspectRatio: "2:3", description: null, isSystem: true },
  { id: "p2", key: "canvas", displayName: "Canvas", aspectRatio: "3:4", description: null, isSystem: true },
  { id: "p3", key: "printable", displayName: "Printable", aspectRatio: "2:3", description: null, isSystem: true },
  { id: "p4", key: "clipart", displayName: "Clipart", aspectRatio: "1:1", description: null, isSystem: true },
  { id: "p5", key: "sticker", displayName: "Sticker", aspectRatio: "1:1", description: null, isSystem: true },
  { id: "p6", key: "tshirt", displayName: "T-Shirt", aspectRatio: "1:1", description: null, isSystem: false },
  { id: "p7", key: "hoodie", displayName: "Hoodie", aspectRatio: "1:1", description: null, isSystem: false },
];

function mockFetch(items: SampleType[]) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/admin/product-types")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ items }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("ProductTypesManager (admin)", () => {
  it("loading → 'Yükleniyor…' görünür, Table render edilmez", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    wrapper(<ProductTypesManager />);

    expect(await screen.findByText("Yükleniyor…")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /Tip/ }),
    ).not.toBeInTheDocument();
  });

  it("default → Table primitive ve 7 kolonun başlıkları görünür", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<ProductTypesManager />);

    await screen.findByText("Wall Art");

    expect(screen.getByRole("columnheader", { name: /Tip/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Slug/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Aspect/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Recipe/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Usage/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Durum/ })).toBeInTheDocument();
  });

  it("subtitle → '7 tip' formatında gösterilir", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<ProductTypesManager />);
    await screen.findByText("Wall Art");

    expect(screen.getByText(/7 tip/)).toBeInTheDocument();
  });

  it("chip filtreleri → 3 chip doğru sayılarla (Tümü·7 · Sistem·5 · Custom·2)", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<ProductTypesManager />);
    await screen.findByText("Wall Art");

    expect(screen.getByRole("button", { name: /Tümü/ })).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: /Sistem/ })).toHaveTextContent("5");
    expect(screen.getByRole("button", { name: /Custom/ })).toHaveTextContent("2");
  });

  it("'Sistem' chip → yalnızca isSystem=true satırlar görünür", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<ProductTypesManager />);
    await screen.findByText("Wall Art");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Sistem/ }));
    });

    await waitFor(() => {
      expect(screen.queryByText("T-Shirt")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("Hoodie")).not.toBeInTheDocument();
    expect(screen.getByText("Wall Art")).toBeInTheDocument();
    expect(screen.getByText("Canvas")).toBeInTheDocument();
  });

  it("Toggle → her satırda role='switch' var ve disabled", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<ProductTypesManager />);
    await screen.findByText("Wall Art");

    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBe(7);
    for (const sw of switches) {
      expect(sw).toBeDisabled();
    }
  });

  it("Toggle click → no-op (disabled satır)", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<ProductTypesManager />);
    await screen.findByText("Wall Art");

    const switches = screen.getAllByRole("switch");
    const before = switches[0]!.getAttribute("aria-checked");

    act(() => {
      fireEvent.click(switches[0]!);
    });

    // disabled olduğu için durum değişmez
    expect(switches[0]).toHaveAttribute("aria-checked", before ?? "false");
  });

  it("'Yeni tip' CTA → form açılır/gizlenir, create akışı korunur", async () => {
    const fetchMock = mockFetch(sample);
    vi.stubGlobal("fetch", fetchMock);

    wrapper(<ProductTypesManager />);
    await screen.findByText("Wall Art");

    // Form başlangıçta gizli
    expect(screen.queryByPlaceholderText("mug")).not.toBeInTheDocument();

    const cta = screen.getByRole("button", { name: /Yeni tip/ });
    act(() => {
      fireEvent.click(cta);
    });

    // Form açıldı
    const keyInput = await screen.findByPlaceholderText("mug");
    expect(keyInput).toBeInTheDocument();

    // Tekrar tıklayınca kapanır
    act(() => {
      fireEvent.click(cta);
    });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("mug")).not.toBeInTheDocument();
    });
  });

  it("Sil akışı → ConfirmDialog açılır (custom satır)", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<ProductTypesManager />);
    await screen.findByText("T-Shirt");

    // T-Shirt isSystem=false → silme butonu erişilebilir
    const deleteBtn = screen.getAllByRole("button", { name: /^Sil$/ })[0]!;
    act(() => {
      fireEvent.click(deleteBtn);
    });

    // ConfirmDialog → "Sil" preset başlığı görünür (silme onay diyaloğu)
    await waitFor(() => {
      // confirmPresets.deleteProductType → başlığında ürün adı geçer
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });
});
