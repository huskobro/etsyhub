// Unified review service — preparatory layer for the eventual single
// review experience (Phase 2 of the IA migration plan).
//
// Today the product runs two parallel review surfaces:
//   1. /review            — tab-based grid over GeneratedDesign + LocalLibraryAsset
//                           (state: ReviewStatus = PENDING/APPROVED/NEEDS_REVIEW/REJECTED)
//   2. /batches/[id]/review — keyboard-first dark workspace over MidjourneyAsset
//                           (state: MJReviewDecision = UNDECIDED/KEPT/REJECTED)
//
// The two surfaces read different tables, write through different
// endpoints, and use different state enums. A single review experience
// requires the call sites to agree on one operator decision shape.
//
// This module fixes the SHAPE without touching the read paths or the
// write endpoints yet. It declares MJReviewDecision as canonical and
// provides:
//   • UnifiedReviewItem    — common item type across all three sources
//   • UnifiedReviewSource  — discriminator
//   • toCanonicalDecision  — ReviewStatus → MJReviewDecision adapter
//   • fromCanonicalDecision — round-trip helper for legacy writes
//   • listUnifiedReviewItems — read-only aggregator for inspection only
//
// Importantly, NO existing call site imports from this file yet. UI
// merge happens in a later turn. This module is intentionally small and
// side-effect-free so it can be unit-tested before being wired up.
//
// Adapter rules (ReviewStatus → MJReviewDecision):
//   PENDING        → UNDECIDED   (auto-pipeline default; operator hasn't acted)
//   APPROVED       → KEPT        (operator/system "this passes")
//   NEEDS_REVIEW   → UNDECIDED   (auto-pipeline flagged; operator must decide;
//                                 the risk signal lives on `riskLevel`, not
//                                 on the canonical decision)
//   REJECTED       → REJECTED    (1:1)
//
// The adapter is intentionally lossy in one direction: NEEDS_REVIEW
// collapses to UNDECIDED on the canonical axis because "needs review" is
// a pipeline signal, not an operator decision. Surfacing the original
// ReviewStatus alongside the canonical decision is supported via
// `legacyStatus` so consumers that care can still display the
// "needs review" badge.

import {
  MJReviewDecision,
  MJVariantKind,
  ReviewStatus,
} from "@prisma/client";
import { db } from "@/server/db";

/** The three sources that contribute review items today. */
export type UnifiedReviewSource =
  | "midjourney" // MidjourneyAsset.reviewDecision (already canonical)
  | "design" //     GeneratedDesign.reviewStatus (adapter applies)
  | "local-library"; // LocalLibraryAsset.reviewStatus (adapter applies)

/**
 * Single shape for an item rendered on a unified review surface.
 *
 * Identifiers are kept per-source so write paths can route to the right
 * legacy endpoint until the unification finishes:
 *   - midjourney    → PUT /api/midjourney/assets/[id]/review
 *   - design        → POST /api/review/decisions
 *   - local-library → POST /api/review/decisions  (scope=local)
 */
export interface UnifiedReviewItem {
  /** Stable surrogate key for React lists. Composite of source + native id. */
  key: string;
  source: UnifiedReviewSource;
  /** Native primary key on the underlying table. */
  sourceId: string;
  /**
   * Asset id used for thumbnail URLs (storage signedUrl proxy). Null for
   * local-library which uses a hash-based proxy URL instead.
   */
  assetId: string | null;
  /**
   * Pre-computed thumbnail URL. Caller is responsible for filling this
   * in before render (signed URL for design/midjourney, proxy path for
   * local-library). The aggregator does NOT call storage to keep this
   * function pure and cheap.
   */
  thumbnailUrl: null;

  /** Canonical decision (operator axis). */
  decision: MJReviewDecision;
  /**
   * Original pipeline status, only meaningful for design/local-library.
   * Null for midjourney (no NEEDS_REVIEW concept on that axis).
   * UI surfaces a "needs review" chip when this is NEEDS_REVIEW.
   */
  legacyStatus: ReviewStatus | null;
  /** AI quality score 0-100 (design/local-library only). */
  score: number | null;
  /** Risk-flag count (>0 ⇒ surfaced as warning chip). */
  riskFlagCount: number;
  /** Last decision timestamp (operator or system). */
  decidedAt: string | null;

  /** Lineage hint — variation kind label, batch hint, etc. */
  variantKind: MJVariantKind | null;
  /** Batch hint (Job.metadata.batchId) when source=midjourney. */
  batchId: string | null;

  createdAt: string;
}

/**
 * Adapter — pipeline ReviewStatus to canonical MJReviewDecision.
 *
 * NEEDS_REVIEW collapses to UNDECIDED on the canonical axis (the operator
 * still has to decide). Consumers that need to keep the "needs review"
 * affordance read it from `legacyStatus` on UnifiedReviewItem.
 */
export function toCanonicalDecision(
  status: ReviewStatus,
): MJReviewDecision {
  switch (status) {
    case ReviewStatus.APPROVED:
      return MJReviewDecision.KEPT;
    case ReviewStatus.REJECTED:
      return MJReviewDecision.REJECTED;
    case ReviewStatus.PENDING:
    case ReviewStatus.NEEDS_REVIEW:
      return MJReviewDecision.UNDECIDED;
  }
}

/**
 * Inverse adapter for legacy write paths (POST /api/review/decisions).
 *
 * KEPT      → APPROVED
 * REJECTED  → REJECTED
 * UNDECIDED → PENDING   (intentionally not NEEDS_REVIEW; that signal is
 *                        produced by the auto-pipeline and we don't want
 *                        an operator UNDECIDED to overwrite a real risk
 *                        flag pipeline result)
 *
 * Call sites that already hold a richer ReviewStatus (e.g. NEEDS_REVIEW
 * from auto-pipeline) MUST preserve it directly and only use this when
 * the operator's UNDECIDED → PENDING reset is intended.
 */
export function fromCanonicalDecision(
  decision: MJReviewDecision,
): ReviewStatus {
  switch (decision) {
    case MJReviewDecision.KEPT:
      return ReviewStatus.APPROVED;
    case MJReviewDecision.REJECTED:
      return ReviewStatus.REJECTED;
    case MJReviewDecision.UNDECIDED:
      return ReviewStatus.PENDING;
  }
}

/**
 * Read-only aggregator. Returns up to `limit` recent items per source
 * and merges them by createdAt desc. Intended for ad-hoc inspection
 * (admin tools, debug dumps, future unified `/review` page) — NOT yet
 * wired to any user surface.
 *
 * userId is required (multi-tenant invariant). soft-deleted rows are
 * excluded on every source.
 */
export async function listUnifiedReviewItems(args: {
  userId: string;
  /** Per-source cap. Final list is roughly 3× this number, capped to 200. */
  limit?: number;
}): Promise<UnifiedReviewItem[]> {
  const userId = args.userId;
  const perSource = Math.min(Math.max(args.limit ?? 50, 1), 200);

  const [mjAssets, designs, locals] = await Promise.all([
    db.midjourneyAsset.findMany({
      where: {
        midjourneyJob: { userId },
      },
      orderBy: { importedAt: "desc" },
      take: perSource,
      select: {
        id: true,
        assetId: true,
        gridIndex: true,
        variantKind: true,
        reviewDecision: true,
        reviewDecidedAt: true,
        importedAt: true,
        midjourneyJobId: true,
      },
    }),
    db.generatedDesign.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: perSource,
      select: {
        id: true,
        assetId: true,
        reviewStatus: true,
        reviewScore: true,
        reviewRiskFlags: true,
        reviewedAt: true,
        createdAt: true,
      },
    }),
    db.localLibraryAsset.findMany({
      where: { userId, deletedAt: null, isUserDeleted: false },
      orderBy: { createdAt: "desc" },
      take: perSource,
      select: {
        id: true,
        reviewStatus: true,
        reviewScore: true,
        reviewRiskFlags: true,
        reviewedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const items: UnifiedReviewItem[] = [
    ...mjAssets.map<UnifiedReviewItem>((a) => ({
      key: `mj:${a.id}`,
      source: "midjourney",
      sourceId: a.id,
      assetId: a.assetId,
      thumbnailUrl: null,
      decision: a.reviewDecision,
      legacyStatus: null,
      score: null,
      riskFlagCount: 0,
      decidedAt: a.reviewDecidedAt ? a.reviewDecidedAt.toISOString() : null,
      variantKind: a.variantKind,
      batchId: null, // batchId lives on Job.metadata; resolve later if needed
      createdAt: a.importedAt.toISOString(),
    })),
    ...designs.map<UnifiedReviewItem>((d) => ({
      key: `design:${d.id}`,
      source: "design",
      sourceId: d.id,
      assetId: d.assetId,
      thumbnailUrl: null,
      decision: toCanonicalDecision(d.reviewStatus),
      legacyStatus: d.reviewStatus,
      score: d.reviewScore,
      riskFlagCount: countRiskFlags(d.reviewRiskFlags),
      decidedAt: d.reviewedAt ? d.reviewedAt.toISOString() : null,
      variantKind: null,
      batchId: null,
      createdAt: d.createdAt.toISOString(),
    })),
    ...locals.map<UnifiedReviewItem>((l) => ({
      key: `local:${l.id}`,
      source: "local-library",
      sourceId: l.id,
      assetId: null,
      thumbnailUrl: null,
      decision: toCanonicalDecision(l.reviewStatus),
      legacyStatus: l.reviewStatus,
      score: l.reviewScore,
      riskFlagCount: countRiskFlags(l.reviewRiskFlags),
      decidedAt: l.reviewedAt ? l.reviewedAt.toISOString() : null,
      variantKind: null,
      batchId: null,
      createdAt: l.createdAt.toISOString(),
    })),
  ];

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items.slice(0, 200);
}

function countRiskFlags(raw: unknown): number {
  return Array.isArray(raw) ? raw.length : 0;
}
