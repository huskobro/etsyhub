/**
 * trend-cluster-rail.test.tsx
 *
 * T-37 spec doğrulaması · TrendClusterRail + TrendClusterCard primitive migrasyonu.
 *
 * Sözleşme: docs/design/implementation-notes/trend-stories-screens.md
 * - Rail loading → StateMessage tone="neutral" (manuel 4'lü skeleton kaldırıldı)
 * - Rail error → StateMessage tone="error"
 * - Rail empty → StateMessage tone="neutral" "Bu pencerede trend kümesi henüz yok"
 * - Header: <h2>Trend Kümeleri</h2> + "{N} küme" mono muted KORUNUR
 * - TrendClusterCard: <button> → Card as="button" interactive (Card primitive API mevcut)
 * - aria-label="Trend kümesi: {label}" KORUNUR (Card primitive ...rest forward eder)
 * - Mağaza/Ürün count → Badge tone="neutral" (2 adet)
 * - ProductType pill → Badge tone="accent" (varsa)
 * - SeasonalBadge KORUNDU (mevcut yerel pill, dokunulmadı — Badge primitive emoji slot yok)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/trend-stories/queries/use-clusters", () => ({
  useClusters: vi.fn(),
}));

import { TrendClusterRail } from "@/features/trend-stories/components/trend-cluster-rail";
import { TrendClusterCard } from "@/features/trend-stories/components/trend-cluster-card";
import {
  useClusters,
  type TrendClusterSummary,
  type ClustersResponse,
} from "@/features/trend-stories/queries/use-clusters";

const mockedUseClusters = vi.mocked(useClusters);

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function makeCluster(
  overrides: Partial<TrendClusterSummary> = {},
): TrendClusterSummary {
  return {
    id: overrides.id ?? "c-1",
    label: overrides.label ?? "Boho Wall Art",
    memberCount: overrides.memberCount ?? 12,
    storeCount: overrides.storeCount ?? 4,
    totalReviewCount: overrides.totalReviewCount ?? 240,
    latestMemberSeenAt: overrides.latestMemberSeenAt ?? null,
    seasonalTag:
      overrides.seasonalTag === undefined ? null : overrides.seasonalTag,
    productType:
      overrides.productType === undefined ? null : overrides.productType,
    hero: overrides.hero === undefined ? null : overrides.hero,
    clusterScore: overrides.clusterScore ?? 0.42,
  };
}

function setClustersMock(state: {
  data?: ClustersResponse;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error;
}) {
  mockedUseClusters.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useClusters>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TrendClusterRail — header", () => {
  it("Header: 'Trend Kümeleri' + '{N} küme' mono muted render eder", () => {
    setClustersMock({
      data: {
        clusters: [makeCluster({ id: "c-1" }), makeCluster({ id: "c-2" })],
      },
    });
    wrapper(<TrendClusterRail windowDays={7} onOpenCluster={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /Trend Kümeleri/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 küme/i)).toBeInTheDocument();
  });
});

describe("TrendClusterRail — states", () => {
  it("loading → StateMessage tone=neutral (manuel skeleton kaldırıldı)", () => {
    setClustersMock({ isLoading: true });
    wrapper(<TrendClusterRail windowDays={7} onOpenCluster={vi.fn()} />);
    // animate-pulse skeleton kaldırıldı
    expect(document.querySelector(".animate-pulse")).toBeNull();
    // StateMessage neutral → role="status"
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
  });

  it("error → StateMessage tone=error mesajı render eder", () => {
    setClustersMock({
      isError: true,
      error: new Error("Cluster API bozuldu"),
    });
    wrapper(<TrendClusterRail windowDays={7} onOpenCluster={vi.fn()} />);
    expect(screen.getByText("Cluster API bozuldu")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
  });

  it("empty → StateMessage 'Bu pencerede trend kümesi henüz yok' render eder", () => {
    setClustersMock({ data: { clusters: [] } });
    wrapper(<TrendClusterRail windowDays={7} onOpenCluster={vi.fn()} />);
    expect(
      screen.getByText(/Bu pencerede trend kümesi henüz yok/i),
    ).toBeInTheDocument();
  });
});

describe("TrendClusterCard — primitive consumption", () => {
  it("Card as='button' render eder (data-variant + role=button + aria-label)", () => {
    render(<TrendClusterCard cluster={makeCluster()} onOpen={vi.fn()} />);
    const btn = screen.getByRole("button", {
      name: /Trend kümesi: Boho Wall Art/i,
    });
    expect(btn).toBeInTheDocument();
    // Card primitive data-variant attribute ile işaretler
    expect(btn).toHaveAttribute("data-variant");
    expect(btn.tagName).toBe("BUTTON");
  });

  it("Tıklanınca onOpen callback cluster.id ile çağrılır", () => {
    const onOpen = vi.fn();
    render(
      <TrendClusterCard
        cluster={makeCluster({ id: "cluster-42" })}
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Trend kümesi:/i }));
    expect(onOpen).toHaveBeenCalledWith("cluster-42");
  });

  it("Mağaza ve Ürün count Badge tone=neutral olarak render eder (2 adet)", () => {
    const { container } = render(
      <TrendClusterCard
        cluster={makeCluster({ storeCount: 5, memberCount: 18 })}
        onOpen={vi.fn()}
      />,
    );
    // Badge primitive font-mono + bg-surface-2 (neutral) class'larını içerir
    const storeBadge = screen.getByText(/5 mağaza/i);
    const memberBadge = screen.getByText(/18 ürün/i);
    expect(storeBadge.className).toMatch(/font-mono/);
    expect(storeBadge.className).toMatch(/bg-surface-2/);
    expect(memberBadge.className).toMatch(/font-mono/);
    expect(memberBadge.className).toMatch(/bg-surface-2/);
    // Eski bg-surface-muted pill kalmamış olmalı (Badge'e dönüştü)
    expect(container.querySelectorAll(".bg-surface-muted")).toHaveLength(0);
  });

  it("ProductType varsa Badge tone=accent render eder", () => {
    render(
      <TrendClusterCard
        cluster={makeCluster({
          productType: {
            id: "pt-1",
            key: "wall_art",
            displayName: "Wall Art",
          },
        })}
        onOpen={vi.fn()}
      />,
    );
    const accentBadge = screen.getByText("Wall Art");
    expect(accentBadge.className).toMatch(/font-mono/);
    expect(accentBadge.className).toMatch(/bg-accent-soft/);
  });

  it("SeasonalBadge yerel pill olarak render edilmeye devam eder (carry-forward)", () => {
    render(
      <TrendClusterCard
        cluster={makeCluster({ seasonalTag: "christmas" })}
        onOpen={vi.fn()}
      />,
    );
    // SeasonalBadge "Noel" Türkçe etiketini render eder
    expect(screen.getByText("Noel")).toBeInTheDocument();
  });
});
