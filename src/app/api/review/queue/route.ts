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

  const { scope, status, page } = parsed.data;
  const skip = (page - 1) * PAGE_SIZE;

  if (scope === "design") {
    const where = {
      userId: user.id,
      deletedAt: null,
      ...(status ? { reviewStatus: status } : {}),
    };
    const [items, total] = await Promise.all([
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
          // Asset metadata — IA Phase 9 (review focus workspace) needs
          // mimeType / fileSize / dimensions on AI items for the
          // unified info-rail. Format-capability hint (PNG/WebP can
          // carry alpha; JPEG cannot) is derived from mimeType in the
          // UI; we don't run a Sharp probe here for performance.
          asset: {
            select: {
              storageKey: true,
              mimeType: true,
              sizeBytes: true,
              width: true,
              height: true,
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
    ]);

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
          // Phase 7 Task 38: quick start CTA için (additive).
          referenceId: it.referenceId,
          productTypeId: it.productTypeId,
          jobId: it.jobId,
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
          },
        };
      }),
    );

    return NextResponse.json({
      items: itemsWithThumbs,
      total,
      page,
      pageSize: PAGE_SIZE,
    });
  }

  // scope === "local"
  const localWhere = {
    userId: user.id,
    deletedAt: null,
    isUserDeleted: false,
    ...(status ? { reviewStatus: status } : {}),
  };
  const [items, total] = await Promise.all([
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
        // info-rail. mimeType drives the transparency-capability hint
        // (PNG/WebP can carry alpha; JPEG cannot) and fileSize gives
        // the operator a print-readiness signal.
        mimeType: true,
        fileSize: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    db.localLibraryAsset.count({ where: localWhere }),
  ]);

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
    // Phase 7 Task 38 (additive): local-library asset'leri için Quick start
    // anlamlı değil — variation batch / reference / productType yok.
    // UI ReviewCard buton render'ını jobId === null kontrolüyle gizler.
    referenceId: null,
    productTypeId: null,
    jobId: null,
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
    },
  }));

  return NextResponse.json({
    items: itemsWithThumbs,
    total,
    page,
    pageSize: PAGE_SIZE,
  });
});
