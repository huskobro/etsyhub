"use client";

import Link from "next/link";
import type { CompetitorListItem } from "../queries/use-competitors";

/**
 * CompetitorCard — Kivasy v5 B1.Shops sub-view recipe (R11.14.10).
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b1.jsx
 *   → SubShops kart bloğu
 *
 * R11.14.10 — Eski legacy `Card` + `Button` + `Badge` primitive kompozisyonu
 * yerine v5 SubShops k-card pattern'a geçirildi (Library + References Pool
 * paritesiyle birebir):
 *   - .k-card overflow-hidden + data-interactive
 *   - meta block: shop title (text-[13px] font-medium) + platform mono
 *     (text-[10.5px]) + .k-badge tone (success/neutral)
 *   - bottom action row: ghost Scan button + accent Detail link
 *   - hover state: k-card recipe + line-strong border (CSS-only)
 *
 * Surface boundary: Shops sub-view kart-grid. Detail link
 * `/competitors/[id]` route'una yönlendirir.
 */

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
    ? new Date(competitor.lastScannedAt).toLocaleString("en-US")
    : "Not scanned yet";

  return (
    <article
      className="k-card flex flex-col gap-3 p-4"
      data-testid="competitor-card"
      data-interactive="true"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-[13px] font-medium leading-tight text-ink">
            {shopLabel}
          </h3>
          <span className="font-mono text-[10.5px] tracking-wider text-ink-3">
            {competitor.platform} · {competitor.etsyShopName}
          </span>
        </div>
        <span
          className="k-badge"
          data-tone={competitor.autoScanEnabled ? "success" : "neutral"}
        >
          {competitor.autoScanEnabled ? "Auto-scan" : "Manual"}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-2 text-[10.5px] font-mono uppercase tracking-meta text-ink-3">
        <div className="flex flex-col gap-0.5">
          <dt>Listings</dt>
          <dd className="font-sans text-[13px] normal-case tracking-normal text-ink">
            {totalListings}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt>Last scan</dt>
          <dd
            className="truncate font-sans text-[12.5px] normal-case tracking-normal text-ink-2"
            title={lastScanText}
          >
            {lastScanText}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          data-size="sm"
          className="k-btn k-btn--ghost"
          onClick={() => onTriggerScan(competitor.id)}
          disabled={scanning}
        >
          {scanning ? "Starting…" : "Scan"}
        </button>
        <Link
          href={`/competitors/${competitor.id}`}
          data-size="sm"
          className="k-btn k-btn--secondary"
        >
          Detail
        </Link>
      </div>
    </article>
  );
}
