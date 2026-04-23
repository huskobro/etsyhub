"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useCompetitor,
  useCompetitorListings,
  type CompetitorListing,
} from "../queries/use-competitor";
import { useTriggerScan } from "../mutations/use-trigger-scan";
import { useBookmarkListing } from "../mutations/use-bookmark-listing";
import { usePromoteListingToReference } from "../mutations/use-promote-listing-to-reference";
import type { ReviewWindow } from "../schemas";
import { ListingRankCard } from "./listing-rank-card";
import { ReviewCountDisclaimer } from "./review-count-disclaimer";
import { PromoteToReferenceDialog } from "./promote-to-reference-dialog";

type ProductTypeOption = { id: string; displayName: string };

const WINDOW_OPTIONS: { value: ReviewWindow; label: string }[] = [
  { value: "30d", label: "Son 30 gün" },
  { value: "90d", label: "Son 90 gün" },
  { value: "365d", label: "Son 365 gün" },
  { value: "all", label: "Tümü" },
];

type ToastState = { kind: "success" | "error"; message: string } | null;

export function CompetitorDetailPage({
  competitorId,
  productTypes,
}: {
  competitorId: string;
  productTypes: ProductTypeOption[];
}) {
  const [window, setWindow] = useState<ReviewWindow>("all");
  const [toast, setToast] = useState<ToastState>(null);
  const [bookmarkingId, setBookmarkingId] = useState<string | null>(null);
  const [promoteListing, setPromoteListing] =
    useState<CompetitorListing | null>(null);

  const detail = useCompetitor(competitorId);
  const listings = useCompetitorListings(competitorId, window);
  const scan = useTriggerScan(competitorId);
  const bookmark = useBookmarkListing();
  const promote = usePromoteListingToReference();

  const competitor = detail.data?.competitor;
  const lastScan = detail.data?.lastScan;

  function handleScan() {
    scan.mutate(
      { type: "MANUAL_REFRESH" },
      {
        onSuccess: () =>
          setToast({ kind: "success", message: "Yeni tarama kuyruğa alındı." }),
        onError: (err) => setToast({ kind: "error", message: err.message }),
      },
    );
  }

  function handleBookmark(listing: CompetitorListing) {
    setBookmarkingId(listing.id);
    bookmark.mutate(
      {
        sourceUrl: listing.sourceUrl,
        title: listing.title,
        thumbnailUrl: listing.thumbnailUrl,
      },
      {
        onSuccess: () =>
          setToast({
            kind: "success",
            message: "Bookmark eklendi ve Bookmark Inbox'a düştü.",
          }),
        onError: (err) => setToast({ kind: "error", message: err.message }),
        onSettled: () => setBookmarkingId(null),
      },
    );
  }

  function handlePromote(productTypeId: string) {
    const target = promoteListing;
    if (!target) return;
    setBookmarkingId(target.id);
    // Önce bookmark + asset oluştur; ardından productType ile promote et.
    bookmark.mutate(
      {
        sourceUrl: target.sourceUrl,
        title: target.title,
        thumbnailUrl: target.thumbnailUrl,
      },
      {
        onSuccess: ({ bookmarkId }) => {
          promote.mutate(
            { bookmarkId, productTypeId },
            {
              onSuccess: () => {
                setPromoteListing(null);
                setToast({
                  kind: "success",
                  message: "Referans oluşturuldu.",
                });
              },
              onError: (err) =>
                setToast({ kind: "error", message: err.message }),
              onSettled: () => setBookmarkingId(null),
            },
          );
        },
        onError: (err) => {
          setToast({ kind: "error", message: err.message });
          setBookmarkingId(null);
        },
      },
    );
  }

  if (detail.isLoading) {
    return (
      <p className="text-sm text-text-muted" role="status">
        Rakip yükleniyor…
      </p>
    );
  }
  if (detail.isError) {
    return (
      <p className="text-sm text-danger" role="alert">
        {(detail.error as Error).message}
      </p>
    );
  }
  if (!competitor) {
    return (
      <p className="text-sm text-text-muted">Rakip bulunamadı.</p>
    );
  }

  const items = listings.data?.items ?? [];
  const shopLabel = competitor.displayName ?? competitor.etsyShopName;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <nav className="text-xs text-text-muted">
            <Link
              href="/competitors"
              className="hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Rakipler
            </Link>
            <span> · </span>
            <span>{shopLabel}</span>
          </nav>
          <h1 className="text-2xl font-semibold text-text">{shopLabel}</h1>
          <p className="text-sm text-text-muted">
            {competitor.platform} · {competitor.etsyShopName}
            {competitor.shopUrl ? (
              <>
                {" · "}
                <a
                  href={competitor.shopUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Mağazayı aç
                </a>
              </>
            ) : null}
          </p>
          {lastScan ? (
            <p className="text-xs text-text-muted">
              Son tarama: {lastScan.status} ·{" "}
              {new Date(lastScan.createdAt).toLocaleString("tr-TR")} ·{" "}
              {lastScan.listingsFound} bulundu, {lastScan.listingsNew} yeni
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleScan}
          disabled={scan.isPending}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          {scan.isPending ? "Başlatılıyor…" : "Yeni Tarama"}
        </button>
      </div>

      <div
        role="tablist"
        aria-label="Tarih aralığı"
        className="flex flex-wrap gap-2"
      >
        {WINDOW_OPTIONS.map((opt) => {
          const active = opt.value === window;
          return (
            <button
              key={opt.value}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setWindow(opt.value)}
              className={
                active
                  ? "rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  : "rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <ReviewCountDisclaimer />

      {toast ? (
        <div
          role="status"
          className={
            toast.kind === "success"
              ? "rounded-md border border-border bg-success/10 px-3 py-2 text-xs text-success"
              : "rounded-md border border-border bg-danger/10 px-3 py-2 text-xs text-danger"
          }
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Kapat
          </button>
        </div>
      ) : null}

      {listings.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-md border border-border bg-surface-muted"
              aria-hidden
            />
          ))}
        </div>
      ) : listings.isError ? (
        <p className="text-sm text-danger" role="alert">
          {(listings.error as Error).message}
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Bu aralıkta gösterilecek listing yok. &quot;Yeni Tarama&quot; ile
          veriyi yenilemeyi deneyebilirsin.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((listing, index) => (
            <ListingRankCard
              key={listing.id}
              listing={listing}
              rank={index + 1}
              bookmarking={bookmarkingId === listing.id}
              onBookmark={handleBookmark}
              onPromote={(l) => setPromoteListing(l)}
            />
          ))}
        </div>
      )}

      {promoteListing ? (
        <PromoteToReferenceDialog
          listing={promoteListing}
          productTypes={productTypes}
          isPending={bookmarkingId === promoteListing.id}
          onClose={() => setPromoteListing(null)}
          onSubmit={handlePromote}
        />
      ) : null}
    </div>
  );
}
