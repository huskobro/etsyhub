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
import {
  CROP_RATIO_OPTIONS,
  useApplyInstantEdit,
} from "@/features/selections/hooks/useApplyInstantEdit";
import type { DesignsTabItem } from "./DesignsTab";

/**
 * EditsTab — B3 Edits tab, per-row edit triggers.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v5/screens-b2-b3.jsx →
 * B3Edits.
 *
 * Boundary (docs/IMPLEMENTATION_HANDOFF.md §5):
 *   Edit operations themselves live in `@/server/services/selection/edit-ops/*`.
 *   Two surfaces consume them:
 *     • This tab (canonical /selections/[id]?tab=edits) hosts the
 *       *instant* (sync) ops in-place via the same /edit endpoint the
 *       Studio shell uses. Today only Crop is wired in-place — the
 *       operator picks a ratio from a row-level menu and the cache is
 *       invalidated on success, so the before/after row updates
 *       without leaving the tab.
 *     • The Edit Studio (`/selection/sets/[id]`) still owns the *heavy*
 *       lifecycle (BullMQ + DB-side lock + worker progress): background
 *       remove, magic eraser. Color edit and Upscale are deferred (no
 *       provider integration yet) — those triggers honestly route to
 *       the studio. Bringing the heavy lifecycle onto canonical detail
 *       is a follow-up phase; the in-place vs studio split is signalled
 *       in the row UI so the operator knows what each trigger does.
 */

interface EditsTabProps {
  setId: string;
  items: DesignsTabItem[];
  /** Set status drives read-only — finalized/archived sets disable
   *  every edit trigger (server returns 409 SetReadOnlyError; UI guard
   *  matches so failed mutations don't surprise the operator). */
  setStatus: "draft" | "ready" | "archived";
}

type EditKind = "bg" | "color" | "crop" | "upscale" | "eraser";

interface EditMeta {
  label: string;
  icon: LucideIcon;
  /** True when this kind is wired in-place via /edit. False kinds open
   *  the Edit Studio for the heavy lifecycle. Used to render an
   *  external-link affordance + alternate hover treatment. */
  inPlace: boolean;
}

const EDIT_META: Record<EditKind, EditMeta> = {
  bg: { label: "Background remove", icon: ImageOff, inPlace: false },
  color: { label: "Color edit", icon: Palette, inPlace: false },
  crop: { label: "Crop", icon: Crop, inPlace: true },
  upscale: { label: "Upscale", icon: Maximize2, inPlace: false },
  eraser: { label: "Magic eraser", icon: Eraser, inPlace: false },
};

const EDIT_ORDER: ReadonlyArray<EditKind> = [
  "bg",
  "color",
  "crop",
  "upscale",
  "eraser",
];

export function EditsTab({ setId, items, setStatus }: EditsTabProps) {
  const isReadOnly = setStatus !== "draft";
  const editMutation = useApplyInstantEdit(setId);
  const pendingItemId = editMutation.variables?.itemId ?? null;

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
    if (!editMutation.error) return;
    setErrorMessage((editMutation.error as Error).message);
  }, [editMutation.error]);
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
          Per-design edit triggers — Crop runs in-place; heavy ops open the Edit Studio
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
          {items.map((it, idx) => {
            const isApplied = it.editedAssetId !== null;
            const isPendingThisRow =
              editMutation.isPending && pendingItemId === it.id;
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

                    // Crop — in-place via /edit (sync). Row-level inline
                    // menu lets the operator pick a ratio without
                    // leaving canonical detail.
                    if (kind === "crop") {
                      const isOpen = openCropFor === it.id;
                      const cropPending =
                        isPendingThisRow &&
                        editMutation.variables?.op.op === "crop";
                      return (
                        <div
                          key={kind}
                          className="relative"
                          ref={isOpen ? cropMenuRef : undefined}
                        >
                          <button
                            type="button"
                            disabled={isReadOnly || isPendingThisRow}
                            title={
                              isReadOnly
                                ? "Set finalize edildi, düzenleme kapalı"
                                : `${meta.label} — runs in-place`
                            }
                            aria-label={`${meta.label} (in-place)`}
                            aria-haspopup="menu"
                            aria-expanded={isOpen}
                            onClick={() =>
                              setOpenCropFor(isOpen ? null : it.id)
                            }
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-md border text-ink-2",
                              "border-line bg-paper",
                              "hover:border-k-purple hover:text-k-purple",
                              "disabled:cursor-not-allowed disabled:opacity-50",
                            )}
                            data-testid="edit-trigger-crop"
                            data-in-place="true"
                          >
                            {cropPending ? (
                              <Loader2
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Icon className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                          {isOpen ? (
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
                                  disabled={isPendingThisRow}
                                  onClick={() => {
                                    setOpenCropFor(null);
                                    editMutation.mutate({
                                      itemId: it.id,
                                      op: {
                                        op: "crop",
                                        params: { ratio: opt.value },
                                      },
                                    });
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

                    // Heavy / deferred ops — honest "opens the Edit
                    // Studio" link. Visually distinguished from the
                    // in-place trigger via the external-link affordance
                    // (small arrow in the corner).
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
                        data-in-place="false"
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
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-text-muted">
        Crop runs in-place on this tab (pick a ratio, the row updates
        once the server responds). Background remove, color edit,
        upscale and magic eraser open the{" "}
        <a
          href={`/selection/sets/${setId}`}
          className="text-info underline-offset-2 hover:underline"
        >
          Edit Studio
        </a>{" "}
        for this set — the heavy lifecycle (BullMQ progress, locks)
        moves onto canonical detail in a later pass.
      </p>
    </div>
  );
}
