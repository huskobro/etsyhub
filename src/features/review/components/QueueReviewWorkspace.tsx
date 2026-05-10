/* eslint-disable no-restricted-syntax */
// QueueReviewWorkspace — IA Phase 9 (review experience final
// unification). Canonical focus mode for AI Generated + Local Library
// items. Replaces ReviewDetailPanel on the canonical user path; the
// drawer file stays in the codebase as a rollback fallback but
// /review/page.tsx no longer mounts it.
//
// Visual language deliberately mirrors BatchReviewWorkspace
// (`fixed inset-0 bg-#1A1815`, workspace bar / stage / action bar /
// filmstrip / info rail) so the operator sees one product, even
// though the two workspaces talk to different backends:
//
//   BatchReviewWorkspace  (MidjourneyAsset, /api/midjourney/.../review)
//     → keyboard K/D/U auto-advance, batch-scoped filmstrip
//   QueueReviewWorkspace  (GeneratedDesign / LocalLibraryAsset,
//                         /api/review/decisions)
//     → keyboard K/D/U auto-advance, queue-scoped filmstrip with
//       cross-page navigation
//
// The hardcoded hex values (#1A1815, #16130F, #1F1C18, #black/30) and
// the max-w-[760px] stage are part of the v4/A4 spec and live on the
// global token whitelist alongside the BatchReviewWorkspace ones.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  HelpCircle,
  RotateCcw,
  X as XIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useReviewQueue,
  type ReviewQueueItem,
} from "@/features/review/queries";
import { buildReviewUrl } from "@/features/review/lib/search-params";
import { decisionFromParam } from "@/app/(app)/review/_components/ReviewDecisionFilter";
import {
  formatFileSize,
  resolutionHint,
  transparencyForMime,
} from "@/features/review/lib/format";
import { Modal } from "@/features/library/components/Modal";

interface QueueReviewWorkspaceProps {
  scope: "design" | "local";
  itemId: string;
  /** Active page from the URL — drives queue cache lookup + cross-
   *  page boundary navigation. */
  page: number;
  /** Active decision filter (canonical chip param). Forwarded to the
   *  queue hook so the workspace and the underlying grid see the same
   *  filtered set. `undefined` = "all" chip. */
  decision: "undecided" | "kept" | "rejected" | undefined;
}

// Canonical operator-decision wording. Workspace pill mirrors the
// chips on the queue grid so the operator never sees two vocabularies.
const DECISION_PILL: Record<
  "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW",
  { label: string; tone: "neutral" | "kept" | "rejected" | "warning" }
> = {
  PENDING: { label: "Undecided", tone: "neutral" },
  APPROVED: { label: "Kept", tone: "kept" },
  REJECTED: { label: "Rejected", tone: "rejected" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warning" },
};

export function QueueReviewWorkspace({
  scope,
  itemId,
  page,
  decision,
}: QueueReviewWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Live queue data — same key the grid uses, so a decision posted
  // here flushes back to the grid on close. We read both the current
  // page (for in-page nav) and the neighbouring pages (for cross-page
  // boundary jumps) — neighbours are prefetched on demand below.
  const { data, isLoading, error } = useReviewQueue({
    scope,
    decision,
    page,
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 24;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  const idx = items.findIndex((it) => it.id === itemId);
  const item = idx >= 0 ? items[idx] : null;

  const [helpOpen, setHelpOpen] = useState(false);

  // ─────────────────────────────────────────────────────────────────
  // Cross-page navigation. Wrap-around explicitly removed (operator
  // bug report: same-page wrap was confusing); instead the boundaries
  // jump to the neighbouring page and pin the cursor on its first /
  // last item respectively. Page-1 first item + ← and last-page last
  // item + → are disabled — there's nowhere meaningful to go.
  // ─────────────────────────────────────────────────────────────────

  const navigateToItemOnPage = useCallback(
    (targetPage: number, targetItemId: string) => {
      router.push(
        buildReviewUrl(pathname, searchParams, {
          page: targetPage === 1 ? undefined : String(targetPage),
          item: targetItemId,
        }),
      );
    },
    [router, pathname, searchParams],
  );

  // Prefetch the neighbouring page's first / last item so the
  // boundary jump lands instantly. React Query's prefetchQuery runs
  // the same fetcher as useReviewQueue, populates the cache; the next
  // navigateToItemOnPage call is a cache hit.
  const prefetchNeighbour = useCallback(
    async (neighbourPage: number) => {
      if (neighbourPage < 1 || neighbourPage > totalPages) return;
      await queryClient.prefetchQuery({
        queryKey: [
          "review-queue",
          scope,
          decision === undefined
            ? "ALL"
            : decision === "undecided"
              ? "PENDING"
              : decision === "kept"
                ? "APPROVED"
                : "REJECTED",
          neighbourPage,
        ],
        queryFn: async () => {
          const url = new URL(
            "/api/review/queue",
            window.location.origin,
          );
          url.searchParams.set("scope", scope);
          if (decision) {
            url.searchParams.set(
              "status",
              decision === "undecided"
                ? "PENDING"
                : decision === "kept"
                  ? "APPROVED"
                  : "REJECTED",
            );
          }
          url.searchParams.set("page", String(neighbourPage));
          const res = await fetch(url.toString());
          if (!res.ok) throw new Error(`prefetch failed: ${res.status}`);
          return await res.json();
        },
      });
    },
    [queryClient, scope, decision, totalPages],
  );

  const goPrev = useCallback(async () => {
    if (idx < 0 || items.length === 0) return;
    if (idx > 0) {
      navigateToItemOnPage(page, items[idx - 1]!.id);
      return;
    }
    // At the first item of the current page — jump to the last item
    // of the previous page if there is one.
    if (page <= 1) return;
    await prefetchNeighbour(page - 1);
    const prevPageData = queryClient.getQueryData<{
      items: ReviewQueueItem[];
    }>([
      "review-queue",
      scope,
      decision === undefined
        ? "ALL"
        : decision === "undecided"
          ? "PENDING"
          : decision === "kept"
            ? "APPROVED"
            : "REJECTED",
      page - 1,
    ]);
    const lastItem =
      prevPageData?.items?.[prevPageData.items.length - 1] ?? null;
    if (!lastItem) return;
    navigateToItemOnPage(page - 1, lastItem.id);
  }, [
    idx,
    items,
    page,
    prefetchNeighbour,
    queryClient,
    scope,
    decision,
    navigateToItemOnPage,
  ]);

  const goNext = useCallback(async () => {
    if (idx < 0 || items.length === 0) return;
    if (idx < items.length - 1) {
      navigateToItemOnPage(page, items[idx + 1]!.id);
      return;
    }
    if (page >= totalPages) return;
    await prefetchNeighbour(page + 1);
    const nextPageData = queryClient.getQueryData<{
      items: ReviewQueueItem[];
    }>([
      "review-queue",
      scope,
      decision === undefined
        ? "ALL"
        : decision === "undecided"
          ? "PENDING"
          : decision === "kept"
            ? "APPROVED"
            : "REJECTED",
      page + 1,
    ]);
    const firstItem = nextPageData?.items?.[0] ?? null;
    if (!firstItem) return;
    navigateToItemOnPage(page + 1, firstItem.id);
  }, [
    idx,
    items,
    page,
    totalPages,
    prefetchNeighbour,
    queryClient,
    scope,
    decision,
    navigateToItemOnPage,
  ]);

  const exitWorkspace = useCallback(() => {
    router.push(buildReviewUrl(pathname, searchParams, { item: undefined }));
  }, [router, pathname, searchParams]);

  // ─────────────────────────────────────────────────────────────────
  // Decision mutation. Same /api/review/decisions endpoint
  // ReviewDetailActions used; we keep the canonical write path and
  // only swap the surrounding UI. Auto-advance after Keep/Reject
  // matches BatchReviewWorkspace ergonomics.
  // ─────────────────────────────────────────────────────────────────

  const decisionMutation = useMutation({
    mutationFn: async (next: "APPROVED" | "REJECTED") => {
      const res = await fetch("/api/review/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, id: itemId, decision: next }),
      });
      if (!res.ok) throw new Error(`decision failed: ${res.status}`);
      return next;
    },
    onSuccess: () => {
      // Invalidate the whole queue family — the grid behind the
      // workspace, the neighbouring pages we may have prefetched, and
      // any other consumer all pull fresh status.
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { scope, id: itemId };
      if (scope === "local") body.productTypeKey = "wall_art";
      const res = await fetch("/api/review/decisions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`reset failed: ${res.status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review-queue"] });
    },
  });

  const decide = useCallback(
    async (next: "APPROVED" | "REJECTED") => {
      try {
        await decisionMutation.mutateAsync(next);
      } catch {
        return; // mutation surfaces error inline below
      }
      // 80ms matches the BatchReviewWorkspace auto-advance feel.
      setTimeout(() => {
        void goNext();
      }, 80);
    },
    [decisionMutation, goNext],
  );

  // ─────────────────────────────────────────────────────────────────
  // Keyboard shortcuts. K=Keep · D=Discard · U=Reset · ←/→=Prev/Next
  // · ?=Help · Esc=Exit (or close help). Input/textarea bypass.
  // ─────────────────────────────────────────────────────────────────

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
        void decide("APPROVED");
      } else if (key === "d") {
        e.preventDefault();
        void decide("REJECTED");
      } else if (key === "u") {
        e.preventDefault();
        resetMutation.mutate();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        void goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        void goNext();
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (helpOpen) {
          setHelpOpen(false);
        } else {
          exitWorkspace();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [decide, goNext, goPrev, helpOpen, resetMutation, exitWorkspace]);

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#1A1815] text-white/80"
        data-testid="queue-review-workspace"
        data-state="loading"
      >
        <div className="font-mono text-xs uppercase tracking-meta text-white/40">
          Loading review item…
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#1A1815] text-white/80"
        data-testid="queue-review-workspace"
        data-state={error ? "error" : "missing"}
      >
        <h1 className="text-2xl font-semibold">
          {error ? "Review yüklenemedi" : "Kayıt bulunamadı"}
        </h1>
        <p className="max-w-md text-center text-sm text-white/50">
          {error
            ? "Sayfayı yenileyin veya birkaç saniye sonra tekrar deneyin."
            : "Bu öğe silinmiş, başka bir filtrede kalmış ya da farklı bir sayfada olabilir."}
        </p>
        <button
          type="button"
          onClick={exitWorkspace}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-white/20 hover:text-white"
        >
          <XIcon className="h-3.5 w-3.5" aria-hidden />
          Exit
        </button>
      </div>
    );
  }

  const decisionPill = DECISION_PILL[item.reviewStatus];
  // Cursor counter is page-relative; the operator can read total page
  // count from the queue grid behind, so we don't double up here.
  const cursorLabel = `${idx + 1} / ${items.length}`;
  const decidedCount = items.filter(
    (it) => it.reviewStatus === "APPROVED" || it.reviewStatus === "REJECTED",
  ).length;
  const keptCount = items.filter(
    (it) => it.reviewStatus === "APPROVED",
  ).length;
  // IA Phase 10 — undecided is the operator's primary "what's left?"
  // counter; surfaced accented in the top bar. NEEDS_REVIEW counts as
  // undecided here because it is a pipeline auto-flag, not an operator
  // decision (CLAUDE.md Madde H).
  const undecidedCount = items.length - decidedCount;

  // Boundary affordances — disable arrows where there is genuinely no
  // neighbour, otherwise let the cross-page jump take over.
  const canGoPrev = idx > 0 || page > 1;
  const canGoNext = idx < items.length - 1 || page < totalPages;

  const errorMessage =
    decisionMutation.error || resetMutation.error
      ? "İşlem başarısız oldu — birkaç saniye sonra tekrar deneyin."
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex h-screen flex-col bg-[#1A1815] text-white/85"
      data-testid="queue-review-workspace"
      data-source={item.source?.kind ?? scope}
      data-decision={item.reviewStatus}
    >
      {/* Workspace bar */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/5 bg-[#16130F] px-5 py-3">
        <Link
          href={buildReviewUrl(pathname, searchParams, { item: undefined })}
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Review
        </Link>
        <span className="font-mono text-xs uppercase tracking-meta text-white/40">
          {scope === "design" ? "AI · Focus" : "Local · Focus"}
        </span>
        {/* IA Phase 10 — top-bar info hierarchy (matches
         *   BatchReviewWorkspace). Big row: cursor + total. Small mono
         *   row: page index, then undecided count accented (operator's
         *   "what's left?" answer), then decided / kept secondary. */}
        <div className="flex flex-1 flex-col items-center justify-center leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-xs uppercase tracking-meta text-white/40">
              Item
            </span>
            <span className="k-display text-xl font-semibold tabular-nums text-white">
              {cursorLabel}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-xs uppercase tracking-meta">
            <span className="tabular-nums text-white/50">
              Page {page} / {totalPages}
            </span>
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
            <span className="tabular-nums text-white/50">
              {decidedCount} decided
            </span>
            <span className="text-white/20">·</span>
            <span className="tabular-nums text-white/50">
              {keptCount} kept
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-white/70 hover:border-white/20 hover:text-white"
          aria-label="Show shortcuts"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden />?
        </button>
        <button
          type="button"
          onClick={exitWorkspace}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:border-white/20 hover:text-white"
          data-testid="queue-review-exit"
        >
          <XIcon className="h-3.5 w-3.5" aria-hidden />
          Exit
        </button>
      </div>

      {/* Main grid */}
      <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        {/* Stage */}
        <div className="flex flex-col overflow-hidden">
          <div className="relative flex flex-1 items-center justify-center p-10">
            <div className="relative max-h-full">
              {item.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.thumbnailUrl}
                  alt={`${item.source?.kind ?? scope} review item`}
                  className="aspect-square w-full max-w-[760px] rounded-lg border border-white/10 bg-black/30 object-contain shadow-2xl"
                />
              ) : (
                <div className="flex aspect-square w-full max-w-[760px] items-center justify-center rounded-lg border border-white/10 bg-black/30 text-sm text-white/40 shadow-2xl">
                  Önizleme yok
                </div>
              )}
              <button
                type="button"
                onClick={goPrev}
                disabled={!canGoPrev}
                aria-label="Previous"
                data-testid="queue-review-prev"
                className="absolute -left-14 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canGoNext}
                aria-label="Next"
                data-testid="queue-review-next"
                className="absolute -right-14 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
              >
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex-shrink-0 px-10 pb-5">
            <div className="mx-auto grid max-w-[760px] grid-cols-3 gap-3">
              <ActionButton
                tone="reject"
                label="Discard"
                shortcut="D"
                pressed={item.reviewStatus === "REJECTED"}
                disabled={decisionMutation.isPending}
                onClick={() => void decide("REJECTED")}
                icon={<XIcon className="h-4 w-4" aria-hidden />}
              />
              <ActionButton
                tone="keep"
                label="Keep"
                shortcut="K"
                pressed={item.reviewStatus === "APPROVED"}
                disabled={decisionMutation.isPending}
                primary
                onClick={() => void decide("APPROVED")}
                icon={<Check className="h-4 w-4" aria-hidden />}
              />
              <ActionButton
                tone="undo"
                label="Reset"
                shortcut="U"
                pressed={false}
                disabled={
                  resetMutation.isPending ||
                  item.reviewStatusSource !== "USER"
                }
                onClick={() => resetMutation.mutate()}
                icon={<RotateCcw className="h-4 w-4" aria-hidden />}
              />
            </div>
            {errorMessage ? (
              <p
                role="alert"
                data-testid="queue-review-error"
                className="mt-2 text-center text-xs text-rose-300"
              >
                {errorMessage}
              </p>
            ) : null}
          </div>

          {/* Filmstrip — current queue page only. Cross-page items
           *   live a router.push away (boundary arrows) and never bleed
           *   into the strip. */}
          <div className="flex-shrink-0 border-t border-white/5 bg-black/30 px-5 py-3">
            <Filmstrip
              items={items}
              cursor={idx}
              onJump={(targetIdx) => {
                const target = items[targetIdx];
                if (target) navigateToItemOnPage(page, target.id);
              }}
            />
          </div>
        </div>

        {/* Info rail — source-aware. AI items show product-type +
         *   reference + summary; local items show file path + DPI +
         *   transparency capability. The decision pill at the top is
         *   shared across both. */}
        <aside className="flex flex-col overflow-hidden border-l border-white/5 bg-[#1F1C18]">
          <div className="border-b border-white/5 p-5">
            <div className="font-mono text-xs uppercase tracking-meta text-white/40">
              Item
            </div>
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">
                {item.source?.kind === "local-library"
                  ? item.source.fileName
                  : item.source?.kind === "design" &&
                      item.source.productTypeKey
                    ? item.source.productTypeKey
                    : scope === "design"
                      ? "AI variation"
                      : "Local asset"}
              </h3>
              <DecisionPill
                label={decisionPill.label}
                tone={decisionPill.tone}
              />
            </div>
            {item.reviewStatusSource === "USER" ? (
              <div className="mt-1 font-mono text-xs uppercase tracking-meta text-white/40">
                Operator override
              </div>
            ) : null}
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {/* Source-specific metadata block */}
            {item.source?.kind === "local-library" ? (
              <LocalSourceSection source={item.source} />
            ) : item.source?.kind === "design" ? (
              <DesignSourceSection
                source={item.source}
                referenceId={item.referenceId}
                reviewScore={item.reviewScore}
                riskFlagCount={item.riskFlagCount}
              />
            ) : null}

            {/* Quality summary — both sources may have it. */}
            {item.reviewSummary ? (
              <section>
                <SectionTitle>Summary</SectionTitle>
                <p className="mt-2 text-xs leading-relaxed text-white/75">
                  {item.reviewSummary}
                </p>
              </section>
            ) : null}

            {/* Risk flags — surfaced as a count + the first three
             *   flag types so the operator gets a quick read without
             *   leaving the workspace. Full list still on the queue
             *   card and (when needed) in the drawer fallback. */}
            {item.riskFlagCount > 0 ? (
              <section>
                <SectionTitle>Risk flags</SectionTitle>
                <div className="mt-2 text-xs text-white/75">
                  {item.riskFlagCount} işaret
                </div>
              </section>
            ) : null}

            {item.reviewProviderSnapshot ? (
              <section>
                <SectionTitle>Provider</SectionTitle>
                <p className="mt-2 font-mono text-xs text-white/60">
                  {item.reviewProviderSnapshot}
                </p>
              </section>
            ) : null}
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
              <ShortcutRow keys="Esc" label="Exit" />
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
              label="Reset to system decision (only when status is operator)"
            />
            <ShortcutHelpRow
              keys="←  /  →"
              label="Prev / Next item (jumps page boundary in the same scope)"
            />
            <ShortcutHelpRow keys="?" label="Show this card" />
            <ShortcutHelpRow keys="Esc" label="Exit / close help" />
          </ul>
        </Modal>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Source-specific info-rail sections
// ─────────────────────────────────────────────────────────────────────

function LocalSourceSection({
  source,
}: {
  source: Extract<
    NonNullable<ReviewQueueItem["source"]>,
    { kind: "local-library" }
  >;
}) {
  const transparency = transparencyForMime(source.mimeType);
  const hint = resolutionHint({
    dpi: source.dpi,
    width: source.width,
    height: source.height,
  });
  return (
    <section data-testid="info-rail-local">
      <SectionTitle>File</SectionTitle>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-white/40">Folder</dt>
        <dd
          className="break-all font-mono text-white/75"
          title={source.folderPath}
        >
          {source.folderName}
        </dd>
        <dt className="text-white/40">Path</dt>
        <dd className="break-all font-mono text-white/50">
          {source.folderPath}
        </dd>
        <dt className="text-white/40">Format</dt>
        <dd className="font-mono text-white/75">{transparency.format}</dd>
        <dt className="text-white/40">Size</dt>
        <dd className="text-white/75">{formatFileSize(source.fileSize)}</dd>
        <dt className="text-white/40">Resolution</dt>
        <dd className="text-white/75">
          {source.width}×{source.height}
          {source.dpi ? ` · ${source.dpi} DPI` : ""}
        </dd>
        <dt className="text-white/40">Transparency</dt>
        <dd className="text-white/75">
          {transparency.kind === "supports-alpha"
            ? "Supported (format-level)"
            : transparency.kind === "no-alpha"
              ? "Not supported (JPEG)"
              : "Unknown"}
        </dd>
        {source.qualityScore !== null ? (
          <>
            <dt className="text-white/40">Quality</dt>
            <dd className="text-white/75">{source.qualityScore}/100</dd>
          </>
        ) : null}
        {hint ? (
          <>
            <dt className="text-white/40">Hint</dt>
            <dd className="text-white/60">{hint}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

function DesignSourceSection({
  source,
  referenceId,
  reviewScore,
  riskFlagCount,
}: {
  source: Extract<
    NonNullable<ReviewQueueItem["source"]>,
    { kind: "design" }
  >;
  referenceId: string | null;
  /** AI quality score 0-100 — surfaced in the rail so the operator can
   *  read the AI signal alongside the operator decision. */
  reviewScore: number | null;
  /** Risk-flag count — pipeline auto-flags (text detected, low alpha,
   *  trademark match…). Surface as a single accent number; the full
   *  list lands when the unified-review service-layer ships. */
  riskFlagCount: number;
}) {
  const transparency = transparencyForMime(source.mimeType);
  return (
    <section data-testid="info-rail-design">
      <SectionTitle>Variation</SectionTitle>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-white/40">Product</dt>
        <dd className="font-mono text-white/75">
          {source.productTypeKey ?? "—"}
        </dd>
        <dt className="text-white/40">Reference</dt>
        <dd className="font-mono text-white/75">
          {source.referenceShortId ? `ref-${source.referenceShortId}` : "—"}
        </dd>
        <dt className="text-white/40">Format</dt>
        <dd className="font-mono text-white/75">{transparency.format}</dd>
        <dt className="text-white/40">Size</dt>
        <dd className="text-white/75">{formatFileSize(source.fileSize)}</dd>
        {source.width != null && source.height != null ? (
          <>
            <dt className="text-white/40">Resolution</dt>
            <dd className="text-white/75">
              {source.width}×{source.height}
            </dd>
          </>
        ) : null}
        <dt className="text-white/40">Transparency</dt>
        <dd className="text-white/75">
          {transparency.kind === "supports-alpha"
            ? "Supported (format-level)"
            : transparency.kind === "no-alpha"
              ? "Not supported (JPEG)"
              : "Unknown"}
        </dd>
        {reviewScore !== null ? (
          <>
            <dt className="text-white/40">Quality</dt>
            <dd className="text-white/75">{reviewScore}/100</dd>
          </>
        ) : null}
        {riskFlagCount > 0 ? (
          <>
            <dt className="text-white/40">Risk</dt>
            <dd className="text-amber-300">
              {riskFlagCount} işaret
            </dd>
          </>
        ) : null}
      </dl>
      {referenceId ? (
        <Link
          href={`/references/${referenceId}/variations`}
          className="mt-3 inline-flex items-center gap-1 font-mono text-xs text-white/75 underline-offset-2 hover:underline"
        >
          ↑ open reference variations
        </Link>
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Filmstrip — same visual idiom as BatchReviewWorkspace, but without
// the variantKind labels (queue items don't have those). Decision
// strip color comes from reviewStatus directly.
// ─────────────────────────────────────────────────────────────────────

function Filmstrip({
  items,
  cursor,
  onJump,
}: {
  items: ReviewQueueItem[];
  cursor: number;
  onJump: (idx: number) => void;
}) {
  if (items.length === 0) return null;
  // Window of 9 items centered on the cursor — matches A4 spec.
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
          const tone =
            it.reviewStatus === "APPROVED"
              ? "bg-emerald-500/20 ring-emerald-500/60"
              : it.reviewStatus === "REJECTED"
                ? "bg-rose-500/20 ring-rose-500/60"
                : "bg-white/5 ring-white/10";
          return (
            <button
              key={it.id}
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
              {it.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={it.thumbnailUrl}
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

// ─────────────────────────────────────────────────────────────────────
// Small presentational primitives — kept inline because they're only
// useful inside this workspace and not worth a shared component yet.
// ─────────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-xs uppercase tracking-meta text-white/40">
      {children}
    </div>
  );
}

function DecisionPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "kept" | "rejected" | "warning";
}) {
  const className =
    tone === "kept"
      ? "bg-emerald-500/15 text-emerald-300"
      : tone === "rejected"
        ? "bg-rose-500/15 text-rose-300"
        : tone === "warning"
          ? "bg-amber-500/15 text-amber-300"
          : "bg-white/5 text-white/70";
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
        muted && "opacity-60",
      )}
    >
      <kbd className="rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-xs text-white/85">
        {keys}
      </kbd>
      <span className="flex-1 text-white/75">{label}</span>
    </li>
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
  tone: "keep" | "reject" | "undo";
  label: string;
  shortcut: string;
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  primary?: boolean;
}) {
  // IA Phase 10 — pressed-only fill (Keep button bug fix). Idle state
  // is plain across all tones; pressed adds the canonical orange
  // (Keep) / danger (Reject) decision-confirm fill. This matches
  // BatchReviewWorkspace ActionButton so the two surfaces read
  // identically and the operator never sees a "pre-selected" Keep
  // button on an undecided item.
  const idle = "bg-white/5 border-white/10 hover:bg-white/10";
  const keepPressed =
    "border-2 border-k-orange bg-k-orange/20 hover:bg-k-orange/30";
  const rejectPressed = "border-rose-400/50 bg-rose-500/25";
  const containerBg = pressed
    ? primary || tone === "keep"
      ? keepPressed
      : tone === "reject"
        ? rejectPressed
        : "border-white/30 bg-white/15"
    : idle;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      data-pressed={pressed || undefined}
      className={cn(
        "flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        containerBg,
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <kbd className="ml-auto rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-white/85">
        {shortcut}
      </kbd>
    </button>
  );
}
