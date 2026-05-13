/* eslint-disable no-restricted-syntax */
// DesignsTab — Kivasy v5 B3 Designs grid. `aspect-square` thumb cell
// + Tailwind `text-[10.5px]` mono caption v5 sabitleri (Library/Batches
// ile tutarlı 4-col layout). Whitelisted in scripts/check-tokens.ts.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Check,
  CircleSlash,
  CircleDot,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
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
 * Phase 51 — Studio surface'a evrim. Pre-Phase 51 tab status agnostic'di:
 *   - kartlarda item.status (pending/selected/rejected) görünmüyordu;
 *     operatör hangi item kept/removed göremiyordu
 *   - bulk-bar tüm aksiyonları disabled (R5 deferral'ı kalıcılaşmıştı)
 *   - kartlar metadata-fakir ("Design XXXXXX · 1:1 · untyped")
 *
 * Phase 51 değişiklikleri:
 *   - Per-tile **status badge** (Selected/Rejected/Pending) — review-card
 *     decision pill kalitesinde, paper-on-light DS recipe'lerinde.
 *   - Status **filter chips** üst barda (All / Selected / Rejected /
 *     Pending) — operatör curation view'ı hızlı toggle eder.
 *   - Bulk-bar **gerçek aksiyon** alır: Promote → selected, Demote →
 *     pending, Remove → rejected. PATCH /api/selection/sets/[setId]
 *     /items/bulk endpoint'i Phase 7 Task 21'de zaten yazılmıştı,
 *     UI bağlantısı şimdi açıldı.
 *   - Count caption status-aware: "N designs · X selected · Y pending".
 */

export interface DesignsTabItem {
  id: string;
  sourceAssetId: string;
  editedAssetId: string | null;
  aspectRatio: string | null;
  productTypeKey: string | null;
  status: "pending" | "selected" | "rejected";
}

interface DesignsTabProps {
  setId: string;
  items: DesignsTabItem[];
  /** Phase 51 — read-only mode when set is finalized (Mockup ready / Sent /
   *  Archived). Status mutation'lar disabled olur, görünürlük korunur. */
  readOnly?: boolean;
}

type StatusFilter = "all" | "selected" | "pending" | "rejected";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "selected", label: "Selected" },
  { id: "pending", label: "Pending" },
  { id: "rejected", label: "Rejected" },
];

function statusBadgeTone(s: DesignsTabItem["status"]): {
  bg: string;
  text: string;
  border: string;
  Icon: typeof Check;
} {
  if (s === "selected") {
    return {
      bg: "bg-k-orange-soft",
      text: "text-k-orange-ink",
      border: "border-k-orange/40",
      Icon: Check,
    };
  }
  if (s === "rejected") {
    return {
      bg: "bg-danger/10",
      text: "text-danger",
      border: "border-danger/30",
      Icon: CircleSlash,
    };
  }
  return {
    bg: "bg-k-bg-2/60",
    text: "text-ink-3",
    border: "border-line-soft",
    Icon: CircleDot,
  };
}

function statusLabel(s: DesignsTabItem["status"]): string {
  if (s === "selected") return "Selected";
  if (s === "rejected") return "Rejected";
  return "Pending";
}

export function DesignsTab({ setId, items, readOnly = false }: DesignsTabProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<StatusFilter>("all");

  /* Phase 51 — Status counts for header caption + filter chip badges.
   * Memoized so filter toggle doesn't recompute on every render. */
  const counts = useMemo(() => {
    let sel = 0;
    let pen = 0;
    let rej = 0;
    for (const it of items) {
      if (it.status === "selected") sel++;
      else if (it.status === "rejected") rej++;
      else pen++;
    }
    return { selected: sel, pending: pen, rejected: rej, total: items.length };
  }, [items]);

  const visibleItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((it) => it.status === filter);
  }, [items, filter]);

  /* Phase 51 — Bulk status mutation wired to existing PATCH endpoint.
   * Service layer (`bulkUpdateStatus`) already enforces cross-set
   * filter + status enum validation. Success → router.refresh() so the
   * server-side detail page re-fetches items with new status values. */
  const bulkMutation = useMutation({
    mutationFn: async (args: {
      itemIds: string[];
      status: "pending" | "selected" | "rejected";
    }) => {
      const res = await fetch(`/api/selection/sets/${setId}/items/bulk`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Bulk update failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setSelected(new Set());
      router.refresh();
    },
  });

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

  const showBulkBar = selected.size >= 2 && !readOnly;
  const selectedIds = Array.from(selected);
  const isMutating = bulkMutation.isPending;

  return (
    <div
      className="flex-1 overflow-y-auto px-6 py-5"
      data-testid="selection-designs-tab"
      data-set-id={setId}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <div
            className="font-mono text-xs uppercase tracking-meta text-ink-3"
            data-testid="selection-designs-counts"
          >
            {counts.total} designs
            {counts.selected > 0 ? (
              <>
                {" · "}
                <span className="text-k-orange-ink">
                  {counts.selected} selected
                </span>
              </>
            ) : null}
            {counts.pending > 0 ? (
              <>
                {" · "}
                <span>{counts.pending} pending</span>
              </>
            ) : null}
            {counts.rejected > 0 ? (
              <>
                {" · "}
                <span className="text-danger">{counts.rejected} rejected</span>
              </>
            ) : null}
          </div>
          {/* Phase 51 — Status filter chip strip. Compact, scan-friendly. */}
          <div
            className="flex items-center gap-1"
            data-testid="selection-designs-status-filters"
          >
            {STATUS_FILTERS.map((f) => {
              const count =
                f.id === "all"
                  ? counts.total
                  : f.id === "selected"
                    ? counts.selected
                    : f.id === "pending"
                      ? counts.pending
                      : counts.rejected;
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-1",
                    "font-mono text-[10.5px] font-semibold uppercase tracking-meta",
                    "transition-colors",
                    active
                      ? "border-k-orange bg-k-orange-soft text-k-orange-ink"
                      : "border-line bg-paper text-ink-2 hover:border-line-strong hover:text-ink",
                  )}
                  data-testid="selection-designs-filter-chip"
                  data-filter={f.id}
                  data-active={active || undefined}
                >
                  <span>{f.label}</span>
                  {count > 0 ? (
                    <span className="text-ink-3">{count}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        {/* R11.14.9 — actionable link to Library. */}
        <Link
          href={`/library?intent=add-to-selection&setId=${setId}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-paper px-3 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
          title="Open Library to pick designs and add them to this set."
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add from Library
        </Link>
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-paper px-6 py-10 text-center">
          <h3 className="text-base font-semibold text-ink">
            {items.length === 0
              ? "No designs yet"
              : `No ${filter} designs`}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {items.length === 0
              ? "Open Library, multi-select assets, and use the bulk-bar to add them here."
              : filter === "selected"
                ? "Promote pending designs to Selected via the bulk-bar (multi-select first)."
                : "Switch the filter chip above to see other designs."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {visibleItems.map((it) => {
            const isSel = selected.has(it.id);
            const activeAssetId = it.editedAssetId ?? it.sourceAssetId;
            const tone = statusBadgeTone(it.status);
            const StatusIcon = tone.Icon;
            return (
              <div
                key={it.id}
                onClick={() => toggle(it.id)}
                className={cn(
                  "k-card relative overflow-hidden cursor-pointer",
                  isSel && "ring-2 ring-k-orange",
                  // Phase 51 — subtle visual emphasis on selected items
                  // (status==="selected"; review-card kalitesi).
                  it.status === "selected" &&
                    !isSel &&
                    "ring-1 ring-k-orange-soft ring-offset-1 ring-offset-paper",
                  // Rejected tiles dimmed (operator scan'de net görür).
                  it.status === "rejected" && "opacity-60",
                )}
                data-testid="selection-design-tile"
                data-item-id={it.id}
                data-selected={isSel ? "true" : undefined}
                data-status={it.status}
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
                {/* Phase 51 — Status badge top-right. Review-card decision
                 *   pill kalitesinde; Phase 49 References Pool "In Draft"
                 *   chip ile aile parity (icon + mono + uppercase). */}
                <div
                  className={cn(
                    "absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
                    "font-mono text-[10px] font-semibold uppercase tracking-meta",
                    "shadow-sm",
                    tone.bg,
                    tone.text,
                    tone.border,
                  )}
                  data-testid="selection-design-status-badge"
                  data-status={it.status}
                >
                  <StatusIcon className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />
                  {statusLabel(it.status)}
                </div>
                {/* Phase 58 — Drag handle placeholder kaldırıldı.
                 *
                 * Önceki davranış: her tile sağ üstte disabled GripVertical
                 * icon + "Reorder by drag-and-drop — coming soon. Designs
                 * currently sort by add date." tooltip. Sorun: 4+ tile grid
                 * (xl:grid-cols-4) → 4-16 görsel gri grip icon. Operatör
                 * hover yapınca aynı tooltip her seferinde. Bu **görsel
                 * gürültü** + her tile'da tekrar eden disabled sinyali.
                 *
                 * Phase 58 stratejisi: placeholder tamamen kaldır. Header
                 * caption'daki "drag to reorder" promise'i de Phase 51'de
                 * "X designs · Y selected · Z pending" status-aware
                 * caption'a geçti — operatör drag promise'i görmüyor zaten.
                 * Reorder gerçekten landing yaparsa drag handle component
                 * yeniden eklenebilir; o zamana kadar tile temiz kalır. */}
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
          testId="selection-designs-bulk-bar"
          actions={[
            {
              label: isMutating ? "Promoting…" : "Promote",
              icon: <Sparkles className="h-3.5 w-3.5" aria-hidden />,
              primary: true,
              disabled: isMutating,
              testId: "selection-designs-bulk-promote",
              onClick: () =>
                bulkMutation.mutate({
                  itemIds: selectedIds,
                  status: "selected",
                }),
            },
            {
              label: "Move to pending",
              icon: <CircleDot className="h-3.5 w-3.5" aria-hidden />,
              disabled: isMutating,
              testId: "selection-designs-bulk-pending",
              onClick: () =>
                bulkMutation.mutate({
                  itemIds: selectedIds,
                  status: "pending",
                }),
            },
            {
              label: "Reject",
              icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
              disabled: isMutating,
              testId: "selection-designs-bulk-reject",
              onClick: () =>
                bulkMutation.mutate({
                  itemIds: selectedIds,
                  status: "rejected",
                }),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
