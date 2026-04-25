"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { CompetitorListItem } from "../queries/use-competitors";

/**
 * CompetitorCard — T-33 primitive consumption.
 *
 * Sözleşme: docs/design/implementation-notes/competitors-screens.md
 * - Card primitive (stat varianti default → list grid'de doğrudan padlenmiş kart)
 *   sarması; manuel <article> yok
 * - Auto/Manual pill → Badge (success / neutral tone)
 * - Tara butonu → Button variant="ghost" size="sm"
 * - Detay link → next/link, Button-style sınıfları primitive değil; mevcut accent
 *   stili korunur (Button asChild yok, Link styled minimal kalır)
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
    ? new Date(competitor.lastScannedAt).toLocaleString("tr-TR")
    : "Henüz taranmadı";

  return (
    <Card as="article" className="flex flex-col gap-3">
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
          <Badge tone="success">Oto-tarama</Badge>
        ) : (
          <Badge tone="neutral">Manuel</Badge>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onTriggerScan(competitor.id)}
          disabled={scanning}
        >
          {scanning ? "Başlatılıyor…" : "Tara"}
        </Button>
        <Link
          href={`/competitors/${competitor.id}`}
          className="inline-flex h-control-sm items-center rounded-md bg-accent-soft px-2.5 text-sm font-medium text-accent-text hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Detay
        </Link>
      </div>
    </Card>
  );
}
