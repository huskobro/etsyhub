/**
 * admin-feature-flags-page.test.tsx
 *
 * Admin Feature Flags tablo migrasyonu — T-26 spec doğrulaması.
 *
 * Senaryolar:
 *   1. Loading → "Yükleniyor…" görünür
 *   2. Default render → Table primitive head'i kolonları gösterir
 *      (Flag / Kapsam / Durum / Rollout / Toggle / —)
 *   3. Subtitle → "7 flag · 4 açık" (4 enabled, 3 disabled — toplam 7)
 *   4. Chip filtreleri → 3 chip (Tümü·7 / Açık·4 / Kapalı·3)
 *      Prod/Dev/Rollout chip'leri data yokluğundan çıkarıldı (carry-forward)
 *   5. "Açık" chip → sadece enabled=true satırlar kalır
 *   6. Toggle click → PATCH {key, enabled: !enabled} gönderir
 *   7. Toggle role="switch", aria-checked doğru, **disabled DEĞİL**
 *   8. RolloutBar → role="progressbar", aria-valuenow görsel doğru
 *   9. "Yeni flag" CTA → disabled, title="Yakında"
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
import { FlagsTable } from "@/features/admin/feature-flags/flags-table";

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

type SampleFlag = {
  id: string;
  key: string;
  enabled: boolean;
  scope: "admin" | "user";
  metadata?: { name?: string; description?: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

const sample: SampleFlag[] = [
  { id: "f1", key: "wall_art_variations", enabled: true, scope: "user" },
  { id: "f2", key: "trend_stories", enabled: true, scope: "user" },
  { id: "f3", key: "clipart_studio", enabled: true, scope: "user" },
  { id: "f4", key: "ai_review", enabled: true, scope: "admin" },
  { id: "f5", key: "mockup_studio", enabled: false, scope: "user" },
  { id: "f6", key: "publish_queue", enabled: false, scope: "user" },
  { id: "f7", key: "cost_guardrails", enabled: false, scope: "admin" },
];

function mockFetch(
  flags: SampleFlag[],
  onPatch?: (body: { key: string; enabled: boolean }) => void,
) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.startsWith("/api/admin/feature-flags")) {
      if (init?.method === "PATCH") {
        const body = JSON.parse(init.body as string) as {
          key: string;
          enabled: boolean;
        };
        onPatch?.(body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ flag: { ...flags.find((f) => f.key === body.key), enabled: body.enabled } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ flags }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

describe("FlagsTable (admin)", () => {
  it("loading → 'Yükleniyor…' görünür", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    wrapper(<FlagsTable />);

    expect(await screen.findByText("Yükleniyor…")).toBeInTheDocument();
  });

  it("default → Table primitive head'i kolonları gösterir", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<FlagsTable />);
    await screen.findByText("wall_art_variations");

    expect(screen.getByRole("columnheader", { name: /Flag/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Kapsam/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Durum/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Rollout/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Toggle/ })).toBeInTheDocument();
  });

  it("subtitle → '7 flag · 4 açık'", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<FlagsTable />);
    await screen.findByText("wall_art_variations");

    expect(screen.getByText(/7 flag · 4 açık/)).toBeInTheDocument();
  });

  it("chip filtreleri → Tümü·7 · Açık·4 · Kapalı·3 (Prod/Dev/Rollout çıkarıldı)", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<FlagsTable />);
    await screen.findByText("wall_art_variations");

    expect(screen.getByRole("button", { name: /Tümü/ })).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: /Açık/ })).toHaveTextContent("4");
    expect(screen.getByRole("button", { name: /Kapalı/ })).toHaveTextContent("3");

    // Data yokluğundan dolayı carry-forward'da kilitli: bu chip'ler yok
    expect(screen.queryByRole("button", { name: /^Prod/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Dev/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Rollout/ })).not.toBeInTheDocument();
  });

  it("'Açık' chip → sadece enabled=true satırlar kalır", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<FlagsTable />);
    await screen.findByText("wall_art_variations");

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Açık/ }));
    });

    await waitFor(() => {
      expect(screen.queryByText("mockup_studio")).not.toBeInTheDocument();
    });
    expect(screen.queryByText("publish_queue")).not.toBeInTheDocument();
    expect(screen.queryByText("cost_guardrails")).not.toBeInTheDocument();
    expect(screen.getByText("wall_art_variations")).toBeInTheDocument();
    expect(screen.getByText("trend_stories")).toBeInTheDocument();
  });

  it("Toggle click → PATCH {key, enabled: !enabled} gönderir", async () => {
    const patches: Array<{ key: string; enabled: boolean }> = [];
    vi.stubGlobal(
      "fetch",
      mockFetch(sample, (body) => patches.push(body)),
    );

    wrapper(<FlagsTable />);
    await screen.findByText("wall_art_variations");

    const switches = screen.getAllByRole("switch");
    // İlk satır: wall_art_variations → enabled=true → PATCH enabled:false bekleriz
    act(() => {
      fireEvent.click(switches[0]!);
    });

    await waitFor(() => {
      expect(patches.length).toBeGreaterThan(0);
    });
    expect(patches[0]).toEqual({ key: "wall_art_variations", enabled: false });
  });

  it("Toggle → role='switch', aria-checked doğru, disabled DEĞİL", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<FlagsTable />);
    await screen.findByText("wall_art_variations");

    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBe(7);

    // 1. satır enabled=true
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    // 5. satır (mockup_studio) enabled=false
    expect(switches[4]).toHaveAttribute("aria-checked", "false");

    for (const sw of switches) {
      expect(sw).not.toBeDisabled();
    }
  });

  it("RolloutBar → role='progressbar' render eder, aria-valuenow görsel doğru", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<FlagsTable />);
    await screen.findByText("wall_art_variations");

    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBe(7);

    // proxy: enabled → 100, disabled → 0
    // satır sırası sample ile aynı (key asc değil — mock fetch sample sırasını döndürür)
    expect(bars[0]).toHaveAttribute("aria-valuenow", "100"); // wall_art_variations
    expect(bars[4]).toHaveAttribute("aria-valuenow", "0"); // mockup_studio
  });

  it("'Yeni flag' CTA → disabled, title='Yakında'", async () => {
    vi.stubGlobal("fetch", mockFetch(sample));

    wrapper(<FlagsTable />);
    await screen.findByText("wall_art_variations");

    const cta = screen.getByRole("button", { name: /Yeni flag/ });
    expect(cta).toBeDisabled();
    expect(cta).toHaveAttribute("title", "Yakında");
  });
});
