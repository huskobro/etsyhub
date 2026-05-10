/* eslint-disable no-restricted-syntax */
// ReviewWorkspaceShell — IA Phase 11 (review experience completion).
//
// One canonical fullscreen workspace layout shared by both review
// surfaces:
//
//   • BatchReviewWorkspace (MidjourneyAsset, /api/midjourney/.../review)
//   • QueueReviewWorkspace  (GeneratedDesign / LocalLibraryAsset,
//                            /api/review/decisions)
//
// The shell owns the layout, keyboard map, top-bar info hierarchy,
// stage chrome, action bar, filmstrip window, info rail container, and
// help modal. Source-specific concerns are passed in as adapter
// props:
//
//   • renderStage(item)        — preview thumb (UserAssetThumb / <img>)
//   • renderInfoRail(item, …)  — source-aware metadata block
//   • filmstripDecisionFor(it) — canonical decision for filmstrip tone
//   • filmstripThumb(it)       — { thumbnailUrl } for the strip cell
//   • onDecide(item, next)     — write the decision (mutation)
//
// Decision axis is canonical operator (KEPT / REJECTED / UNDECIDED) —
// QueueReviewWorkspace maps from ReviewStatus on the way in/out.
//
// The hardcoded hex sabitleri (#1A1815 / #16130F / #1F1C18) and the
// max-w-[760px] stage are part of the v4/A4 spec; whitelisted in
// scripts/check-tokens.ts under both workspace consumers.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HelpCircle,
  RotateCcw,
  X as XIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Modal } from "@/features/library/components/Modal";

/** Canonical operator decision axis used across the shell. Both
 *  surfaces map to this — MJReviewDecision is already in this shape;
 *  ReviewStatus collapses APPROVED → KEPT, REJECTED → REJECTED, and
 *  PENDING / NEEDS_REVIEW → UNDECIDED. */
export type CanonicalDecision = "UNDECIDED" | "KEPT" | "REJECTED";

export interface ReviewWorkspaceShellProps<TItem> {
  // ── Workspace chrome ────────────────────────────────────────────────
  /** Where Exit + back-link send the operator. */
  exitHref: string;
  /** Visible label in the back-link chip. */
  exitLabel: string;
  /** Mono uppercase scope caption next to the back link. */
  scopeLabel: string;
  /**
   * IA Phase 12 — workspace anchor (CLAUDE.md Madde H). Shown as the
   * primary number in the top bar regardless of which scope the
   * operator is in. Resolves on the server (queries all sources).
   */
  totalReviewPending?: number;
  /**
   * IA Phase 12 — scope-completion auto-progress. Pointer to the
   * next pending scope (batch / folder) for the same user. Null
   * when nothing else is pending — shell shows "All caught up" CTA.
   */
  nextScope?: {
    href: string;
    label: string;
    /** "batch" / "folder" / "queue" — drives the icon hint on the
     *  CTA. */
    kind: "batch" | "folder" | "queue";
  } | null;

  // ── Items + cursor ──────────────────────────────────────────────────
  items: TItem[];
  cursor: number;
  /** Called when the operator clicks a filmstrip thumb. */
  onJumpToCursor: (idx: number) => void;
  /** Total across all pages (queue mode); falls back to items.length
   *  when omitted. Surface in the sub-line as "page N / M". */
  pageInfo?: { page: number; total: number };

  // ── Boundary navigation ─────────────────────────────────────────────
  canGoPrev: boolean;
  canGoNext: boolean;
  onGoPrev: () => void | Promise<void>;
  onGoNext: () => void | Promise<void>;

  // ── Counts (operator's "what's left?" block) ────────────────────────
  /** Kept / Discarded / Undecided breakdown for the current scope.
   *  IA Phase 12 — top-bar surfaces these three (decided dropped as
   *  redundant; kept + discarded = decided). */
  keptCount: number;
  /** Renamed from "rejected" for the user-facing copy ("Discard"
   *  button → "discarded" count). */
  discardedCount: number;
  undecidedCount: number;
  /** IA Phase 12 — current-scope progress bar. Per CLAUDE.md the
   *  bar tracks the active scope (batch / folder / queue), not
   *  the workspace-wide total. Adapter passes scope total. */
  progressTotal?: number;

  // ── Source-specific render slots ────────────────────────────────────
  /** Returns the stage preview element (typically a UserAssetThumb or
   *  an <img>). The shell wraps it in the canonical max-w-[760px]
   *  square frame. */
  renderStage: (item: TItem) => ReactNode;
  /** Source-aware info-rail content. The shell handles header (item
   *  title + decision pill) — the adapter renders metadata blocks. */
  renderInfoRail: (
    item: TItem,
    decision: CanonicalDecision,
  ) => ReactNode;
  /** Adapter-side title (top of info rail header). */
  itemTitle: (item: TItem) => string;
  /** Filmstrip tone resolver. */
  filmstripDecisionFor: (item: TItem) => CanonicalDecision;
  /** Filmstrip cell thumbnail. */
  filmstripThumb: (item: TItem) => { thumbnailUrl: string | null };
  /** Stable id for keys / aria labels. */
  itemId: (item: TItem) => string;
  /** Operator override flag (USER source). When non-null + canonical
   *  decision != UNDECIDED, Reset becomes available. */
  itemOverride?: (item: TItem) => boolean;

  // ── Decision write ──────────────────────────────────────────────────
  /** Active decision for the current item (keep button pressed
   *  reflects this). */
  currentDecision: CanonicalDecision;
  /** Write the decision. Shell calls onGoNext() 80ms after success
   *  (auto-advance ergonomics matching the A4 spec). */
  onDecide: (item: TItem, next: CanonicalDecision) => Promise<void> | void;
  /** True while a decision is being persisted — disables the action
   *  bar. */
  isPending: boolean;
  /** Inline error caption beneath the action bar. Caller clears it
   *  when appropriate. */
  errorMessage: string | null;
  /** Whether Reset is available for the current item. */
  resetEnabled: boolean;
  /** Called when Reset is clicked (canonical UNDECIDED write). */
  onReset: () => void;

  // ── Test affordance ─────────────────────────────────────────────────
  testId?: string;
  dataAttributes?: Record<string, string | undefined>;
}

const AUTO_ADVANCE_MS = 80;

export function ReviewWorkspaceShell<TItem>({
  exitHref,
  exitLabel,
  scopeLabel,
  totalReviewPending,
  nextScope,
  items,
  cursor,
  onJumpToCursor,
  pageInfo,
  canGoPrev,
  canGoNext,
  onGoPrev,
  onGoNext,
  keptCount,
  discardedCount,
  undecidedCount,
  progressTotal,
  renderStage,
  renderInfoRail,
  itemTitle,
  filmstripDecisionFor,
  filmstripThumb,
  itemId,
  currentDecision,
  onDecide,
  isPending,
  errorMessage,
  resetEnabled,
  onReset,
  testId = "review-workspace-shell",
  dataAttributes,
}: ReviewWorkspaceShellProps<TItem>) {
  const [helpOpen, setHelpOpen] = useState(false);
  const item = items[cursor] ?? null;
  const total = items.length;
  const decidedCount = keptCount + discardedCount;
  const denom = progressTotal ?? total;
  // IA Phase 12 — scope-completion detection. When the active scope
  // has items but every one is decided, switch to the completion
  // banner instead of the regular item navigator.
  const scopeComplete = total > 0 && undecidedCount === 0;

  const decideAndAdvance = useCallback(
    async (next: CanonicalDecision) => {
      if (!item) return;
      try {
        await onDecide(item, next);
      } catch {
        return; // caller surfaces the error; we don't auto-advance
      }
      // Auto-advance only on commits (Keep / Reject), never on Reset.
      if (next === "KEPT" || next === "REJECTED") {
        setTimeout(() => {
          void onGoNext();
        }, AUTO_ADVANCE_MS);
      }
    },
    [item, onDecide, onGoNext],
  );

  // ── Keyboard map ────────────────────────────────────────────────────
  // K=Keep · D=Discard · U=Reset · ←/→=Prev/Next · ?=Help · Esc=Exit/help
  // Input/textarea bypass — operator must be able to type in any popup
  // input the adapter mounts (none today, but the rule belongs here).
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
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        void decideAndAdvance("KEPT");
      } else if (key === "d") {
        e.preventDefault();
        void decideAndAdvance("REJECTED");
      } else if (key === "u" || (e.shiftKey && key === "z")) {
        e.preventDefault();
        if (resetEnabled) onReset();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (canGoPrev) void onGoPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (canGoNext) void onGoNext();
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
  }, [
    decideAndAdvance,
    canGoPrev,
    canGoNext,
    onGoPrev,
    onGoNext,
    resetEnabled,
    onReset,
    helpOpen,
  ]);

  // ── Empty state ─────────────────────────────────────────────────────
  if (!item) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1A1815] text-white/80"
        data-testid={testId}
        data-state="empty"
      >
        <h1 className="text-2xl font-semibold">No items in scope</h1>
        <Link
          href={exitHref}
          className="mt-3 text-sm text-white/60 underline"
        >
          ← back
        </Link>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex h-screen flex-col bg-[#1A1815] text-white/85"
      data-testid={testId}
      data-decision={currentDecision}
      {...(dataAttributes ?? {})}
    >
      {/* ── Workspace bar — IA Phase 13 hierarchy ──────────────────────
       *   CLAUDE.md Madde M: scope summary primary, total pending
       *   secondary (small caption on the right). Phase 12 had the
       *   total pending as the workspace anchor; operators reported
       *   that number competing with the scope summary on batch
       *   focus pages — the global queue count next to a small
       *   batch summary is misleading. Phase 13 swaps the priority:
       *   scope summary is now the loud line, total pending is a
       *   muted "Queue · 273 review pending" caption next to the
       *   progress bar.
       *
       *   1. Primary (largest, accent on undecided > 0):
       *        "Batch · cmoqxxx · 22 undecided · 4 kept · 2 discarded"
       *      Three sayım always: undecided / kept / discarded.
       *   2. Bookkeeping (small mono):
       *        "Item 8 / 24 · Page 2 / 11"
       *   3. Secondary right (small mono, after progress bar):
       *        "Queue · 273 review pending"
       *      Operator's "kaç toplam iş var" answer — present, but
       *      never competing with the scope summary.
       *   4. ProgressBar: current scope progress.
       */}
      <div className="flex flex-shrink-0 items-center gap-4 border-b border-white/5 bg-[#16130F] px-5 py-3">
        <Link
          href={exitHref}
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {exitLabel}
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center leading-tight">
          {/* 1. Primary — scope summary three-count breakdown */}
          <div
            className="flex items-center gap-2 font-mono text-sm uppercase tracking-meta"
            data-testid="topbar-scope-summary"
          >
            <span className="font-medium text-white/85">{scopeLabel}</span>
            <span className="text-white/20">·</span>
            <span
              className={cn(
                "tabular-nums",
                undecidedCount > 0
                  ? "text-k-orange-bright"
                  : "text-white/40",
              )}
              data-testid="topbar-undecided-count"
            >
              {undecidedCount} undecided
            </span>
            <span className="text-white/20">·</span>
            <span className="tabular-nums text-white/60">
              {keptCount} kept
            </span>
            <span className="text-white/20">·</span>
            <span className="tabular-nums text-white/60">
              {discardedCount} discarded
            </span>
          </div>

          {/* 2. Bookkeeping line */}
          {item ? (
            <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-meta text-white/40">
              <span className="tabular-nums">
                Item {cursor + 1} / {total}
              </span>
              {pageInfo ? (
                <>
                  <span className="text-white/20">·</span>
                  <span className="tabular-nums">
                    Page {pageInfo.page} / {pageInfo.total}
                  </span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <ProgressBar
          value={denom > 0 ? (decidedCount / denom) * 100 : 0}
          tone="orange"
          className="w-40"
          ariaLabel={`Scope progress ${decidedCount}/${denom}`}
        />

        {/* 3. Secondary right — workspace-wide queue total. Muted
         *   mono caption; never competes with the scope summary. */}
        {typeof totalReviewPending === "number" ? (
          <div
            className="flex items-baseline gap-1.5 font-mono text-[10.5px] uppercase tracking-meta text-white/40"
            data-testid="topbar-total-pending"
          >
            <span className="text-white/30">Queue</span>
            <span className="text-white/20">·</span>
            <span
              className={cn(
                "tabular-nums",
                totalReviewPending > 0 ? "text-white/70" : "text-white/30",
              )}
            >
              {totalReviewPending}
            </span>
            <span className="text-white/30">pending</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/70 hover:border-white/20 hover:text-white"
          aria-label="Show shortcuts"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />?
        </button>
        <Link
          href={exitHref}
          data-testid="review-workspace-exit"
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-white/20 hover:text-white"
        >
          <XIcon className="h-3.5 w-3.5" aria-hidden />
          Exit
        </Link>
      </div>

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        {/* Stage column */}
        <div className="flex flex-col overflow-hidden">
          <div className="relative flex flex-1 items-center justify-center p-10">
            {scopeComplete ? (
              <ScopeCompletionCard
                keptCount={keptCount}
                discardedCount={discardedCount}
                scopeLabel={scopeLabel}
                nextScope={nextScope ?? null}
              />
            ) : (
              <div className="relative max-h-full">
                <div className="aspect-square w-full max-w-[760px] overflow-hidden rounded-lg border border-white/10 bg-black/30 shadow-2xl">
                  {renderStage(item)}
                </div>
                <button
                  type="button"
                  onClick={() => void onGoPrev()}
                  disabled={!canGoPrev}
                  aria-label="Previous"
                  data-testid="review-workspace-prev"
                  className="absolute -left-14 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void onGoNext()}
                  disabled={!canGoNext}
                  aria-label="Next"
                  data-testid="review-workspace-next"
                  className="absolute -right-14 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
          </div>

          {/* Action bar hidden when scope is complete — operator
           *   can't decide further, the next-scope CTA in the
           *   completion card is the only forward action. */}
          {scopeComplete ? null : (
          <>
          {/* Action bar — IA Phase 12 order + label revision.
           *   Order: Keep · Undecided · Discard (CLAUDE.md Madde H —
           *   "decide" is the gate, "discard" is the negative outcome,
           *   "undecided" is the safe middle). Label "Reset" → "Undecided"
           *   so the operator reads the action by its decision axis,
           *   not by its UI verb. Shortcut U preserved. */}
          <div className="flex-shrink-0 px-10 pb-5">
            <div className="mx-auto grid max-w-[760px] grid-cols-3 gap-3">
              <ActionButton
                tone="keep"
                label="Keep"
                shortcut="K"
                pressed={currentDecision === "KEPT"}
                disabled={isPending}
                onClick={() => void decideAndAdvance("KEPT")}
                icon={<Check className="h-4 w-4" aria-hidden />}
              />
              <ActionButton
                tone="undo"
                label="Undecided"
                shortcut="U"
                pressed={currentDecision === "UNDECIDED"}
                disabled={isPending || !resetEnabled}
                onClick={onReset}
                icon={<RotateCcw className="h-4 w-4" aria-hidden />}
              />
              <ActionButton
                tone="reject"
                label="Discard"
                shortcut="D"
                pressed={currentDecision === "REJECTED"}
                disabled={isPending}
                onClick={() => void decideAndAdvance("REJECTED")}
                icon={<XIcon className="h-4 w-4" aria-hidden />}
              />
            </div>
            {errorMessage ? (
              <p
                role="alert"
                data-testid="review-workspace-error"
                className="mt-2 text-center text-xs text-rose-300"
              >
                {errorMessage}
              </p>
            ) : null}
          </div>
          </>
          )}

          {/* Filmstrip */}
          <div className="flex-shrink-0 border-t border-white/5 bg-black/30 px-5 py-3">
            <Filmstrip
              items={items}
              cursor={cursor}
              onJump={onJumpToCursor}
              decisionFor={filmstripDecisionFor}
              thumbFor={filmstripThumb}
              itemId={itemId}
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
                {itemTitle(item)}
              </h3>
              <DecisionPill decision={currentDecision} />
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {renderInfoRail(item, currentDecision)}
          </div>

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
              <ShortcutRow keys="Esc" label="Close help" />
            </div>
          </div>
        </aside>
      </div>

      {helpOpen ? (
        <Modal
          title="Review shortcuts"
          onClose={() => setHelpOpen(false)}
          size="md"
          dark
        >
          <ul className="space-y-2 text-sm">
            <ShortcutHelpRow keys="K" label="Keep current item (auto-advance)" />
            <ShortcutHelpRow keys="D" label="Discard / reject (auto-advance)" />
            <ShortcutHelpRow
              keys="U"
              label="Reset to undecided (only when status is operator)"
            />
            <ShortcutHelpRow keys="←  /  →" label="Prev / Next item" />
            <ShortcutHelpRow keys="?" label="Show this card" />
            <ShortcutHelpRow keys="Esc" label="Close help / dialogs" />
          </ul>
        </Modal>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Shared presentational primitives
// ────────────────────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-xs uppercase tracking-meta text-white/40">
      {children}
    </div>
  );
}

function DecisionPill({ decision }: { decision: CanonicalDecision }) {
  const className =
    decision === "KEPT"
      ? "bg-emerald-500/15 text-emerald-300"
      : decision === "REJECTED"
        ? "bg-rose-500/15 text-rose-300"
        : "bg-white/5 text-white/70";
  const label =
    decision === "KEPT"
      ? "Kept"
      : decision === "REJECTED"
        ? "Rejected"
        : "Undecided";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {label}
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
    <div
      className={cn(
        "flex items-center gap-2 text-xs",
        muted && "opacity-50",
      )}
    >
      <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-white/85">
        {keys}
      </kbd>
      <span className="text-white/60">{label}</span>
    </div>
  );
}

function ShortcutHelpRow({
  keys,
  label,
}: {
  keys: string;
  label: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <kbd className="rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-xs text-white/85">
        {keys}
      </kbd>
      <span className="flex-1 text-white/75">{label}</span>
    </li>
  );
}

// ────────────────────────────────────────────────────────────────────────
// ActionButton — IA Phase 10 bug-fixed pressed-only fill
// ────────────────────────────────────────────────────────────────────────
//
// Pre-fix: `primary=true` (Keep) rendered orange-border + orange-fill
// regardless of `pressed`, so the operator saw a "pre-selected" Keep on
// every undecided item. Now idle is plain across all tones; pressed
// adds the canonical orange (Keep) / danger (Reject) fill.

function ActionButton({
  tone,
  label,
  shortcut,
  pressed,
  disabled,
  onClick,
  icon,
}: {
  tone: "keep" | "reject" | "undo";
  label: string;
  shortcut: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  const idle = "border-white/10 bg-white/5 hover:bg-white/10";
  const keepPressed =
    "border-2 border-k-orange bg-k-orange/20 hover:bg-k-orange/30";
  const rejectPressed = "border-danger/50 bg-danger/15";
  const containerClasses = pressed
    ? tone === "keep"
      ? keepPressed
      : tone === "reject"
        ? rejectPressed
        : "border-white/30 bg-white/15"
    : idle;
  const iconColor =
    pressed && tone === "keep"
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

// ────────────────────────────────────────────────────────────────────────
// Filmstrip — generic over TItem
// ────────────────────────────────────────────────────────────────────────

function Filmstrip<TItem>({
  items,
  cursor,
  onJump,
  decisionFor,
  thumbFor,
  itemId,
}: {
  items: TItem[];
  cursor: number;
  onJump: (idx: number) => void;
  decisionFor: (item: TItem) => CanonicalDecision;
  thumbFor: (item: TItem) => { thumbnailUrl: string | null };
  itemId: (item: TItem) => string;
}) {
  if (items.length === 0) return null;
  // 9-item window centred on cursor (A4 spec).
  const windowSize = 9;
  const start = Math.max(0, Math.min(items.length - windowSize, cursor - 4));
  const end = Math.min(items.length, start + windowSize);
  const visible = items.slice(start, end);
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs uppercase tracking-meta text-white/40">
        {items.length} items
      </span>
      <div className="flex flex-1 items-center justify-center gap-1.5 overflow-hidden">
        {visible.map((it, localIdx) => {
          const realIdx = start + localIdx;
          const isCursor = realIdx === cursor;
          const dec = decisionFor(it);
          const tone =
            dec === "KEPT"
              ? "bg-emerald-500/20 ring-emerald-500/60"
              : dec === "REJECTED"
                ? "bg-rose-500/20 ring-rose-500/60"
                : "bg-white/5 ring-white/10";
          const thumb = thumbFor(it);
          return (
            <button
              key={itemId(it)}
              type="button"
              onClick={() => onJump(realIdx)}
              className={cn(
                "h-10 w-10 overflow-hidden rounded ring-1",
                tone,
                isCursor && "ring-2 ring-white",
              )}
              aria-label={`Jump to item ${realIdx + 1}`}
              data-testid="filmstrip-thumb"
              data-active={isCursor || undefined}
            >
              {thumb.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={thumb.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// ScopeCompletionCard — IA Phase 12 scope-completion banner
// ────────────────────────────────────────────────────────────────────────
//
// Shown in place of the stage when the active scope (batch / folder /
// queue) has every item decided. Operator never silently teleports;
// the card explicitly says "this scope is done" and offers an action:
//   • nextScope present → "Continue with next scope" CTA
//   • nextScope null    → "All caught up" copy + Exit (banner only,
//                         no CTA — operator clicks Exit in top bar)

function ScopeCompletionCard({
  keptCount,
  discardedCount,
  scopeLabel,
  nextScope,
}: {
  keptCount: number;
  discardedCount: number;
  scopeLabel: string;
  nextScope: {
    href: string;
    label: string;
    kind: "batch" | "folder" | "queue";
  } | null;
}) {
  return (
    <div
      className="flex w-full max-w-[640px] flex-col items-center justify-center gap-5 rounded-lg border border-white/10 bg-black/30 px-10 py-12 text-center shadow-2xl"
      data-testid="scope-completion-card"
    >
      <div className="font-mono text-xs uppercase tracking-meta text-white/40">
        {scopeLabel}
      </div>
      <h2 className="k-display text-2xl font-semibold text-white">
        Scope complete
      </h2>
      <p className="font-mono text-xs uppercase tracking-meta text-white/60">
        <span className="tabular-nums text-white/85">{keptCount} kept</span>
        <span className="mx-2 text-white/20">·</span>
        <span className="tabular-nums text-white/85">
          {discardedCount} discarded
        </span>
      </p>
      {nextScope ? (
        <Link
          href={nextScope.href}
          data-testid="scope-completion-next"
          className="inline-flex items-center gap-2 rounded-md border border-k-orange bg-k-orange/15 px-4 py-2 text-sm font-medium text-white hover:bg-k-orange/25"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
          {nextScope.kind === "batch"
            ? "Continue with next batch"
            : nextScope.kind === "folder"
              ? "Continue with next folder"
              : "Continue with review queue"}
          <span className="font-mono text-xs uppercase tracking-meta text-white/70">
            {nextScope.label}
          </span>
        </Link>
      ) : (
        <p
          data-testid="scope-completion-all-caught-up"
          className="text-sm text-white/70"
        >
          All caught up — no other scopes pending review.
        </p>
      )}
    </div>
  );
}
