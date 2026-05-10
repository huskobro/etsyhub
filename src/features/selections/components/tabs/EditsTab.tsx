/* eslint-disable no-restricted-syntax */
// EditsTab — Kivasy v5 B3 row-level edit triggers. `!w-12 !aspect-square`
// before/after thumb sabitleri ve `bg-[var(--k-purple)]` v2 badge v5
// design layer'ından (purple = edit stage). Whitelisted in scripts/
// check-tokens.ts.
"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Crop,
  Eraser,
  ExternalLink,
  ImageOff,
  Loader2,
  Maximize2,
  Palette,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import { useSelectionSet } from "@/features/selection/queries";
import {
  CROP_RATIO_OPTIONS,
  useApplyInstantEdit,
} from "@/features/selections/hooks/useApplyInstantEdit";
import {
  useApplyHeavyEdit,
  useHeavyEditPoll,
} from "@/features/selections/hooks/useApplyHeavyEdit";

/**
 * EditsTab — B3 Edits tab, per-row edit triggers.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B3Edits.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Edit operations themselves live in `@/server/services/selection/edit-ops/*`.
 *   Two surfaces consume them:
 *     • This tab (canonical /selections/[id]?tab=edits) hosts:
 *         - Crop          → instant (sync) /edit endpoint, row-level menu
 *         - Background remove → heavy (async) /edit/heavy endpoint with
 *                               BullMQ job + DB-side per-item lock; the
 *                               row goes into "Processing…" mode and
 *                               polls the set detail every 3s until the
 *                               server clears activeHeavyJobId.
 *     • The Edit Studio (`/selection/sets/[id]`) still hosts the heavy
 *       lifecycle for magic-eraser (mask-canvas widget); color edit and
 *       upscale are deferred (no provider integration). Those triggers
 *       open the studio honestly rather than appearing disabled with
 *       no explanation.
 *
 * The same SelectionItem.activeHeavyJobId field is shared with the
 * Studio shell: a job started here shows up there immediately on the
 * next poll, and vice-versa, because both consumers read the same
 * detail query (selectionSetQueryKey(setId)).
 */

export interface EditsTabItem {
  id: string;
  sourceAssetId: string;
  editedAssetId: string | null;
  aspectRatio: string | null;
  productTypeKey: string | null;
  /** Heavy lock — non-null while a BullMQ heavy job is in flight on
   *  this item. Op-agnostic: a magic-eraser job locks background-remove
   *  on the same item too. */
  activeHeavyJobId: string | null;
}

interface EditsTabProps {
  setId: string;
  items: EditsTabItem[];
  /** Set status drives read-only — finalized/archived sets disable
   *  every edit trigger (server returns 409 SetReadOnlyError; UI guard
   *  matches so failed mutations don't surprise the operator). */
  setStatus: "draft" | "ready" | "archived";
}

type EditKind = "bg" | "color" | "crop" | "upscale" | "eraser";

interface EditMeta {
  label: string;
  icon: LucideIcon;
  /** "instant" runs in-place via /edit (sync). "heavy" runs in-place
   *  via /edit/heavy (BullMQ + lock + poll). "studio" routes to the
   *  Edit Studio for now. */
  mode: "instant" | "heavy" | "studio";
}

const EDIT_META: Record<EditKind, EditMeta> = {
  bg: { label: "Background remove", icon: ImageOff, mode: "heavy" },
  color: { label: "Color edit", icon: Palette, mode: "studio" },
  crop: { label: "Crop", icon: Crop, mode: "instant" },
  upscale: { label: "Upscale", icon: Maximize2, mode: "studio" },
  eraser: { label: "Magic eraser", icon: Eraser, mode: "studio" },
};

const EDIT_ORDER: ReadonlyArray<EditKind> = [
  "bg",
  "color",
  "crop",
  "upscale",
  "eraser",
];

export function EditsTab({ setId, items: initialItems, setStatus }: EditsTabProps) {
  const isReadOnly = setStatus !== "draft";

  // The SSR prop covers initial paint; the live detail query feeds the
  // heavy-lock state machine afterwards. We never replace the SSR
  // shape (aspectRatio / productTypeKey come from a join the row UI
  // doesn't read but the type contract preserves) — we just merge in
  // the dynamic fields the poll loop refreshes (editedAssetId,
  // activeHeavyJobId). While the query is loading we fall back to the
  // SSR snapshot so the row layout doesn't flash empty.
  const detail = useSelectionSet(setId);
  const liveItems = detail.data?.items;
  const liveById = liveItems
    ? new Map(liveItems.map((it) => [it.id, it]))
    : null;
  const items: EditsTabItem[] = initialItems.map((it) => {
    const live = liveById?.get(it.id);
    if (!live) return it;
    return {
      ...it,
      editedAssetId: live.editedAssetId,
      activeHeavyJobId: live.activeHeavyJobId,
    };
  });

  const instantMutation = useApplyInstantEdit(setId);
  const heavyMutation = useApplyHeavyEdit(setId);
  const pendingInstantItem = instantMutation.variables?.itemId ?? null;
  const pendingHeavyItem = heavyMutation.variables?.itemId ?? null;

  // Row-level inline crop ratio menu. Only one row's menu is open at a
  // time; outside-click closes it. Pattern matches the Studio
  // QuickActions inline menu (no popover dependency).
  const [openCropFor, setOpenCropFor] = useState<string | null>(null);
  const cropMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openCropFor) return;
    const handler = (e: MouseEvent) => {
      if (
        cropMenuRef.current &&
        !cropMenuRef.current.contains(e.target as Node)
      ) {
        setOpenCropFor(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openCropFor]);

  // Surface mutation errors inline at the top of the tab. Auto-clears
  // after 5s so a one-off failure doesn't pin the alert across multiple
  // attempts. Mirrors the Studio QuickActions pattern.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  useEffect(() => {
    const err = instantMutation.error ?? heavyMutation.error;
    if (!err) return;
    setErrorMessage((err as Error).message);
  }, [instantMutation.error, heavyMutation.error]);
  useEffect(() => {
    if (!errorMessage) return;
    const t = setTimeout(() => setErrorMessage(null), 5000);
    return () => clearTimeout(t);
  }, [errorMessage]);

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-5"
      data-testid="selection-edits-tab"
      data-set-id={setId}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="font-mono text-xs uppercase tracking-meta text-ink-3">
          Per-design edit triggers — Crop runs in-place; Background remove processes in the background
        </div>
        {isReadOnly ? (
          <span
            className="font-mono text-xs uppercase tracking-meta text-ink-3"
            title="Set finalize edildi, düzenleme kapalı"
          >
            Read-only · {setStatus}
          </span>
        ) : null}
      </div>

      {errorMessage ? (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-3 rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger"
        >
          {errorMessage}
        </div>
      ) : null}

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
          {items.map((it, idx) => (
            <EditRow
              key={it.id}
              item={it}
              setId={setId}
              isReadOnly={isReadOnly}
              isLast={idx === items.length - 1}
              cropMenuOpen={openCropFor === it.id}
              onCropMenuToggle={(open) => setOpenCropFor(open ? it.id : null)}
              cropMenuRef={openCropFor === it.id ? cropMenuRef : undefined}
              instantPending={
                instantMutation.isPending && pendingInstantItem === it.id
              }
              instantOp={instantMutation.variables?.op.op}
              onCrop={(ratio) =>
                instantMutation.mutate({
                  itemId: it.id,
                  op: { op: "crop", params: { ratio } },
                })
              }
              heavyPending={
                heavyMutation.isPending && pendingHeavyItem === it.id
              }
              onBackgroundRemove={() =>
                heavyMutation.mutate({
                  itemId: it.id,
                  op: "background-remove",
                })
              }
            />
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-text-muted">
        Crop runs in-place once the server responds. Background remove
        starts a background job — the row shows a Processing pill and
        polls every few seconds until the new asset is ready. Color
        edit, upscale and magic eraser open the{" "}
        <a
          href={`/selection/sets/${setId}`}
          className="text-info underline-offset-2 hover:underline"
        >
          Edit Studio
        </a>{" "}
        for this set; the mask-canvas and provider work for those moves
        onto canonical detail in a later pass.
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// EditRow — one row + its triggers + the heavy-lock poll loop.
// ────────────────────────────────────────────────────────────
//
// The poll hook lives at row level so each row independently follows
// its own activeHeavyJobId. Concurrent heavy jobs on different rows
// each run their own loop without interfering.

interface EditRowProps {
  item: EditsTabItem;
  setId: string;
  isReadOnly: boolean;
  isLast: boolean;
  cropMenuOpen: boolean;
  onCropMenuToggle: (open: boolean) => void;
  cropMenuRef: React.RefObject<HTMLDivElement> | undefined;
  instantPending: boolean;
  instantOp: string | undefined;
  onCrop: (ratio: "2:3" | "4:5" | "1:1" | "3:4") => void;
  heavyPending: boolean;
  onBackgroundRemove: () => void;
}

function EditRow({
  item,
  setId,
  isReadOnly,
  isLast,
  cropMenuOpen,
  onCropMenuToggle,
  cropMenuRef,
  instantPending,
  instantOp,
  onCrop,
  heavyPending,
  onBackgroundRemove,
}: EditRowProps) {
  const isApplied = item.editedAssetId !== null;
  const isProcessing = item.activeHeavyJobId !== null;

  // Per-row poll — turns itself off the moment the server clears
  // activeHeavyJobId. Idempotent under React Query's enabled flag.
  useHeavyEditPoll(setId, item.id, isProcessing);

  // Any active op on this row (own mutation or external lock) blocks
  // every other trigger. The server enforces this anyway (409
  // ConcurrentEditError); the UI guard means we never show a failed
  // mutation for a click the operator could have avoided.
  const rowBusy = isReadOnly || isProcessing || instantPending || heavyPending;

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3",
        !isLast && "border-b border-line-soft",
      )}
      data-testid="selection-edit-row"
      data-item-id={item.id}
      data-processing={isProcessing ? "true" : "false"}
    >
      {isApplied ? (
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <div className="h-12 w-12 opacity-50">
            <UserAssetThumb assetId={item.sourceAssetId} />
          </div>
          <ArrowRight className="h-3 w-3 text-ink-3" aria-hidden />
          <div className="relative">
            <div className="h-12 w-12">
              <UserAssetThumb
                assetId={item.editedAssetId ?? item.sourceAssetId}
              />
            </div>
            <span className="absolute -right-1 -top-1 rounded bg-k-purple px-1 py-0.5 font-mono text-xs uppercase tracking-wider text-white">
              v2
            </span>
          </div>
        </div>
      ) : (
        <div className="h-12 w-12 flex-shrink-0">
          <UserAssetThumb assetId={item.sourceAssetId} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium leading-tight text-ink">
            Design {item.id.slice(0, 6)}
          </div>
          {isProcessing ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-k-purple/10 px-2 py-0.5 font-mono text-xs uppercase tracking-meta text-k-purple"
              data-testid="row-processing-pill"
            >
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Processing
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 font-mono text-xs tracking-wider text-ink-3">
          {isProcessing
            ? "Heavy job in progress · ~5–15s"
            : isApplied
              ? "Edits applied"
              : "No edits applied"}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {EDIT_ORDER.map((kind) => {
          const meta = EDIT_META[kind];
          const Icon = meta.icon;

          // Crop — instant in-place, row-level ratio menu.
          if (kind === "crop") {
            const cropPending = instantPending && instantOp === "crop";
            return (
              <div
                key={kind}
                className="relative"
                ref={cropMenuOpen ? cropMenuRef : undefined}
              >
                <button
                  type="button"
                  disabled={rowBusy}
                  title={
                    isReadOnly
                      ? "Set finalize edildi, düzenleme kapalı"
                      : isProcessing
                        ? "Heavy job in progress on this design"
                        : `${meta.label} — runs in-place`
                  }
                  aria-label={`${meta.label} (in-place)`}
                  aria-haspopup="menu"
                  aria-expanded={cropMenuOpen}
                  onClick={() => onCropMenuToggle(!cropMenuOpen)}
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-md border text-ink-2",
                    "border-line bg-paper",
                    "hover:border-k-purple hover:text-k-purple",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                  data-testid="edit-trigger-crop"
                  data-mode="instant"
                >
                  {cropPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
                {cropMenuOpen ? (
                  <div
                    role="menu"
                    aria-label="Crop ratio seçimi"
                    className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border border-border bg-surface p-1 shadow-popover"
                  >
                    {CROP_RATIO_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="menuitem"
                        disabled={rowBusy}
                        onClick={() => {
                          onCropMenuToggle(false);
                          onCrop(opt.value);
                        }}
                        className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-text hover:bg-surface-2 disabled:opacity-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          }

          // Background remove — heavy in-place. Same /edit/heavy
          // endpoint the Studio uses; the row drives its own poll loop
          // via useHeavyEditPoll above.
          if (kind === "bg") {
            const bgPending = heavyPending;
            return (
              <button
                key={kind}
                type="button"
                disabled={rowBusy}
                title={
                  isReadOnly
                    ? "Set finalize edildi, düzenleme kapalı"
                    : isProcessing
                      ? bgPending
                        ? "Background remove starting…"
                        : "Another heavy op is running on this design"
                      : `${meta.label} — runs in the background`
                }
                aria-label={
                  bgPending
                    ? `${meta.label} (starting…)`
                    : isProcessing
                      ? `${meta.label} (busy)`
                      : `${meta.label} (heavy job)`
                }
                onClick={onBackgroundRemove}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md border text-ink-2",
                  "border-line bg-paper",
                  "hover:border-k-purple hover:text-k-purple",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
                data-testid="edit-trigger-bg"
                data-mode="heavy"
              >
                {bgPending || isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
            );
          }

          // Studio-bridged ops (color / upscale / eraser). Visually
          // distinguished via the small ExternalLink corner glyph; the
          // operator can read the mode from the row before clicking.
          return (
            <a
              key={kind}
              href={`/selection/sets/${setId}`}
              title={`${meta.label} — opens the Edit Studio`}
              aria-label={`${meta.label} (opens the Edit Studio)`}
              className={cn(
                "relative inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper text-ink-2",
                "hover:border-k-purple hover:text-k-purple",
              )}
              data-testid={`edit-trigger-${kind}`}
              data-mode="studio"
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <ExternalLink
                className="absolute -right-0.5 -top-0.5 h-2 w-2 text-ink-3"
                aria-hidden
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}
