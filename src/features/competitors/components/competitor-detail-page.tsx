"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
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
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui/Button";
import { StateMessage } from "@/components/ui/StateMessage";

/**
 * CompetitorDetailPage — T-34 primitive migrasyonu.
 *
 * Sözleşme: docs/design/implementation-notes/competitors-screens.md
 * - PageShell (variant default) tüketildi: title=shopLabel + subtitle (platform·etsyShopName
 *   · Mağazayı aç) + actions=`Yeni Tarama` Button.
 * - Breadcrumb minimal `<nav>` PageShell içeriğinin başında manuel kalır
 *   (PageShell'de breadcrumb slot YOK; "çok minimal kalsın" kullanıcı talimatı).
 * - Date-range tabs gerçek client tab — `role="tablist"` + her tab `aria-controls`
 *   + `id`. Tek aktif `role="tabpanel"` + `aria-labelledby={activeTabId}`.
 *   Klavye Arrow gez Phase 2 carry-forward.
 * - StateMessage loading / empty / error.
 * - ListingRankCard primitive consume (Card + Badge + Button).
 * - ReviewCountDisclaimer + PromoteToReferenceDialog dokunulmadı.
 *
 * GEÇİCİ: Toast primitive 3+ ekran tüketimi olunca terfi edilir. Mevcut inline
 * role="status" div KORUNUR (T-33 paterni).
 * carry-forward: docs/design/implementation-notes/competitors-screens.md
 */

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

  // Tab/panel id'leri: aria-controls ↔ aria-labelledby bağı için stabil.
  const tabIdBase = useId();
  const tabIds = useMemo(() => {
    const map: Record<ReviewWindow, { tabId: string; panelId: string }> = {
      "30d": { tabId: `${tabIdBase}-tab-30d`, panelId: `${tabIdBase}-panel-30d` },
      "90d": { tabId: `${tabIdBase}-tab-90d`, panelId: `${tabIdBase}-panel-90d` },
      "365d": {
        tabId: `${tabIdBase}-tab-365d`,
        panelId: `${tabIdBase}-panel-365d`,
      },
      all: { tabId: `${tabIdBase}-tab-all`, panelId: `${tabIdBase}-panel-all` },
    };
    return map;
  }, [tabIdBase]);

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

  // Detail loading/error/empty erken çıkışları — header'sız sade mesaj kalır.
  if (detail.isLoading) {
    return <StateMessage tone="neutral" title="Rakip yükleniyor…" />;
  }
  if (detail.isError) {
    return (
      <StateMessage
        tone="error"
        title="Rakip yüklenemedi"
        body={(detail.error as Error).message}
      />
    );
  }
  if (!competitor) {
    return <StateMessage tone="neutral" title="Rakip bulunamadı" />;
  }

  const items = listings.data?.items ?? [];
  const shopLabel = competitor.displayName ?? competitor.etsyShopName;
  const activeTab = tabIds[window];

  const subtitle = (
    <span>
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
    </span>
  );

  return (
    <PageShell
      title={shopLabel}
      subtitle={subtitle}
      actions={
        <Button
          variant="primary"
          onClick={handleScan}
          disabled={scan.isPending}
          loading={scan.isPending}
        >
          {scan.isPending ? "Başlatılıyor…" : "Yeni Tarama"}
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Breadcrumb minimal — PageShell breadcrumb slot YOK; kullanıcı
            talimatı gereği "çok minimal" tek satır nav. */}
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

        {lastScan ? (
          <p className="text-xs text-text-muted">
            Son tarama: {lastScan.status} ·{" "}
            {new Date(lastScan.createdAt).toLocaleString("tr-TR")} ·{" "}
            {lastScan.listingsFound} bulundu, {lastScan.listingsNew} yeni
          </p>
        ) : null}

        <div
          role="tablist"
          aria-label="Tarih aralığı"
          className="flex flex-wrap gap-2"
        >
          {WINDOW_OPTIONS.map((opt) => {
            const active = opt.value === window;
            const ids = tabIds[opt.value];
            return (
              <button
                key={opt.value}
                role="tab"
                type="button"
                id={ids.tabId}
                aria-selected={active}
                aria-controls={ids.panelId}
                tabIndex={active ? 0 : -1}
                onClick={() => setWindow(opt.value)}
                className={
                  active
                    ? "rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    : "rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-text hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <ReviewCountDisclaimer />

        {/* GEÇİCİ: Toast primitive 3+ ekran tüketimi olunca terfi edilir.
            CP-8 wave kuralı: yeni primitive YASAK. carry-forward:
            docs/design/implementation-notes/competitors-screens.md */}
        {toast ? (
          <div
            role="status"
            className={
              toast.kind === "success"
                ? "rounded-md border border-border bg-success-soft px-3 py-2 text-xs text-success"
                : "rounded-md border border-border bg-danger-soft px-3 py-2 text-xs text-danger"
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

        <div
          role="tabpanel"
          id={activeTab.panelId}
          aria-labelledby={activeTab.tabId}
          tabIndex={0}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
        >
          {listings.isLoading ? (
            <StateMessage tone="neutral" title="Yükleniyor…" />
          ) : listings.isError ? (
            <StateMessage
              tone="error"
              title="Listing akışı yüklenemedi"
              body={(listings.error as Error).message}
            />
          ) : items.length === 0 ? (
            <StateMessage
              tone="neutral"
              title="Bu aralıkta gösterilecek listing yok"
              body={
                'Veriyi yenilemek için yukarıdaki "Yeni Tarama" düğmesini kullan.'
              }
            />
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
        </div>

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
    </PageShell>
  );
}
