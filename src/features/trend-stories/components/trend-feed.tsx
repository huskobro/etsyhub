"use client";

import { useState } from "react";
import Link from "next/link";
import type { WindowDays } from "@/features/trend-stories/constants";
import { useFeed, type FeedListing } from "../queries/use-feed";
import { useCreateTrendBookmark } from "../mutations/use-create-trend-bookmark";
import { FeedListingCard } from "./feed-listing-card";
import { StateMessage } from "@/components/ui/StateMessage";
import { Button } from "@/components/ui/Button";

type Props = {
  windowDays: WindowDays;
  onOpenCluster: (clusterId: string) => void;
  onToast: (toast: { kind: "success" | "error"; message: string }) => void;
};

/**
 * Feed grid — pencere + cursor bazlı sayfalama.
 *
 * T-36 spec — docs/design/implementation-notes/trend-stories-screens.md
 * - Loading / empty / error → StateMessage primitive.
 * - "Daha fazla yükle" → Button variant="ghost".
 * - Manuel skeleton grid kaldırıldı; section başlığı (`<h2>Feed</h2>`) korunur.
 *
 * Her kart "Bookmark'a ekle" butonu içerir; `trendMembershipHint` varsa
 * cluster id otomatik bookmark isteğine enjekte edilir.
 */
export function TrendFeed({ windowDays, onOpenCluster, onToast }: Props) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null);

  const bookmark = useCreateTrendBookmark();

  function handleBookmark(listing: FeedListing) {
    setBookmarkingId(listing.listingId);
    bookmark.mutate(
      {
        sourceUrl: listing.sourceUrl,
        title: listing.title,
        trendClusterId:
          listing.trendMembershipHint?.clusterId ?? null,
      },
      {
        onSuccess: () =>
          onToast({
            kind: "success",
            message: "Bookmark added to Bookmark Inbox.",
          }),
        onError: (err) => onToast({ kind: "error", message: err.message }),
        onSettled: () => setBookmarkingId(null),
      },
    );
  }

  // Pencere değişirse cursor zincirini sıfırlamak istediğimiz için key
  // TrendStoriesPage'de reset'leniyor; buradaki state o yüzden her mount'ta
  // yeniden başlar.

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-text">Feed</h2>
      </div>

      <div className="flex flex-col gap-4">
        {cursors.map((cursor, idx) => (
          <FeedPage
            key={`${windowDays}-${idx}`}
            windowDays={windowDays}
            cursor={cursor}
            bookmarkingId={bookmarkingId}
            onBookmark={handleBookmark}
            onOpenCluster={onOpenCluster}
            isLastPage={idx === cursors.length - 1}
            onLoadMore={(next) => setCursors((prev) => [...prev, next])}
          />
        ))}
      </div>
    </section>
  );
}

function FeedPage({
  windowDays,
  cursor,
  bookmarkingId,
  onBookmark,
  onOpenCluster,
  isLastPage,
  onLoadMore,
}: {
  windowDays: WindowDays;
  cursor: string | null;
  bookmarkingId: string | null;
  onBookmark: (listing: FeedListing) => void;
  onOpenCluster: (clusterId: string) => void;
  isLastPage: boolean;
  onLoadMore: (cursor: string) => void;
}) {
  const query = useFeed(windowDays, cursor);

  if (query.isLoading) {
    return <StateMessage tone="neutral" title="Loading…" />;
  }

  if (query.isError) {
    return (
      <StateMessage
        tone="error"
        title="Failed to load feed"
        body={(query.error as Error).message}
      />
    );
  }

  if (!query.data) return null;

  const data = query.data;
  const isFirstPageEmpty = cursor === null && data.items.length === 0;
  if (isFirstPageEmpty) {
    return (
      // Pass 34 — Empty state'e yönlendirme. Pre-Pass 34: sadece "farklı
      // aralık dene" — listing fetch çoğunlukla rakip taranınca üretildiği
      // için kullanıcı henüz rakip yoksa boşluğun sebebini bilmiyordu.
      <StateMessage
        tone="neutral"
        title="No listings in this window"
        body="Change the window range, or add a competitor shop and start scanning."
        action={
          <Link
            href="/competitors"
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            data-testid="trend-feed-empty-cta"
          >
            Open Shops
          </Link>
        }
      />
    );
  }

  const nextCursor = data.nextCursor;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.items.map((listing) => (
          <FeedListingCard
            key={listing.listingId}
            listing={listing}
            bookmarking={bookmarkingId === listing.listingId}
            onBookmark={onBookmark}
            onOpenCluster={onOpenCluster}
          />
        ))}
      </div>

      {isLastPage && nextCursor ? (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onLoadMore(nextCursor)}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
