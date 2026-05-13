/* eslint-disable no-restricted-syntax */
// SelectionCard — Kivasy v5 B2 hero card. Card içi `.k-thumb` 3-up grid
// ratio sabitleri (`!aspect-square`) v5 design layer'ında tanımlı; safelist
// üzerinden korunur. Whitelisted in scripts/check-tokens.ts.
"use client";

import Link from "next/link";
import { ArrowRight, ImageIcon, Layers, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  type SelectionStage,
  stageBadgeTone,
  stageCta,
} from "@/features/selections/state-helpers";

/**
 * SelectionCard — `.k-card--hero` 2-col B2 grid kartı.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B2SelectionsIndex map row.
 *
 * Per-card props:
 *   - id, name, count: header (truncate)
 *   - stage: badge tone + CTA türetilir (state-helpers)
 *   - sourceLabel: alt-meta (örn. "batch_01J7Y · 2h ago")
 *   - thumbs: 3 thumbnail URL (signed). Eksik slotlar boş kalır (ghost cell).
 *
 * Tek dominant action — kartın altında stage'e bağlı CTA. Kebab kart
 * header'ında pasif görünür; gerçek menü R4'te yok (R5+ açılacak).
 */

interface SelectionCardProps {
  id: string;
  name: string;
  count: number;
  stage: SelectionStage;
  sourceLabel: string;
  thumbs: (string | null)[];
  /**
   * Phase 50 — canonical source batch lineage. SelectionsIndex serverdan
   * gelen sourceMetadata'dan resolve edilir (mjOrigin.batchIds[0] veya
   * variation-batch.batchId). null ise lineage chip render edilmez.
   */
  sourceBatchId?: string | null;
}

export function SelectionCard({
  id,
  name,
  count,
  stage,
  sourceLabel,
  thumbs,
  sourceBatchId = null,
}: SelectionCardProps) {
  const cta = stageCta(stage);
  // 3 slot daima — eksikler boş thumb cell'i bırakır (consistent layout).
  const thumbSlots: (string | null)[] = [
    thumbs[0] ?? null,
    thumbs[1] ?? null,
    thumbs[2] ?? null,
  ];

  return (
    <div
      className="k-card k-card--hero overflow-hidden"
      data-testid="selection-card"
      data-set-id={id}
    >
      <div className="grid grid-cols-3 gap-1.5 p-3 pb-0">
        {thumbSlots.map((src, idx) => (
          <div
            key={idx}
            className="overflow-hidden rounded-md bg-k-bg-2 aspect-square"
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div aria-hidden className="h-full w-full bg-k-bg-2" />
            )}
          </div>
        ))}
      </div>

      <div className="p-4 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold leading-tight text-ink">
              {name}
            </div>
            <div className="mt-1 font-mono text-xs tabular-nums tracking-wider text-ink-3">
              {count} designs · {sourceLabel}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Badge tone={stageBadgeTone(stage)} dot>
              {stage}
            </Badge>
            <button
              type="button"
              aria-label="More actions"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-3 hover:border-line-strong hover:text-ink"
              disabled
              title="More actions (rename, archive, duplicate) — coming soon"
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        {sourceBatchId ? (
          /* Phase 50 — Source batch lineage chip.
           *
           * Operatör "bu set hangi batch'ten doğdu?" sorusunun cevabını
           * burada görür. Phase 49 References Pool batch chip ile aile
           * parity: border + bg-k-bg-2/60 + Layers icon + mono + arrow.
           * Tıklanır → /batches/[batchId]. Card-içi nested Link guard
           * (event stopPropagation) gerekmez çünkü kart altındaki primary
           * CTA da Link; ikisi sibling. Lineage chip rendering boş
           * sourceBatchId'de tamamen gizli (gürültü değil sinyal).
           */
          <div className="mt-2.5">
            <Link
              href={`/batches/${sourceBatchId}`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-line-soft bg-k-bg-2/60 px-2 py-1",
                "font-mono text-[10.5px] font-semibold uppercase tracking-meta text-ink-2",
                "transition-colors hover:border-k-orange/50 hover:bg-k-orange-soft hover:text-k-orange-ink",
              )}
              data-testid="selection-card-source-batch"
              data-batch-id={sourceBatchId}
              title="Open the source batch this selection came from"
            >
              <Layers className="h-3 w-3" aria-hidden />
              <span>From batch</span>
              <span className="text-ink-3">·</span>
              <span>{sourceBatchId.slice(0, 8)}</span>
              <ArrowRight className="ml-0.5 h-3 w-3" aria-hidden />
            </Link>
          </div>
        ) : null}

        <div className="mt-3.5">
          {/* R11.14.9 — CTA recipe parity. Önceden secondary variant
           * ad-hoc Tailwind composition (bg-paper border-line) kullanıyordu;
           * şimdi k-btn--secondary recipe ile tutarlı (Library'deki
           * "Saved views" CTA ile aynı tonu üretir). */}
          <Link
            href={`/selections/${id}`}
            data-size="sm"
            className={cn(
              cta.variant === "primary"
                ? "k-btn k-btn--primary"
                : cta.variant === "ghost"
                  ? "k-btn k-btn--ghost"
                  : "k-btn k-btn--secondary",
            )}
            data-testid="selection-card-cta"
          >
            {cta.label}
            {cta.iconKind === "arrow" ? (
              <ArrowRight className="h-3 w-3" aria-hidden />
            ) : (
              <ImageIcon className="h-3 w-3" aria-hidden />
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
