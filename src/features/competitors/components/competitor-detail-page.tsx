"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
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
import { Toast } from "@/components/ui/Toast";

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
 *   T-41: WAI-ARIA tablist klavye gez — ArrowLeft/Right wrap, Home/End uç tab.
 *   Roving tabIndex (T-34) korunur; aktif tab tabIndex=0, diğerleri -1.
 *   WindowTabs (trend-stories) bu turda kapsam dışı; 3+ ekran tüketim sinyali
 *   oluşursa hook terfisi gündemine alınır (Toggle kuralı).
 * - StateMessage loading / empty / error.
 * - ListingRankCard primitive consume (Card + Badge + Button).
 * - ReviewCountDisclaimer + PromoteToReferenceDialog dokunulmadı.
 *
 * T-38: Toast primitive terfisi tamamlandı — manuel role="status" div yerine
 * `<Toast tone={...} />` tüketilir. kind→tone mapping: success→success,
 * error→error. Toast state mantığı (T-34 + I-2 retry idempotency) dokunulmaz;
 * yalnızca render katmanı primitive'e taşındı.
 */

type ProductTypeOption = { id: string; displayName: string };

const WINDOW_OPTIONS: { value: ReviewWindow; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 365 days" },
  { value: "all", label: "All time" },
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
  // I-2 fix: ilk başarılı bookmark + ikinci fail promote durumunda
  // bookmark'ın tekrar oluşturulmasını engellemek için pending bookmarkId tutulur.
  // Promote başarılı veya dialog kapatıldığında temizlenir.
  const [pendingPromoteBookmarkId, setPendingPromoteBookmarkId] = useState<
    string | null
  >(null);

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

  // T-41: tab DOM ref'leri — klavye gez sonrası focus aktarımı için.
  const tabRefs = useRef<Record<ReviewWindow, HTMLButtonElement | null>>({
    "30d": null,
    "90d": null,
    "365d": null,
    all: null,
  });

  // T-41: WAI-ARIA tablist klavye davranışı.
  // - ArrowLeft / ArrowRight: önceki / sonraki tab (wrap)
  // - Home / End: ilk / son tab
  // - preventDefault: native scroll/nav sızmasın.
  // Focus + select beraber: setWindow state'i tetiklenir, ardından ref üzerinden
  // doğrudan focus aktarılır (button DOM'da kalmaya devam ettiği için referans
  // hala geçerlidir).
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const order: ReviewWindow[] = WINDOW_OPTIONS.map((o) => o.value);
    const currentIndex = order.indexOf(window);
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % order.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + order.length) % order.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = order.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextWindow = order[nextIndex]!;
    setWindow(nextWindow);
    tabRefs.current[nextWindow]?.focus();
  }

  const competitor = detail.data?.competitor;
  const lastScan = detail.data?.lastScan;

  function handleScan() {
    scan.mutate(
      { type: "MANUAL_REFRESH" },
      {
        onSuccess: () =>
          setToast({ kind: "success", message: "New scan queued." }),
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
            message: "Bookmark added to Bookmark Inbox.",
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

    // I-2 fix: Bookmark başarılı + promote fail olduğunda ikinci submit'te
    // bookmark.mutate baştan çağrılırsa backend "duplicate bookmark" hatası
    // verebilir. pendingPromoteBookmarkId set ise doğrudan promote.mutate
    // çağırılır (retry idempotency).
    if (pendingPromoteBookmarkId) {
      promote.mutate(
        { bookmarkId: pendingPromoteBookmarkId, productTypeId },
        {
          onSuccess: () => {
            setPendingPromoteBookmarkId(null);
            setPromoteListing(null);
            setToast({
              kind: "success",
              message: "Reference created.",
            });
          },
          onError: (err) =>
            setToast({
              kind: "error",
              message: `Bookmark eklendi ancak referans atanamadı: ${err.message}`,
            }),
          onSettled: () => setBookmarkingId(null),
        },
      );
      return;
    }

    // Önce bookmark + asset oluştur; ardından productType ile promote et.
    bookmark.mutate(
      {
        sourceUrl: target.sourceUrl,
        title: target.title,
        thumbnailUrl: target.thumbnailUrl,
      },
      {
        onSuccess: ({ bookmarkId }) => {
          // Bookmark oluşturuldu — promote fail olursa retry için sakla.
          setPendingPromoteBookmarkId(bookmarkId);
          promote.mutate(
            { bookmarkId, productTypeId },
            {
              onSuccess: () => {
                setPendingPromoteBookmarkId(null);
                setPromoteListing(null);
                setToast({
                  kind: "success",
                  message: "Reference created.",
                });
              },
              onError: (err) =>
                setToast({
                  kind: "error",
                  message: `Bookmark eklendi ancak referans atanamadı: ${err.message}`,
                }),
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
    return <StateMessage tone="neutral" title="Loading competitor…" />;
  }
  if (detail.isError) {
    return (
      <StateMessage
        tone="error"
        title="Failed to load competitor"
        body={(detail.error as Error).message}
      />
    );
  }
  if (!competitor) {
    return <StateMessage tone="neutral" title="Competitor not found" />;
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
            Open shop
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
          {scan.isPending ? "Starting…" : "New Scan"}
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
            Shops
          </Link>
          <span> · </span>
          <span>{shopLabel}</span>
        </nav>

        {lastScan ? (
          <p className="text-xs text-text-muted">
            Last scan: {lastScan.status} ·{" "}
            {new Date(lastScan.createdAt).toLocaleString("en-US")} ·{" "}
            {lastScan.listingsFound} found, {lastScan.listingsNew} new
          </p>
        ) : null}

        <div
          role="tablist"
          aria-label="Date range"
          className="flex flex-wrap gap-2"
        >
          {WINDOW_OPTIONS.map((opt) => {
            const active = opt.value === window;
            const ids = tabIds[opt.value];
            return (
              <button
                key={opt.value}
                ref={(el) => {
                  tabRefs.current[opt.value] = el;
                }}
                role="tab"
                type="button"
                id={ids.tabId}
                aria-selected={active}
                aria-controls={ids.panelId}
                tabIndex={active ? 0 : -1}
                onClick={() => setWindow(opt.value)}
                onKeyDown={handleTabKeyDown}
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

        {/* T-38: Toast primitive tüketildi. Kapat trigger'ı primitive scope
            dışındadır; primitive yalnızca tone + message + aria-live taşır. */}
        {toast ? (
          <div className="flex items-start gap-2">
            <Toast
              tone={toast.kind === "success" ? "success" : "error"}
              message={toast.message}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Close
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
            <StateMessage tone="neutral" title="Loading…" />
          ) : listings.isError ? (
            <StateMessage
              tone="error"
              title="Couldn't load listing feed"
              body={(listings.error as Error).message}
            />
          ) : items.length === 0 ? (
            <StateMessage
              tone="neutral"
              title="No listings in this range"
              body={
                'Use "New Scan" above to refresh the data.'
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
            onClose={() => {
              setPromoteListing(null);
              setPendingPromoteBookmarkId(null);
            }}
            onSubmit={handlePromote}
          />
        ) : null}
      </div>
    </PageShell>
  );
}
