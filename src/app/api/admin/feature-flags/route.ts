import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const flags = await db.featureFlag.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ flags });
});

const patchBody = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
});

export const PATCH = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = patchBody.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const flag = await db.featureFlag.update({
    where: { key: parsed.data.key },
    data: { enabled: parsed.data.enabled },
  });
  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "admin.featureFlag.toggle",
    targetType: "FeatureFlag",
    targetId: flag.id,
    metadata: { key: flag.key, enabled: flag.enabled },
  });
  return NextResponse.json({ flag });
});
