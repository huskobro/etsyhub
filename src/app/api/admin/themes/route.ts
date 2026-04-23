import { NextResponse } from "next/server";
import { z } from "zod";
import { ThemeStatus } from "@prisma/client";
import { db } from "@/server/db";
import { requireAdmin } from "@/server/session";
import { audit } from "@/server/audit";
import { withErrorHandling } from "@/lib/http";
import { ValidationError } from "@/lib/errors";

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const themes = await db.theme.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ themes });
});

const patchBody = z.object({ themeId: z.string().min(1) });

export const PATCH = withErrorHandling(async (req: Request) => {
  const admin = await requireAdmin();
  const parsed = patchBody.safeParse(await req.json());
  if (!parsed.success) {
    throw new ValidationError("Geçersiz istek", parsed.error.flatten());
  }
  const next = await db.$transaction(async (tx) => {
    await tx.theme.updateMany({
      where: { status: ThemeStatus.ACTIVE },
      data: { status: ThemeStatus.DRAFT },
    });
    return tx.theme.update({
      where: { id: parsed.data.themeId },
      data: { status: ThemeStatus.ACTIVE },
    });
  });
  await audit({
    actor: admin.email,
    userId: admin.id,
    action: "admin.theme.activate",
    targetType: "Theme",
    targetId: next.id,
    metadata: { name: next.name },
  });
  return NextResponse.json({ theme: next });
});
