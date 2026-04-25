/**
 * competitor-detail-page.test.tsx
 *
 * T-34 spec doğrulaması · CompetitorDetailPage primitive migrasyonu.
 *
 * Sözleşme: docs/design/implementation-notes/competitors-screens.md
 * - PageShell (variant default) tüketilir: title=shopLabel + subtitle (platform·etsyShopName)
 *   + actions=`Yeni Tarama` Button. Breadcrumb manuel <nav> KORUNUR (PageShell üstünde).
 * - Date-range tabs gerçek client tab — `role="tablist"` + her tab `aria-controls` + `id`.
 *   Tek aktif `role="tabpanel"` + `aria-labelledby={activeTabId}` + tabIndex=0.
 * - ListingRankCard: Card + Badge (rank=accent, review=neutral) + Button primitive.
 * - StateMessage loading / empty / error.
 * - Toast manuel role="status" KORUNUR (3+ ekran tüketimi → primitive terfi sonrası).
 * - PromoteToReferenceDialog + ReviewCountDisclaimer dokunulmaz.
 *
 * Mock pattern: useCompetitor + useCompetitorListings + useTriggerScan +
 * useBookmarkListing + usePromoteListingToReference mock'lanır; geri kalan
 * primitive akışı gerçek render olur. PromoteToReferenceDialog yalın stub.
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

vi.mock("@/features/competitors/queries/use-competitor", () => ({
  useCompetitor: vi.fn(),
  useCompetitorListings: vi.fn(),
}));
vi.mock("@/features/competitors/mutations/use-trigger-scan", () => ({
  useTriggerScan: vi.fn(),
}));
vi.mock("@/features/competitors/mutations/use-bookmark-listing", () => ({
  useBookmarkListing: vi.fn(),
}));
vi.mock("@/features/competitors/mutations/use-promote-listing-to-reference", () => ({
  usePromoteListingToReference: vi.fn(),
}));
vi.mock("@/features/competitors/components/promote-to-reference-dialog", () => ({
  PromoteToReferenceDialog: ({
    listing,
    productTypes,
    onClose,
    onSubmit,
  }: {
    listing: { title: string };
    productTypes: { id: string; displayName: string }[];
    onClose: () => void;
    onSubmit: (productTypeId: string) => void;
  }) => (
    <div data-testid="promote-dialog">
      <span>promote:{listing.title}</span>
      <button
        type="button"
        onClick={() => onSubmit(productTypes[0]?.id ?? "")}
      >
        promote-submit
      </button>
      <button type="button" onClick={onClose}>
        promote-close
      </button>
    </div>
  ),
}));

import { CompetitorDetailPage } from "@/features/competitors/components/competitor-detail-page";
import { ListingRankCard } from "@/features/competitors/components/listing-rank-card";
import {
  useCompetitor,
  useCompetitorListings,
  type CompetitorListing,
} from "@/features/competitors/queries/use-competitor";
import { useTriggerScan } from "@/features/competitors/mutations/use-trigger-scan";
import { useBookmarkListing } from "@/features/competitors/mutations/use-bookmark-listing";
import { usePromoteListingToReference } from "@/features/competitors/mutations/use-promote-listing-to-reference";

const mockedUseCompetitor = vi.mocked(useCompetitor);
const mockedUseListings = vi.mocked(useCompetitorListings);
const mockedUseTriggerScan = vi.mocked(useTriggerScan);
const mockedUseBookmark = vi.mocked(useBookmarkListing);
const mockedUsePromote = vi.mocked(usePromoteListingToReference);

function wrapper(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

function makeCompetitorDetail() {
  return {
    competitor: {
      id: "c-1",
      etsyShopName: "alphashop",
      displayName: "Alpha Shop",
      platform: "ETSY" as const,
      shopUrl: "https://etsy.com/shop/alphashop",
      totalListings: 12,
      totalReviews: 100,
      autoScanEnabled: true,
      lastScannedAt: null,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    lastScan: {
      id: "scan-1",
      type: "MANUAL_REFRESH" as const,
      status: "SUCCESS" as const,
      provider: "apify",
      listingsFound: 12,
      listingsNew: 3,
      listingsUpdated: 9,
      errorMessage: null,
      startedAt: "2026-04-20T08:00:00.000Z",
      finishedAt: "2026-04-20T08:01:00.000Z",
      createdAt: "2026-04-20T08:00:00.000Z",
    },
  };
}

function makeListing(overrides: Partial<CompetitorListing> = {}): CompetitorListing {
  return {
    id: overrides.id ?? "l-1",
    externalId: overrides.externalId ?? "ext-1",
    platform: overrides.platform ?? "ETSY",
    sourceUrl: overrides.sourceUrl ?? "https://etsy.com/listing/1",
    title: overrides.title ?? "Boho Wall Art",
    thumbnailUrl: overrides.thumbnailUrl ?? null,
    imageUrls: overrides.imageUrls ?? [],
    priceCents: overrides.priceCents ?? 1999,
    currency: overrides.currency ?? "USD",
    reviewCount: overrides.reviewCount ?? 42,
    favoritesCount: overrides.favoritesCount ?? 7,
    listingCreatedAt: overrides.listingCreatedAt ?? null,
    latestReviewAt: overrides.latestReviewAt ?? null,
    firstSeenAt: overrides.firstSeenAt ?? "2026-04-01T00:00:00.000Z",
    lastSeenAt: overrides.lastSeenAt ?? "2026-04-20T00:00:00.000Z",
    status: overrides.status ?? "ACTIVE",
  };
}

function setCompetitorMock(state: {
  data?: ReturnType<typeof makeCompetitorDetail>;
  isLoading?: boolean;
  isError?: boolean;
  error?: Error;
}) {
  mockedUseCompetitor.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useCompetitor>);
}

function setListingsMock(state: {
  data?: { items: CompetitorListing[]; nextCursor: string | null; window: string; disclaimer: string };
  isLoading?: boolean;
  isError?: boolean;
  error?: Error;
}) {
  mockedUseListings.mockReturnValue({
    data: state.data,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useCompetitorListings>);
}

function setScanMock(overrides: { mutate?: ReturnType<typeof vi.fn>; isPending?: boolean } = {}) {
  const mutate = overrides.mutate ?? vi.fn();
  mockedUseTriggerScan.mockReturnValue({
    mutate,
    isPending: overrides.isPending ?? false,
  } as unknown as ReturnType<typeof useTriggerScan>);
  return { mutate };
}

function setBookmarkMock(overrides: { mutate?: ReturnType<typeof vi.fn> } = {}) {
  const mutate = overrides.mutate ?? vi.fn();
  mockedUseBookmark.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useBookmarkListing>);
  return { mutate };
}

function setPromoteMock(overrides: { mutate?: ReturnType<typeof vi.fn> } = {}) {
  const mutate = overrides.mutate ?? vi.fn();
  mockedUsePromote.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof usePromoteListingToReference>);
  return { mutate };
}

const productTypes = [
  { id: "pt-1", displayName: "Wall Art" },
  { id: "pt-2", displayName: "Clipart" },
];

beforeEach(() => {
  vi.clearAllMocks();
  setCompetitorMock({ data: makeCompetitorDetail() });
  setListingsMock({
    data: {
      items: [makeListing()],
      nextCursor: null,
      window: "all",
      disclaimer: "review-count-disclaimer",
    },
  });
  setScanMock();
  setBookmarkMock();
  setPromoteMock();
});

describe("CompetitorDetailPage — header", () => {
  it("PageShell title=shopLabel ve subtitle (platform · etsyShopName) render eder", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    // Title hem topbar'da hem breadcrumb'ın son parçasında — en az 1 occurrence yeterli.
    expect(screen.getAllByText("Alpha Shop").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/ETSY · alphashop/i),
    ).toBeInTheDocument();
  });

  it("shopUrl varsa subtitle içinde 'Mağazayı aç' linki render eder", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const link = screen.getByRole("link", { name: /Mağazayı aç/i });
    expect(link).toHaveAttribute("href", "https://etsy.com/shop/alphashop");
  });

  it("breadcrumb minimal nav 'Rakipler · {shopLabel}' render eder", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const crumbLink = screen.getByRole("link", { name: /Rakipler/i });
    expect(crumbLink).toHaveAttribute("href", "/competitors");
  });

  it("lastScan satırı render eder", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    expect(
      screen.getByText(/Son tarama:/i),
    ).toBeInTheDocument();
  });

  it("'Yeni Tarama' Button click → scan mutation çağrılır", () => {
    const { mutate } = setScanMock();
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Yeni Tarama/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toEqual({ type: "MANUAL_REFRESH" });
  });
});

describe("CompetitorDetailPage — date-range tabs ARIA", () => {
  it("role='tablist' mevcut + 4 tab (30d / 90d / 365d / Tümü)", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const tablist = screen.getByRole("tablist", { name: /Tarih aralığı/i });
    expect(tablist).toBeInTheDocument();
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(4);
  });

  it("her tab aria-controls ve id attribute'larına sahip", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const tabs = screen.getAllByRole("tab");
    for (const tab of tabs) {
      expect(tab).toHaveAttribute("id");
      expect(tab).toHaveAttribute("aria-controls");
    }
  });

  it("tabpanel role='tabpanel' + aria-labelledby aktif tab id'ye eşit + tabIndex=0", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
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

  it("tab click → aria-selected=true geçer ve listings query window param ile re-call edilir", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const tab90 = screen.getByRole("tab", { name: /Son 90 gün/i });
    fireEvent.click(tab90);
    expect(tab90).toHaveAttribute("aria-selected", "true");
    // En son call'da window="90d"
    const lastCall = mockedUseListings.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe("90d");
  });
});

/**
 * T-41: Date-range tabs klavye gez (WAI-ARIA roving tabIndex pattern).
 * - ArrowLeft / ArrowRight: önceki / sonraki tab focus + select (wrap)
 * - Home / End: ilk / son tab focus + select
 * - preventDefault: native scroll/nav sızmaz (test edilmez; davranış odaklı)
 *
 * Mevcut roving tabIndex (T-34) ve aria-controls / role yapısı dokunulmaz.
 * Default window="all" → ilk render'da Tümü tab aktif. Senaryolar setup için
 * uygun tab'a fireEvent.click ile geçer, sonra ok tuşunu fire eder.
 */
describe("CompetitorDetailPage — date-range tabs klavye gez (T-41)", () => {
  it("ArrowRight → sonraki tab aria-selected=true ve focus aktarılır", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const tab30d = screen.getByRole("tab", { name: /Son 30 gün/i });
    fireEvent.click(tab30d);
    fireEvent.keyDown(tab30d, { key: "ArrowRight" });
    const tab90d = screen.getByRole("tab", { name: /Son 90 gün/i });
    expect(tab90d).toHaveAttribute("aria-selected", "true");
    expect(tab90d).toHaveFocus();
  });

  it("ArrowLeft (ilk tab 30d) → son tab Tümü'ye wrap", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const tab30d = screen.getByRole("tab", { name: /Son 30 gün/i });
    fireEvent.click(tab30d);
    fireEvent.keyDown(tab30d, { key: "ArrowLeft" });
    const tabAll = screen.getByRole("tab", { name: /^Tümü$/i });
    expect(tabAll).toHaveAttribute("aria-selected", "true");
    expect(tabAll).toHaveFocus();
  });

  it("ArrowRight (son tab Tümü) → ilk tab 30d'ye wrap", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    // Default window="all" — Tümü tab aktif.
    const tabAll = screen.getByRole("tab", { name: /^Tümü$/i });
    // Focus geçişi için önce click (focus + aria-selected garanti).
    fireEvent.click(tabAll);
    fireEvent.keyDown(tabAll, { key: "ArrowRight" });
    const tab30d = screen.getByRole("tab", { name: /Son 30 gün/i });
    expect(tab30d).toHaveAttribute("aria-selected", "true");
    expect(tab30d).toHaveFocus();
  });

  it("Home → ilk tab 30d, End → son tab Tümü", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const tab90d = screen.getByRole("tab", { name: /Son 90 gün/i });
    fireEvent.click(tab90d);
    fireEvent.keyDown(tab90d, { key: "Home" });
    const tab30d = screen.getByRole("tab", { name: /Son 30 gün/i });
    expect(tab30d).toHaveAttribute("aria-selected", "true");
    expect(tab30d).toHaveFocus();

    fireEvent.keyDown(tab30d, { key: "End" });
    const tabAll = screen.getByRole("tab", { name: /^Tümü$/i });
    expect(tabAll).toHaveAttribute("aria-selected", "true");
    expect(tabAll).toHaveFocus();
  });

  it("ArrowLeft (sondan bir önceki) → bir önceki tab focus", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const tab365d = screen.getByRole("tab", { name: /Son 365 gün/i });
    fireEvent.click(tab365d);
    fireEvent.keyDown(tab365d, { key: "ArrowLeft" });
    const tab90d = screen.getByRole("tab", { name: /Son 90 gün/i });
    expect(tab90d).toHaveAttribute("aria-selected", "true");
    expect(tab90d).toHaveFocus();
  });

  it("ilgisiz tuş (Tab/Enter/Space) keydown handler tarafından yutulmaz — aktif tab değişmez", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    const tab30d = screen.getByRole("tab", { name: /Son 30 gün/i });
    fireEvent.click(tab30d);
    fireEvent.keyDown(tab30d, { key: "Tab" });
    expect(tab30d).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tab30d, { key: "a" });
    expect(tab30d).toHaveAttribute("aria-selected", "true");
  });
});

describe("CompetitorDetailPage — ReviewCountDisclaimer + states", () => {
  it("ReviewCountDisclaimer render eder", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    // Disclaimer role="note" — smoke
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("listings loading → StateMessage tone neutral 'Yükleniyor' render eder", () => {
    setListingsMock({ isLoading: true });
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    expect(screen.getByText(/yükleniyor/i)).toBeInTheDocument();
  });

  it("listings empty → StateMessage 'Bu aralıkta gösterilecek listing yok'", () => {
    setListingsMock({
      data: {
        items: [],
        nextCursor: null,
        window: "all",
        disclaimer: "x",
      },
    });
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    expect(
      screen.getByText(/Bu aralıkta gösterilecek listing yok/i),
    ).toBeInTheDocument();
  });

  it("listings error → StateMessage error tone + error mesajı", () => {
    setListingsMock({
      isError: true,
      error: new Error("Listing alınamadı"),
    });
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    expect(screen.getByText("Listing alınamadı")).toBeInTheDocument();
  });
});

describe("ListingRankCard — primitive consumption", () => {
  it("rank Badge accent tone class'ları içerir", () => {
    const { container } = render(
      <ListingRankCard
        listing={makeListing()}
        rank={1}
        onBookmark={vi.fn()}
        onPromote={vi.fn()}
      />,
    );
    const rankBadge = within(container).getByText("#1");
    expect(rankBadge.className).toMatch(/bg-accent-soft/);
  });

  it("review Badge neutral tone class'ları içerir", () => {
    const { container } = render(
      <ListingRankCard
        listing={makeListing({ reviewCount: 99 })}
        rank={1}
        onBookmark={vi.fn()}
        onPromote={vi.fn()}
      />,
    );
    const reviewBadge = within(container).getByText("99 yorum");
    expect(reviewBadge.className).toMatch(/bg-surface-2/);
  });

  it("Bookmark Ekle butonuna tıklandığında onBookmark listing ile çağrılır", () => {
    const onBookmark = vi.fn();
    const listing = makeListing();
    render(
      <ListingRankCard
        listing={listing}
        rank={1}
        onBookmark={onBookmark}
        onPromote={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Bookmark Ekle/i }));
    expect(onBookmark).toHaveBeenCalledWith(listing);
  });

  it("Referans'a Taşı butonuna tıklandığında onPromote listing ile çağrılır", () => {
    const onPromote = vi.fn();
    const listing = makeListing();
    render(
      <ListingRankCard
        listing={listing}
        rank={1}
        onBookmark={vi.fn()}
        onPromote={onPromote}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Referans'a Taşı/i }));
    expect(onPromote).toHaveBeenCalledWith(listing);
  });

  it("Kaynağı Aç anchor href = listing.sourceUrl", () => {
    render(
      <ListingRankCard
        listing={makeListing({ sourceUrl: "https://etsy.com/listing/42" })}
        rank={1}
        onBookmark={vi.fn()}
        onPromote={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: /Kaynağı Aç/i });
    expect(link).toHaveAttribute("href", "https://etsy.com/listing/42");
  });
});

describe("CompetitorDetailPage — actions", () => {
  it("ListingRankCard içinde 'Bookmark Ekle' click → bookmark.mutate çağrılır", () => {
    const { mutate } = setBookmarkMock();
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Bookmark Ekle/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it("ListingRankCard içinde 'Referans'a Taşı' click → PromoteToReferenceDialog açılır", () => {
    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Referans'a Taşı/i }));
    expect(screen.getByTestId("promote-dialog")).toBeInTheDocument();
  });
});

/**
 * I-2 fix: Promote retry idempotency.
 *
 * `handlePromote` artık `pendingPromoteBookmarkId` state'i tutar.
 * - bookmark.mutate başarılı → setPendingPromoteBookmarkId(bookmarkId)
 * - promote.mutate fail → state korunur, kullanıcı tekrar submit ederse
 *   bookmark.mutate ÇAĞRILMAZ; doğrudan promote.mutate çağrılır.
 * - promote.mutate fail toast: "Bookmark eklendi ancak referans atanamadı: …"
 * - dialog onClose veya promote.mutate success → state temizlenir.
 */
describe("CompetitorDetailPage — promote retry idempotency (I-2)", () => {
  it("Promote: bookmark başarılı + promote fail → ikinci submit'te bookmark.mutate çağrılmaz, promote.mutate doğrudan çağrılır", () => {
    const bookmarkMutate = vi.fn(
      (
        _vars: unknown,
        opts: { onSuccess: (data: { bookmarkId: string }) => void },
      ) => {
        opts.onSuccess({ bookmarkId: "bm-42" });
      },
    );
    const promoteMutate = vi.fn(
      (
        _vars: unknown,
        opts: {
          onError: (err: Error) => void;
          onSettled: () => void;
        },
      ) => {
        opts.onError(new Error("network down"));
        opts.onSettled();
      },
    );
    setBookmarkMock({ mutate: bookmarkMutate });
    setPromoteMock({ mutate: promoteMutate });

    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );

    // Dialog'u aç.
    fireEvent.click(screen.getByRole("button", { name: /Referans'a Taşı/i }));
    // İlk submit: bookmark + promote(fail)
    fireEvent.click(screen.getByRole("button", { name: /promote-submit/ }));
    expect(bookmarkMutate).toHaveBeenCalledTimes(1);
    expect(promoteMutate).toHaveBeenCalledTimes(1);
    expect(promoteMutate.mock.calls[0]?.[0]).toMatchObject({
      bookmarkId: "bm-42",
      productTypeId: "pt-1",
    });

    // İkinci submit: pendingPromoteBookmarkId set, bookmark TEKRAR ÇAĞRILMAZ.
    fireEvent.click(screen.getByRole("button", { name: /promote-submit/ }));
    expect(bookmarkMutate).toHaveBeenCalledTimes(1);
    expect(promoteMutate).toHaveBeenCalledTimes(2);
    expect(promoteMutate.mock.calls[1]?.[0]).toMatchObject({
      bookmarkId: "bm-42",
      productTypeId: "pt-1",
    });
  });

  it("Promote fail → toast mesajı 'Bookmark eklendi ancak referans atanamadı:' içerir", () => {
    const bookmarkMutate = vi.fn(
      (
        _vars: unknown,
        opts: { onSuccess: (data: { bookmarkId: string }) => void },
      ) => {
        opts.onSuccess({ bookmarkId: "bm-42" });
      },
    );
    const promoteMutate = vi.fn(
      (
        _vars: unknown,
        opts: {
          onError: (err: Error) => void;
          onSettled: () => void;
        },
      ) => {
        opts.onError(new Error("validation: productType invalid"));
        opts.onSettled();
      },
    );
    setBookmarkMock({ mutate: bookmarkMutate });
    setPromoteMock({ mutate: promoteMutate });

    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Referans'a Taşı/i }));
    fireEvent.click(screen.getByRole("button", { name: /promote-submit/ }));

    // T-38: error tone Toast primitive role="alert" verir (aria-live=assertive).
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(
      /Bookmark eklendi ancak referans atanamadı: validation: productType invalid/,
    );
  });

  it("Dialog onClose → pendingPromoteBookmarkId temizlenir (yeni promote bookmark.mutate'i tekrar çağırır)", () => {
    const bookmarkMutate = vi.fn(
      (
        _vars: unknown,
        opts: { onSuccess: (data: { bookmarkId: string }) => void },
      ) => {
        opts.onSuccess({ bookmarkId: "bm-42" });
      },
    );
    const promoteMutate = vi.fn(
      (
        _vars: unknown,
        opts: {
          onError: (err: Error) => void;
          onSettled: () => void;
        },
      ) => {
        opts.onError(new Error("temporary"));
        opts.onSettled();
      },
    );
    setBookmarkMock({ mutate: bookmarkMutate });
    setPromoteMock({ mutate: promoteMutate });

    wrapper(
      <CompetitorDetailPage competitorId="c-1" productTypes={productTypes} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Referans'a Taşı/i }));
    fireEvent.click(screen.getByRole("button", { name: /promote-submit/ }));
    expect(bookmarkMutate).toHaveBeenCalledTimes(1);

    // Dialog'u kapat → state temizlenir.
    fireEvent.click(screen.getByRole("button", { name: /promote-close/ }));

    // Tekrar dialog aç + submit → bookmark.mutate yeniden çağrılır.
    fireEvent.click(screen.getByRole("button", { name: /Referans'a Taşı/i }));
    fireEvent.click(screen.getByRole("button", { name: /promote-submit/ }));
    expect(bookmarkMutate).toHaveBeenCalledTimes(2);
  });
});
