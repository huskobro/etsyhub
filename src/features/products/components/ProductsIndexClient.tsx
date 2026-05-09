/* eslint-disable no-restricted-syntax */
// ProductsIndexClient — Kivasy v5 B4 table; v5 yarı-piksel mono caption
// (text-[10.5px] / text-[11px] / text-[13.5px] / text-[12.5px]) sabitleri
// Tailwind text-xs/text-sm tier'larıyla karşılanmıyor (Batches table ile
// birebir patern). Whitelisted in scripts/check-tokens.ts.
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  ImageOff,
  Plus,
  RotateCw,
  Search,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { FilterChip } from "@/components/ui/FilterChip";
import {
  type Density,
  DensityToggle,
} from "@/components/ui/DensityToggle";
import { AppTopbar } from "@/components/ui/AppTopbar";
import {
  deriveProductStage,
  productStageBadgeTone,
  type ProductStage,
} from "@/features/products/state-helpers";
import type { ListingIndexView } from "@/features/listings/types";

/**
 * ProductsIndexClient — Kivasy B4 Products table.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b4.jsx →
 * B4ProductsIndex.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Products = mockup'lanmış + listing-paketlenmiş + Etsy'ye giden ürün.
 *   Variation üretimi yok, set CRUD yok. Listing/MockupJob model'leri
 *   üzerinde Product görselleştirmesi.
 */

interface ProductRow {
  id: string;
  title: string | null;
  status: import("@prisma/client").ListingStatus;
  mockupJobId: string | null;
  coverRenderId: string | null;
  etsyListingId: string | null;
  priceCents: number | null;
  coverThumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  /** Per-product 4-up thumb composite (B4 row). */
  thumbsComposite: string[];
  /** Toplam teslim dosya sayısı (mockup renderlar + ZIP/PDF varsa). */
  filesCount: number;
  /** Listing health 0..100. */
  health: number | null;
}

const ALL_STAGES: ReadonlyArray<ProductStage | "all"> = [
  "all",
  "Draft",
  "Mockup ready",
  "Etsy-bound",
  "Sent",
  "Failed",
];

interface ProductsIndexClientProps {
  rows: ProductRow[];
  /** R5 — Selection cross-link banner; null ise gösterilmez. */
  fromSelectionId?: string | null;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function healthColorClass(score: number | null): string {
  if (score === null) return "bg-line";
  if (score >= 90) return "bg-k-green";
  if (score >= 80) return "bg-k-orange";
  if (score >= 70) return "bg-k-amber";
  return "bg-k-red";
}

export function ProductsIndexClient({
  rows,
  fromSelectionId = null,
}: ProductsIndexClientProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [keyword, setKeyword] = useState(params.get("q") ?? "");
  const [density, setDensity] = useState<Density>("comfortable");
  const stageFilter =
    (params.get("stage") as ProductStage | "all" | null) ?? "all";

  const enriched = rows.map((r) => ({
    ...r,
    stage: deriveProductStage({
      status: r.status,
      mockupJobId: r.mockupJobId,
      coverRenderId: r.coverRenderId,
      etsyListingId: r.etsyListingId,
    }),
  }));

  const filtered = enriched.filter((r) => {
    if (stageFilter !== "all" && r.stage !== stageFilter) return false;
    if (keyword.trim().length > 0) {
      const q = keyword.trim().toLowerCase();
      const hay = (r.title ?? "").toLowerCase();
      const idHay = r.id.toLowerCase();
      const draftHay = (r.etsyListingId ?? "").toLowerCase();
      if (
        !hay.includes(q) &&
        !idHay.includes(q) &&
        !draftHay.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  function cycleStage() {
    const idx = ALL_STAGES.indexOf(stageFilter);
    const next = ALL_STAGES[(idx + 1) % ALL_STAGES.length] ?? "all";
    const sp = new URLSearchParams(params.toString());
    if (next === "all") sp.delete("stage");
    else sp.set("stage", next);
    const qs = sp.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  }

  function applyKeyword(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams(params.toString());
    const q = keyword.trim();
    if (q.length === 0) sp.delete("q");
    else sp.set("q", q);
    const qs = sp.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  }

  const sentCount = enriched.filter((r) => r.stage === "Sent").length;

  const subtitleText = fromSelectionId
    ? `${rows.length} PRODUCTS · ${sentCount} SENT TO ETSY · FILTERED BY SELECTION ${fromSelectionId.slice(0, 8)}`
    : `${rows.length} PRODUCTS · ${sentCount} SENT TO ETSY`;

  return (
    <div className="-m-6 flex h-screen flex-col" data-testid="products-page">
      <AppTopbar
        title="Products"
        subtitle={subtitleText}
        actions={
          <button
            type="button"
            data-size="sm"
            className="k-btn k-btn--primary"
            disabled
            title="To create a new Product: open a Selection (Mockup ready stage), then use 'Apply Mockups'. Products always come from finalized selections."
            data-testid="products-new-cta"
          >
            <Plus className="h-3 w-3" aria-hidden />
            New Product
          </button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-bg px-6 py-3">
        <form
          onSubmit={applyKeyword}
          className="relative flex max-w-md flex-1 items-center"
        >
          <Search
            className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-ink-3"
            aria-hidden
          />
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search products by title, id, draft id…"
            className="h-8 w-full rounded-md border border-line bg-paper pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-k-orange focus:outline-none focus:ring-2 focus:ring-k-orange-soft"
            data-testid="products-search-input"
          />
        </form>
        <FilterChip active={stageFilter !== "all"} caret onClick={cycleStage}>
          {stageFilter === "all" ? "Status" : stageFilter}
        </FilterChip>
        <div className="ml-auto flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-meta text-ink-3">
            {filtered.length} of {rows.length}
          </span>
          <DensityToggle
            surfaceKey="products"
            defaultValue={density}
            onChange={setDensity}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div
            className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center"
            data-testid="products-empty"
          >
            <h3 className="text-base font-semibold text-ink">
              {rows.length === 0
                ? "No products yet"
                : "No products match these filters"}
            </h3>
            <p className="mt-1 text-sm text-text-muted">
              {rows.length === 0
                ? "Apply mockups to a Selection — packs land here as Products ready for Etsy draft."
                : "Clear filters or change the stage filter to see more."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-line bg-paper">
            <table className="w-full" data-testid="products-table">
              <thead className="border-b border-line-soft bg-k-bg-2/40">
                <tr>
                  <ProductTH className="w-20" />
                  <ProductTH>Product</ProductTH>
                  <ProductTH className="w-20">Files</ProductTH>
                  <ProductTH className="w-32">Listing health</ProductTH>
                  <ProductTH className="w-44">Status</ProductTH>
                  <ProductTH className="w-24">Updated</ProductTH>
                  <ProductTH className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="group cursor-pointer border-b border-line-soft transition-colors last:border-b-0 hover:bg-k-bg-2/40"
                    data-testid="products-row"
                    data-product-id={r.id}
                    onClick={() => router.push(`/products/${r.id}`)}
                  >
                    <ProductTD className={density === "dense" ? "py-2" : "py-3"}>
                      <div className="grid w-12 grid-cols-2 gap-0.5">
                        {[0, 1, 2, 3].map((idx) => {
                          const src = r.thumbsComposite[idx];
                          return (
                            <div
                              key={idx}
                              className="aspect-square overflow-hidden rounded-[3px] bg-k-bg-2"
                            >
                              {src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={src}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </ProductTD>
                    <ProductTD className={density === "dense" ? "py-2" : "py-3"}>
                      <Link
                        href={`/products/${r.id}`}
                        className="block text-[13.5px] font-medium text-ink hover:text-k-orange"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.title ?? "(untitled draft)"}
                      </Link>
                      <div className="mt-0.5 font-mono text-xs text-ink-3">
                        prod_{r.id.slice(0, 12)}
                      </div>
                    </ProductTD>
                    <ProductTD className={density === "dense" ? "py-2" : "py-3"}>
                      <span className="font-mono text-[12.5px] tabular-nums tracking-wider text-ink">
                        {r.filesCount}
                      </span>
                    </ProductTD>
                    <ProductTD className={density === "dense" ? "py-2" : "py-3"}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-k-bg-2">
                          <div
                            className={cn(
                              "h-full transition-all",
                              healthColorClass(r.health),
                            )}
                            style={{
                              width:
                                r.health !== null
                                  ? `${Math.max(0, Math.min(100, r.health))}%`
                                  : "0%",
                            }}
                            aria-label={
                              r.health !== null
                                ? `Listing health ${r.health}%`
                                : "No health data"
                            }
                          />
                        </div>
                        <span className="font-mono text-[11px] tabular-nums text-ink-2">
                          {r.health ?? "—"}
                        </span>
                      </div>
                    </ProductTD>
                    <ProductTD className={density === "dense" ? "py-2" : "py-3"}>
                      <div className="flex items-center gap-2">
                        <Badge tone={productStageBadgeTone(r.stage)} dot>
                          {r.stage}
                        </Badge>
                        {r.stage === "Sent" && r.etsyListingId ? (
                          <a
                            href={`https://www.etsy.com/your/shops/me/tools/listings/${r.etsyListingId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-k-amber-soft px-1.5 py-0.5 hover:bg-k-amber-soft/80"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider text-k-amber">
                              Etsy
                            </span>
                            <span className="font-mono text-[10px] tracking-wider text-k-amber underline-offset-2">
                              {r.etsyListingId.slice(0, 12)}
                            </span>
                            <ExternalLink className="h-2.5 w-2.5 text-k-amber" aria-hidden />
                          </a>
                        ) : null}
                        {r.stage === "Failed" ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/products/${r.id}?action=retry`);
                            }}
                            className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-medium text-k-red hover:bg-k-red-soft"
                          >
                            <RotateCw className="h-3 w-3" aria-hidden />
                            Retry
                          </button>
                        ) : null}
                      </div>
                    </ProductTD>
                    <ProductTD className={density === "dense" ? "py-2" : "py-3"}>
                      <span className="font-mono text-xs tabular-nums text-ink-3">
                        {relativeTime(r.updatedAt)}
                      </span>
                    </ProductTD>
                    <ProductTD className={density === "dense" ? "py-2" : "py-3"}>
                      <ChevronRight
                        className="h-4 w-4 text-ink-3 opacity-0 group-hover:opacity-100"
                        aria-hidden
                      />
                    </ProductTD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductTH({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left font-mono text-[10.5px] font-medium uppercase tracking-meta text-ink-3",
        className,
      )}
    >
      {children}
    </th>
  );
}

function ProductTD({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 align-middle", className)}>{children}</td>;
}

// Empty state when there are zero rows is rendered above. ImageOff is exported
// for use by per-thumb fallback if needed in future iterations.
export { ImageOff };
