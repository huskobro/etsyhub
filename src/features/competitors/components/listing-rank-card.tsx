"use client";

import type { CompetitorListing } from "../queries/use-competitor";

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
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card">
      <header className="flex items-start justify-between gap-2">
        <span className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
          #{rank}
        </span>
        <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
          {listing.reviewCount} yorum
        </span>
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
          Görsel yok
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
          <span>{listing.favoritesCount} favori</span>
        ) : null}
      </div>

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
          onClick={() => onPromote(listing)}
          disabled={bookmarking}
          className="rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          Referans&apos;a Taşı
        </button>
        <button
          type="button"
          onClick={() => onBookmark(listing)}
          disabled={bookmarking}
          className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          {bookmarking ? "Ekleniyor…" : "Bookmark Ekle"}
        </button>
      </div>
    </article>
  );
}
