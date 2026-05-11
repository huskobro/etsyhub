/**
 * trend-stories-page.test.tsx
 *
 * T-36 spec doğrulaması · TrendStoriesPage feed primitive migrasyonu.
 *
 * Sözleşme: docs/design/implementation-notes/trend-stories-screens.md
 * - PageShell variant=default tüketildi: title="Trend Akışı" + subtitle.
 *   actions slot boş; toolbar slot WindowTabs.
 * - WindowTabs gerçek client tab — `role="tablist"` + her tab `aria-controls`
 *   + `id`. Tek aktif `role="tabpanel"` + `aria-labelledby={activeTabId}`
 *   + tabIndex=0.
 * - Toast aria-live ton ayrımı: success → role="status" + aria-live="polite";
 *   error → role="alert" + aria-live="assertive". Token: bg-{tone}-soft.
 * - T-37 dosyaları (rail, cluster card, drawer, seasonal-badge, membership-badge)
 *   dokunulmaz.
 *
 * Mock pattern: useFeed + useClusters + useCreateTrendBookmark mock'lanır;
 * geri kalan primitive akışı gerçek render. TrendClusterDrawer ve
 * TrendClusterRail iç komponentler — useClusters mock'u ile sade akış kalır.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/trend-stories/queries/use-feed", () => ({
  useFeed: vi.fn(),
}));
vi.mock("@/features/trend-stories/queries/use-clusters", () => ({
  useClusters: vi.fn(),
}));
vi.mock("@/features/trend-stories/mutations/use-create-trend-bookmark", () => ({
  useCreateTrendBookmark: vi.fn(),
}));

import { TrendStoriesPage } from "@/features/trend-stories/components/trend-stories-page";
import {
  useFeed,
  type FeedListing,
  type FeedResponse,
} from "@/features/trend-stories/queries/use-feed";
import { useClusters } from "@/features/trend-stories/queries/use-clusters";
import { useCreateTrendBookmark } from "@/features/trend-stories/mutations/use-create-trend-bookmark";

const mockedUseFeed = vi.mocked(useFeed);
const mockedUseClusters = vi.mocked(useClusters);
const mockedUseBookmark = vi.mocked(useCreateTrendBookmark);

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function makeListing(overrides: Partial<FeedListing> = {}): FeedListing {
  return {
    listingId: overrides.listingId ?? "l-1",
    title: overrides.title ?? "Boho Wall Art",
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    reviewCount: overrides.reviewCount ?? 12,
    sourceUrl: overrides.sourceUrl ?? "https://etsy.com/listing/1",
    competitorStoreId: overrides.competitorStoreId ?? "cs-1",
    competitorStoreName: overrides.competitorStoreName ?? "AlphaShop",
    firstSeenAt: overrides.firstSeenAt ?? "2026-04-01T00:00:00.000Z",
    trendMembershipHint: overrides.trendMembershipHint ?? null,
  };
}

function setFeedMock(state: {
  data?: FeedResponse;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error;
}) {
  mockedUseFeed.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useFeed>);
}

function setClustersMock() {
  mockedUseClusters.mockReturnValue({
    data: { clusters: [] },
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useClusters>);
}

function setBookmarkMock(overrides: { mutate?: ReturnType<typeof vi.fn> } = {}) {
  const mutate = overrides.mutate ?? vi.fn();
  mockedUseBookmark.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateTrendBookmark>);
  return { mutate };
}

beforeEach(() => {
  vi.clearAllMocks();
  setFeedMock({
    data: { items: [makeListing()], nextCursor: null },
  });
  setClustersMock();
  setBookmarkMock();
});

describe("TrendStoriesPage — header", () => {
  it("PageShell toolbar WindowTabs render eder (R11.14.3 title boş)", () => {
    wrapper(<TrendStoriesPage />);
    // R11.14.3: title="" — tablist varlığı canonical giriş noktası.
    const tablist = screen.getByRole("tablist", {
      name: /Trend zaman penceresi/i,
    });
    expect(tablist).toBeInTheDocument();
  });

  it("toolbar slot'unda WindowTabs render edilir (role=tablist + 3 tab)", () => {
    wrapper(<TrendStoriesPage />);
    const tablist = screen.getByRole("tablist", {
      name: /Trend zaman penceresi/i,
    });
    expect(tablist).toBeInTheDocument();
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(3);
  });
});

describe("TrendStoriesPage — WindowTabs ARIA", () => {
  it("her tab id ve aria-controls attribute'larına sahip", () => {
    wrapper(<TrendStoriesPage />);
    const tabs = screen.getAllByRole("tab");
    for (const tab of tabs) {
      expect(tab).toHaveAttribute("id");
      expect(tab).toHaveAttribute("aria-controls");
    }
  });

  it("aktif tab tabIndex=0, diğerleri tabIndex=-1", () => {
    wrapper(<TrendStoriesPage />);
    const tabs = screen.getAllByRole("tab");
    const active = tabs.find(
      (t) => t.getAttribute("aria-selected") === "true",
    );
    const inactive = tabs.filter(
      (t) => t.getAttribute("aria-selected") !== "true",
    );
    expect(active).toHaveAttribute("tabindex", "0");
    for (const t of inactive) expect(t).toHaveAttribute("tabindex", "-1");
  });

  it("tabpanel aria-labelledby aktif tab id'ye eşit + tabIndex=0 + id=aria-controls", () => {
    wrapper(<TrendStoriesPage />);
    const activeTab = screen
      .getAllByRole("tab")
      .find((t) => t.getAttribute("aria-selected") === "true");
    expect(activeTab).toBeDefined();
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute(
      "aria-labelledby",
      activeTab!.getAttribute("id"),
    );
    expect(panel).toHaveAttribute("tabindex", "0");
    expect(panel).toHaveAttribute(
      "id",
      activeTab!.getAttribute("aria-controls"),
    );
  });

  it("tab click → aria-selected=true geçer + useFeed window param ile re-call edilir", () => {
    wrapper(<TrendStoriesPage />);
    const tab30 = screen.getByRole("tab", { name: /30 days/i });
    fireEvent.click(tab30);
    expect(tab30).toHaveAttribute("aria-selected", "true");
    const lastCall = mockedUseFeed.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(30);
  });
});

describe("TrendStoriesPage — Toast aria-live ton ayrımı", () => {
  it("Bookmark success → toast role='status' + aria-live='polite' + bg-success-soft", () => {
    const mutate = vi.fn(
      (
        _vars: unknown,
        opts: { onSuccess: () => void; onSettled: () => void },
      ) => {
        opts.onSuccess();
        opts.onSettled();
      },
    );
    setBookmarkMock({ mutate });

    wrapper(<TrendStoriesPage />);
    fireEvent.click(screen.getByRole("button", { name: /Bookmark'a ekle/i }));

    const toasts = screen.getAllByRole("status");
    // PageShell + StateMessage olmadığı için: success toast role=status
    const successToast = toasts.find((t) =>
      /Bookmark eklendi/.test(t.textContent ?? ""),
    );
    expect(successToast).toBeDefined();
    expect(successToast).toHaveAttribute("aria-live", "polite");
    expect(successToast!.className).toMatch(/bg-success-soft/);
  });

  it("Bookmark error → toast role='alert' + aria-live='assertive' + bg-danger-soft", () => {
    const mutate = vi.fn(
      (
        _vars: unknown,
        opts: { onError: (e: Error) => void; onSettled: () => void },
      ) => {
        opts.onError(new Error("network down"));
        opts.onSettled();
      },
    );
    setBookmarkMock({ mutate });

    wrapper(<TrendStoriesPage />);
    fireEvent.click(screen.getByRole("button", { name: /Bookmark'a ekle/i }));

    const errorToast = screen
      .getAllByRole("alert")
      .find((t) => /network down/.test(t.textContent ?? ""));
    expect(errorToast).toBeDefined();
    expect(errorToast).toHaveAttribute("aria-live", "assertive");
    expect(errorToast!.className).toMatch(/bg-danger-soft/);
  });
});
