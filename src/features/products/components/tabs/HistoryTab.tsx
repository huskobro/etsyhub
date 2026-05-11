/* eslint-disable no-restricted-syntax */
// HistoryTab — Kivasy v4 A5 timeline; v4 sabit boyutlar:
//  · text-[11px] mono ts (A5 canon, Selections HistoryTab ile birebir)
// Whitelisted in scripts/check-tokens.ts.
"use client";

import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { ListingDraftView } from "@/features/listings/types";

/**
 * HistoryTab — A5 History tab, snapshot timeline.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a5.jsx →
 * A5ProductDetail history tab.
 *
 * R5 surface: timeline derived from listing snapshots (createdAt /
 * updatedAt / submittedAt / publishedAt / failedReason). R6+'da Audit
 * log entegrasyonu eklenecek (per-edit row, mockup apply runs vb.).
 */

interface HistoryTabProps {
  listing: ListingDraftView;
}

interface HistoryEvent {
  ts: string;
  label: string;
  meta: string;
  tone?: "info" | "danger" | "success";
}

function formatTs(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export function HistoryTab({ listing }: HistoryTabProps) {
  const events: HistoryEvent[] = [];

  events.push({
    ts: listing.createdAt,
    label: "Product created from selection",
    meta: listing.mockupJobId
      ? `Mockup job ${listing.mockupJobId.slice(0, 8)}`
      : "No mockup job linked yet",
  });

  if (listing.imageOrder.length > 0) {
    events.push({
      ts: listing.updatedAt,
      label: "Mockups applied",
      meta: `${listing.imageOrder.length} renders bound`,
    });
  }

  if (listing.title) {
    events.push({
      ts: listing.updatedAt,
      label: "Listing fields edited",
      meta: "Title, tags, description",
    });
  }

  if (listing.submittedAt) {
    events.push({
      ts: listing.submittedAt,
      label: "Listing submitted to Etsy",
      meta: "Awaiting publish",
      tone: "info",
    });
  }
  if (listing.publishedAt) {
    events.push({
      ts: listing.publishedAt,
      label: "Etsy draft created",
      meta: listing.etsyListingId
        ? `Draft ${listing.etsyListingId.slice(0, 12)}`
        : "Draft id unknown",
      tone: "success",
    });
  }
  if (listing.failedReason) {
    events.push({
      ts: listing.updatedAt,
      label: "Listing submit failed",
      meta: listing.failedReason,
      tone: "danger",
    });
  }

  // Sıralama: en yeni önce.
  events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  if (events.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-bg px-8 py-8">
        <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-ink">No history yet</h3>
          <p className="mt-1 text-sm text-text-muted">
            Product events will appear here as the listing moves through stages.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto bg-bg px-8 py-8"
      data-testid="product-history-tab"
    >
      <div className="mx-auto max-w-3xl space-y-1">
        {events.map((e, i) => (
          <div
            key={`${e.ts}-${i}`}
            className={cn(
              "flex gap-4 border-b border-line-soft py-3",
              i === events.length - 1 && "border-b-0",
            )}
          >
            <span className="whitespace-nowrap pt-0.5 font-mono text-[11px] tabular-nums text-ink-3">
              {formatTs(e.ts)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">{e.label}</div>
              <div className="mt-0.5 font-mono text-[11px] text-ink-3">
                {e.meta}
              </div>
            </div>
            {e.tone ? (
              <Badge tone={e.tone} dot>
                {e.tone === "danger"
                  ? "Failed"
                  : e.tone === "success"
                    ? "Etsy"
                    : "Info"}
              </Badge>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
