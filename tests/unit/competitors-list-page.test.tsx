/**
 * competitors-list-page.test.tsx
 *
 * T-33 spec doğrulaması · CompetitorListPage primitive migrasyonu.
 *
 * Sözleşme: docs/design/implementation-notes/competitors-screens.md
 * - PageShell (variant default) tüketilir: title="Rakipler" + subtitle + actions
 * - Toolbar: search input (leading) + 3 filter chip (Tümü / Oto-tarama / Manuel)
 * - StateMessage: loading / empty / error
 * - CompetitorCard: Card + Badge (success/neutral) + Button consume
 * - AddCompetitorDialog dokunulmaz
 *
 * Mock pattern: useCompetitorsList + useTriggerScanStandalone + AddCompetitorDialog
 * mock'lanır; geri kalan tüm primitive akışı gerçek render olur.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import {
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/competitors/queries/use-competitors", () => ({
  useCompetitorsList: vi.fn(),
}));
vi.mock("@/features/competitors/mutations/use-trigger-scan-standalone", () => ({
  useTriggerScanStandalone: vi.fn(),
}));
vi.mock("@/features/competitors/components/add-competitor-dialog", () => ({
  AddCompetitorDialog: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="add-competitor-dialog">
      <button type="button" onClick={onClose}>
        close-dialog
      </button>
    </div>
  ),
}));

import { CompetitorListPage } from "@/features/competitors/components/competitor-list-page";
import { CompetitorCard } from "@/features/competitors/components/competitor-card";
import { useCompetitorsList } from "@/features/competitors/queries/use-competitors";
import { useTriggerScanStandalone } from "@/features/competitors/mutations/use-trigger-scan-standalone";

const mockedUseList = vi.mocked(useCompetitorsList);
const mockedUseTriggerScan = vi.mocked(useTriggerScanStandalone);

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

type Competitor = {
  id: string;
  etsyShopName: string;
  displayName: string | null;
  platform: "ETSY" | "AMAZON";
  shopUrl: string | null;
  totalListings: number | null;
  totalReviews: number | null;
  autoScanEnabled: boolean;
  lastScannedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function makeCompetitor(overrides: Partial<Competitor> = {}): Competitor {
  return {
    id: overrides.id ?? "c-1",
    etsyShopName: overrides.etsyShopName ?? "alphashop",
    displayName: overrides.displayName ?? "Alpha Shop",
    platform: overrides.platform ?? "ETSY",
    shopUrl: overrides.shopUrl ?? "https://etsy.com/shop/alphashop",
    totalListings: overrides.totalListings ?? 12,
    totalReviews: overrides.totalReviews ?? 100,
    autoScanEnabled: overrides.autoScanEnabled ?? true,
    lastScannedAt: overrides.lastScannedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-04-01T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-01T00:00:00.000Z",
  };
}

function setListMock(state: {
  data?: { items: Competitor[]; nextCursor: string | null };
  isLoading?: boolean;
  isError?: boolean;
  error?: Error;
}) {
  mockedUseList.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
    // diğer useQuery alanları test için kullanılmıyor
  } as unknown as ReturnType<typeof useCompetitorsList>);
}

function setScanMock(overrides: { mutate?: ReturnType<typeof vi.fn> } = {}) {
  const mutate = overrides.mutate ?? vi.fn();
  mockedUseTriggerScan.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useTriggerScanStandalone>);
  return { mutate };
}

beforeEach(() => {
  vi.clearAllMocks();
  setListMock({ data: { items: [], nextCursor: null } });
  setScanMock();
});

describe("CompetitorListPage — header", () => {
  it("PageShell içinde AddCompetitorDialog açan buton render eder", () => {
    setListMock({ data: { items: [], nextCursor: null } });
    wrapper(<CompetitorListPage />);
    // R11.14.3: title=="" (çift header kaldırıldı) — sadece action buton kontrol edilir
    expect(
      screen.getByRole("button", { name: /\+ Add Shop/i }),
    ).toBeInTheDocument();
  });

  it("'+ Add Shop' butonuna tıklandığında AddCompetitorDialog açılır", () => {
    wrapper(<CompetitorListPage />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Add Shop/i }));
    expect(screen.getByTestId("add-competitor-dialog")).toBeInTheDocument();
  });
});

describe("CompetitorListPage — toolbar", () => {
  it("search input değişimi useCompetitorsList'e q parametresi olarak geçer", () => {
    wrapper(<CompetitorListPage />);
    const search = screen.getByLabelText(/Search competitors/i) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "boho" } });
    // En son render'da q="boho" beklenir
    const lastCall = mockedUseList.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual({ q: "boho" });
  });

  it("varsayılanda 'All' chip aktiftir (aria-pressed=true)", () => {
    wrapper(<CompetitorListPage />);
    const all = screen.getByRole("button", { name: "All" });
    expect(all).toHaveAttribute("aria-pressed", "true");
  });

  it("'Auto-scan' chip seçilince yalnızca autoScanEnabled=true rakipler render edilir", () => {
    setListMock({
      data: {
        items: [
          makeCompetitor({ id: "c-auto", displayName: "AutoShop", autoScanEnabled: true }),
          makeCompetitor({ id: "c-manual", displayName: "ManualShop", autoScanEnabled: false }),
        ],
        nextCursor: null,
      },
    });
    wrapper(<CompetitorListPage />);
    fireEvent.click(screen.getByRole("button", { name: "Auto-scan" }));
    expect(screen.getByText("AutoShop")).toBeInTheDocument();
    expect(screen.queryByText("ManualShop")).not.toBeInTheDocument();
  });

  it("'Manual' chip seçilince yalnızca autoScanEnabled=false rakipler render edilir", () => {
    setListMock({
      data: {
        items: [
          makeCompetitor({ id: "c-auto", displayName: "AutoShop", autoScanEnabled: true }),
          makeCompetitor({ id: "c-manual", displayName: "ManualShop", autoScanEnabled: false }),
        ],
        nextCursor: null,
      },
    });
    wrapper(<CompetitorListPage />);
    fireEvent.click(screen.getByRole("button", { name: "Manual" }));
    expect(screen.getByText("ManualShop")).toBeInTheDocument();
    expect(screen.queryByText("AutoShop")).not.toBeInTheDocument();
  });
});

describe("CompetitorListPage — state messages", () => {
  it("loading state → StateMessage 'Loading…' render eder", () => {
    setListMock({ isLoading: true });
    wrapper(<CompetitorListPage />);
    expect(screen.getByText(/Loading…/i)).toBeInTheDocument();
  });

  it("empty state → 'No competitor shops yet' StateMessage'ı render eder", () => {
    setListMock({ data: { items: [], nextCursor: null } });
    wrapper(<CompetitorListPage />);
    expect(screen.getByText(/No competitor shops yet/i)).toBeInTheDocument();
  });

  it("error state → StateMessage error tone ile error mesajı render eder", () => {
    setListMock({
      isError: true,
      error: new Error("Liste alınamadı"),
    });
    wrapper(<CompetitorListPage />);
    // body field contains the error message
    expect(screen.getByText("Liste alınamadı")).toBeInTheDocument();
  });
});

describe("CompetitorCard — primitive consumption", () => {
  it("Scan butonuna tıklandığında onTriggerScan competitor.id ile çağrılır", () => {
    const onTriggerScan = vi.fn();
    render(
      <CompetitorCard
        competitor={makeCompetitor({ id: "c-tara" })}
        onTriggerScan={onTriggerScan}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Scan$/i }));
    expect(onTriggerScan).toHaveBeenCalledWith("c-tara");
  });

  it("Detail link href değeri /competitors/{id} olur", () => {
    render(
      <CompetitorCard
        competitor={makeCompetitor({ id: "c-detay" })}
        onTriggerScan={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: /^Detail$/i });
    expect(link).toHaveAttribute("href", "/competitors/c-detay");
  });

  it("autoScanEnabled=true → success tone Badge ('Auto-scan')", () => {
    const { container } = render(
      <CompetitorCard
        competitor={makeCompetitor({ autoScanEnabled: true })}
        onTriggerScan={vi.fn()}
      />,
    );
    const badge = within(container).getByText("Auto-scan");
    // k-badge uses data-tone attribute (CSS recipe in globals.css)
    expect(badge).toHaveAttribute("data-tone", "success");
  });

  it("autoScanEnabled=false → neutral tone Badge ('Manual')", () => {
    const { container } = render(
      <CompetitorCard
        competitor={makeCompetitor({ autoScanEnabled: false })}
        onTriggerScan={vi.fn()}
      />,
    );
    const badge = within(container).getByText("Manual");
    expect(badge).toHaveAttribute("data-tone", "neutral");
  });
});
