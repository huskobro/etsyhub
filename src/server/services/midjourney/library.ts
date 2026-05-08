// Pass 88 — Asset Library V1.
//
// Operatör artık ürettiği tüm görselleri tek bir yerden bulabilir,
// filtreleyebilir ve gezerken job/batch/template/parent-lineage'a
// geçebilir.
//
// Tasarım:
//   - User-scoped (Asset.userId = session.user.id)
//   - Schema-zero — sadece relational read; mevcut MidjourneyAsset
//     + Asset + MidjourneyJob + Job tabloları yetiyor.
//   - Filter:
//       * variantKind (GRID/UPSCALE/VARIATION/DESCRIBE) — opsiyonel
//       * batchId (Job.metadata.batchId) — opsiyonel
//       * templateId (Job.metadata.batchTemplateId) — opsiyonel
//       * dayFilter (recent/7d/30d/all) — opsiyonel
//       * search (prompt LIKE %q%) — opsiyonel
//   - Pagination: cursor-tabanlı (importedAt, id) — keyset sayfalama
//     stabil sıra için.
//   - Lineage: parentAssetId opsiyonel — UI'da rozet + tıklanınca
//     parent asset detayına gidiş.

import { MJVariantKind, type Prisma } from "@prisma/client";
import { db } from "@/server/db";

export type LibraryDayFilter = "recent" | "7d" | "30d" | "all";

export type LibraryFilter = {
  /** Filter by variant kind (GRID/UPSCALE/VARIATION/DESCRIBE). */
  variantKind?: MJVariantKind;
  /** Job.metadata.batchId match. */
  batchId?: string;
  /** Job.metadata.batchTemplateId match. */
  templateId?: string;
  /**
   * Parent MidjourneyAsset filter — sadece bu parent'ın children'ını döner.
   * Lineage gezinmesi için (Card'daki "↑ parent" → "bu parent'ın
   * altındaki tüm child asset'ler" sayfası).
   */
  parentAssetId?: string;
  /** Time window. Default "recent" (=7d). */
  dayFilter?: LibraryDayFilter;
  /** Free-text search (prompt ilike %q%). */
  search?: string;
  /** Sayfa boyutu. Default 48. */
  limit?: number;
  /** Cursor: önceki sayfanın son card'ının id'si. */
  cursorId?: string;
};

export type LibraryCard = {
  /** MidjourneyAsset id (lineage için stable key). */
  midjourneyAssetId: string;
  /** Asset id — AssetThumb için signed URL fetch'inde kullanılır. */
  assetId: string;
  /** Grid index (0..3) — variant info için. */
  gridIndex: number;
  /** Variant kind. */
  variantKind: MJVariantKind;
  /** MJ action label (örn. "U1", "V3"). */
  mjActionLabel: string | null;
  /** Parent MidjourneyAsset id (varsa) — lineage gezinmesi için. */
  parentAssetId: string | null;
  /** Asset import zamanı. */
  importedAt: Date;

  /** Job entity (job detail link için). */
  midjourneyJobId: string;
  /** Job kind (GENERATE/UPSCALE/VARIATION/DESCRIBE). */
  jobKind: string;
  /** Prompt snapshot (truncate UI tarafında). */
  prompt: string;

  /** Pass 84 batch identity (varsa). */
  batchId: string | null;
  /** Pass 79/80 template identity (varsa). */
  templateId: string | null;
  /** Pass 79 expanded prompt (template expansion sonrası). */
  expandedPrompt: string | null;
};

export type LibraryPage = {
  cards: LibraryCard[];
  /** Sayfa kapasitesi dolduysa bir sonraki cursor. */
  nextCursor: string | null;
  /** Filtre uygulanmış toplam sayı (count). 1000+ ise -1 döner. */
  totalCount: number;
};

const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 100;

function dayFilterToDate(filter: LibraryDayFilter | undefined): Date | null {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  switch (filter) {
    case "recent":
      return new Date(now - 7 * day);
    case "7d":
      return new Date(now - 7 * day);
    case "30d":
      return new Date(now - 30 * day);
    case "all":
    case undefined:
      return null;
    default:
      return null;
  }
}

/**
 * Operatör için kütüphane sayfası listesi.
 *
 * @param userId Owner — cross-user erişim engeli için zorunlu.
 * @param filter Search + filter + cursor.
 */
export async function listLibraryAssets(
  userId: string,
  filter: LibraryFilter = {},
): Promise<LibraryPage> {
  const limit = Math.min(filter.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const since = dayFilterToDate(filter.dayFilter ?? "recent");

  // Asset where: user-scope + opsiyonel time window.
  // Asset.midjourneyAsset üzerinden join yapacağız; MidjourneyAsset için
  // de eşit filter (variantKind, job batch metadata) eklenir.

  const mjAssetWhere: Prisma.MidjourneyAssetWhereInput = {
    asset: { userId, deletedAt: null },
  };
  if (filter.variantKind) {
    mjAssetWhere.variantKind = filter.variantKind;
  }
  if (filter.parentAssetId) {
    mjAssetWhere.parentAssetId = filter.parentAssetId;
  }
  if (since) {
    mjAssetWhere.importedAt = { gte: since };
  }

  // Pass 84 batch + Pass 79/80 template — Job.metadata üzerinden filter.
  // MidjourneyJob → Job (jobId FK) → metadata.batchId / batchTemplateId.
  // Prisma JSON path filter Type'ı `is { ... }` nested context'te bazen
  // dar type infer ediyor; batches.ts'in çalışan pattern'iyle aynı yapı
  // — explicit `is` clause + JsonFilter cast yerine `equals` literal.
  const jobWhere: Prisma.MidjourneyJobWhereInput = {};
  if (filter.batchId) {
    jobWhere.job = {
      is: {
        metadata: {
          path: ["batchId"],
          equals: filter.batchId,
        } as Prisma.JsonFilter,
      },
    };
  } else if (filter.templateId) {
    jobWhere.job = {
      is: {
        metadata: {
          path: ["batchTemplateId"],
          equals: filter.templateId,
        } as Prisma.JsonFilter,
      },
    };
  }
  if (filter.search && filter.search.trim().length > 0) {
    jobWhere.prompt = { contains: filter.search.trim(), mode: "insensitive" };
  }
  if (Object.keys(jobWhere).length > 0) {
    mjAssetWhere.midjourneyJob = { is: jobWhere };
  }

  // Cursor — keyset sayfalama (importedAt desc, id desc).
  // Prisma cursor pagination: skip 1 + cursor.
  // NOT: cursor + skip inline veriliyor; ayrı `cursorClause` const'a
  // çıkarsam tipler `MidjourneyAssetFindManyArgs` üst tipine genişler ve
  // include bilgisi kaybolur — TS27.x infer regression'u.
  const rows = await db.midjourneyAsset.findMany({
    where: mjAssetWhere,
    include: {
      midjourneyJob: {
        select: {
          id: true,
          kind: true,
          prompt: true,
          jobId: true,
          job: {
            select: { metadata: true },
          },
        },
      },
    },
    orderBy: [{ importedAt: "desc" }, { id: "desc" }],
    take: limit + 1, // +1 → next cursor için
    ...(filter.cursorId
      ? { cursor: { id: filter.cursorId }, skip: 1 }
      : {}),
  });

  const sliced = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const nextCursor = hasMore ? sliced[sliced.length - 1]!.id : null;

  // Total count — sayım ayrı query (filter-aware, cursor'dan bağımsız).
  // 1000+ olabileceği için heavy count'tan kaçın: take 1001 + check.
  const countSample = await db.midjourneyAsset.count({
    where: mjAssetWhere,
    take: 1001,
  });
  const totalCount = countSample > 1000 ? -1 : countSample;

  const cards: LibraryCard[] = sliced.map((r) => {
    const md = (r.midjourneyJob.job?.metadata ?? null) as Record<
      string,
      unknown
    > | null;
    const batchId =
      md && typeof md["batchId"] === "string" ? (md["batchId"] as string) : null;
    const templateId =
      md && typeof md["batchTemplateId"] === "string"
        ? (md["batchTemplateId"] as string)
        : null;
    const expandedPrompt =
      md && typeof md["prompt"] === "string"
        ? (md["prompt"] as string)
        : null;

    return {
      midjourneyAssetId: r.id,
      assetId: r.assetId,
      gridIndex: r.gridIndex,
      variantKind: r.variantKind,
      mjActionLabel: r.mjActionLabel,
      parentAssetId: r.parentAssetId,
      importedAt: r.importedAt,
      midjourneyJobId: r.midjourneyJob.id,
      jobKind: r.midjourneyJob.kind,
      prompt: r.midjourneyJob.prompt,
      batchId,
      templateId,
      expandedPrompt,
    };
  });

  return { cards, nextCursor, totalCount };
}

/**
 * Tek bir asset'in lineage zinciri (parent → grandparent → ...).
 * UI'da Card detail modalı veya breadcrumb için.
 *
 * @param midjourneyAssetId Başlangıç asset.
 * @param userId Owner — cross-user erişim engeli için zorunlu.
 */
export async function getLibraryLineage(
  midjourneyAssetId: string,
  userId: string,
): Promise<LibraryCard[]> {
  const chain: LibraryCard[] = [];
  let currentId: string | null = midjourneyAssetId;
  let safetyCounter = 0;

  while (currentId !== null && safetyCounter < 8) {
    safetyCounter++;
    const lookupId: string = currentId;
    const row = await db.midjourneyAsset.findFirst({
      where: { id: lookupId, asset: { userId } },
      include: {
        midjourneyJob: {
          select: {
            id: true,
            kind: true,
            prompt: true,
            job: { select: { metadata: true } },
          },
        },
      },
    });
    if (!row) break;

    const md = (row.midjourneyJob.job?.metadata ?? null) as Record<
      string,
      unknown
    > | null;
    const batchId =
      md && typeof md["batchId"] === "string" ? (md["batchId"] as string) : null;
    const templateId =
      md && typeof md["batchTemplateId"] === "string"
        ? (md["batchTemplateId"] as string)
        : null;
    const expandedPrompt =
      md && typeof md["prompt"] === "string"
        ? (md["prompt"] as string)
        : null;

    chain.push({
      midjourneyAssetId: row.id,
      assetId: row.assetId,
      gridIndex: row.gridIndex,
      variantKind: row.variantKind,
      mjActionLabel: row.mjActionLabel,
      parentAssetId: row.parentAssetId,
      importedAt: row.importedAt,
      midjourneyJobId: row.midjourneyJob.id,
      jobKind: row.midjourneyJob.kind,
      prompt: row.midjourneyJob.prompt,
      batchId,
      templateId,
      expandedPrompt,
    });

    currentId = row.parentAssetId;
  }

  return chain;
}

/**
 * Library özet sayıları — Control Center entry için.
 * variantKind breakdown + son 7 gün.
 */
export async function getLibrarySummary(userId: string): Promise<{
  recent7d: number;
  byVariantKind: Record<MJVariantKind, number>;
}> {
  const since = dayFilterToDate("7d")!;
  const recent7d = await db.midjourneyAsset.count({
    where: {
      asset: { userId, deletedAt: null },
      importedAt: { gte: since },
    },
  });

  const breakdown = await db.midjourneyAsset.groupBy({
    by: ["variantKind"],
    where: { asset: { userId, deletedAt: null } },
    _count: { _all: true },
  });

  const byVariantKind: Record<MJVariantKind, number> = {
    GRID: 0,
    UPSCALE: 0,
    VARIATION: 0,
    DESCRIBE: 0,
  };
  for (const b of breakdown) {
    byVariantKind[b.variantKind] = b._count._all;
  }

  return { recent7d, byVariantKind };
}
