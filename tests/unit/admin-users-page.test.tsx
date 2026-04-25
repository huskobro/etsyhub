/**
 * admin-users-page.test.tsx
 *
 * Admin Users tablo migrasyonu — T-24 spec doğrulaması.
 *
 * Senaryolar:
 *   1. loading → Yükleniyor mesajı; Table render edilmez
 *   2. default render → 3 satır + sayaç görünür
 *   3. "Sadece admin" chip → yalnız ADMIN satırları
 *   4. "Pasif kullanıcı" chip → yalnız DISABLED satırları
 *   5. "Tümü" chip → tüm satırlar geri döner
 *   6. E-posta header tıklaması → asc/desc/null cycle (aria-sort)
 *   7. Satır tıklaması → aria-selected="true" + accent-soft sınıfı
 *   8. Davet et CTA varsayılan disabled
 *   9. CSV export butonu → Blob download tetiklenir
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
import { UsersTable } from "@/features/admin/users/users-table";

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

type SampleUser = {
  id: string;
  email: string;
  name: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
};

const sample: SampleUser[] = [
  {
    id: "u1",
    email: "ayse@example.com",
    name: "Ayşe Yılmaz",
    role: "USER",
    status: "ACTIVE",
    createdAt: new Date("2026-04-10").toISOString(),
  },
  {
    id: "u2",
    email: "burak@example.com",
    name: "Burak Aydın",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: new Date("2026-03-20").toISOString(),
  },
  {
    id: "u3",
    email: "ceren@example.com",
    name: null,
    role: "USER",
    status: "DISABLED",
    createdAt: new Date("2026-02-15").toISOString(),
  },
];

function mockFetch(users: SampleUser[]) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/admin/users")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ users }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("UsersTable (admin)", () => {
  it("loading → Yükleniyor mesajı render olur, Table render edilmez", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    wrapper(<UsersTable />);

    expect(await screen.findByText("Yükleniyor…")).toBeInTheDocument();
    // Henüz Table primitive yok
    expect(screen.queryByRole("columnheader", { name: /E-posta/ })).not.toBeInTheDocument();
  });

  it("default → 3 kullanıcı satır olarak render olur, sayaç görünür", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<UsersTable />);

    expect(await screen.findByText("ayse@example.com")).toBeInTheDocument();
    expect(screen.getByText("burak@example.com")).toBeInTheDocument();
    expect(screen.getByText("ceren@example.com")).toBeInTheDocument();

    expect(screen.getByText(/3 \/ 3 görüntüleniyor/)).toBeInTheDocument();
  });

  it("'Sadece admin' chip → yalnız ADMIN satırı görünür", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<UsersTable />);
    await screen.findByText("ayse@example.com");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Sadece admin" }));
    });

    await waitFor(() => {
      expect(screen.queryByText("ayse@example.com")).not.toBeInTheDocument();
    });
    expect(screen.getByText("burak@example.com")).toBeInTheDocument();
    expect(screen.queryByText("ceren@example.com")).not.toBeInTheDocument();
    expect(screen.getByText(/1 \/ 3 görüntüleniyor/)).toBeInTheDocument();
  });

  it("'Pasif kullanıcı' chip → yalnız DISABLED satırı görünür", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<UsersTable />);
    await screen.findByText("ayse@example.com");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Pasif kullanıcı" }));
    });

    await waitFor(() => {
      expect(screen.queryByText("ayse@example.com")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("burak@example.com")).not.toBeInTheDocument();
    expect(screen.getByText("ceren@example.com")).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 3 görüntüleniyor/)).toBeInTheDocument();
  });

  it("'Tümü' chip → filtre temizlenir, tüm satırlar geri gelir", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<UsersTable />);
    await screen.findByText("ayse@example.com");

    // Önce admin filtresine geç
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Sadece admin" }));
    });
    await waitFor(() => {
      expect(screen.queryByText("ayse@example.com")).not.toBeInTheDocument();
    });

    // Şimdi Tümü
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Tümü" }));
    });
    await waitFor(() => {
      expect(screen.getByText("ayse@example.com")).toBeInTheDocument();
    });
    expect(screen.getByText("burak@example.com")).toBeInTheDocument();
    expect(screen.getByText("ceren@example.com")).toBeInTheDocument();
  });

  it("E-posta header tıklaması → asc/desc/null cycle (aria-sort)", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<UsersTable />);
    await screen.findByText("ayse@example.com");

    const header = screen.getByRole("columnheader", { name: /E-posta/ });
    expect(header).toHaveAttribute("aria-sort", "none");

    // 1. tık → asc
    act(() => {
      fireEvent.click(header);
    });
    await waitFor(() => {
      expect(header).toHaveAttribute("aria-sort", "ascending");
    });

    // Sıralı: ayse, burak, ceren
    let rows = screen.getAllByRole("row");
    // rows[0] header — body satırlarını al
    expect(within(rows[1]!).getByText("ayse@example.com")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("burak@example.com")).toBeInTheDocument();
    expect(within(rows[3]!).getByText("ceren@example.com")).toBeInTheDocument();

    // 2. tık → desc
    act(() => {
      fireEvent.click(header);
    });
    await waitFor(() => {
      expect(header).toHaveAttribute("aria-sort", "descending");
    });

    rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByText("ceren@example.com")).toBeInTheDocument();
    expect(within(rows[3]!).getByText("ayse@example.com")).toBeInTheDocument();

    // 3. tık → null (none)
    act(() => {
      fireEvent.click(header);
    });
    await waitFor(() => {
      expect(header).toHaveAttribute("aria-sort", "none");
    });
  });

  it("Satır tıklanınca aria-selected='true' işaretlenir", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<UsersTable />);
    await screen.findByText("ayse@example.com");

    const cell = screen.getByText("ayse@example.com");
    const row = cell.closest("tr");
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("aria-selected", "false");

    act(() => {
      fireEvent.click(row!);
    });

    await waitFor(() => {
      expect(row).toHaveAttribute("aria-selected", "true");
    });
    // Selected TR primitive'i bg-accent-soft uygular
    expect(row!.className).toContain("bg-accent-soft");
  });

  it("Davet et CTA varsayılan disabled", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<UsersTable />);
    await screen.findByText("ayse@example.com");

    const inviteBtn = screen.getByRole("button", { name: /Davet et/ });
    expect(inviteBtn).toBeDisabled();
  });

  it("CSV export butonu → Blob download tetiklenir (filtreli satırlar)", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    // URL.createObjectURL / revokeObjectURL jsdom'da yok — mock'la
    const createObjectURL = vi.fn(() => "blob:mock-url");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      writable: true,
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      writable: true,
      configurable: true,
      value: revokeObjectURL,
    });

    // Anchor click'i intercept et
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    wrapper(<UsersTable />);
    await screen.findByText("ayse@example.com");

    const csvBtn = screen.getByRole("button", { name: /CSV indir/ });
    act(() => {
      fireEvent.click(csvBtn);
    });

    expect(createObjectURL).toHaveBeenCalledOnce();
    const firstCall = createObjectURL.mock.calls[0] as unknown as [Blob];
    const blobArg = firstCall[0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toContain("text/csv");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    clickSpy.mockRestore();
  });
});
