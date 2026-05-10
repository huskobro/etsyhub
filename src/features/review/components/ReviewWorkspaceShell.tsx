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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
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
  /**
   * IA Phase 14 — true scope total (folder / batch'teki tüm item
   * sayısı). Queue mode'da `data.total` (cross-page); batch mode'da
   * batch'in tüm item sayısı. `items.length` page-size'a kadar olan
   * cache window'u, kullanıcıya scope cardinality olarak verilemez
   * (CLAUDE.md Madde M). Omitted ise items.length fallback (single-
   * scope all-loaded senaryosu).
   */
  scopeTotal?: number;

  // ── Boundary navigation ─────────────────────────────────────────────
  canGoPrev: boolean;
  canGoNext: boolean;
  onGoPrev: () => void | Promise<void>;
  onGoNext: () => void | Promise<void>;
  /** IA Phase 18+19 — scope navigation (CLAUDE.md Madde M, scope
   *  ekseni). Optional; when defined the shell wires up `,` / `.`
   *  keyboard shortcuts and the right-panel shortcut row. Adapter
   *  resolves prev/next scope (folder/batch/reference) and renders
   *  the href via routing on click. */
  scopeNav?: {
    prev: { href: string; label: string } | null;
    next: { href: string; label: string } | null;
  };
  /** IA Phase 19 — scope picker (CLAUDE.md Madde M unified review
   *  experience). Top-bar dropdown lists pending scopes of the
   *  active kind so operators can jump directly. */
  scopePicker?: {
    kind: "folder" | "reference" | "batch";
    activeId: string | null;
    entries: Array<{
      id: string;
      label: string;
      pendingCount: number;
      href: string;
    }>;
  };

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
  scopeTotal,
  canGoPrev,
  canGoNext,
  onGoPrev,
  onGoNext,
  scopeNav,
  scopePicker,
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
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const item = items[cursor] ?? null;
  // IA Phase 14 — `total` artık scope-total: queue mode'da
  // tüm filtreli scope item sayısı, batch mode'da batch toplam.
  // items.length yalnızca cache window (~24); top-bar'da `Item N / M`
  // M'sini scopeTotal ile gösterir.
  const total = scopeTotal ?? items.length;
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
  // K=Keep · D=Discard · U=Reset · ←/→=Prev/Next item · ,/.=Prev/Next
  //   scope · Esc=Exit (or close help) · ?=Help
  // CLAUDE.md Madde M: `,` / `.` chosen over `[` / `]` because the
  // bracket keys are common in HTML/markdown text input and create
  // operator confusion when shortcuts and form inputs share screen.
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
      } else if (e.key === "," || e.code === "Comma") {
        // CLAUDE.md Madde M scope ekseni. Both `e.key` and `e.code`
        // checked — Turkish/AZERTY/QWERTZ layouts can route the
        // physical comma key through different `e.key` values
        // depending on modifier state.
        e.preventDefault();
        if (scopeNav?.prev) router.push(scopeNav.prev.href);
      } else if (e.key === "." || e.code === "Period") {
        e.preventDefault();
        if (scopeNav?.next) router.push(scopeNav.next.href);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === "Escape") {
        // Esc closes the help modal first; otherwise exits the focus
        // workspace back to the queue/grid context.
        if (helpOpen) {
          e.preventDefault();
          setHelpOpen(false);
          return;
        }
        e.preventDefault();
        router.push(exitHref);
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
    scopeNav,
    router,
    exitHref,
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
      // CLAUDE.md Madde P — stable interaction surfaces. select-none
      // kills accidental text selection from double-clicks and drag
      // sweeps; readable text containers (info-rail dl, summary
      // paragraph) opt back in via select-text class.
      className="fixed inset-0 z-50 flex h-screen flex-col bg-[#1A1815] text-white/85 select-none"
      data-testid={testId}
      data-decision={currentDecision}
      onDoubleClick={(e) => {
        // Defensive: even with select-none, double-click on focusable
        // children can still produce a selection range. Prevent the
        // default unless the click landed on an editable surface.
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
      }}
      {...(dataAttributes ?? {})}
    >
      {/* ── Workspace bar — IA Phase 14 horizontal hierarchy ───────────
       *   Phase 13 had scope summary primary + queue caption secondary,
       *   but with long folder names / batch ids the scope summary
       *   wrapped over 4-5 vertical rows and pushed the bar tall.
       *   Phase 14 keeps the bar **single-row horizontal**:
       *
       *     [Exit] [scope label · truncate] | total pending anchor |
       *       [N undecided · K kept · D discarded] | Item N/M |
       *       progress bar | Help / Exit
       *
       *   Scope label truncates with a tooltip; the three-count summary
       *   stays on one line; page index dropped (CLAUDE.md Madde M —
       *   page bilgisi top-bar'da ana bilgi değildir, scope-içi cursor
       *   yeterli). Total pending is the workspace anchor again —
       *   operator's "ne kadar iş kaldı" question gets the loudest
       *   answer, then scope-specific counts.
       */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-white/5 bg-[#16130F] px-5">
        <Link
          href={exitHref}
          className="inline-flex shrink-0 items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {exitLabel}
        </Link>

        {/* Scope label — truncates with tooltip */}
        <span
          className="min-w-0 max-w-[28ch] truncate font-mono text-xs uppercase tracking-meta text-white/50"
          title={scopeLabel}
          data-testid="topbar-scope-label"
        >
          {scopeLabel}
        </span>

        <div className="h-6 w-px bg-white/10" aria-hidden />

        {/* Total review pending — workspace anchor */}
        {typeof totalReviewPending === "number" ? (
          <div
            className="flex shrink-0 items-baseline gap-1.5"
            data-testid="topbar-total-pending"
          >
            <span
              className={cn(
                "k-display text-lg font-semibold tabular-nums",
                totalReviewPending > 0
                  ? "text-k-orange-bright"
                  : "text-white/40",
              )}
            >
              {totalReviewPending}
            </span>
            <span className="font-mono text-xs uppercase tracking-meta text-white/50">
              review pending
            </span>
          </div>
        ) : null}

        <div className="h-6 w-px bg-white/10" aria-hidden />

        {/* Scope summary three-count breakdown */}
        <div
          className="flex shrink-0 items-center gap-2 font-mono text-xs uppercase tracking-meta"
          data-testid="topbar-scope-summary"
        >
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

        {/* Active item index — scope-internal cursor (no page) */}
        {item ? (
          <>
            <div className="h-6 w-px bg-white/10" aria-hidden />
            <span className="shrink-0 font-mono text-xs uppercase tracking-meta tabular-nums text-white/40">
              Item {cursor + 1} / {total}
            </span>
          </>
        ) : null}

        <div className="flex-1" />

        <ProgressBar
          value={denom > 0 ? (decidedCount / denom) * 100 : 0}
          tone="orange"
          className="w-32 shrink-0"
          ariaLabel={`Scope progress ${decidedCount}/${denom}`}
        />

        {scopeNav?.prev || scopeNav?.next || scopePicker ? (
          <div
            className="flex items-center gap-1"
            data-testid="scope-nav-controls"
          >
            <Link
              href={scopeNav?.prev?.href ?? "#"}
              aria-label={
                scopeNav?.prev
                  ? `Previous ${scopePicker?.kind ?? "scope"}: ${scopeNav.prev.label}`
                  : `No previous ${scopePicker?.kind ?? "scope"}`
              }
              data-testid="scope-nav-prev"
              data-disabled={scopeNav?.prev ? undefined : "true"}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 font-mono text-[10.5px] uppercase tracking-meta",
                scopeNav?.prev
                  ? "text-white/70 hover:border-white/20 hover:text-white"
                  : "pointer-events-none text-white/25",
              )}
              title={scopeNav?.prev ? scopeNav.prev.label : `No previous ${scopePicker?.kind ?? "scope"}`}
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              prev
            </Link>
            {scopePicker ? <ScopePickerDropdown picker={scopePicker} /> : null}
            <Link
              href={scopeNav?.next?.href ?? "#"}
              aria-label={
                scopeNav?.next
                  ? `Next ${scopePicker?.kind ?? "scope"}: ${scopeNav.next.label}`
                  : `No next ${scopePicker?.kind ?? "scope"}`
              }
              data-testid="scope-nav-next"
              data-disabled={scopeNav?.next ? undefined : "true"}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 font-mono text-[10.5px] uppercase tracking-meta",
                scopeNav?.next
                  ? "text-white/70 hover:border-white/20 hover:text-white"
                  : "pointer-events-none text-white/25",
              )}
              title={scopeNav?.next ? scopeNav.next.label : `No next ${scopePicker?.kind ?? "scope"}`}
            >
              next
              <ArrowRight className="h-3 w-3" aria-hidden />
            </Link>
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
              <ShortcutRow keys="←  →" label="Prev / next item" />
              <ShortcutRow keys="U" label="Undecided" />
              <ShortcutRow keys=",  ." label="Prev / next scope" />
              <ShortcutRow keys="Esc" label="Exit focus" />
              <ShortcutRow keys="?" label="All shortcuts" />
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
              label="Reset to undecided (when an operator decision exists)"
            />
            <ShortcutHelpRow keys="←  /  →" label="Prev / Next item (within scope)" />
            <ShortcutHelpRow keys=",  /  ." label="Prev / Next scope (folder, reference, or batch)" />
            <ShortcutHelpRow keys="?" label="Show this card" />
            <ShortcutHelpRow keys="Esc" label="Exit focus to scope grid" />
          </ul>
        </Modal>
      ) : null}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// IA Phase 19 — Scope picker dropdown
// ────────────────────────────────────────────────────────────────────────

function ScopePickerDropdown({
  picker,
}: {
  picker: NonNullable<ReviewWorkspaceShellProps<unknown>["scopePicker"]>;
}) {
  const [open, setOpen] = useState(false);
  // Click-outside close.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-testid="scope-picker"]')) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const kindLabel =
    picker.kind === "folder"
      ? "Folders"
      : picker.kind === "reference"
        ? "References"
        : "Batches";

  return (
    <div className="relative" data-testid="scope-picker">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Pick ${picker.kind}`}
        aria-expanded={open}
        data-testid="scope-picker-toggle"
        className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 font-mono text-[10.5px] uppercase tracking-meta text-white/70 hover:border-white/20 hover:text-white"
      >
        {picker.kind}
        <ChevronDown className="h-3 w-3" aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-[420px] w-[320px] overflow-y-auto rounded-md border border-white/10 bg-[#16130F] shadow-2xl"
          role="listbox"
          aria-label={kindLabel}
          data-testid="scope-picker-menu"
        >
          <div className="px-3 py-2 font-mono text-[10px] uppercase tracking-meta text-white/40">
            {kindLabel} · {picker.entries.length} pending
          </div>
          {picker.entries.length === 0 ? (
            <div className="px-3 py-3 text-xs text-white/50">
              {picker.kind === "batch"
                ? "No pending batches."
                : picker.kind === "folder"
                  ? "No pending folders."
                  : "No pending references."}
            </div>
          ) : (
            <ul className="py-1">
              {picker.entries.map((entry) => {
                const isActive = entry.id === picker.activeId;
                return (
                  <li key={entry.id}>
                    <Link
                      href={entry.href}
                      onClick={() => setOpen(false)}
                      role="option"
                      aria-selected={isActive}
                      data-active={isActive || undefined}
                      data-testid="scope-picker-entry"
                      className={cn(
                        "flex items-center justify-between gap-3 px-3 py-1.5 text-xs",
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/75 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      <span className="truncate" title={entry.label}>
                        {entry.label}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-white/50">
                        {entry.pendingCount}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
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
                "relative h-10 w-10 overflow-hidden rounded ring-1",
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
                  className="pointer-events-none h-full w-full select-none object-cover"
                  loading="lazy"
                  draggable={false}
                  onError={(e) => {
                    // Fallback when the image fails to load (404 /
                    // signed URL expired / regen pending). Hide the
                    // broken icon so the parent's decision tone +
                    // letter fallback render cleanly.
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : null}
              {/* Decision-letter fallback — visible only when no
                * image renders (no URL or onError hid it). Position
                * absolute keeps the cell square and centred; pointer-
                * events-none preserves click-through to the button. */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold uppercase tracking-meta",
                  thumb.thumbnailUrl ? "opacity-0" : "opacity-100",
                  dec === "KEPT"
                    ? "text-emerald-300"
                    : dec === "REJECTED"
                      ? "text-rose-300"
                      : "text-white/50",
                )}
              >
                {dec === "KEPT" ? "K" : dec === "REJECTED" ? "D" : "·"}
              </span>
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
