"use client";

import { useState } from "react";
import type { WindowDays } from "@/features/trend-stories/constants";
import { useFeed, type FeedListing } from "../queries/use-feed";
import { useCreateTrendBookmark } from "../mutations/use-create-trend-bookmark";
import { FeedListingCard } from "./feed-listing-card";

type Props = {
  windowDays: WindowDays;
  onOpenCluster: (clusterId: string) => void;
  onToast: (toast: { kind: "success" | "error"; message: string }) => void;
};

/**
 * Feed grid — pencere + cursor bazlı sayfalama.
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
            message: "Bookmark eklendi ve Bookmark Inbox'a düştü.",
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
    return (
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        role="status"
        aria-label="Feed yükleniyor"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-md border border-border bg-surface-muted"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="text-sm text-danger" role="alert">
        {(query.error as Error).message}
      </p>
    );
  }

  if (!query.data) return null;

  const data = query.data;
  const isFirstPageEmpty = cursor === null && data.items.length === 0;
  if (isFirstPageEmpty) {
    return (
      <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-muted">
        Bu pencerede listing yok.
      </div>
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
          <button
            type="button"
            onClick={() => onLoadMore(nextCursor)}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Daha fazla yükle
          </button>
        </div>
      ) : null}
    </div>
  );
}
