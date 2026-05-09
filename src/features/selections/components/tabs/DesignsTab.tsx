/* eslint-disable no-restricted-syntax */
// DesignsTab — Kivasy v5 B3 Designs grid. `aspect-square` thumb cell
// + Tailwind `text-[10.5px]` mono caption v5 sabitleri (Library/Batches
// ile tutarlı 4-col layout). Whitelisted in scripts/check-tokens.ts.
"use client";

import { useState } from "react";
import Link from "next/link";
import { GripVertical, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { FloatingBulkBar } from "@/components/ui/FloatingBulkBar";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import { Checkbox } from "@/features/library/components/Checkbox";

/**
 * DesignsTab — B3 Designs tab, 4-col grid.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B3Designs.
 *
 * R4 surface: tile select (multi), drag handle (visual-only), "Add from
 * Library" handoff CTA, bulk bar with Apply edits / Reorder / Remove
 * (actions disabled — R5 server-side wiring).
 */

export interface DesignsTabItem {
  id: string;
  sourceAssetId: string;
  editedAssetId: string | null;
  aspectRatio: string | null;
  productTypeKey: string | null;
}

interface DesignsTabProps {
  setId: string;
  items: DesignsTabItem[];
}

export function DesignsTab({ setId, items }: DesignsTabProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clear() {
    setSelected(new Set());
  }

  const showBulkBar = selected.size >= 2;

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-5"
      data-testid="selection-designs-tab"
      data-set-id={setId}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
          {items.length} designs · drag to reorder
        </div>
        {/* R11.14.9 — Was previously disabled with workflow tooltip; now
         * actionable link to Library. Library shows a guidance banner
         * (?intent=add-to-selection) so user picks assets and uses
         * bulk-bar 'Add to Selection' to get back here. */}
        <Link
          href={`/library?intent=add-to-selection&setId=${setId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
          title="Open Library to pick designs and add them to this set."
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add from Library
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-ink">No designs yet</h3>
          <p className="mt-1 text-sm text-text-muted">
            Open Library, multi-select assets, and use the bulk-bar to add
            them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((it) => {
            const isSel = selected.has(it.id);
            const activeAssetId = it.editedAssetId ?? it.sourceAssetId;
            return (
              <div
                key={it.id}
                onClick={() => toggle(it.id)}
                className={cn(
                  "k-card relative overflow-hidden cursor-pointer",
                  isSel && "ring-2 ring-k-orange",
                )}
                data-testid="selection-design-tile"
                data-item-id={it.id}
                data-selected={isSel ? "true" : undefined}
              >
                <div className="p-2 pb-0">
                  <UserAssetThumb assetId={activeAssetId} />
                </div>
                <div className="absolute left-3 top-3">
                  <Checkbox
                    checked={isSel}
                    onChange={() => toggle(it.id)}
                    aria-label="Select design"
                  />
                </div>
                <div className="absolute right-3 top-3">
                  <button
                    type="button"
                    aria-label="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line bg-paper/95 text-ink-3 cursor-grab disabled:opacity-50"
                    disabled
                    title="Reorder by drag-and-drop — coming in R5. Designs currently sort by add date."
                  >
                    <GripVertical className="h-3 w-3" aria-hidden />
                  </button>
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-medium leading-tight text-ink">
                    Design {it.id.slice(0, 6)}
                  </div>
                  <div className="mt-1 font-mono text-xs tracking-wider text-ink-3">
                    {it.aspectRatio ?? "—"} ·{" "}
                    {it.productTypeKey ?? "untyped"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showBulkBar ? (
        <FloatingBulkBar
          count={selected.size}
          onClear={clear}
          actions={[
            {
              label: "Apply edits",
              icon: <Sparkles className="h-3.5 w-3.5" aria-hidden />,
              primary: true,
              disabled: true,
            },
            {
              label: "Reorder",
              icon: <GripVertical className="h-3.5 w-3.5" aria-hidden />,
              disabled: true,
            },
            {
              label: "Remove",
              icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
              disabled: true,
            },
          ]}
        />
      ) : null}
    </div>
  );
}
