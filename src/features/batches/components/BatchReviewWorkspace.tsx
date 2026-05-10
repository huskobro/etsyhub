/* eslint-disable no-restricted-syntax */
// BatchReviewWorkspace — IA Phase 11 (review experience completion)
//
// MJ-source adapter on top of `ReviewWorkspaceShell`. The shell owns
// the layout, keyboard map, top-bar info hierarchy, action bar,
// filmstrip, and info-rail container; this file owns:
//   • MJ data model glue (ReviewItem → shell items)
//   • Optimistic decision overlay against the per-asset PUT endpoint
//   • Source-specific info-rail content (variant kind, prompt,
//     variables, parent lineage)
//   • Cursor state (in-batch only — no cross-page jump)
//
// This collapses the previous ~700-line standalone workspace into a
// thin adapter; visual + interaction language is now shared with
// QueueReviewWorkspace through the shell.
//
// The hardcoded hex sabitleri live in the shell; this file no longer
// needs the v4 dark surface whitelist.
"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { MJReviewDecision } from "@prisma/client";
import { UserAssetThumb } from "@/components/ui/UserAssetThumb";
import {
  ReviewWorkspaceShell,
  SectionTitle,
  type CanonicalDecision,
} from "@/features/review/components/ReviewWorkspaceShell";
import type {
  ReviewItem,
  BatchReviewSummary,
} from "@/server/services/midjourney/review";

interface BatchReviewWorkspaceProps {
  batchId: string;
  summary: BatchReviewSummary;
  items: ReviewItem[];
  initialCursor?: number;
  /**
   * Where the workspace bar's back-link and Exit button send the
   * operator. Defaults to the batch detail page; the canonical host
   * (`/review?batch=`) passes "/review" so Exit returns to the
   * unified review surface.
   */
  exitHref?: string;
  /**
   * Visible label in the back-link chip. Defaults to the
   * `batch_<short>` v4 spec; the canonical host passes "Review".
   */
  exitLabel?: string;
  /**
   * IA Phase 12 — workspace anchor (CLAUDE.md Madde H). Total review
   * pending across all sources for this user. Server resolves before
   * render.
   */
  totalReviewPending?: number;
  /**
   * IA Phase 12 — next pending batch for the same user, resolved
   * server-side. Null when no other batch is pending.
   */
  nextScope?: {
    href: string;
    label: string;
    kind: "batch" | "folder" | "queue";
  } | null;
}

export function BatchReviewWorkspace({
  batchId,
  summary: _summary,
  items,
  initialCursor = 0,
  exitHref,
  exitLabel,
  totalReviewPending,
  nextScope,
}: BatchReviewWorkspaceProps) {
  const resolvedExitHref = exitHref ?? `/batches/${batchId}`;
  const resolvedExitLabel = exitLabel ?? `batch_${batchId.slice(0, 8)}`;

  // Cursor state — in-batch navigation only. The shell drives
  // ←/→ + arrow buttons through onGoPrev / onGoNext.
  const [cursor, setCursor] = useState(initialCursor);

  // Optimistic decision overlay keyed by MidjourneyAsset id. The
  // server is the source of truth, but the operator's auto-advance
  // ergonomics need an instant visual response.
  const [decisions, setDecisions] = useState<
    Record<string, MJReviewDecision>
  >({});
  const [pending, setPending] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const decisionForAsset = useCallback(
    (asset: ReviewItem): MJReviewDecision =>
      decisions[asset.midjourneyAssetId] ?? asset.decision,
    [decisions],
  );

  const keptCount = items.reduce(
    (acc, it) => (decisionForAsset(it) === "KEPT" ? acc + 1 : acc),
    0,
  );
  const discardedCount = items.reduce(
    (acc, it) => (decisionForAsset(it) === "REJECTED" ? acc + 1 : acc),
    0,
  );
  const undecidedCount = items.length - keptCount - discardedCount;

  const writeDecision = useCallback(
    async (asset: ReviewItem, next: CanonicalDecision) => {
      const assetId = asset.midjourneyAssetId;
      setPending(assetId);
      setErrorMessage(null);
      // Optimistic: set the override before the network call lands.
      setDecisions((prev) => ({ ...prev, [assetId]: next }));
      try {
        const res = await fetch(
          `/api/midjourney/assets/${assetId}/review`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ decision: next }),
          },
        );
        if (!res.ok) {
          setDecisions((prev) => {
            const copy = { ...prev };
            delete copy[assetId];
            return copy;
          });
          setErrorMessage("Karar yazılamadı — birkaç saniye sonra tekrar deneyin.");
          throw new Error("decision write failed");
        }
      } catch (err) {
        setDecisions((prev) => {
          const copy = { ...prev };
          delete copy[assetId];
          return copy;
        });
        if (errorMessage === null) {
          setErrorMessage("Karar yazılamadı — birkaç saniye sonra tekrar deneyin.");
        }
        throw err;
      } finally {
        setPending(null);
      }
    },
    [errorMessage],
  );

  const currentAsset = items[cursor];
  const currentDecision: CanonicalDecision = currentAsset
    ? decisionForAsset(currentAsset)
    : "UNDECIDED";

  const goPrev = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
  }, []);
  const goNext = useCallback(() => {
    setCursor((c) => Math.min(items.length - 1, c + 1));
  }, [items.length]);

  // Reset is only meaningful when the current item is decided.
  const resetEnabled =
    !!currentAsset && currentDecision !== "UNDECIDED" && pending === null;

  return (
    <ReviewWorkspaceShell<ReviewItem>
      exitHref={resolvedExitHref}
      exitLabel={resolvedExitLabel}
      scopeLabel={`Batch · ${batchId.slice(0, 8)}`}
      totalReviewPending={totalReviewPending}
      nextScope={nextScope ?? null}
      items={items}
      cursor={cursor}
      onJumpToCursor={setCursor}
      canGoPrev={cursor > 0}
      canGoNext={cursor < items.length - 1}
      onGoPrev={goPrev}
      onGoNext={goNext}
      keptCount={keptCount}
      discardedCount={discardedCount}
      undecidedCount={undecidedCount}
      currentDecision={currentDecision}
      onDecide={async (asset, next) => {
        await writeDecision(asset, next);
      }}
      onReset={() => {
        if (currentAsset) void writeDecision(currentAsset, "UNDECIDED");
      }}
      isPending={pending !== null}
      errorMessage={errorMessage}
      resetEnabled={resetEnabled}
      itemId={(it) => it.midjourneyAssetId}
      filmstripDecisionFor={(it) => decisionForAsset(it)}
      filmstripThumb={(it) => ({
        thumbnailUrl: null /* MJ uses signedUrl pipeline; shell handles
          null cells gracefully and the stage renderer covers the
          current item. Filmstrip thumbnails for past/future cells in
          MJ are intentionally left blank — UserAssetThumb only loads
          on focus to keep the strip cheap. */,
      })}
      itemTitle={(it) =>
        `${it.variantKind}${it.mjActionLabel ? ` ${it.mjActionLabel}` : ""}`
      }
      renderStage={(it) => (
        <UserAssetThumb
          assetId={it.assetId}
          alt={`${it.variantKind} ${it.gridIndex}`}
          square
          className="!h-full !w-full !rounded-none !border-0 !bg-transparent"
        />
      )}
      renderInfoRail={(it) => <BatchInfoRail item={it} />}
      testId="batch-review-workspace"
      dataAttributes={{ "data-batch-id": batchId }}
    />
  );
}

// ────────────────────────────────────────────────────────────────────────
// MJ-specific info-rail content
// ────────────────────────────────────────────────────────────────────────

function BatchInfoRail({ item }: { item: ReviewItem }) {
  const promptText = item.expandedPrompt ?? item.prompt;
  return (
    <>
      <section>
        <SectionTitle>Variant</SectionTitle>
        <div className="mt-2 font-mono text-xs text-white/75">
          grid {item.gridIndex} · imported{" "}
          {new Date(item.importedAt).toLocaleDateString("tr-TR")}
        </div>
      </section>

      <section>
        <SectionTitle>Prompt</SectionTitle>
        <p className="mt-2 text-xs leading-relaxed text-white/75">
          {promptText || (
            <span className="italic text-white/40">(no prompt)</span>
          )}
        </p>
      </section>

      {item.variables && Object.keys(item.variables).length > 0 ? (
        <section>
          <SectionTitle>Variables</SectionTitle>
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
          <SectionTitle>Parent</SectionTitle>
          <Link
            href={`/library?parentAssetId=${item.parentAssetId}`}
            className="mt-2 inline-flex items-center gap-1 font-mono text-xs text-white/75 underline-offset-2 hover:underline"
          >
            ↑ parent_{item.parentAssetId.slice(0, 8)}
          </Link>
        </section>
      ) : null}
    </>
  );
}
