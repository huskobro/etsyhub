"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CompetitorListing } from "../queries/use-competitor";

/**
 * ListingRankCard — T-34 primitive consumption.
 *
 * Sözleşme: docs/design/implementation-notes/competitors-screens.md
 * - Card primitive (`as="article"`) sarması; manuel <article> yok.
 * - Rank pill → Badge tone="accent". Review count pill → Badge tone="neutral".
 * - Footer: Kaynağı Aç anchor styled (Button asChild yok; T-33 Detay link
 *   paterni ile minimal anchor) / Referans'a Taşı `Button variant="ghost"
 *   size="sm"` / Bookmark Ekle `Button variant="primary" size="sm"`.
 * - Thumb/AssetImage primitive scope dışı; mevcut <img>/placeholder div
 *   token-bound (bg-surface-muted) korunur.
 */
type Props = {
  listing: CompetitorListing;
  rank: number;
  onBookmark: (listing: CompetitorListing) => void;
  onPromote: (listing: CompetitorListing) => void;
  bookmarking?: boolean;
};

function formatPrice(priceCents: number | null, currency: string | null) {
  if (priceCents == null) return "-";
  const amount = priceCents / 100;
  const code = currency ?? "USD";
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

export function ListingRankCard({
  listing,
  rank,
  onBookmark,
  onPromote,
  bookmarking,
}: Props) {
  const priceLabel = formatPrice(listing.priceCents, listing.currency);

  return (
    <Card as="article" className="flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-2">
        <Badge tone="accent">#{rank}</Badge>
        <Badge tone="neutral">{listing.reviewCount} yorum</Badge>
      </header>

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

      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{priceLabel}</span>
        {listing.favoritesCount != null ? (
          <span>{listing.favoritesCount} favorite{listing.favoritesCount === 1 ? "" : "s"}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-control-sm items-center rounded-md border border-border px-2.5 text-sm text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Open source
        </a>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPromote(listing)}
          disabled={bookmarking}
        >
          Move to reference
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => onBookmark(listing)}
          disabled={bookmarking}
        >
          {bookmarking ? "Ekleniyor…" : "Bookmark Ekle"}
        </Button>
      </div>
    </Card>
  );
}
