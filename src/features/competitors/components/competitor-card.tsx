"use client";

import Link from "next/link";
import type { CompetitorListItem } from "../queries/use-competitors";

export function CompetitorCard({
  competitor,
  onTriggerScan,
  scanning,
}: {
  competitor: CompetitorListItem;
  onTriggerScan: (id: string) => void;
  scanning?: boolean;
}) {
  const shopLabel = competitor.displayName ?? competitor.etsyShopName;
  const totalListings =
    competitor.totalListings ?? competitor._count?.listings ?? 0;
  const lastScanText = competitor.lastScannedAt
    ? new Date(competitor.lastScannedAt).toLocaleString("tr-TR")
    : "Henüz taranmadı";

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-card">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-sm font-medium text-text">
            {shopLabel}
          </h3>
          <span className="text-xs text-text-muted">
            {competitor.platform} · {competitor.etsyShopName}
          </span>
        </div>
        {competitor.autoScanEnabled ? (
          <span className="rounded-md bg-success/15 px-2 py-0.5 text-xs text-success">
            Oto-tarama
          </span>
        ) : (
          <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-text-muted">
            Manuel
          </span>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-2 text-xs text-text-muted">
        <div className="flex flex-col">
          <dt>Listing</dt>
          <dd className="text-sm text-text">{totalListings}</dd>
        </div>
        <div className="flex flex-col">
          <dt>Son tarama</dt>
          <dd className="truncate text-sm text-text" title={lastScanText}>
            {lastScanText}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onTriggerScan(competitor.id)}
          disabled={scanning}
          className="rounded-md border border-border px-2 py-1 text-xs text-text hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
        >
          {scanning ? "Başlatılıyor…" : "Tara"}
        </button>
        <Link
          href={`/competitors/${competitor.id}`}
          className="rounded-md bg-accent/15 px-2 py-1 text-xs text-accent hover:bg-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Detay
        </Link>
      </div>
    </article>
  );
}
