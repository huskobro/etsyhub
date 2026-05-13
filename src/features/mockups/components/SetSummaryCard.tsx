"use client";

// Phase 8 Task 24 — SetSummaryCard.
// Phase 52 — Selection lineage strip eklendi (set source batch chip
// Phase 50 References Pool batch chip ile aile parity).
//
// Spec §5.2 Zone 2: Selection set özeti kartı.
//
// Gösterilenler (Phase 52):
//   - Set adı + status badge
//   - Seçili tasarım sayısı + pack türü
//   - **Yeni:** Source batch lineage chip (sourceMetadata.kind=variation-batch
//     veya mjOrigin.batchIds[0] → tıklanır /batches/{id} link)
//   - **Yeni:** Product type chip (set'in items[0].productTypeKey'inden
//     türetilir; mockup studio'da hangi ürün tipinin template havuzu
//     açıldığı operatöre görünür kalır)
//
// Kullanım:
//   S3ApplyView'de Zone 2 placeholder replace (§5.2)

import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { type SelectionSetDetailView } from "@/features/selection/queries";
import { cn } from "@/lib/cn";

export interface SetSummaryCardProps {
  set: SelectionSetDetailView;
  isQuickPack: boolean;
  selectedCount: number;
}

/**
 * Phase 52 — sourceMetadata'dan canonical batch lineage çıkar.
 * İki format destekler (CLAUDE.md Phase 50 resolveSourceLineage parity):
 *   1. { kind: "variation-batch", batchId } (Phase 5 quickStart)
 *   2. { mjOrigin: { batchIds: [...] } } (Phase 1 kept-handoff)
 */
function resolveSourceBatchId(sourceMetadata: unknown): string | null {
  if (!sourceMetadata || typeof sourceMetadata !== "object") return null;
  const md = sourceMetadata as Record<string, unknown>;
  if (md.kind === "variation-batch" && typeof md.batchId === "string") {
    return md.batchId;
  }
  const mjOrigin = md.mjOrigin;
  if (mjOrigin && typeof mjOrigin === "object") {
    const batchIds = (mjOrigin as Record<string, unknown>).batchIds;
    if (Array.isArray(batchIds) && typeof batchIds[0] === "string") {
      return batchIds[0] as string;
    }
  }
  return null;
}

/**
 * Spec §5.2 Zone 2 — Set özeti kartı.
 *
 * Phase 52 — Operatör mockup studio'ya indikten sonra "hangi selection
 * + hangi batch + hangi product type üzerinde çalışıyorum?" sorusunun
 * görsel cevabını alır. Lineage chip'leri context kaybını önler.
 */
export function SetSummaryCard({
  set,
  isQuickPack,
  selectedCount,
}: SetSummaryCardProps) {
  // Status badge rengini belirle
  const statusColor = {
    draft: "bg-slate-100 text-slate-700",
    ready: "bg-green-100 text-green-700",
    archived: "bg-gray-100 text-gray-700",
  }[set.status];

  const statusLabel = {
    draft: "Draft",
    ready: "Ready",
    archived: "Archived",
  }[set.status];

  // Phase 52 — Lineage extraction.
  const sourceBatchId = resolveSourceBatchId(set.sourceMetadata);
  // Set items[0].productTypeKey mockup studio'nun category çözümünde
  // de kullanılıyor (S3ApplyView line 36); UI burada operatöre aynı
  // bilgiyi gösterir — silent fallback "canvas" yerine gerçek key.
  const items = (set as { items?: Array<{ productTypeKey?: string | null }> })
    .items;
  const productTypeKey = items?.[0]?.productTypeKey ?? null;

  return (
    <section
      aria-label="Set summary"
      data-testid="mockup-set-summary"
      className="rounded-md border border-border bg-surface-2 p-4"
    >
      <div className="space-y-3">
        {/* Set adı + statüsü */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-text">{set.name}</h2>
            <p className="text-xs text-text-muted">
              {set.items.length} design{set.items.length === 1 ? "" : "s"} selected
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Phase 52 — Lineage strip. Tek satır chip'ler.
         *   - Selection back-link (operatör Apply'dan Selection detail'a
         *     bir tıkla döner; "hatamı düzeltmem lazım" senaryosu için
         *     kritik)
         *   - Source batch chip (Phase 50 lineage chip recipe parity:
         *     Layers + mono + arrow)
         *   - Product type chip (mockup template havuzu transparency'si) */}
        {(sourceBatchId || productTypeKey) && (
          <div
            className="flex flex-wrap items-center gap-1.5"
            data-testid="mockup-set-summary-lineage"
          >
            <Link
              href={`/selections/${set.id}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-k-bg-2/60 px-2 py-1",
                "font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2",
                "transition-colors hover:border-k-orange/50 hover:bg-k-orange-soft hover:text-k-orange-ink",
              )}
              data-testid="mockup-set-summary-back-to-selection"
              title="Back to Selection detail"
            >
              <span>← Selection</span>
            </Link>
            {sourceBatchId ? (
              <Link
                href={`/batches/${sourceBatchId}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-k-bg-2/60 px-2 py-1",
                  "font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2",
                  "transition-colors hover:border-k-orange/50 hover:bg-k-orange-soft hover:text-k-orange-ink",
                )}
                data-testid="mockup-set-summary-source-batch"
                data-batch-id={sourceBatchId}
                title="Open the source batch this selection came from"
              >
                <Layers className="h-3 w-3" aria-hidden />
                <span>From batch</span>
                <span className="text-ink-3">·</span>
                <span>{sourceBatchId.slice(0, 8)}</span>
                <ArrowRight className="ml-0.5 h-3 w-3" aria-hidden />
              </Link>
            ) : null}
            {productTypeKey ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border border-line-soft bg-paper px-2 py-1",
                  "font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-3",
                )}
                data-testid="mockup-set-summary-product-type"
                data-product-type={productTypeKey}
                title="Product type — mockup template pool resolves to this category"
              >
                <span>Type</span>
                <span className="text-ink-3">·</span>
                <span className="text-ink-2">{productTypeKey}</span>
              </span>
            ) : null}
          </div>
        )}

        {/* Pack türü ve seçili say */}
        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {isQuickPack ? "Quick pack" : "Custom selection"}
            </span>
            <span className="text-sm font-medium text-text">
              {selectedCount} mockup
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
