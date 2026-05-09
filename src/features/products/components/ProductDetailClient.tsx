"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  Eye,
  Loader2,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { useListingDraft } from "@/features/listings/hooks/useListingDraft";
import {
  deriveProductStage,
  productStageBadgeTone,
  listingHealthScore,
} from "@/features/products/state-helpers";
import { ListingTab } from "./tabs/ListingTab";
import { MockupsTab } from "./tabs/MockupsTab";
import { FilesTab } from "./tabs/FilesTab";
import { HistoryTab } from "./tabs/HistoryTab";

/**
 * ProductDetailClient — A5 Product detail orchestrator.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a5.jsx →
 * A5ProductDetail.
 *
 * 4 tabs: Mockups · Listing · Files · History (default Listing — A5 spec).
 * Header: back arrow → /products, title + status badge + Duplicate +
 * Preview + "Send to Etsy as Draft" publish CTA (gated on stage).
 */

type TabId = "mockups" | "listing" | "files" | "history";

interface Props {
  productId: string;
}

export function ProductDetailClient({ productId }: Props) {
  const [tab, setTab] = useState<TabId>("listing");
  const { data: listing, isLoading, error } = useListingDraft(productId);

  if (isLoading) {
    return (
      <div className="-m-6 flex h-screen items-center justify-center bg-bg">
        <Loader2 className="h-6 w-6 animate-spin text-k-orange" aria-hidden />
        <span className="ml-2 text-sm text-ink-2">Loading product…</span>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="-m-6 flex h-screen flex-col bg-bg">
        <header className="flex items-center gap-4 border-b border-line bg-bg px-6 py-4">
          <Link
            href="/products"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 hover:border-line-strong hover:text-ink"
            aria-label="Back to products"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <h1 className="text-base font-semibold text-ink">Product</h1>
        </header>
        <div className="flex-1 px-6 py-10">
          <div
            role="alert"
            className="mx-auto max-w-xl rounded-md border border-danger bg-danger-soft px-4 py-4"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" aria-hidden />
              <div>
                <h2 className="text-sm font-semibold text-danger">
                  Product yüklenemedi
                </h2>
                <p className="mt-1 text-sm text-ink-2">
                  {error instanceof Error ? error.message : "Bilinmeyen hata"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stage = deriveProductStage({
    status: listing.status,
    mockupJobId: listing.mockupJobId,
    coverRenderId: listing.coverRenderId,
    etsyListingId: listing.etsyListingId,
  });

  const health = listingHealthScore(listing.readiness);

  const mockupCount = listing.imageOrder.length;
  const filesCount = listing.imageOrder.length;

  const tabs: TabItem[] = [
    { id: "mockups", label: "Mockups", count: mockupCount },
    { id: "listing", label: "Listing" },
    { id: "files", label: "Files", count: filesCount },
    { id: "history", label: "History" },
  ];

  // Send to Etsy CTA — gating: Mockup ready stage olmadan disabled.
  const canSubmit = stage === "Mockup ready" && listing.status === "DRAFT";

  return (
    <div
      className="-m-6 flex h-screen flex-col"
      data-testid="product-detail-page"
    >
      {/* Header */}
      <header className="flex items-center gap-4 border-b border-line bg-bg px-6 py-4">
        <Link
          href="/products"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 hover:border-line-strong hover:text-ink"
          aria-label="Back to products"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-base font-semibold text-ink">
              {listing.title ?? "(untitled draft)"}
            </h1>
            <Badge tone={productStageBadgeTone(stage)} dot>
              {stage}
            </Badge>
            {listing.etsyListingId ? (
              <a
                href={`https://www.etsy.com/your/shops/me/tools/listings/${listing.etsyListingId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-k-amber-soft px-1.5 py-0.5 text-xs font-mono text-k-amber hover:bg-k-amber-soft/80"
              >
                Etsy · {listing.etsyListingId.slice(0, 12)}
              </a>
            ) : null}
          </div>
          <p className="mt-0.5 font-mono text-xs uppercase tracking-meta text-ink-3">
            PROD · {listing.id.slice(0, 8)}{" "}
            {listing.status === "DRAFT" ? "· DRAFT NOT SENT" : null}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50"
          disabled
          title="Duplicate ships in R6"
        >
          <Copy className="h-3 w-3" aria-hidden />
          Duplicate
        </button>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50"
          disabled
          title="Preview ships in R6"
        >
          <Eye className="h-3 w-3" aria-hidden />
          Preview
        </button>
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--publish"
          disabled={!canSubmit}
          title={
            canSubmit
              ? "Submit listing to Etsy as draft"
              : stage === "Sent"
                ? "Already sent"
                : stage === "Failed"
                  ? "Resolve failure first (see Listing tab)"
                  : "Apply mockups before sending to Etsy"
          }
          onClick={() => setTab("listing")}
          data-testid="product-detail-send-etsy"
        >
          <Send className="h-3 w-3" aria-hidden />
          Send to Etsy as Draft
        </button>
      </header>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-line bg-bg px-6">
        <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id as TabId)} />
      </div>

      {/* Tab content */}
      {tab === "mockups" ? <MockupsTab listing={listing} /> : null}
      {tab === "listing" ? <ListingTab listing={listing} health={health} /> : null}
      {tab === "files" ? <FilesTab listing={listing} /> : null}
      {tab === "history" ? <HistoryTab listing={listing} /> : null}
    </div>
  );
}
