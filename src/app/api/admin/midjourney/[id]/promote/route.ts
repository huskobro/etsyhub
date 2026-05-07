// Pass 55 — Admin MJ job → GeneratedDesign promote (Review handoff).
//
// Sözleşme:
//   POST /api/admin/midjourney/:id/promote
//   body: { midjourneyAssetIds: string[], referenceId, productTypeId }
//   200 → { ok, results: PromoteResult[], createdCount, alreadyPromotedCount }
//   400 → invalid body
//   404 → MidjourneyJob veya bağımlı entity yok
//
// İdempotent: aynı assetId için ikinci promote yeni row yaratmaz.

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { bulkPromoteMidjourneyAssets } from "@/server/services/midjourney/promote";

const bodySchema = z.object({
  midjourneyAssetIds: z.array(z.string().min(1)).min(1).max(8),
  referenceId: z.string().min(1),
  productTypeId: z.string().min(1),
});

type Ctx = { params: { id: string } };

export const POST = withErrorHandling(async (req: Request, ctx: Ctx) => {
  const admin = await requireAdmin();
  const { id: midjourneyJobId } = ctx.params;

  const text = await req.text();
  if (!text.trim()) throw new ValidationError("Boş body");
  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(text));
  } catch {
    throw new ValidationError("Geçersiz JSON");
  }
  if (!parsed.success) {
    throw new ValidationError(
      "Geçersiz body",
      parsed.error.flatten().fieldErrors,
    );
  }

  // Tüm asset id'leri bu job'a ait olmalı (cross-job promote engeli).
  const job = await db.midjourneyJob.findUnique({
    where: { id: midjourneyJobId },
    select: {
      id: true,
      generatedAssets: { select: { id: true } },
    },
  });
  if (!job) throw new NotFoundError("MidjourneyJob bulunamadı");
  const validIds = new Set(job.generatedAssets.map((a) => a.id));
  const invalid = parsed.data.midjourneyAssetIds.filter(
    (id) => !validIds.has(id),
  );
  if (invalid.length > 0) {
    throw new ValidationError(
      `Asset id'leri bu job'a ait değil: ${invalid.join(", ")}`,
    );
  }

  const result = await bulkPromoteMidjourneyAssets({
    midjourneyAssetIds: parsed.data.midjourneyAssetIds,
    referenceId: parsed.data.referenceId,
    productTypeId: parsed.data.productTypeId,
    actorUserId: admin.id,
  });

  await audit({
    actor: admin.id,
    action: "MIDJOURNEY_PROMOTE_TO_REVIEW",
    targetType: "MidjourneyJob",
    targetId: midjourneyJobId,
    metadata: {
      assetCount: parsed.data.midjourneyAssetIds.length,
      createdCount: result.createdCount,
      alreadyPromotedCount: result.alreadyPromotedCount,
      referenceId: parsed.data.referenceId,
      productTypeId: parsed.data.productTypeId,
    },
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
});
