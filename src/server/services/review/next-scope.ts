// IA Phase 12 — scope-completion auto-progress resolvers.
//
// CLAUDE.md Madde H'nin "scope tamamlandığında operatör akışı
// kesilmez" gereği: review workspace bir batch / folder bittiğinde
// "next pending scope" sunar. Bu modül o "next pending scope"
// resolver'larını barındırır.
//
// Deterministic ordering kararı: oldest pending. Operatör birikmiş
// işi önce kapatsın diye en eski undecided'lı scope'a yöneliyoruz.
// Newest pending denenseydi yeni gelen iş eskiyi sürekli ötelerdi —
// bu üründe istemediğimiz davranış.
//
// User-scope: tüm sorgular `userId` filtreli; cross-user resolution
// engellenir. Sonuç null'sa "all caught up" — UI canonical exit
// banner'ı gösterir.

import { JobType, MJReviewDecision, type Prisma } from "@prisma/client";
import { db } from "@/server/db";

// ────────────────────────────────────────────────────────────────────────
// MJ batch — next pending batchId for the same user
// ────────────────────────────────────────────────────────────────────────

const MJ_BATCH_METADATA_PATH = ["batchId"];

/**
 * Resolve the next batch (other than `currentBatchId`) that has
 * undecided MidjourneyAssets for this user. Returns null when no
 * other batch is pending.
 *
 * Implementation:
 *   1. Find all MJ assets with `reviewDecision = UNDECIDED`
 *      belonging to the user.
 *   2. Resolve each asset → midjourneyJob → job.metadata.batchId.
 *   3. Group by batchId, drop `currentBatchId`, pick the batch
 *      whose oldest job has the earliest createdAt.
 *
 * The query is bounded by a small limit (200 assets) — enough to
 * find at least one pending batch in any realistic queue, while
 * keeping the round-trip cheap. Operators with >200 undecided MJ
 * assets across batches are an exotic edge case; the resolver
 * picks any pending batch in that band, which is still correct.
 */
export async function getNextPendingBatchId(args: {
  userId: string;
  currentBatchId: string;
}): Promise<{ batchId: string; createdAt: Date } | null> {
  const { userId, currentBatchId } = args;

  // Pull a window of undecided assets with their job lineage.
  const undecidedAssets = await db.midjourneyAsset.findMany({
    where: {
      reviewDecision: MJReviewDecision.UNDECIDED,
      midjourneyJob: { userId },
    },
    select: {
      midjourneyJob: {
        select: {
          job: {
            select: { metadata: true, createdAt: true },
          },
        },
      },
    },
    take: 200,
  });

  // Group by batchId, track the earliest createdAt seen for each.
  const batchOldest = new Map<string, Date>();
  for (const a of undecidedAssets) {
    const md = a.midjourneyJob?.job?.metadata as
      | Record<string, unknown>
      | null
      | undefined;
    if (!md || typeof md !== "object") continue;
    const batchId = (md as { batchId?: unknown }).batchId;
    if (typeof batchId !== "string" || !batchId.length) continue;
    if (batchId === currentBatchId) continue;
    const createdAt = a.midjourneyJob?.job?.createdAt;
    if (!createdAt) continue;
    const existing = batchOldest.get(batchId);
    if (!existing || createdAt < existing) {
      batchOldest.set(batchId, createdAt);
    }
  }

  if (batchOldest.size === 0) return null;

  // Pick the oldest pending batch — operator finishes accumulated
  // work first.
  let oldestBatchId: string | null = null;
  let oldestCreatedAt: Date | null = null;
  for (const [batchId, createdAt] of batchOldest) {
    if (!oldestCreatedAt || createdAt < oldestCreatedAt) {
      oldestBatchId = batchId;
      oldestCreatedAt = createdAt;
    }
  }
  if (!oldestBatchId || !oldestCreatedAt) return null;
  return { batchId: oldestBatchId, createdAt: oldestCreatedAt };
}

// Type sanity check — used by the JSON path filter on batchId queries.
const _MJ_BATCH_METADATA_PATH_TYPE_GUARD: ReadonlyArray<string> =
  MJ_BATCH_METADATA_PATH;
void _MJ_BATCH_METADATA_PATH_TYPE_GUARD;

// ────────────────────────────────────────────────────────────────────────
// Local folder — next pending folder for the same user
// ────────────────────────────────────────────────────────────────────────

/**
 * Resolve the next LocalLibraryAsset folder (other than
 * `currentFolderName`) that has at least one PENDING (undecided)
 * row for this user. Returns null when no other folder is pending.
 *
 * Folder identity is `LocalLibraryAsset.folderName`. The folder
 * with the **oldest pending row** wins — same "operator finishes
 * accumulated work first" reasoning as the MJ resolver above.
 *
 * NEEDS_REVIEW counts as undecided here because it is a pipeline
 * auto-flag, not an operator decision (CLAUDE.md Madde H).
 */
export async function getNextPendingFolderName(args: {
  userId: string;
  currentFolderName: string | null;
}): Promise<{ folderName: string; oldestCreatedAt: Date } | null> {
  const { userId, currentFolderName } = args;

  // GroupBy folderName, keeping only those with pending rows. Prisma
  // groupBy aggregations + ordering by min(createdAt) gives us the
  // oldest-pending winner in one round-trip.
  const grouped = await db.localLibraryAsset.groupBy({
    by: ["folderName"],
    where: {
      userId,
      deletedAt: null,
      isUserDeleted: false,
      reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
      ...(currentFolderName !== null
        ? { folderName: { not: currentFolderName } }
        : {}),
    },
    _min: { createdAt: true },
  });

  if (grouped.length === 0) return null;

  // Sort by oldest createdAt ascending; first wins.
  const sorted = [...grouped]
    .filter(
      (
        g,
      ): g is typeof g & { _min: { createdAt: Date } } =>
        !!g._min.createdAt,
    )
    .sort(
      (a, b) => a._min.createdAt.getTime() - b._min.createdAt.getTime(),
    );

  const winner = sorted[0];
  if (!winner) return null;
  return {
    folderName: winner.folderName,
    oldestCreatedAt: winner._min.createdAt,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Total review-pending counter — used for the workspace's "23 review
// pending" anchor in the top bar info hierarchy.
// ────────────────────────────────────────────────────────────────────────

/**
 * Total review-pending (UNDECIDED) item count across all sources for
 * this user. Includes:
 *   • MidjourneyAsset.reviewDecision === UNDECIDED
 *   • GeneratedDesign.reviewStatus === PENDING or NEEDS_REVIEW
 *   • LocalLibraryAsset.reviewStatus === PENDING or NEEDS_REVIEW
 *
 * Cheap parallel `count` calls — three indexed queries, one round-
 * trip latency. The number is a workspace-wide anchor (CLAUDE.md
 * Madde H), surfaced regardless of which scope the operator is in.
 */
export async function getTotalReviewPendingCount(
  userId: string,
): Promise<number> {
  const [mj, ai, local] = await Promise.all([
    db.midjourneyAsset.count({
      where: {
        reviewDecision: MJReviewDecision.UNDECIDED,
        midjourneyJob: { userId },
      },
    }),
    db.generatedDesign.count({
      where: {
        userId,
        deletedAt: null,
        reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
      },
    }),
    db.localLibraryAsset.count({
      where: {
        userId,
        deletedAt: null,
        isUserDeleted: false,
        reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
      },
    }),
  ]);
  return mj + ai + local;
}

// Type sanity (Prisma JSON filter shape). Not exported — keeps the
// linter happy when the helper is referenced indirectly by future
// resolvers expanding this module.
type _Json = Prisma.JsonFilter;
const _UNUSED: _Json | undefined = undefined;
void _UNUSED;
