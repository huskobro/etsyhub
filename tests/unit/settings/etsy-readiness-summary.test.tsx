// Phase 9 V1 Finalization — Etsy readiness summary component UI testleri.
//
// 3-state checklist + liveReady badge + farklı state'lerin görsel ipuçları.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EtsyReadinessSummary } from "@/features/settings/etsy-connection/components/etsy-readiness-summary";

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
  global.fetch = fetchMock as unknown as typeof fetch;
});

function mockSummary(summary: object) {
  fetchMock.mockImplementation(async (url: string) => {
    if (
      typeof url === "string" &&
      url.includes("/api/settings/etsy-connection/readiness")
    ) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ summary }),
      } as Response;
    }
    throw new Error(`Unmocked fetch: ${url}`);
  });
}

describe("EtsyReadinessSummary", () => {
  it("isLoading: 'yükleniyor' mesajı görünür", async () => {
    // fetch sonsuz pending — UI loading state'inde kalır
    fetchMock.mockImplementation(
      () => new Promise<Response>(() => {}),
    );
    renderWithQuery(<EtsyReadinessSummary />);
    expect(
      await screen.findByText(/Etsy hazırlık durumu yükleniyor/i),
    ).toBeInTheDocument();
  });

  it("fetch error: kırmızı 'alınamadı' mesajı", async () => {
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response));
    renderWithQuery(<EtsyReadinessSummary />);
    await waitFor(() => {
      expect(
        screen.getByText(/Etsy hazırlık durumu alınamadı/i),
      ).toBeInTheDocument();
    });
  });

  it("liveReady=true: 'Hazır' badge + 3 OK satır", async () => {
    mockSummary({
      oauthCredentials: { state: "ok", detail: "ok detay" },
      taxonomyMapping: {
        state: "ok",
        sampleKey: "wall_art",
        sampleResolved: 2078,
        detail: "ok detay",
      },
      connection: {
        state: "connected",
        shopName: "ShopX",
        tokenExpires: new Date(Date.now() + 3600_000).toISOString(),
      },
      liveReady: true,
    });
    renderWithQuery(<EtsyReadinessSummary />);

    expect(await screen.findByText("Hazır")).toBeInTheDocument();
    expect(screen.getByText("OAuth credentials")).toBeInTheDocument();
    expect(screen.getByText("Taxonomy mapping")).toBeInTheDocument();
    expect(screen.getByText("Bağlantı")).toBeInTheDocument();
    // Sample resolved görünür
    expect(screen.getByText(/wall_art.*→.*2078/)).toBeInTheDocument();
    // Connection shopName görünür
    expect(screen.getByText(/ShopX/)).toBeInTheDocument();
  });

  it("liveReady=false (oauth missing): 'Hazır değil' + missing detay", async () => {
    mockSummary({
      oauthCredentials: {
        state: "missing",
        detail: "ETSY_CLIENT_ID eksik",
      },
      taxonomyMapping: {
        state: "missing",
        sampleKey: "wall_art",
        sampleResolved: null,
        detail: "ETSY_TAXONOMY_MAP_JSON eksik",
      },
      connection: {
        state: "not_configured",
        shopName: null,
        tokenExpires: null,
      },
      liveReady: false,
    });
    renderWithQuery(<EtsyReadinessSummary />);

    expect(await screen.findByText("Hazır değil")).toBeInTheDocument();
    expect(screen.getByText(/ETSY_CLIENT_ID eksik/)).toBeInTheDocument();
    expect(
      screen.getByText(/ETSY_TAXONOMY_MAP_JSON eksik/),
    ).toBeInTheDocument();
  });

  it("taxonomy invalid: '(invalid)' label + bozuk format detay", async () => {
    mockSummary({
      oauthCredentials: { state: "ok", detail: "" },
      taxonomyMapping: {
        state: "invalid",
        sampleKey: "wall_art",
        sampleResolved: null,
        detail: "ETSY_TAXONOMY_MAP_JSON formatı bozuk",
      },
      connection: {
        state: "not_connected",
        shopName: null,
        tokenExpires: null,
      },
      liveReady: false,
    });
    renderWithQuery(<EtsyReadinessSummary />);

    await waitFor(() => {
      expect(screen.getByText(/\(invalid\)/)).toBeInTheDocument();
    });
    expect(screen.getByText(/formatı bozuk/i)).toBeInTheDocument();
  });

  it("connection expired: warn icon + 'otomatik refresh dener' mesajı", async () => {
    mockSummary({
      oauthCredentials: { state: "ok", detail: "" },
      taxonomyMapping: {
        state: "ok",
        sampleKey: "wall_art",
        sampleResolved: 2078,
        detail: "",
      },
      connection: {
        state: "expired",
        shopName: "ExpShop",
        tokenExpires: new Date(Date.now() - 1000).toISOString(),
      },
      liveReady: false,
    });
    renderWithQuery(<EtsyReadinessSummary />);

    await waitFor(() => {
      expect(screen.getByText(/\(expired\)/)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/otomatik refresh dener/i),
    ).toBeInTheDocument();
  });

  it("connection not_connected (oauth ok): 'Aşağıdaki panelden bağlanın' rehberi", async () => {
    mockSummary({
      oauthCredentials: { state: "ok", detail: "" },
      taxonomyMapping: {
        state: "ok",
        sampleKey: "wall_art",
        sampleResolved: 2078,
        detail: "",
      },
      connection: {
        state: "not_connected",
        shopName: null,
        tokenExpires: null,
      },
      liveReady: false,
    });
    renderWithQuery(<EtsyReadinessSummary />);

    await waitFor(() => {
      expect(screen.getByText(/\(not_connected\)/)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Aşağıdaki panelden bağlanın/i),
    ).toBeInTheDocument();
  });

  it("connection not_configured: 'Sistem yöneticisi env credentials' rehberi", async () => {
    mockSummary({
      oauthCredentials: { state: "missing", detail: "" },
      taxonomyMapping: {
        state: "missing",
        sampleKey: "wall_art",
        sampleResolved: null,
        detail: "",
      },
      connection: {
        state: "not_configured",
        shopName: null,
        tokenExpires: null,
      },
      liveReady: false,
    });
    renderWithQuery(<EtsyReadinessSummary />);

    await waitFor(() => {
      expect(
        screen.getByText(/Sistem yöneticisi env credentials/i),
      ).toBeInTheDocument();
    });
  });
});
