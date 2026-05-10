/* eslint-disable no-restricted-syntax */
// A4 Batch Review workspace — Kivasy v4 dark-mode canonical surface.
// Hardcoded `#1A1815` / `#16130F` / `#1F1C18` and arbitrary Tailwind values
// (filmstrip kbd chip min-w, max-w-[760px] stage, text-[8px]/[9px] meta)
// are part of the v4 spec and aren't intended to flow through the warm-paper
// token system. Whitelisted in scripts/check-tokens.ts.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  X as XIcon,
  RotateCcw,
  Layers,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { MJReviewDecision } from "@prisma/client";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import { Modal } from "@/features/library/components/Modal";
import type {
  ReviewItem,
  BatchReviewSummary,
} from "@/server/services/midjourney/review";

/**
 * BatchReviewWorkspace — Kivasy A4 dark-mode review surface.
 *
 * Source: docs/design-system/kivasy/ui_kits/kivasy/v4/screens-a3-a4.jsx
 * → A4BatchReview.
 *
 * Keyboard map (per docs/IMPLEMENTATION_HANDOFF.md §10 Rollout-3 + CN-2):
 *   K = Keep · D = Discard / Reject · R = Re-roll (deferred) · S = Add to
 *   Selection (deferred) · ← / → = Prev / Next · Z = Undo (deferred) ·
 *   Space = Zoom 1:1 (deferred) · ? = Help modal
 *
 * Surface boundary: this is a focus-mode for keep/reject decisions only.
 * No selection set CRUD, no mockup application — those happen in /selections
 * and /products in later rollouts.
 */

interface BatchReviewWorkspaceProps {
  batchId: string;
  summary: BatchReviewSummary;
  items: ReviewItem[];
  initialCursor?: number;
  /**
   * Where the workspace bar's back-link and Exit button send the operator.
   * Defaults to the batch detail page (`/batches/[id]`); when this workspace
   * is embedded under the canonical `/review?batch=...` route, the host
   * page passes `/review` so Exit returns to the unified review surface.
   */
  exitHref?: string;
  /**
   * Visible label used in the back-link chip alongside the arrow icon.
   * Defaults to `batch_<short>` (the original A4 spec). When embedded
   * under `/review`, the host can pass a more user-facing label like
   * `Review` so the workspace chrome reads as a sub-mode rather than a
   * standalone page.
   */
  exitLabel?: string;
}

export function BatchReviewWorkspace({
  batchId,
  summary,
  items,
  initialCursor = 0,
  exitHref,
  exitLabel,
}: BatchReviewWorkspaceProps) {
  const resolvedExitHref = exitHref ?? `/batches/${batchId}`;
  const resolvedExitLabel = exitLabel ?? `batch_${batchId.slice(0, 8)}`;
  const [cursor, setCursor] = useState(initialCursor);
  // Optimistic decision overrides — keyed by midjourneyAssetId
  const [decisions, setDecisions] = useState<Record<string, MJReviewDecision>>(
    {},
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const total = summary.total;
  const item = items[cursor];

  const decisionFor = useCallback(
    (asset: ReviewItem): MJReviewDecision => {
      return decisions[asset.midjourneyAssetId] ?? asset.decision;
    },
    [decisions],
  );

  const decidedCount = items.reduce((acc, it) => {
    const d = decisionFor(it);
    if (d !== "UNDECIDED") return acc + 1;
    return acc;
  }, 0);
  const keptCount = items.reduce(
    (acc, it) => (decisionFor(it) === "KEPT" ? acc + 1 : acc),
    0,
  );
  // IA Phase 10 — undecided is the operator's "what's left?" anchor.
  const undecidedCount = items.length - decidedCount;

  const setDecision = useCallback(
    async (assetId: string, next: MJReviewDecision) => {
      setPending(assetId);
      // Optimistic
      setDecisions((prev) => ({ ...prev, [assetId]: next }));
      try {
        const res = await fetch(`/api/midjourney/assets/${assetId}/review`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision: next }),
        });
        if (!res.ok) {
          // Roll back on error
          setDecisions((prev) => {
            const copy = { ...prev };
            delete copy[assetId];
            return copy;
          });
        }
      } catch {
        setDecisions((prev) => {
          const copy = { ...prev };
          delete copy[assetId];
          return copy;
        });
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const goPrev = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
  }, []);
  const goNext = useCallback(() => {
    setCursor((c) => Math.min(items.length - 1, c + 1));
  }, [items.length]);

  // Keyboard navigation — uses real key events with input bypass
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!item) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        void setDecision(item.midjourneyAssetId, "KEPT");
        // auto-advance on decision (operator ergonomics — A4 spec)
        setTimeout(goNext, 80);
      } else if (key === "d") {
        e.preventDefault();
        void setDecision(item.midjourneyAssetId, "REJECTED");
        setTimeout(goNext, 80);
      } else if (key === "u" || e.key === "Z" || (e.shiftKey && key === "z")) {
        e.preventDefault();
        void setDecision(item.midjourneyAssetId, "UNDECIDED");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === "Escape") {
        if (helpOpen) {
          e.preventDefault();
          setHelpOpen(false);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [item, goNext, goPrev, helpOpen, setDecision]);

  if (!item) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1A1815] text-white/80">
        <h1 className="text-2xl font-semibold">No items in this batch</h1>
        <Link
          href={resolvedExitHref}
          className="mt-3 text-sm text-white/60 underline"
        >
          ← back
        </Link>
      </div>
    );
  }

  const currentDecision = decisionFor(item);
  const promptText = item.expandedPrompt ?? item.prompt;

  return (
    <div
      className="fixed inset-0 z-50 flex h-screen flex-col bg-[#1A1815] text-white/85"
      data-testid="batch-review-workspace"
      data-decision={currentDecision}
    >
      {/* Workspace bar */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/5 bg-[#16130F] px-5 py-3">
        <Link
          href={resolvedExitHref}
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {resolvedExitLabel}
        </Link>
        <span className="font-mono text-xs uppercase tracking-meta text-white/40">
          Review workspace
        </span>
        {/* IA Phase 10 — top-bar info hierarchy.
         *   Big row: "Item N / M" (operator's primary anchor — where
         *   am I?). Small mono row underneath: undecided count first
         *   and accented (the operator's "what's left?" question
         *   gets the loudest answer), then decided / kept as
         *   secondary counters. ProgressBar stays as a non-text
         *   companion so the visual share is still readable at a
         *   glance.
         */}
        <div className="flex flex-1 items-center justify-center gap-4">
          <div className="flex flex-col items-center leading-tight">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs uppercase tracking-meta text-white/40">
                Item
              </span>
              <span className="k-display text-xl font-semibold tabular-nums text-white">
                {cursor + 1}
                <span className="font-normal text-white/40"> / {total}</span>
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-xs uppercase tracking-meta">
              <span
                className={cn(
                  "tabular-nums",
                  undecidedCount > 0 ? "text-k-orange-bright" : "text-white/40",
                )}
                data-testid="topbar-undecided-count"
              >
                {undecidedCount} undecided
              </span>
              <span className="text-white/20">·</span>
              <span className="tabular-nums text-white/50">
                {decidedCount} decided
              </span>
              <span className="text-white/20">·</span>
              <span className="tabular-nums text-white/50">
                {keptCount} kept
              </span>
            </div>
          </div>
          <ProgressBar
            value={total > 0 ? (decidedCount / total) * 100 : 0}
            tone="orange"
            className="w-40"
            ariaLabel={`Review progress ${decidedCount}/${total}`}
          />
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/70 hover:border-white/20 hover:text-white"
          aria-label="Show shortcuts"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />?
        </button>
        <Link
          href={resolvedExitHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-white/20 hover:text-white"
        >
          <XIcon className="h-3.5 w-3.5" aria-hidden />
          Exit
        </Link>
      </div>

      {/* Main */}
      <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        {/* Stage */}
        <div className="flex flex-col overflow-hidden">
          <div className="relative flex flex-1 items-center justify-center p-10">
            <div className="relative max-h-full">
              <UserAssetThumb
                assetId={item.assetId}
                alt={`${item.variantKind} ${item.gridIndex}`}
                square
                className="!aspect-square w-full max-w-[760px] !rounded-lg !border-white/10 !bg-black/30 shadow-2xl"
              />
              <button
                type="button"
                onClick={goPrev}
                disabled={cursor === 0}
                aria-label="Previous"
                className="absolute -left-14 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={cursor === items.length - 1}
                aria-label="Next"
                className="absolute -right-14 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
              >
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex-shrink-0 px-10 pb-5">
            <div className="mx-auto grid max-w-[760px] grid-cols-4 gap-3">
              <ActionButton
                tone="reject"
                label="Discard"
                shortcut="D"
                pressed={currentDecision === "REJECTED"}
                disabled={!!pending}
                onClick={() =>
                  void setDecision(item.midjourneyAssetId, "REJECTED").then(goNext)
                }
                icon={<XIcon className="h-4 w-4" aria-hidden />}
              />
              <ActionButton
                tone="keep"
                label="Keep"
                shortcut="K"
                pressed={currentDecision === "KEPT"}
                disabled={!!pending}
                primary
                onClick={() =>
                  void setDecision(item.midjourneyAssetId, "KEPT").then(goNext)
                }
                icon={<Check className="h-4 w-4" aria-hidden />}
              />
              <ActionButton
                tone="undo"
                label="Reset"
                shortcut="U"
                pressed={false}
                disabled={!!pending || currentDecision === "UNDECIDED"}
                onClick={() =>
                  void setDecision(item.midjourneyAssetId, "UNDECIDED")
                }
                icon={<RotateCcw className="h-4 w-4" aria-hidden />}
              />
              <ActionButton
                tone="select"
                label="Selection"
                shortcut="S"
                pressed={false}
                disabled
                onClick={() => undefined}
                icon={<Layers className="h-4 w-4" aria-hidden />}
              />
            </div>
          </div>

          {/* Filmstrip */}
          <div className="flex-shrink-0 border-t border-white/5 bg-black/30 px-5 py-3">
            <Filmstrip
              items={items}
              cursor={cursor}
              onJump={(idx) => setCursor(idx)}
              decisionFor={decisionFor}
            />
          </div>
        </div>

        {/* Info rail */}
        <aside className="flex flex-col overflow-hidden border-l border-white/5 bg-[#1F1C18]">
          <div className="border-b border-white/5 p-5">
            <div className="font-mono text-xs uppercase tracking-meta text-white/40">
              Item
            </div>
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">
                {item.variantKind}
                {item.mjActionLabel ? ` ${item.mjActionLabel}` : ""}
              </h3>
              <DecisionPill decision={currentDecision} />
            </div>
            <div className="mt-1 font-mono text-xs text-white/40">
              grid {item.gridIndex} · imported{" "}
              {new Date(item.importedAt).toLocaleDateString("tr-TR")}
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <section>
              <div className="font-mono text-xs uppercase tracking-meta text-white/40">
                Prompt
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/75">
                {promptText || (
                  <span className="italic text-white/40">(no prompt)</span>
                )}
              </p>
            </section>
            {item.variables && Object.keys(item.variables).length > 0 ? (
              <section>
                <div className="font-mono text-xs uppercase tracking-meta text-white/40">
                  Variables
                </div>
                <ul className="mt-2 space-y-1.5">
                  {Object.entries(item.variables).map(([k, v]) => (
                    <li key={k} className="flex items-baseline gap-2 text-xs">
                      <span className="font-mono text-white/40">{k}</span>
                      <span className="text-white/75">{v}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {item.parentAssetId ? (
              <section>
                <div className="font-mono text-xs uppercase tracking-meta text-white/40">
                  Parent
                </div>
                <Link
                  href={`/library?parentAssetId=${item.parentAssetId}`}
                  className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-white/75 underline-offset-2 hover:underline"
                >
                  ↑ parent_{item.parentAssetId.slice(0, 8)}
                </Link>
              </section>
            ) : null}
          </div>

          {/* Shortcut legend */}
          <div className="flex-shrink-0 border-t border-white/5 bg-black/20 p-4">
            <div className="mb-3 font-mono text-xs uppercase tracking-meta text-white/40">
              Shortcuts
            </div>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
              <ShortcutRow keys="K" label="Keep" />
              <ShortcutRow keys="D" label="Discard" />
              <ShortcutRow keys="←  →" label="Prev / Next" />
              <ShortcutRow keys="U" label="Reset" />
              <ShortcutRow keys="?" label="All shortcuts" />
              <ShortcutRow keys="S" label="Selection" muted />
            </div>
          </div>
        </aside>
      </div>

      {/* Help modal — opens with `?` */}
      {helpOpen ? (
        <Modal
          title="Review shortcuts"
          onClose={() => setHelpOpen(false)}
          size="md"
          dark
        >
          <ul className="space-y-2 text-sm">
            <ShortcutHelpRow keys="K" label="Keep current item (auto-advance)" />
            <ShortcutHelpRow
              keys="D"
              label="Discard / reject (auto-advance)"
            />
            <ShortcutHelpRow keys="U" label="Reset to undecided" />
            <ShortcutHelpRow keys="←  /  →" label="Prev / Next item" />
            <ShortcutHelpRow keys="?" label="Show this card" />
            <ShortcutHelpRow keys="Esc" label="Close help / dialogs" />
            <ShortcutHelpRow
              keys="S"
              label="Add to Selection (lands in rollout-4)"
              muted
            />
            <ShortcutHelpRow
              keys="R"
              label="Re-roll (lands in rollout-3.5)"
              muted
            />
          </ul>
        </Modal>
      ) : null}
    </div>
  );
}

function ActionButton({
  tone,
  label,
  shortcut,
  pressed,
  disabled,
  onClick,
  icon,
  primary,
}: {
  tone: "keep" | "reject" | "undo" | "select";
  label: string;
  shortcut: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  // IA Phase 10 — Keep button visual state bug fix. Önceden `primary`
  // her zaman orange-border + orange-fill render ediyordu (pressed
  // kontrolünden bağımsız), bu yüzden Keep butonu henüz tıklanmasa
  // bile selected görünüyordu. Doğru davranış: idle → plain
  // (border-white/10 + bg-white/5), pressed → orange decision-confirm
  // fill. Reject için aynı pattern danger toneuyla.
  const idleClasses = "border-white/10 bg-white/5 hover:bg-white/10";
  const keepPressedClasses =
    "border-2 border-k-orange bg-k-orange/20 hover:bg-k-orange/30";
  const rejectPressedClasses = "border-danger/50 bg-danger/15";
  const undoPressedClasses = "border-white/30 bg-white/15";
  const containerClasses = pressed
    ? primary || tone === "keep"
      ? keepPressedClasses
      : tone === "reject"
        ? rejectPressedClasses
        : undoPressedClasses
    : idleClasses;
  const iconColor =
    pressed && (primary || tone === "keep")
      ? "text-k-orange-bright"
      : pressed && tone === "reject"
        ? "text-danger"
        : "text-white/70";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      data-pressed={pressed || undefined}
      data-tone={tone}
      className={cn(
        "flex h-16 flex-col items-center justify-center gap-1.5 rounded-xl border transition-colors disabled:opacity-40",
        containerClasses,
      )}
    >
      <div className="flex items-center gap-2">
        <span className={iconColor}>{icon}</span>
        <span
          className={cn(
            "text-sm font-medium",
            pressed ? "text-white" : "text-white/85",
          )}
        >
          {label}
        </span>
      </div>
      <kbd className="inline-flex h-5 min-w-[22px] items-center justify-center rounded border border-white/10 bg-white/5 px-1.5 font-mono text-xs text-white/70">
        {shortcut}
      </kbd>
    </button>
  );
}

function Filmstrip({
  items,
  cursor,
  onJump,
  decisionFor,
}: {
  items: ReviewItem[];
  cursor: number;
  onJump: (idx: number) => void;
  decisionFor: (item: ReviewItem) => MJReviewDecision;
}) {
  // Render a window of ~9 items centred on cursor
  const windowSize = 9;
  const start = Math.max(0, cursor - 4);
  const end = Math.min(items.length, start + windowSize);
  const slice: Array<{ idx: number; item: ReviewItem }> = [];
  for (let i = start; i < end; i++) {
    const it = items[i];
    if (it) slice.push({ idx: i, item: it });
  }
  return (
    <div className="flex items-center gap-2 overflow-hidden">
      {slice.map(({ idx, item }) => {
        const dec = decisionFor(item);
        return (
          <button
            key={item.midjourneyAssetId}
            type="button"
            onClick={() => onJump(idx)}
            className={cn(
              "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition-all",
              idx === cursor
                ? "scale-105 border-k-orange shadow-lg shadow-k-orange/30"
                : "border-transparent opacity-50 hover:opacity-90",
            )}
            aria-label={`Jump to item ${idx + 1}`}
          >
            <UserAssetThumb
              assetId={item.assetId}
              alt={`item ${idx + 1}`}
              square
              className="h-full w-full !rounded-none !border-0 !bg-black/40"
            />
            {dec === "KEPT" ? (
              <span className="absolute right-1 top-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-success text-[8px] font-bold text-white">
                ✓
              </span>
            ) : dec === "REJECTED" ? (
              <span className="absolute right-1 top-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-danger text-[8px] font-bold text-white">
                ✕
              </span>
            ) : null}
            <span className="absolute bottom-0.5 left-1 font-mono text-[9px] text-white/80">
              {idx + 1}
            </span>
          </button>
        );
      })}
      <div className="flex-1" />
      <span className="whitespace-nowrap font-mono text-xs uppercase tracking-meta text-white/40">
        virtualized · {items.length} items
      </span>
    </div>
  );
}

function DecisionPill({ decision }: { decision: MJReviewDecision }) {
  if (decision === "KEPT") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
        <Check className="h-3 w-3" aria-hidden />
        Kept
      </span>
    );
  }
  if (decision === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
        <XIcon className="h-3 w-3" aria-hidden />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-mono text-xs uppercase tracking-meta text-white/60">
      Pending
    </span>
  );
}

function ShortcutRow({
  keys,
  label,
  muted,
}: {
  keys: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", muted && "opacity-50")}>
      <span className="inline-flex min-w-[28px] items-center justify-center rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-center font-mono text-xs text-white/80">
        {keys}
      </span>
      <span className="text-white/60">{label}</span>
    </div>
  );
}

function ShortcutHelpRow({
  keys,
  label,
  muted,
}: {
  keys: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3",
        muted && "opacity-50",
      )}
    >
      <span className="text-text-muted">{label}</span>
      <kbd className="inline-flex h-6 min-w-[28px] items-center justify-center rounded border border-line-strong bg-paper px-2 font-mono text-xs text-ink-2">
        {keys}
      </kbd>
    </li>
  );
}
