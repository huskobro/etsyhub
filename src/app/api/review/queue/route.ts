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
          reviewRiskFlags: true,
          reviewedAt: true,
          asset: { select: { storageKey: true } },
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
          riskFlagCount: riskFlagCount(it.reviewRiskFlags),
          reviewedAt: it.reviewedAt?.toISOString() ?? null,
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
        reviewRiskFlags: true,
        reviewedAt: true,
        thumbnailPath: true,
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
    riskFlagCount: riskFlagCount(it.reviewRiskFlags),
    reviewedAt: it.reviewedAt?.toISOString() ?? null,
  }));

  return NextResponse.json({
    items: itemsWithThumbs,
    total,
    page,
    pageSize: PAGE_SIZE,
  });
});
