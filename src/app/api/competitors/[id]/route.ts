import { NextResponse } from "next/server";
import { requireUser } from "@/server/session";
import { withErrorHandling } from "@/lib/http";
import { db } from "@/server/db";
import {
  deleteCompetitor,
  getCompetitor,
} from "@/features/competitors/services/competitor-service";
import { audit } from "@/server/audit";

type Ctx = { params: { id: string } };

export const GET = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const competitor = await getCompetitor(user.id, ctx.params.id);
  const lastScan = await db.competitorScan.findFirst({
    where: { competitorStoreId: competitor.id, userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ competitor, lastScan });
});

export const DELETE = withErrorHandling(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  await deleteCompetitor(user.id, ctx.params.id);
  await audit({
    actor: user.id,
    userId: user.id,
    action: "competitor.delete",
    targetType: "CompetitorStore",
    targetId: ctx.params.id,
  });
  return NextResponse.json({ ok: true });
});
