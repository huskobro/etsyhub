/**
 * trend-cluster-drawer.test.tsx
 *
 * T-37 spec doğrulaması · TrendClusterDrawer sınırlı primitive migrasyonu.
 *
 * Sözleşme: docs/design/implementation-notes/trend-stories-screens.md
 *
 * KORUNUR (dokunulmaz):
 * - Modal: role="dialog" + aria-modal="true" + aria-label="Trend kümesi detayı"
 * - DrawerContent + DrawerPages + DrawerPage cursor sayfalama yapısı
 * - ClusterHeader yapısı (label + SeasonalBadge + 3 stat grid)
 * - StatCard inline yapı (3 kolon grid; primitive granularity uymaz)
 * - MemberRow yapısı (thumb + title + meta)
 *
 * Sınırlı dokunuşlar:
 * 1. Kapat butonu → Button variant=ghost
 * 2. ClusterHeader productType pill → Badge tone=accent
 * 3. MemberRow "Kaynak artık mevcut değil" → Badge tone=danger
 * 4. MemberRow "Kaynağı Aç" anchor → mevcut styled anchor KORUNUR (T-33 paterni)
 * 5. "Daha fazla yükle" → Button variant=ghost
 * 6. Loading "Küme yükleniyor…" → StateMessage tone=neutral
 * 7. Error → StateMessage tone=error
 * 8. SeasonalBadge KORUNDU (carry-forward)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/trend-stories/queries/use-cluster-detail", () => ({
  useClusterDetail: vi.fn(),
}));

import { TrendClusterDrawer } from "@/features/trend-stories/components/trend-cluster-drawer";
import {
  useClusterDetail,
  type ClusterDetailResponse,
  type ClusterMember,
} from "@/features/trend-stories/queries/use-cluster-detail";

const mockedUseClusterDetail = vi.mocked(useClusterDetail);

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function makeMember(overrides: Partial<ClusterMember> = {}): ClusterMember {
  return {
    listingId: overrides.listingId ?? "l-1",
    title: overrides.title ?? "Boho Print",
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    sourceUrl: overrides.sourceUrl ?? "https://etsy.com/listing/1",
    reviewCount: overrides.reviewCount ?? 12,
    firstSeenAt: overrides.firstSeenAt ?? "2026-04-01T00:00:00.000Z",
    competitorStoreName: overrides.competitorStoreName ?? "AlphaShop",
    deleted: overrides.deleted ?? false,
  };
}

function makeDetail(
  overrides: Partial<ClusterDetailResponse> = {},
): ClusterDetailResponse {
  return {
    cluster: overrides.cluster ?? {
      id: "c-1",
      label: "Boho Wall Art",
      memberCount: 12,
      storeCount: 4,
      totalReviewCount: 240,
      seasonalTag: null,
      productType: null,
      hero: null,
      status: "active",
      clusterScore: 0.42,
    },
    members: overrides.members ?? [makeMember()],
    nextCursor: overrides.nextCursor ?? null,
  };
}

function setDetailMock(state: {
  data?: ClusterDetailResponse;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error;
}) {
  mockedUseClusterDetail.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useClusterDetail>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TrendClusterDrawer — modal yapısı (KORUNDU)", () => {
  it("role=dialog + aria-modal + aria-label='Trend kümesi detayı' render eder", () => {
    setDetailMock({ data: makeDetail() });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", {
      name: "Trend kümesi detayı",
    });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});

describe("TrendClusterDrawer — kapat butonu", () => {
  it("Kapat butonu Button variant=ghost render eder", () => {
    setDetailMock({ data: makeDetail() });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Kapat/i });
    expect(btn).toBeInTheDocument();
    // Button variant=ghost → bg-transparent class'ı
    expect(btn.className).toMatch(/bg-transparent/);
  });

  it("Kapat butonuna tıklayınca onClose callback çağrılır", () => {
    setDetailMock({ data: makeDetail() });
    const onClose = vi.fn();
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Kapat/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("TrendClusterDrawer — states", () => {
  it("loading → StateMessage tone=neutral 'Küme yükleniyor…' render eder", () => {
    setDetailMock({ isLoading: true });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    expect(screen.getByText(/Küme yükleniyor/i)).toBeInTheDocument();
    // StateMessage neutral → role="status" (modal içinde)
    // Birden fazla status olabilir (modal içeriği) — `getAllByRole`
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("error → StateMessage tone=error + mesaj render eder", () => {
    setDetailMock({
      isError: true,
      error: new Error("Detay alınamadı"),
    });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    expect(screen.getByText("Detay alınamadı")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("Empty members → 'Bu kümede listing yok' mesajı (mevcut, korunur)", () => {
    setDetailMock({ data: makeDetail({ members: [] }) });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    expect(screen.getByText(/Bu kümede listing yok/i)).toBeInTheDocument();
  });
});

describe("TrendClusterDrawer — ClusterHeader productType pill", () => {
  it("productType varsa Badge tone=accent render eder", () => {
    setDetailMock({
      data: makeDetail({
        cluster: {
          id: "c-1",
          label: "Boho Wall Art",
          memberCount: 12,
          storeCount: 4,
          totalReviewCount: 240,
          seasonalTag: null,
          productType: {
            id: "pt-1",
            key: "wall_art",
            displayName: "Wall Art",
          },
          hero: null,
          status: "active",
          clusterScore: 0.42,
        },
      }),
    });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    const pill = screen.getByText("Wall Art");
    expect(pill.className).toMatch(/font-mono/);
    expect(pill.className).toMatch(/bg-accent-soft/);
  });
});

describe("TrendClusterDrawer — StatCard inline (KORUNDU)", () => {
  it("3 stat (Mağaza · Ürün · Toplam yorum) inline render eder", () => {
    setDetailMock({
      data: makeDetail({
        cluster: {
          id: "c-1",
          label: "Boho Wall Art",
          memberCount: 18,
          storeCount: 5,
          totalReviewCount: 320,
          seasonalTag: null,
          productType: null,
          hero: null,
          status: "active",
          clusterScore: 0.42,
        },
      }),
    });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    expect(screen.getByText("Mağaza")).toBeInTheDocument();
    expect(screen.getByText("Ürün")).toBeInTheDocument();
    expect(screen.getByText("Toplam yorum")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("320")).toBeInTheDocument();
  });
});

describe("TrendClusterDrawer — MemberRow", () => {
  it("'Kaynak artık mevcut değil' → Badge tone=danger render eder", () => {
    setDetailMock({
      data: makeDetail({
        members: [makeMember({ deleted: true })],
      }),
    });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    const pill = screen.getByText(/Kaynak artık mevcut değil/i);
    expect(pill.className).toMatch(/font-mono/);
    expect(pill.className).toMatch(/bg-danger-soft/);
  });

  it("'Kaynağı Aç' anchor styled href= sourceUrl ile (T-33 paterni — anchor korunur)", () => {
    setDetailMock({
      data: makeDetail({
        members: [
          makeMember({
            deleted: false,
            sourceUrl: "https://etsy.com/listing/42",
          }),
        ],
      }),
    });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    const link = screen.getByRole("link", { name: /Kaynağı Aç/i });
    expect(link).toHaveAttribute("href", "https://etsy.com/listing/42");
  });
});

describe("TrendClusterDrawer — load more", () => {
  it("nextCursor varsa 'Daha fazla yükle' Button variant=ghost render eder", () => {
    setDetailMock({
      data: makeDetail({ nextCursor: "cursor-2" }),
    });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Daha fazla yükle/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/bg-transparent/);
  });
});

describe("TrendClusterDrawer — a11y davranışları (Escape + backdrop + initial focus)", () => {
  it("Escape tuşu basıldığında onClose çağrılır", () => {
    setDetailMock({ data: makeDetail() });
    const onClose = vi.fn();
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop (dialog dışı overlay) tıklamasında onClose çağrılır; dialog içi tıklamada çağrılmaz", () => {
    setDetailMock({ data: makeDetail() });
    const onClose = vi.fn();
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={onClose} />);
    const dialog = screen.getByRole("dialog", {
      name: "Trend kümesi detayı",
    });
    // Dialog içi tıklama → onClose ÇAĞRILMAZ
    const heading = within(dialog).getByText("Trend Kümesi");
    fireEvent.click(heading);
    expect(onClose).not.toHaveBeenCalled();

    // Backdrop (overlay) tıklama → onClose çağrılır
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("drawer açıldığında 'Kapat' butonu document.activeElement olur (initial focus)", () => {
    setDetailMock({ data: makeDetail() });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /Kapat/i });
    expect(document.activeElement).toBe(btn);
  });

  it("T-40: Tab boundary — son focusable element'te Tab basınca ilk focusable'a wrap eder", () => {
    setDetailMock({
      data: makeDetail({ nextCursor: "cursor-2" }),
    });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    const closeBtn = screen.getByRole("button", { name: /Kapat/i });
    const loadMoreBtn = screen.getByRole("button", {
      name: /Daha fazla yükle/i,
    });
    // Modal içindeki son focusable → loadMoreBtn (veya sonraki). Onu odakla
    // ve Tab basıldığında ilk focusable olan Kapat butonuna wrap eder.
    loadMoreBtn.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeBtn);
  });

  it("T-40: Tab boundary — ilk focusable element'te Shift+Tab son focusable'a wrap eder", () => {
    setDetailMock({
      data: makeDetail({ nextCursor: "cursor-2" }),
    });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    const closeBtn = screen.getByRole("button", { name: /Kapat/i });
    const loadMoreBtn = screen.getByRole("button", {
      name: /Daha fazla yükle/i,
    });
    // Initial focus zaten Kapat butonunda.
    expect(document.activeElement).toBe(closeBtn);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(loadMoreBtn);
  });
});

describe("TrendClusterDrawer — SeasonalBadge (KORUNDU, carry-forward)", () => {
  it("seasonalTag varsa SeasonalBadge yerel pill olarak render edilmeye devam eder", () => {
    setDetailMock({
      data: makeDetail({
        cluster: {
          id: "c-1",
          label: "Christmas Wall Art",
          memberCount: 12,
          storeCount: 4,
          totalReviewCount: 240,
          seasonalTag: "christmas",
          productType: null,
          hero: null,
          status: "active",
          clusterScore: 0.42,
        },
      }),
    });
    wrapper(<TrendClusterDrawer clusterId="c-1" onClose={vi.fn()} />);
    // SeasonalBadge "Noel" Türkçe etiketini render eder
    expect(screen.getByText("Noel")).toBeInTheDocument();
  });
});
