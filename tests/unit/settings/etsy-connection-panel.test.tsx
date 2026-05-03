// Phase 9 V1 — Etsy connection settings panel UI testleri.
// 4 status rendering + URL query feedback + DELETE mutation flow.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EtsyConnectionSettingsPanel } from "@/features/settings/etsy-connection/components/etsy-connection-settings-panel";

// next/navigation mock — useSearchParams/useRouter/usePathname
const replaceSpy = vi.fn();
let currentSearch = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(currentSearch),
  useRouter: () => ({ replace: replaceSpy }),
  usePathname: () => "/settings",
}));

const fetchMock = vi.fn();

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSearch = "";
  global.fetch = fetchMock as unknown as typeof fetch;
});

function mockGetStatus(state: object) {
  fetchMock.mockImplementation(async (url, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/api/settings/etsy-connection")) {
      const method = init?.method ?? "GET";
      if (method === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: state }),
        } as Response;
      }
      if (method === "DELETE") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: { state: "not_connected" } }),
        } as Response;
      }
    }
    throw new Error(`Unmocked fetch: ${url} ${init?.method ?? ""}`);
  });
}

describe("EtsyConnectionSettingsPanel — status rendering", () => {
  it("not_configured: env uyarısı + 4-env tam liste (TAXONOMY_MAP_JSON dahil) + Bağlan link YOK", async () => {
    mockGetStatus({ state: "not_configured" });
    renderWithQuery(<EtsyConnectionSettingsPanel />);

    await waitFor(() => {
      expect(
        screen.getByText(/Etsy entegrasyonu yapılandırılmadı/i),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/ETSY_CLIENT_ID/)).toBeInTheDocument();
    expect(screen.getByText(/ETSY_CLIENT_SECRET/)).toBeInTheDocument();
    expect(screen.getByText(/ETSY_REDIRECT_URI/)).toBeInTheDocument();
    // Phase 9 V1 Finalization — TAXONOMY_MAP_JSON da bilgi olarak listeleniyor
    expect(screen.getByText(/ETSY_TAXONOMY_MAP_JSON/)).toBeInTheDocument();
    expect(screen.getByText(/seller-taxonomy\/nodes/)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Etsy.*bağlan/i }),
    ).not.toBeInTheDocument();
  });

  it("not_connected: 'Etsy'ye bağlan' link href=/api/etsy/oauth/start", async () => {
    mockGetStatus({ state: "not_connected" });
    renderWithQuery(<EtsyConnectionSettingsPanel />);

    const link = (await screen.findByRole("link", {
      name: /Etsy.*bağlan/i,
    })) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/etsy/oauth/start");
  });

  it("connected: shopName/shopId/scopes + 'Bağlantıyı kaldır' button + submit pipeline auto-refresh ipucu", async () => {
    mockGetStatus({
      state: "connected",
      shopId: "12345",
      shopName: "TestShop",
      tokenExpires: new Date(Date.now() + 3600_000).toISOString(),
      scopes: ["listings_w", "shops_r"],
    });
    renderWithQuery(<EtsyConnectionSettingsPanel />);

    expect(await screen.findByText("TestShop")).toBeInTheDocument();
    expect(screen.getByText("12345")).toBeInTheDocument();
    expect(screen.getByText(/listings_w, shops_r/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Bağlantıyı kaldır/i }),
    ).toBeInTheDocument();
    // Phase 9 V1 Finalization — submit pipeline ↔ Settings UI bağlantı ipucu
    expect(
      screen.getByText(/Submit pipeline expired token.*otomatik yeniler/i),
    ).toBeInTheDocument();
  });

  it("expired: 'Yeniden bağlan' link + uyarı", async () => {
    mockGetStatus({
      state: "expired",
      shopName: "ExpShop",
      expiredAt: new Date(Date.now() - 1000).toISOString(),
    });
    renderWithQuery(<EtsyConnectionSettingsPanel />);

    const link = (await screen.findByRole("link", {
      name: /Yeniden bağlan/i,
    })) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/etsy/oauth/start");
    expect(screen.getByText(/Bağlantı süresi doldu/i)).toBeInTheDocument();
  });
});

describe("EtsyConnectionSettingsPanel — URL query feedback", () => {
  it("?etsy=connected → success banner + URL temizlenir", async () => {
    currentSearch = "etsy=connected";
    mockGetStatus({ state: "not_connected" });

    renderWithQuery(<EtsyConnectionSettingsPanel />);

    expect(
      await screen.findByText("Etsy bağlantısı kuruldu."),
    ).toBeInTheDocument();
    // URL replace çağrıldı (query temizlemek için)
    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalled();
    });
    const calledWith = replaceSpy.mock.calls[0]![0];
    expect(calledWith).toBe("/settings");
  });

  it("?etsy=state-mismatch → error banner", async () => {
    currentSearch = "etsy=state-mismatch";
    mockGetStatus({ state: "not_connected" });

    renderWithQuery(<EtsyConnectionSettingsPanel />);

    expect(
      await screen.findByText(/OAuth doğrulaması başarısız/i),
    ).toBeInTheDocument();
  });

  it("?etsy=error-EXCHANGE_FAILED → 'Etsy bağlantı hatası: EXCHANGE_FAILED'", async () => {
    currentSearch = "etsy=error-EXCHANGE_FAILED";
    mockGetStatus({ state: "not_connected" });

    renderWithQuery(<EtsyConnectionSettingsPanel />);

    expect(
      await screen.findByText(/Etsy bağlantı hatası: EXCHANGE_FAILED/i),
    ).toBeInTheDocument();
  });
});

describe("EtsyConnectionSettingsPanel — DELETE mutation", () => {
  it("Bağlantıyı kaldır click → DELETE request + state not_connected", async () => {
    mockGetStatus({
      state: "connected",
      shopId: "1",
      shopName: "DelShop",
      tokenExpires: null,
      scopes: [],
    });
    renderWithQuery(<EtsyConnectionSettingsPanel />);

    const btn = await screen.findByRole("button", {
      name: /Bağlantıyı kaldır/i,
    });
    fireEvent.click(btn);

    // DELETE request gönderildi
    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "DELETE",
      );
      expect(deleteCall).toBeDefined();
    });

    // Sonuç sonrası "Etsy'ye bağlan" göründü (state not_connected)
    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Etsy.*bağlan/i }),
      ).toBeInTheDocument();
    });
  });
});
