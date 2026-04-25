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
  it("PageShell içinde title 'Rakipler' ve subtitle render eder", () => {
    setListMock({ data: { items: [], nextCursor: null } });
    wrapper(<CompetitorListPage />);
    expect(screen.getByText("Rakipler")).toBeInTheDocument();
    expect(
      screen.getByText(/Etsy\/Amazon mağazalarını takibe al/i),
    ).toBeInTheDocument();
  });

  it("'+ Rakip Ekle' butonuna tıklandığında AddCompetitorDialog açılır", () => {
    wrapper(<CompetitorListPage />);
    fireEvent.click(screen.getByRole("button", { name: /\+ Rakip Ekle/i }));
    expect(screen.getByTestId("add-competitor-dialog")).toBeInTheDocument();
  });
});

describe("CompetitorListPage — toolbar", () => {
  it("search input değişimi useCompetitorsList'e q parametresi olarak geçer", () => {
    wrapper(<CompetitorListPage />);
    const search = screen.getByLabelText(/Rakip arama/i) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "boho" } });
    // En son render'da q="boho" beklenir
    const lastCall = mockedUseList.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual({ q: "boho" });
  });

  it("varsayılanda 'Tümü' chip aktiftir (aria-pressed=true)", () => {
    wrapper(<CompetitorListPage />);
    const tumu = screen.getByRole("button", { name: "Tümü" });
    expect(tumu).toHaveAttribute("aria-pressed", "true");
  });

  it("'Oto-tarama' chip seçilince yalnızca autoScanEnabled=true rakipler render edilir", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Oto-tarama" }));
    expect(screen.getByText("AutoShop")).toBeInTheDocument();
    expect(screen.queryByText("ManualShop")).not.toBeInTheDocument();
  });

  it("'Manuel' chip seçilince yalnızca autoScanEnabled=false rakipler render edilir", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Manuel" }));
    expect(screen.getByText("ManualShop")).toBeInTheDocument();
    expect(screen.queryByText("AutoShop")).not.toBeInTheDocument();
  });
});

describe("CompetitorListPage — state messages", () => {
  it("loading state → StateMessage skeleton/loading mesajı render eder", () => {
    setListMock({ isLoading: true });
    wrapper(<CompetitorListPage />);
    // StateMessage tüketildi → role status mevcut, içerik 'Yükleniyor' veya benzeri
    expect(screen.getByText(/yükleniyor/i)).toBeInTheDocument();
  });

  it("empty state → 'Henüz rakip mağaza yok' StateMessage'ı render eder", () => {
    setListMock({ data: { items: [], nextCursor: null } });
    wrapper(<CompetitorListPage />);
    expect(screen.getByText(/Henüz rakip mağaza yok/i)).toBeInTheDocument();
  });

  it("error state → StateMessage error tone ile error mesajı render eder", () => {
    setListMock({
      isError: true,
      error: new Error("Liste alınamadı"),
    });
    wrapper(<CompetitorListPage />);
    expect(screen.getByText("Liste alınamadı")).toBeInTheDocument();
  });
});

describe("CompetitorCard — primitive consumption", () => {
  it("Tara butonuna tıklandığında onTriggerScan competitor.id ile çağrılır", () => {
    const onTriggerScan = vi.fn();
    render(
      <CompetitorCard
        competitor={makeCompetitor({ id: "c-tara" })}
        onTriggerScan={onTriggerScan}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Tara/i }));
    expect(onTriggerScan).toHaveBeenCalledWith("c-tara");
  });

  it("Detay link href değeri /competitors/{id} olur", () => {
    render(
      <CompetitorCard
        competitor={makeCompetitor({ id: "c-detay" })}
        onTriggerScan={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: /Detay/i });
    expect(link).toHaveAttribute("href", "/competitors/c-detay");
  });

  it("autoScanEnabled=true → success tone Badge ('Oto-tarama')", () => {
    const { container } = render(
      <CompetitorCard
        competitor={makeCompetitor({ autoScanEnabled: true })}
        onTriggerScan={vi.fn()}
      />,
    );
    const badge = within(container).getByText("Oto-tarama");
    // Badge primitive success tone class'ları içerir
    expect(badge.className).toMatch(/bg-success-soft/);
    expect(badge.className).toMatch(/text-success/);
  });

  it("autoScanEnabled=false → neutral tone Badge ('Manuel')", () => {
    const { container } = render(
      <CompetitorCard
        competitor={makeCompetitor({ autoScanEnabled: false })}
        onTriggerScan={vi.fn()}
      />,
    );
    const badge = within(container).getByText("Manuel");
    expect(badge.className).toMatch(/bg-surface-2/);
    expect(badge.className).toMatch(/text-text-muted/);
  });
});
