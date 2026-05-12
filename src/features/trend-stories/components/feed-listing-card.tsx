"use client";

import type { FeedListing } from "../queries/use-feed";
import { TrendMembershipBadge } from "./trend-membership-badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Props = {
  listing: FeedListing;
  bookmarking: boolean;
  onBookmark: (listing: FeedListing) => void;
  onOpenCluster: (clusterId: string) => void;
};

/**
 * Feed akışındaki tek listing kartı.
 *
 * T-36 spec — docs/design/implementation-notes/trend-stories-screens.md
 * - Manuel `<article>` Card primitive (`as="article"`) ile değiştirildi.
 * - Bookmark butonu Button variant="primary" size="sm".
 * - Kaynağı Aç anchor styled KORUNUR (T-33 paterni).
 * - TrendMembershipBadge dokunulmadı — Badge primitive `onClick` slot'u
 *   yok, yerel pill korunur (carry-forward).
 *
 * `trendMembershipHint` varsa badge ile gösterilir ve "Bookmark'a ekle"
 * tıklamasında `trendClusterId` otomatik doldurulur.
 */
export function FeedListingCard({
  listing,
  bookmarking,
  onBookmark,
  onOpenCluster,
}: Props) {
  const dateLabel = new Date(listing.firstSeenAt).toLocaleDateString("tr-TR");

  return (
    <Card as="article" className="flex flex-col gap-3 p-4">
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
          No image
        </div>
      )}

      <h3
        className="line-clamp-2 text-sm font-medium text-text"
        title={listing.title}
      >
        {listing.title}
      </h3>

      <p className="truncate text-xs text-text-muted">
        {listing.competitorStoreName} · {listing.reviewCount} reviews · {dateLabel}
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
          Open source
        </a>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onBookmark(listing)}
          disabled={bookmarking}
          loading={bookmarking}
        >
          {bookmarking ? "Ekleniyor…" : "Bookmark'a ekle"}
        </Button>
      </div>
    </Card>
  );
}
