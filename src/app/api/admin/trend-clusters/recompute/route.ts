import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { enqueueTrendClusterUpdate } from "@/features/trend-stories/services/trend-update-scheduler";

const bodySchema = z.object({
  userId: z.string(),
});

export const POST = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }

  const target = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true },
  });
  if (!target) {
    throw new NotFoundError("Hedef kullanıcı bulunamadı");
  }

  const result = await enqueueTrendClusterUpdate(parsed.data.userId);

  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "trend_clusters.recompute",
    targetType: "user",
    targetId: parsed.data.userId,
    metadata: { result },
  });

  return NextResponse.json(result);
});
