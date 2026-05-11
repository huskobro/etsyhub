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
import { getActiveLocalRootFilter } from "@/server/services/local-library/active-root";

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
}): Promise<{
  folderName: string;
  oldestCreatedAt: Date;
  firstPendingItemId: string | null;
} | null> {
  const { userId, currentFolderName } = args;
  const rootFilter = await getActiveLocalRootFilter(userId);

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
      ...rootFilter,
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

  // IA Phase 16 — sıradaki folder'ın ilk pending item id'sini de
  // döndür ki UI auto-next CTA'sında deep-link kurabilsin (operatör
  // folder grid'ine değil, doğrudan ilk pending item'ın focus
  // workspace'ine iner). 1 row, indexed lookup; cheap.
  const firstPending = await db.localLibraryAsset.findFirst({
    where: {
      userId,
      deletedAt: null,
      isUserDeleted: false,
      folderName: winner.folderName,
      reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
      ...rootFilter,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return {
    folderName: winner.folderName,
    oldestCreatedAt: winner._min.createdAt,
    firstPendingItemId: firstPending?.id ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Total review-pending counter — used for the workspace's "23 review
// pending" anchor in the top bar info hierarchy.
// ────────────────────────────────────────────────────────────────────────

/**
 * IA Phase 18 — directional folder navigation (prev/next).
 *
 * Returns the folder immediately **before** and **after** the current
 * one in the deterministic ordering used by the queue (folderName
 * alphabetical, oldest-pending tiebreaker).
 *
 * Operatör scope ekseninde bilinçli olarak ilerlemek istediğinde
 * (`]` shortcut) sıradaki folder'ın ilk pending item'ına; geri
 * dönmek istediğinde (`[`) önceki folder'ın ilk pending item'ına
 * iner. Tamamlanmış folder'lar (undecided=0) gezinti listesinde
 * yer almaz — sadece içinde iş kalanlara köprü kurarız.
 */
export async function getAdjacentPendingFolders(args: {
  userId: string;
  currentFolderName: string | null;
}): Promise<{
  prev: { folderName: string; firstPendingItemId: string | null } | null;
  next: { folderName: string; firstPendingItemId: string | null } | null;
}> {
  const { userId, currentFolderName } = args;
  const rootFilter = await getActiveLocalRootFilter(userId);
  // All folders the user has (alphabetical) plus the pending subset.
  // Current folder may be all-kept (not pending) — we still need to
  // know its alphabetical position so we can pick the *adjacent
  // pending* folders left and right of it.
  const [allFolders, pendingGrouped] = await Promise.all([
    db.localLibraryAsset.groupBy({
      by: ["folderName"],
      where: {
        userId,
        deletedAt: null,
        isUserDeleted: false,
        ...rootFilter,
      },
      orderBy: { folderName: "asc" },
    }),
    db.localLibraryAsset.groupBy({
      by: ["folderName"],
      where: {
        userId,
        deletedAt: null,
        isUserDeleted: false,
        reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
        ...rootFilter,
      },
    }),
  ]);
  const allNames = allFolders.map((g) => g.folderName);
  const pendingNames = new Set(pendingGrouped.map((g) => g.folderName));
  if (pendingNames.size === 0) return { prev: null, next: null };

  // Anchor index — current folder's position in the alphabetical list,
  // or -1 if it doesn't exist. We then walk left/right looking for
  // pending neighbours.
  const idx = currentFolderName ? allNames.indexOf(currentFolderName) : -1;
  let prevName: string | null = null;
  let nextName: string | null = null;
  if (idx >= 0) {
    for (let i = idx - 1; i >= 0; i--) {
      if (pendingNames.has(allNames[i]!)) {
        prevName = allNames[i]!;
        break;
      }
    }
    for (let i = idx + 1; i < allNames.length; i++) {
      if (pendingNames.has(allNames[i]!)) {
        nextName = allNames[i]!;
        break;
      }
    }
  } else {
    // Current folder is unknown; default to the first pending folder
    // as "next" and leave prev empty so the operator at least has one
    // working direction.
    nextName = [...pendingNames][0] ?? null;
  }

  async function firstPending(folderName: string | null) {
    if (!folderName) return null;
    const row = await db.localLibraryAsset.findFirst({
      where: {
        userId,
        deletedAt: null,
        isUserDeleted: false,
        folderName,
        reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
        ...rootFilter,
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return { folderName, firstPendingItemId: row?.id ?? null };
  }

  const [prev, next] = await Promise.all([
    firstPending(prevName ?? null),
    firstPending(nextName ?? null),
  ]);
  return { prev, next };
}

// ────────────────────────────────────────────────────────────────────────
// Reference (AI design) — adjacent + listing
// ────────────────────────────────────────────────────────────────────────

/**
 * IA Phase 19 — reference scope navigation. Reference scope = single
 * `Reference.id` whose `GeneratedDesign.referenceId` rows form a
 * review group. Operatör `,` / `.` shortcut'ı veya scope picker ile
 * önceki/sonraki pending reference'a geçer.
 */
export async function getAdjacentPendingReferences(args: {
  userId: string;
  currentReferenceId: string | null;
}): Promise<{
  prev: { referenceId: string; firstPendingItemId: string | null } | null;
  next: { referenceId: string; firstPendingItemId: string | null } | null;
}> {
  const { userId, currentReferenceId } = args;
  const [allRefs, pendingGrouped] = await Promise.all([
    db.generatedDesign.groupBy({
      by: ["referenceId"],
      where: { userId, deletedAt: null },
      orderBy: { referenceId: "asc" },
    }),
    db.generatedDesign.groupBy({
      by: ["referenceId"],
      where: {
        userId,
        deletedAt: null,
                reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
      },
    }),
  ]);
  const allIds = allRefs
    .map((g) => g.referenceId)
    .filter((id): id is string => id !== null);
  const pendingIds = new Set(
    pendingGrouped
      .map((g) => g.referenceId)
      .filter((id): id is string => id !== null),
  );
  if (pendingIds.size === 0) return { prev: null, next: null };

  const idx = currentReferenceId ? allIds.indexOf(currentReferenceId) : -1;
  let prevId: string | null = null;
  let nextId: string | null = null;
  if (idx >= 0) {
    for (let i = idx - 1; i >= 0; i--) {
      if (pendingIds.has(allIds[i]!)) {
        prevId = allIds[i]!;
        break;
      }
    }
    for (let i = idx + 1; i < allIds.length; i++) {
      if (pendingIds.has(allIds[i]!)) {
        nextId = allIds[i]!;
        break;
      }
    }
  } else {
    nextId = [...pendingIds][0] ?? null;
  }

  async function firstPending(refId: string | null) {
    if (!refId) return null;
    const row = await db.generatedDesign.findFirst({
      where: {
        userId,
        deletedAt: null,
        referenceId: refId,
        reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return { referenceId: refId, firstPendingItemId: row?.id ?? null };
  }

  const [prev, next] = await Promise.all([
    firstPending(prevId),
    firstPending(nextId),
  ]);
  return { prev, next };
}

// ────────────────────────────────────────────────────────────────────────
// Scope picker — list all pending scopes (folders / batches / refs)
// ────────────────────────────────────────────────────────────────────────

/**
 * IA Phase 19 — top-bar scope picker. Operatör scope kind'ına bağlı
 * pending scope listesini görür ve birine atlar. Listede yalnız
 * aktif iş kalan scope'lar (undecided > 0); tamamlanmışlar dışta
 * tutulur (operatör hâlâ iş olan yere odaklanır).
 *
 * Sıralama: folder/reference için alphabetical; batch için
 * oldest-pending. Sonuçlar pageSize'a sınırlandırılır (UI dropdown
 * için 50 yeterli).
 */
export async function listPendingScopes(args: {
  userId: string;
  kind: "folder" | "batch" | "reference";
}): Promise<Array<{ id: string; label: string; pendingCount: number; firstPendingItemId: string | null }>> {
  const { userId, kind } = args;

  if (kind === "folder") {
    const rootFilter = await getActiveLocalRootFilter(userId);
    const grouped = await db.localLibraryAsset.groupBy({
      by: ["folderName"],
      where: {
        userId,
        deletedAt: null,
        isUserDeleted: false,
        reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
        ...rootFilter,
      },
      _count: { id: true },
      orderBy: { folderName: "asc" },
      take: 50,
    });
    const rows = await Promise.all(
      grouped.map(async (g) => {
        const first = await db.localLibraryAsset.findFirst({
          where: {
            userId,
            deletedAt: null,
            isUserDeleted: false,
            folderName: g.folderName,
            reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
            ...rootFilter,
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        return {
          id: g.folderName,
          label: g.folderName,
          pendingCount: g._count.id,
          firstPendingItemId: first?.id ?? null,
        };
      }),
    );
    return rows;
  }

  if (kind === "reference") {
    const grouped = await db.generatedDesign.groupBy({
      by: ["referenceId"],
      where: {
        userId,
        deletedAt: null,
                reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
      },
      _count: { id: true },
      orderBy: { referenceId: "asc" },
      take: 50,
    });
    const refs = grouped
      .map((g) => g.referenceId)
      .filter((id): id is string => id !== null);
    const rows = await Promise.all(
      refs.map(async (refId) => {
        const [first, count] = await Promise.all([
          db.generatedDesign.findFirst({
            where: {
              userId,
              deletedAt: null,
              referenceId: refId,
              reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
            },
            orderBy: { createdAt: "asc" },
            select: { id: true },
          }),
          db.generatedDesign.count({
            where: {
              userId,
              deletedAt: null,
              referenceId: refId,
              reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
            },
          }),
        ]);
        return {
          id: refId,
          label: `ref-${refId.slice(-6)}`,
          pendingCount: count,
          firstPendingItemId: first?.id ?? null,
        };
      }),
    );
    return rows;
  }

  // kind === "batch" — Job.metadata.batchId path; client-side filter
  // (matches existing pattern in next-scope.ts).
  const variationJobs = await db.job.findMany({
    where: { userId, type: JobType.GENERATE_VARIATIONS },
    select: { id: true, metadata: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const byBatch = new Map<string, { jobIds: string[]; oldest: Date }>();
  for (const j of variationJobs) {
    const md = j.metadata as Record<string, unknown> | null;
    const batchId =
      md && typeof md === "object" && typeof md.batchId === "string"
        ? md.batchId
        : null;
    if (!batchId) continue;
    const existing = byBatch.get(batchId);
    if (existing) existing.jobIds.push(j.id);
    else byBatch.set(batchId, { jobIds: [j.id], oldest: j.createdAt });
  }
  const rows = await Promise.all(
    [...byBatch.entries()].map(async ([batchId, info]) => {
      const [first, count] = await Promise.all([
        db.generatedDesign.findFirst({
          where: {
            userId,
            deletedAt: null,
            jobId: { in: info.jobIds },
            reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
          },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        }),
        db.generatedDesign.count({
          where: {
            userId,
            deletedAt: null,
            jobId: { in: info.jobIds },
            reviewStatus: { in: ["PENDING", "NEEDS_REVIEW"] },
          },
        }),
      ]);
      if (count === 0) return null; // closed batch — drop
      return {
        id: batchId,
        label: `batch ${batchId.slice(0, 8)}`,
        pendingCount: count,
        firstPendingItemId: first?.id ?? null,
      };
    }),
  );
  return rows.filter((r): r is NonNullable<typeof r> => r !== null);
}

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
  // IA-29 — local branch'i aktif rootFolderPath ile sınırla
  // (CLAUDE.md Madde V). AI design + MJ asset cloud-stored → path
  // filtresinden bağımsız.
  const rootFilter = await getActiveLocalRootFilter(userId);

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
        ...rootFilter,
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
