/**
 * trend-feed.test.tsx
 *
 * T-36 spec doğrulaması · TrendFeed + FeedListingCard primitive migrasyonu.
 *
 * Sözleşme: docs/design/implementation-notes/trend-stories-screens.md
 * - Loading → StateMessage tone="neutral" (manuel skeleton kaldırıldı)
 * - Empty → StateMessage tone="neutral" "Bu pencerede listing yok"
 * - Error → StateMessage tone="error"
 * - "Daha fazla yükle" → Button (variant ghost)
 * - FeedListingCard: <article> → Card primitive (as="article")
 * - Bookmark butonu → Button variant="primary"
 * - Kaynağı Aç anchor styled KORUNUR (T-33 paterni)
 * - TrendMembershipBadge KORUNUR (yerel pill, dokunulmaz)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/features/trend-stories/queries/use-feed", () => ({
  useFeed: vi.fn(),
}));
vi.mock("@/features/trend-stories/mutations/use-create-trend-bookmark", () => ({
  useCreateTrendBookmark: vi.fn(),
}));

import { TrendFeed } from "@/features/trend-stories/components/trend-feed";
import { FeedListingCard } from "@/features/trend-stories/components/feed-listing-card";
import {
  useFeed,
  type FeedListing,
  type FeedResponse,
} from "@/features/trend-stories/queries/use-feed";
import { useCreateTrendBookmark } from "@/features/trend-stories/mutations/use-create-trend-bookmark";

const mockedUseFeed = vi.mocked(useFeed);
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
  setBookmarkMock();
});

describe("TrendFeed — states", () => {
  it("loading → StateMessage tone=neutral 'Yükleniyor' render eder", () => {
    setFeedMock({ isLoading: true });
    wrapper(
      <TrendFeed
        windowDays={7}
        onOpenCluster={vi.fn()}
        onToast={vi.fn()}
      />,
    );
    expect(screen.getByText(/yükleniyor/i)).toBeInTheDocument();
    // manuel skeleton grid kaldırıldı — animate-pulse yok
    expect(document.querySelector(".animate-pulse")).toBeNull();
  });

  it("empty → StateMessage 'Bu pencerede listing yok' render eder", () => {
    setFeedMock({ data: { items: [], nextCursor: null } });
    wrapper(
      <TrendFeed
        windowDays={7}
        onOpenCluster={vi.fn()}
        onToast={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Bu pencerede listing yok/i),
    ).toBeInTheDocument();
  });

  it("error → StateMessage tone=error + error mesajı render eder", () => {
    setFeedMock({
      isError: true,
      error: new Error("Feed kırıldı"),
    });
    wrapper(
      <TrendFeed
        windowDays={7}
        onOpenCluster={vi.fn()}
        onToast={vi.fn()}
      />,
    );
    expect(screen.getByText("Feed kırıldı")).toBeInTheDocument();
    // error → role="alert"
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
  });
});

describe("TrendFeed — load more", () => {
  it("nextCursor varsa 'Daha fazla yükle' Button render eder", () => {
    setFeedMock({
      data: { items: [makeListing()], nextCursor: "cursor-2" },
    });
    wrapper(
      <TrendFeed
        windowDays={7}
        onOpenCluster={vi.fn()}
        onToast={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Daha fazla yükle/i });
    expect(btn).toBeInTheDocument();
    // Button primitive ghost variant — bg-transparent class'ı içerir
    expect(btn.className).toMatch(/bg-transparent/);
  });
});

describe("FeedListingCard — primitive consumption", () => {
  it("<article> Card primitive olarak render eder (data-variant attribute)", () => {
    const { container } = render(
      <FeedListingCard
        listing={makeListing()}
        bookmarking={false}
        onBookmark={vi.fn()}
        onOpenCluster={vi.fn()}
      />,
    );
    const article = container.querySelector("article");
    expect(article).not.toBeNull();
    // Card primitive data-variant attribute ile işaretler
    expect(article).toHaveAttribute("data-variant");
  });

  it("Bookmark butonuna tıklandığında onBookmark listing ile çağrılır", () => {
    const onBookmark = vi.fn();
    const listing = makeListing();
    render(
      <FeedListingCard
        listing={listing}
        bookmarking={false}
        onBookmark={onBookmark}
        onOpenCluster={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Bookmark'a ekle/i }));
    expect(onBookmark).toHaveBeenCalledWith(listing);
  });

  it("Bookmark butonu Button variant=primary class'ları içerir", () => {
    const { container } = render(
      <FeedListingCard
        listing={makeListing()}
        bookmarking={false}
        onBookmark={vi.fn()}
        onOpenCluster={vi.fn()}
      />,
    );
    const btn = within(container).getByRole("button", {
      name: /Bookmark'a ekle/i,
    });
    expect(btn.className).toMatch(/bg-accent/);
  });

  it("Kaynağı Aç anchor href = listing.sourceUrl (T-33 paterni — anchor styled korunur)", () => {
    render(
      <FeedListingCard
        listing={makeListing({ sourceUrl: "https://etsy.com/listing/42" })}
        bookmarking={false}
        onBookmark={vi.fn()}
        onOpenCluster={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: /Kaynağı Aç/i });
    expect(link).toHaveAttribute("href", "https://etsy.com/listing/42");
  });

  it("trendMembershipHint varsa TrendMembershipBadge render eder (dokunulmadı)", () => {
    render(
      <FeedListingCard
        listing={makeListing({
          trendMembershipHint: {
            clusterId: "c-1",
            label: "Boho",
            seasonalTag: null,
          },
        })}
        bookmarking={false}
        onBookmark={vi.fn()}
        onOpenCluster={vi.fn()}
      />,
    );
    expect(screen.getByText(/Trend: Boho/i)).toBeInTheDocument();
  });
});

