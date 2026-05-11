// Phase 6 Dalga B (Task 16+17) — POST /api/review/decisions/bulk
//
// Tek endpoint; üç action — discriminated union (Karar 6, Not 1):
//   - approve: USER override (skip-on-risk)
//   - reject:  USER override (tüm seçim, skip-on-risk YOK)
//   - delete:  SADECE local scope (Not 1, Zod literal); soft-delete
//              (isUserDeleted=true + deletedAt=now) — Karar 5.
//
// Sözleşme:
//   - Auth: requireUser (Phase 5).
//   - Multi-tenant: ownership filter (userId) + soft-delete filter
//     (deletedAt=null + local için isUserDeleted=false) ZORUNLU. Cross-user
//     id'ler skippedNotFound olarak sayılır.
//   - Action=delete + scope=design ⇒ 400 (Zod compile-time enforce).
//   - Skip-on-risk: SADECE action=approve durumunda; reviewRiskFlags array'i
//     boş değilse atlanır (UI confirm dialog'da bu sayı önceden hint olarak
//     gösterilir).
//   - Race-safe: USER yazımı zaten always-wins (sticky helper sözleşmesi);
//     bulk endpoint'te ek WHERE guard gerekmez. Worker tarafı `updateMany
//     WHERE not USER` ile USER yazısını override etmiyor.
//
// Response shape (Not 2):
//   {
//     requested: number,         // body.ids.length raw (dedup öncesi)
//     approved?: number,         // action=approve
//     rejected?: number,         // action=reject
//     deleted?:  number,         // action=delete
//     skippedRisky?: number,     // sadece approve
//     skippedRiskyIds?: string[],// hangi id'ler atlandı (UI hint)
//     skippedDuplicates: number, // dedup sayısı
//     skippedNotFound: number,   // ownership/exists fail
//   }

import { NextResponse } from "next/server";
import { z } from "zod";
import { ReviewStatus, ReviewStatusSource } from "@prisma/client";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";
import { requireUser } from "@/server/session";
import { db } from "@/server/db";
import { getActiveLocalRootFilter } from "@/server/services/local-library/active-root";

const ApproveSchema = z.object({
  action: z.literal("approve"),
  scope: z.enum(["design", "local"]),
  ids: z.array(z.string().cuid()).min(1).max(100),
});

const RejectSchema = z.object({
  action: z.literal("reject"),
  scope: z.enum(["design", "local"]),
  ids: z.array(z.string().cuid()).min(1).max(100),
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  // Not 1: delete SADECE local scope. Design için 400 (Zod literal yansır).
  scope: z.literal("local"),
  ids: z.array(z.string().cuid()).min(1).max(100),
});

const BulkSchema = z.discriminatedUnion("action", [
  ApproveSchema,
  RejectSchema,
  DeleteSchema,
]);

function hasRiskFlags(raw: unknown): boolean {
  return Array.isArray(raw) && raw.length > 0;
}

export const POST = withErrorHandling(async (req: Request) => {
  const user = await requireUser();

  const body = await req.json().catch(() => null);
  const parsed = BulkSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Geçersiz body", parsed.error.flatten());
  }

  const { action, scope, ids } = parsed.data;
  const requested = ids.length; // raw, dedup öncesi (UI hesabı bekleniyor olabilir)
  const uniqueIds = Array.from(new Set(ids));
  const skippedDuplicates = ids.length - uniqueIds.length;

  // Ownership query — soft-delete filter dahil. reviewRiskFlags skip-on-risk
  // için her satır gerekir (approve dalı). reject + delete dalları için de
  // aynı sorguyu kullanmak basit: gereksiz field; performans etkisi marjinal
  // (bulk en fazla 100 id).
  // IA-29 — local scope bulk decisions de aktif root altındaki
  // asset'lerle sınırlı. Operatör eski path'lerde bulunan stale
  // selection ile bulk action denemesi yapamaz.
  const rootFilter =
    scope === "local"
      ? await getActiveLocalRootFilter(user.id)
      : {};
  const ownedRows =
    scope === "design"
      ? await db.generatedDesign.findMany({
          where: { id: { in: uniqueIds }, userId: user.id, deletedAt: null },
          select: { id: true, reviewRiskFlags: true },
        })
      : await db.localLibraryAsset.findMany({
          where: {
            id: { in: uniqueIds },
            userId: user.id,
            deletedAt: null,
            isUserDeleted: false,
            ...rootFilter,
          },
          select: { id: true, reviewRiskFlags: true },
        });

  const skippedNotFound = uniqueIds.length - ownedRows.length;

  if (action === "approve") {
    const safeRows = ownedRows.filter((r) => !hasRiskFlags(r.reviewRiskFlags));
    const skippedRiskyIds = ownedRows
      .filter((r) => hasRiskFlags(r.reviewRiskFlags))
      .map((r) => r.id);
    const safeIdList = safeRows.map((r) => r.id);

    if (safeIdList.length > 0) {
      const data = {
        reviewStatus: ReviewStatus.APPROVED,
        reviewStatusSource: ReviewStatusSource.USER,
        reviewedAt: new Date(),
      };
      if (scope === "design") {
        await db.generatedDesign.updateMany({
          where: { id: { in: safeIdList }, userId: user.id },
          data,
        });
      } else {
        await db.localLibraryAsset.updateMany({
          where: { id: { in: safeIdList }, userId: user.id },
          data,
        });
      }
    }

    return NextResponse.json({
      requested,
      approved: safeIdList.length,
      skippedRisky: skippedRiskyIds.length,
      skippedRiskyIds,
      skippedDuplicates,
      skippedNotFound,
    });
  }

  if (action === "reject") {
    const idList = ownedRows.map((r) => r.id);
    if (idList.length > 0) {
      const data = {
        reviewStatus: ReviewStatus.REJECTED,
        reviewStatusSource: ReviewStatusSource.USER,
        reviewedAt: new Date(),
      };
      if (scope === "design") {
        await db.generatedDesign.updateMany({
          where: { id: { in: idList }, userId: user.id },
          data,
        });
      } else {
        await db.localLibraryAsset.updateMany({
          where: { id: { in: idList }, userId: user.id },
          data,
        });
      }
    }
    return NextResponse.json({
      requested,
      rejected: idList.length,
      skippedDuplicates,
      skippedNotFound,
    });
  }

  // action === "delete" + scope === "local" (Zod literal garanti).
  const idList = ownedRows.map((r) => r.id);
  if (idList.length > 0) {
    await db.localLibraryAsset.updateMany({
      where: { id: { in: idList }, userId: user.id },
      data: {
        isUserDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
  return NextResponse.json({
    requested,
    deleted: idList.length,
    skippedDuplicates,
    skippedNotFound,
  });
});
