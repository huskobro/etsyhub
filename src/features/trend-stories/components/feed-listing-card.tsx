"use client";

import type { FeedListing } from "../queries/use-feed";
import { TrendMembershipBadge } from "./trend-membership-badge";

type Props = {
  listing: FeedListing;
  bookmarking: boolean;
  onBookmark: (listing: FeedListing) => void;
  onOpenCluster: (clusterId: string) => void;
};

/**
 * Feed akışındaki tek listing kartı. `trendMembershipHint` varsa badge ile
 * gösterilir ve "Bookmark'a ekle" tıklamasında `trendClusterId` otomatik
 * doldurulur.
 */
export function FeedListingCard({
  listing,
  bookmarking,
  onBookmark,
  onOpenCluster,
}: Props) {
  const dateLabel = new Date(listing.firstSeenAt).toLocaleDateString("tr-TR");

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card">
      {listing.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={listing.thumbnailUrl}
          alt={listing.title}
          loading="lazy"
          className="aspect-square w-full rounded-md bg-surface-muted object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-surface-muted text-xs text-text-muted">
          Görsel yok
        </div>
      )}

      <h3
        className="line-clamp-2 text-sm font-medium text-text"
        title={listing.title}
      >
        {listing.title}
      </h3>

      <p className="truncate text-xs text-text-muted">
        {listing.competitorStoreName} · {listing.reviewCount} yorum · {dateLabel}
      </p>

      {listing.trendMembershipHint ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <TrendMembershipBadge
            label={listing.trendMembershipHint.label}
            clusterId={listing.trendMembershipHint.clusterId}
            onOpenCluster={onOpenCluster}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Kaynağı Aç
        </a>
        <button
          type="button"
          onClick={() => onBookmark(listing)}
          disabled={bookmarking}
          className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          {bookmarking ? "Ekleniyor…" : "Bookmark'a ekle"}
        </button>
      </div>
    </article>
  );
}
