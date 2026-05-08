"use client";

// Pass 89 — Batch Review Studio V1: ReviewCard.
//
// Tek asset için karar kartı. Üç buton: Keep / Reject / Reset (UNDECIDED).
// Optimistic update: tıklayınca anında badge güncellenir, fail durumunda
// rollback + toast yerine inline error mesajı.
//
// Variation child ise parent thumbnail mini eklenir (bağlam korunur).

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { AssetThumb } from "../../../AssetThumb";
import type { MJReviewDecision, MJVariantKind } from "@prisma/client";

const DECISION_META: Record<
  MJReviewDecision,
  { label: string; tone: "neutral" | "success" | "danger" }
> = {
  UNDECIDED: { label: "Bekliyor", tone: "neutral" },
  KEPT: { label: "Tutuldu", tone: "success" },
  REJECTED: { label: "Reddedildi", tone: "danger" },
};

const VARIANT_LABELS: Record<MJVariantKind, string> = {
  GRID: "Grid",
  UPSCALE: "Upscale",
  VARIATION: "Variation",
  DESCRIBE: "Describe",
};

type ReviewCardProps = {
  item: {
    midjourneyAssetId: string;
    assetId: string;
    gridIndex: number;
    variantKind: MJVariantKind;
    mjActionLabel: string | null;
    parentAssetId: string | null;
    parentAssetThumbId: string | null;
    midjourneyJobId: string;
    prompt: string;
    expandedPrompt: string | null;
    decision: MJReviewDecision;
  };
};

export function ReviewCard({ item }: ReviewCardProps) {
  const [decision, setDecision] = useState<MJReviewDecision>(item.decision);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function setReview(next: MJReviewDecision) {
    if (next === decision) return;
    const previous = decision;
    setDecision(next); // optimistic
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/midjourney/assets/${item.midjourneyAssetId}/review`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision: next }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Server reflects, UI optimistic state already correct.
      // Trigger a soft refresh for filter view consistency.
      startTransition(() => {});
    } catch (err) {
      setDecision(previous); // rollback
      setError(err instanceof Error ? err.message : "fail");
    }
  }

  const meta = DECISION_META[decision];
  const previewPrompt = (item.expandedPrompt ?? item.prompt).trim();
  const promptShort =
    previewPrompt.length > 80
      ? `${previewPrompt.slice(0, 80)}…`
      : previewPrompt;

  // Pass 89 — Decision tone'una göre card border (görsel feedback).
  const cardClass =
    "flex flex-col gap-2 rounded-md border p-2 transition " +
    (decision === "KEPT"
      ? "border-success bg-success-soft/30"
      : decision === "REJECTED"
        ? "border-danger bg-danger-soft/30 opacity-70"
        : "border-border bg-surface");

  return (
    <article
      className={cardClass}
      data-testid="mj-review-card"
      data-mj-asset-id={item.midjourneyAssetId}
      data-decision={decision}
    >
      <div className="relative">
        <AssetThumb
          assetId={item.assetId}
          alt={`${VARIANT_LABELS[item.variantKind]} grid ${item.gridIndex}`}
        />
        {/* Pass 89 — Variation child ise parent thumb sağ üst köşede mini olarak görünür */}
        {item.parentAssetThumbId ? (
          <div
            className="absolute right-1 top-1 h-12 w-12 overflow-hidden rounded border-2 border-surface shadow-card"
            title="Parent (variation kaynağı)"
            data-testid="mj-review-card-parent-thumb"
          >
            <AssetThumb assetId={item.parentAssetThumbId} square />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <Badge tone="neutral" title={VARIANT_LABELS[item.variantKind]}>
          {VARIANT_LABELS[item.variantKind]}
          {item.mjActionLabel ? ` ${item.mjActionLabel}` : ""}
        </Badge>
      </div>

      <p
        className="line-clamp-2 text-xs text-text-muted"
        title={previewPrompt}
      >
        {promptShort || <span className="italic">(boş prompt)</span>}
      </p>

      {/* Karar butonları */}
      <div
        className="flex gap-1"
        data-testid="mj-review-card-actions"
      >
        <button
          type="button"
          onClick={() => setReview("KEPT")}
          disabled={pending}
          className={
            "flex-1 rounded border px-2 py-1 text-xs font-medium transition " +
            (decision === "KEPT"
              ? "border-success bg-success text-on-accent"
              : "border-border bg-bg text-text-muted hover:border-success hover:text-success")
          }
          data-testid="mj-review-keep"
          title="Tut (1)"
        >
          ✓ Tut
        </button>
        <button
          type="button"
          onClick={() => setReview("REJECTED")}
          disabled={pending}
          className={
            "flex-1 rounded border px-2 py-1 text-xs font-medium transition " +
            (decision === "REJECTED"
              ? "border-danger bg-danger text-on-accent"
              : "border-border bg-bg text-text-muted hover:border-danger hover:text-danger")
          }
          data-testid="mj-review-reject"
          title="Reddet (2)"
        >
          ✕ Reddet
        </button>
        <button
          type="button"
          onClick={() => setReview("UNDECIDED")}
          disabled={pending || decision === "UNDECIDED"}
          className={
            "rounded border px-2 py-1 text-xs text-text-muted transition disabled:opacity-40 " +
            "border-border bg-bg hover:border-border-strong"
          }
          data-testid="mj-review-reset"
          title="Sıfırla (3)"
        >
          ↺
        </button>
      </div>

      {error ? (
        <p
          className="text-xs text-danger"
          data-testid="mj-review-card-error"
        >
          ⚠ {error}
        </p>
      ) : null}

      {/* Job detail link */}
      <Link
        href={`/admin/midjourney/${item.midjourneyJobId}`}
        className="text-xs text-text-muted underline hover:text-accent"
      >
        Job detail →
      </Link>
    </article>
  );
}
