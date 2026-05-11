// Phase 6 Task 14 — GET /api/review/queue
//
// Review queue listesi: AI tasarımları (scope=design) veya local library
// asset'leri (scope=local). Multi-tenant — userId filter zorunlu, soft-delete
// kayıtları döndürmez.
//
// Sözleşme:
//   - Auth: requireUser. Eksikse 401 (UnauthorizedError).
//   - Query: scope ZORUNLU ("design" | "local"); status OPSİYONEL
//     (PENDING/APPROVED/NEEDS_REVIEW/REJECTED); page OPSİYONEL (default 1).
//   - Geçersiz query => 400 (ValidationError, sessiz fallback YASAK).
//   - Page size 24 sabit (UI grid 4×6 / 6×4 makul; pagination iterasyonu basit).
//   - Soft-delete:
//       design: deletedAt IS NULL
//       local:  deletedAt IS NULL AND isUserDeleted = false (R7 dual-flag)
//
// Storage URL'si:
//   - design: signed URL (1h TTL) provider'dan alınır; fail'de null döner —
//     UI placeholder gösterir (sessiz crash yerine bozuk thumbnail tolere).
//   - local: backend signed URL üretmez; UI /api/local-library/thumbnail
//     proxy endpoint'ini hash ile çağırır. Burada hash'i thumbnail URL'i
//     olarak hazırlarız (relative path).
//
// Performans: (userId, reviewStatus) index migration'da eklendi — queue
// sayfası filtreli sorgularda full-scan yapmıyor.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ReviewStatus } from "@prisma/client";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { getStorage } from "@/providers/storage";
import { logger } from "@/lib/logger";
import { resolveReviewLifecycle } from "@/server/services/review/lifecycle";
import { getReviewThresholds } from "@/server/services/settings/review.service";
import { getActiveLocalRootFilter } from "@/server/services/local-library/active-root";

const QuerySchema = z.object({
  scope: z.enum(["design", "local"]),
  status: z
    .enum([
      ReviewStatus.PENDING,
      ReviewStatus.APPROVED,
      ReviewStatus.NEEDS_REVIEW,
      ReviewStatus.REJECTED,
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  // IA Phase 15 — server-side search. Filter scope'a uygun fields:
  //   • design: ProductType.key + Reference.notes
  //   • local: fileName + folderName.
  q: z.string().trim().min(1).max(120).optional(),
  // IA Phase 16 — scope identity ZOOM. Local için tek folder'a
  // odaklan: queue total + scopeBreakdown bu folder cardinality
  // üzerinden gelir. Empty/missing ⇒ all-folders queue scope.
  folder: z.string().trim().min(1).max(512).optional(),
  // IA Phase 19 — reference scope (AI design only). Tek
  // referansa zoom yapmak: o reference'ın tüm variation'ları
  // bir scope identity oluşturur. Folder'a paralel mantık.
  reference: z.string().trim().min(1).max(120).optional(),
});

const PAGE_SIZE = 24;
const SIGNED_URL_TTL_SECONDS = 3600;

function riskFlagCount(raw: unknown): number {
  if (Array.isArray(raw)) return raw.length;
  return 0;
}

// Phase 6 Dalga B (Task 15): detail panel queue cache'inden okur — ek detail
// fetch gereksiz. Json? alanları olduğu gibi UI'a iletmek için array olarak
// normalize ediyoruz; Json olmayan / boş durumda [] döner. Drift koruması
// için type literal'ı `unknown[]`; UI ReviewRiskFlag tipine cast eder.
function normalizeRiskFlags(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

export const GET = withErrorHandling(async (req: Request) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz query parametreleri",
      parsed.error.flatten(),
    );
  }

  const { scope, status, page, q, folder, reference } = parsed.data;
  const skip = (page - 1) * PAGE_SIZE;

  // IA Phase 27 (CLAUDE.md Madde R) — admin-resolved thresholds flow
  // alongside the queue payload so the client decision derivation
  // (Decision/Outcome block) uses the same source of truth as the
  // worker. Loaded once per request; cheap settings read.
  const thresholds = await getReviewThresholds(user.id);

  if (scope === "design") {
    const where = {
      userId: user.id,
      deletedAt: null,
      ...(status ? { reviewStatus: status } : {}),
      // IA Phase 19 — reference scope ZOOM (design-only). Single
      // reference's variations form a scope identity (CLAUDE.md
      // Madde M).
      ...(reference ? { referenceId: reference } : {}),
      // IA Phase 15 — search across product type key + reference id
      // suffix. Reference.notes is the operator-meaningful free-text
      // field; productType.key is the canonical taxonomy chip the
      // grid card already shows.
      ...(q
        ? {
            OR: [
              { productType: { key: { contains: q, mode: "insensitive" as const } } },
              { reference: { notes: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    // IA Phase 16 — scope identity breakdown. Three parallel counts
    // over the same `where` (without status filter) so the operator
    // top-bar reflects scope-aware undecided/kept/discarded
    // regardless of which decision chip is active. Without status
    // filter ⇒ chip "All" sees the true scope cardinality; with
    // chip ⇒ status filter narrows `total` but breakdown stays
    // honest.
    const breakdownWhere: typeof where = { ...where };
    delete (breakdownWhere as { reviewStatus?: unknown }).reviewStatus;
    const [items, total, undecidedCount, keptCount, discardedCount] =
      await Promise.all([
      db.generatedDesign.findMany({
        where,
        select: {
          id: true,
          reviewStatus: true,
          reviewStatusSource: true,
          reviewScore: true,
          reviewSummary: true,
          reviewRiskFlags: true,
          reviewedAt: true,
          reviewProviderSnapshot: true,
          // IA-29 — advisory + provider raw score (UI debug & audit)
          reviewSuggestedStatus: true,
          reviewProviderRawScore: true,
          // Asset metadata — IA Phase 9 (review focus workspace) needs
          // mimeType / fileSize / dimensions on AI items for the
          // unified info-rail. IA Phase 11 added persisted hasAlpha
          // (Sharp probe at import time); UI shows real Yes/No when
          // present, falls back to format-level hint otherwise.
          asset: {
            select: {
              storageKey: true,
              mimeType: true,
              sizeBytes: true,
              width: true,
              height: true,
              hasAlpha: true,
            },
          },
          // Phase 7 Task 38 — Quick start CTA için (additive):
          // POST /api/selection/sets/quick-start gövdesi referenceId,
          // batchId (== jobId), productTypeId bekler. Burada toplu seçimle
          // ek round-trip'siz card-level CTA mümkün hale gelir.
          referenceId: true,
          productTypeId: true,
          jobId: true,
          // Pass 24 — source clarity: ProductType.key (örn. "wall_art")
          // ReviewCard'da görünür. Reference cuid son 6 karakter de
          // verilir (kullanıcı aynı reference'tan gelen 6-12 variation
          // ayırt edebilsin).
          productType: { select: { key: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      db.generatedDesign.count({ where }),
      // IA-29 — undecided = operatör henüz aksiyon almamış. AI artık
      // reviewStatus'e yazmıyor, sadece reviewSuggestedStatus'a; bu
      // yüzden undecided yalnız PENDING'i içerir.
      db.generatedDesign.count({
        where: { ...breakdownWhere, reviewStatus: "PENDING" },
      }),
      // IA-29 (CLAUDE.md Madde V) — kept/rejected ARTIK operatör damgası:
      // status APPROVED/REJECTED + source = USER. Worker advisory'yi
      // reviewSuggestedStatus'a yazıyor; status'e dokunmuyor. Bu
      // sayede UI'da "kept" filter'ı yalnız operatörün keep dediği
      // item'ları sayar.
      db.generatedDesign.count({
        where: { ...breakdownWhere, reviewStatus: "APPROVED", reviewStatusSource: "USER" },
      }),
      db.generatedDesign.count({
        where: { ...breakdownWhere, reviewStatus: "REJECTED", reviewStatusSource: "USER" },
      }),
    ]);

    // IA Phase 18 — lifecycle resolve. ready = reviewedAt + provider
    // snapshot dolu; kalanlar Job tablosundan türev.
    const readyIds = new Set(
      items
        .filter((it) => it.reviewedAt && it.reviewProviderSnapshot)
        .map((it) => it.id),
    );
    const lifecycleMap = await resolveReviewLifecycle({
      userId: user.id,
      scope: "design",
      assetIds: items.map((it) => it.id),
      readyIds,
    });

    const storage = getStorage();
    const itemsWithThumbs = await Promise.all(
      items.map(async (it) => {
        let thumbnailUrl: string | null = null;
        try {
          thumbnailUrl = await storage.signedUrl(
            it.asset.storageKey,
            SIGNED_URL_TTL_SECONDS,
          );
        } catch (err) {
          logger.warn(
            {
              designId: it.id,
              userId: user.id,
              err: err instanceof Error ? err.message : String(err),
            },
            "review queue signedUrl failed; thumbnail null",
          );
        }
        return {
          id: it.id,
          thumbnailUrl,
          reviewStatus: it.reviewStatus,
          reviewStatusSource: it.reviewStatusSource,
          reviewScore: it.reviewScore,
          reviewSummary: it.reviewSummary,
          riskFlagCount: riskFlagCount(it.reviewRiskFlags),
          riskFlags: normalizeRiskFlags(it.reviewRiskFlags),
          reviewedAt: it.reviewedAt?.toISOString() ?? null,
          reviewProviderSnapshot: it.reviewProviderSnapshot,
          // IA-29 — advisory & provider raw score
          reviewSuggestedStatus: it.reviewSuggestedStatus,
          reviewProviderRawScore: it.reviewProviderRawScore,
          // Phase 7 Task 38: quick start CTA için (additive).
          referenceId: it.referenceId,
          productTypeId: it.productTypeId,
          jobId: it.jobId,
          // IA Phase 18 — review scoring lifecycle (CLAUDE.md Madde N).
          reviewLifecycle: lifecycleMap.get(it.id) ?? "not_queued",
          // Pass 24 — source clarity (additive). ProductType.key + reference
          // cuid kısa id; UI ReviewCard "Wall Art · ref-3oa1m" formatında
          // gösterir. Reference detail'e deep-link için referenceId zaten
          // expose edildi.
          source: {
            kind: "design" as const,
            productTypeKey: it.productType?.key ?? null,
            referenceShortId: it.referenceId ? it.referenceId.slice(-6) : null,
            createdAt: it.createdAt.toISOString(),
            // IA Phase 9 — file metadata for the unified focus
            // workspace info-rail. width/height are nullable on Asset
            // (legacy rows) so we project them as such.
            mimeType: it.asset.mimeType,
            fileSize: it.asset.sizeBytes,
            width: it.asset.width,
            height: it.asset.height,
            // IA Phase 11 — persisted alpha signal (null on legacy
            // rows; UI degrades to format hint).
            hasAlpha: it.asset.hasAlpha,
          },
        };
      }),
    );

    return NextResponse.json({
      items: itemsWithThumbs,
      total,
      page,
      pageSize: PAGE_SIZE,
      // IA Phase 16 — scope identity contract. AI'da scope = "queue"
      // (operatörün filtre kombinasyonu); folder kavramı yok.
      // Breakdown undecided/kept/discarded scope cardinality üzerinden;
      // decided türetilebilir.
      scope: reference
        ? {
            kind: "reference" as const,
            label: reference,
            total: total,
            cardinality: status
              ? total
              : undecidedCount + keptCount + discardedCount,
            breakdown: {
              undecided: undecidedCount,
              kept: keptCount,
              discarded: discardedCount,
            },
          }
        : {
            kind: "queue" as const,
            total: total,
            cardinality: status
              ? total
              : undecidedCount + keptCount + discardedCount,
            breakdown: {
              undecided: undecidedCount,
              kept: keptCount,
              discarded: discardedCount,
            },
          },
      // IA Phase 27 (CLAUDE.md Madde R) — settings-driven policy
      // surfaces alongside the items so client decision derivation
      // mirrors the worker's source of truth.
      policy: { thresholds },
    });
  }

  // scope === "local"
  // IA-29 — aktif rootFolderPath dışındaki asset'ler review listesinde
  // gözükmez (CLAUDE.md Madde V). Asset'ler silinmiyor, sadece gizli.
  const rootFilter = await getActiveLocalRootFilter(user.id);
  const localWhere = {
    userId: user.id,
    deletedAt: null,
    isUserDeleted: false,
    ...rootFilter,
    ...(status ? { reviewStatus: status } : {}),
    // IA Phase 16 — scope identity ZOOM. Folder filter aktifse
    // top-bar sayaçları + Item N/M bu folder cardinality üzerinden
    // çalışır. Yoksa scope = entire local queue.
    ...(folder ? { folderName: folder } : {}),
    // IA Phase 15 — search across fileName + folderName. Both indexed
    // by `(userId, folderName)` already; insensitive contains keeps
    // the query cheap on typical libraries.
    ...(q
      ? {
          OR: [
            { fileName: { contains: q, mode: "insensitive" as const } },
            { folderName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  // Breakdown without status filter — chip-agnostic scope sayım.
  const localBreakdownWhere: typeof localWhere = { ...localWhere };
  delete (localBreakdownWhere as { reviewStatus?: unknown }).reviewStatus;
  const [items, total, undecidedCount, keptCount, discardedCount] =
    await Promise.all([
    db.localLibraryAsset.findMany({
      where: localWhere,
      select: {
        id: true,
        hash: true,
        reviewStatus: true,
        reviewStatusSource: true,
        reviewScore: true,
        reviewSummary: true,
        reviewRiskFlags: true,
        reviewedAt: true,
        reviewProviderSnapshot: true,
        // IA-29 — advisory + provider raw score
        reviewSuggestedStatus: true,
        reviewProviderRawScore: true,
        thumbnailPath: true,
        // Pass 24 — source/path clarity: kullanıcı review ekranında
        // "bu görsel hangi klasörden / dosyadan geldi" bilgisini almalı.
        // Mevcut DB alanları zaten doluydu (Phase 5 scanner upsert eder);
        // sadece API response'a expose ediyoruz. UI'de dosya adı + klasör
        // + kalite skoru + boyut + dpi gösterilir.
        folderName: true,
        fileName: true,
        folderPath: true,
        qualityScore: true,
        qualityReasons: true,
        width: true,
        height: true,
        dpi: true,
        // IA Phase 9 — file metadata for the unified focus workspace
        // info-rail.
        mimeType: true,
        fileSize: true,
        // IA Phase 11 — persisted Sharp alpha probe (null on legacy
        // rows that haven't been re-scanned yet).
        hasAlpha: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.localLibraryAsset.count({ where: localWhere }),
    // IA-29 — undecided = PENDING (operatör damgası yok).
    db.localLibraryAsset.count({
      where: { ...localBreakdownWhere, reviewStatus: "PENDING" },
    }),
    // IA-29 — kept/rejected operatör damgası.
    db.localLibraryAsset.count({
      where: { ...localBreakdownWhere, reviewStatus: "APPROVED", reviewStatusSource: "USER" },
    }),
    db.localLibraryAsset.count({
      where: { ...localBreakdownWhere, reviewStatus: "REJECTED", reviewStatusSource: "USER" },
    }),
  ]);

  // IA Phase 18 — lifecycle resolve (local branch).
  const localReadyIds = new Set(
    items
      .filter((it) => it.reviewedAt && it.reviewProviderSnapshot)
      .map((it) => it.id),
  );
  const localLifecycleMap = await resolveReviewLifecycle({
    userId: user.id,
    scope: "local",
    assetIds: items.map((it) => it.id),
    readyIds: localReadyIds,
  });

  const itemsWithThumbs = items.map((it) => ({
    id: it.id,
    // Local library: signed URL üretmiyoruz; thumbnailPath varsa proxy
    // endpoint relative URL'ini döneriz (UI'da <img src=...> ile yüklenir).
    // Auth backend tarafında proxy'de uygulanır.
    thumbnailUrl: it.thumbnailPath
      ? `/api/local-library/thumbnail?hash=${encodeURIComponent(it.hash)}`
      : null,
    reviewStatus: it.reviewStatus,
    reviewStatusSource: it.reviewStatusSource,
    reviewScore: it.reviewScore,
    reviewSummary: it.reviewSummary,
    riskFlagCount: riskFlagCount(it.reviewRiskFlags),
    riskFlags: normalizeRiskFlags(it.reviewRiskFlags),
    reviewedAt: it.reviewedAt?.toISOString() ?? null,
    reviewProviderSnapshot: it.reviewProviderSnapshot,
    // IA-29 — advisory + provider raw score
    reviewSuggestedStatus: it.reviewSuggestedStatus,
    reviewProviderRawScore: it.reviewProviderRawScore,
    // Phase 7 Task 38 (additive): local-library asset'leri için Quick start
    // anlamlı değil — variation batch / reference / productType yok.
    // UI ReviewCard buton render'ını jobId === null kontrolüyle gizler.
    referenceId: null,
    productTypeId: null,
    jobId: null,
    // IA Phase 18 — review scoring lifecycle.
    reviewLifecycle: localLifecycleMap.get(it.id) ?? "not_queued",
    // Pass 24 — source clarity (additive)
    source: {
      kind: "local-library" as const,
      folderName: it.folderName,
      fileName: it.fileName,
      folderPath: it.folderPath,
      qualityScore: it.qualityScore,
      width: it.width,
      height: it.height,
      dpi: it.dpi,
      // IA Phase 9 — file metadata for the unified focus workspace.
      mimeType: it.mimeType,
      fileSize: it.fileSize,
      qualityReasons: it.qualityReasons,
      // IA Phase 11 — persisted Sharp alpha probe.
      hasAlpha: it.hasAlpha,
    },
  }));

  return NextResponse.json({
    items: itemsWithThumbs,
    total,
    page,
    pageSize: PAGE_SIZE,
    // IA Phase 16 — scope identity contract.
    //   • folder filter aktif ⇒ scope.kind = "folder", label = folderName
    //   • aksi halde scope.kind = "queue" (entire local queue)
    // cardinality: chip "All"da scope toplam item; status chip'i
    // aktifken filtered total. Operatör Item N/M'yi hangi sayıyla
    // okuyor: cardinality (UI bunu kullanır).
    scope: folder
      ? {
          kind: "folder" as const,
          label: folder,
          total: total,
          cardinality: status
            ? total
            : undecidedCount + keptCount + discardedCount,
          breakdown: {
            undecided: undecidedCount,
            kept: keptCount,
            discarded: discardedCount,
          },
        }
      : {
          kind: "queue" as const,
          total: total,
          cardinality: status
            ? total
            : undecidedCount + keptCount + discardedCount,
          breakdown: {
            undecided: undecidedCount,
            kept: keptCount,
            discarded: discardedCount,
          },
        },
    // IA Phase 27 (CLAUDE.md Madde R) — settings-driven policy
    // surfaces alongside the items.
    policy: { thresholds },
  });
});
