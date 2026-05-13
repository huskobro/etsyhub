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
import { resolveSourceBatchId } from "@/lib/selection-lineage";

export interface SetSummaryCardProps {
  set: SelectionSetDetailView;
  isQuickPack: boolean;
  selectedCount: number;
}

/**
 * Phase 55 — resolveSourceBatchId helper @/lib/selection-lineage'a
 * taşındı. Önceden inline kopya vardı (Phase 52); Phase 53 S8ResultView
 * + Phase 54 S7JobView aynı helper'ı tekrar inline kopyalamıştı. Phase
 * 55 DRY temizliği: 3 dosyada inline kopya yerine tek import.
 */

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
  /* Phase 54 — Status badge Kivasy DS palette'ine taşındı.
   * Legacy `bg-slate/green/gray` Tailwind raw tones → DS tone tokens
   * (`bg-k-bg-2 / bg-success-soft / bg-k-bg-2`) + uygun text contrast. */
  const statusColor = {
    draft: "bg-k-bg-2 text-ink-2 border-line-soft",
    ready: "bg-success-soft text-success border-success/30",
    archived: "bg-k-bg-2/60 text-ink-3 border-line-soft",
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

  /* Phase 54 — Shell DS migration.
   *
   * Önceden `rounded-md border border-border bg-surface-2 p-4` ve
   * `text-text text-text-muted` legacy semantic tokens kullanıyordu —
   * Kivasy ürün ailesine ait değildi. Phase 54: k-card recipe + line
   * border + paper bg + ink/ink-2/ink-3 text token'lar.
   *
   * Lineage chip'leri (Phase 52) zaten Kivasy DS'de — yalnız shell
   * legacy idi. Phase 54 ile Selection detail / Mockup result / S7
   * in-progress kartları aynı görsel aileye girer. */
  return (
    <section
      aria-label="Set summary"
      data-testid="mockup-set-summary"
      className="rounded-lg border border-line bg-paper p-4"
    >
      <div className="space-y-3">
        {/* Set adı + statüsü */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="truncate text-sm font-semibold text-ink">
              {set.name}
            </h2>
            <p className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              {set.items.length} design{set.items.length === 1 ? "" : "s"} selected
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5",
              "font-mono text-[10px] font-semibold uppercase tracking-meta",
              statusColor,
            )}
            data-testid="mockup-set-summary-status"
            data-status={set.status}
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

        {/* Pack türü ve seçili say (Phase 54 — Kivasy DS tokens) */}
        <div className="border-t border-line-soft pt-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] uppercase tracking-meta text-ink-3">
              {isQuickPack ? "Quick pack" : "Custom selection"}
            </span>
            <span className="text-sm font-medium tabular-nums text-ink">
              {selectedCount} mockup{selectedCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
