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
import { resolveReviewLifecycle, type NotQueuedReason } from "@/server/services/review/lifecycle";
import { getResolvedReviewConfig } from "@/server/services/settings/review.service";
import { getActiveLocalRootFilter } from "@/server/services/local-library/active-root";
import { computeScoringBreakdown } from "@/server/services/review/decision";
import { getUserLocalLibrarySettings } from "@/features/settings/local-library/service";
import { resolveLocalProductTypeKey, resolveLocalFolder } from "@/features/settings/local-library/folder-mapping";

/**
 * IA-31 (CLAUDE.md Madde S — stored decision vs current policy preview) —
 * lazy recompute helper. Eski snapshot'larda yazılı `reviewScore` worker
 * eski algoritmasına göre üretilmiş olabilir (provider raw etkili dönem,
 * pre-deterministic breakdown). UI'da system score'u **bugünkü kurallarla**
 * göstermek için aynı `computeScoringBreakdown` formülünü mevcut risk
 * flag kinds + active criteria üzerinden çalıştırırız.
 *
 * - **Persist YAPILMAZ** — provider çağrılmaz, DB güncellenmez. Sadece
 *   response payload'una projecte edilir.
 * - Cost koruması: yalnız aktif criteria + persisted risk kinds ile
 *   matematik; provider, settings'in dışındadır.
 * - Snapshot eksik (reviewedAt veya reviewProviderSnapshot null) →
 *   `reviewScore`'u dokunmadan döndürürüz (lifecycle zaten not_queued/
 *   queued/running göstereceği için chip hiç render edilmez).
 */
function recomputeStoredScore(
  storedScore: number | null,
  riskFlags: unknown,
  criteria: Parameters<typeof computeScoringBreakdown>[0]["criteria"],
  composeContext?: Parameters<typeof computeScoringBreakdown>[0]["composeContext"],
  /** When false, snapshot is absent — skip recompute and return stored value as-is. */
  hasSnapshot = true,
): number | null {
  if (storedScore === null) return null;
  // Snapshot eksik (reviewedAt veya reviewProviderSnapshot null) →
  // recompute değil; stored score doğrudan döner. Lifecycle "not_queued"
  // veya "queued" chips olacak, skor hiç render edilmez.
  if (!hasSnapshot) return storedScore;
  // Risk flag kinds'i normalize et (Json → string[]). Duplicate'lar
  // computeScoringBreakdown içinde Set ile unique'leştirilir.
  const kinds: string[] = Array.isArray(riskFlags)
    ? (riskFlags
        .filter(
          (f): f is { kind: string } =>
            typeof f === "object" &&
            f !== null &&
            typeof (f as { kind?: unknown }).kind === "string",
        )
        .map((f) => f.kind))
    : [];
  const breakdown = computeScoringBreakdown({
    // providerRaw lazy recompute'ta etkili değil (yeni model rule-based);
    // sadece breakdown.providerRaw field'ı için audit amaçlı set ederiz.
    providerRaw: storedScore,
    riskFlagKinds: kinds,
    criteria,
    // IA-38b — composeContext geçilirse N/A kriterler score'a düşmez;
    // detail panel "Not applicable" gösterimi ile score deductions
    // birebir eşit olur (kullanıcıya görünen failed applicable checks =
    // weight subtractions).
    composeContext,
  });
  return breakdown.finalScore;
}

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
  // IA-34 — batch scope (AI design only). Job.metadata.batchId
  // üzerinden filtre. Aynı reference'tan farklı batch'lerde üretilen
  // variation'lar var; default deep-link scope = batch (reference
  // ancak explicit verildiğinde baskın). Reference + batch ikisi de
  // varsa batch baskın (page loader explicit kontrole sahip).
  batch: z.string().trim().min(1).max(120).optional(),
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

  const { scope, status, page, q, folder, reference, batch } = parsed.data;
  const skip = (page - 1) * PAGE_SIZE;

  // IA-34 — batch lineage `Job.metadata.batchId` üzerinden filtre.
  // Aynı batchId taşıyan tüm jobId'leri toplar; design row'larını bu
  // jobId set'iyle filtreler. Reference ile birlikte verilirse batch
  // baskındır (page loader explicit kontrole sahip; queue endpoint
  // sadece filter uygular).
  let batchJobIds: string[] | null = null;
  if (batch && scope === "design") {
    const jobs = await db.job.findMany({
      where: { userId: user.id, type: "GENERATE_VARIATIONS" as never },
      select: { id: true, metadata: true },
    });
    batchJobIds = jobs
      .filter((j) => {
        const md = j.metadata as Record<string, unknown> | null;
        return (
          md && typeof md === "object" && md.batchId === batch
        );
      })
      .map((j) => j.id);
    // Batch hiçbir job'la eşleşmiyorsa empty result için sentinel
    // ([""]) — Prisma `jobId in []` boş set'i geri döner ama bu
    // davranış sürüm-bağımlı; explicit "" garanti boş.
    if (batchJobIds.length === 0) batchJobIds = [""];
  }

  // IA Phase 27 (CLAUDE.md Madde R) — admin-resolved thresholds flow
  // alongside the queue payload so the client decision derivation
  // (Decision/Outcome block) uses the same source of truth as the
  // worker. Loaded once per request; cheap settings read.
  //
  // IA-31 — criteria de yüklenir; eski snapshot'lardaki `reviewScore`
  // bugünkü criteria + risk kinds matematiğiyle yeniden hesaplanır
  // (`recomputeStoredScore`). Persist yok — yalnız response'a yansır
  // (CLAUDE.md Madde S — stored decision vs current policy preview).
  const { thresholds, criteria, automation } = await getResolvedReviewConfig(user.id);

  if (scope === "design") {
    const where = {
      userId: user.id,
      deletedAt: null,
      ...(status ? { reviewStatus: status } : {}),
      // IA-34 — scope priority: batch > reference. Batch dominantsa
      // referenceId filter UYGULAMA (queue scope'u batch ile tanımlı).
      // Caller (page loader) batch baskınsa reference param'ını
      // göndermez; bu doğrudan koruma sadece API guard'ı.
      ...(batchJobIds
        ? { jobId: { in: batchJobIds } }
        : reference
          ? { referenceId: reference }
          : {}),
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
      // IA-32 (CLAUDE.md Madde V güncellemesi) — undecided artık
      // `reviewStatusSource != USER` ile sayılır. Bu pre-IA-29 dönemde
      // worker'ın `reviewStatus`'e yazdığı eski snapshot'ları
      // (NEEDS_REVIEW, SYSTEM-source APPROVED/REJECTED) da kapsar —
      // operatör için hepsi aynı semantik: "henüz karar vermedim".
      // Operator-truth gate olarak `getOperatorDecision` zaten aynı
      // mantığı UI tarafında uyguluyor; sayım da o axis'i takip eder.
      // Bu sayede `total = kept + rejected + undecided` invariant'ı
      // her zaman korunur (ghost count YOK).
      db.generatedDesign.count({
        where: { ...breakdownWhere, reviewStatusSource: { not: "USER" } },
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
    // IA-34 — batchId resolve. Job.metadata.batchId üzerinden. Card
    // primary scope label batch baskın olduğundan UI'a `batchShortId`
    // expose ediyoruz. Tek round-trip; jobId in (...) ile bulk fetch.
    const jobIds = items
      .map((it) => it.jobId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const jobBatchMap = new Map<string, string>();
    if (jobIds.length > 0) {
      const jobs = await db.job.findMany({
        where: { id: { in: jobIds } },
        select: { id: true, metadata: true },
      });
      for (const j of jobs) {
        const md = j.metadata as Record<string, unknown> | null;
        if (md && typeof md === "object" && typeof md.batchId === "string") {
          jobBatchMap.set(j.id, md.batchId);
        }
      }
    }
    // IA-39 — not_queued reason hints for design items.
    // Designs whose GeneratedDesign.state is QUEUED/RUNNING haven't had
    // a variation worker finish yet — review can't start. Distinguish
    // from "legacy" (design READY/FAIL but no review job ever fired).
    const designStateMap = new Map<string, string>();
    for (const it of items) {
      // We need the variation state to classify not_queued reason.
      // Fetched from DB only for non-ready items (avoiding N+1 for ready items).
    }
    // Bulk-fetch variation state for non-ready designs
    const nonReadyDesignIds = items
      .filter((it) => !readyIds.has(it.id))
      .map((it) => it.id);
    if (nonReadyDesignIds.length > 0) {
      const states = await db.generatedDesign.findMany({
        where: { id: { in: nonReadyDesignIds } },
        select: { id: true, state: true },
      });
      for (const s of states) {
        if (s.state !== null) designStateMap.set(s.id, s.state);
      }
    }
    const designNotQueuedHints = new Map<string, NotQueuedReason>();
    for (const [id, state] of designStateMap) {
      if (state === "QUEUED" || state === "RUNNING") {
        designNotQueuedHints.set(id, "design_pending_worker");
      }
      // READY/FAIL/etc → "legacy" (no hint needed; resolver defaults to "legacy")
    }
    const lifecycleMap = await resolveReviewLifecycle({
      userId: user.id,
      scope: "design",
      assetIds: items.map((it) => it.id),
      readyIds,
      notQueuedHints: designNotQueuedHints,
      autoEnqueueDisabled: !automation.aiAutoEnqueue,
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
          // IA-33 — AI Designs için storage signed URL zaten orijinal
          // provider asset'idir (thumbnail crop yok); aynı URL focus
          // mode'da da kullanılır. UI tek alan üzerinden okur, source
          // bazlı conditional yapmaz.
          fullResolutionUrl: thumbnailUrl,
          reviewStatus: it.reviewStatus,
          reviewStatusSource: it.reviewStatusSource,
          // IA-31 + IA-38b — lazy recompute (CLAUDE.md Madde S).
          // composeContext geçilir; N/A kriterler score'a düşmez —
          // detail panel "Not applicable" diye gösterdiği kriterlerle
          // weight subtractions birebir eşitlenir.
          // Snapshot absent → stored score returned as-is (no recompute).
          reviewScore: recomputeStoredScore(
            it.reviewScore,
            it.reviewRiskFlags,
            criteria,
            {
              productType: it.productType?.key ?? "wall_art",
              format: it.asset.mimeType.replace("image/", "").toLowerCase(),
              hasAlpha: it.asset.hasAlpha,
              sourceKind: "design",
              transformsApplied: [],
            },
            !!(it.reviewedAt && it.reviewProviderSnapshot !== null),
          ),
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
          // IA-39 — not_queued includes reason code for targeted UI copy.
          ...(() => {
            const lc = lifecycleMap.get(it.id) ?? { state: "not_queued" as const, reason: "legacy" as const };
            return {
              reviewLifecycle: lc.state,
              reviewNotQueuedReason: lc.state === "not_queued" ? lc.reason : undefined,
            };
          })(),
          // Pass 24 — source clarity (additive). ProductType.key + reference
          // cuid kısa id; UI ReviewCard "Wall Art · ref-3oa1m" formatında
          // gösterir. Reference detail'e deep-link için referenceId zaten
          // expose edildi.
          source: {
            kind: "design" as const,
            productTypeKey: it.productType?.key ?? null,
            referenceShortId: it.referenceId ? it.referenceId.slice(-6) : null,
            // IA-34 — batch dominance. Card primary scope label batch
            // varsa "batch-XXXXXX" gösterir; yoksa reference. UI tek
            // helper'dan resolve eder.
            batchId: it.jobId ? jobBatchMap.get(it.jobId) ?? null : null,
            batchShortId: it.jobId
              ? (jobBatchMap.get(it.jobId)?.slice(-6) ?? null)
              : null,
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
      // IA-34 — scope priority: batch > reference > queue.
      scope: batch
        ? {
            kind: "batch" as const,
            label: batch,
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
        : reference
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
    // IA-32 — undecided = operatör damgası yok (source != USER). Eski
    // SYSTEM-source NEEDS_REVIEW / APPROVED / REJECTED snapshot'ları
    // bu sayıma girer; kept/rejected sadece USER source. Toplam
    // invariant: `total = kept + rejected + undecided` her zaman.
    db.localLibraryAsset.count({
      where: { ...localBreakdownWhere, reviewStatusSource: { not: "USER" } },
    }),
    // IA-29 — kept/rejected operatör damgası.
    db.localLibraryAsset.count({
      where: { ...localBreakdownWhere, reviewStatus: "APPROVED", reviewStatusSource: "USER" },
    }),
    db.localLibraryAsset.count({
      where: { ...localBreakdownWhere, reviewStatus: "REJECTED", reviewStatusSource: "USER" },
    }),
  ]);

  // IA-35 — local productTypeKey resolve (path-based mapping +
  // convention). Asset metadata'sındaki folder identity üzerinden
  // çözülür; UI EvaluationPanel artık "wall_art" fallback'ine
  // güvenmez — gerçek productType ile checklist applicability
  // hesaplar.
  const localSettings = await getUserLocalLibrarySettings(user.id);
  const localFolderMap = localSettings.folderProductTypeMap ?? {};

  // IA Phase 18 — lifecycle resolve (local branch).
  const localReadyIds = new Set(
    items
      .filter((it) => it.reviewedAt && it.reviewProviderSnapshot)
      .map((it) => it.id),
  );
  // IA-39 / IA-39+ — per-asset not_queued reason hints for local items.
  // Resolve folder mapping for each non-ready item so the lifecycle
  // resolver can report "pending_mapping", "ignored", or
  // "discovery_not_run" instead of the generic "legacy" fallback.
  //
  // discovery_not_run: user has a mapped folder but SCAN_LOCAL_FOLDER
  // has never successfully run. One DB check per queue request (not per
  // asset). If scan has run at least once, we assume the watcher or
  // periodic scan will handle future discoveries; "legacy" is the right
  // fallback for items that pre-date IA-29.
  const lastScanJob = await db.job.findFirst({
    where: { userId: user.id, type: "SCAN_LOCAL_FOLDER", status: "SUCCESS" },
    select: { id: true },
  });
  const hasScanEverRun = lastScanJob !== null;

  const localNotQueuedHints = new Map<string, NotQueuedReason>();
  for (const it of items) {
    if (localReadyIds.has(it.id)) continue;
    const r = resolveLocalFolder({
      folderName: it.folderName,
      folderPath: it.folderPath,
      folderMap: localFolderMap,
    });
    if (r.kind === "pending") {
      localNotQueuedHints.set(it.id, "pending_mapping");
    } else if (r.kind === "ignored") {
      localNotQueuedHints.set(it.id, "ignored");
    } else if (!hasScanEverRun) {
      // Folder is mapped but scan has never run → operator needs to
      // trigger a scan (manually or wait for watcher/periodic).
      localNotQueuedHints.set(it.id, "discovery_not_run");
    }
    // "mapped" + scan has run → no hint; resolver falls through to
    // Job table check → "legacy" if no job row exists.
  }
  const localLifecycleMap = await resolveReviewLifecycle({
    userId: user.id,
    scope: "local",
    assetIds: items.map((it) => it.id),
    readyIds: localReadyIds,
    notQueuedHints: localNotQueuedHints,
    autoEnqueueDisabled: !automation.localAutoEnqueue,
  });

  const itemsWithThumbs = items.map((it) => ({
    id: it.id,
    // Local library: signed URL üretmiyoruz; thumbnailPath varsa proxy
    // endpoint relative URL'ini döneriz (UI'da <img src=...> ile yüklenir).
    // Auth backend tarafında proxy'de uygulanır.
    thumbnailUrl: it.thumbnailPath
      ? `/api/local-library/thumbnail?hash=${encodeURIComponent(it.hash)}`
      : null,
    // IA-33 — Full-resolution URL focus mode için. Grid kart `thumbnailUrl`
    // kullanmaya devam eder (perf); focus mode `fullResolutionUrl` ile
    // orijinal asset'i 760×760 stage'e ölçeklendirir. AI Designs ile
    // preview parity'i bu sayede tam sağlanır.
    fullResolutionUrl: `/api/local-library/asset?hash=${encodeURIComponent(it.hash)}`,
    reviewStatus: it.reviewStatus,
    reviewStatusSource: it.reviewStatusSource,
    // IA-31 + IA-38b — lazy recompute (CLAUDE.md Madde S). Local branch
    // için composeContext: productType resolve edilir (folder mapping >
    // legacy folderName fallback > convention); null ise compose
    // verilmez (geriye dönük TÜM aktif kriterlerle hesap).
    reviewScore: (() => {
      const productType = resolveLocalProductTypeKey({
        folderName: it.folderName,
        folderPath: it.folderPath,
        folderMap: localFolderMap,
      });
      return recomputeStoredScore(
        it.reviewScore,
        it.reviewRiskFlags,
        criteria,
        productType !== null
          ? {
              productType,
              format: it.mimeType.replace("image/", "").toLowerCase(),
              hasAlpha: it.hasAlpha,
              sourceKind: "local-library",
              transformsApplied: [],
            }
          : undefined,
        !!(it.reviewedAt && it.reviewProviderSnapshot !== null),
      );
    })(),
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
    // IA Phase 18 — review scoring lifecycle (CLAUDE.md Madde N).
    // IA-39 — not_queued includes reason code for targeted UI copy.
    ...(() => {
      const lc = localLifecycleMap.get(it.id) ?? { state: "not_queued" as const, reason: "legacy" as const };
      return {
        reviewLifecycle: lc.state,
        reviewNotQueuedReason: lc.state === "not_queued" ? lc.reason : undefined,
      };
    })(),
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
      // IA-35 — resolved productTypeKey (path-based mapping > legacy
      // folderName mapping > convention). Null → folder pending mapping
      // (operatöre Settings → Review'da atama söylenir); UI
      // EvaluationPanel context'i null geçtiğinde checklist'i
      // applicability rules ile değil "no productType" davranışıyla
      // resolve eder. Sahte "wall_art" fallback YOK.
      productTypeKey: resolveLocalProductTypeKey({
        folderName: it.folderName,
        folderPath: it.folderPath,
        folderMap: localFolderMap,
      }),
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
