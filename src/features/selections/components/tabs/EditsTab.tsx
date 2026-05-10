/* eslint-disable no-restricted-syntax */
// EditsTab — Kivasy v5 B3 row-level edit triggers. `!w-12 !aspect-square`
// before/after thumb sabitleri ve `bg-[var(--k-purple)]` v2 badge v5
// design layer'ından (purple = edit stage). Whitelisted in scripts/
// check-tokens.ts.
"use client";

import {
  ArrowRight,
  Crop,
  Eraser,
  ImageOff,
  Maximize2,
  Palette,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import type { DesignsTabItem } from "./DesignsTab";

/**
 * EditsTab — B3 Edits tab, per-row before/after pairing.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B3Edits.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Edit operations themselves live in `@/server/services/selection/edit-ops/*`
 *   and their Studio modals (Pass 29 Magic Eraser, etc.). This tab places
 *   the *triggers* — clicking them opens the Edit Studio for the set.
 *   The studio shell still lives at /selection/sets/[id] (Studio
 *   relocation under /selections/[id]/edits is the next IA phase); the
 *   URL split is an internal detail, not surfaced to the user.
 */

interface EditsTabProps {
  setId: string;
  items: DesignsTabItem[];
}

type EditKind = "bg" | "color" | "crop" | "upscale" | "eraser";

const EDIT_META: Record<
  EditKind,
  { label: string; icon: LucideIcon; tone: string }
> = {
  bg: {
    label: "Background remove",
    icon: ImageOff,
    tone: "text-ink-2",
  },
  color: {
    label: "Color edit",
    icon: Palette,
    tone: "text-ink-2",
  },
  crop: {
    label: "Crop",
    icon: Crop,
    tone: "text-ink-2",
  },
  upscale: {
    label: "Upscale",
    icon: Maximize2,
    tone: "text-ink-2",
  },
  eraser: {
    label: "Magic eraser",
    icon: Eraser,
    tone: "text-ink-2",
  },
};

const EDIT_ORDER: ReadonlyArray<EditKind> = [
  "bg",
  "color",
  "crop",
  "upscale",
  "eraser",
];

export function EditsTab({ setId, items }: EditsTabProps) {
  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-5"
      data-testid="selection-edits-tab"
      data-set-id={setId}
    >
      <div className="mb-4 font-mono text-xs uppercase tracking-meta text-ink-3">
        Per-design edit triggers — opens the Edit Studio for this set
      </div>

      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-ink">
            No designs to edit yet
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            Add designs in the Designs tab first.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-line bg-paper">
          {items.map((it, idx) => {
            const isApplied = it.editedAssetId !== null;
            return (
              <div
                key={it.id}
                className={cn(
                  "flex items-center gap-4 px-4 py-3",
                  idx < items.length - 1 && "border-b border-line-soft",
                )}
                data-testid="selection-edit-row"
                data-item-id={it.id}
              >
                {isApplied ? (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <div className="h-12 w-12 opacity-50">
                      <UserAssetThumb assetId={it.sourceAssetId} />
                    </div>
                    <ArrowRight
                      className="h-3 w-3 text-ink-3"
                      aria-hidden
                    />
                    <div className="relative">
                      <div className="h-12 w-12">
                        <UserAssetThumb
                          assetId={it.editedAssetId ?? it.sourceAssetId}
                        />
                      </div>
                      <span className="absolute -right-1 -top-1 rounded bg-k-purple px-1 py-0.5 font-mono text-xs uppercase tracking-wider text-white">
                        v2
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-12 w-12 flex-shrink-0">
                    <UserAssetThumb assetId={it.sourceAssetId} />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight text-ink">
                    Design {it.id.slice(0, 6)}
                  </div>
                  <div className="mt-0.5 font-mono text-xs tracking-wider text-ink-3">
                    {isApplied ? "Edits applied" : "No edits applied"}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {EDIT_ORDER.map((kind) => {
                    const meta = EDIT_META[kind];
                    const Icon = meta.icon;
                    // IA Phase 4 — edit triggers point at the Edit Studio
                    // for this set. The studio shell still lives at
                    // /selection/sets/[id]; the URL split is an internal
                    // detail and the user-facing wording no longer carries
                    // a "legacy" caveat.
                    return (
                      <a
                        key={kind}
                        href={`/selection/sets/${setId}`}
                        title={`${meta.label} — opens the Edit Studio`}
                        aria-label={`${meta.label} (opens the Edit Studio)`}
                        className={cn(
                          "inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper",
                          meta.tone,
                          "hover:border-k-purple hover:text-k-purple",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-text-muted">
        Edit operations — background remove, color edit, crop, upscale,
        magic eraser — open the{" "}
        <a
          href={`/selection/sets/${setId}`}
          className="text-info underline-offset-2 hover:underline"
        >
          Edit Studio
        </a>{" "}
        for this set. In-place split-modal editing lands in a later pass.
      </p>
    </div>
  );
}
